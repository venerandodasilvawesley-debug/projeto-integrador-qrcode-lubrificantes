// Monitoramento da bomba: os sensores (ou o simulador) avaliam as leituras, apontam a possível
// causa e mandam uma notificação para o celular do mecânico (serviço gratuito ntfy).
// A notificação abre a ficha do equipamento; o alerta só fecha quando o mecânico lê o QR Code
// na bomba e registra o que encontrou. O tempo de resposta (alerta -> leitura do QR) é medido sozinho.
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n, casas) { return n == null ? "" : Number(n).toFixed(casas == null ? 1 : casas).replace(".", ","); }
  function hora(ms) {
    var d = new Date(ms);
    function p(n) { return String(n).padStart(2, "0"); }
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function tempo(s) {
    s = Math.max(0, Math.round(s));
    return s < 60 ? s + " s" : s < 3600 ? Math.floor(s / 60) + " min " + (s % 60) + " s"
      : Math.floor(s / 3600) + " h " + Math.floor(s % 3600 / 60) + " min";
  }

  var NIVEL = [
    { cls: "st-c", nome: "NORMAL" },
    { cls: "st-a", nome: "ATENÇÃO" },
    { cls: "st-nc", nome: "RISCO DE CAVITAÇÃO" }
  ];

  // Leituras { v: vibração mm/s, p: pressão bar, t: temperatura °C } -> nível (0, 1, 2) e possíveis causas.
  function avaliar(e, L) {
    var s = e.sensores;
    var nv = L.v >= s.vibracao.critico ? 2 : L.v >= s.vibracao.atencao ? 1 : 0;
    var queda = (s.pressao.normal - L.p) / s.pressao.normal * 100;
    var np = queda >= s.pressao.queda_critico ? 2 : queda >= s.pressao.queda_atencao ? 1 : 0;
    var nt = L.t >= s.temperatura.critico ? 2 : L.t >= s.temperatura.atencao ? 1 : 0;
    var causas = [];
    if (nv && np) causas.push({ titulo: "Cavitação provável: a pressão caiu e a vibração subiu ao mesmo tempo.", verificar: [
      "Filtro ou crivo da sucção entupido", "Válvula da sucção parcialmente fechada",
      "Nível baixo no reservatório", "Entrada de ar na sucção (juntas e flanges)"] });
    if (nt && (nv || np)) causas.push({ titulo: "Líquido quente: a pressão de vapor sobe e a cavitação aparece mais fácil.", verificar: [
      "Temperatura do líquido no reservatório", "Bomba recirculando ou com vazão muito baixa"] });
    if (nv && !np) causas.push({ titulo: "Causa mecânica provável: a vibração subiu, mas a pressão está normal.", verificar: [
      "Desalinhamento do acoplamento motor–bomba", "Parafusos da base frouxos",
      "Rolamento do mancal com ruído ou folga", "Rotor desbalanceado ou danificado"] });
    if (np && !nv) causas.push({ titulo: "Queda de pressão sem vibração.", verificar: [
      "Entrada de ar na sucção", "Vazamento na linha de recalque",
      "Vazão acima do normal (válvula de recalque aberta demais)", "Desgaste do rotor"] });
    if (nt && !nv && !np) causas.push({ titulo: "Aquecimento sem vibração nem queda de pressão.", verificar: [
      "Bomba trabalhando com a válvula de recalque fechada", "Atrito no selo mecânico ou na gaxeta",
      "Mancal sem lubrificação"] });
    return {
      nivel: Math.max(nv, np, nt), queda: queda, causas: causas,
      sensores: { v: nv, p: np, t: nt }
    };
  }

  function linhaLeituras(L, av) {
    return "Vibração " + fmt(L.v) + " mm/s · Pressão " + fmt(L.p, 2) + " bar" +
      (av.queda > 0.5 ? " (−" + Math.round(av.queda) + " %)" : "") + " · Temperatura " + fmt(L.t, 0) + " °C";
  }

  // Manda a notificação para todos os celulares inscritos no tópico do equipamento.
  function publicar(codigo, e, L, base) {
    var av = avaliar(e, L);
    var alerta = { id: Date.now().toString(36), t: Date.now(), v: L.v, p: L.p, tc: L.t };
    var click = (base || location.origin) + "/e/" + codigo + "?alerta=" + encodeURIComponent(JSON.stringify(alerta));
    var causa = av.causas.length ? av.causas[0].titulo : "Leituras fora do normal.";
    return fetch("https://ntfy.sh/", {
      method: "POST",
      body: JSON.stringify({
        topic: e.alerta.ntfy_topico,
        title: codigo + " – " + NIVEL[av.nivel].nome,
        message: "TAG " + codigo + " · " + e.nome + "\n" + linhaLeituras(L, av) + "\nPossível causa: " + causa +
          "\nToque para abrir a ficha. Na bomba, leia o QR Code.",
        priority: av.nivel === 2 ? 5 : 4,
        tags: [av.nivel === 2 ? "rotating_light" : "warning"],
        click: click
      })
    }).then(function (r) {
      if (!r.ok) throw new Error("ntfy " + r.status);
      return { alerta: alerta, av: av, click: click };
    });
  }

  // ---------------- ficha da bomba (/e/BOMBA-001) ----------------
  function tela(app, codigo, e, cabecalho) {
    var CH_ATIVO = "alerta_ativo_" + codigo, CH_HIST = "atendimentos_" + codigo;
    function ler(ch, padrao) { try { return JSON.parse(localStorage.getItem(ch)) || padrao; } catch (err) { return padrao; } }
    function gravar(ch, v) { try { if (v == null) localStorage.removeItem(ch); else localStorage.setItem(ch, JSON.stringify(v)); } catch (err) {} }
    document.title = codigo + " – monitoramento";

    // 1) aberto pela notificação: guarda o alerta e tira os dados do endereço
    var m = /[?&]alerta=([^&]+)/.exec(location.search), veioDaNotificacao = false;
    if (m) {
      try {
        var novo = JSON.parse(decodeURIComponent(m[1]));
        var atual = ler(CH_ATIVO, null);
        if (!atual || atual.id !== novo.id) gravar(CH_ATIVO, { id: novo.id, t: novo.t, v: novo.v, p: novo.p, tc: novo.tc, recebido: Date.now(), chegada: null });
        veioDaNotificacao = true;
      } catch (err) {}
      history.replaceState(null, "", "/e/" + codigo + location.hash);
    }
    var ativo = ler(CH_ATIVO, null);
    // 2) aberto pelo QR Code com um alerta pendente: confirma a chegada no equipamento
    var chegouAgora = false;
    if (ativo && !veioDaNotificacao && !ativo.chegada) { ativo.chegada = Date.now(); gravar(CH_ATIVO, ativo); chegouAgora = true; }

    var s = e.sensores;
    function tabelaLimites() {
      return '<table><thead><tr><th>Sensor</th><th>Normal</th><th>Atenção</th><th>Crítico</th></tr></thead><tbody>' +
        '<tr><td>' + esc(s.vibracao.rotulo) + '</td><td>' + fmt(s.vibracao.normal) + ' mm/s</td><td>≥ ' + fmt(s.vibracao.atencao) + '</td><td>≥ ' + fmt(s.vibracao.critico) + '</td></tr>' +
        '<tr><td>' + esc(s.pressao.rotulo) + '</td><td>' + fmt(s.pressao.normal, 2) + ' bar</td><td>queda ≥ ' + s.pressao.queda_atencao + ' %</td><td>queda ≥ ' + s.pressao.queda_critico + ' %</td></tr>' +
        '<tr><td>' + esc(s.temperatura.rotulo) + '</td><td>' + fmt(s.temperatura.normal, 0) + ' °C</td><td>≥ ' + fmt(s.temperatura.atencao, 0) + ' °C</td><td>≥ ' + fmt(s.temperatura.critico, 0) + ' °C</td></tr>' +
        '</tbody></table><p class="dica">' + esc(e.aviso_valores) + '</p>';
    }
    function historico() {
      var h = ler(CH_HIST, []).slice(-10).reverse();
      return h.length ? '<table><thead><tr><th>Alerta</th><th>Resposta</th><th>Encontrado</th></tr></thead><tbody>' + h.map(function (r) {
        return '<tr><td>' + esc(hora(r.t)) + '<br><span class="chip ' + NIVEL[r.nivel].cls + '">' + esc(NIVEL[r.nivel].nome) + '</span></td><td>' +
          (r.resposta_s != null ? esc(tempo(r.resposta_s)) : '–') + '</td><td>' + esc(r.encontrado.join("; ") || "Nada encontrado") +
          '<br><small>' + esc(r.responsavel) + (r.observacao ? ' · ' + esc(r.observacao) : '') + '</small></td></tr>';
      }).join("") + '</tbody></table>' : '<p class="dica">Nenhum atendimento registrado neste aparelho.</p>';
    }
    function blocoInscricao() {
      var t = e.alerta.ntfy_topico;
      return '<details class="cartao-det"><summary>Receber os alertas neste celular</summary>' +
        '<ol class="etapas"><li>Instale o aplicativo <b>ntfy</b> (Play Store ou App Store).</li>' +
        '<li>No aplicativo, toque em <b>+</b> e inscreva-se no tópico abaixo (servidor padrão ntfy.sh).</li>' +
        '<li>Deixe as notificações do ntfy ligadas, com som e vibração.</li></ol>' +
        '<p class="tag-grande">Tópico <code id="topico">' + esc(t) + '</code></p>' +
        '<button type="button" class="sap" id="copiar-topico">Copiar o tópico</button>' +
        '<p class="dica">Sem o aplicativo, dá para acompanhar pelo navegador em ntfy.sh/' + esc(t) + '.</p></details>';
    }

    var corpo;
    if (ativo) {
      var L = { v: ativo.v, p: ativo.p, t: ativo.tc }, av = avaliar(e, L), n = NIVEL[av.nivel];
      var causas = av.causas.map(function (c, i) {
        return '<div class="causa"><b>' + esc(c.titulo) + '</b><div class="opcoes">' + c.verificar.map(function (v, j) {
          return '<label><input type="checkbox" data-item="' + esc(v) + '"><span>' + esc(v) + '</span></label>';
        }).join("") + '</div></div>';
      }).join("");
      var topo = '<section class="semaforo ' + n.cls + '" style="box-shadow:none;border:0"><b>' + esc(n.nome) + '</b>' +
        '<ul><li>TAG ' + esc(codigo) + ' · ' + esc(e.nome) + '</li><li>' + esc(linhaLeituras(L, av)) + '</li>' +
        '<li>Alerta às ' + esc(hora(ativo.t)) + '</li></ul></section>';
      if (!ativo.chegada) {
        corpo = topo + '<section class="cartao alerta"><div class="rotulo">Possível causa</div>' +
          av.causas.map(function (c) { return '<p style="margin:6px 0 0;font-weight:700">' + esc(c.titulo) + '</p>'; }).join("") + '</section>' +
          '<section class="cartao" style="text-align:center"><div class="grande">Vá até a bomba</div>' +
          '<p>e leia o <b>QR Code da etiqueta ' + esc(codigo) + '</b> com a câmera do celular para confirmar a chegada.</p>' +
          '<p class="dica" id="contador"></p></section>';
      } else {
        corpo = topo + (chegouAgora ? '<div class="cartao ok">Chegada confirmada pelo QR Code. Tempo de resposta: ' +
            esc(tempo((ativo.chegada - ativo.t) / 1000)) + '.</div>' : '<div class="cartao ok">Chegada confirmada às ' + esc(hora(ativo.chegada)) +
            ' (tempo de resposta ' + esc(tempo((ativo.chegada - ativo.t) / 1000)) + ').</div>') +
          '<section class="cartao alerta"><div class="rotulo">Segurança</div><ul>' + e.seguranca.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") +
          '<li>EPIs: ' + esc(e.epis) + '.</li></ul></section>' +
          '<form class="cartao" id="atendimento" novalidate><h2>Verifique e marque o que encontrou</h2>' + causas +
          '<label>Responsável<input type="text" id="m-resp" maxlength="60" autocomplete="name"></label>' +
          '<label>Observação – opcional<input type="text" id="m-obs" maxlength="200"></label>' +
          '<button type="submit" class="salvar">Encerrar o alerta</button></form>';
      }
    } else {
      corpo = '<section class="semaforo st-c" style="box-shadow:none;border:0"><b>SEM ALERTA</b><ul><li>TAG ' + esc(codigo) + ' · ' + esc(e.nome) +
        '</li><li>Nenhum alerta pendente neste aparelho.</li></ul></section>';
    }

    app.innerHTML = cabecalho(codigo, e.nome) + '<main><div id="m-msg"></div>' + corpo + blocoInscricao() +
      '<details class="cartao-det"><summary>Sensores e limites</summary>' + tabelaLimites() + '</details>' +
      '<details class="cartao-det"><summary>Atendimentos (últimos 10)</summary>' + historico() + '</details>' +
      '<p class="rodape"><a href="/etiqueta-' + esc(codigo) + '.html">Etiqueta com QR Code</a> · ' +
      '<a href="/simulador.html">Simulador da bancada</a> · <a href="/">Todas as fichas</a></p></main>';
    if (ativo) document.querySelector("#app header").className = NIVEL[avaliar(e, { v: ativo.v, p: ativo.p, t: ativo.tc }).nivel].cls;

    var cop = document.getElementById("copiar-topico");
    cop.onclick = function () {
      var t = e.alerta.ntfy_topico;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { cop.textContent = "Tópico copiado"; },
        function () { var r = document.createRange(); r.selectNodeContents(document.getElementById("topico"));
          var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); });
    };

    if (ativo && !ativo.chegada) {
      // vibra também com a ficha aberta (Android) e mostra há quanto tempo o alerta está esperando
      if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
      var c = document.getElementById("contador");
      (function tic() { if (!c.isConnected) return; c.textContent = "Alerta aguardando há " + tempo((Date.now() - ativo.t) / 1000) + "."; setTimeout(tic, 1000); })();
    }
    var form = document.getElementById("atendimento");
    if (form) {
      var resp = document.getElementById("m-resp");
      try { resp.value = localStorage.getItem("responsavel") || ""; } catch (err) {}
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (!resp.value.trim()) {
          document.getElementById("m-msg").innerHTML = '<div class="cartao erro">Informe o responsável.</div>';
          return window.scrollTo(0, 0);
        }
        var encontrado = Array.prototype.map.call(form.querySelectorAll("input[data-item]:checked"), function (x) { return x.getAttribute("data-item"); });
        var h = ler(CH_HIST, []);
        h.push({ id: ativo.id, t: ativo.t, nivel: avaliar(e, { v: ativo.v, p: ativo.p, t: ativo.tc }).nivel, v: ativo.v, p: ativo.p, tc: ativo.tc,
          chegada: ativo.chegada, resposta_s: Math.round((ativo.chegada - ativo.t) / 1000), encerrado: Date.now(),
          encontrado: encontrado, responsavel: resp.value.trim(), observacao: document.getElementById("m-obs").value.trim() });
        gravar(CH_HIST, h);
        try { localStorage.setItem("responsavel", resp.value.trim()); } catch (err) {}
        gravar(CH_ATIVO, null);
        tela(app, codigo, e, cabecalho);
        document.getElementById("m-msg").innerHTML = '<div class="cartao ok">Alerta encerrado e atendimento registrado neste aparelho.</div>';
      });
    }
  }

  window.Monitor = { avaliar: avaliar, publicar: publicar, tela: tela, NIVEL: NIVEL, linhaLeituras: linhaLeituras };
})();
