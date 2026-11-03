// Funciona sem internet depois da primeira visita. Ao mudar qualquer arquivo, aumente a VERSAO.
const VERSAO = "fotoodonto-v8";
const ARQUIVOS = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "js/app.js", "js/state.js", "js/guides.js", "js/serie.js", "js/gabarito.js", "js/avaliador.js", "js/editor.js",
  "logo.png", "icons/icon-192.png", "icons/icon-512.png",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // rede primeiro (pega atualizações); cai no cache se estiver offline
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone();
    caches.open(VERSAO).then((c) => c.put(e.request, copia)).catch(() => {});
    return r;
  }).catch(() => caches.match(e.request)));
});
