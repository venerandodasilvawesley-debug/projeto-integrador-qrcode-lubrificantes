// Modelo 3D na ficha de lubrificação: mostra onde ficam o enchimento, o nível e o dreno.
// Um toque no botão (ou no rótulo do modelo) vira o redutor para aquele ponto, acende os bujões
// e mostra a foto do redutor real com o ponto marcado. Em vista explodida, mostra os componentes
// numerados, com a ficha e a tag de cada um.
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
      '<div class="visor-ctrl" id="pontos-ctrl" hidden>' +
        '<label class="faixa"><span>Montado</span><input type="range" id="pontos-explosao" min="0" max="100" value="0" aria-label="Montado ou explodido"><span>Explodido</span></label>' +
        '<div class="botoes">' +
          '<button type="button" id="pontos-b-explodir">Explodir</button>' +
          '<button type="button" id="pontos-b-corte" aria-pressed="false">Por dentro</button>' +
          '<button type="button" id="pontos-b-num" aria-pressed="true">Números</button>' +
          '<button type="button" id="pontos-b-vista">Vista inicial</button>' +
        '</div>' +
      '</div>' +
      '<div class="info-peca" id="pontos-texto">' + DICA + '</div>' +
      '<details class="legenda" id="pontos-legenda" hidden><summary>Componentes e tags</summary><div class="rolar"><table class="bom">' +
        '<thead><tr><th>Nº</th><th>Componente</th><th>Qtd.</th><th>Tags</th></tr></thead><tbody></tbody></table></div>' +
        '<p class="dica">Tag completo = código do equipamento + código do componente, ex.: <code>' + esc(codigo) + '-COR-01</code>. ' +
        'Sem o manual de peças do fabricante, as peças internas seguem o arranjo usual de um redutor coroa e rosca: ' +
        'quantidades e medidas se confirmam ao desmontar.</p></details>' +
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
    var faixa = document.getElementById("pontos-explosao"), bExp = document.getElementById("pontos-b-explodir");
    var bCorte = document.getElementById("pontos-b-corte"), bNum = document.getElementById("pontos-b-num");
    var legenda = document.getElementById("pontos-legenda");

    function nomeTag(t) {
      return String(t).split(" a ").map(function (q) { return codigo + "-" + q; }).join(" a ");
    }
    // ficha do componente tocado no modelo ou na lista
    function mostrarPeca(id, tag) {
      var n = -1;
      visor.pecas.forEach(function (q, i) { if (q.id === id) n = i; });
      if (n < 0) { texto.innerHTML = visor.explosao > 0.5 ? "Toque num número ou num componente para ver o que é e a tag dele." : DICA; return; }
      var q = visor.pecas[n], un = visor.unidades(id);
      var tags = tag ? [tag] : un.map(function (u) { return u.tag; });
      var local = tag ? un.filter(function (u) { return u.tag === tag; }).map(function (u) { return u.local; })[0] : "";
      var linha = function (r, v) { return v ? '<br><span class="rotulo">' + r + ':</span> ' + esc(v) : ""; };
      texto.innerHTML = '<b>' + (n + 1) + '. ' + esc(q.nome) + '</b>' + (local ? ' – ' + esc(local) : '') +
        '<br><small>Tag ' + esc(tags.map(nomeTag).join(" · ")) + '</small>' +
        linha("Tipo", q.tipo) + linha("Material", q.material) + linha("Quantidade", q.qtd) + linha("Dados", q.espec) +
        linha("Função", q.funcao) + linha("O que olhar", q.inspecao) + linha("Falhas comuns", q.falhas);
    }
    function explodido(t) {
      faixa.value = Math.round(t * 100);
      bExp.textContent = t > 0.5 ? "Montar" : "Explodir";
      // os rótulos de enchimento, nível e dreno só aparecem com o redutor montado
      caixa.classList.toggle("explodido", t > 0.05 || bCorte.getAttribute("aria-pressed") === "true");
    }

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
      // o ponto é mostrado no redutor montado
      if (x) { visor.explodir(0, true); visor.corte(false); bCorte.setAttribute("aria-pressed", "false"); caixa.classList.remove("explodido"); }
      visor.selecionar(null);
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
          aoSelecionar: function (id, tag) {
            if (atual >= 0 && id) { atual = -1; botoes.forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); visor.destacarTags([]); fotos.innerHTML = ""; }
            mostrarPeca(id, tag);
          },
          aoExplodir: explodido,
          aoMarca: function (tag) {
            var m = marcas.filter(function (q) { return q.tag === tag; })[0];
            if (m && m.i !== atual) escolher(m.i);
          }
        });
        visor.explodir(0, false);
        visor.baloes(true);
        caixa.appendChild(caixa.querySelector(".marcas")); // rótulos por cima dos números
        document.getElementById("pontos-ctrl").hidden = false;
        legenda.hidden = false;
        legenda.querySelector("tbody").innerHTML = visor.pecas.map(function (q, i) {
          return '<tr><td>' + (i + 1) + '</td><td><button type="button" class="link" data-peca="' + esc(q.id) + '">' +
            esc(q.nome) + '</button><br><small>' + esc(q.tipo) + '</small></td><td>' + esc(q.qtd) + '</td><td class="tags-col">' +
            visor.unidades(q.id).map(function (u) { return '<code>' + esc(u.tag) + '</code>'; }).join(" ") + '</td></tr>';
        }).join("");
        legenda.querySelector("summary").textContent = "Componentes e tags (" + visor.pecas.length + ")";
        legenda.addEventListener("click", function (ev) {
          var b = ev.target.closest("[data-peca]");
          if (!b) return;
          if (atual >= 0) escolher(atual);
          if (visor.explosao < 0.5) { visor.explodir(1, true); visor.vistaInicial(true, null); }
          visor.selecionar(b.getAttribute("data-peca"));
          mostrarPeca(b.getAttribute("data-peca"));
          caixa.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        faixa.addEventListener("input", function () { visor.explodir(faixa.value / 100, false); explodido(faixa.value / 100); });
        bExp.onclick = function () {
          var alvo = visor.explosao > 0.5 ? 0 : 1;
          if (alvo && atual >= 0) escolher(atual);
          visor.explodir(alvo, true);
          visor.vistaInicial(true, null);
          if (!alvo) { visor.selecionar(null); mostrarPeca(null); }
          else texto.innerHTML = "Toque num número ou num componente para ver o que é e a tag dele.";
        };
        bNum.onclick = function () {
          var sim = bNum.getAttribute("aria-pressed") !== "true";
          bNum.setAttribute("aria-pressed", String(sim));
          visor.baloes(sim);
        };
        bCorte.onclick = function () {
          var sim = bCorte.getAttribute("aria-pressed") !== "true";
          bCorte.setAttribute("aria-pressed", String(sim));
          visor.corte(sim);
          caixa.classList.toggle("explodido", sim || visor.explosao > 0.05);
          if (sim) { if (atual >= 0) escolher(atual); visor.explodir(0, true); texto.innerHTML = "Por dentro: a coroa de bronze, a rosca sem fim, os rolamentos, os eixos e o óleo no nível certo (até o bujão do meio): a rosca fica mergulhada e a coroa molha embaixo. Toque num número para ver a ficha."; }
          visor.vistaInicial(true, null);
        };
        document.getElementById("pontos-b-vista").onclick = function () { visor.vistaInicial(true, null); };
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
