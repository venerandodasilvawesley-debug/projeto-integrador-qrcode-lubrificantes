package br.senai.tl.alertabomba

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.TypedValue
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

// Tela principal: mostra a ficha da bomba (o mesmo site do QR Code) e, em cima, o estado do
// monitoramento e as permissões que o alarme em tela cheia precisa.
class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var status: TextView
    private lateinit var painel: LinearLayout
    private val relogio = Handler(Looper.getMainLooper())

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MonitorService.criarCanais(this)

        val raiz = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.parseColor("#EEF1F4")) }
        val topo = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.parseColor("#123A5C")); setPadding(dp(14), dp(10), dp(14), dp(10))
        }
        status = TextView(this).apply { setTextColor(Color.WHITE); textSize = 14f; setTypeface(typeface, Typeface.BOLD) }
        topo.addView(status)
        painel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        topo.addView(painel)
        val linha = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(6), 0, 0) }
        linha.addView(botao("Ler QR Code") { lerQr() }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        linha.addView(botao("Testar alarme") { testarAlarme() }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(6) })
        linha.addView(botao("Atualizar") { procurarAtualizacao(true) }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(6) })
        topo.addView(linha)
        raiz.addView(topo)

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            // a ficha reconhece o app e deixa o alarme por conta dele (sem alarme duplicado)
            settings.userAgentString = settings.userAgentString + " AlertaBombaApp"
            webViewClient = object : WebViewClient() {
                // links de fora do site abrem no navegador
                override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                    if (req.url.host == Uri.parse(SITE).host) return false
                    startActivity(Intent(Intent.ACTION_VIEW, req.url)); return true
                }
            }
        }
        raiz.addView(web, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(raiz)

        web.loadUrl(urlDe(intent) ?: "$SITE/e/$CODIGO")
        pedirNotificacoes()
        MonitorService.iniciar(this)
        procurarAtualizacao(intent.getBooleanExtra("atualizar", false))
    }

    // confere se há versão nova; se houver, baixa e abre o instalador
    private var atualizando = false
    private fun procurarAtualizacao(avisarSeNaoTiver: Boolean) {
        if (atualizando) return
        atualizando = true
        kotlin.concurrent.thread {
            val v = Atualizacao.verificar(this)
            val arq = v?.let { Atualizacao.baixar(this, it) }
            runOnUiThread {
                atualizando = false
                if (v != null && arq != null) {
                    android.widget.Toast.makeText(this, "Nova versão ${v.nome}: toque em Atualizar", android.widget.Toast.LENGTH_LONG).show()
                    Atualizacao.instalar(this, arq)
                } else if (avisarSeNaoTiver) {
                    android.widget.Toast.makeText(this, "O app já está na versão mais nova", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.getBooleanExtra("atualizar", false)) procurarAtualizacao(true)
        urlDe(intent)?.let { web.loadUrl(it) }
    }

    // Endereço a abrir. Se o app foi aberto pelo QR Code da etiqueta (câmera do celular -> link
    // .../e/BOMBA-001) com um alerta tocando, a leitura confirma a chegada e para o alarme.
    private fun urlDe(i: Intent): String? {
        i.getStringExtra("url")?.let { return it }
        val dado = i.data?.toString() ?: return null
        if (Alerta.ativo != null && Alerta.ehQrDaBomba(dado)) return Alerta.confirmarChegada(this) ?: "$SITE/e/$CODIGO"
        return dado
    }

    private fun lerQr() {
        com.google.zxing.integration.android.IntentIntegrator(this).apply {
            setDesiredBarcodeFormats(com.google.zxing.integration.android.IntentIntegrator.QR_CODE)
            setPrompt("Aponte para o QR Code da etiqueta $CODIGO"); setBeepEnabled(false); setOrientationLocked(false)
        }.initiateScan()
    }

    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val r = com.google.zxing.integration.android.IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (r == null) { super.onActivityResult(requestCode, resultCode, data); return }
        val texto = r.contents ?: return
        if (!Alerta.ehQrDaBomba(texto)) { android.widget.Toast.makeText(this, "Este QR Code não é da $CODIGO.", android.widget.Toast.LENGTH_LONG).show(); return }
        web.loadUrl(Alerta.confirmarChegada(this) ?: "$SITE/e/$CODIGO")
    }

    override fun onResume() {
        super.onResume()
        desenharPermissoes()
        relogio.post(object : Runnable {
            override fun run() { atualizarStatus(); relogio.postDelayed(this, 2000) }
        })
    }

    override fun onPause() { relogio.removeCallbacksAndMessages(null); super.onPause() }

    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onBackPressed() { if (web.canGoBack()) web.goBack() else super.onBackPressed() }

    private fun atualizarStatus() {
        val L = MonitorService.ultimaLeitura
        val idade = (System.currentTimeMillis() - MonitorService.ultimaHora) / 1000
        Alerta.ativo?.let {
            status.text = "⚠ ALERTA ATIVO · nota SAP ${it.nota} · leia o QR Code da bomba para parar o alarme"
            status.setTextColor(Color.parseColor("#F2B705")); return
        }
        status.setTextColor(Color.WHITE)
        status.text = "v" + Atualizacao.versaoInstalada(this) + " · Monitorando $CODIGO · " + when {
            L != null && idade < 5 -> "ao vivo (" + NOMES_NIVEL[avaliar(Config(), L).nivel].lowercase() + ")"
            L != null -> "sem leitura há $idade s"
            else -> MonitorService.estado
        }
    }

    // ---- permissões do alarme ----
    private fun pedirNotificacoes() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        desenharPermissoes()
    }

    @SuppressLint("BatteryLife")
    private fun desenharPermissoes() {
        val nm = getSystemService(NotificationManager::class.java)
        val pm = getSystemService(PowerManager::class.java)
        val faltam = mutableListOf<Pair<String, () -> Unit>>()
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            faltam += "Permitir notificações" to { pedirNotificacoes() }
        if (Build.VERSION.SDK_INT >= 34 && !nm.canUseFullScreenIntent())
            faltam += "Permitir alarme em tela cheia" to {
                startActivity(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$packageName")))
            }
        if (!pm.isIgnoringBatteryOptimizations(packageName))
            faltam += "Não economizar bateria neste app" to {
                val i = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))
                startActivity(i)
            }
        // Xiaomi, Redmi e POCO: permissão própria "Mostrar na tela de bloqueio" (não dá para pedir pelo app)
        if (Build.MANUFACTURER.equals("xiaomi", true) && !xiaomiConferido())
            faltam += "Xiaomi: ligar \"Mostrar na tela de bloqueio\" e \"Janelas pop-up em segundo plano\"" to {
                getSharedPreferences("app", MODE_PRIVATE).edit().putBoolean("xiaomi_ok", true).apply()
                val i = Intent("miui.intent.action.APP_PERM_EDITOR").putExtra("extra_pkgname", packageName)
                try { startActivity(i) } catch (e: Exception) {
                    startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
                }
            }
        if (!nm.isNotificationPolicyAccessGranted)
            faltam += "Tocar mesmo no Não perturbe (opcional)" to {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
            }
        painel.removeAllViews()
        if (faltam.isEmpty()) return
        painel.addView(TextView(this).apply {
            text = "Para o alarme tocar com o celular bloqueado, libere:"; setTextColor(Color.parseColor("#F2B705")); textSize = 13f
            setPadding(0, dp(6), 0, dp(2))
        })
        faltam.forEach { (rotulo, acao) -> painel.addView(botao(rotulo) { acao() }) }
    }

    private fun xiaomiConferido() = getSharedPreferences("app", MODE_PRIVATE).getBoolean("xiaomi_ok", false)

    private fun testarAlarme() {
        val L = Leitura(5.2, 0.95, 33.0)
        val a = avaliar(Config(), L)
        Alerta.iniciar(this, DadosAlerta(nivel = a.nivel, v = L.v, p = L.p, t = L.t, nome = Config().nome,
            causa = "TESTE · " + (a.causas.firstOrNull()?.titulo ?: ""),
            verificar = a.causas.firstOrNull()?.verificar?.joinToString(" · ") ?: "",
            leituras = linhaLeituras(L, a), hora = System.currentTimeMillis(), teste = true))
    }

    private fun botao(rotulo: String, acao: () -> Unit) = Button(this).apply {
        text = rotulo; isAllCaps = false; textSize = 14f
        setOnClickListener(View.OnClickListener { acao() })
    }

    private fun dp(x: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, x.toFloat(), resources.displayMetrics).toInt()
}
