// Registro no SAP PM (proposta de integração, simulação): cada registro feito na ficha gera, sem
// digitação, os documentos SAP correspondentes (confirmação de ordem, saída de material, documentos
// de medição, notas). Nesta versão os documentos ficam guardados no aparelho e são mostrados na tela;
// na proposta seriam criados direto no SAP pelas APIs dele (ex.: OData de ordens, notas e medições).
(function () {
  "use strict";
  var CHAVE = "sap_registros";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hora(ms) {
    var d = new Date(ms);
    function p(n) { return String(n).padStart(2, "0"); }
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch (e) { return []; } }

  // numeração no padrão de faixas do SAP (simulada): nota 1xxxxxxx, ordem 4xxxxxxx,
  // documento de material 49xxxxxxxx, documento de medição 7xxxxxx
  function numero(tipo, t) {
    var s = Math.floor(t / 1000);
    return { nota: 10000000 + s % 9000000, ordem: 40000000 + s % 9000000, material: 4900000000 + s % 99999999,
      medicao: 7000000 + s % 999999, confirmacao: 500000 + s % 499999 }[tipo];
  }

  // docs: [{ etapa, transacao, titulo, campos: [[rótulo, valor], ...] }]
  function registrar(codigo, origem, docs) {
    var t = Date.now(), lista = ler();
    docs.forEach(function (d) { lista.push({ codigo: codigo, origem: origem, t: t, etapa: d.etapa, transacao: d.transacao, titulo: d.titulo, campos: d.campos }); });
    if (lista.length > 300) lista = lista.slice(-300);
    try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch (e) {}
    return docs;
  }

  // cartão com os últimos documentos SAP do equipamento (de um projeto)
  function cartao(codigo, origem) {
    var lista = ler().map(function (d, i) { d.i = i; return d; })
      .filter(function (d) { return d.codigo === codigo && d.origem === origem; }).slice(-8).reverse();
    return '<section class="cartao"><div class="rotulo">Registro no SAP PM (simulação)</div>' +
      (lista.length ? '<ol class="sap-linha">' + lista.map(function (d) {
        return '<li><b>' + esc(d.etapa) + '</b><br><small>' + esc(hora(d.t)) + ' · ' + esc(d.transacao) + '</small> ' +
          '<button type="button" class="link" data-sapreg="' + d.i + '">Ver documento</button></li>';
      }).join("") + '</ol>'
        : '<p class="dica" style="margin:6px 0 0">Ao salvar um registro, os documentos SAP aparecem aqui: confirmação da ordem, ' +
          'saída de material, documentos de medição e nota, quando houver.</p>') + '</section>';
  }

  // abre o documento ao tocar em "Ver documento" (qualquer cartão SAP da página)
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-sapreg]") : null;
    if (!b || !window.DocSap) return;
    var d = ler()[Number(b.getAttribute("data-sapreg"))];
    if (d) window.DocSap(d.titulo + " (" + d.transacao + ")", "PM", d.campos);
  });

  window.SapPM = { registrar: registrar, cartao: cartao, numero: numero, hora: hora };
})();
