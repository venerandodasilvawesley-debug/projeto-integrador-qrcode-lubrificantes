package br.senai.tl.alertabomba

import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import okio.ByteString.Companion.toByteString
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit

// Cliente MQTT 3.1.1 mínimo (só assinar, QoS 0) sobre WebSocket seguro, com OkHttp.
// Substitui a biblioteca Paho, que no Android não informava o nome do servidor (SNI) e era recusada.
class MqttWs(
    private val url: String,
    private val topico: String,
    private val aoMudarEstado: (String) -> Unit,
    private val aoReceber: (String) -> Unit
) {
    private val http = OkHttpClient.Builder().pingInterval(0, TimeUnit.SECONDS).readTimeout(0, TimeUnit.SECONDS).build()
    private val fila = Handler(Looper.getMainLooper())
    private var ws: WebSocket? = null
    private var ligado = false
    private val buffer = ByteArrayOutputStream()

    fun iniciar() { ligado = true; abrir() }

    fun parar() { ligado = false; fila.removeCallbacksAndMessages(null); ws?.close(1000, null); ws = null }

    private fun abrir() {
        if (!ligado) return
        aoMudarEstado("Conectando aos sensores…")
        val req = Request.Builder().url(url).header("Sec-WebSocket-Protocol", "mqtt").build()
        ws = http.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                buffer.reset()
                webSocket.send(connect("app-" + System.currentTimeMillis().toString(36)).toByteString())
            }
            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                buffer.write(bytes.toByteArray())
                processar(webSocket)
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                aoMudarEstado("Sem conexão com os sensores (" + (t.message ?: t.javaClass.simpleName) + "). Tentando de novo…")
                reabrir()
            }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { reabrir() }
        })
    }

    private fun reabrir() {
        fila.removeCallbacksAndMessages(null)
        if (ligado) fila.postDelayed({ abrir() }, 5000)
    }

    // pacotes podem vir juntos ou partidos entre mensagens do WebSocket
    private fun processar(w: WebSocket) {
        var dados = buffer.toByteArray()
        while (dados.size >= 2) {
            var mult = 1; var tam = 0; var i = 1
            while (true) {
                if (i >= dados.size) return
                val b = dados[i].toInt() and 0xFF
                tam += (b and 0x7F) * mult; mult *= 128; i++
                if (b and 0x80 == 0) break
            }
            if (dados.size < i + tam) return
            val tipo = (dados[0].toInt() and 0xF0) shr 4
            val corpo = dados.copyOfRange(i, i + tam)
            when (tipo) {
                2 -> { // CONNACK
                    if (corpo.size >= 2 && corpo[1].toInt() == 0) {
                        w.send(subscribe(topico).toByteString())
                        aoMudarEstado("Conectado")
                        agendarPing(w)
                    } else aoMudarEstado("Servidor recusou a conexão")
                }
                3 -> { // PUBLISH (QoS 0)
                    val lt = ((corpo[0].toInt() and 0xFF) shl 8) or (corpo[1].toInt() and 0xFF)
                    aoReceber(String(corpo, 2 + lt, corpo.size - 2 - lt, Charsets.UTF_8))
                }
            }
            dados = dados.copyOfRange(i + tam, dados.size)
        }
        buffer.reset(); buffer.write(dados)
    }

    private fun agendarPing(w: WebSocket) {
        fila.postDelayed({ if (ligado && ws === w) { w.send(byteArrayOf(0xC0.toByte(), 0).toByteString()); agendarPing(w) } }, 30000)
    }

    private fun comTamanho(tipo: Int, corpo: ByteArray): ByteArray {
        val o = ByteArrayOutputStream()
        o.write(tipo)
        var x = corpo.size
        do { var b = x % 128; x /= 128; if (x > 0) b = b or 0x80; o.write(b) } while (x > 0)
        o.write(corpo)
        return o.toByteArray()
    }

    private fun texto(s: String): ByteArray {
        val b = s.toByteArray(Charsets.UTF_8)
        return byteArrayOf((b.size shr 8).toByte(), (b.size and 0xFF).toByte()) + b
    }

    private fun connect(id: String): ByteArray =
        comTamanho(0x10, texto("MQTT") + byteArrayOf(4, 0x02, 0, 60) + texto(id))

    private fun subscribe(t: String): ByteArray =
        comTamanho(0x82, byteArrayOf(0, 1) + texto(t) + byteArrayOf(0))
}
