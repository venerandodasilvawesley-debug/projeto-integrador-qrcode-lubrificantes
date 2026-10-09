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
import org.json.JSONObject
import kotlin.concurrent.thread

// Fica ligado em segundo plano (notificação fixa) e dispara o alarme em tela cheia, mesmo com o
// celular bloqueado, por dois caminhos independentes (se um falhar, o outro ainda avisa):
//  1) leituras dos sensores por MQTT (WebSocket seguro), avaliadas com as mesmas regras da ficha;
//  2) alertas publicados no ntfy pelo simulador ou pela bancada, recebidos por HTTPS comum.
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

    private var mqtt: MqttWs? = null
    @Volatile private var ligado = true
    private var config = Config()
    private var disparado = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        criarCanais(this)
        val n = notificacaoFixa("Conectando aos sensores…")
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID_FIXO, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        else startForeground(ID_FIXO, n)
        thread {
            config = Config.baixar()
            mqtt = MqttWs(config.mqttServidor, config.mqttTopico, { e -> estado = e; if (e != "Conectado") atualizarFixa(e) else atualizarFixa("Conectado. Aguardando leituras da $CODIGO") }, { receber(it) })
                .also { it.iniciar() }
            ouvirNtfy()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        ligado = false
        mqtt?.parar()
        estado = "Desligado"
        super.onDestroy()
    }

    // Alertas do ntfy (HTTPS): fluxo contínuo de mensagens do tópico; cada alerta traz as leituras no link.
    private fun ouvirNtfy() {
        thread {
            var desde = System.currentTimeMillis() / 1000
            while (ligado) {
                try {
                    val c = java.net.URL("https://ntfy.sh/" + config.ntfyTopico + "/json?since=" + desde).openConnection() as java.net.HttpURLConnection
                    c.connectTimeout = 15000; c.readTimeout = 120000 // o ntfy manda um sinal de vida a cada ~45 s
                    c.inputStream.bufferedReader().use { r ->
                        while (ligado) {
                            val linha = r.readLine() ?: break
                            val j = try { JSONObject(linha) } catch (e: Exception) { continue }
                            desde = maxOf(desde, j.optLong("time", desde))
                            if (j.optString("event") == "message") alertaDoNtfy(j.optString("click"))
                        }
                    }
                } catch (e: Exception) {
                    Thread.sleep(5000)
                }
            }
        }
    }

    @Synchronized private fun alertaDoNtfy(click: String) {
        val m = Regex("[?&]alerta=([^&]+)").find(click) ?: return
        val j = try { JSONObject(android.net.Uri.decode(m.groupValues[1])) } catch (e: Exception) { return }
        val L = Leitura(j.optDouble("v"), j.optDouble("p"), j.optDouble("tc"))
        val a = avaliar(config, L)
        if (a.nivel == 0 || Alerta.ativo != null) return
        disparado = maxOf(disparado, a.nivel)
        dispararAlarme(L, a, j.optLong("t", System.currentTimeMillis()))
    }

    @Synchronized private fun receber(texto: String) {
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

    private fun dispararAlarme(L: Leitura, a: Avaliacao, hora: Long = System.currentTimeMillis()) {
        Alerta.iniciar(this, DadosAlerta(
            nivel = a.nivel, v = L.v, p = L.p, t = L.t, nome = config.nome,
            causa = a.causas.firstOrNull()?.titulo ?: "Leituras fora do normal.",
            verificar = a.causas.firstOrNull()?.verificar?.joinToString(" · ") ?: "",
            leituras = linhaLeituras(L, a), hora = hora))
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
