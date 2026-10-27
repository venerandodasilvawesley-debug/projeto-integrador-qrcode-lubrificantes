// Análise do óleo em laboratório (viscosímetro rotacional), com semáforo.
//  - /e/TOR-001: ficha própria (tela) com o resultado do ensaio do torno;
//  - ficha de lubrificação do redutor: cartão embutido (cartao), por enquanto como proposta, sem ensaio.
// A viscosidade medida (mPa·s) depende muito da temperatura; para comparar com o óleo novo, as medições
// são levadas à mesma temperatura pela curva viscosidade × temperatura do óleo (equação de Walther,
// ASTM D341, com os valores típicos da ficha técnica). A referência é o óleo novo medido no mesmo
// aparelho; sem essa medição, usa-se a própria ficha técnica.
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
  function lista(itens) { return '<ul>' + itens.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>'; }

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

  function oleoDe(e) { return e.oleo || e.analise.oleo_ref; }

  function avaliar(e, ensaio) {
    var o = oleoDe(e), c = curva(o), ref = e.analise.referencia, crit = e.analise.criterio;
    var n = ensaio.leituras.length, m = 0, t = 0;
    ensaio.leituras.forEach(function (l) { m += l[0]; t += l[1]; });
    m /= n; t /= n;
    var refT = ref ? ref.mpas * c.mu(t) / c.mu(ref.temp_c) : c.mu(t);
    var variacao = (m / refT - 1) * 100, abs = Math.abs(variacao);
    var nivel = abs > crit.critico ? "critico" : abs > crit.atencao ? "atencao" : "normal";
    return { media: m, temp: t, refT: refT, variacao: variacao, nivel: nivel,
      novo40: ref ? c.a40(ref.mpas, ref.temp_c) : o.v40, usado40: c.a40(m, t) };
  }

  var NIVEL = {
    normal: { cls: "st-c", txt: "NORMAL", chip: "Normal" },
    atencao: { cls: "st-a", txt: "ATENÇÃO", chip: "Atenção" },
    critico: { cls: "st-nc", txt: "CRÍTICO – TROCAR", chip: "Crítico" }
  };
  function sinal(v) { return (v > 0 ? "+" : "−") + fmt(Math.abs(v), 0) + " %"; }

  function analises(codigo, e) {
    var extras;
    try { extras = JSON.parse(localStorage.getItem("analises_" + codigo)) || []; } catch (err) { extras = []; }
    return (e.analise.ensaios || []).concat(extras).slice().sort(function (x, y) { return x.data < y.data ? -1 : x.data > y.data ? 1 : 0; });
  }

  // conteúdo do cartão: última análise (ou "sem análise"), histórico e formulário de nova análise
  function conteudo(codigo, e, todos, msg) {
    var a = e.analise, o = oleoDe(e), ult = todos[todos.length - 1], ref = a.referencia;
    var h = (msg ? '<div class="cartao ok">' + esc(msg) + '</div>' : '');
    if (!ult) {
      h += '<div class="rotulo">Análise do óleo em laboratório</div>' +
        '<div class="grande">Sem análise</div><span class="chip st-nv">' + esc(a.proposta ? "Proposta do projeto" : "Sem ensaio") + '</span>' +
        (a.proposta_texto ? '<p class="dica">' + esc(a.proposta_texto) + '</p>' : '') +
        (a.como ? '<div class="rotulo" style="margin-top:10px">Como fazer</div>' + lista(a.como) : '');
    } else {
      var r = avaliar(e, ult), nv = NIVEL[r.nivel];
      var fotos = (ult.fotos || []).map(function (f) {
        return '<figure><a href="' + esc(f[0]) + '" target="_blank" rel="noopener"><img src="' + esc(f[0]) + '" alt="' + esc(f[1]) +
          '" loading="lazy"></a><figcaption>' + esc(f[1]) + '</figcaption></figure>';
      }).join("");
      h += '<div class="rotulo">Última análise · ' + esc(data(ult.data)) + '</div>' +
        '<div class="grande">' + fmt(r.media) + ' mPa·s <small style="font-size:1rem">a ' + fmt(r.temp) + ' °C</small></div>' +
        '<div>' + esc(ult.amostra) + ' · <span class="chip ' + nv.cls + '">' + nv.chip + ' ' + sinal(r.variacao) + '</span></div>' +
        '<table class="resumo"><tr><td>Óleo novo na mesma temperatura' + (ref ? '' : ' (ficha técnica)') + '</td><td>' + fmt(r.refT) + ' mPa·s</td></tr>' +
        '<tr><td>Variação da viscosidade</td><td><b>' + sinal(r.variacao) + '</b></td></tr>' +
        '<tr><td>Estimativa a 40 °C (usado × novo)</td><td>' + fmt(r.usado40, 0) + ' × ' + fmt(r.novo40, 0) + ' cSt</td></tr>' +
        '<tr><td>Aspecto</td><td>' + esc(ult.aspecto || "–") + '</td></tr></table>' +
        '<details><summary>Leituras e método</summary><table>' + ult.leituras.map(function (l, i) {
          return '<tr><td>' + (i + 1) + 'ª leitura</td><td>' + fmt(l[0]) + ' mPa·s</td><td>' + fmt(l[1]) + ' °C</td></tr>';
        }).join("") + '</table>' +
        '<p class="dica">' + esc(a.laboratorio) + ' · ' + esc(a.aparelho) + '.<br>' +
        (ref ? 'Referência: ' + esc(ref.descricao) + ', ' + fmt(ref.mpas) + ' mPa·s a ' + fmt(ref.temp_c) + ' °C (' + esc(data(ref.data)) + ').<br>'
          : 'Referência: ficha técnica do óleo (' + esc(o.nome) + '). Meça também o óleo novo para uma comparação mais justa.<br>') +
        'As medições são levadas à mesma temperatura pela curva do óleo (equação de Walther, ASTM D341). ' +
        'Critério: até ' + a.criterio.atencao + ' % normal; ' + a.criterio.atencao + ' a ' + a.criterio.critico + ' % atenção; acima de ' +
        a.criterio.critico + ' % crítico.</p></details>' +
        (fotos ? '<div class="fotos-analise">' + fotos + '</div>' : '');
    }
    if (todos.length) {
      h += '<div class="rotulo" style="margin-top:12px">Histórico de análises</div><table><tr><th>Data</th><th>Média</th><th>Variação</th><th></th></tr>' +
        todos.slice().reverse().map(function (s) {
          var q = avaliar(e, s), z = NIVEL[q.nivel];
          return '<tr><td>' + esc(data(s.data)) + '</td><td>' + fmt(q.media) + ' mPa·s a ' + fmt(q.temp) + ' °C</td><td>' +
            sinal(q.variacao) + '</td><td><span class="chip ' + z.cls + '">' + z.chip + '</span></td></tr>';
        }).join("") + '</table>';
    }
    h += '<details class="nova-analise"><summary>Registrar ' + (todos.length ? 'nova análise' : 'a primeira análise') + '</summary>' +
      '<label>Data<input type="date" data-an="data"></label>' +
      '<div class="duplo"><label>Viscosidade (mPa·s)<input type="text" inputmode="decimal" data-an="mpas" maxlength="7"></label>' +
      '<label>Temperatura (°C)<input type="text" inputmode="decimal" data-an="temp" maxlength="5"></label></div>' +
      '<label>Aspecto do óleo (opcional)<input type="text" data-an="aspecto" maxlength="120"></label>' +
      '<p class="dica">' + esc(a.dica_registro || ("Mesmo aparelho, rotor e rotação: " + a.aparelho + ".")) + ' Fica salvo neste aparelho.</p>' +
      '<div data-an="msg"></div><button type="button" class="salvar" data-an="salvar">Salvar análise</button></details>';
    return h;
  }

  // liga o formulário de nova análise dentro de el; depois de salvar chama redesenhar(msg)
  function ligar(el, codigo, redesenhar) {
    function q(n) { return el.querySelector('[data-an="' + n + '"]'); }
    var hoje = new Date();
    q("data").value = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0") + "-" + String(hoje.getDate()).padStart(2, "0");
    q("salvar").onclick = function () {
      var dt = q("data").value, mp = numero(q("mpas").value), tc = numero(q("temp").value), msg = q("msg");
      if (!dt) return (msg.innerHTML = '<div class="cartao erro">Informe a data.</div>');
      if (mp == null || mp <= 0 || mp > 100000) return (msg.innerHTML = '<div class="cartao erro">Viscosidade inválida.</div>');
      if (tc == null || tc < 0 || tc > 100) return (msg.innerHTML = '<div class="cartao erro">Temperatura inválida (0 a 100 °C).</div>');
      var CH = "analises_" + codigo, extras;
      try { extras = JSON.parse(localStorage.getItem(CH)) || []; } catch (err) { extras = []; }
      extras.push({ data: dt, amostra: "Óleo do equipamento", leituras: [[mp, tc]], aspecto: q("aspecto").value.trim(),
        responsavel: localStorage.getItem("responsavel") || "" });
      try { localStorage.setItem(CH, JSON.stringify(extras)); } catch (err) {
        return (msg.innerHTML = '<div class="cartao erro">Não foi possível salvar neste aparelho.</div>');
      }
      redesenhar("Análise salva neste aparelho.");
    };
  }

  // cartão embutido na ficha de lubrificação (redutor)
  function cartao(el, codigo, e) {
    function desenhar(msg) {
      el.innerHTML = conteudo(codigo, e, analises(codigo, e), msg);
      ligar(el, codigo, desenhar);
    }
    desenhar();
  }

  // ficha própria (/e/TOR-001)
  function tela(app, codigo, e, cabecalho) {
    var a = e.analise, o = e.oleo;
    document.title = codigo + " – análise do óleo";
    function desenhar(msg) {
      var todos = analises(codigo, e), ult = todos[todos.length - 1];
      var semaforo = '';
      if (ult) {
        var r = avaliar(e, ult), nv = NIVEL[r.nivel];
        semaforo = '<div class="semaforo ' + nv.cls + '" role="status"><span class="rotulo" style="color:inherit">Situação do óleo</span>' +
          '<b>' + nv.txt + '</b>Viscosidade ' + sinal(r.variacao) + ' em relação ao óleo novo (análise de ' + esc(data(ult.data)) + ')' +
          lista(a.acoes[r.nivel]) + '</div>';
      }
      app.innerHTML = cabecalho(codigo + " · Análise do óleo", e.nome) + '<main>' + semaforo +
        '<section class="cartao alerta"><div class="rotulo">Segurança</div>' + lista(e.alertas) + '</section>' +
        '<section class="cartao"><div class="rotulo">Óleo deste equipamento</div><div class="grande">' + esc(o.viscosidade) + '</div>' +
        '<div><b>' + esc(o.nome) + '</b><br>' + esc(o.base) + '</div>' +
        '<p class="dica">Ficha técnica: ' + fmt(o.v40) + ' cSt a 40 °C · ' + fmt(o.v100) + ' cSt a 100 °C · índice de viscosidade ' + esc(o.iv) +
        '<br><small>' + esc(o.fonte) + '</small></p></section>' +
        '<section class="cartao" id="analise"></section>' +
        (a.testes ? '<section class="cartao"><div class="rotulo">Testes para confirmar a causa</div>' + lista(a.testes) + '</section>' : '') +
        '<p class="rodape"><a href="/etiqueta-' + esc(codigo) + '.html">Etiqueta com QR Code</a> · <a href="/">Todas as fichas</a></p></main>';
      var el = document.getElementById("analise");
      el.innerHTML = conteudo(codigo, e, todos, msg);
      ligar(el, codigo, function (m) { desenhar(m); window.scrollTo(0, 0); });
    }
    desenhar();
  }

  window.AnaliseOleo = { tela: tela, cartao: cartao, avaliar: avaliar };
})();
