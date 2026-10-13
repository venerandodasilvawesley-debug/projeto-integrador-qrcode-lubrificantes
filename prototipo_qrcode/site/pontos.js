// Modelo 3D na ficha de lubrificação: mostra onde ficam o enchimento, o nível e o dreno.
// Um toque no botão (ou no rótulo do modelo) vira o redutor para aquele ponto e acende o bujão.
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function preencher(texto, e) {
    var dados = { volume: String(e.volume_ml).replace(".", ","), oleo: e.padrao_fabrica + " (" + e.viscosidade + ")" };
    return String(texto).replace(/\{(\w+)\}/g, function (m, k) { return dados[k] != null ? dados[k] : m; });
  }

  function cartao(codigo, e) {
    var p = e.pontos_oleo;
    return '<section class="cartao" id="pontos">' +
      '<div class="rotulo">Enchimento, nível e dreno · modelo 3D</div>' +
      '<div class="botoes" id="pontos-botoes">' + p.pontos.map(function (x) {
        return '<button type="button" aria-pressed="false" data-tag="' + esc(x.tag) + '">' + esc(x.nome) +
          '<small>' + esc(x.sub || "") + '</small></button>';
      }).join("") + '</div>' +
      '<div class="visor" id="pontos-visor"><div class="visor-msg">Carregando o modelo 3D…</div></div>' +
      '<div class="info-peca" id="pontos-texto">Toque em Enchimento, Nível ou Dreno para ver onde fica. Arraste o modelo para girar.</div>' +
      (p.nota ? '<p class="dica" style="margin-bottom:0">' + esc(p.nota) + '</p>' : '') +
      '</section>';
  }

  function ligar(codigo, e) {
    var p = e.pontos_oleo, caixa = document.getElementById("pontos-visor");
    if (!caixa) return;
    var visor = null, atual = null;
    var botoes = [].slice.call(document.querySelectorAll("#pontos-botoes button"));
    var texto = document.getElementById("pontos-texto");

    function escolher(tag) {
      atual = tag === atual ? null : tag;
      var x = p.pontos.filter(function (q) { return q.tag === atual; })[0];
      botoes.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-tag") === atual)); });
      texto.innerHTML = x ? '<b>' + esc(x.nome) + (x.sub ? ' – ' + esc(x.sub) : '') + '</b><br>' + esc(preencher(x.texto, e)) +
          '<br><small>Tag ' + esc(codigo + "-" + x.tag) + '</small>'
        : 'Toque em Enchimento, Nível ou Dreno para ver onde fica. Arraste o modelo para girar.';
      if (!visor) return;
      visor.destacarTags(x ? [x.tag] : []);
      visor.vistaInicial(true, x ? x.vista : null);
    }
    botoes.forEach(function (b) { b.onclick = function () { escolher(b.getAttribute("data-tag")); }; });

    // o modelo 3D é pesado: só carrega quando o cartão aparece na tela
    function carregar() {
      import("/redutor3d.js").then(function (mod) {
        if (!caixa.isConnected) return;
        caixa.innerHTML = "";
        visor = mod.criarVisualizador(caixa, {
          marcas: p.pontos.map(function (x) { return { tag: x.tag, texto: x.nome }; }),
          aoMarca: escolher
        });
        visor.explodir(0, false);
        visor.baloes(false);
        var x = p.pontos.filter(function (q) { return q.tag === atual; })[0];
        visor.destacarTags(x ? [x.tag] : []);
        visor.vistaInicial(false, x ? x.vista : null);
      }).catch(function () {
        caixa.innerHTML = '<div class="visor-msg">Modelo 3D indisponível neste aparelho.</div>';
      });
    }
    if (!("IntersectionObserver" in window)) return carregar();
    var obs = new IntersectionObserver(function (itens) {
      if (!itens.some(function (i) { return i.isIntersecting; })) return;
      obs.disconnect(); carregar();
    }, { rootMargin: "300px" });
    obs.observe(caixa);
  }

  window.PontosOleo = { cartao: cartao, ligar: ligar };
})();
