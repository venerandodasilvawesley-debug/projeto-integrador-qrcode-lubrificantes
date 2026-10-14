// Modelo 3D na ficha de lubrificação: mostra onde ficam o enchimento, o nível e o dreno.
// Um toque no botão (ou no rótulo do modelo) vira o redutor para aquele ponto, acende os bujões
// e mostra a foto do redutor real com o ponto marcado.
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var DICA = "Toque num dos botões para ver onde fica. Arraste para os lados para girar o modelo; com dois dedos, aproxima.";

  function cartao(codigo, e) {
    var p = e.pontos_oleo;
    return '<section class="cartao" id="pontos">' +
      '<div class="rotulo">' + esc(p.titulo || "Enchimento, nível e dreno · modelo 3D") + '</div>' +
      '<div class="botoes" id="pontos-botoes">' + p.pontos.map(function (x, i) {
        return '<button type="button" aria-pressed="false" data-i="' + i + '">' + esc(x.nome) +
          '<small>' + esc(x.sub || "") + '</small></button>';
      }).join("") + '</div>' +
      '<div class="visor" id="pontos-visor"><div class="visor-msg">Carregando o modelo 3D…</div></div>' +
      '<div class="info-peca" id="pontos-texto">' + DICA + '</div>' +
      '<div id="pontos-fotos"></div>' +
      (p.nota ? '<p class="dica" style="margin-bottom:0">' + esc(p.nota) + '</p>' : '') +
      '</section>';
  }

  function ligar(codigo, e) {
    var p = e.pontos_oleo, caixa = document.getElementById("pontos-visor");
    if (!caixa) return;
    var visor = null, atual = -1;
    var botoes = [].slice.call(document.querySelectorAll("#pontos-botoes button"));
    var texto = document.getElementById("pontos-texto"), fotos = document.getElementById("pontos-fotos");

    function escolher(i) {
      atual = i === atual ? -1 : i;
      var x = p.pontos[atual];
      botoes.forEach(function (b, n) { b.setAttribute("aria-pressed", String(n === atual)); });
      texto.innerHTML = x ? '<b>' + esc(x.nome) + (x.sub ? ' – ' + esc(x.sub) : '') + '</b><br>' + esc(x.texto) +
          '<br><small>Tag ' + esc(x.tags.map(function (t) { return codigo + "-" + t; }).join(" · ")) + '</small>' : DICA;
      fotos.innerHTML = x && x.fotos ? x.fotos.map(function (f) {
        return '<figure><img loading="lazy" alt="' + esc(f.legenda) + '" src="' + esc(f.src) + '"><figcaption>' + esc(f.legenda) + '</figcaption></figure>';
      }).join("") : "";
      if (!visor) return;
      // a etiqueta do QR Code não acende: o brilho atrapalharia a leitura do código
      visor.destacarTags(x && !x.sem_brilho ? x.tags : []);
      visor.vistaInicial(true, x ? x.vista : null);
    }
    botoes.forEach(function (b, n) { b.onclick = function () { escolher(n); }; });

    // o modelo 3D é pesado: só carrega quando o cartão aparece na tela
    function carregar() {
      import(p.modelo || "/redutor3d.js").then(function (mod) {
        if (!caixa.isConnected) return;
        caixa.innerHTML = "";
        var marcas = [];
        p.pontos.forEach(function (x, n) { x.tags.forEach(function (t) { marcas.push({ tag: t, texto: x.nome, i: n }); }); });
        visor = mod.criarVisualizador(caixa, {
          qr: p.qr,
          marcas: marcas,
          aoMarca: function (tag) {
            var m = marcas.filter(function (q) { return q.tag === tag; })[0];
            if (m && m.i !== atual) escolher(m.i);
          }
        });
        visor.explodir(0, false);
        visor.baloes(false);
        var x = p.pontos[atual];
        visor.destacarTags(x && !x.sem_brilho ? x.tags : []);
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
