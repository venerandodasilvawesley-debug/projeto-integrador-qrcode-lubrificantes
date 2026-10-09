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

  // ---------------- leituras ao vivo (MQTT) ----------------
  // Os sensores (ESP32 na bancada, ou o simulador) publicam { v, p, t, ts } a cada segundo num tópico MQTT;
  // a ficha assina o tópico e desenha o gráfico. MQTT é o protocolo padrão de sensores na indústria (IoT).
  var mqttLib = null;
  function carregarMqtt() {
    if (window.mqtt) return Promise.resolve(window.mqtt);
    return mqttLib || (mqttLib = new Promise(function (ok, erro) {
      var sc = document.createElement("script");
      sc.src = "/vendor/mqtt.min.js";
      sc.onload = function () { ok(window.mqtt); };
      sc.onerror = function () { mqttLib = null; erro(new Error("mqtt")); };
      document.head.appendChild(sc);
    }));
  }
  var JANELA_MS = 60000;
  var canal = null; // uma conexão por página, reaproveitada quando a ficha é redesenhada
  function conectar(e) {
    if (canal) return canal;
    var ouvintes = [], cfg = e.alerta.mqtt;
    canal = { dados: [], estado: "conectando", ouvir: function (f) { ouvintes.push(f); }, publicar: function () {} };
    function avisar() { ouvintes.forEach(function (f) { f(canal); }); }
    carregarMqtt().then(function (mqtt) {
      var cli = mqtt.connect(cfg.url, { clientId: "ficha-" + Math.random().toString(16).slice(2, 10), reconnectPeriod: 3000, connectTimeout: 8000 });
      canal.publicar = function (L) { if (cli.connected) cli.publish(cfg.topico, JSON.stringify(L)); };
      cli.on("connect", function () { canal.estado = "conectado"; cli.subscribe(cfg.topico); avisar(); });
      cli.on("offline", function () { canal.estado = "sem internet"; avisar(); });
      cli.on("reconnect", function () { canal.estado = "conectando"; avisar(); });
      cli.on("message", function (t, msg) {
        try {
          var L = JSON.parse(msg.toString());
          if (typeof L.v !== "number" || typeof L.p !== "number" || typeof L.t !== "number") return;
          L.ts = Date.now();
          canal.dados.push(L);
          while (canal.dados.length && canal.dados[0].ts < Date.now() - JANELA_MS) canal.dados.shift();
          avisar();
        } catch (err) {}
      });
    }, function () { canal.estado = "leitor indisponível"; avisar(); });
    return canal;
  }

  // Gráfico em tempo real: um por sensor, últimos 60 s, com as faixas normal / atenção / crítico ao fundo.
  var CAMPOS = [["v", "vibracao", 1], ["p", "pressao", 2], ["t", "temperatura", 0]];
  function faixas(e, k) {
    var s = e.sensores;
    if (k === "p") return { baixo: true, a: s.pressao.normal * (1 - s.pressao.queda_atencao / 100), c: s.pressao.normal * (1 - s.pressao.queda_critico / 100) };
    var x = k === "v" ? s.vibracao : s.temperatura;
    return { baixo: false, a: x.atencao, c: x.critico };
  }
  function grafico(caixa, e, dadosDe) {
    caixa.innerHTML = CAMPOS.map(function (c) {
      var x = e.sensores[c[1]];
      return '<div class="graf"><div class="graf-topo"><b>' + esc(x.rotulo) + '</b><span><output id="g-' + c[0] + '">–</output> ' + esc(x.unidade) +
        ' <span class="chip" id="gc-' + c[0] + '"></span></span></div><canvas id="gv-' + c[0] + '" height="110" aria-label="Gráfico de ' + esc(x.rotulo) + ' nos últimos 60 segundos"></canvas></div>';
    }).join("") + '<div class="graf-eixo"><span>−60 s</span><span>−30 s</span><span>agora</span></div>';
    var CORES = { ok: "#d9f2e1", a: "#fff1c2", c: "#fbd5d5", linha: "#14202b", grade: "#c3ccd5", txt: "#3d4c5a" };
    function desenhar() {
      if (!caixa.isConnected) return;
      var dados = dadosDe(), agora = Date.now(), ult = dados[dados.length - 1];
      var av = ult ? avaliar(e, ult) : null;
      CAMPOS.forEach(function (c) {
        var k = c[0], x = e.sensores[c[1]], cv = document.getElementById("gv-" + k);
        var dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = 110;
        if (!w) return;
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
        var y0 = x.grafico[0], y1 = x.grafico[1], f = faixas(e, k);
        function Y(v) { return h - 4 - (Math.max(y0, Math.min(y1, v)) - y0) / (y1 - y0) * (h - 8); }
        function X(ts) { return (ts - (agora - JANELA_MS)) / JANELA_MS * w; }
        // faixas de fundo (gestão visual)
        var zonas = f.baixo ? [[y0, f.c, CORES.c], [f.c, f.a, CORES.a], [f.a, y1, CORES.ok]] : [[y0, f.a, CORES.ok], [f.a, f.c, CORES.a], [f.c, y1, CORES.c]];
        zonas.forEach(function (z) { g.fillStyle = z[2]; g.fillRect(0, Y(z[1]), w, Y(z[0]) - Y(z[1])); });
        g.strokeStyle = CORES.grade; g.lineWidth = 1; g.setLineDash([4, 4]);
        [f.a, f.c].forEach(function (v) { g.beginPath(); g.moveTo(0, Y(v)); g.lineTo(w, Y(v)); g.stroke(); });
        g.setLineDash([]);
        g.fillStyle = CORES.txt; g.font = "11px system-ui,sans-serif";
        g.fillText("atenção " + fmt(f.a, c[2]), 4, Y(f.a) - 3); g.fillText("crítico " + fmt(f.c, c[2]), 4, Y(f.c) + (f.baixo ? 12 : -3));
        // linha das leituras
        var pts = dados.filter(function (d) { return d.ts >= agora - JANELA_MS; });
        if (pts.length) {
          g.strokeStyle = CORES.linha; g.lineWidth = 2; g.lineJoin = "round"; g.beginPath();
          pts.forEach(function (d, i) { if (i) g.lineTo(X(d.ts), Y(d[k])); else g.moveTo(X(d.ts), Y(d[k])); });
          g.stroke();
          var u = pts[pts.length - 1], n = av ? av.sensores[k] : 0;
          g.fillStyle = ["#1c8a45", "#e0a100", "#c22525"][n]; g.beginPath(); g.arc(X(u.ts), Y(u[k]), 5, 0, 7); g.fill();
        }
        document.getElementById("g-" + k).textContent = ult ? fmt(ult[k], c[2]) : "–";
        var ch = document.getElementById("gc-" + k);
        ch.className = "chip" + (av ? " " + NIVEL[av.sensores[k]].cls : "");
        ch.textContent = av ? ["normal", "atenção", "crítico"][av.sensores[k]] : "";
      });
    }
    var vivo = true;
    (function tic() { if (!vivo || !caixa.isConnected) return; desenhar(); setTimeout(tic, 1000); })();
    return { desenhar: desenhar, parar: function () { vivo = false; } };
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

    var aoVivo = e.alerta.mqtt ? '<section class="cartao"><div class="rotulo">Sensores ao vivo</div>' +
      '<p class="dica" id="g-estado" role="status" style="margin:4px 0 0"></p><div id="graf"></div></section>' : '';
    app.innerHTML = cabecalho(codigo, e.nome) + '<main><div id="m-msg"></div>' + corpo + aoVivo + blocoInscricao() +
      '<details class="cartao-det"><summary>Sensores e limites</summary>' + tabelaLimites() + '</details>' +
      '<details class="cartao-det"><summary>Atendimentos (últimos 10)</summary>' + historico() + '</details>' +
      '<p class="rodape"><a href="/etiqueta-' + esc(codigo) + '.html">Etiqueta com QR Code</a> · ' +
      '<a href="/simulador.html">Simulador da bancada</a> · <a href="/">Todas as fichas</a></p></main>';
    if (ativo) document.querySelector("#app header").className = NIVEL[avaliar(e, { v: ativo.v, p: ativo.p, t: ativo.tc }).nivel].cls;

    if (e.alerta.mqtt) {
      var cn = conectar(e), gr = grafico(document.getElementById("graf"), e, function () { return cn.dados; });
      var estadoEl = document.getElementById("g-estado");
      var mostrarEstado = function () {
        if (!estadoEl.isConnected) return;
        var u = cn.dados[cn.dados.length - 1], idade = u ? (Date.now() - u.ts) / 1000 : null;
        estadoEl.innerHTML = cn.estado !== "conectado" ? esc(cn.estado === "conectando" ? "Conectando aos sensores…" : "Sem conexão: " + cn.estado + ".")
          : idade != null && idade < 5 ? '<b class="st-c-txt">● Ao vivo</b> · leitura a cada segundo'
          : u ? "Sem leitura há " + esc(tempo(idade)) + ". Confira se a bancada (ou o simulador) está ligada."
          : "Conectado. Aguardando os sensores: ligue a bancada ou abra o simulador.";
      };
      cn.ouvir(function () { gr.desenhar(); mostrarEstado(); });
      (function tic() { if (!estadoEl.isConnected) return; mostrarEstado(); setTimeout(tic, 1000); })();
    }

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

  window.Monitor = { avaliar: avaliar, publicar: publicar, tela: tela, NIVEL: NIVEL, linhaLeituras: linhaLeituras,
    conectar: conectar, grafico: grafico };
})();
