package br.senai.tl.alertabomba

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

// Mesmas regras de site/monitor.js (função avaliar). Se mudar uma, mude a outra.

const SITE = "https://ficha-lubrificacao.vercel.app"
const CODIGO = "BOMBA-001"

data class Leitura(val v: Double, val p: Double, val t: Double)

data class Causa(val titulo: String, val verificar: List<String>)

data class Avaliacao(val nivel: Int, val queda: Double, val causas: List<Causa>, val nv: Int, val np: Int, val nt: Int)

val NOMES_NIVEL = listOf("NORMAL", "ATENÇÃO", "RISCO DE CAVITAÇÃO")

// Limites e endereços do equipamento. Os valores padrão são os do equipamentos.json;
// ao abrir, o app baixa a versão do site para ficar igual à ficha.
data class Config(
    val nome: String = "Bomba centrífuga – bancada didática",
    val vibAtencao: Double = 1.8, val vibCritico: Double = 4.5,
    val presNormal: Double = 1.5, val quedaAtencao: Double = 15.0, val quedaCritico: Double = 30.0,
    val tempAtencao: Double = 45.0, val tempCritico: Double = 55.0,
    val mqttServidor: String = "ssl://broker.hivemq.com:8883",
    val mqttTopico: String = "senai-tl/pi/BOMBA-001/leituras-d74f12ff"
) {
    companion object {
        // lê os limites da ficha publicada; sem internet, fica com os padrões
        fun baixar(): Config {
            return try {
                val c = URL("$SITE/equipamentos.json").openConnection() as HttpURLConnection
                c.connectTimeout = 8000; c.readTimeout = 8000
                val texto = c.inputStream.bufferedReader().use { it.readText() }
                val e = JSONObject(texto).getJSONObject(CODIGO)
                val s = e.getJSONObject("sensores")
                val v = s.getJSONObject("vibracao"); val p = s.getJSONObject("pressao"); val t = s.getJSONObject("temperatura")
                val mq = e.getJSONObject("alerta").optJSONObject("mqtt")
                Config(
                    nome = e.optString("nome", Config().nome),
                    vibAtencao = v.getDouble("atencao"), vibCritico = v.getDouble("critico"),
                    presNormal = p.getDouble("normal"), quedaAtencao = p.getDouble("queda_atencao"), quedaCritico = p.getDouble("queda_critico"),
                    tempAtencao = t.getDouble("atencao"), tempCritico = t.getDouble("critico"),
                    mqttTopico = mq?.optString("topico") ?: Config().mqttTopico
                )
            } catch (e: Exception) {
                Config()
            }
        }
    }
}

fun avaliar(c: Config, L: Leitura): Avaliacao {
    val nv = if (L.v >= c.vibCritico) 2 else if (L.v >= c.vibAtencao) 1 else 0
    val queda = (c.presNormal - L.p) / c.presNormal * 100
    val np = if (queda >= c.quedaCritico) 2 else if (queda >= c.quedaAtencao) 1 else 0
    val nt = if (L.t >= c.tempCritico) 2 else if (L.t >= c.tempAtencao) 1 else 0
    val causas = mutableListOf<Causa>()
    if (nv > 0 && np > 0) causas += Causa("Cavitação provável: a pressão caiu e a vibração subiu ao mesmo tempo.", listOf(
        "Filtro ou crivo da sucção entupido", "Válvula da sucção parcialmente fechada",
        "Nível baixo no reservatório", "Entrada de ar na sucção (juntas e flanges)"))
    if (nt > 0 && (nv > 0 || np > 0)) causas += Causa("Líquido quente: a pressão de vapor sobe e a cavitação aparece mais fácil.", listOf(
        "Temperatura do líquido no reservatório", "Bomba recirculando ou com vazão muito baixa"))
    if (nv > 0 && np == 0) causas += Causa("Causa mecânica provável: a vibração subiu, mas a pressão está normal.", listOf(
        "Desalinhamento do acoplamento motor–bomba", "Parafusos da base frouxos",
        "Rolamento do mancal com ruído ou folga", "Rotor desbalanceado ou danificado"))
    if (np > 0 && nv == 0) causas += Causa("Queda de pressão sem vibração.", listOf(
        "Entrada de ar na sucção", "Vazamento na linha de recalque",
        "Vazão acima do normal (válvula de recalque aberta demais)", "Desgaste do rotor"))
    if (nt > 0 && nv == 0 && np == 0) causas += Causa("Aquecimento sem vibração nem queda de pressão.", listOf(
        "Bomba trabalhando com a válvula de recalque fechada", "Atrito no selo mecânico ou na gaxeta",
        "Mancal sem lubrificação"))
    return Avaliacao(maxOf(nv, np, nt), queda, causas, nv, np, nt)
}

private fun num(x: Double, casas: Int) = String.format(Locale("pt", "BR"), "%.${casas}f", x)

fun linhaLeituras(L: Leitura, a: Avaliacao): String =
    "Vibração ${num(L.v, 1)} mm/s · Pressão ${num(L.p, 2)} bar" +
        (if (a.queda > 0.5) " (−${a.queda.toInt()} %)" else "") + " · Temperatura ${num(L.t, 0)} °C"
