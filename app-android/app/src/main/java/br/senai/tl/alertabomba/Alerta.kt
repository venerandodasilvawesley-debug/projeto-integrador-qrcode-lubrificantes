package br.senai.tl.alertabomba

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import org.json.JSONObject

// Alerta ativo: sirene e vibração ficam tocando no serviço de fundo, mesmo com a tela minimizada,
// e SÓ PARAM quando o mecânico lê o QR Code da bomba (leitor do app ou câmera do celular).
data class DadosAlerta(
    val nivel: Int, val v: Double, val p: Double, val t: Double,
    val nome: String, val causa: String, val verificar: String, val leituras: String,
    val hora: Long, val teste: Boolean = false
) {
    // número da nota de manutenção SAP (simulada), igual ao que a ficha mostra
    val nota: Long get() = notaSap(hora)
}

fun notaSap(hora: Long): Long = 10000000L + (hora / 1000) % 9000000L

object Alerta {
    const val ID_NOTIF = 2
    @Volatile var ativo: DadosAlerta? = null
        private set
    private var sirene: Sirene? = null
    private var vibrador: Vibrator? = null
    private var luz: android.os.PowerManager.WakeLock? = null

    fun iniciar(ctx: Context, d: DadosAlerta) {
        val app = ctx.applicationContext
        if (ativo != null) return
        ativo = d
        acenderTela(app)
        sirene = Sirene(app, d.nivel == 2).also { it.tocar() }
        vibrar(app, d.nivel == 2)
        val abrir = Intent(app, AlarmeActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pi = PendingIntent.getActivity(app, 10, abrir, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val ler = PendingIntent.getActivity(app, 11, Intent(app, AlarmeActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("ler", true),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = Notification.Builder(app, MonitorService.CANAL_ALARME)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("$CODIGO – ${NOMES_NIVEL[d.nivel]} · nota SAP ${d.nota}")
            .setContentText("Vá até a bomba e leia o QR Code para parar o alarme")
            .setStyle(Notification.BigTextStyle().bigText(d.causa + "\n" + d.leituras + "\nO alarme só para com a leitura do QR Code na bomba."))
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setFullScreenIntent(pi, true)
            .setContentIntent(pi)
            .addAction(Notification.Action.Builder(null, "Ler QR Code da bomba", ler).build())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
        app.getSystemService(NotificationManager::class.java).notify(ID_NOTIF, n)
        try { app.startActivity(abrir) } catch (e: Exception) {}
    }

    // texto lido no QR Code: o da etiqueta da bomba é o endereço .../e/BOMBA-001
    fun ehQrDaBomba(texto: String?): Boolean = texto != null && Regex("/e/$CODIGO/?(\\?|#|$)", RegexOption.IGNORE_CASE).containsMatchIn(texto)

    // QR da bomba lido: para o alarme e devolve o endereço da ficha já com o alerta e a chegada
    fun confirmarChegada(ctx: Context): String? {
        val d = ativo ?: return null
        parar(ctx)
        if (d.teste) return null
        val j = JSONObject().apply {
            put("id", java.lang.Long.toString(d.hora, 36)); put("t", d.hora)
            put("v", d.v); put("p", d.p); put("tc", d.t)
        }
        return "$SITE/e/$CODIGO?alerta=" + Uri.encode(j.toString()) + "&chegada=" + System.currentTimeMillis()
    }

    // acende a tela na hora do alarme (como chamada recebida), para a tela cheia aparecer sem desbloquear
    @Suppress("DEPRECATION")
    private fun acenderTela(app: Context) {
        try {
            val pm = app.getSystemService(android.os.PowerManager::class.java)
            luz = pm.newWakeLock(android.os.PowerManager.SCREEN_BRIGHT_WAKE_LOCK or android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP or
                android.os.PowerManager.ON_AFTER_RELEASE, "AlertaBomba:alarme").apply { acquire(60_000L) }
        } catch (e: Exception) {}
    }

    fun parar(ctx: Context) {
        val app = ctx.applicationContext
        try { luz?.let { if (it.isHeld) it.release() } } catch (e: Exception) {}
        luz = null
        sirene?.parar(); sirene = null
        vibrador?.cancel(); vibrador = null
        app.getSystemService(NotificationManager::class.java).cancel(ID_NOTIF)
        ativo = null
    }

    @Suppress("DEPRECATION")
    private fun vibrar(ctx: Context, critico: Boolean) {
        vibrador = if (Build.VERSION.SDK_INT >= 31) ctx.getSystemService(VibratorManager::class.java).defaultVibrator
            else ctx.getSystemService(Vibrator::class.java)
        val padrao = if (critico) longArrayOf(0, 1000, 300, 1000, 300) else longArrayOf(0, 400, 200, 400, 1000)
        vibrador?.vibrate(VibrationEffect.createWaveform(padrao, 0),
            AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
    }
}
