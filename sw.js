/* Service worker: deja el sitio funcionando sin internet y siempre trae lo último */
const CACHE = "frasco-v1";
const ARCHIVOS = [
  "./", "./index.html", "./juegos.html", "./juegos.js", "./ruleta.html", "./comida.html", "./aburrida.html",
  "./pwa.js", "./manifest.webmanifest", "./icono-192.png", "./icono-512.png", "./icono-maskable.png",
];

self.addEventListener("install", e => {
  // cada archivo por separado: si uno falla, los demás igual quedan guardados
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ARCHIVOS.map(a => c.add(new Request(a, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // red primero y sin caché del navegador (siempre lo último); la copia guardada es el respaldo sin internet
  e.respondWith(
    fetch(req, { cache: "no-store" })
      .then(res => {
        if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {}); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html")))
  );
});

self.addEventListener("message", e => {
  if (e.data && e.data.tipo === "actualizar") self.skipWaiting();
});
