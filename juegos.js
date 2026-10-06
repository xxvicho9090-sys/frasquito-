/* ============================================================
   SALA DE JUEGOS — motor común + 13 juegos
   ✏️ PERSONALIZA: META (puntos por ficha) y CANAL (ntfy)
   ============================================================ */
const META = 1000;  // puntos para ganar una ficha (1 giro de ruleta)
const TOPE = Infinity;  // sin límite de puntos por partida
const DIAS_ENTRE_GIROS = 7;   // aunque tenga fichas guardadas, solo se gira una vez por semana
// ✏️ Pausa de la ruleta: no se puede girar hasta esta fecha (a las 00:00). Debe ser la misma que en ruleta.html
const BLOQUEO_HASTA = new Date("2026-10-11T00:00:00").getTime();
const CANAL = "animo-644cea567218";

/* ---------- Guardado ---------- */
const S = {
  leer(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const fichasGanadas = () => Math.floor(S.leer("juego-puntos", 0) / META) + S.leer("fichas-extra", 0);
const fichasDisponibles = () => Math.max(0, fichasGanadas() - S.leer("fichas-usadas", 0));
// puntos que faltan para la próxima ficha (cuenta también las fichas que ya gastó)
const puntosQueFaltan = () => {
  const k = S.leer("fichas-usadas", 0) + 1 - S.leer("fichas-extra", 0);
  return Math.max(0, k * META - S.leer("juego-puntos", 0));
};
const ultimoGiro = () => Math.max(0, S.leer("ultimo-giro", 0), ...S.leer("ruleta-cupones", []).map(c => c.fecha || 0));
const msParaGirar = () => Math.max(0, Math.max(ultimoGiro() + DIAS_ENTRE_GIROS * 86400000, BLOQUEO_HASTA) - Date.now());
const textoEspera = ms => { const d = Math.ceil(ms / 86400000); return d <= 1 ? "mañana" : `en ${d} días`; };

/* ---------- Estilos de los juegos DOM ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
  .cartas { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; width:100%; max-width:330px; }
  .carta { aspect-ratio:3/4; border-radius:14px; perspective:600px; cursor:pointer; }
  .carta .in { position:relative; width:100%; height:100%; transition:transform .45s cubic-bezier(.3,1.4,.4,1);
               transform-style:preserve-3d; }
  .carta.v .in { transform:rotateY(180deg); }
  .carta .c, .carta .r { position:absolute; inset:0; backface-visibility:hidden; border-radius:14px;
      display:flex; align-items:center; justify-content:center; font-size:1.9rem; box-shadow:0 4px 12px #0000001a; }
  .carta .c { background:linear-gradient(140deg,#f7a1b5,#e8798f); color:#fff; font-size:1.3rem; }
  .carta .r { background:#fff; transform:rotateY(180deg); }
  .carta.ok { animation:latir .5s ease; }
  .carta.ok .r { background:#d9f7e3; }
  @keyframes latir { 50% { transform:scale(1.12); } }

  .simon { display:grid; grid-template-columns:1fr 1fr; gap:12px; width:100%; max-width:290px; }
  .sb { aspect-ratio:1; border:none; border-radius:22px; cursor:pointer; opacity:.55; transition:opacity .12s, transform .12s;
        box-shadow:0 6px 16px #0000001a; font-size:2rem; }
  .sb.on { opacity:1; transform:scale(1.06); }

  .rejilla { display:grid; gap:7px; width:100%; max-width:320px; }
  .rejilla button { aspect-ratio:1; border:none; border-radius:12px; background:#fff; font-size:1.5rem;
                    cursor:pointer; box-shadow:0 3px 9px #0000000f; transition:transform .12s; }
  .rejilla button:active { transform:scale(.9); }
  .mal { animation:tiritar .32s; }
  @keyframes tiritar { 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }

  .g2048 { width:100%; max-width:320px; background:#efe2ea; border-radius:16px; padding:8px;
           display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  .g2048 .cl { aspect-ratio:1; background:#fdf6fa; border-radius:11px; display:flex; align-items:center;
               justify-content:center; font-size:1.7rem; transition:transform .12s; }
  .g2048 .cl.nv { animation:aparecer .22s cubic-bezier(.2,1.5,.4,1); }
  @keyframes aparecer { from { transform:scale(.3); opacity:0; } }
  .dpad { position:absolute; bottom:10px; left:50%; transform:translateX(-50%); display:grid;
          grid-template-columns:repeat(3,60px); grid-template-rows:repeat(2,52px); gap:7px; z-index:4; opacity:.92; }
  .dpad button { border:none; border-radius:14px; background:#ffffffdd; font-size:1.3rem; color:#3b2f4a;
                 box-shadow:0 3px 10px #0000001a; cursor:pointer; touch-action:none; }
  .dpad button:active { background:#ffd6e2; transform:scale(.94); }
  .dpad .ar { grid-column:2; grid-row:1; }
  .dpad .iz { grid-column:1; grid-row:2; }
  .dpad .ab { grid-column:2; grid-row:2; }
  .dpad .de { grid-column:3; grid-row:2; }
  .pista { position:absolute; bottom:10px; left:0; right:0; text-align:center; font-size:.78rem;
           color:#7a6b8a; font-weight:800; pointer-events:none; }
</style>`);

/* ============================================================
   MOTOR
   ============================================================ */
const E = {
  cv: document.getElementById("cv"), ctx: null, dom: document.getElementById("dom"),
  zona: document.getElementById("zona"), W: 0, H: 0, dpr: Math.min(devicePixelRatio || 1, 2),
  juego: null, score: 0, tiempo: 0, corriendo: false, ultimo: 0, parts: [], shake: 0,
  puntero: { x: 0, y: 0, abajo: false, movido: false }, token: 0, pausa: false, timers: [],
};
E.ctx = E.cv.getContext("2d");

function medir() {
  const r = E.zona.getBoundingClientRect();
  E.W = r.width; E.H = r.height;
  E.cv.width = E.W * E.dpr; E.cv.height = E.H * E.dpr;
  E.ctx.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
  if (E.juego && E.juego.resize && E.corriendo) E.juego.resize(E.W, E.H);
}
addEventListener("resize", () => { if (!document.getElementById("jugar").classList.contains("oculto")) medir(); });

/* --- sonido simple --- */
let AC = null;
function tono(f = 440, dur = .08, tipo = "sine", vol = .05) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = tipo; o.frequency.value = f; g.gain.value = vol;
    o.connect(g); g.connect(AC.destination); o.start();
    g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + dur);
    o.stop(AC.currentTime + dur + .02);
  } catch {}
}
const vibrar = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
function luego(fn, ms) { const id = setTimeout(() => { E.timers = E.timers.filter(t => t !== id); fn(); }, ms); E.timers.push(id); return id; }
function cadaTanto(fn, ms) { const id = setInterval(fn, ms); E.timers.push(id); return id; }
function limpiarTimers() { E.timers.forEach(id => { clearTimeout(id); clearInterval(id); }); E.timers = []; }

/* --- partículas --- */
function chispas(x, y, color = "#e8798f", n = 10, texto = null) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
    E.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, vida: .5 + Math.random() * .4, color, texto, r: 2 + Math.random() * 3 });
  }
}
function flota(x, y, texto, color = "#3cb66a") {
  E.parts.push({ x, y, vx: 0, vy: -50, t: 0, vida: .8, color, flota: texto });
}
function dibujarParts(ctx, dt) {
  for (const p of E.parts) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (!p.flota) p.vy += 420 * dt;
    const a = Math.max(0, 1 - p.t / p.vida);
    ctx.globalAlpha = a;
    if (p.flota) {
      ctx.fillStyle = p.color; ctx.font = "900 19px Nunito, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(p.flota, p.x, p.y);
    } else if (p.texto) {
      ctx.font = "16px serif"; ctx.textAlign = "center"; ctx.fillText(p.texto, p.x, p.y);
    } else {
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  E.parts = E.parts.filter(p => p.t < p.vida);
}

/* --- API para los juegos --- */
const api = {
  get W() { return E.W; }, get H() { return E.H; },
  get puntero() { return E.puntero; },
  sumar(n, x, y) {
    E.score = Math.max(0, E.score + n);
    if (x != null) flota(x, y, (n > 0 ? "+" : "") + n, n > 0 ? "#3cb66a" : "#d9534f");
    hud();
  },
  chispas, flota, tono, vibrar,
  sacudir(f = 6) { E.shake = f; },
  hud(izq, medio, der) {
    if (izq !== undefined) document.getElementById("hudIzq").textContent = izq;
    if (medio !== undefined) document.getElementById("hudMedio").textContent = medio;
    if (der !== undefined) document.getElementById("hudDer").textContent = der;
  },
  fin() { terminar(); },
  dom: E.dom,
};
function hud() {
  document.getElementById("hudIzq").textContent = "🍬 " + E.score;
  if (E.juego && E.juego.tiempo) document.getElementById("hudMedio").textContent = "⏱️ " + Math.ceil(E.tiempo);
  document.getElementById("hudDer").textContent = "🏆 " + S.leer("rec-" + E.juego.id, 0);
}

/* --- entrada --- */
function coords(e) {
  const r = E.zona.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
let ini = null;
E.zona.addEventListener("pointerdown", e => {
  if (!E.corriendo || E.pausa) return;
  try { E.zona.setPointerCapture(e.pointerId); } catch {}
  const c = coords(e); E.puntero = { ...c, abajo: true, movido: true }; ini = { ...c, t: Date.now() };
  E.juego && E.juego.tocar && E.juego.tocar(c.x, c.y, "abajo");
});
E.zona.addEventListener("pointermove", e => {
  if (!E.corriendo || E.pausa) return;
  e.preventDefault();
  const c = coords(e); E.puntero.x = c.x; E.puntero.y = c.y; E.puntero.movido = true;
  E.juego && E.juego.tocar && E.juego.tocar(c.x, c.y, "mover");
  // deslizar: se detecta apenas pasa el umbral, sin esperar a soltar
  if (ini && E.juego && E.juego.deslizar) {
    const dx = c.x - ini.x, dy = c.y - ini.y;
    if (Math.hypot(dx, dy) > 22) {
      E.juego.deslizar(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "der" : "izq") : (dy > 0 ? "abajo" : "arriba"));
      ini = { ...c, t: Date.now(), usado: true };   // el mismo dedo puede encadenar varios giros
    }
  }
}, { passive: false });
addEventListener("pointerup", e => {
  if (!E.corriendo || E.pausa) return;
  E.puntero.abajo = false;
  const c = coords(e);
  E.juego && E.juego.tocar && E.juego.tocar(c.x, c.y, "arriba");
  if (ini && !ini.usado && E.juego && E.juego.deslizar) {
    const dx = c.x - ini.x, dy = c.y - ini.y;
    if (Math.hypot(dx, dy) > 18)
      E.juego.deslizar(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "der" : "izq") : (dy > 0 ? "abajo" : "arriba"));
  }
  ini = null;
});

