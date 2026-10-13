// Análise de óleo: mostra as últimas 3 coletas lado a lado, com a tendência de cada parâmetro.
// O mecânico só consulta: os laudos vêm do cadastro (campo "analises_oleo" do equipamento),
// lançados pelo PCM ou pelo laboratório. Nada é digitado aqui.
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) { return String(v).replace(".", ","); }
  function dataBr(iso) { var p = String(iso).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function dataCurta(iso) { var p = String(iso).split("-"); return p[2] + "/" + p[1]; }

  var NOME = { "st-c": "Normal", "st-a": "Atenção", "st-nc": "Crítico" };
  var COR = { "st-c": "VERDE", "st-a": "AMARELO", "st-nc": "VERMELHO" };
  var PESO = { "st-c": 0, "st-a": 1, "st-nc": 2 };

  // Situação de um valor pelos limites do parâmetro:
  // "max" = quanto maior, pior (água, metais); "faixa" = tem de ficar entre dois valores (viscosidade).
  function situacao(p, v) {
    if (v == null) return null;
    if (p.faixa) {
      if (v < p.faixa.critico[0] || v > p.faixa.critico[1]) return "st-nc";
      if (v < p.faixa.atencao[0] || v > p.faixa.atencao[1]) return "st-a";
      return "st-c";
    }
    return v >= p.critico ? "st-nc" : v >= p.atencao ? "st-a" : "st-c";
  }
  function limiteTexto(p) {
    var u = p.unidade ? " " + p.unidade : "";
    return p.faixa ? "normal de " + num(p.faixa.atencao[0]) + " a " + num(p.faixa.atencao[1]) + u +
        "; crítico fora de " + num(p.faixa.critico[0]) + " a " + num(p.faixa.critico[1]) + u
      : "atenção a partir de " + num(p.atencao) + u + "; crítico a partir de " + num(p.critico) + u;
  }
  function pior(a, b) { return !a ? b : !b ? a : PESO[b] > PESO[a] ? b : a; }

  // As 3 coletas mais recentes, da mais antiga para a mais nova.
  function ultimas(e) {
    var a = e.analises_oleo;
    if (!a || !a.laudos || !a.laudos.length) return [];
    return a.laudos.slice().sort(function (x, y) { return x.data < y.data ? -1 : 1; }).slice(-3);
  }
  function doLaudo(a, l) {
    return a.parametros.reduce(function (s, p) { return pior(s, situacao(p, l.valores[p.chave])); }, "st-c");
  }
  // Tendência: sobe (ou cai) em todas as coletas mostradas.
  function tendencia(p, laudos) {
    var v = laudos.map(function (l) { return l.valores[p.chave]; }).filter(function (x) { return x != null; });
    if (v.length < 2) return "";
    var sobe = true, cai = true;
    for (var i = 1; i < v.length; i++) { if (v[i] <= v[i - 1]) sobe = false; if (v[i] >= v[i - 1]) cai = false; }
    return sobe ? "sobe" : cai ? "cai" : "";
  }
  // nome no meio da frase: só a primeira letra em minúscula ("°C" continua maiúsculo)
  function minus(n) { return n.charAt(0).toLowerCase() + n.slice(1); }
  function lista(nomes) {
    return nomes.length < 2 ? nomes.join("") : nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
  }
  function proximaColeta(a, ultimo) {
    if (!a.intervalo_dias) return "";
    var d = new Date(ultimo.data + "T12:00:00");
    d.setDate(d.getDate() + a.intervalo_dias);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  // Resumo do laudo mais recente, usado pelo cartão e pelo semáforo do equipamento.
  function estado(e) {
    var a = e.analises_oleo, ls = ultimas(e);
    if (!ls.length) return null;
    var ultimo = ls[ls.length - 1], s = doLaudo(a, ultimo);
    var fora = a.parametros.filter(function (p) { return situacao(p, ultimo.valores[p.chave]) !== "st-c"; });
    var sobem = a.parametros.filter(function (p) { return tendencia(p, ls) === "sobe"; });
    var caem = a.parametros.filter(function (p) { return tendencia(p, ls) === "cai"; });
    var motivo = fora.length ? fora.map(function (p) {
      var st = situacao(p, ultimo.valores[p.chave]);
      return minus(p.nome) + (p.faixa ? " fora da faixa" : st === "st-nc" ? " acima do limite crítico" : " acima do limite de atenção");
    }).join("; ") : "todos os parâmetros dentro do limite";
    var tend = [];
    var n = ls.length === 1 ? "" : " nas " + ls.length + " coletas";
    if (sobem.length) tend.push(lista(sobem.map(function (p) { return minus(p.nome); })) + " subindo" + n);
    if (caem.length) tend.push(lista(caem.map(function (p) { return minus(p.nome); })) + " caindo" + n);
    return { s: s, txt: "Análise de óleo: " + NOME[s].toLowerCase(), motivo: motivo, tendencia: tend.join("; "),
      ultimo: ultimo, laudos: ls, proxima: proximaColeta(a, ultimo) };
  }

  function seta(p, laudos) {
    var t = tendencia(p, laudos);
    return t === "sobe" ? '<span class="an-seta" title="subindo">▲</span>'
      : t === "cai" ? '<span class="an-seta" title="caindo">▼</span>' : '<span class="an-seta an-igual" title="sem tendência">–</span>';
  }

  function cartao(codigo, e) {
    var a = e.analises_oleo, x = estado(e);
    if (!x) return "";
    var ls = x.laudos;
    var cab = '<tr><th></th>' + ls.map(function (l) { return '<th>' + esc(dataCurta(l.data)) + '</th>'; }).join("") + '<th></th></tr>';
    var linhaLaudo = '<tr><td>Laudo</td>' + ls.map(function (l) {
      var s = doLaudo(a, l);
      return '<td><span class="chip ' + s + '">' + NOME[s] + '</span></td>';
    }).join("") + '<td></td></tr>';
    var linhas = a.parametros.map(function (p) {
      return '<tr><td>' + esc(p.nome) + (p.unidade ? ' <small>(' + esc(p.unidade) + ')</small>' : '') + '</td>' +
        ls.map(function (l) {
          var v = l.valores[p.chave], s = situacao(p, v);
          return '<td class="an-v' + (s && s !== "st-c" ? " " + s + "-txt" : "") + '">' + (v == null ? "–" : esc(num(v))) + '</td>';
        }).join("") + '<td>' + seta(p, ls) + '</td></tr>';
    }).join("");
    return '<section class="cartao" id="analise">' +
      '<div class="rotulo">Análise de óleo · últimas ' + ls.length + ' coletas</div>' +
      (a.exemplo ? '<div class="an-exemplo">Demonstração com dados de exemplo</div>' : '') +
      '<div class="parecer ' + x.s + '"><b>' + COR[x.s] + ' – laudo ' + esc(NOME[x.s].toLowerCase()) + ' em ' + esc(dataBr(x.ultimo.data)) + '.</b> ' +
        esc(x.motivo.charAt(0).toUpperCase() + x.motivo.slice(1)) + '.' +
        (x.tendencia ? '<br><b>Tendência:</b> ' + esc(x.tendencia) + '.' : '') + '</div>' +
      '<div class="rolar"><table class="analise"><thead>' + cab + '</thead><tbody>' + linhaLaudo + linhas + '</tbody></table></div>' +
      (x.ultimo.recomendacao ? '<div class="rotulo" style="margin-top:12px">Recomendação do laboratório</div><div>' +
        esc(x.ultimo.recomendacao) + '</div>' : '') +
      (x.proxima ? '<div class="rotulo" style="margin-top:12px">Próxima coleta</div><div class="grande" style="font-size:1.3rem">' +
        esc(dataBr(x.proxima)) + '</div>' : '') +
      '<button type="button" class="sap" id="an-laudo">Ver laudo completo</button>' +
      (x.s !== "st-c" && window.DocSap ? '<button type="button" class="sap" id="an-nota">Abrir nota de manutenção</button>' : '') +
      (a.nota ? '<p class="dica" style="margin-bottom:0">' + esc(a.nota) + '</p>' : '') +
      '</section>';
  }

  // Laudo completo da coleta mais recente: todos os parâmetros com o limite de cada um.
  function abrirLaudo(codigo, e) {
    var a = e.analises_oleo, x = estado(e), l = x.ultimo;
    var antigo = document.getElementById("sap-fundo");
    if (antigo) antigo.remove();
    var f = document.createElement("div");
    f.id = "sap-fundo"; f.className = "sap-fundo";
    f.innerHTML = '<div class="sap-doc" role="dialog" aria-label="Laudo de análise de óleo">' +
      '<span class="sap-selo">Laudo de análise de óleo' + (a.exemplo ? ' · dados de exemplo' : '') + '</span>' +
      '<h2>' + esc(codigo) + ' · ' + esc(dataBr(l.data)) + '</h2><dl>' +
      (l.numero ? '<dt>Laudo nº</dt><dd>' + esc(l.numero) + '</dd>' : '') +
      (a.laboratorio ? '<dt>Laboratório</dt><dd>' + esc(a.laboratorio) + '</dd>' : '') +
      '<dt>Equipamento</dt><dd>' + esc(e.nome) + '</dd>' +
      '<dt>Óleo</dt><dd>' + esc(e.padrao_fabrica + " · " + e.viscosidade) + '</dd>' +
      (l.horas_oleo != null ? '<dt>Horas do óleo na coleta</dt><dd>' + esc(num(l.horas_oleo)) + ' h</dd>' : '') +
      '<dt>Resultado</dt><dd><span class="chip ' + x.s + '">' + NOME[x.s] + '</span></dd></dl>' +
      '<table class="analise"><thead><tr><th>Parâmetro</th><th>Valor</th><th>Limite</th></tr></thead><tbody>' +
      a.parametros.map(function (p) {
        var v = l.valores[p.chave], s = situacao(p, v);
        return '<tr><td>' + esc(p.nome) + (p.indica ? '<br><small>' + esc(p.indica) + '</small>' : '') + '</td>' +
          '<td class="an-v' + (s && s !== "st-c" ? " " + s + "-txt" : "") + '">' + (v == null ? "–" : esc(num(v))) +
          (p.unidade ? ' ' + esc(p.unidade) : '') + '</td><td><small>' + esc(limiteTexto(p)) + '</small></td></tr>';
      }).join("") + '</tbody></table>' +
      (l.recomendacao ? '<dl><dt>Recomendação do laboratório</dt><dd>' + esc(l.recomendacao) + '</dd></dl>' : '') +
      '<button type="button" class="salvar" id="sap-fechar">Fechar</button></div>';
    document.body.appendChild(f);
    f.addEventListener("click", function (ev) { if (ev.target === f) f.remove(); });
    document.getElementById("sap-fechar").onclick = function () { f.remove(); };
  }

  // liga os botões do cartão; solicitante() devolve o nome de quem está com a ficha aberta
  function ligar(codigo, e, solicitante) {
    var x = estado(e);
    if (!x) return;
    var bl = document.getElementById("an-laudo"), bn = document.getElementById("an-nota");
    if (bl) bl.onclick = function () { abrirLaudo(codigo, e); };
    if (bn) bn.onclick = function () {
      var d = new Date(), z = function (n) { return ("0" + n).slice(-2); };
      window.DocSap("Nota de manutenção", "PM", [
        ["Equipamento", codigo + " – " + e.nome],
        ["Descrição", "Análise de óleo " + NOME[x.s].toLowerCase() + " (" + dataBr(x.ultimo.data) + "): " + x.motivo + "."],
        ["Tendência", x.tendencia],
        ["Serviço solicitado", x.ultimo.recomendacao],
        ["Prioridade", x.s === "st-nc" ? "Alta" : "Média"],
        ["Solicitante", solicitante ? solicitante() : ""],
        ["Data", z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear() + " " + z(d.getHours()) + ":" + z(d.getMinutes())]
      ]);
    };
  }

  window.AnaliseOleo = { cartao: cartao, ligar: ligar, estado: estado, pior: pior };
})();
