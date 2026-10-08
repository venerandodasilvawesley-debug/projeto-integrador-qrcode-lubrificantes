// Service worker: guarda a ficha no aparelho para funcionar sem internet.
// Com rede, busca a versão mais nova; sem rede (ou rede lenta), usa a cópia salva.
const CACHE = "ficha-lubrificacao-v4";
const ARQUIVOS = ["/", "/equipamentos.json", "/manifest.webmanifest", "/icone.svg", "/fundo.jpg",
  "/inspecao.js", "/redutor3d.js", "/vendor/three.module.min.js", "/vendor/OrbitControls.js"];
const ESPERA_MS = 3000;

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function daRede(pedido, chave) {
  return fetch(pedido).then((resposta) => {
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

  // /e/RED-001 e a página inicial usam a mesma página guardada em "/"
  const ehFicha = pedido.mode === "navigate" && (url.pathname === "/" || url.pathname.startsWith("/e/"));
  const chave = ehFicha ? "/" : pedido;

  ev.respondWith(
    caches.match(chave).then((salvo) => {
      const rede = daRede(pedido, chave);
      if (!salvo) return rede;
      const limite = new Promise((ok) => setTimeout(() => ok(salvo), ESPERA_MS));
      return Promise.race([rede.catch(() => salvo), limite]);
    })
  );
});