/* --- bucle --- */
function loop(t) {
  if (!E.corriendo || t === undefined) return;
  if (loop.token !== E.token) return;          // bucle viejo: se apaga
  if (E.pausa) { E.ultimo = t; return requestAnimationFrame(loop); }
  const dt = Math.min((t - E.ultimo) / 1000, .05); E.ultimo = t;
  if (E.juego.tiempo) {
    E.tiempo -= dt;
    document.getElementById("hudMedio").textContent = "⏱️ " + Math.max(0, Math.ceil(E.tiempo));
    if (E.tiempo <= 0) return terminar();
  }
  E.juego.update && E.juego.update(dt);
  if (E.juego.tipo === "canvas") {
    const c = E.ctx;
    c.save();
    if (E.shake > 0) { c.translate((Math.random() - .5) * E.shake, (Math.random() - .5) * E.shake); E.shake *= .88; if (E.shake < .4) E.shake = 0; }
    c.clearRect(-20, -20, E.W + 40, E.H + 40);
    E.juego.draw && E.juego.draw(c, dt);
    dibujarParts(c, dt);
    c.restore();
  }
  requestAnimationFrame(loop);
}

/* --- pausa automática si sale de la app --- */
document.addEventListener("visibilitychange", () => {
  if (!E.corriendo) return;
  if (document.hidden) { E.pausa = true; ovMostrar("Pausa ⏸️", "Volviste a otra app, así que te guardé el juego.", [{ txt: "Seguir jugando", cls: "btn", fn: reanudar }]); }
});
function reanudar() { ovOcultar(); E.pausa = false; E.ultimo = performance.now(); }

/* --- iniciar / terminar --- */
function jugar(id) {
  const def = JUEGOS.find(j => j.id === id);
  E.juego = Object.assign({}, def);
  document.getElementById("hub").classList.add("oculto");
  document.getElementById("jugar").classList.remove("oculto");
  document.getElementById("btnVolver").classList.remove("oculto");
  document.getElementById("titulo").textContent = def.nombre;
  E.cv.classList.toggle("oculto", def.tipo !== "canvas");
  E.dom.classList.toggle("oculto", def.tipo !== "dom");
  E.dom.innerHTML = ""; E.parts = []; E.shake = 0;
  E.zona.style.background = def.fondo || "var(--card)";
  medir();
  ovMostrar(def.emoji + " " + def.nombre, def.ayuda, [
    { txt: "Jugar", cls: "btn", fn: arrancar },
  ]);
}
function arrancar() {
  limpiarTimers();
  ovOcultar();
  E.corriendo = false; E.pausa = false;
  E.score = 0; E.tiempo = E.juego.tiempo || 0; E.parts = []; E.shake = 0;
  E.dom.innerHTML = "";
  medir();
  E.puntero = { x: E.W / 2, y: E.H / 2, abajo: false, movido: false };
  E.juego.init && E.juego.init(api);
  hud();
  if (!E.juego.tiempo) document.getElementById("hudMedio").textContent = E.juego.medio || "▶";
  E.corriendo = true; E.ultimo = performance.now();
  loop.token = ++E.token;
  requestAnimationFrame(loop);
}
function terminar() {
  if (!E.corriendo) return;
  E.corriendo = false; E.pausa = false; E.token++;
  limpiarTimers();
  E.juego.destroy && E.juego.destroy();
  api.tono(330, .12, "triangle"); luego(() => api.tono(262, .2, "triangle"), 110);
  const puntos = Math.min(TOPE, Math.round(E.score * (E.juego.factor || 1)));
  const rec = S.leer("rec-" + E.juego.id, 0);
  const nuevoRec = E.score > rec;
  if (nuevoRec) S.escribir("rec-" + E.juego.id, E.score);
  document.getElementById("hudDer").textContent = "🏆 " + S.leer("rec-" + E.juego.id, 0);
  const antes = fichasDisponibles();
  const total = S.leer("juego-puntos", 0) + puntos;
  S.escribir("juego-puntos", total);
  const ahora = fichasDisponibles();
  const ganadas = ahora - antes;
  pintarFichas();

  const falta = puntosQueFaltan();
  const espera = msParaGirar();
  const botones = [{ txt: "Otra vez", cls: "btn", fn: arrancar }, { txt: "Otros juegos", cls: "btn alt", fn: volverHub }];
  if (ahora > 0 && espera === 0) botones.unshift({ txt: "🎡 Girar la ruleta", cls: "btn oro", href: "ruleta.html" });

  let resumen;
  if (ahora > 0) {
    resumen = `Tienes <b>${ahora}</b> ficha${ahora === 1 ? "" : "s"} guardada${ahora === 1 ? "" : "s"} 🎟️<br>` +
      (espera === 0 ? "Ya puedes girar la ruleta 🎡"
        : Date.now() < BLOQUEO_HASTA && BLOQUEO_HASTA >= ultimoGiro() + DIAS_ENTRE_GIROS * 86400000
          ? `La ruleta descansa esta semana: podrás girar el <b>${new Date(BLOQUEO_HASTA).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}</b>.`
          : `Podrás girar la ruleta <b>${textoEspera(espera)}</b> (1 giro por semana).`);
  } else {
    resumen = `Te faltan <b>${falta}</b> puntos para la próxima ficha 🎟️`;
  }
  ovMostrar(
    ganadas > 0 ? "¡Ganaste una ficha! 🎟️" : nuevoRec ? "¡Nuevo récord! 🏆" : "Se acabó",
    `<span class="pts">${puntos}<small>${"PUNTOS"}</small></span>` + resumen,
    botones);
  if (ganadas > 0) confeti();
  if (puntos > 0) {
    const faltan = puntosQueFaltan();
    fetch("https://ntfy.sh/" + CANAL, {
      method: "POST",
      body: `🎮 ${E.juego.nombre}: +${puntos} puntos. Lleva ${total} en total` + (ganadas > 0 ? " y desbloqueó una ficha 🎟️" : `, le faltan ${faltan} para la próxima ficha.`),
      headers: { "Title": ganadas > 0 ? "Gano una ficha" : "Puntos de juegos", "Tags": "video_game" },
    }).catch(() => {});
  }
}
function volverHub() {
  E.corriendo = false; E.pausa = false; E.token++;
  limpiarTimers();
  E.juego && E.juego.destroy && E.juego.destroy();
  E.juego = null; E.dom.innerHTML = ""; ovOcultar();
  document.getElementById("jugar").classList.add("oculto");
  document.getElementById("hub").classList.remove("oculto");
  document.getElementById("btnVolver").classList.add("oculto");
  document.getElementById("titulo").textContent = "Sala de Juegos";
  pintarHub();
}

/* --- overlay --- */
function ovMostrar(titulo, texto, botones) {
  document.getElementById("ovT").textContent = titulo;
  document.getElementById("ovP").innerHTML = texto;
  const cont = document.getElementById("ovBtns"); cont.innerHTML = "";
  botones.forEach(b => {
    const el = document.createElement(b.href ? "a" : "button");
    el.className = b.cls; el.textContent = b.txt;
    if (b.href) el.href = b.href; else el.onclick = b.fn;
    cont.appendChild(el);
  });
  document.getElementById("ov").classList.add("on");
}
const ovOcultar = () => document.getElementById("ov").classList.remove("on");

function confeti() {
  const em = ["🎉", "🎟️", "✨", "🍬", "⭐"];
  for (let i = 0; i < 26; i++) {
    const d = document.createElement("div");
    d.className = "confeti"; d.textContent = em[i % em.length];
    d.style.left = Math.random() * 100 + "vw";
    d.style.animationDuration = 2.4 + Math.random() * 2 + "s";
    d.style.animationDelay = Math.random() * .8 + "s";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 5200);
  }
}

/* ============================================================
   LOS 10 JUEGOS
   ============================================================ */
const JUEGOS = [];

/* 1 ── Atrapa Dulces ─────────────────────────────────────── */
JUEGOS.push({
  id: "atrapa", nombre: "Atrapa Dulces", emoji: "🍬", tipo: "canvas", tiempo: 40, factor: 0.16,
  color: "#ffd9e4", desc: "Mueve la canasta", fondo: "linear-gradient(#fff6fa,#ffe8f1)",
  ayuda: "Mueve el dedo para atrapar los dulces 🍬<br>Esquiva las verduras 🥦 (hoy no, gracias)",
  init() {
    this.cesta = E.W / 2; this.items = []; this.spawn = 0; this.racha = 0;
  },
  update(dt) {
    if (E.puntero.movido) this.cesta += (E.puntero.x - this.cesta) * Math.min(1, dt * 14);
    this.cesta = Math.max(38, Math.min(E.W - 38, this.cesta));
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = .34 + Math.random() * .26;
      const malo = Math.random() < .32;
      const buenos = [["🍬", 5], ["🍭", 5], ["🍪", 5], ["🍩", 5], ["🍦", 8], ["🧃", 5]];
      const estrella = Math.random() < .07;
      const [em, pts] = malo ? [["🥦", -8], ["🥬", -8], ["🧅", -8]][Math.floor(Math.random() * 3)]
        : estrella ? ["⭐", 15] : buenos[Math.floor(Math.random() * buenos.length)];
      this.items.push({ em, pts, malo, x: 26 + Math.random() * (E.W - 52), y: -26,
        v: 180 + Math.random() * 110 + (40 - E.tiempo) * 4.6, g: (Math.random() - .5) * 3 });
    }
    const suelo = E.H - 52;
    for (const it of this.items) {
      it.y += it.v * dt;
      if (!it.listo && it.y > suelo - 16 && it.y < suelo + 20 && Math.abs(it.x - this.cesta) < 46) {
        it.listo = true;
        if (it.malo) { this.racha = 0; api.sumar(it.pts, it.x, it.y); api.tono(160, .12, "square"); api.sacudir(7); api.vibrar(40); }
        else {
          this.racha++;
          api.sumar(it.pts + (this.racha >= 8 ? 3 : 0), it.x, it.y);
          api.chispas(it.x, it.y, "#f7a1b5", 9); api.tono(620 + this.racha * 25, .07);
        }
      }
      if (it.y > E.H + 30) { it.listo = true; if (!it.malo) this.racha = 0; }
    }
    this.items = this.items.filter(i => !i.listo);
  },
  draw(c) {
    c.font = "30px serif"; c.textAlign = "center"; c.textBaseline = "middle";
    for (const it of this.items) {
      c.save(); c.translate(it.x, it.y); c.rotate(it.g * it.y / 400); c.fillText(it.em, 0, 0); c.restore();
    }
    const suelo = E.H - 52;
    c.font = "46px serif"; c.fillText("🧺", this.cesta, suelo);
    if (this.racha >= 8) {
      c.font = "900 13px Nunito, sans-serif"; c.fillStyle = "#e0a92b";
      c.fillText("🔥 racha x" + this.racha, this.cesta, suelo + 30);
    }
  },
});

