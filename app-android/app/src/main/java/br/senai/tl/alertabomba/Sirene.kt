package br.senai.tl.alertabomba

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.min
import kotlin.math.sin

// Sirene no estilo do alerta de emergência (Defesa Civil): dois tons juntos, 853 Hz e 960 Hz,
// em pulsos (2 s, 1 s, 1 s, com 0,5 s de pausa). No nível de atenção, bipes curtos de 960 Hz.
// Toca no canal de ALARME, com o volume de alarme no máximo enquanto o alerta estiver na tela;
// ao parar, o volume volta ao que estava.
class Sirene(private val ctx: Context, private val critico: Boolean) {

    private val taxa = 44100
    private var faixa: AudioTrack? = null
    private var volumeAntes = -1
    private val audio = ctx.getSystemService(AudioManager::class.java)

    fun tocar() {
        try {
            volumeAntes = audio.getStreamVolume(AudioManager.STREAM_ALARM)
            audio.setStreamVolume(AudioManager.STREAM_ALARM, audio.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)
        } catch (e: Exception) { volumeAntes = -1 } // sem permissão no "Não perturbe": toca no volume atual

        // (duração ligado em s, duração desligado em s) de um ciclo, repetido sem parar
        val ciclo = if (critico) listOf(2.0 to 0.5, 1.0 to 0.5, 1.0 to 0.5) else listOf(0.25 to 0.2, 0.25 to 1.0)
        val tons = if (critico) doubleArrayOf(853.0, 960.0) else doubleArrayOf(960.0)
        val total = ciclo.sumOf { ((it.first + it.second) * taxa).toInt() }
        val pcm = ShortArray(total)
        var i = 0
        val rampa = (0.01 * taxa).toInt() // 10 ms de subida e descida, sem estalos
        for ((on, off) in ciclo) {
            val n = (on * taxa).toInt()
            for (k in 0 until n) {
                val tempo = k.toDouble() / taxa
                var s = 0.0
                for (f in tons) s += sin(2 * PI * f * tempo)
                val env = min(1.0, min(k, n - 1 - k).toDouble() / rampa)
                pcm[i++] = (s / tons.size * env * 0.95 * Short.MAX_VALUE).toInt().toShort()
            }
            i += (off * taxa).toInt()
        }
        val t = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
            .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(taxa).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setTransferMode(AudioTrack.MODE_STATIC)
            .setBufferSizeInBytes(pcm.size * 2)
            .build()
        t.write(pcm, 0, pcm.size)
        t.setLoopPoints(0, pcm.size, -1) // repete até parar
        t.play()
        faixa = t
    }

    fun parar() {
        try { faixa?.stop(); faixa?.release() } catch (e: Exception) {}
        faixa = null
        if (volumeAntes >= 0) try { audio.setStreamVolume(AudioManager.STREAM_ALARM, volumeAntes, 0) } catch (e: Exception) {}
        volumeAntes = -1
    }
}
