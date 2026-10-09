package br.senai.tl.alertabomba

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import com.google.zxing.integration.android.IntentIntegrator
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Alarme em tela cheia, no estilo do alerta da Defesa Civil: acende a tela por cima do bloqueio e pisca.
// A sirene e a vibração ficam no serviço (Alerta): minimizar NÃO para o alarme;
// ele só para quando o QR Code da bomba é lido.
class AlarmeActivity : Activity() {

    private val pisca = Handler(Looper.getMainLooper())
    private var aceso = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
        @Suppress("DEPRECATION")
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        desenhar()
        if (intent.getBooleanExtra("ler", false)) lerQr()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        desenhar()
        if (intent.getBooleanExtra("ler", false)) lerQr()
    }

    private fun desenhar() {
        val d = Alerta.ativo ?: run { finish(); return }
        val critico = d.nivel == 2
        val corA = if (critico) Color.parseColor("#B3141B") else Color.parseColor("#F2B705")
        val corB = if (critico) Color.parseColor("#5C0A0D") else Color.parseColor("#C99400")
        val texto = if (critico) Color.WHITE else Color.parseColor("#14202B")

        val raiz = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            setPadding(dp(22), dp(28), dp(22), dp(28)); setBackgroundColor(corA)
        }
        fun t(s: String, sp: Float, negrito: Boolean = false) = TextView(this).apply {
            text = s; setTextColor(texto); textSize = sp; gravity = Gravity.CENTER
            if (negrito) setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(5), 0, dp(5))
        }
        raiz.addView(t("ALERTA DE FALHA · " + NOMES_NIVEL[d.nivel] + (if (d.teste) " · TESTE" else ""), 17f, true).apply {
            background = GradientDrawable().apply { setStroke(dp(3), texto); cornerRadius = dp(10).toFloat() }
            setPadding(dp(10), dp(8), dp(10), dp(8))
        })
        raiz.addView(t(CODIGO, 52f, true))
        raiz.addView(t(d.nome, 16f))
        raiz.addView(t(d.causa, 23f, true))
        raiz.addView(t(d.leituras, 16f))
        if (d.verificar.isNotEmpty()) raiz.addView(t("Verificar: " + d.verificar, 16f))
        val hora = SimpleDateFormat("HH:mm", Locale("pt", "BR")).format(Date(d.hora))
        raiz.addView(t("Detectado às $hora · Nota SAP M2 nº ${d.nota} aberta automaticamente (simulação)", 15f))
        raiz.addView(t("O alarme só para quando o QR Code da bomba for lido.", 16f, true))

        val ler = Button(this).apply {
            text = "LER QR CODE DA BOMBA"; textSize = 20f; setTypeface(typeface, Typeface.BOLD)
            setTextColor(if (critico) Color.parseColor("#14202B") else Color.WHITE)
            background = GradientDrawable().apply { setColor(if (critico) Color.WHITE else Color.parseColor("#14202B")); cornerRadius = dp(14).toFloat() }
            setPadding(dp(12), dp(18), dp(12), dp(18))
            setOnClickListener { lerQr() }
        }
        raiz.addView(ler, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(16) })
        val minimizar = Button(this).apply {
            text = "Minimizar (o alarme continua)"; textSize = 15f; setTextColor(texto)
            background = GradientDrawable().apply { setStroke(dp(2), texto); cornerRadius = dp(12).toFloat() }
            setOnClickListener { moveTaskToBack(true) }
        }
        raiz.addView(minimizar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10) })
        if (d.teste) raiz.addView(Button(this).apply {
            text = "Encerrar teste"; textSize = 14f
            setOnClickListener { Alerta.parar(this@AlarmeActivity); finish() }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10) })

        val rolagem = ScrollView(this).apply { isFillViewport = true; setBackgroundColor(corA); addView(raiz) }
        setContentView(rolagem)
        pisca.removeCallbacksAndMessages(null)
        if (critico) pisca.post(object : Runnable {
            override fun run() { aceso = !aceso; val c = if (aceso) corA else corB; raiz.setBackgroundColor(c); rolagem.setBackgroundColor(c); pisca.postDelayed(this, 500) }
        })
    }

    private fun lerQr() {
        IntentIntegrator(this).apply {
            setDesiredBarcodeFormats(IntentIntegrator.QR_CODE)
            setPrompt("Aponte para o QR Code da etiqueta $CODIGO")
            setBeepEnabled(false)
            setOrientationLocked(false)
        }.initiateScan()
    }

    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val r = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (r == null) { super.onActivityResult(requestCode, resultCode, data); return }
        if (r.contents == null) return
        if (!Alerta.ehQrDaBomba(r.contents)) {
            Toast.makeText(this, "Este QR Code não é da $CODIGO. Leia a etiqueta da bomba.", Toast.LENGTH_LONG).show()
            return
        }
        val url = Alerta.confirmarChegada(this)
        pisca.removeCallbacksAndMessages(null)
        if (url != null) startActivity(Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP); putExtra("url", url)
        })
        finish()
    }

    // voltar = minimizar; o alarme continua
    @Deprecated("Deprecated in Java")
    @Suppress("MissingSuperCall")
    override fun onBackPressed() { moveTaskToBack(true) }

    override fun onDestroy() { pisca.removeCallbacksAndMessages(null); super.onDestroy() }

    private fun dp(x: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, x.toFloat(), resources.displayMetrics).toInt()
}