/* 2 ── Memoria ───────────────────────────────────────────── */
JUEGOS.push({
  id: "memoria", nombre: "Memoria", emoji: "🧠", tipo: "dom", tiempo: 50, factor: 0.15,
  color: "#dfe8ff", desc: "Encuentra los pares", fondo: "linear-gradient(#f7faff,#e9f0ff)",
  ayuda: "Da vuelta las cartas y encuentra los 8 pares 🍬<br>Mientras menos intentos, más puntos",
  init() {
    const em = ["🍬", "🍭", "🍪", "🍩", "🍦", "🧁", "🍯", "🍓"];
    const mazo = [...em, ...em].sort(() => Math.random() - .5);
    this.vueltas = []; this.bloqueo = false; this.pares = 0; this.intentos = 0;
    E.dom.innerHTML = `<div class="cartas" id="cartas"></div>`;
    const cont = E.dom.querySelector("#cartas");
    mazo.forEach((e, i) => {
      const d = document.createElement("div");
      d.className = "carta"; d.dataset.em = e;
      d.innerHTML = `<div class="in"><div class="c">?</div><div class="r">${e}</div></div>`;
      d.onclick = () => this.voltear(d);
      cont.appendChild(d);
    });
    api.hud("🍬 0", "⏱️ 50", "🏆 " + S.leer("rec-memoria", 0));
  },
  voltear(d) {
    if (this.bloqueo || d.classList.contains("v") || !E.corriendo) return;
    d.classList.add("v"); api.tono(500, .05);
    this.vueltas.push(d);
    if (this.vueltas.length === 2) {
      this.intentos++; this.bloqueo = true;
      const [a, b] = this.vueltas;
      if (a.dataset.em === b.dataset.em) {
        luego(() => {
          if (!E.corriendo) return;
          a.classList.add("ok"); b.classList.add("ok");
          this.pares++; api.sumar(20); api.tono(760, .1); api.vibrar(25);
          this.vueltas = []; this.bloqueo = false;
          if (this.pares === 8) { api.sumar(Math.max(0, 50 - this.intentos * 4) + Math.round(E.tiempo)); api.fin(); }
        }, 320);
      } else {
        luego(() => {
          if (!E.corriendo) return;
          a.classList.remove("v"); b.classList.remove("v"); this.vueltas = []; this.bloqueo = false; api.tono(220, .08, "triangle");
        }, 700);
      }
    }
  },
});

/* 3 ── Burbujas ──────────────────────────────────────────── */
JUEGOS.push({
  id: "burbujas", nombre: "Burbujas", emoji: "🫧", tipo: "canvas", tiempo: 35, factor: 0.07,
  color: "#d9f0ff", desc: "Revienta antes que escapen", fondo: "linear-gradient(#eef8ff,#dceeff)",
  ayuda: "Toca las burbujas antes de que se escapen 🫧<br>Las rojas 💣 te quitan puntos, no las toques",
  init() { this.bs = []; this.spawn = 0; },
  update(dt) {
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = .26 + Math.random() * .2;
      const mala = Math.random() < .34;
      this.bs.push({ x: 30 + Math.random() * (E.W - 60), y: E.H + 30, r: 20 + Math.random() * 16,
        v: 95 + Math.random() * 100, mala, fase: Math.random() * 6, hue: Math.random() * 60 + 300 });
    }
    for (const b of this.bs) { b.y -= b.v * dt; b.fase += dt * 2; b.x += Math.sin(b.fase) * .6; }
    this.bs = this.bs.filter(b => b.y > -40 && !b.pop);
  },
  tocar(x, y, tipo) {
    if (tipo === "arriba") return;
    for (let i = this.bs.length - 1; i >= 0; i--) {
      const b = this.bs[i];
      if (Math.hypot(b.x - x, b.y - y) < b.r + 8) {
        b.pop = true;
        if (b.mala) { api.sumar(-8, b.x, b.y); api.sacudir(8); api.tono(140, .14, "square"); api.vibrar(45); }
        else {
          api.sumar(Math.round(28 - b.r / 2), b.x, b.y);
          api.chispas(b.x, b.y, `hsl(${b.hue} 80% 70%)`, 12); api.tono(500 + (40 - b.r) * 14, .07);
        }
        return;
      }
    }
  },
  draw(c) {
    for (const b of this.bs) {
      const g = c.createRadialGradient(b.x - b.r / 3, b.y - b.r / 3, 2, b.x, b.y, b.r);
      if (b.mala) { g.addColorStop(0, "#ffb3b3"); g.addColorStop(1, "#e05a5a"); }
      else { g.addColorStop(0, "#ffffffdd"); g.addColorStop(1, `hsl(${b.hue} 85% 72%)`); }
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill();
      c.strokeStyle = "#ffffff99"; c.lineWidth = 2; c.stroke();
      c.fillStyle = "#ffffffcc"; c.beginPath(); c.arc(b.x - b.r / 3, b.y - b.r / 3, b.r / 5, 0, 7); c.fill();
      if (b.mala) { c.font = "16px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("💣", b.x, b.y); }
    }
  },
});

/* 4 ── Serpiente ─────────────────────────────────────────── */
JUEGOS.push({
  id: "snake", nombre: "Gusanito", emoji: "🐛", tipo: "canvas", tiempo: null, factor: 0.35,
  color: "#dff6e3", desc: "Come sin chocar", fondo: "linear-gradient(#f3fff6,#e2f7e8)", medio: "🐛",
  ayuda: "Mueve al gusanito con las flechas o deslizando 🐛<br>Come dulces y no choques contigo misma",
  init() {
    const alto = E.H - 112;                       // espacio para las flechas
    this.cel = Math.floor(Math.min(E.W, alto) / 14);
    this.cols = Math.floor(E.W / this.cel); this.filas = Math.floor(alto / this.cel);
    this.ox = (E.W - this.cols * this.cel) / 2; this.oy = 8;
    this.s = [{ x: 4, y: Math.floor(this.filas / 2) }]; this.d = { x: 1, y: 0 }; this.cola = [];
    this.acum = 0; this.vel = .14; this.crecer = 2; this.poner();
    // flechas en pantalla: más fáciles que deslizar
    const d = document.createElement("div");
    d.className = "dpad";
    d.innerHTML = `<button class="ar">▲</button><button class="iz">◀</button><button class="ab">▼</button><button class="de">▶</button>`;
    const m = { ar: "arriba", iz: "izq", ab: "abajo", de: "der" };
    d.querySelectorAll("button").forEach(b => {
      const dir = m[b.className];
      b.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); this.deslizar(dir); api.tono(420, .04); });
    });
    E.zona.appendChild(d); this.dpad = d;
  },
  destroy() { if (this.dpad) { this.dpad.remove(); this.dpad = null; } },
  resize() {
    const antes = { cols: this.cols, filas: this.filas };
    const alto = E.H - 112;
    this.cel = Math.floor(Math.min(E.W, alto) / 14);
    this.cols = Math.floor(E.W / this.cel); this.filas = Math.floor(alto / this.cel);
    this.ox = (E.W - this.cols * this.cel) / 2; this.oy = 8;
    if (!antes.cols) return;
    this.s = this.s.map(p => ({ x: Math.min(p.x, this.cols - 1), y: Math.min(p.y, this.filas - 1) }));
    this.fruta = { x: Math.min(this.fruta.x, this.cols - 1), y: Math.min(this.fruta.y, this.filas - 1) };
  },
  poner() {
    do { this.fruta = { x: Math.floor(Math.random() * this.cols), y: Math.floor(Math.random() * this.filas) }; }
    while (this.s.some(p => p.x === this.fruta.x && p.y === this.fruta.y));
    this.emFruta = ["🍬", "🍭", "🍓", "🍪"][Math.floor(Math.random() * 4)];
  },
  deslizar(dir) {
    const m = { izq: { x: -1, y: 0 }, der: { x: 1, y: 0 }, arriba: { x: 0, y: -1 }, abajo: { x: 0, y: 1 } }[dir];
    if (!m) return;
    const ref = this.cola.length ? this.cola[this.cola.length - 1] : this.d;
    if ((m.x === -ref.x && m.y === -ref.y) || (m.x === ref.x && m.y === ref.y)) return;
    if (this.cola.length < 2) this.cola.push(m);
  },
  update(dt) {
    this.acum += dt;
    if (this.acum < this.vel) return;
    this.acum = 0; if (this.cola.length) this.d = this.cola.shift();
    const cab = { x: this.s[0].x + this.d.x, y: this.s[0].y + this.d.y };
    if (cab.x < 0 || cab.y < 0 || cab.x >= this.cols || cab.y >= this.filas || this.s.some(p => p.x === cab.x && p.y === cab.y)) {
      api.sacudir(10); api.tono(120, .25, "sawtooth"); api.vibrar(90); return api.fin();
    }
    this.s.unshift(cab);
    if (cab.x === this.fruta.x && cab.y === this.fruta.y) {
      api.sumar(12, this.ox + cab.x * this.cel, this.oy + cab.y * this.cel);
      api.chispas(this.ox + cab.x * this.cel + this.cel / 2, this.oy + cab.y * this.cel + this.cel / 2, "#8ed9a4", 10);
      api.tono(680, .07); this.crecer += 2; this.vel = Math.max(.05, this.vel - .005); this.poner();
    }
    if (this.crecer > 0) this.crecer--; else this.s.pop();
  },
  draw(c) {
    c.fillStyle = "#ffffff70";
    c.fillRect(this.ox, this.oy, this.cols * this.cel, this.filas * this.cel);
    this.s.forEach((p, i) => {
      const x = this.ox + p.x * this.cel, y = this.oy + p.y * this.cel;
      c.fillStyle = i === 0 ? "#4caf72" : `hsl(140 45% ${58 + (i % 2) * 8}%)`;
      c.beginPath(); c.roundRect(x + 1, y + 1, this.cel - 2, this.cel - 2, i === 0 ? 7 : 5); c.fill();
      if (i === 0) {
        c.fillStyle = "#fff";
        c.beginPath(); c.arc(x + this.cel * .35, y + this.cel * .38, 2.4, 0, 7); c.fill();
        c.beginPath(); c.arc(x + this.cel * .65, y + this.cel * .38, 2.4, 0, 7); c.fill();
      }
    });
    c.font = (this.cel - 3) + "px serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(this.emFruta, this.ox + this.fruta.x * this.cel + this.cel / 2, this.oy + this.fruta.y * this.cel + this.cel / 2);
  },
});

