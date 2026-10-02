/* ============================================================
   SALA DE JUEGOS — motor común + 10 juegos
   ✏️ PERSONALIZA: META (puntos por ficha) y CANAL (ntfy)
   ============================================================ */
const META = 150;
const CANAL = "animo-644cea567218";

/* ---------- Guardado ---------- */
const S = {
  leer(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const fichasDisponibles = () =>
  Math.floor(S.leer("juego-puntos", 0) / META) + S.leer("fichas-extra", 0) - S.leer("fichas-usadas", 0);

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
  if (E.juego && E.juego.resize) E.juego.resize(E.W, E.H);
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
}, { passive: false });
addEventListener("pointerup", e => {
  if (!E.corriendo || E.pausa) return;
  E.puntero.abajo = false;
  const c = coords(e);
  E.juego && E.juego.tocar && E.juego.tocar(c.x, c.y, "arriba");
  if (ini && E.juego && E.juego.deslizar) {
    const dx = c.x - ini.x, dy = c.y - ini.y;
    if (Math.hypot(dx, dy) > 26 && Date.now() - ini.t < 700)
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
  const puntos = Math.round(E.score * (E.juego.factor || 1));
  const rec = S.leer("rec-" + E.juego.id, 0);
  const nuevoRec = E.score > rec;
  if (nuevoRec) S.escribir("rec-" + E.juego.id, E.score);
  document.getElementById("hudDer").textContent = "🏆 " + S.leer("rec-" + E.juego.id, 0);
  const antes = fichasDisponibles();
  const total = S.leer("juego-puntos", 0) + puntos;
  S.escribir("juego-puntos", total);
  const ahora = Math.floor(total / META) + S.leer("fichas-extra", 0) - S.leer("fichas-usadas", 0);
  const ganadas = ahora - antes;
  pintarFichas();

  const falta = META - (total % META);
  const botones = [{ txt: "Otra vez", cls: "btn", fn: arrancar }, { txt: "Otros juegos", cls: "btn alt", fn: volverHub }];
  if (ahora > 0) botones.unshift({ txt: "🎡 Girar la ruleta", cls: "btn oro", href: "ruleta.html" });

  ovMostrar(
    ganadas > 0 ? "¡Ganaste una ficha! 🎟️" : nuevoRec ? "¡Nuevo récord! 🏆" : "Se acabó",
    `<span class="pts">${puntos}<small>PUNTOS</small></span>` +
    (ganadas > 0
      ? `Tienes <b>${ahora}</b> giro${ahora === 1 ? "" : "s"} de ruleta esperándote 🎡`
      : `Llevas <b>${total}</b> puntos en total.<br>Te faltan <b>${falta}</b> para la próxima ficha 🎟️`),
    botones);
  if (ganadas > 0) {
    confeti();
    fetch("https://ntfy.sh/" + CANAL, {
      method: "POST", body: `🎮 Desbloqueó un giro jugando ${E.juego.nombre} (${puntos} puntos)`,
      headers: { "Title": "Gano una ficha", "Tags": "video_game" },
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
  id: "atrapa", nombre: "Atrapa Dulces", emoji: "🍬", tipo: "canvas", tiempo: 45, factor: 1,
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
      this.spawn = .42 + Math.random() * .3;
      const malo = Math.random() < .22;
      const buenos = [["🍬", 5], ["🍭", 5], ["🍪", 5], ["🍩", 5], ["🍦", 8], ["🧃", 5]];
      const estrella = Math.random() < .07;
      const [em, pts] = malo ? [["🥦", -5], ["🥬", -5], ["🧅", -5]][Math.floor(Math.random() * 3)]
        : estrella ? ["⭐", 15] : buenos[Math.floor(Math.random() * buenos.length)];
      this.items.push({ em, pts, malo, x: 26 + Math.random() * (E.W - 52), y: -26,
        v: 130 + Math.random() * 90 + (45 - E.tiempo) * 2.4, g: (Math.random() - .5) * 3 });
    }
    const suelo = E.H - 52;
    for (const it of this.items) {
      it.y += it.v * dt;
      if (!it.listo && it.y > suelo - 16 && it.y < suelo + 20 && Math.abs(it.x - this.cesta) < 46) {
        it.listo = true;
        if (it.malo) { this.racha = 0; api.sumar(it.pts, it.x, it.y); api.tono(160, .12, "square"); api.sacudir(7); api.vibrar(40); }
        else {
          this.racha++;
          api.sumar(it.pts + (this.racha >= 5 ? 3 : 0), it.x, it.y);
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
    if (this.racha >= 5) {
      c.font = "900 13px Nunito, sans-serif"; c.fillStyle = "#e0a92b";
      c.fillText("🔥 racha x" + this.racha, this.cesta, suelo + 30);
    }
  },
});

/* 2 ── Memoria ───────────────────────────────────────────── */
JUEGOS.push({
  id: "memoria", nombre: "Memoria", emoji: "🧠", tipo: "dom", tiempo: 70, factor: 0.5,
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
    api.hud("🍬 0", "⏱️ 70", "🏆 " + S.leer("rec-memoria", 0));
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
          if (this.pares === 8) { api.sumar(Math.max(0, 60 - this.intentos * 3) + Math.round(E.tiempo)); api.fin(); }
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
  id: "burbujas", nombre: "Burbujas", emoji: "🫧", tipo: "canvas", tiempo: 40, factor: 0.5,
  color: "#d9f0ff", desc: "Revienta antes que escapen", fondo: "linear-gradient(#eef8ff,#dceeff)",
  ayuda: "Toca las burbujas antes de que se escapen 🫧<br>Las rojas 💣 te quitan puntos, no las toques",
  init() { this.bs = []; this.spawn = 0; },
  update(dt) {
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = .32 + Math.random() * .25;
      const mala = Math.random() < .18;
      this.bs.push({ x: 30 + Math.random() * (E.W - 60), y: E.H + 30, r: 20 + Math.random() * 16,
        v: 60 + Math.random() * 70, mala, fase: Math.random() * 6, hue: Math.random() * 60 + 300 });
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
  id: "snake", nombre: "Gusanito", emoji: "🐛", tipo: "canvas", tiempo: null, factor: 1,
  color: "#dff6e3", desc: "Come sin chocar", fondo: "linear-gradient(#f3fff6,#e2f7e8)", medio: "🐛",
  ayuda: "Desliza el dedo para mover al gusanito 🐛<br>Come dulces y no choques contigo misma",
  init() {
    this.cel = Math.floor(Math.min(E.W, E.H) / 15);
    this.cols = Math.floor(E.W / this.cel); this.filas = Math.floor(E.H / this.cel);
    this.ox = (E.W - this.cols * this.cel) / 2; this.oy = (E.H - this.filas * this.cel) / 2;
    this.s = [{ x: 4, y: Math.floor(this.filas / 2) }]; this.d = { x: 1, y: 0 }; this.cola = [];
    this.acum = 0; this.vel = .16; this.crecer = 2; this.poner();
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
      api.tono(680, .07); this.crecer += 2; this.vel = Math.max(.07, this.vel - .004); this.poner();
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
  id: "torre", nombre: "Torre Dulce", emoji: "🧁", tipo: "canvas", tiempo: null, factor: 0.8,
  color: "#ffe9cf", desc: "Apila sin fallar", fondo: "linear-gradient(#fffaf2,#ffeedb)", medio: "🧁",
  ayuda: "Toca la pantalla para soltar el bloque 🧁<br>Apílalos lo más derecho posible",
  init() {
    this.bh = 26; this.base = { x: E.W / 2 - 55, w: 110 };
    this.pila = [{ ...this.base, y: E.H - 40 }];
    this.actual = { x: 0, w: 110, dir: 1, v: 150 };
    this.cam = 0; this.perfectos = 0;
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
                    v: Math.min(330, 150 + this.pila.length * 9) };
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
  id: "simon", nombre: "Repite", emoji: "🎵", tipo: "dom", tiempo: null, factor: 0.4,
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
    const rapido = Math.max(300, 560 - this.ronda * 18);
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
  id: "esquiva", nombre: "Esquiva", emoji: "🏃‍♀️", tipo: "canvas", tiempo: null, factor: 1,
  color: "#ffe0e0", desc: "No choques", fondo: "linear-gradient(#fff5f5,#ffe6ea)", medio: "🏃‍♀️",
  ayuda: "Mueve el dedo para esquivar 🪨<br>Junta los corazones ❤️ y aguanta lo más posible",
  init() {
    this.x = E.W / 2; this.obs = []; this.spawn = 0; this.vel = 190; this.dist = 0; this.linea = 0;
  },
  update(dt) {
    if (E.puntero.movido) this.x += (E.puntero.x - this.x) * Math.min(1, dt * 12);
    this.x = Math.max(20, Math.min(E.W - 20, this.x));
    this.vel += dt * 7; this.dist += dt; this.linea = (this.linea + this.vel * dt) % 40;
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = .42 + Math.random() * .25;
      const bueno = Math.random() < .22;
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
  id: "dulces", nombre: "Junta Dulces", emoji: "🍭", tipo: "dom", tiempo: null, factor: 0.5,
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
  id: "distinto", nombre: "El Distinto", emoji: "🔍", tipo: "dom", tiempo: 45, factor: 0.5,
  color: "#e4f7e8", desc: "Ojo rápido", fondo: "linear-gradient(#f6fff8,#e6f7ea)",
  ayuda: "Uno de los dulces es distinto a los demás 🔍<br>Tócalo antes de que se acabe el tiempo",
  init() { this.nivel = 0; this.ronda(); },
  ronda() {
    this.nivel++;
    const n = Math.min(2 + Math.floor(this.nivel / 2), 7);
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
      E.tiempo = Math.max(1, E.tiempo - 2);
    }
  },
});

/* 10 ── Rebota ───────────────────────────────────────────── */
JUEGOS.push({
  id: "rebota", nombre: "No Se Cae", emoji: "🎈", tipo: "canvas", tiempo: null, factor: 0.8,
  color: "#fff0d6", desc: "Que no toque el suelo", fondo: "linear-gradient(#fffbf2,#ffeedc)", medio: "🎈",
  ayuda: "Toca el globo para que no caiga 🎈<br>Cada toque suma, y cada vez va más rápido",
  init() {
    this.b = { x: E.W / 2, y: E.H * .35, vx: 60, vy: 0, r: 26 };
    this.toques = 0; this.g = 420;
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
      b.vy = -(330 + this.toques * 2.2);
      b.vx += (b.x - x) * 3.2;
      b.vx = Math.max(-260, Math.min(260, b.vx));
      this.toques++; this.g = 420 + this.toques * 7;
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
   HUB
   ============================================================ */
function pintarFichas() {
  document.getElementById("chipFichas").textContent = fichasDisponibles();
}
function pintarHub() {
  pintarFichas();
  const total = S.leer("juego-puntos", 0);
  document.getElementById("progTxt").textContent = (total % META) + " / " + META;
  document.getElementById("progBar").style.width = ((total % META) / META * 100) + "%";
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
