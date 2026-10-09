// Passo a passo da troca de óleo: um passo por tela, com imagem e um toque para avançar.
// A imagem de cada passo é a foto cadastrada (campo "foto" do passo) ou, enquanto não houver
// foto do redutor real, o modelo 3D com as peças daquele passo em destaque.
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // troca {volume}, {oleo}, {tag}... pelos dados do equipamento
  function preencher(texto, codigo, e) {
    var dados = {
      volume: String(e.volume_ml).replace(".", ","),
      oleo: e.padrao_fabrica + " (" + e.viscosidade + ")",
      tag: e.tag_oleo ? codigo + "-" + e.tag_oleo : "",
      cor: e.cor_oleo ? e.cor_oleo.nome.toUpperCase() : "",
      epis: e.epis, pontos: e.pontos, descarte: e.descarte
    };
    return String(texto).replace(/\{(\w+)\}/g, function (m, k) { return dados[k] != null ? dados[k] : m; });
  }

  // abrir(codigo, e, aoConcluir): aoConcluir({ galao }) é chamado ao terminar o último passo
  function abrir(codigo, e, aoConcluir) {
    var passos = e.passo_troca || [];
    if (!passos.length) return;
    var antigo = document.getElementById("passo-fundo");
    if (antigo) antigo.remove();
    var f = document.createElement("div");
    f.id = "passo-fundo"; f.className = "passo-fundo";
    f.innerHTML = '<div class="passo-caixa" role="dialog" aria-label="Passo a passo da troca de óleo">' +
      '<div class="passo-topo"><span id="passo-conta"></span><button type="button" id="passo-sair">Sair ✕</button></div>' +
      '<div class="progresso"><div class="barra"><i id="passo-barra"></i></div></div>' +
      '<div class="passo-img" id="passo-img"></div>' +
      '<h2 id="passo-titulo"></h2><p id="passo-texto"></p><div id="passo-extra"></div>' +
      '<div class="nav"><button type="button" id="passo-voltar">‹ Voltar</button>' +
      '<button type="button" class="pri" id="passo-avancar"></button></div></div>';
    document.body.appendChild(f);
    document.body.classList.add("sem-rolagem");

    var i = 0, galao = null, visor = null, caixa3d = null;
    var img = f.querySelector("#passo-img");

    function fechar() {
      if (visor) visor.destruir();
      document.body.classList.remove("sem-rolagem");
      f.remove();
    }
    f.querySelector("#passo-sair").onclick = fechar;

    // modelo 3D: criado uma vez e reaproveitado em todos os passos sem foto
    function mostrar3d(pecas) {
      if (!caixa3d) {
        caixa3d = document.createElement("div");
        caixa3d.className = "visor passo-visor";
        caixa3d.innerHTML = '<div class="visor-msg">Carregando o modelo 3D…</div>';
      }
      img.innerHTML = "";
      img.appendChild(caixa3d);
      if (visor) { visor.destacar(pecas); visor.vistaInicial(true); return; }
      import("/redutor3d.js").then(function (mod) {
        if (!caixa3d.isConnected && !f.isConnected) return;
        caixa3d.innerHTML = "";
        visor = mod.criarVisualizador(caixa3d, {});
        visor.explodir(0, false);
        visor.vistaInicial(false);
        visor.destacar(passos[i].pecas || []);
      }).catch(function () {
        caixa3d.innerHTML = '<div class="visor-msg">Modelo 3D indisponível neste aparelho.</div>';
      });
    }

    function desenhar() {
      var p = passos[i];
      f.querySelector("#passo-conta").textContent = "Troca de óleo · passo " + (i + 1) + " de " + passos.length;
      f.querySelector("#passo-barra").style.width = Math.round((i + 1) / passos.length * 100) + "%";
      f.querySelector("#passo-titulo").textContent = p.titulo;
      f.querySelector("#passo-texto").textContent = preencher(p.texto, codigo, e);
      if (p.foto) {
        img.innerHTML = '<img class="foto-grande" alt="' + esc(p.titulo) + '" src="' + esc(p.foto) + '">';
      } else if (p.pecas && p.pecas.length) {
        mostrar3d(p.pecas);
      } else {
        img.innerHTML = "";
      }
      img.hidden = !img.innerHTML;

      var extra = f.querySelector("#passo-extra"), avancar = f.querySelector("#passo-avancar");
      extra.innerHTML = "";
      avancar.disabled = false;
      if (p.tipo === "galao") desenharGalao(extra, avancar);
      f.querySelector("#passo-voltar").disabled = i === 0;
      avancar.textContent = i === passos.length - 1 ? "Concluir e registrar a troca" : "Próximo ›";
      f.querySelector(".passo-caixa").scrollTop = 0;
    }

    // passo do galão: só avança com o galão certo (ou conferido pela cor, se o QR não puder ser lido)
    function desenharGalao(extra, avancar) {
      var ok = galao && (galao.certo || galao.manual);
      extra.innerHTML = (galao && galao.certo ? '<div class="parecer st-c"><b>Galão conferido: óleo certo (' + esc(galao.codigo) + ').</b></div>'
          : galao && galao.manual ? '<div class="parecer st-a"><b>Galão conferido pela cor e pelo tag, sem leitura do QR.</b></div>'
          : galao ? '<div class="parecer st-nc"><b>Galão errado (' + esc(galao.codigo) + '). Troque o galão e leia de novo.</b></div>' : '') +
        '<button type="button" class="salvar galao-ler">' + (galao ? "Ler outro galão" : "Ler QR do galão") + '</button>' +
        (ok ? '' : '<button type="button" class="link galao-manual">Não consigo ler o QR: conferi pela cor (' +
          esc(e.cor_oleo ? e.cor_oleo.nome.toLowerCase() : "") + ') e pelo tag ' + esc(codigo + "-" + e.tag_oleo) + '</button>');
      avancar.disabled = !ok;
      extra.querySelector(".galao-ler").onclick = function () {
        window.Galao.conferir(codigo, e).then(function (r) { if (r) { galao = r; desenhar(); } });
      };
      var man = extra.querySelector(".galao-manual");
      if (man) man.onclick = function () { galao = { certo: false, manual: true, codigo: e.tag_oleo }; desenhar(); };
    }

    f.querySelector("#passo-voltar").onclick = function () { if (i > 0) { i--; desenhar(); } };
    f.querySelector("#passo-avancar").onclick = function () {
      if (i < passos.length - 1) { i++; desenhar(); return; }
      fechar();
      if (aoConcluir) aoConcluir({ galao: galao });
    };
    desenhar();
  }

  window.PassoTroca = { abrir: abrir };
})();