/* 5 ── Torre ─────────────────────────────────────────────── */
JUEGOS.push({
  id: "torre", nombre: "Torre Dulce", emoji: "🧁", tipo: "canvas", tiempo: null, factor: 0.25,
  color: "#ffe9cf", desc: "Apila sin fallar", fondo: "linear-gradient(#fffaf2,#ffeedb)", medio: "🧁",
  ayuda: "Toca la pantalla para soltar el bloque 🧁<br>Apílalos lo más derecho posible",
  init() {
    this.bh = 26; this.base = { x: E.W / 2 - 55, w: 110 };
    this.anchoPrev = E.W;
    this.pila = [{ ...this.base, y: E.H - 40 }];
    this.actual = { x: 0, w: 110, dir: 1, v: 185 };
    this.cam = 0; this.perfectos = 0;
  },
  resize() {
    if (!this.anchoPrev || this.anchoPrev === E.W) { this.anchoPrev = E.W; return; }
    const k = E.W / this.anchoPrev; this.anchoPrev = E.W;
    this.pila.forEach(b => { b.x *= k; b.w *= k; });
    this.actual.x *= k; this.actual.w *= k;
  },
  update(dt) {
    const a = this.actual;
    a.x += a.dir * a.v * dt;
    if (a.x <= 0) { a.x = 0; a.dir = 1; } else if (a.x + a.w >= E.W) { a.x = E.W - a.w; a.dir = -1; }
    this.cam += ((Math.max(0, this.pila.length * this.bh - E.H * .55)) - this.cam) * Math.min(1, dt * 5);
  },
  tocar(x, y, tipo) {
    if (tipo !== "abajo") return;
    const ult = this.pila[this.pila.length - 1], a = this.actual;
    const izq = Math.max(a.x, ult.x), der = Math.min(a.x + a.w, ult.x + ult.w);
    const ancho = der - izq;
    if (ancho <= 6) { api.sacudir(12); api.tono(110, .3, "sawtooth"); api.vibrar(110); return api.fin(); }
    const dif = Math.abs(a.x - ult.x);
    if (dif < 5) { this.perfectos++; api.sumar(20 + this.perfectos * 5); api.tono(880, .1); api.chispas(izq + ancho / 2, E.H - 40 - this.pila.length * this.bh + this.cam, "#e0a92b", 14); }
    else { this.perfectos = 0; api.sumar(10); api.tono(560, .07); }
    this.pila.push({ x: izq, w: ancho, y: 0 });
    this.actual = { x: Math.random() < .5 ? 0 : E.W - ancho, w: ancho, dir: Math.random() < .5 ? 1 : -1,
                    v: Math.min(440, 185 + this.pila.length * 13) };
    api.vibrar(18);
  },
  draw(c) {
    const baseY = E.H - 40;
    this.pila.forEach((b, i) => {
      const y = baseY - i * this.bh + this.cam;
      if (y < -40) return;
      const g = c.createLinearGradient(b.x, y - this.bh, b.x, y);
      g.addColorStop(0, `hsl(${(i * 24) % 360} 75% 76%)`); g.addColorStop(1, `hsl(${(i * 24) % 360} 70% 64%)`);
      c.fillStyle = g; c.beginPath(); c.roundRect(b.x, y - this.bh + 2, b.w, this.bh - 3, 7); c.fill();
    });
    const a = this.actual, y = baseY - this.pila.length * this.bh + this.cam;
    c.fillStyle = "#e8798f"; c.beginPath(); c.roundRect(a.x, y - this.bh + 2, a.w, this.bh - 3, 7); c.fill();
    c.font = "20px serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("🧁", a.x + a.w / 2, y - this.bh / 2);
  },
});

/* 6 ── Simón ─────────────────────────────────────────────── */
JUEGOS.push({
  id: "simon", nombre: "Repite", emoji: "🎵", tipo: "dom", tiempo: null, factor: 0.12,
  color: "#ecdcff", desc: "Memoriza la secuencia", fondo: "linear-gradient(#faf5ff,#efe4ff)", medio: "🎵",
  ayuda: "Mira la secuencia y repítela 🎵<br>Cada ronda se agrega un color más",
  init() {
    this.cols = [["#ff8fab", 392, "🍓"], ["#ffd97d", 523, "🍋"], ["#8ed9a4", 659, "🍏"], ["#9ec8ff", 784, "🫐"]];
    E.dom.innerHTML = `<div style="width:100%"><div class="simon" id="sim"></div><p class="pista" id="pista">Mira bien...</p></div>`;
    const cont = E.dom.querySelector("#sim");
    this.cols.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "sb"; b.style.background = c[0]; b.textContent = c[2];
      b.onclick = () => this.tocarBoton(i);
      cont.appendChild(b);
    });
    this.btns = [...cont.children]; this.sec = []; this.ronda = 0;
    api.hud("🍬 0", "🎵", "🏆 " + S.leer("rec-simon", 0));
    luego(() => this.siguiente(), 600);
  },
  prender(i, ms = 380) {
    const b = this.btns[i]; if (!b) return;
    b.classList.add("on"); api.tono(this.cols[i][1], ms / 1000 * .8);
    luego(() => b.classList.remove("on"), ms * .75);
  },
  siguiente() {
    this.ronda++;
    this.sec.push(Math.floor(Math.random() * 4));
    this.paso = 0; this.turno = false;
    const p = E.dom.querySelector("#pista"); if (p) p.textContent = "Ronda " + this.ronda + " — mira bien...";
    let i = 0;
    const rapido = Math.max(230, 500 - this.ronda * 24);
    this.int = cadaTanto(() => {
      if (!E.corriendo || E.pausa) { if (!E.corriendo) clearInterval(this.int); return; }
      this.prender(this.sec[i], Math.min(380, rapido * .7)); i++;
      if (i >= this.sec.length) {
        clearInterval(this.int);
        luego(() => { if (!E.corriendo) return; this.turno = true; const q = E.dom.querySelector("#pista"); if (q) q.textContent = "¡Ahora tú! 👆"; }, 420);
      }
    }, rapido);
  },
  destroy() { clearInterval(this.int); },
  tocarBoton(i) {
    if (!this.turno || !E.corriendo || E.pausa) return;
    this.prender(i, 220);
    if (this.sec[this.paso] === i) {
      this.paso++;
      if (this.paso === this.sec.length) {
        this.turno = false;
        api.sumar(this.ronda * 10); api.vibrar(25);
        const p = E.dom.querySelector("#pista"); if (p) p.textContent = "¡Bien! 🎉";
        luego(() => { if (E.corriendo) this.siguiente(); }, 800);
      }
    } else {
      api.tono(100, .35, "sawtooth"); api.vibrar(120);
      const sim = E.dom.querySelector("#sim"); if (sim) sim.classList.add("mal");
      const p = E.dom.querySelector("#pista"); if (p) p.textContent = "Uy, esa no era 😅";
      this.turno = false;
      luego(() => api.fin(), 700);
    }
  },
});

/* 7 ── Esquiva ───────────────────────────────────────────── */
JUEGOS.push({
  id: "esquiva", nombre: "Esquiva", emoji: "🏃‍♀️", tipo: "canvas", tiempo: null, factor: 0.3,
  color: "#ffe0e0", desc: "No choques", fondo: "linear-gradient(#fff5f5,#ffe6ea)", medio: "🏃‍♀️",
  ayuda: "Mueve el dedo para esquivar 🪨<br>Junta los corazones ❤️ y aguanta lo más posible",
  init() {
    this.x = E.W / 2; this.obs = []; this.spawn = 0; this.vel = 240; this.dist = 0; this.linea = 0;
  },
  update(dt) {
    if (E.puntero.movido) this.x += (E.puntero.x - this.x) * Math.min(1, dt * 12);
    this.x = Math.max(20, Math.min(E.W - 20, this.x));
    this.vel += dt * 15; this.dist += dt; this.linea = (this.linea + this.vel * dt) % 40;
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = .34 + Math.random() * .22;
      const bueno = Math.random() < .18;
      let x, intentos = 0;
      do {
        x = 24 + Math.random() * (E.W - 48); intentos++;
      } while (intentos < 8 && this.obs.some(o => o.y < 70 && !o.bueno && !bueno && Math.abs(o.x - x) < 86));
      this.obs.push({ x, y: -30, bueno, r: bueno ? 14 : 18 + Math.random() * 8 });
    }
    const py = E.H - 70;
    for (const o of this.obs) {
      o.y += this.vel * dt;
      if (!o.listo && Math.abs(o.y - py) < 24 && Math.abs(o.x - this.x) < o.r + 15) {
        o.listo = true;
        if (o.bueno) { api.sumar(15, o.x, o.y); api.chispas(o.x, o.y, "#ff8fab", 12); api.tono(720, .08); }
        else { api.sacudir(14); api.tono(110, .3, "sawtooth"); api.vibrar(120); return api.fin(); }
      }
      if (o.y > E.H + 40) o.listo = true;
    }
    this.obs = this.obs.filter(o => !o.listo);
    if (Math.floor(this.dist * 2) > (this.ult || 0)) { this.ult = Math.floor(this.dist * 2); api.sumar(1); }
  },
  draw(c) {
    c.strokeStyle = "#00000012"; c.lineWidth = 4; c.setLineDash([16, 24]);
    c.beginPath(); c.moveTo(E.W / 2, -40 + this.linea); c.lineTo(E.W / 2, E.H); c.stroke(); c.setLineDash([]);
    c.font = "26px serif"; c.textAlign = "center"; c.textBaseline = "middle";
    for (const o of this.obs) c.fillText(o.bueno ? "❤️" : "🪨", o.x, o.y);
    c.font = "32px serif"; c.fillText("🏃‍♀️", this.x, E.H - 70);
  },
});

