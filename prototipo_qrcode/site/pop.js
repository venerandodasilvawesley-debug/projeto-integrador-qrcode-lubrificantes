// Aba "POP" (Procedimento Operacional Padrão) dentro da Inspeção.
// O texto do procedimento vem de um arquivo JSON (ex.: /pop-MEC-RED-001.json); as etapas do item 10
// podem ser marcadas pelo técnico durante a execução, e cada etapa mostra as peças no modelo 3D.
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var cache = {};
  function carregar(arquivo) {
    if (!cache[arquivo]) {
      cache[arquivo] = fetch(arquivo).then(function (r) {
        if (!r.ok) throw new Error("POP indisponível");
        return r.json();
      });
      cache[arquivo].catch(function () { delete cache[arquivo]; });
    }
    return cache[arquivo];
  }

  // Seção do item 11 (ações corretivas) pelo número, ex.: "11.1"
  function acao(pop, num) {
    var s11 = pop.secoes.filter(function (s) { return s.num === "11"; })[0];
    var sub = s11 && s11.sub.filter(function (x) { return x.num === num; })[0];
    if (!sub) return null;
    return { num: sub.num, titulo: sub.titulo, itens: sub.blocos[0].lista };
  }

  function blocos(lista, marcar, marcados, prefixo) {
    return (lista || []).map(function (b) {
      if (b.p) return '<p>' + esc(b.p) + '</p>';
      if (b.lista) return '<ul>' + b.lista.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join("") + '</ul>';
      if (b.nota) return '<p class="pop-nota"><b>Observação:</b> ' + esc(b.nota) + '</p>';
      if (b.def) return '<dl class="pop-def">' + b.def.map(function (d) {
        return '<dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd>';
      }).join("") + '</dl>';
      if (b.numerada) return '<ol class="pop-num">' + b.numerada.map(function (n) {
        var id = prefixo + n[0];
        return '<li>' + (b.marcar ? caixa(id, marcados) : '') + '<span class="pop-n">' + esc(n[0]) + '</span> ' + esc(n[1]) + '</li>';
      }).join("") + '</ol>';
      if (b.complemento) return '<div class="pop-comp"><div class="rotulo">' + esc(b.complemento.titulo) + '</div><dl class="pop-def">' +
        b.complemento.itens.map(function (d) { return '<dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd>'; }).join("") + '</dl></div>';
      if (b.aprovacao) return '<table class="pop-aprov"><thead><tr><th></th><th>Nome</th><th>Cargo</th><th>Data</th></tr></thead><tbody>' +
        b.aprovacao.map(function (a) { return '<tr><th>' + esc(a) + '</th><td></td><td></td><td>___/___/______</td></tr>'; }).join("") +
        '</tbody></table>';
      return "";
    }).join("");
  }

  function caixa(id, marcados) {
    return '<input type="checkbox" class="pop-ck" data-passo="' + esc(id) + '"' + (marcados[id] ? ' checked' : '') +
      ' aria-label="Etapa ' + esc(id) + ' concluída">';
  }

  // Quadro com os dados do equipamento que o POP genérico manda buscar no manual do fabricante.
  function aplicacao(codigo, e) {
    var linhas = [
      ["Equipamento", codigo + " – " + e.nome + " (" + e.modelo + ")"],
      ["Lubrificante", e.lubrificante + ", " + e.viscosidade + " – padrão de fábrica " + e.padrao_fabrica +
        (e.tag_oleo ? " · galão " + (e.cor_oleo ? e.cor_oleo.nome.toLowerCase() + " " : "") + "tag " + e.tag_oleo : "")],
      ["Quantidade", e.volume_ml + " mL na posição de montagem " + e.posicao + " (" + e.volumes_por_posicao + ")"],
      ["Limite de temperatura", "Carcaça até " + e.limite_carcaca_c + " °C. " + (e.aviso_temperatura || "")],
      ["Troca do óleo", e.periodicidade],
      ["Amostra de óleo", e.analise_oleo],
      ["Enchimento, dreno e nível", e.pontos],
      ["Descarte", e.descarte]
    ].filter(function (l) { return l[1]; });
    return '<div class="pop-aplic"><div class="rotulo">Aplicação no ' + esc(codigo) + ' (dados do fabricante)</div><dl class="pop-def">' +
      linhas.map(function (l) { return '<dt>' + esc(l[0]) + '</dt><dd>' + esc(l[1]) + '</dd>'; }).join("") + '</dl></div>';
  }

  /**
   * Monta o POP em `caixa`. opcoes.verPecas(ids) mostra peças no modelo 3D.
   */
  function montar(caixaEl, codigo, e, opcoes) {
    opcoes = opcoes || {};
    var CHAVE = "pop_execucao_" + codigo;
    function lerMarcados() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (err) { return {}; } }
    function gravar(m) { try { localStorage.setItem(CHAVE, JSON.stringify(m)); } catch (err) {} }

    caixaEl.innerHTML = '<div class="cartao">Carregando o POP…</div>';
    carregar(e.inspecao.pop.arquivo).then(function (pop) {
      var marcados = lerMarcados();
      var sumario = pop.secoes.map(function (s) {
        return '<li><a href="#pop-s' + esc(s.num) + '" data-ir="' + esc(s.num) + '">' + esc(s.num) + '. ' + esc(s.titulo) + '</a></li>';
      }).join("");

      var corpo = pop.secoes.map(function (s) {
        var html = blocos(s.blocos, false, marcados, "");
        if (s.num === "9") html = blocos(s.blocos, true, marcados, "");
        if (s.aplicacao) html += aplicacao(codigo, e);
        (s.sub || []).forEach(function (sub) {
          if (sub.passos) {
            html += '<div class="pop-etapa" data-etapa="' + esc(sub.num) + '"><h4>' + esc(sub.num) + ' ' + esc(sub.titulo) +
              ' <span class="pop-prog" data-prog="' + esc(sub.num) + '"></span></h4>' +
              (sub.intro ? '<p>' + esc(sub.intro) + '</p>' : '') +
              '<ol class="pop-num">' + sub.passos.map(function (p, i) {
                var id = sub.num + "." + (i + 1);
                return '<li>' + caixa(id, marcados) + '<span class="pop-n">' + (i + 1) + '.</span> ' + esc(p) + '</li>';
              }).join("") + '</ol>' +
              (sub.nota ? '<p class="pop-nota alerta-txt">' + esc(sub.nota) + '</p>' : '') +
              (sub.pecas && sub.pecas.length && opcoes.verPecas
                ? '<button type="button" class="pop-3d" data-pecas="' + esc(sub.pecas.join(",")) + '">Ver peças desta etapa no 3D</button>' : '') +
              '</div>';
          } else {
            html += '<h4>' + esc(sub.num) + ' ' + esc(sub.titulo) + '</h4>' + blocos(sub.blocos, false, marcados, "");
          }
        });
        return '<details class="pop-sec" id="pop-s' + esc(s.num) + '"' + (s.num === "10" ? ' open' : '') + '><summary>' +
          esc(s.num) + '. ' + esc(s.titulo) + '</summary><div class="pop-corpo">' + html + '</div></details>';
      }).join("");

      caixaEl.innerHTML =
        '<section class="cartao pop-cab">' +
          '<div class="rotulo">Procedimento Operacional Padrão</div>' +
          '<h2>' + esc(pop.titulo) + '</h2>' +
          '<span class="chip st-a">' + esc(pop.status) + '</span>' +
          '<table class="pop-ctrl"><tbody>' +
            '<tr><th>Código</th><td>' + esc(pop.codigo) + '</td><th>Revisão</th><td>' + esc(pop.revisao) + '</td></tr>' +
            '<tr><th>Emissão</th><td>' + esc(pop.emissao) + '</td><th>Área</th><td>' + esc(pop.area) + '</td></tr>' +
            '<tr><th>Equipamento</th><td colspan="3">' + esc(pop.equipamento) + ' – aplicado ao ' + esc(codigo) + '</td></tr>' +
            '<tr><th>Setor</th><td colspan="3">' + esc(pop.setor) + '</td></tr>' +
          '</tbody></table>' +
          '<div class="pop-exec"><div><span class="rotulo">Execução neste aparelho</span><br><b id="pop-total"></b></div>' +
            '<button type="button" class="sec" id="pop-limpar">Nova execução (limpar marcações)</button></div>' +
          '<details class="pop-sum"><summary>Sumário</summary><ol>' + sumario + '</ol></details>' +
        '</section>' +
        '<div class="cartao pop-doc">' + corpo + '</div>';

      function atualizarProgresso() {
        var todos = caixaEl.querySelectorAll(".pop-ck"), feitos = 0;
        todos.forEach(function (c) { if (c.checked) feitos++; });
        document.getElementById("pop-total").textContent = feitos + " de " + todos.length + " etapas marcadas";
        caixaEl.querySelectorAll("[data-prog]").forEach(function (el) {
          var etapa = caixaEl.querySelector('[data-etapa="' + el.getAttribute("data-prog") + '"]');
          var c = etapa.querySelectorAll(".pop-ck"), f = 0;
          c.forEach(function (x) { if (x.checked) f++; });
          el.textContent = f + "/" + c.length;
          el.className = "pop-prog" + (f === c.length ? " feito" : "");
        });
      }

      caixaEl.addEventListener("change", function (ev) {
        if (!ev.target.classList.contains("pop-ck")) return;
        var m = lerMarcados();
        if (ev.target.checked) m[ev.target.getAttribute("data-passo")] = true;
        else delete m[ev.target.getAttribute("data-passo")];
        gravar(m);
        atualizarProgresso();
      });
      caixaEl.addEventListener("click", function (ev) {
        var b3d = ev.target.closest("[data-pecas]");
        if (b3d) return opcoes.verPecas(b3d.getAttribute("data-pecas").split(","));
        var ir = ev.target.closest("[data-ir]");
        if (ir) {
          ev.preventDefault();
          var sec = document.getElementById("pop-s" + ir.getAttribute("data-ir"));
          sec.open = true;
          sec.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      document.getElementById("pop-limpar").onclick = function () {
        if (!confirm("Limpar as marcações do POP para começar uma nova execução?")) return;
        gravar({});
        caixaEl.querySelectorAll(".pop-ck").forEach(function (c) { c.checked = false; });
        atualizarProgresso();
      };
      atualizarProgresso();
    }).catch(function () {
      caixaEl.innerHTML = '<div class="cartao erro">Não foi possível abrir o POP. Abra esta página uma vez com internet ' +
        'para que ele fique salvo no aparelho.</div>';
    });
  }

  window.Pop = { montar: montar, carregar: carregar, acao: acao };
})();
