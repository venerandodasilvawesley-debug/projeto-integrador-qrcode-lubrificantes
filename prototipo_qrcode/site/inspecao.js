// Aba "Inspeção": modelo 3D em vista explodida + checklist de inspeção sequencial,
// com histórico guardado no próprio aparelho (tablet), como os registros de lubrificação.
(function () {
  "use strict";
  var CHAVE = "inspecoes_redutor";
  var STATUS = {
    C: { t: "Conforme", cls: "st-c" },
    A: { t: "Atenção", cls: "st-a" },
    NC: { t: "Não conforme", cls: "st-nc" },
    NV: { t: "Não verificado", cls: "st-nv" }
  };
  var PESO = { NV: 0, C: 1, A: 2, NC: 3 };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return n == null ? "" : String(n).replace(".", ","); }
  function numero(t) {
    t = String(t == null ? "" : t).trim().replace(",", ".");
    if (!t || isNaN(Number(t))) return null;
    return Number(t);
  }
  function agora() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, "0"); }
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " +
      p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function chip(s) {
    return s && STATUS[s] ? '<span class="chip ' + STATUS[s].cls + '">' + STATUS[s].t + '</span>' : "";
  }
  function pior(lista) {
    return lista.reduce(function (a, s) { return s && (!a || PESO[s] > PESO[a]) ? s : a; }, null);
  }

  function lerInspecoes() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch (e) { return []; }
  }

  function parecer(itens) {
    var st = Object.keys(itens).map(function (k) { return itens[k].status; });
    var nc = st.filter(function (s) { return s === "NC"; }).length;
    var a = st.filter(function (s) { return s === "A"; }).length;
    if (nc) return { s: "NC", t: "Não conforme – programar intervenção", nc: nc, a: a };
    if (a) return { s: "A", t: "Atenção – acompanhar na próxima inspeção", nc: nc, a: a };
    return { s: "C", t: "Conforme – equipamento em condição normal", nc: nc, a: a };
  }

  window.Inspecao = { montar: montar };

  function montar(painel, codigo, e) {
    var cfg = e.inspecao;
    var itens = cfg.checklist;
    var secoes = {};
    cfg.secoes.forEach(function (s) { secoes[s.id] = s; });
    var CHAVE_RASCUNHO = "inspecao_rascunho_" + codigo;
    var visor = null, pecasModelo = [];

    function minhas() { return lerInspecoes().filter(function (r) { return r.codigo === codigo; }); }
    function ultima() { var l = minhas(); return l.length ? l[l.length - 1] : null; }
    // Horas rodadas = horímetro de agora menos o da última inspeção que teve horímetro.
    function ultimaComHorimetro() {
      var l = minhas().filter(function (r) { return r.horimetro != null; });
      return l.length ? l[l.length - 1] : null;
    }
    function horasRodadas(h) {
      var u = ultimaComHorimetro();
      if (h == null || !u) return null;
      return Math.round((h - u.horimetro) * 10) / 10;
    }
    function lerVida() {
      try { return JSON.parse(localStorage.getItem("vida_oleo_" + codigo)); } catch (err) { return null; }
    }

    function lerRascunho() {
      try { return JSON.parse(localStorage.getItem(CHAVE_RASCUNHO)); } catch (err) { return null; }
    }
    var rascunho = lerRascunho();
    function guardarRascunho() {
      try {
        if (rascunho) localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(rascunho));
        else localStorage.removeItem(CHAVE_RASCUNHO);
      } catch (err) {}
    }

    var ficha = cfg.ficha_tecnica.map(function (l) {
      return '<dt>' + esc(l[0]) + '</dt><dd>' + esc(l[1]) + '</dd>';
    }).join("");

    painel.innerHTML =
      '<div class="insp-grade">' +
        '<section class="cartao insp-3d">' +
          '<div class="rotulo">Modelo 3D – vista explodida e em corte</div>' +
          '<div class="visor" id="i-visor"><div class="visor-msg">Carregando o modelo 3D…</div></div>' +
          '<div class="visor-ctrl">' +
            '<label class="faixa"><span>Montado</span><input type="range" id="i-explosao" min="0" max="100" value="100" aria-label="Montado ou explodido"><span>Explodido</span></label>' +
            '<div class="botoes">' +
              '<button type="button" id="i-b-explodir">Montar</button>' +
              '<button type="button" id="i-b-corte" aria-pressed="false">Por dentro</button>' +
              '<button type="button" id="i-b-girar" aria-pressed="false">Girar</button>' +
              '<button type="button" id="i-b-num" aria-pressed="true">Números</button>' +
              '<button type="button" id="i-b-vista">Vista inicial</button>' +
            '</div>' +
          '</div>' +
          '<div class="info-peca" id="i-info">Arraste para girar, use dois dedos para aproximar. Toque numa peça ou num número para ver o que inspecionar.</div>' +
          '<details class="legenda"><summary>Lista de peças</summary><div class="rolar"><table class="bom">' +
            '<thead><tr><th>Nº</th><th>Peça e tipo</th><th>Qtd.</th><th>Tags</th></tr></thead><tbody id="i-legenda"></tbody></table></div>' +
            '<p class="dica">Tag completo = código do equipamento + código da peça, ex.: <code>' + esc(codigo) + '-COR-01</code>. ' +
            'Especificações típicas para redutores deste porte. Antes de comprar reposição, ' +
            'confira o código gravado na peça ou a lista de peças do fabricante.</p></details>' +
        '</section>' +
        '<div class="insp-col">' +
          '<details class="cartao-det" open><summary>Ficha técnica – ' + esc(cfg.ficha_tecnica[2][1]) + '</summary><dl class="ficha">' + ficha + '</dl></details>' +
          '<div id="i-msg"></div>' +
          '<section class="cartao" id="i-checklist"></section>' +
          '<details class="cartao-det" id="i-hist"><summary>Histórico de inspeções</summary><div id="i-hist-corpo"></div></details>' +
        '</div>' +
      '</div>';

    var elCheck = document.getElementById("i-checklist");
    var elMsg = document.getElementById("i-msg");
    var elInfo = document.getElementById("i-info");

    function avisar(classe, texto) {
      elMsg.innerHTML = texto ? '<div class="cartao ' + classe + '">' + esc(texto) + '</div>' : "";
      if (texto) elMsg.scrollIntoView({ block: "nearest" });
    }

    // ---------------- modelo 3D ----------------
    function nomePeca(id) {
      var p = pecasModelo.filter(function (x) { return x.id === id; })[0];
      return p ? p.nome : id;
    }

    // ficha da peça: tipo, material, quantidade, especificação, função, inspeção e falhas comuns
    // "COR-01" -> "RED-001-COR-01"; "PAR-01 a PAR-04" -> "RED-001-PAR-01 a RED-001-PAR-04"
    function tagCompleto(t) { return String(t).replace(/[A-Z]{3}-\d{2}/g, function (x) { return codigo + "-" + x; }); }

    function mostrarPeca(id, tagTocado) {
      if (!id) {
        elInfo.innerHTML = "Toque numa peça ou num número para ver a ficha dela. " +
          "Use “Por dentro” para ver as peças internas.";
        return;
      }
      var i = pecasModelo.map(function (p) { return p.id; }).indexOf(id);
      var p = pecasModelo[i];
      var rel = itens.filter(function (it) { return it.pecas.indexOf(id) >= 0; });
      var isolada = visor && visor.isolada === id;
      function linha(rot, txt) { return '<dt>' + rot + '</dt><dd>' + esc(txt) + '</dd>'; }
      var unidades = visor ? visor.unidades(id) : [];
      var tags = '<ul class="tags">' + unidades.map(function (u) {
        return '<li' + (u.tag === tagTocado ? ' class="atual"' : '') + '><code>' + esc(tagCompleto(u.tag)) + '</code> ' + esc(u.local) + '</li>';
      }).join("") + '</ul>';
      elInfo.innerHTML = '<div class="peca-topo"><b>' + (i + 1) + '. ' + esc(p.nome) + '</b>' +
        (p.interna ? '<span class="chip st-nv">peça interna</span>' : '') + '</div>' +
        (tagTocado ? '<div class="tag-grande">Tag <code>' + esc(tagCompleto(tagTocado)) + '</code></div>' : '') +
        '<div class="rotulo">' + (unidades.length > 1 ? 'Tags das unidades' : 'Tag') + '</div>' + tags +
        '<dl class="peca-ficha">' +
          linha("Tipo", p.tipo) + linha("Material", p.material) + linha("Quantidade", p.qtd) +
          linha("Especificação", p.espec) + linha("Função", p.funcao) +
          linha("O que inspecionar", p.inspecao) + linha("Falhas comuns", p.falhas) +
        '</dl>' +
        (rel.length ? '<span class="rotulo">No checklist:</span> ' + rel.map(function (it) {
          return '<button type="button" class="link" data-ir="' + esc(it.id) + '">' + esc(it.titulo) + '</button>';
        }).join(", ") : "") +
        '<div class="peca-acoes"><button type="button" data-isolar="' + (isolada ? '' : esc(id)) + '">' +
          (isolada ? 'Mostrar todas as peças' : 'Ver só esta peça') + '</button>' +
          '<button type="button" class="sec" data-voltar>↑ Voltar ao modelo 3D</button></div>';
    }

    elInfo.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-voltar]")) {
        document.getElementById("i-visor").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      var iso = ev.target.closest("[data-isolar]");
      if (iso && visor) {
        var alvo = iso.getAttribute("data-isolar");
        var atual = visor.isolada;
        visor.isolar(alvo || null);
        mostrarPeca(alvo || atual);
        return;
      }
      var b = ev.target.closest("[data-ir]");
      if (!b) return;
      var idx = itens.map(function (it) { return it.id; }).indexOf(b.getAttribute("data-ir"));
      if (!rascunho) return avisar("erro", "Inicie uma inspeção para registrar este item.");
      rascunho.passo = idx + 1; guardarRascunho(); renderChecklist();
      elCheck.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    function destacarPasso() {
      if (!visor) return;
      var p = rascunho ? rascunho.passo : 0;
      var it = p >= 1 && p <= itens.length ? itens[p - 1] : null;
      if (visor.isolada) visor.isolar(null);
      visor.destacar(it ? it.pecas : []);
      mostrarPeca(null);
      if (it) elInfo.innerHTML = '<span class="rotulo">Etapa atual:</span> <b>' + esc(it.titulo) + '</b> – peças em destaque: ' +
        it.pecas.map(function (id) { return esc(nomePeca(id)); }).join(", ") + ".";
    }

    var carregou = false;
    function carregarModelo() {
      if (carregou) return;
      carregou = true;
      var caixa = document.getElementById("i-visor");
      import("/redutor3d.js").then(function (mod) {
        caixa.innerHTML = "";
        var faixa = document.getElementById("i-explosao");
        var bExp = document.getElementById("i-b-explodir");
        visor = mod.criarVisualizador(caixa, {
          // ao tocar num número ou numa peça, a tela desce até a ficha dela
          aoSelecionar: function (id, tag) {
            mostrarPeca(id, tag);
            if (id) elInfo.scrollIntoView({ behavior: "smooth", block: "start" });
          },
          aoExplodir: function (t) { faixa.value = Math.round(t * 100); }
        });
        pecasModelo = mod.PECAS;
        document.getElementById("i-legenda").innerHTML = pecasModelo.map(function (p, i) {
          return '<tr><td>' + (i + 1) + '</td><td><button type="button" class="link" data-peca="' + esc(p.id) + '">' +
            esc(p.nome) + '</button><br><small>' + esc(p.tipo) + '</small></td><td>' + esc(p.qtd) + '</td><td class="tags-col">' +
            visor.unidades(p.id).map(function (u) { return '<code>' + esc(u.tag) + '</code>'; }).join(" ") + '</td></tr>';
        }).join("");
        document.querySelector(".legenda > summary").textContent = "Lista de peças (" + pecasModelo.length + ")";
        document.getElementById("i-legenda").addEventListener("click", function (ev) {
          var b = ev.target.closest("[data-peca]");
          if (!b) return;
          visor.selecionar(b.getAttribute("data-peca"));
          mostrarPeca(b.getAttribute("data-peca"));
          caixa.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        // abre montado e se desmonta sozinho, como na figura de referência
        visor.explodir(0, false);
        setTimeout(function () { visor.explodir(1, true); }, 400);
        faixa.addEventListener("input", function () {
          visor.explodir(faixa.value / 100, false);
          bExp.textContent = faixa.value > 50 ? "Montar" : "Explodir";
        });
        bExp.onclick = function () {
          var alvo = visor.explosao > 0.5 ? 0 : 1;
          visor.explodir(alvo, true);
          visor.vistaInicial(true);
          bExp.textContent = alvo ? "Montar" : "Explodir";
        };
        var bGirar = document.getElementById("i-b-girar");
        bGirar.onclick = function () {
          var sim = bGirar.getAttribute("aria-pressed") !== "true";
          bGirar.setAttribute("aria-pressed", String(sim));
          visor.girar(sim);
        };
        var bNum = document.getElementById("i-b-num");
        bNum.onclick = function () {
          var sim = bNum.getAttribute("aria-pressed") !== "true";
          bNum.setAttribute("aria-pressed", String(sim));
          visor.baloes(sim);
        };
        var bCorte = document.getElementById("i-b-corte");
        bCorte.onclick = function () {
          var sim = bCorte.getAttribute("aria-pressed") !== "true";
          bCorte.setAttribute("aria-pressed", String(sim));
          visor.corte(sim);
          // o corte é visto com o redutor montado
          if (sim) { visor.explodir(0, true); bExp.textContent = "Explodir"; }
          visor.vistaInicial(true);
        };
        document.getElementById("i-b-vista").onclick = function () {
          if (visor.isolada) { visor.isolar(null); mostrarPeca(null); }
          visor.vistaInicial(true);
        };
        destacarPasso();
      }).catch(function () {
        caixa.innerHTML = '<div class="visor-msg">Não foi possível exibir o modelo 3D neste aparelho ' +
          '(é preciso um navegador com WebGL). O checklist continua funcionando.</div>';
      });
    }

    // ---------------- checklist ----------------
    function sugerir(it, reg, anterior) {
      var st = [];
      var m = it.medida;
      if (m && reg.valor != null) {
        if (m.faixas) {
          for (var i = 0; i < m.faixas.length; i++) {
            var f = m.faixas[i];
            if (f.ate == null || reg.valor <= f.ate) { st.push(f.status); break; }
          }
        }
        if (m.variacao && anterior && anterior.valor != null && reg.valor - anterior.valor > m.variacao.aumento)
          st.push(m.variacao.status);
      }
      if (it.opcoes && reg.opcoes) {
        it.opcoes.itens.forEach(function (o) { if (reg.opcoes.indexOf(o.t) >= 0 && o.s) st.push(o.s); });
      }
      return pior(st);
    }

    function textoAnterior(it, ant, data) {
      if (!ant) return '';
      var partes = [];
      if (ant.valor != null) partes.push('<b>' + fmt(ant.valor) + ' ' + esc(it.medida.unidade) + '</b>');
      if (ant.opcoes && ant.opcoes.length) partes.push(esc(ant.opcoes.join(", ")));
      if (ant.obs) partes.push('<i>“' + esc(ant.obs) + '”</i>');
      return '<div class="ref"><span class="rotulo">Última inspeção · ' + esc(data) + '</span><br>' +
        chip(ant.status) + ' ' + partes.join(" · ") + '</div>';
    }

    function progresso() {
      var total = itens.length + 2;
      var pontos = ['<button type="button" class="ponto' + (rascunho.passo === 0 ? ' atual' : '') +
        '" data-passo="0" title="Identificação">ID</button>'];
      itens.forEach(function (it, i) {
        var r = rascunho.itens[it.id];
        pontos.push('<button type="button" class="ponto ' + (r && r.status ? STATUS[r.status].cls : '') +
          (rascunho.passo === i + 1 ? ' atual' : '') + '" data-passo="' + (i + 1) + '" title="' +
          esc(it.titulo) + '">' + (i + 1) + '</button>');
      });
      pontos.push('<button type="button" class="ponto' + (rascunho.passo === total - 1 ? ' atual' : '') +
        '" data-passo="' + (total - 1) + '" title="Resumo">✓</button>');
      return '<div class="progresso"><div class="barra"><i style="width:' +
        Math.round(rascunho.passo / (total - 1) * 100) + '%"></i></div>' +
        '<div class="pontos">' + pontos.join("") + '</div></div>';
    }

    function renderInicio() {
      var u = ultima();
      var pend = "";
      if (u) {
        var pp = itens.filter(function (it) {
          var r = u.itens[it.id]; return r && (r.status === "NC" || r.status === "A");
        }).map(function (it) {
          var r = u.itens[it.id];
          return '<li>' + chip(r.status) + ' ' + esc(it.titulo) + (r.obs ? ' – ' + esc(r.obs) : '') + '</li>';
        }).join("");
        pend = '<p><span class="rotulo">Última inspeção</span><br>' + esc(u.data_hora) + ' · ' +
          esc(u.responsavel) + '<br>' + chip(u.parecer) + '</p>' +
          (pp ? '<p class="rotulo">Pontos a reavaliar (da última inspeção)</p><ul class="pend">' + pp + '</ul>' : '');
      } else {
        pend = '<p>Nenhuma inspeção registrada neste aparelho ainda.</p>';
      }
      var lista = itens.map(function (it) {
        return '<li>' + esc(it.titulo) + '</li>';
      }).join("");
      elCheck.innerHTML = '<h2>Checklist de inspeção</h2>' + pend +
        '<details><summary>Etapas do checklist (' + itens.length + ')</summary><ol class="etapas">' + lista + '</ol></details>' +
        '<button type="button" class="salvar" id="i-iniciar">Iniciar nova inspeção</button>';
      document.getElementById("i-iniciar").onclick = function () {
        var resp = "";
        try { resp = localStorage.getItem("responsavel") || ""; } catch (err) {}
        rascunho = { inicio: agora(), inicio_ms: Date.now(), passo: 0, responsavel: resp, horimetro: null,
          operacao: "Em operação", loto: false, itens: {}, observacao: "" };
        guardarRascunho(); avisar(); renderChecklist();
      };
    }

    function renderIdentificacao() {
      elCheck.innerHTML = progresso() +
        '<h2>Identificação da inspeção</h2>' +
        '<p>Início: ' + esc(rascunho.inicio) + '</p>' +
        '<label>Responsável<input type="text" id="i-resp" maxlength="60" autocomplete="name" value="' + esc(rascunho.responsavel) + '"></label>' +
        '<label>Horímetro do equipamento (h) – opcional<input type="text" inputmode="decimal" id="i-hor" value="' + esc(fmt(rascunho.horimetro)) + '"></label>' +
        '<div id="i-rodou"></div>' +
        '<div class="rotulo" style="margin-top:12px">Condição no início</div>' +
        '<div class="opcoes">' + ["Em operação", "Parado"].map(function (o) {
          return '<label><input type="radio" name="i-op" value="' + o + '"' + (rascunho.operacao === o ? ' checked' : '') + '><span>' + o + '</span></label>';
        }).join("") + '</div>' +
        '<p class="dica">A Parte A (ruído, vibração, temperatura e rolamentos) é feita com o redutor funcionando. ' +
        'Se ele estiver parado, marque esses itens como “Não verificado”.</p>' +
        navegacao(false, true) +
        '<button type="button" class="sap" id="i-tudo">Tudo conforme – ir direto ao resumo</button>' +
        '<p class="dica">Marca como Conforme os itens ainda sem resposta. No resumo, toque no item que estiver diferente para corrigir.</p>' +
        '<p class="rodape"><button type="button" class="link" id="i-descartar">Descartar esta inspeção</button></p>';
      var resp = document.getElementById("i-resp"), hor = document.getElementById("i-hor");
      resp.oninput = function () { rascunho.responsavel = resp.value; guardarRascunho(); };
      // calculado enquanto a pessoa digita o horímetro
      function mostrarRodou() {
        var u = ultimaComHorimetro(), h = rascunho.horimetro, d = horasRodadas(h), t;
        if (!u) {
          t = "Sem horímetro anterior neste aparelho: a contagem das horas rodadas começa nesta inspeção.";
        } else if (h == null) {
          t = "Última leitura: " + fmt(u.horimetro) + " h em " + u.data_hora.slice(0, 10) +
            ". Digite o horímetro e as horas rodadas são calculadas sozinhas.";
        } else if (d < 0) {
          t = "Horímetro menor que o da última inspeção (" + fmt(u.horimetro) + " h em " + u.data_hora.slice(0, 10) +
            "). Confira a leitura; as horas rodadas não serão contadas.";
        } else {
          var v = lerVida();
          t = "Rodou " + fmt(d) + " h desde a última inspeção (" + u.data_hora.slice(0, 10) + " · " + fmt(u.horimetro) + " h)." +
            (v && v.modo !== "estimado" && v.horas != null && d > 0 ? " Óleo: " + fmt(v.horas) + " h → " + fmt(Math.round(v.horas + d)) + " h desde a última troca." : "");
        }
        document.getElementById("i-rodou").innerHTML = '<div class="ref">' + esc(t) + '</div>';
      }
      hor.oninput = function () { rascunho.horimetro = numero(hor.value); guardarRascunho(); mostrarRodou(); };
      mostrarRodou();
      elCheck.querySelectorAll("input[name=i-op]").forEach(function (r) {
        r.onchange = function () { rascunho.operacao = r.value; guardarRascunho(); };
      });
      var validar = function () {
        if (!rascunho.responsavel.trim()) return "Informe o responsável.";
        if (hor.value.trim() && (rascunho.horimetro == null || rascunho.horimetro < 0)) return "Horímetro inválido.";
        return null;
      };
      ligarNavegacao(validar);
      document.getElementById("i-tudo").onclick = function () {
        var erro = validar();
        if (erro) return avisar("erro", erro);
        marcarPendentes();
      };
    }

    // "Tudo conforme" em um toque: só preenche o que ainda não foi respondido e leva ao resumo para conferência.
    function marcarPendentes() {
      itens.forEach(function (it) {
        var r = rascunho.itens[it.id];
        if (!r || !r.status) rascunho.itens[it.id] = { status: "C", valor: r ? r.valor : null, opcoes: r ? r.opcoes || [] : [],
          obs: r ? r.obs || "" : "", foto: r ? r.foto || null : null, manual: true };
      });
      rascunho.rapida = true;
      irPara(itens.length + 1);
    }

    function renderItem(idx) {
      var it = itens[idx];
      var sec = secoes[it.secao];
      var primeiroDaSecao = idx === 0 || itens[idx - 1].secao !== it.secao;
      var reg = rascunho.itens[it.id] || (rascunho.itens[it.id] = { status: null, valor: null, opcoes: [], obs: "", manual: false });
      var u = ultima();
      var ant = u && u.itens[it.id];
      var m = it.medida, op = it.opcoes;

      var html = progresso() +
        '<div class="secao-tag">' + esc(sec.titulo) + '</div>' +
        (primeiroDaSecao ? '<p class="dica">' + esc(sec.texto) + '</p>' : '') +
        (primeiroDaSecao && sec.loto ? '<label class="confirma"><input type="checkbox" id="i-loto"' + (rascunho.loto ? ' checked' : '') +
          '>Equipamento desligado, bloqueado e etiquetado (LOTO)</label>' : '') +
        '<h2>' + (idx + 1) + '. ' + esc(it.titulo) + '</h2>' +
        (ant ? textoAnterior(it, ant, u.data_hora) : '<div class="ref">Sem inspeção anterior neste aparelho para comparar.</div>') +
        '<div class="rotulo">O que verificar</div><ul class="verificar">' +
        it.verificar.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join("") + '</ul>' +
        '<button type="button" class="link" id="i-ver3d">Ver as peças no modelo 3D</button>';
      if (m) {
        html += '<label>' + esc(m.rotulo) + ' (' + esc(m.unidade) + ')' +
          '<input type="text" inputmode="decimal" id="i-valor" value="' + esc(fmt(reg.valor)) + '"></label>' +
          '<div class="delta" id="i-delta"></div>';
      }
      if (op) {
        html += '<div class="rotulo" style="margin-top:12px">' + esc(op.rotulo) + (op.multipla ? ' – marque todos que se aplicam' : '') + '</div>' +
          '<div class="opcoes">' + op.itens.map(function (o, k) {
            return '<label><input type="' + (op.multipla ? 'checkbox' : 'radio') + '" name="i-opc" value="' + k + '"' +
              (reg.opcoes.indexOf(o.t) >= 0 ? ' checked' : '') + '><span>' + esc(o.t) + '</span></label>';
          }).join("") + '</div>';
      }
      html += '<div class="sugestao" id="i-sug"></div>' +
        '<div class="rotulo" style="margin-top:12px">Condição encontrada</div>' +
        '<div class="status">' + ["C", "A", "NC", "NV"].map(function (s) {
          return '<label><input type="radio" name="i-st" value="' + s + '"' + (reg.status === s ? ' checked' : '') +
            '><span class="' + STATUS[s].cls + '">' + STATUS[s].t + '</span></label>';
        }).join("") + '</div>' +
        '<label>Observação – opcional<input type="text" id="i-obs" maxlength="200" value="' + esc(reg.obs) + '"></label>' +
        '<div id="i-foto"></div>' +
        navegacao(true, true);
      elCheck.innerHTML = html;

      var inValor = document.getElementById("i-valor");
      var elDelta = document.getElementById("i-delta");
      var elSug = document.getElementById("i-sug");

      function atualizarSugestao() {
        if (inValor && elDelta) {
          var t = "";
          if (reg.valor != null && ant && ant.valor != null) {
            var d = Math.round((reg.valor - ant.valor) * 100) / 100;
            t = (d > 0 ? "+" : "") + fmt(d) + " " + m.unidade + " em relação à última inspeção";
          }
          if (inValor.value.trim() && (reg.valor == null || reg.valor < m.min || reg.valor > m.max))
            t = "Valor fora da faixa esperada (" + fmt(m.min) + " a " + fmt(m.max) + " " + m.unidade + ").";
          elDelta.textContent = t;
        }
        var s = sugerir(it, reg, ant);
        elSug.innerHTML = s ? 'Sugestão pela medição/condição: ' + chip(s) + (reg.manual && reg.status !== s ? ' <small>(você escolheu outra condição)</small>' : '') : '';
        if (s && !reg.manual) {
          reg.status = s;
          var r = elCheck.querySelector('input[name=i-st][value="' + s + '"]');
          if (r) r.checked = true;
        }
        guardarRascunho();
      }

      if (inValor) inValor.oninput = function () { reg.valor = numero(inValor.value); atualizarSugestao(); };
      elCheck.querySelectorAll("input[name=i-opc]").forEach(function (c) {
        c.onchange = function () {
          reg.opcoes = [];
          elCheck.querySelectorAll("input[name=i-opc]:checked").forEach(function (x) {
            reg.opcoes.push(op.itens[Number(x.value)].t);
          });
          atualizarSugestao();
        };
      });
      elCheck.querySelectorAll("input[name=i-st]").forEach(function (r) {
        r.onchange = function () { reg.status = r.value; reg.manual = true; atualizarSugestao(); };
      });
      document.getElementById("i-obs").oninput = function () { reg.obs = this.value; guardarRascunho(); };
      if (window.Fotos) window.Fotos.campo(document.getElementById("i-foto"), reg.foto || null, function (id) {
        reg.foto = id; guardarRascunho();
      });
      var loto = document.getElementById("i-loto");
      if (loto) loto.onchange = function () { rascunho.loto = loto.checked; guardarRascunho(); };
      document.getElementById("i-ver3d").onclick = function () {
        destacarPasso();
        document.getElementById("i-visor").scrollIntoView({ behavior: "smooth", block: "center" });
      };
      atualizarSugestao();

      ligarNavegacao(function () {
        if (loto && !loto.checked) return "Confirme o bloqueio (LOTO) antes de continuar.";
        if (inValor && inValor.value.trim() && (reg.valor == null || reg.valor < m.min || reg.valor > m.max))
          return "Corrija o valor medido ou deixe em branco.";
        if (!reg.status) return "Escolha a condição encontrada (Conforme, Atenção, Não conforme ou Não verificado).";
        return null;
      });
    }

    function renderResumo() {
      var par = parecer(rascunho.itens);
      var linhas = itens.map(function (it, i) {
        var r = rascunho.itens[it.id] || {};
        var det = [];
        if (r.valor != null) det.push(fmt(r.valor) + " " + it.medida.unidade);
        if (r.opcoes && r.opcoes.length) det.push(r.opcoes.join(", "));
        if (r.obs) det.push(r.obs);
        if (r.foto) det.push("com foto");
        return '<tr><td><button type="button" class="link" data-passo="' + (i + 1) + '">' + (i + 1) + '. ' + esc(it.titulo) +
          '</button></td><td>' + (chip(r.status) || '<span class="chip st-falta">Pendente</span>') + '<br><small>' + esc(det.join(" · ")) + '</small></td></tr>';
      }).join("");
      elCheck.innerHTML = progresso() +
        '<h2>Resumo e parecer</h2>' +
        '<p>' + esc(rascunho.responsavel) + ' · início ' + esc(rascunho.inicio) +
        (rascunho.horimetro != null ? ' · ' + fmt(rascunho.horimetro) + ' h' : '') +
        (horasRodadas(rascunho.horimetro) >= 0 && horasRodadas(rascunho.horimetro) != null
          ? ' · rodou ' + fmt(horasRodadas(rascunho.horimetro)) + ' h desde a última inspeção' : '') + '</p>' +
        '<table class="resumo"><tbody>' + linhas + '</tbody></table>' +
        (itens.some(function (it) { var r = rascunho.itens[it.id]; return !r || !r.status; })
          ? '<button type="button" class="sap" id="i-tudo">Marcar os pendentes como Conforme</button>' : '') +
        '<div class="parecer ' + STATUS[par.s].cls + '"><span class="rotulo">Parecer geral</span><br><b>' + esc(par.t) + '</b>' +
          '<br><small>' + par.nc + ' não conforme(s) · ' + par.a + ' em atenção</small></div>' +
        '<label>Recomendações / observação geral – opcional<textarea id="i-obsg" maxlength="500" rows="3">' + esc(rascunho.observacao) + '</textarea></label>' +
        navegacao(true, false) +
        '<button type="button" class="salvar" id="i-salvar">Salvar inspeção</button>';
      document.getElementById("i-obsg").oninput = function () { rascunho.observacao = this.value; guardarRascunho(); };
      ligarNavegacao(null);
      var tudo = document.getElementById("i-tudo");
      if (tudo) tudo.onclick = marcarPendentes;
      document.getElementById("i-salvar").onclick = salvar;
    }

    function navegacao(voltar, avancar) {
      return '<div class="nav">' +
        (voltar ? '<button type="button" class="sec" id="i-ant">‹ Anterior</button>' : '<span></span>') +
        (avancar ? '<button type="button" class="pri" id="i-prox">Próximo ›</button>' : '<span></span>') + '</div>';
    }

    function irPara(passo) {
      rascunho.passo = passo; guardarRascunho(); avisar(); renderChecklist();
      elCheck.scrollIntoView({ block: "start" });
    }

    function ligarNavegacao(validar) {
      var ant = document.getElementById("i-ant"), prox = document.getElementById("i-prox");
      if (ant) ant.onclick = function () { irPara(rascunho.passo - 1); };
      if (prox) prox.onclick = function () {
        var erro = validar && validar();
        if (erro) return avisar("erro", erro);
        irPara(rascunho.passo + 1);
      };
      elCheck.querySelectorAll("[data-passo]").forEach(function (b) {
        b.onclick = function () { irPara(Number(b.getAttribute("data-passo"))); };
      });
      var desc = document.getElementById("i-descartar");
      if (desc) desc.onclick = function () {
        if (!confirm("Descartar a inspeção em andamento? O que foi preenchido será perdido.")) return;
        rascunho = null; guardarRascunho(); avisar(); renderChecklist();
      };
    }

    function salvar() {
      var faltam = itens.filter(function (it) { var r = rascunho.itens[it.id]; return !r || !r.status; });
      if (faltam.length) {
        avisar("erro", "Faltam itens sem condição registrada: " + faltam.map(function (it) { return it.titulo; }).join(", ") + ".");
        return;
      }
      if (!rascunho.responsavel.trim()) return avisar("erro", "Informe o responsável na etapa de identificação.");
      var par = parecer(rascunho.itens);
      var rodou = horasRodadas(rascunho.horimetro);
      if (rodou != null && rodou < 0) rodou = null;
      var reg = {
        codigo: codigo, id: Date.now(), inicio: rascunho.inicio, data_hora: agora(),
        responsavel: rascunho.responsavel.trim(), horimetro: rascunho.horimetro,
        horas_rodadas: rodou, marcacao_rapida: !!rascunho.rapida,
        duracao_s: rascunho.inicio_ms && Date.now() - rascunho.inicio_ms < 144e5
          ? Math.round((Date.now() - rascunho.inicio_ms) / 1000) : null,
        operacao: rascunho.operacao, parecer: par.s, observacao: rascunho.observacao.trim(), itens: {}
      };
      itens.forEach(function (it) {
        var r = rascunho.itens[it.id];
        reg.itens[it.id] = { status: r.status, valor: r.valor, opcoes: r.opcoes, obs: (r.obs || "").trim(), foto: r.foto || null };
      });
      var lista = lerInspecoes();
      lista.push(reg);
      try {
        localStorage.setItem(CHAVE, JSON.stringify(lista));
        localStorage.setItem("responsavel", reg.responsavel);
      } catch (err) {
        return avisar("erro", "Não foi possível salvar neste aparelho.");
      }
      // as horas rodadas entram sozinhas na vida útil do óleo (aba Lubrificação)
      var oleo = "";
      var v = lerVida();
      if (rodou > 0 && v && v.modo !== "estimado" && v.horas != null) {
        v.horas = Math.round(v.horas + rodou);
        try {
          localStorage.setItem("vida_oleo_" + codigo, JSON.stringify(v));
          window.dispatchEvent(new Event("vida-oleo"));
          oleo = " Horas do óleo atualizadas para " + fmt(v.horas) + " h.";
        } catch (err) {}
      }
      rascunho = null; guardarRascunho();
      renderChecklist(); renderHistorico();
      avisar(par.s === "C" ? "ok" : "alerta", "Inspeção salva neste aparelho. Parecer: " + par.t + "." + oleo);
    }

    function renderChecklist() {
      if (!rascunho) renderInicio();
      else if (rascunho.passo === 0) renderIdentificacao();
      else if (rascunho.passo <= itens.length) renderItem(rascunho.passo - 1);
      else renderResumo();
      destacarPasso();
    }

    // ---------------- histórico ----------------
    function renderHistorico() {
      var lista = minhas().slice().reverse();
      var corpo = document.getElementById("i-hist-corpo");
      document.querySelector("#i-hist > summary").textContent = "Histórico de inspeções (" + lista.length + ")";
      if (!lista.length) { corpo.innerHTML = '<p>Nenhuma inspeção registrada neste aparelho.</p>'; return; }

      var medidos = itens.filter(function (it) { return it.medida; });
      var evol = '<div class="rolar"><table><thead><tr><th>Data</th>' + medidos.map(function (it) {
        return '<th>' + esc(it.medida.curto || it.titulo) + '<br><small>' + esc(it.medida.unidade) + '</small></th>';
      }).join("") + '</tr></thead><tbody>' + lista.slice(0, 8).map(function (r) {
        return '<tr><td>' + esc(r.data_hora.slice(0, 10)) + '</td>' + medidos.map(function (it) {
          var x = r.itens[it.id];
          return '<td class="' + (x && x.status ? STATUS[x.status].cls + '-txt' : '') + '">' + (x && x.valor != null ? fmt(x.valor) : '–') + '</td>';
        }).join("") + '</tr>';
      }).join("") + '</tbody></table></div>';

      var itensHtml = lista.map(function (r) {
        var p = parecer(r.itens);
        var linhas = itens.map(function (it) {
          var x = r.itens[it.id] || {};
          var det = [];
          if (x.valor != null) det.push(fmt(x.valor) + " " + it.medida.unidade);
          if (x.opcoes && x.opcoes.length) det.push(x.opcoes.join(", "));
          if (x.obs) det.push(x.obs);
          return '<tr><td>' + esc(it.titulo) + '</td><td>' + chip(x.status) + '<br><small>' + esc(det.join(" · ")) + '</small>' +
            (x.foto ? ' <button type="button" class="link" data-foto="' + esc(x.foto) + '">Ver foto</button>' : '') + '</td></tr>';
        }).join("");
        return '<details class="insp"><summary>' + esc(r.data_hora) + ' · ' + esc(r.responsavel) + ' ' + chip(r.parecer) +
          '</summary><p>' + esc(r.operacao) + (r.horimetro != null ? ' · horímetro ' + fmt(r.horimetro) + ' h' : '') +
          (r.horas_rodadas != null ? ' · rodou ' + fmt(r.horas_rodadas) + ' h' : '') +
          ' · ' + p.nc + ' NC · ' + p.a + ' atenção' + (r.marcacao_rapida ? ' · marcação rápida' : '') +
          (r.duracao_s != null ? ' · duração ' + (r.duracao_s < 60 ? r.duracao_s + ' s' : Math.floor(r.duracao_s / 60) + ' min ' + (r.duracao_s % 60) + ' s') : '') + '</p>' +
          (r.parecer !== "C" && window.DocSap ? '<button type="button" class="sap" data-nota="' + r.id + '">Abrir nota de manutenção</button>' : '') +
          (r.observacao ? '<p><b>Recomendações:</b> ' + esc(r.observacao) + '</p>' : '') +
          '<table><tbody>' + linhas + '</tbody></table></details>';
      }).join("");

      corpo.innerHTML = '<p class="rotulo">Evolução das medições (últimas 8)</p>' + evol +
        '<p class="rotulo" style="margin-top:14px">Inspeções realizadas</p>' + itensHtml +
        '<p class="rodape"><button type="button" class="link" id="i-csv">Baixar inspeções deste aparelho (CSV)</button></p>';
      document.getElementById("i-csv").onclick = baixarCsv;
      corpo.querySelectorAll("[data-foto]").forEach(function (b) {
        b.onclick = function () { if (window.Fotos) window.Fotos.mostrar(b.getAttribute("data-foto")); };
      });
      // nota de manutenção (proposta de integração com SAP) com os itens que não estão conformes
      corpo.querySelectorAll("[data-nota]").forEach(function (b) {
        b.onclick = function () {
          var r = minhas().filter(function (x) { return String(x.id) === b.getAttribute("data-nota"); })[0];
          if (!r) return;
          var prob = itens.filter(function (it) { var x = r.itens[it.id]; return x && (x.status === "NC" || x.status === "A"); })
            .map(function (it) {
              var x = r.itens[it.id];
              return STATUS[x.status].t + ": " + it.titulo + (x.opcoes && x.opcoes.length ? " (" + x.opcoes.join(", ") + ")" : "") +
                (x.obs ? " – " + x.obs : "");
            }).join("; ");
          window.DocSap("Nota de manutenção", "PM", [
            ["Equipamento", codigo + " – " + e.nome],
            ["Descrição", prob],
            ["Recomendações", r.observacao],
            ["Fotos anexadas", String(itens.filter(function (it) { return r.itens[it.id] && r.itens[it.id].foto; }).length || "")],
            ["Prioridade", r.parecer === "NC" ? "Alta" : "Média"],
            ["Solicitante", r.responsavel],
            ["Data da inspeção", r.data_hora]
          ]);
        };
      });
    }

    function baixarCsv() {
      var linhas = [["codigo", "inspecao", "data_hora", "responsavel", "operacao", "horimetro_h", "horas_rodadas_h", "duracao_s", "parecer",
        "item", "condicao", "medicao", "unidade", "condicoes_marcadas", "observacao", "foto", "recomendacoes"]];
      minhas().forEach(function (r) {
        itens.forEach(function (it) {
          var x = r.itens[it.id] || {};
          linhas.push([r.codigo, r.id, r.data_hora, r.responsavel, r.operacao, fmt(r.horimetro), fmt(r.horas_rodadas), r.duracao_s,
            STATUS[r.parecer] ? STATUS[r.parecer].t : "", it.titulo, x.status ? STATUS[x.status].t : "",
            fmt(x.valor), it.medida ? it.medida.unidade : "", (x.opcoes || []).join(" | "), x.obs, x.foto ? "sim" : "", r.observacao]);
        });
      });
      var csv = "﻿" + linhas.map(function (l) {
        return l.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(";");
      }).join("\r\n");
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      a.download = "inspecoes_" + codigo + ".csv";
      a.click();
    }

    renderChecklist();
    renderHistorico();

    return { mostrar: carregarModelo };
  }
})();