/* 8 ── Dulces 2048 ───────────────────────────────────────── */
JUEGOS.push({
  id: "dulces", nombre: "Junta Dulces", emoji: "🍭", tipo: "dom", tiempo: null, factor: 0.015,
  color: "#ffe5f0", desc: "Une los iguales", fondo: "linear-gradient(#fff7fb,#ffeaf4)", medio: "🍭",
  ayuda: "Desliza para juntar dulces iguales 🍬+🍬=🍭<br>Se acaba cuando no quedan movimientos",
  init() {
    this.esc = ["🍬", "🍭", "🍪", "🍩", "🧁", "🍦", "🍰", "👑"];
    this.g = Array(16).fill(-1);
    E.dom.innerHTML = `<div style="width:100%"><div class="g2048" id="tab"></div><p class="pista">Desliza en cualquier dirección 👆</p></div>`;
    this.nuevo(); this.nuevo(); this.pintar();
    api.hud("🍬 0", "🍭", "🏆 " + S.leer("rec-dulces", 0));
  },
  nuevo() {
    const libres = this.g.map((v, i) => v < 0 ? i : -1).filter(i => i >= 0);
    if (!libres.length) return false;
    const i = libres[Math.floor(Math.random() * libres.length)];
    this.g[i] = Math.random() < .85 ? 0 : 1; this.nv = i;
    return true;
  },
  pintar() {
    const t = E.dom.querySelector("#tab"); if (!t) return;
    t.innerHTML = "";
    this.g.forEach((v, i) => {
      const d = document.createElement("div");
      d.className = "cl" + (i === this.nv ? " nv" : "");
      d.textContent = v < 0 ? "" : this.esc[Math.min(v, 7)];
      if (v >= 0) d.style.background = `hsl(${330 - v * 26} 90% ${94 - v * 4}%)`;
      t.appendChild(d);
    });
  },
  deslizar(dir) {
    if (!E.corriendo) return;
    const antes = this.g.join();
    const idx = (f, c) => f * 4 + c;
    const lineas = [];
    for (let i = 0; i < 4; i++) {
      let l = [];
      for (let j = 0; j < 4; j++) {
        l.push(dir === "izq" ? idx(i, j) : dir === "der" ? idx(i, 3 - j) : dir === "arriba" ? idx(j, i) : idx(3 - j, i));
      }
      lineas.push(l);
    }
    for (const l of lineas) {
      let v = l.map(i => this.g[i]).filter(x => x >= 0);
      const ya = [];                      // cada dulce se junta una sola vez por movimiento
      for (let k = 0; k < v.length - 1; k++) {
        if (v[k] === v[k + 1] && !ya.includes(k)) {
          v[k]++; v.splice(k + 1, 1); ya.push(k);
          api.sumar((v[k] + 1) * 6); api.tono(420 + v[k] * 60, .07); api.vibrar(15);
          if (v[k] === 7) { api.chispas(E.W / 2, E.H / 2, "#e0a92b", 24); api.sumar(60); }
        }
      }
      while (v.length < 4) v.push(-1);
      l.forEach((i, k) => this.g[i] = v[k]);
    }
    if (this.g.join() !== antes) { this.nuevo(); this.pintar(); }
    else if (!this.hayMovidas()) { api.tono(120, .3, "sawtooth"); setTimeout(() => api.fin(), 300); }
  },
  hayMovidas() {
    if (this.g.includes(-1)) return true;
    for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) {
      const v = this.g[f * 4 + c];
      if (c < 3 && v === this.g[f * 4 + c + 1]) return true;
      if (f < 3 && v === this.g[(f + 1) * 4 + c]) return true;
    }
    return false;
  },
});

/* 9 ── Encuentra el distinto ─────────────────────────────── */
JUEGOS.push({
  id: "distinto", nombre: "El Distinto", emoji: "🔍", tipo: "dom", tiempo: 35, factor: 0.18,
  color: "#e4f7e8", desc: "Ojo rápido", fondo: "linear-gradient(#f6fff8,#e6f7ea)",
  ayuda: "Uno de los dulces es distinto a los demás 🔍<br>Tócalo antes de que se acabe el tiempo",
  init() { this.nivel = 0; this.ronda(); },
  ronda() {
    this.nivel++;
    const n = Math.min(2 + Math.floor(this.nivel / 1.5), 8);
    const total = n * n;
    const pares = [["🍬", "🍭"], ["🍪", "🍩"], ["🧁", "🍰"], ["🍓", "🍒"], ["🍏", "🍐"], ["⭐", "✨"], ["💛", "🧡"]];
    const [a, b] = pares[Math.floor(Math.random() * pares.length)];
    const pos = Math.floor(Math.random() * total);
    E.dom.innerHTML = `<div style="width:100%"><div class="rejilla" id="rej" style="grid-template-columns:repeat(${n},1fr)"></div><p class="pista">Nivel ${this.nivel} — busca el distinto 🔍</p></div>`;
    const r = E.dom.querySelector("#rej");
    for (let i = 0; i < total; i++) {
      const bt = document.createElement("button");
      bt.textContent = i === pos ? b : a;
      bt.style.fontSize = Math.max(14, 40 - n * 3) + "px";
      bt.onclick = () => this.elegir(i === pos, bt);
      r.appendChild(bt);
    }
  },
  elegir(ok, bt) {
    if (!E.corriendo) return;
    if (ok) {
      api.sumar(10 + this.nivel * 2); api.tono(700, .08); api.vibrar(20);
      const r = bt.getBoundingClientRect(), z = E.zona.getBoundingClientRect();
      api.chispas(r.left - z.left + r.width / 2, r.top - z.top + r.height / 2, "#8ed9a4", 12);
      this.ronda();
    } else {
      api.sumar(-5); api.tono(160, .14, "square"); api.vibrar(60);
      bt.classList.add("mal"); setTimeout(() => bt.classList.remove("mal"), 350);
      E.tiempo = Math.max(1, E.tiempo - 4);
    }
  },
});

/* 10 ── Rebota ───────────────────────────────────────────── */
JUEGOS.push({
  id: "rebota", nombre: "No Se Cae", emoji: "🎈", tipo: "canvas", tiempo: null, factor: 0.12,
  color: "#fff0d6", desc: "Que no toque el suelo", fondo: "linear-gradient(#fffbf2,#ffeedc)", medio: "🎈",
  ayuda: "Toca el globo para que no caiga 🎈<br>Cada toque suma, y cada vez va más rápido",
  init() {
    this.b = { x: E.W / 2, y: E.H * .35, vx: 60, vy: 0, r: 22 };
    this.toques = 0; this.g = 470;
  },
  update(dt) {
    const b = this.b;
    b.vy += this.g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * .9; }
    if (b.x > E.W - b.r) { b.x = E.W - b.r; b.vx = -Math.abs(b.vx) * .9; }
    if (b.y < b.r * .4) { b.y = b.r * .4; b.vy = Math.abs(b.vy) * .5; }   // techo blandito
    if (b.y > E.H + 60) { api.sacudir(10); api.tono(120, .3, "sawtooth"); api.vibrar(100); api.fin(); }
  },
  tocar(x, y, tipo) {
    if (tipo !== "abajo") return;
    const b = this.b;
    if (Math.hypot(b.x - x, b.y - y) < b.r + 30) {
      b.vy = -(350 + this.toques * 3);
      b.vx += (b.x - x) * 3.2;
      b.vx = Math.max(-260, Math.min(260, b.vx));
      this.toques++; this.g = 470 + this.toques * 14;
      api.sumar(this.toques % 10 === 0 ? 20 : 5, b.x, b.y - 20);
      api.chispas(b.x, b.y, "#ffb3c6", 9); api.tono(520 + this.toques * 10, .06); api.vibrar(12);
    }
  },
  draw(c) {
    const b = this.b;
    c.save(); c.translate(b.x, b.y); c.rotate(b.vx / 900);
    const g = c.createRadialGradient(-8, -10, 3, 0, 0, b.r);
    g.addColorStop(0, "#ffd0dd"); g.addColorStop(1, "#e8798f");
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, b.r * .86, b.r, 0, 0, 7); c.fill();
    c.strokeStyle = "#e8798f"; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(0, b.r); c.quadraticCurveTo(7, b.r + 16, -3, b.r + 30); c.stroke();
    c.fillStyle = "#ffffff99"; c.beginPath(); c.ellipse(-8, -9, 5, 7, -.4, 0, 7); c.fill();
    c.restore();
    c.fillStyle = "#00000010"; c.fillRect(0, E.H - 4, E.W, 4);
  },
});

/* ============================================================
   JUEGOS 11-13: Combina 3, Tetris Gomita y Pinball de Gomitas
   ============================================================ */
document.head.insertAdjacentHTML("beforeend", `<style>
  .tbar { position:absolute; left:8px; right:8px; bottom:8px; display:flex; gap:8px; z-index:4; }
  .tbar button { flex:1; height:52px; border:none; border-radius:16px; background:#ffffffe8; color:#3b2f4a; font-size:1.5rem;
                 box-shadow:0 4px 12px #0002; touch-action:none; user-select:none; -webkit-user-select:none; cursor:pointer; }
  .tbar button:active { background:#ffd6e2; transform:scale(.95); }
</style>`);

