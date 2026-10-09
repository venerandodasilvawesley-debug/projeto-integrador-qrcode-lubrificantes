package br.senai.tl.alertabomba

import android.app.Activity
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

// Atualização automática: o site publica app/versao.json com o número da versão mais nova e o APK.
// O app confere ao abrir e a cada 6 h; se houver versão nova, baixa sozinho e abre o instalador
// (o Android exige que a pessoa toque em "Atualizar" para apps instalados fora da Play Store).
object Atualizacao {
    private const val ID_NOTIF = 3
    private val http = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(60, TimeUnit.SECONDS).build()

    data class Versao(val codigo: Long, val nome: String, val url: String, val notas: String)

    fun versaoInstalada(ctx: Context): Long {
        val pi = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
        return if (Build.VERSION.SDK_INT >= 28) pi.longVersionCode else @Suppress("DEPRECATION") pi.versionCode.toLong()
    }

    // devolve a versão nova, ou null se já está na mais nova (ou sem internet)
    fun verificar(ctx: Context): Versao? = try {
        http.newCall(Request.Builder().url("$SITE/app/versao.json?t=" + System.currentTimeMillis()).build()).execute().use { r ->
            if (!r.isSuccessful) return null
            val j = JSONObject(r.body!!.string())
            val v = Versao(j.getLong("versionCode"), j.optString("versionName"), j.getString("url"), j.optString("notas"))
            if (v.codigo > versaoInstalada(ctx)) v else null
        }
    } catch (e: Exception) { null }

    // baixa o APK para a pasta de cache do app
    fun baixar(ctx: Context, v: Versao): File? = try {
        val pasta = File(ctx.cacheDir, "atualizacao").apply { mkdirs() }
        val arq = File(pasta, "AlertaBomba-${v.codigo}.apk")
        if (!arq.exists() || arq.length() == 0L) {
            val url = if (v.url.startsWith("http")) v.url else SITE + v.url
            http.newCall(Request.Builder().url(url).build()).execute().use { r ->
                if (!r.isSuccessful) return null
                val tmp = File(pasta, "baixando.apk")
                tmp.outputStream().use { r.body!!.byteStream().copyTo(it) }
                pasta.listFiles()?.forEach { if (it.name != tmp.name) it.delete() }
                tmp.renameTo(arq)
            }
        }
        arq
    } catch (e: Exception) { null }

    // abre a tela de instalação do Android (pede antes a permissão de instalar, se faltar)
    fun instalar(act: Activity, arq: File) {
        if (Build.VERSION.SDK_INT >= 26 && !act.packageManager.canRequestPackageInstalls()) {
            act.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.packageName)))
            return
        }
        val uri = FileProvider.getUriForFile(act, act.packageName + ".arquivos", arq)
        act.startActivity(Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }

    // aviso pelo serviço em segundo plano: tocar abre o app, que instala
    fun avisar(ctx: Context, v: Versao) {
        val pi = PendingIntent.getActivity(ctx, 30, Intent(ctx, MainActivity::class.java).putExtra("atualizar", true),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        ctx.getSystemService(NotificationManager::class.java).notify(ID_NOTIF, Notification.Builder(ctx, MonitorService.CANAL_FIXO)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("Atualização do Alerta Bomba: versão ${v.nome}")
            .setContentText(if (v.notas.isNotEmpty()) v.notas else "Toque para atualizar")
            .setContentIntent(pi).setAutoCancel(true).build())
    }
}
