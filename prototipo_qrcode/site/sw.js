// Service worker: guarda a ficha no aparelho para funcionar sem internet.
// Com rede, busca a versão mais nova; sem rede (ou rede lenta), usa a cópia salva.
const CACHE = "ficha-lubrificacao-v26";
// Sem estes a ficha não abre: a instalação só termina se todos forem salvos.
const ESSENCIAIS = ["/", "/equipamentos.json", "/manifest.webmanifest", "/icone.svg", "/inspecao.js",
  "/galao.js", "/troca.js", "/oleos.json", "/pop.js", "/pop-MEC-RED-001.json", "/monitor.js"];
// O modelo 3D é grande: é salvo em seguida, sem impedir a ficha de funcionar sem internet.
const EXTRAS = ["/redutor3d.js", "/vendor/three.module.min.js", "/vendor/OrbitControls.js",
  "/fundo.jpg", "/apple-touch-icon.png", "/icone-192.png", "/vendor/jsQR.js", "/vendor/mqtt.min.js"];
const ESPERA_MS = 3000;
// O Safari (iPhone) pode não achar a cópia por causa do cabeçalho Vary; ignorar é seguro aqui.
const BUSCA = { ignoreVary: true, ignoreSearch: true };

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ESSENCIAIS).then(() =>
        Promise.all(EXTRAS.map((a) => c.add(a).catch(() => null)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// O Safari recusa abrir uma página entregue pelo service worker se a resposta veio de um
// redirecionamento; nesse caso devolve uma cópia "limpa" da mesma resposta.
function semRedirecionamento(resposta) {
  if (!resposta || !resposta.redirected) return Promise.resolve(resposta);
  return resposta.blob().then((corpo) => new Response(corpo, {
    status: resposta.status, statusText: resposta.statusText, headers: resposta.headers
  }));
}

function daRede(pedido, chave, pagina) {
  return fetch(pedido)
    .then((resposta) => (pagina ? semRedirecionamento(resposta) : resposta))
    .then((resposta) => {
      if (resposta.ok) {
        const copia = resposta.clone();
        caches.open(CACHE).then((c) => c.put(chave, copia));
      }
      return resposta;
    });
}

self.addEventListener("fetch", (ev) => {
  const pedido = ev.request;
  const url = new URL(pedido.url);
  if (pedido.method !== "GET" || url.origin !== location.origin) return;

  // /e/RED-001 (QR do equipamento), /g/OLE-01 (QR do galão) e a página inicial usam a mesma página guardada em "/"
  const ehFicha = pedido.mode === "navigate" && (url.pathname === "/" || url.pathname.startsWith("/e/") || url.pathname.startsWith("/g/"));
  const chave = ehFicha ? "/" : pedido;

  ev.respondWith(
    caches.match(chave, BUSCA)
      .then((salvo) => (ehFicha ? semRedirecionamento(salvo) : salvo))
      .then((salvo) => {
        const rede = daRede(pedido, chave, ehFicha);
        if (!salvo) return rede;
        const limite = new Promise((ok) => setTimeout(() => ok(salvo), ESPERA_MS));
        return Promise.race([rede.catch(() => salvo), limite]);
      })
  );
});