/* 11 ── Combina 3 ─────────────────────────────────────────── */
JUEGOS.push({
  id: "combina", nombre: "Combina 3", emoji: "🍭", tipo: "canvas", tiempo: 60, factor: 0.045,
  color: "#ffe0ec", desc: "Junta 3 dulces iguales", fondo: "linear-gradient(#fff7fb,#ffe9f3)",
  ayuda: "Toca un dulce y luego uno vecino (o deslízalo) para cambiarlos 🍬<br>Junta 3 o más iguales. ¡Las cascadas valen más!",
  TIPOS: ["🍬", "🍭", "🍪", "🍩", "🧁", "🍓"],
  init() {
    this.cols = 7; this.geom(); this.generar();
    this.sel = null; this.down = null; this.fase = "idle"; this.combo = 1; this.ocioT = 0; this.pista = null; this.t = 0;
  },
  geom() {
    this.cel = Math.floor(E.W / this.cols);
    this.rows = Math.max(5, Math.floor((E.H - 10) / this.cel));
    this.ox = (E.W - this.cols * this.cel) / 2;
    this.oy = (E.H - this.rows * this.cel) / 2;
  },
  resize() {
    const f = this.rows; this.geom();
    if (f !== this.rows) { this.generar(); this.fase = "idle"; this.sel = null; return; }
    this.g.forEach(x => { if (x) { x.x = this.px(x.c); x.y = this.py(x.r); x.cae = false; x.vy = 0; } });
  },
  px(c) { return this.ox + c * this.cel + this.cel / 2; },
  py(r) { return this.oy + r * this.cel + this.cel / 2; },
  celda(r, c, k, filaVisual) { return { k, r, c, x: this.px(c), y: this.py(filaVisual != null ? filaVisual : r), vy: 0, esc: 1, muere: false, cae: false }; },
  kEn(r, c) { const x = this.g[r * this.cols + c]; return x ? x.k : -1; },
  generar() {
    this.g = new Array(this.rows * this.cols).fill(null);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      let k, n = 0;
      do { k = Math.floor(Math.random() * this.TIPOS.length); n++; }
      while (n < 40 && ((c >= 2 && this.kEn(r, c - 1) === k && this.kEn(r, c - 2) === k) || (r >= 2 && this.kEn(r - 1, c) === k && this.kEn(r - 2, c) === k)));
      this.g[r * this.cols + c] = this.celda(r, c, k);
    }
    if (!this.buscarMov()) this.generar();
  },
  matriz() { const m = []; for (let r = 0; r < this.rows; r++) { m.push([]); for (let c = 0; c < this.cols; c++) m[r].push(this.kEn(r, c)); } return m; },
  linea(m, r, c) {
    const k = m[r][c]; if (k < 0) return false;
    let h = 1, i = c - 1; while (i >= 0 && m[r][i] === k) { h++; i--; }
    i = c + 1; while (i < this.cols && m[r][i] === k) { h++; i++; }
    if (h >= 3) return true;
    let v = 1; i = r - 1; while (i >= 0 && m[i][c] === k) { v++; i--; }
    i = r + 1; while (i < this.rows && m[i][c] === k) { v++; i++; }
    return v >= 3;
  },
  buscarMov() {
    const m = this.matriz(), C = this.cols;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const r2 = r + dr, c2 = c + dc; if (r2 >= this.rows || c2 >= C) continue;
      [m[r][c], m[r2][c2]] = [m[r2][c2], m[r][c]];
      const ok = this.linea(m, r, c) || this.linea(m, r2, c2);
      [m[r][c], m[r2][c2]] = [m[r2][c2], m[r][c]];
      if (ok) return [this.g[r * C + c], this.g[r2 * C + c2]];
    }
    return null;
  },
  hallar() {
    const R = this.rows, C = this.cols, runs = [];
    const get = (r, c) => { const x = this.g[r * C + c]; return x && !x.muere ? x.k : -1; };
    for (let r = 0; r < R; r++) { let c = 0; while (c < C) { const k = get(r, c); let n = 1; while (k >= 0 && c + n < C && get(r, c + n) === k) n++; if (k >= 0 && n >= 3) runs.push(Array.from({ length: n }, (_, i) => r * C + c + i)); c += n; } }
    for (let c = 0; c < C; c++) { let r = 0; while (r < R) { const k = get(r, c); let n = 1; while (k >= 0 && r + n < R && get(r + n, c) === k) n++; if (k >= 0 && n >= 3) runs.push(Array.from({ length: n }, (_, i) => (r + i) * C + c)); r += n; } }
    return runs;
  },
  intercambiar(a, b, volver) {
    const C = this.cols, ia = a.r * C + a.c, ib = b.r * C + b.c;
    this.g[ia] = b; this.g[ib] = a;
    [a.r, b.r] = [b.r, a.r]; [a.c, b.c] = [b.c, a.c];
    this.fase = volver ? "volviendo" : "cambio"; this.par = [a, b]; this.sel = null; this.down = null; this.pista = null; this.ocioT = 0;
    api.tono(volver ? 220 : 480, .05);
  },
  limpiar(runs) {
    const set = new Set(); let pts = 0;
    runs.forEach(run => { pts += run.length === 3 ? 15 : run.length === 4 ? 35 : 60; run.forEach(i => set.add(i)); });
    pts *= this.combo;
    set.forEach(i => { const x = this.g[i]; x.muere = true; api.chispas(x.x, x.y, "#f7a1b5", 7); });
    const mitad = this.g[runs[0][Math.floor(runs[0].length / 2)]];
    api.sumar(pts, mitad.x, mitad.y);
    if (this.combo > 1) api.flota(E.W / 2, this.oy + 36, `¡Cascada x${this.combo}!`, "#e0a92b");
    api.tono(520 + this.combo * 90, .09); api.vibrar(12);
    this.fase = "limpiando";
  },
  caer() {
    const R = this.rows, C = this.cols;
    for (let c = 0; c < C; c++) {
      let w = R - 1;
      for (let r = R - 1; r >= 0; r--) {
        const x = this.g[r * C + c];
        if (x && !x.muere) { if (w !== r) { this.g[w * C + c] = x; this.g[r * C + c] = null; x.r = w; x.cae = true; } w--; }
        else if (x) this.g[r * C + c] = null;
      }
      let n = 0;
      for (let r = w; r >= 0; r--) {
        const x = this.celda(r, c, Math.floor(Math.random() * this.TIPOS.length), -(++n));
        x.cae = true; this.g[r * C + c] = x;
      }
    }
    this.fase = "cayendo";
  },
  update(dt) {
    this.t += dt;
    const ease = 1 - Math.exp(-dt * 16);
    let quieto = true;
    for (const x of this.g) {
      if (!x) continue;
      const tx = this.px(x.c), ty = this.py(x.r);
      if (x.cae) {
        x.vy += 2600 * dt; x.y += x.vy * dt; x.x = tx;
        if (x.y >= ty) { x.y = ty; x.vy = 0; x.cae = false; } else quieto = false;
      } else {
        x.x += (tx - x.x) * ease; x.y += (ty - x.y) * ease;
        if (Math.abs(tx - x.x) > .6 || Math.abs(ty - x.y) > .6) quieto = false; else { x.x = tx; x.y = ty; }
      }
      if (x.muere) { x.esc -= dt * 6; if (x.esc > 0) quieto = false; else x.esc = 0; }
    }
    if (!quieto) return;
    if (this.fase === "cambio") {
      const runs = this.hallar();
      if (runs.length) { this.combo = 1; this.limpiar(runs); } else { this.intercambiar(this.par[0], this.par[1], true); api.vibrar(20); }
    } else if (this.fase === "volviendo") { this.fase = "idle"; }
    else if (this.fase === "limpiando") { this.caer(); }
    else if (this.fase === "cayendo") {
      const runs = this.hallar();
      if (runs.length) { this.combo++; this.limpiar(runs); }
      else {
        this.combo = 1; this.fase = "idle";
        if (!this.buscarMov()) { api.flota(E.W / 2, E.H / 2, "¡Mezclando!", "#7a5bbd"); this.generar(); }
      }
    } else {
      this.ocioT += dt;
      if (this.ocioT > 5 && !this.pista) this.pista = this.buscarMov();
    }
  },
  celdaEn(x, y) {
    const c = Math.floor((x - this.ox) / this.cel), r = Math.floor((y - this.oy) / this.cel);
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return null;
    return this.g[r * this.cols + c];
  },
  tocar(x, y, tipo) {
    if (tipo !== "abajo" || this.fase !== "idle") return;
    const c = this.celdaEn(x, y); if (!c) return;
    this.ocioT = 0; this.pista = null;
    if (this.sel && this.sel !== c && Math.abs(this.sel.r - c.r) + Math.abs(this.sel.c - c.c) === 1) { const s = this.sel; this.intercambiar(s, c); }
    else { this.sel = c; this.down = c; }
  },
  deslizar(dir) {
    if (!this.down || this.fase !== "idle") return;
    const d = { izq: [0, -1], der: [0, 1], arriba: [-1, 0], abajo: [1, 0] }[dir];
    const r = this.down.r + d[0], c = this.down.c + d[1];
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return;
    const nb = this.g[r * this.cols + c]; if (!nb) return;
    this.intercambiar(this.down, nb);
  },
  draw(c) {
    const cel = this.cel;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "rgba(255,255,255,.55)";
    for (let r = 0; r < this.rows; r++) for (let k = 0; k < this.cols; k++) { c.beginPath(); c.roundRect(this.ox + k * cel + 2, this.oy + r * cel + 2, cel - 4, cel - 4, 10); c.fill(); }
    if (this.pista) {
      const a = .35 + .35 * Math.sin(this.t * 6);
      c.strokeStyle = `rgba(224,169,43,${a})`; c.lineWidth = 4;
      this.pista.forEach(x => { c.beginPath(); c.roundRect(this.ox + x.c * cel + 3, this.oy + x.r * cel + 3, cel - 6, cel - 6, 10); c.stroke(); });
    }
    for (const x of this.g) {
      if (!x) continue;
      c.save(); c.translate(x.x, x.y);
      const s = x.esc * (this.sel === x ? 1.14 : 1); c.scale(s, s);
      c.font = `${Math.round(cel * .62)}px serif`; c.fillText(this.TIPOS[x.k], 0, 2);
      c.restore();
    }
    if (this.sel) { c.strokeStyle = "#e8798f"; c.lineWidth = 4; c.beginPath(); c.roundRect(this.ox + this.sel.c * cel + 3, this.oy + this.sel.r * cel + 3, cel - 6, cel - 6, 10); c.stroke(); }
  },
});

