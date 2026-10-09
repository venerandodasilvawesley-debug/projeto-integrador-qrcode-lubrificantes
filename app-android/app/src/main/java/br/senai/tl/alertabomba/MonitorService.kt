package br.senai.tl.alertabomba

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.RingtoneManager
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
        const val CANAL_ALARME = "alarme_falha"
        const val ID_FIXO = 1
        const val ID_ALARME = 2
        @Volatile var ultimaLeitura: Leitura? = null
        @Volatile var ultimaHora = 0L
        @Volatile var estado = "Desligado"
        @Volatile var alarmeAberto = false

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
                setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                    AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
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
                    estado = "Sem conexão, tentando de novo"
                    atualizarFixa("Sem conexão com os sensores. Tentando de novo…")
                }
                override fun messageArrived(topic: String?, message: MqttMessage?) { receber(String(message?.payload ?: return)) }
                override fun deliveryComplete(token: IMqttDeliveryToken?) {}
            })
            val op = MqttConnectOptions().apply {
                isAutomaticReconnect = true; isCleanSession = true; connectionTimeout = 15; keepAliveInterval = 30
            }
            cliente = c
            c.connect(op)
        } catch (e: Exception) {
            estado = "Erro ao conectar"
            atualizarFixa("Erro ao conectar aos sensores")
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
        if (a.nivel > disparado && !alarmeAberto) {
            disparado = a.nivel
            dispararAlarme(L, a)
        }
    }

    private fun dispararAlarme(L: Leitura, a: Avaliacao) {
        val i = Intent(this, AlarmeActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("nivel", a.nivel)
            putExtra("v", L.v); putExtra("p", L.p); putExtra("t", L.t)
            putExtra("nome", config.nome)
            putExtra("causa", a.causas.firstOrNull()?.titulo ?: "Leituras fora do normal.")
            putExtra("verificar", a.causas.firstOrNull()?.verificar?.joinToString(" · ") ?: "")
            putExtra("leituras", linhaLeituras(L, a))
            putExtra("hora", System.currentTimeMillis())
        }
        val pi = PendingIntent.getActivity(this, 10, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = Notification.Builder(this, CANAL_ALARME)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("$CODIGO – ${NOMES_NIVEL[a.nivel]}")
            .setContentText(a.causas.firstOrNull()?.titulo ?: "Leituras fora do normal")
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setFullScreenIntent(pi, true)   // abre a tela de alarme por cima do bloqueio
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
        getSystemService(NotificationManager::class.java).notify(ID_ALARME, n)
        // com o app na frente, abre direto
        try { startActivity(i) } catch (e: Exception) {}
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
