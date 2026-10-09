// Conferir o óleo certo (poka-yoke): o mecânico lê o QR Code do galão e a ficha diz na hora
// se é o óleo deste equipamento. Evita misturar óleos de bases diferentes.
// O QR do galão leva o endereço /g/OLE-01; lido pela câmera comum, abre a página do óleo.
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var oleos = null;
  function carregar() {
    return oleos || (oleos = fetch("/oleos.json").then(function (r) { return r.json(); })
      .catch(function () { oleos = null; return {}; }));
  }

  // "https://…/g/OLE-01", "OLE-01" ou "RED-001-OLE-01" -> "OLE-01"
  function codigoDe(texto) {
    var m = /OLE-\d{2}/i.exec(String(texto || ""));
    return m ? m[0].toUpperCase() : null;
  }

  // Leitor de QR: usa o leitor do próprio navegador (Chrome no Android) e,
  // se não houver, a biblioteca jsQR (iPhone e outros), carregada só quando precisa.
  var jsqr = null;
  function carregarJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    return jsqr || (jsqr = new Promise(function (ok, erro) {
      var s = document.createElement("script");
      s.src = "/vendor/jsQR.js";
      s.onload = function () { ok(window.jsQR); };
      s.onerror = function () { jsqr = null; erro(new Error("jsQR")); };
      document.head.appendChild(s);
    }));
  }
  function criarLeitor() {
    if ("BarcodeDetector" in window) {
      try {
        var det = new window.BarcodeDetector({ formats: ["qr_code"] });
        return Promise.resolve(function (fonte) {
          return det.detect(fonte).then(function (r) { return r.length ? r[0].rawValue : null; });
        });
      } catch (e) { /* segue para o jsQR */ }
    }
    return carregarJsQR().then(function (ler) {
      var c = document.createElement("canvas"), ctx = c.getContext("2d", { willReadFrequently: true });
      return function (fonte) {
        var w = fonte.videoWidth || fonte.naturalWidth || fonte.width, h = fonte.videoHeight || fonte.naturalHeight || fonte.height;
        if (!w || !h) return Promise.resolve(null);
        var k = Math.min(1, 800 / Math.max(w, h));
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        ctx.drawImage(fonte, 0, 0, c.width, c.height);
        var r = ler(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        return Promise.resolve(r ? r.data : null);
      };
    });
  }

  // Abre a câmera, lê o QR do galão e mostra o resultado em tela cheia.
  // Devolve uma Promise com { certo, codigo, oleo } ou null se o mecânico fechar sem ler.
  function conferir(codigoEquip, e) {
    return new Promise(function (resolver) {
      var antigo = document.getElementById("galao-fundo");
      if (antigo) antigo.remove();
      var f = document.createElement("div");
      f.id = "galao-fundo"; f.className = "galao-fundo";
      f.innerHTML = '<div class="galao-caixa" role="dialog" aria-label="Conferir o galão de óleo">' +
        '<div id="galao-corpo"></div></div>';
      document.body.appendChild(f);
      var corpo = f.querySelector("#galao-corpo");
      var fluxo = null, ativo = true, resultado = null;

      function pararCamera() {
        ativo = false;
        if (fluxo) fluxo.getTracks().forEach(function (t) { t.stop(); });
        fluxo = null;
      }
      function fechar() {
        pararCamera();
        f.remove();
        resolver(resultado);
      }

      function telaLeitura(aviso) {
        ativo = true;
        corpo.innerHTML = '<h2>Conferir o galão</h2>' +
          '<p class="dica">Aponte para o QR Code do galão. Este redutor usa o óleo <b>' + esc(e.tag_oleo) + '</b>' +
          (e.cor_oleo ? ', galão <b>' + esc(e.cor_oleo.nome.toUpperCase()) + '</b>' : '') + '.</p>' +
          '<div class="galao-video"><video playsinline muted></video><i aria-hidden="true"></i></div>' +
          '<p class="dica" id="galao-aviso" role="status">' + esc(aviso || "Abrindo a câmera…") + '</p>' +
          '<label class="foto-btn galao-foto"><input type="file" accept="image/*" capture="environment">Tirar foto do QR do galão</label>' +
          '<button type="button" class="sap galao-fechar">Cancelar</button>';
        corpo.querySelector(".galao-fechar").onclick = fechar;
        var video = corpo.querySelector("video"), avisoEl = corpo.querySelector("#galao-aviso");
        var foto = corpo.querySelector("input[type=file]");

        criarLeitor().then(function (ler) {
          // plano B: foto do QR (quando a câmera ao vivo não é liberada)
          foto.onchange = function () {
            if (!foto.files[0]) return;
            var url = URL.createObjectURL(foto.files[0]), img = new Image();
            img.onload = function () {
              ler(img).then(function (t) {
                URL.revokeObjectURL(url);
                if (t) mostrar(t); else avisoEl.textContent = "Não achei um QR Code na foto. Tente de novo, mais perto e com luz.";
              }, function () { avisoEl.textContent = "Não foi possível ler a foto."; });
            };
            img.src = url;
          };
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            avisoEl.textContent = "A câmera ao vivo não abre neste navegador. Use o botão de foto abaixo.";
            return;
          }
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }).then(function (s) {
            if (!ativo) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
            fluxo = s; video.srcObject = s;
            return video.play().then(function () {
              avisoEl.textContent = "Procurando o QR Code…";
              (function procurar() {
                if (!ativo) return;
                ler(video).then(function (t) {
                  if (!ativo) return;
                  if (t) mostrar(t); else setTimeout(procurar, 200);
                }, function () { if (ativo) setTimeout(procurar, 400); });
              })();
            });
          }).catch(function () {
            avisoEl.textContent = "A câmera não foi liberada. Use o botão de foto abaixo.";
          });
        }, function () {
          avisoEl.textContent = "Não foi possível carregar o leitor de QR Code. Abra a ficha uma vez com internet.";
        });
      }

      function mostrar(texto) {
        pararCamera();
        var cod = codigoDe(texto);
        carregar().then(function (lista) {
          var o = cod ? lista[cod] : null;
          var certo = !!cod && cod === e.tag_oleo;
          var cor = o && o.cor ? '<span class="galao-cor"><i style="background:' + esc(o.cor.hex) + '"></i>galão ' +
            esc(o.cor.nome.toUpperCase()) + '</span>' : '';
          if (certo) {
            resultado = { certo: true, codigo: cod, oleo: o };
            corpo.innerHTML = '<div class="galao-res st-c"><b>ÓLEO CERTO</b>' +
              '<span>' + esc(cod) + ' · ' + esc(o ? o.nome : e.padrao_fabrica) + '</span>' + cor +
              '<span>Pode abastecer ' + esc(String(e.volume_ml).replace(".", ",")) + ' mL.</span></div>';
            if (navigator.vibrate) navigator.vibrate(120);
          } else if (cod) {
            resultado = { certo: false, codigo: cod, oleo: o };
            corpo.innerHTML = '<div class="galao-res st-nc"><b>ÓLEO ERRADO<br>NÃO USE</b>' +
              '<span>Este galão é ' + esc(cod) + (o ? ' · ' + esc(o.base) : '') + '.</span>' + cor +
              '<span>' + esc(codigoEquip) + ' usa ' + esc(e.tag_oleo) + ' · ' + esc(e.lubrificante) +
              (e.cor_oleo ? ', galão ' + esc(e.cor_oleo.nome.toUpperCase()) : '') + '.</span>' +
              '<span>Misturar óleos de bases diferentes estraga o lubrificante e o redutor.</span></div>';
            if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
          } else {
            corpo.innerHTML = '<div class="galao-res st-a"><b>QR CODE NÃO É DE UM GALÃO</b>' +
              '<span>Leia o QR Code da etiqueta do galão de óleo.</span></div>';
          }
          corpo.insertAdjacentHTML("beforeend", '<div class="nav"><button type="button" id="galao-de-novo">Ler de novo</button>' +
            '<button type="button" class="pri" id="galao-ok">' + (resultado && resultado.certo ? "Continuar" : "Fechar") + '</button></div>');
          corpo.querySelector("#galao-de-novo").onclick = function () { resultado = null; telaLeitura(); };
          corpo.querySelector("#galao-ok").onclick = fechar;
        });
      }

      telaLeitura();
    }).then(function (r) {
      if (r) window.dispatchEvent(new CustomEvent("galao-conferido", { detail: { equipamento: codigoEquip, resultado: r } }));
      return r;
    });
  }

  window.Galao = { conferir: conferir, carregar: carregar, codigoDe: codigoDe };
})();