/* 12 ── Tetris Gomita ─────────────────────────────────────── */
JUEGOS.push({
  id: "tetris", nombre: "Tetris Gomita", emoji: "🍡", tipo: "canvas", tiempo: null, factor: 0.1,
  color: "#e5eaff", desc: "Piezas de gomita", fondo: "linear-gradient(#f6f8ff,#e6ebff)", medio: "🍡",
  ayuda: "Mueve y gira las piezas con los botones o deslizando 🍡<br>Completa filas para que desaparezcan. Cada vez cae más rápido",
  PIEZAS: [
    { m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], c: ["#a6e6ff", "#4bb6e8"] },
    { m: [[1, 1], [1, 1]], c: ["#ffe58f", "#f2b705"] },
    { m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], c: ["#e0bfff", "#9a5fe0"] },
    { m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], c: ["#bdf5b6", "#4fc25a"] },
    { m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], c: ["#ffbcbc", "#e5545a"] },
    { m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], c: ["#b3c4ff", "#4d6fe0"] },
    { m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], c: ["#ffd6ab", "#f0873a"] },
  ],
  init() {
    this.cols = 10; this.rows = 18; this.geom();
    this.b = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    this.bolsa = []; this.sig = null; this.lineas = 0; this.nivel = 0; this.t = 0; this.bloq = 0; this.fin = false; this.activo = false; this.hubo = false;
    this.nueva();
    // botones táctiles
    const bar = document.createElement("div"); bar.className = "tbar";
    const defs = [["◀", () => this.mover(-1), true], ["⟳", () => this.girar(), false], ["▶", () => this.mover(1), true], ["⏬", () => this.caerDuro(), false]];
    defs.forEach(([txt, fn, rep]) => {
      const b = document.createElement("button"); b.textContent = txt; b.setAttribute("aria-label", txt);
      let t1 = null, t2 = null;
      const parar = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
      b.addEventListener("pointerdown", e => {
        e.preventDefault(); e.stopPropagation();
        if (!E.corriendo || E.pausa) return;
        fn();
        if (rep) { parar(); t1 = luego(() => { t2 = cadaTanto(() => { if (E.corriendo && !E.pausa) fn(); }, 75); }, 200); }
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, parar));
      bar.appendChild(b);
    });
    E.zona.appendChild(bar); this.bar = bar;
  },
  destroy() { if (this.bar) { this.bar.remove(); this.bar = null; } },
  geom() {
    this.cel = Math.max(12, Math.floor(Math.min((E.H - 92) / this.rows, (E.W - 118) / this.cols)));
    this.ox = 8; this.oy = 8;
  },
  resize() { this.geom(); },
  sacar() {
    if (!this.bolsa.length) { this.bolsa = [0, 1, 2, 3, 4, 5, 6]; for (let i = 6; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.bolsa[i], this.bolsa[j]] = [this.bolsa[j], this.bolsa[i]]; } }
    return this.bolsa.pop();
  },
  nueva() {
    const k = this.sig != null ? this.sig : this.sacar();
    this.sig = this.sacar();
    const m = this.PIEZAS[k].m.map(f => f.slice());
    this.p = { k, m, x: Math.floor((this.cols - m[0].length) / 2), y: m[0].every(v => !v) ? -1 : 0 };
    this.t = 0; this.bloq = 0;
    if (this.choca(this.p.m, this.p.x, this.p.y)) { this.fin = true; api.sacudir(10); api.tono(120, .3, "sawtooth"); api.vibrar(100); api.fin(); }
  },
  rot(m) { const n = m.length, r = []; for (let i = 0; i < n; i++) { r.push([]); for (let j = 0; j < n; j++) r[i].push(m[n - 1 - j][i]); } return r; },
  choca(m, x, y) {
    for (let i = 0; i < m.length; i++) for (let j = 0; j < m[i].length; j++) if (m[i][j]) {
      const bx = x + j, by = y + i;
      if (bx < 0 || bx >= this.cols || by >= this.rows) return true;
      if (by >= 0 && this.b[by][bx]) return true;
    }
    return false;
  },
  mover(dx) { if (this.fin) return; if (!this.choca(this.p.m, this.p.x + dx, this.p.y)) { this.p.x += dx; this.bloq = 0; api.tono(300, .02, "triangle"); } },
  girar() {
    if (this.fin) return;
    const m = this.rot(this.p.m);
    for (const dx of [0, -1, 1, -2, 2]) if (!this.choca(m, this.p.x + dx, this.p.y)) { this.p.m = m; this.p.x += dx; this.bloq = 0; api.tono(430, .03); return; }
  },
  bajar() { if (!this.choca(this.p.m, this.p.x, this.p.y + 1)) { this.p.y++; return true; } return false; },
  caerDuro() { if (this.fin) return; let n = 0; while (this.bajar()) n++; if (n) api.vibrar(10); this.fijar(); },
  fijar() {
    const { m, x, y, k } = this.p;
    for (let i = 0; i < m.length; i++) for (let j = 0; j < m[i].length; j++) if (m[i][j]) {
      const by = y + i;
      if (by < 0) { this.fin = true; api.fin(); return; }
      this.b[by][x + j] = k + 1;
    }
    api.tono(220, .04, "triangle");
    let n = 0;
    for (let r = this.rows - 1; r >= 0; r--) {
      if (this.b[r].every(v => v)) {
        for (let c = 0; c < this.cols; c++) api.chispas(this.ox + c * this.cel + this.cel / 2, this.oy + r * this.cel + this.cel / 2, this.PIEZAS[this.b[r][c] - 1].c[1], 2);
        this.b.splice(r, 1); this.b.unshift(Array(this.cols).fill(0)); n++; r++;
      }
    }
    let pts = 1;
    if (n) {
      pts += [0, 10, 30, 60, 100][n] * (1 + this.nivel * .15);
      this.lineas += n; this.nivel = Math.floor(this.lineas / 8);
      api.tono(520 + n * 120, .12); api.vibrar(n * 14); if (n === 4) { api.sacudir(8); api.flota(E.W / 2, E.H / 2, "¡TETRIS!", "#e0a92b"); }
    }
    api.sumar(Math.round(pts), n ? E.W / 2 : undefined, n ? E.H / 2 : undefined);
    this.nueva();
  },
  update(dt) {
    if (this.fin) return;
    api.hud(undefined, `Nv ${this.nivel + 1} · ${this.lineas} filas`);
    this.t += dt;
    const inter = Math.max(.06, .68 * Math.pow(.8, this.nivel));
    while (this.t >= inter && !this.fin) {
      this.t -= inter;
      if (this.bajar()) this.bloq = 0;
      else { this.bloq += inter; if (this.bloq >= .45) { this.fijar(); break; } }
    }
  },
  tocar(x, y, tipo) {
    if (tipo === "abajo") { this.activo = true; this.hubo = false; this.x0 = x; this.y0 = y; }
    else if (tipo === "arriba" && this.activo) {
      this.activo = false;
      if (!this.hubo && Math.hypot(x - this.x0, y - this.y0) < 14) this.girar();
    }
  },
  deslizar(dir) {
    this.hubo = true;
    if (dir === "izq") this.mover(-1); else if (dir === "der") this.mover(1);
    else if (dir === "arriba") this.girar(); else if (dir === "abajo") this.caerDuro();
  },
  gomita(c, x, y, s, col, a) {
    c.globalAlpha = a == null ? 1 : a;
    const g = c.createLinearGradient(x, y, x, y + s); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    c.fillStyle = g; c.beginPath(); c.roundRect(x + 1, y + 1, s - 2, s - 2, s * .3); c.fill();
    c.fillStyle = "rgba(255,255,255,.6)"; c.beginPath(); c.ellipse(x + s * .34, y + s * .3, s * .16, s * .09, -.5, 0, 7); c.fill();
    c.globalAlpha = 1;
  },
  draw(c) {
    const cel = this.cel, ox = this.ox, oy = this.oy, W = this.cols * cel, H = this.rows * cel;
    c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.roundRect(ox - 4, oy - 4, W + 8, H + 8, 12); c.fill();
    c.fillStyle = "rgba(122,107,138,.10)";
    for (let r = 0; r < this.rows; r++) for (let k = 0; k < this.cols; k++) c.fillRect(ox + k * cel + cel / 2 - 1, oy + r * cel + cel / 2 - 1, 2, 2);
    for (let r = 0; r < this.rows; r++) for (let k = 0; k < this.cols; k++) if (this.b[r][k]) this.gomita(c, ox + k * cel, oy + r * cel, cel, this.PIEZAS[this.b[r][k] - 1].c);
    if (this.p && !this.fin) {
      let gy = this.p.y; while (!this.choca(this.p.m, this.p.x, gy + 1)) gy++;
      const col = this.PIEZAS[this.p.k].c;
      this.p.m.forEach((fila, i) => fila.forEach((v, j) => {
        if (!v) return;
        if (gy !== this.p.y && gy + i >= 0) this.gomita(c, ox + (this.p.x + j) * cel, oy + (gy + i) * cel, cel, col, .22);
      }));
      this.p.m.forEach((fila, i) => fila.forEach((v, j) => { if (v && this.p.y + i >= 0) this.gomita(c, ox + (this.p.x + j) * cel, oy + (this.p.y + i) * cel, cel, col); }));
    }
    // panel lateral
    const px = ox + W + 16, pw = E.W - px - 8;
    c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.fillStyle = "#7a6b8a"; c.font = "900 12px Nunito, sans-serif"; c.fillText("SIGUIENTE", px + pw / 2, oy + 14);
    c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.roundRect(px, oy + 22, pw, pw * .8, 12); c.fill();
    if (this.sig != null) {
      const m = this.PIEZAS[this.sig].m, s = Math.min(22, Math.floor(pw / 5)), n = m.length;
      const ancho = n * s, x0 = px + (pw - ancho) / 2, y0 = oy + 22 + (pw * .8 - n * s) / 2 - (this.sig === 0 ? s * .5 : 0);
      m.forEach((fila, i) => fila.forEach((v, j) => { if (v) this.gomita(c, x0 + j * s, y0 + i * s, s, this.PIEZAS[this.sig].c); }));
    }
    c.fillStyle = "#7a6b8a"; c.font = "900 12px Nunito, sans-serif"; c.fillText("FILAS", px + pw / 2, oy + pw * .8 + 62);
    c.fillStyle = "#3b2f4a"; c.font = "900 30px Nunito, sans-serif"; c.fillText(String(this.lineas), px + pw / 2, oy + pw * .8 + 94);
    c.fillStyle = "#7a6b8a"; c.font = "900 12px Nunito, sans-serif"; c.fillText("NIVEL", px + pw / 2, oy + pw * .8 + 128);
    c.fillStyle = "#3b2f4a"; c.font = "900 30px Nunito, sans-serif"; c.fillText(String(this.nivel + 1), px + pw / 2, oy + pw * .8 + 160);
  },
});

