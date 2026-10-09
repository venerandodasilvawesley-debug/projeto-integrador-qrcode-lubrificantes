package br.senai.tl.alertabomba

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken
import org.eclipse.paho.client.mqttv3.MqttAsyncClient
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended
import org.eclipse.paho.client.mqttv3.MqttConnectOptions
import org.eclipse.paho.client.mqttv3.MqttMessage
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence
import org.json.JSONObject
import kotlin.concurrent.thread

// Fica ligado em segundo plano (notificação fixa), recebe as leituras dos sensores por MQTT,
// avalia com as mesmas regras da ficha e, se passar do limite, abre o alarme em tela cheia,
// mesmo com o celular bloqueado.
class MonitorService : Service() {

    companion object {
        const val CANAL_FIXO = "monitorando"
        const val CANAL_ALARME = "alarme_falha_v2" // o som é a sirene do app, não o da notificação
        const val ID_FIXO = 1
        const val ID_ALARME = 2
        @Volatile var ultimaLeitura: Leitura? = null
        @Volatile var ultimaHora = 0L
        @Volatile var estado = "Desligado"

        fun iniciar(ctx: Context) {
            val i = Intent(ctx, MonitorService::class.java)
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
        }

        fun criarCanais(ctx: Context) {
            val nm = ctx.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CANAL_FIXO, "Monitoramento ligado", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Aviso fixo enquanto o app acompanha os sensores da bomba"
            })
            nm.createNotificationChannel(NotificationChannel(CANAL_ALARME, "Alarme de falha", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Alarme em tela cheia quando a bomba sai do normal"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 300, 1000, 300, 1000)
                setBypassDnd(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setSound(null, null)
            })
        }
    }

    private var cliente: MqttAsyncClient? = null
    private var config = Config()
    private var disparado = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        criarCanais(this)
        val n = notificacaoFixa("Conectando aos sensores…")
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID_FIXO, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        else startForeground(ID_FIXO, n)
        thread { config = Config.baixar(); conectar() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        try { cliente?.disconnect() } catch (e: Exception) {}
        estado = "Desligado"
        super.onDestroy()
    }

    private fun conectar() {
        try {
            val c = MqttAsyncClient(config.mqttServidor, "app-" + System.currentTimeMillis().toString(36), MemoryPersistence())
            c.setCallback(object : MqttCallbackExtended {
                override fun connectComplete(reconnect: Boolean, serverURI: String?) {
                    estado = "Conectado"
                    try { c.subscribe(config.mqttTopico, 0) } catch (e: Exception) {}
                    atualizarFixa("Conectado. Aguardando leituras da $CODIGO")
                }
                override fun connectionLost(cause: Throwable?) {
                    estado = "Sem conexão (" + (cause?.message ?: "rede") + "), tentando de novo"
                    atualizarFixa("Sem conexão com os sensores. Tentando de novo…")
                }
                override fun messageArrived(topic: String?, message: MqttMessage?) { receber(String(message?.payload ?: return)) }
                override fun deliveryComplete(token: IMqttDeliveryToken?) {}
            })
            val op = MqttConnectOptions().apply {
                isAutomaticReconnect = true; isCleanSession = true; connectionTimeout = 15; keepAliveInterval = 30
            }
            cliente = c
            c.connect(op, null, object : org.eclipse.paho.client.mqttv3.IMqttActionListener {
                override fun onSuccess(t: org.eclipse.paho.client.mqttv3.IMqttToken?) {}
                override fun onFailure(t: org.eclipse.paho.client.mqttv3.IMqttToken?, e: Throwable?) {
                    estado = "Erro ao conectar: " + (e?.message ?: "sem detalhe") + ". Tentando de novo…"
                    atualizarFixa(estado)
                    // nova tentativa em 10 s (a reconexão automática só vale depois da 1ª conexão)
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ thread { conectar() } }, 10000)
                }
            })
        } catch (e: Exception) {
            estado = "Erro ao conectar: " + (e.message ?: e.javaClass.simpleName)
            atualizarFixa(estado)
        }
    }

    private fun receber(texto: String) {
        val L = try {
            val j = JSONObject(texto)
            Leitura(j.getDouble("v"), j.getDouble("p"), j.getDouble("t"))
        } catch (e: Exception) { return }
        ultimaLeitura = L; ultimaHora = System.currentTimeMillis()
        val a = avaliar(config, L)
        atualizarFixa(NOMES_NIVEL[a.nivel] + " · " + linhaLeituras(L, a))
        if (a.nivel == 0) { disparado = 0; return }
        // dispara uma vez por piora (atenção -> crítico dispara de novo)
        if (a.nivel > disparado && Alerta.ativo == null) {
            disparado = a.nivel
            dispararAlarme(L, a)
        }
    }

    private fun dispararAlarme(L: Leitura, a: Avaliacao) {
        Alerta.iniciar(this, DadosAlerta(
            nivel = a.nivel, v = L.v, p = L.p, t = L.t, nome = config.nome,
            causa = a.causas.firstOrNull()?.titulo ?: "Leituras fora do normal.",
            verificar = a.causas.firstOrNull()?.verificar?.joinToString(" · ") ?: "",
            leituras = linhaLeituras(L, a), hora = System.currentTimeMillis()))
    }

    private fun notificacaoFixa(texto: String): Notification {
        val abrir = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, CANAL_FIXO)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("Monitorando $CODIGO")
            .setContentText(texto)
            .setContentIntent(abrir)
            .setOngoing(true)
            .build()
    }

    private fun atualizarFixa(texto: String) {
        getSystemService(NotificationManager::class.java).notify(ID_FIXO, notificacaoFixa(texto))
    }
}
