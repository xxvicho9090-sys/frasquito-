/* App instalable: instalación, sin internet y actualización automática */
(function () {
  const PAGINAS = ["index.html", "juegos.html", "juegos.js", "ruleta.html", "comida.html", "aburrida.html"];
  const leer = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const esc = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const esIndex = /\/(index\.html)?$/.test(location.pathname);
  const instalada = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  /* ───── estilos del aviso y del cartelito ───── */
  const st = document.createElement("style");
  st.textContent = `
    .pwa-toast, .pwa-banner { position:fixed; left:50%; z-index:9999; transform:translate(-50%,160%); font-family:"Nunito",system-ui,sans-serif;
      background:#3b2f4a; color:#fff; border-radius:18px; padding:13px 16px; display:flex; align-items:center; gap:12px;
      font-size:.88rem; font-weight:800; box-shadow:0 14px 36px #0005; max-width:92vw; transition:transform .4s cubic-bezier(.2,1.3,.4,1); }
    .pwa-toast { bottom:calc(18px + env(safe-area-inset-bottom)); }
    .pwa-banner { bottom:calc(14px + env(safe-area-inset-bottom)); background:#fff; color:#3b2f4a; width:min(420px,92vw); }
    .pwa-toast.on, .pwa-banner.on { transform:translate(-50%,0); }
    .pwa-banner img { width:42px; height:42px; border-radius:11px; flex:none; }
    .pwa-banner .tx { flex:1; line-height:1.3; }
    .pwa-banner small { display:block; font-weight:700; color:#7a6b8a; font-size:.74rem; }
    .pwa-btn { border:none; border-radius:12px; padding:9px 14px; font:inherit; font-weight:900; font-size:.82rem; background:#e8798f; color:#fff; cursor:pointer; }
    .pwa-x { border:none; background:none; color:#9b8ca6; font-size:1rem; cursor:pointer; padding:4px; }`;
  document.head.appendChild(st);

  const toast = document.createElement("div");
  toast.className = "pwa-toast"; toast.setAttribute("role", "status");
  document.body.appendChild(toast);
  function mostrar(html, ms) {
    toast.innerHTML = html; toast.classList.add("on");
    if (ms) setTimeout(() => toast.classList.remove("on"), ms);
  }

  /* ───── actualización automática ───── */
  let recargando = false, pendiente = null, esperando = null;
  function ocupada() {
    try {
      if (typeof E !== "undefined" && E && E.corriendo) return true;          // jugando
      if (typeof girando !== "undefined" && girando) return true;             // ruleta girando
    } catch {}
    if ([...document.querySelectorAll("input[type=text],input[type=number],textarea")].some(i => i.value && i.value.trim())) return true;
    return false;
  }
  async function huella() {
    let h = 0, n = 0;
    const textos = await Promise.all(PAGINAS.map(p => fetch(p, { cache: "no-store" }).then(r => r.ok ? r.text() : "").catch(() => "")));
    textos.forEach(t => { n += t.length; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; });
    return h + ":" + n;
  }
  async function recargarYa() {
    if (recargando) return;
    recargando = true;
    try { esc("pwa-huella", pendiente && pendiente !== "sw" ? pendiente : await huella()); } catch {}
    esc("pwa-recien", true);
    location.reload();
  }
  function intentar() {
    if (!pendiente || recargando) return;
    if (ocupada()) {
      mostrar(`✨ Hay una versión nueva <button class="pwa-btn" id="pwaAct">Actualizar</button>`);
      const b = document.getElementById("pwaAct"); if (b) b.onclick = recargarYa;
      if (!esperando) esperando = setInterval(() => { if (!ocupada()) { clearInterval(esperando); esperando = null; recargarYa(); } }, 15000);
      return;
    }
    recargarYa();
  }
  async function buscar() {
    if (!navigator.onLine || recargando) return;
    try {
      const nueva = await huella(), guardada = leer("pwa-huella", null);
      if (guardada === null) esc("pwa-huella", nueva);
      else if (guardada !== nueva) { pendiente = nueva; intentar(); }
    } catch {}
    try { const reg = await navigator.serviceWorker?.getRegistration(); reg && reg.update(); } catch {}
  }

  if ("serviceWorker" in navigator) {
    addEventListener("load", async () => {
      try {
        const reg = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
        reg.addEventListener("updatefound", () => {
          const nuevo = reg.installing; if (!nuevo) return;
          nuevo.addEventListener("statechange", () => {
            if (nuevo.state === "installed" && navigator.serviceWorker.controller) nuevo.postMessage({ tipo: "actualizar" });
          });
        });
        reg.update();
      } catch {}
    });
    let primera = !navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (primera) { primera = false; return; }
      pendiente = pendiente || "sw"; intentar();
    });
  }
  addEventListener("load", () => setTimeout(buscar, 1500));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) buscar(); });
  addEventListener("online", buscar);
  setInterval(buscar, 30 * 60 * 1000);

  if (leer("pwa-recien", false)) {
    esc("pwa-recien", false);
    addEventListener("load", () => mostrar("✨ El frasquito se actualizó con lo nuevo", 3500));
  }

  /* ───── guardado permanente: que el navegador no borre sus puntos ni sus cupones ───── */
  const pedirPersistencia = async () => { try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch {} };
  pedirPersistencia();
  ["click", "touchend"].forEach(ev => addEventListener(ev, function una() { removeEventListener(ev, una); pedirPersistencia(); }, { once: true }));

  /* ───── aviso para instalar (solo en la portada) ───── */
  let diferido = null, banner = null;
  const ocultoHasta = () => leer("pwa-oculto", 0) > Date.now();
  function armarBanner(texto, conBoton) {
    if (banner || !esIndex || instalada || ocultoHasta()) return;
    banner = document.createElement("div");
    banner.className = "pwa-banner";
    banner.innerHTML = `<img src="icono-192.png" alt=""><div class="tx">${texto}<small>Se actualiza sola con lo nuevo ✨</small></div>` +
      (conBoton ? `<button class="pwa-btn" id="pwaInst">Instalar</button>` : "") + `<button class="pwa-x" id="pwaNo" aria-label="Ahora no">✕</button>`;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add("on"));
    const i = banner.querySelector("#pwaInst");
    if (i) i.onclick = async () => { if (!diferido) return; diferido.prompt(); try { await diferido.userChoice; } catch {} diferido = null; cerrarBanner(); };
    banner.querySelector("#pwaNo").onclick = () => { esc("pwa-oculto", Date.now() + 7 * 86400000); cerrarBanner(); };
  }
  function cerrarBanner() { if (banner) { banner.classList.remove("on"); const b = banner; banner = null; setTimeout(() => b.remove(), 500); } }
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); diferido = e; setTimeout(() => armarBanner("📲 Instálalo como app", true), 2500); });
  addEventListener("appinstalled", () => { cerrarBanner(); esc("pwa-oculto", Date.now() + 365 * 86400000); });
  // iPhone no tiene botón de instalar: se explica el paso
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !instalada) setTimeout(() => armarBanner("📲 Toca <b>Compartir</b> y luego <b>Agregar a inicio</b>", false), 3000);
})();