/* 13 ── Pinball de Gomitas ────────────────────────────────── */
JUEGOS.push({
  id: "pinball", nombre: "Pinball de Gomitas", emoji: "🎱", tipo: "canvas", tiempo: null, factor: 0.1,
  color: "#eadfff", desc: "Que no se caiga la bolita", fondo: "linear-gradient(#faf5ff,#ebe0ff)", medio: "🎱",
  ayuda: "Toca la mitad izquierda o derecha para mover cada paleta 🎱<br>Golpea los dulces para sumar. ¡Tienes 3 bolitas!",
  BUMP: ["🍬", "🍭", "🍩", "🍪"],
  init() {
    this.geom(); this.vidas = 3; this.combo = 0; this.comboT = 0; this.t = 0; this.espera = 0; this.hudV = -1; this.ptrs = new Map(); this.ball = null;
    this.lanzar();
    const z = E.zona;
    this._d = e => { if (!E.corriendo || E.pausa) return; const r = z.getBoundingClientRect(); this.ptrs.set(e.pointerId, e.clientX - r.left < E.W / 2 ? "izq" : "der"); this.sync(); };
    this._u = e => { if (this.ptrs.delete(e.pointerId)) this.sync(); };
    z.addEventListener("pointerdown", this._d); addEventListener("pointerup", this._u); addEventListener("pointercancel", this._u);
  },
  destroy() {
    if (this._d) { E.zona.removeEventListener("pointerdown", this._d); removeEventListener("pointerup", this._u); removeEventListener("pointercancel", this._u); this._d = null; }
  },
  sync() { const l = new Set(this.ptrs.values()); this.fl.izq.activo = l.has("izq"); this.fl.der.activo = l.has("der"); },
  geom() {
    const W = E.W, H = E.H, prev = this.fl;
    this.r = Math.max(7, W * .024);
    const py = H - Math.max(60, H * .13);
    this.fl = {
      izq: { s: 1, px: W * .27, py, L: W * .2, ang: .5, w: 0, activo: prev ? prev.izq.activo : false },
      der: { s: -1, px: W * .73, py, L: W * .2, ang: .5, w: 0, activo: prev ? prev.der.activo : false },
    };
    this.gI = [0, py - H * .2, this.fl.izq.px, py];
    this.gD = [W, py - H * .2, this.fl.der.px, py];
    const R = Math.max(18, W * .062);
    this.bump = [
      { x: W * .27, y: H * .27, r: R, p: 0 }, { x: W * .73, y: H * .27, r: R, p: 0 },
      { x: W * .5, y: H * .15, r: R, p: 0 }, { x: W * .5, y: H * .39, r: R, p: 0 },
    ];
  },
  resize() { this.geom(); if (this.ball) { this.ball.x = Math.min(E.W - this.r, this.ball.x); this.ball.y = Math.min(E.H - this.r, this.ball.y); } },
  lanzar() { this.ball = { x: E.W * (.3 + Math.random() * .4), y: this.r + 6, vx: (Math.random() - .5) * 180, vy: 90 }; },
  punta(f) { return { x: f.px + f.s * f.L * Math.cos(f.ang), y: f.py + f.L * Math.sin(f.ang) }; },
  moverPaletas(dt) {
    for (const f of [this.fl.izq, this.fl.der]) {
      const obj = f.activo ? -.5 : .5, d = obj - f.ang;
      const paso = Math.sign(d) * Math.min(Math.abs(d), 24 * dt);
      f.ang += paso; f.w = dt > 0 ? paso / dt : 0;
    }
  },
  update(dt) {
    this.t += dt; this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    if (this.hudV !== this.vidas) { this.hudV = this.vidas; api.hud(undefined, "🎱 ×" + this.vidas); }
    this.bump.forEach(u => { u.p = Math.max(0, u.p - dt * 4); });
    this.moverPaletas(dt);
    if (!this.ball) { this.espera -= dt; if (this.espera <= 0) this.lanzar(); return; }
    const n = 4, h = dt / n;
    for (let i = 0; i < n && this.ball; i++) this.paso(h);
    if (this.ball) {
      const b = this.ball;
      this.quietoT = Math.hypot(b.vx, b.vy) < 30 ? (this.quietoT || 0) + dt : 0;
      if (this.quietoT > 1.2) {
        this.quietoT = 0; b.vy = -460; b.vx = (Math.random() < .5 ? -1 : 1) * (80 + Math.random() * 90);
        api.flota(b.x, Math.max(30, b.y - 30), "¡Empujón!", "#7a5bbd"); api.tono(330, .08);
      }
    }
  },
  seg(b, ax, ay, bx, by, rad, e, f) {
    const r = this.r, abx = bx - ax, aby = by - ay, l2 = abx * abx + aby * aby;
    let t = ((b.x - ax) * abx + (b.y - ay) * aby) / l2; t = Math.max(0, Math.min(1, t));
    const cx = ax + abx * t, cy = ay + aby * t, dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), m = r + rad;
    if (d >= m || d === 0) return false;
    const nx = dx / d, ny = dy / d; b.x = cx + nx * m; b.y = cy + ny * m;
    let sx = 0, sy = 0;
    if (f) { const dist = Math.hypot(cx - f.px, cy - f.py); sx = dist * f.w * (-f.s * Math.sin(f.ang)); sy = dist * f.w * Math.cos(f.ang); }
    const rvx = b.vx - sx, rvy = b.vy - sy, vn = rvx * nx + rvy * ny;
    if (vn < 0) { b.vx = rvx - (1 + e) * vn * nx + sx; b.vy = rvy - (1 + e) * vn * ny + sy; }
    return true;
  },
  paso(h) {
    const b = this.ball, W = E.W, H = E.H, r = this.r;
    b.vy += 780 * h; b.x += b.vx * h; b.y += b.vy * h;
    const sp = Math.hypot(b.vx, b.vy); if (sp > 1000) { b.vx *= 1000 / sp; b.vy *= 1000 / sp; }
    if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * .85; }
    if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx) * .85; }
    if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy) * .85; }
    this.bump.forEach((u, i) => {
      const dx = b.x - u.x, dy = b.y - u.y, d = Math.hypot(dx, dy), m = r + u.r;
      if (d < m && d > 0) {
        const nx = dx / d, ny = dy / d; b.x = u.x + nx * m; b.y = u.y + ny * m;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= 2.15 * vn * nx; b.vy -= 2.15 * vn * ny; }
        const s = Math.hypot(b.vx, b.vy); if (s < 380) { b.vx *= 380 / s; b.vy *= 380 / s; }
        this.golpe(u, i);
      }
    });
    this.seg(b, this.gI[0], this.gI[1], this.gI[2], this.gI[3], 6, .4, null);
    this.seg(b, this.gD[0], this.gD[1], this.gD[2], this.gD[3], 6, .4, null);
    for (const f of [this.fl.izq, this.fl.der]) { const p = this.punta(f); this.seg(b, f.px, f.py, p.x, p.y, 6, .35, f); }
    if (b.y > H + r * 2) this.perdio();
  },
  golpe(u, i) {
    this.combo = Math.min(5, this.combo + 1); this.comboT = 2.2; u.p = 1;
    api.sumar(5 * this.combo, u.x, u.y - u.r);
    api.chispas(u.x, u.y, "#c9a0ff", 9); api.tono(480 + this.combo * 60, .06); api.vibrar(8);
  },
  perdio() {
    this.ball = null; this.vidas--; api.sacudir(8); api.tono(160, .2, "sawtooth"); api.vibrar(60);
    if (this.vidas <= 0) { api.fin(); return; }
    this.espera = .9;
  },
  draw(c) {
    const W = E.W;
    c.lineCap = "round";
    c.strokeStyle = "#c9a0ff"; c.lineWidth = 12;
    [this.gI, this.gD].forEach(g => { c.beginPath(); c.moveTo(g[0], g[1]); c.lineTo(g[2], g[3]); c.stroke(); });
    c.textAlign = "center"; c.textBaseline = "middle";
    this.bump.forEach((u, i) => {
      const k = 1 + u.p * .18;
      const g = c.createRadialGradient(u.x - u.r * .3, u.y - u.r * .3, 2, u.x, u.y, u.r * k);
      g.addColorStop(0, "#ffffff"); g.addColorStop(1, u.p > 0 ? "#ffd1e8" : "#e0c3fc");
      c.fillStyle = g; c.beginPath(); c.arc(u.x, u.y, u.r * k, 0, 7); c.fill();
      c.strokeStyle = "#b690ee"; c.lineWidth = 3; c.stroke();
      c.font = `${Math.round(u.r * 1.15 * k)}px serif`; c.fillText(this.BUMP[i], u.x, u.y + 2);
    });
    for (const f of [this.fl.izq, this.fl.der]) {
      const p = this.punta(f);
      c.strokeStyle = "#e8798f"; c.lineWidth = 14; c.beginPath(); c.moveTo(f.px, f.py); c.lineTo(p.x, p.y); c.stroke();
      c.fillStyle = "#fff"; c.beginPath(); c.arc(f.px, f.py, 4, 0, 7); c.fill();
    }
    if (this.ball) {
      const b = this.ball, g = c.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, this.r);
      g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#9aa3b8");
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, this.r, 0, 7); c.fill();
    }
    if (this.t < 5) {
      c.globalAlpha = Math.max(0, Math.min(1, 5 - this.t));
      c.fillStyle = "#7a6b8a"; c.font = "800 15px Nunito, sans-serif";
      c.fillText("👈 toca el lado izquierdo · el derecho 👉", W / 2, E.H * .56);
      c.globalAlpha = 1;
    }
  },
});


/* ============================================================
   HUB
   ============================================================ */
function pintarFichas() {
  document.getElementById("chipFichas").textContent = fichasDisponibles();
}
function pintarHub() {
  pintarFichas();
  const falta = puntosQueFaltan(), tiene = fichasDisponibles() > 0;
  const actual = tiene ? META : Math.max(0, META - falta);
  document.getElementById("progTxt").textContent = tiene ? "¡Ficha lista!" : (falta > META ? `faltan ${falta}` : `${actual} / ${META}`);
  document.getElementById("progBar").style.width = (actual / META * 100) + "%";
  const g = document.getElementById("grid"); g.innerHTML = "";
  JUEGOS.forEach(j => {
    const b = document.createElement("button");
    b.className = "game"; b.style.background = j.color;
    const rec = S.leer("rec-" + j.id, 0);
    b.innerHTML = `<span class="em">${j.emoji}</span><b></b><small></small>${rec ? `<span class="rec">🏆 ${rec}</span>` : ""}`;
    b.querySelector("b").textContent = j.nombre;
    b.querySelector("small").textContent = j.desc;
    b.onclick = () => jugar(j.id);
    g.appendChild(b);
  });
}
pintarHub();
