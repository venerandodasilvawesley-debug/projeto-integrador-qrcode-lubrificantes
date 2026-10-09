package br.senai.tl.alertabomba

import android.app.Activity
import android.app.NotificationManager
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Alarme em tela cheia, no estilo do alerta da Defesa Civil: acende a tela por cima do bloqueio,
// pisca, toca a sirene de emergência em volume máximo e vibra sem parar até a pessoa tocar em "Ciente".
class AlarmeActivity : Activity() {

    private var sirene: Sirene? = null
    private var vibrador: Vibrator? = null
    private val pisca = Handler(Looper.getMainLooper())
    private var aceso = true
    private lateinit var raiz: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MonitorService.alarmeAberto = true
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
        @Suppress("DEPRECATION")
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)

        val critico = intent.getIntExtra("nivel", 2) == 2
        val corA = if (critico) Color.parseColor("#B3141B") else Color.parseColor("#F2B705")
        val corB = if (critico) Color.parseColor("#5C0A0D") else Color.parseColor("#C99400")
        val texto = if (critico) Color.WHITE else Color.parseColor("#14202B")

        raiz = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            setPadding(dp(22), dp(28), dp(22), dp(28)); setBackgroundColor(corA)
        }
        fun t(s: String, sp: Float, negrito: Boolean = false) = TextView(this).apply {
            text = s; setTextColor(texto); textSize = sp; gravity = Gravity.CENTER
            if (negrito) setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(6), 0, dp(6))
        }
        val selo = t("ALERTA DE FALHA · " + NOMES_NIVEL[intent.getIntExtra("nivel", 2)], 17f, true).apply {
            background = GradientDrawable().apply { setStroke(dp(3), texto); cornerRadius = dp(10).toFloat() }
            setPadding(dp(10), dp(8), dp(10), dp(8))
        }
        raiz.addView(selo)
        raiz.addView(t(CODIGO, 52f, true))
        raiz.addView(t(intent.getStringExtra("nome") ?: "", 16f))
        raiz.addView(t(intent.getStringExtra("causa") ?: "", 24f, true))
        raiz.addView(t(intent.getStringExtra("leituras") ?: "", 16f))
        val ver = intent.getStringExtra("verificar") ?: ""
        if (ver.isNotEmpty()) raiz.addView(t("Verificar: $ver", 16f))
        val hora = SimpleDateFormat("HH:mm", Locale("pt", "BR")).format(Date(intent.getLongExtra("hora", System.currentTimeMillis())))
        raiz.addView(t("Detectado às $hora pelos sensores da bomba", 15f))
        val ciente = Button(this).apply {
            text = "CIENTE · IR ATÉ A BOMBA"; textSize = 20f; setTypeface(typeface, Typeface.BOLD)
            setTextColor(if (critico) Color.parseColor("#14202B") else Color.WHITE)
            background = GradientDrawable().apply {
                setColor(if (critico) Color.WHITE else Color.parseColor("#14202B")); cornerRadius = dp(14).toFloat()
            }
            setPadding(dp(12), dp(18), dp(12), dp(18))
            setOnClickListener { ciente() }
        }
        raiz.addView(ciente, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(18) })
        setContentView(ScrollView(this).apply { isFillViewport = true; setBackgroundColor(corA); addView(raiz) })

        // pisca (vermelho / vermelho escuro)
        if (critico) pisca.post(object : Runnable {
            override fun run() { aceso = !aceso; val c = if (aceso) corA else corB; raiz.setBackgroundColor(c); (raiz.parent as? ScrollView)?.setBackgroundColor(c); pisca.postDelayed(this, 500) }
        })
        sirene = Sirene(this, critico).also { it.tocar() }
        vibrar(critico)
    }


    // vibra sem parar (o padrão repete do índice 0) até tocar em "Ciente"
    @Suppress("DEPRECATION")
    private fun vibrar(critico: Boolean) {
        vibrador = if (Build.VERSION.SDK_INT >= 31) getSystemService(VibratorManager::class.java).defaultVibrator
            else getSystemService(Vibrator::class.java)
        val padrao = if (critico) longArrayOf(0, 1000, 300, 1000, 300) else longArrayOf(0, 400, 200, 400, 1000)
        val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
        vibrador?.vibrate(VibrationEffect.createWaveform(padrao, 0), attrs)
    }

    private fun parar() {
        pisca.removeCallbacksAndMessages(null)
        sirene?.parar()
        sirene = null
        vibrador?.cancel()
        getSystemService(NotificationManager::class.java).cancel(MonitorService.ID_ALARME)
        MonitorService.alarmeAberto = false
    }

    // "Ciente": abre a ficha com o alerta pendente; ele só fecha com a leitura do QR Code na bomba
    private fun ciente() {
        parar()
        val alerta = JSONObject().apply {
            put("id", java.lang.Long.toString(System.currentTimeMillis(), 36))
            put("t", intent.getLongExtra("hora", System.currentTimeMillis()))
            put("v", intent.getDoubleExtra("v", 0.0)); put("p", intent.getDoubleExtra("p", 0.0)); put("tc", intent.getDoubleExtra("t", 0.0))
        }
        startActivity(Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("url", "$SITE/e/$CODIGO?alerta=" + Uri.encode(alerta.toString()))
        })
        finish()
    }

    @Deprecated("Deprecated in Java")
    @Suppress("MissingSuperCall")
    override fun onBackPressed() { /* só sai tocando em Ciente */ }

    override fun onDestroy() { if (MonitorService.alarmeAberto) parar(); super.onDestroy() }

    private fun dp(x: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, x.toFloat(), resources.displayMetrics).toInt()
}
