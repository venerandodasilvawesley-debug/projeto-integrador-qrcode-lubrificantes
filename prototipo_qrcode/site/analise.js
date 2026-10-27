// Ficha de análise do óleo (/e/TOR-001): mostra o resultado do laboratório com semáforo.
// A viscosidade medida no viscosímetro rotacional (mPa·s) depende muito da temperatura; para comparar
// o óleo usado com o novo, as duas medições são levadas à mesma temperatura pela curva viscosidade ×
// temperatura do próprio óleo (equação de Walther, ASTM D341, com os valores típicos da ficha técnica).
// Novas análises ficam salvas neste aparelho (localStorage) e entram no histórico.
(function () {
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n, casas) { return n == null || isNaN(n) ? "–" : n.toFixed(casas == null ? 1 : casas).replace(".", ","); }
  function data(iso) { var p = String(iso).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso; }
  function numero(t) { var n = parseFloat(String(t).replace(",", ".")); return isNaN(n) ? null : n; }

  // curva viscosidade × temperatura do óleo (Walther): ν em cSt, ρ em g/cm³, μ = ν·ρ em mPa·s
  function curva(o) {
    function w(v) { return Math.log10(Math.log10(v + 0.7)); }
    function lt(t) { return Math.log10(t + 273.15); }
    var B = (w(o.v40) - w(o.v100)) / (lt(100) - lt(40)), A = w(o.v40) + B * lt(40);
    function rho(t) { return o.densidade20 - 0.00064 * (t - 20); }
    function mu(t) { return (Math.pow(10, Math.pow(10, A - B * lt(t))) - 0.7) * rho(t); }
    // viscosidade a 40 °C de uma amostra medida em outra temperatura (curva paralela à do óleo novo)
    function a40(mpas, t) {
      var a2 = w(mpas / rho(t)) + B * lt(t);
      return Math.pow(10, Math.pow(10, a2 - B * lt(40))) - 0.7;
    }
    return { mu: mu, a40: a40 };
  }

  function avaliar(e, ensaio) {
    var c = curva(e.oleo), ref = e.analise.referencia, crit = e.analise.criterio;
    var n = ensaio.leituras.length, m = 0, t = 0;
    ensaio.leituras.forEach(function (l) { m += l[0]; t += l[1]; });
    m /= n; t /= n;
    var refT = ref.mpas * c.mu(t) / c.mu(ref.temp_c);
    var variacao = (m / refT - 1) * 100, abs = Math.abs(variacao);
    var nivel = abs > crit.critico ? "critico" : abs > crit.atencao ? "atencao" : "normal";
    return { media: m, temp: t, refT: refT, variacao: variacao, nivel: nivel,
      novo40: c.a40(ref.mpas, ref.temp_c), usado40: c.a40(m, t) };
  }

  var NIVEL = {
    normal: { cls: "st-c", txt: "NORMAL", chip: "Normal" },
    atencao: { cls: "st-a", txt: "ATENÇÃO", chip: "Atenção" },
    critico: { cls: "st-nc", txt: "CRÍTICO – TROCAR", chip: "Crítico" }
  };

  function tela(app, codigo, e, cabecalho) {
    var CH = "analises_" + codigo, a = e.analise, o = e.oleo;
    document.title = codigo + " – análise do óleo";
    function extras() { try { return JSON.parse(localStorage.getItem(CH)) || []; } catch (err) { return []; } }

    function desenhar(msg) {
      var todos = a.ensaios.concat(extras()).slice().sort(function (x, y) { return x.data < y.data ? -1 : x.data > y.data ? 1 : 0; });
      var ult = todos[todos.length - 1], r = avaliar(e, ult), nv = NIVEL[r.nivel];
      var sinal = (r.variacao > 0 ? "+" : "−") + fmt(Math.abs(r.variacao), 0) + " %";
      var fotos = (ult.fotos || []).map(function (f) {
        return '<figure><a href="' + esc(f[0]) + '" target="_blank" rel="noopener"><img src="' + esc(f[0]) + '" alt="' + esc(f[1]) +
          '" loading="lazy"></a><figcaption>' + esc(f[1]) + '</figcaption></figure>';
      }).join("");
      var leituras = ult.leituras.map(function (l, i) {
        return '<tr><td>' + (i + 1) + 'ª leitura</td><td>' + fmt(l[0]) + ' mPa·s</td><td>' + fmt(l[1]) + ' °C</td></tr>';
      }).join("");
      var hist = todos.slice().reverse().map(function (s) {
        var q = avaliar(e, s), z = NIVEL[q.nivel];
        return '<tr><td>' + esc(data(s.data)) + '</td><td>' + fmt(q.media) + ' mPa·s a ' + fmt(q.temp) + ' °C</td><td>' +
          (q.variacao > 0 ? "+" : "−") + fmt(Math.abs(q.variacao), 0) + ' %</td><td><span class="chip ' + z.cls + '">' + z.chip + '</span></td></tr>';
      }).join("");

      app.innerHTML = cabecalho(codigo + " · Análise do óleo", e.nome) + '<main>' +
        (msg ? '<div class="cartao ok">' + esc(msg) + '</div>' : '') +
        '<div class="semaforo ' + nv.cls + '" role="status"><span class="rotulo" style="color:inherit">Situação do óleo</span>' +
        '<b>' + nv.txt + '</b>Viscosidade ' + sinal + ' em relação ao óleo novo (análise de ' + esc(data(ult.data)) + ')' +
        '<ul>' + a.acoes[r.nivel].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>' +

        '<section class="cartao alerta"><div class="rotulo">Segurança</div><ul>' +
        e.alertas.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></section>' +

        '<section class="cartao"><div class="rotulo">Óleo deste equipamento</div><div class="grande">' + esc(o.viscosidade) + '</div>' +
        '<div><b>' + esc(o.nome) + '</b><br>' + esc(o.base) + '</div>' +
        '<p class="dica">Ficha técnica: ' + fmt(o.v40) + ' cSt a 40 °C · ' + fmt(o.v100) + ' cSt a 100 °C · índice de viscosidade ' + esc(o.iv) +
        '<br><small>' + esc(o.fonte) + '</small></p></section>' +

        '<section class="cartao" id="analise"><div class="rotulo">Última análise · ' + esc(data(ult.data)) + '</div>' +
        '<div class="grande">' + fmt(r.media) + ' mPa·s <small style="font-size:1rem">a ' + fmt(r.temp) + ' °C</small></div>' +
        '<div>' + esc(ult.amostra) + ' · <span class="chip ' + nv.cls + '">' + nv.chip + ' ' + sinal + '</span></div>' +
        '<table class="resumo"><tr><td>Óleo novo na mesma temperatura</td><td>' + fmt(r.refT) + ' mPa·s</td></tr>' +
        '<tr><td>Variação da viscosidade</td><td><b>' + sinal + '</b></td></tr>' +
        '<tr><td>Estimativa a 40 °C (usado × novo)</td><td>' + fmt(r.usado40, 0) + ' × ' + fmt(r.novo40, 0) + ' cSt</td></tr>' +
        '<tr><td>Aspecto</td><td>' + esc(ult.aspecto || "–") + '</td></tr></table>' +
        '<details><summary>Leituras e método</summary><table>' + leituras + '</table>' +
        '<p class="dica">' + esc(a.laboratorio) + ' · ' + esc(a.aparelho) + '.<br>Referência: ' + esc(a.referencia.descricao) + ', ' +
        fmt(a.referencia.mpas) + ' mPa·s a ' + fmt(a.referencia.temp_c) + ' °C (' + esc(data(a.referencia.data)) + ').<br>' +
        'As medições foram levadas à mesma temperatura pela curva do óleo (equação de Walther, ASTM D341). ' +
        'Critério: até ' + a.criterio.atencao + ' % normal; ' + a.criterio.atencao + ' a ' + a.criterio.critico + ' % atenção; acima de ' +
        a.criterio.critico + ' % crítico.</p></details>' +
        (fotos ? '<div class="fotos-analise">' + fotos + '</div>' : '') + '</section>' +

        '<section class="cartao"><div class="rotulo">Testes para confirmar a causa</div><ul>' +
        a.testes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></section>' +

        '<section class="cartao"><div class="rotulo">Histórico de análises</div><table><tr><th>Data</th><th>Média</th><th>Variação</th><th></th></tr>' +
        hist + '</table>' +
        '<details id="nova"><summary>Registrar nova análise</summary>' +
        '<label>Data<input type="date" id="an-data"></label>' +
        '<div class="duplo"><label>Viscosidade (mPa·s)<input type="text" inputmode="decimal" id="an-mpas" maxlength="7"></label>' +
        '<label>Temperatura (°C)<input type="text" inputmode="decimal" id="an-temp" maxlength="5"></label></div>' +
        '<label>Aspecto do óleo (opcional)<input type="text" id="an-aspecto" maxlength="120"></label>' +
        '<p class="dica">Mesmo aparelho, rotor e rotação da referência (' + esc(a.aparelho) + '). Fica salvo neste aparelho.</p>' +
        '<div id="an-msg"></div><button type="button" class="salvar" id="an-salvar">Salvar análise</button></details></section>' +
        '<p class="rodape"><a href="/">Todas as fichas</a></p></main>';

      var hoje = new Date();
      document.getElementById("an-data").value = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0") + "-" + String(hoje.getDate()).padStart(2, "0");
      document.getElementById("an-salvar").onclick = function () {
        var dt = document.getElementById("an-data").value, mp = numero(document.getElementById("an-mpas").value),
          tc = numero(document.getElementById("an-temp").value), msgEl = document.getElementById("an-msg");
        if (!dt) return (msgEl.innerHTML = '<div class="cartao erro">Informe a data.</div>');
        if (mp == null || mp <= 0 || mp > 100000) return (msgEl.innerHTML = '<div class="cartao erro">Viscosidade inválida.</div>');
        if (tc == null || tc < 0 || tc > 100) return (msgEl.innerHTML = '<div class="cartao erro">Temperatura inválida (0 a 100 °C).</div>');
        var lista = extras();
        lista.push({ data: dt, amostra: "Óleo do equipamento", leituras: [[mp, tc]],
          aspecto: document.getElementById("an-aspecto").value.trim(), responsavel: localStorage.getItem("responsavel") || "" });
        try { localStorage.setItem(CH, JSON.stringify(lista)); } catch (err) {
          return (msgEl.innerHTML = '<div class="cartao erro">Não foi possível salvar neste aparelho.</div>');
        }
        desenhar("Análise salva neste aparelho.");
        window.scrollTo(0, 0);
      };
    }
    desenhar();
  }

  window.AnaliseOleo = { tela: tela, avaliar: avaliar };
})();
