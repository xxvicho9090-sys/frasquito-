/* Temas de la app: se aplica el guardado antes de pintar y se elige desde el botón 🎨 */
(function () {
  const TEMAS = [
    { id: "kitty", nombre: "Kitty", emoji: "🎀", desc: "Rojo y blanco, moños y lunares", fondo: "linear-gradient(165deg,#ffe7ee,#ffc2d2)", puntos: ["#e4002b", "#ff5272", "#ffb3c6"], barra: "#e4002b", deco: ["🎀", "💖", "⭐", "🌸", "🎀", "✨", "🍓", "🎀"] },
    { id: "sakura", nombre: "Sakura", emoji: "🌸", desc: "Rosa pastel y crema, muy suave", fondo: "linear-gradient(170deg,#fff5f8,#ffe2ee)", puntos: ["#dd5a86", "#ff8db3", "#f9c6d9"], barra: "#dd5a86", deco: ["🌸", "🌸", "✨", "🌷", "🌸", "💮", "🌸", "🤍"] },
    { id: "noche", nombre: "Noche estrellada", emoji: "🌙", desc: "Oscuro, morado y estrellas", fondo: "linear-gradient(175deg,#16143a,#1d1850)", puntos: ["#7f6dff", "#a898ff", "#ffe9a8"], barra: "#14122c", deco: ["⭐", "✨", "🌙", "⭐", "💫", "✨", "⭐", "🪐"] },
    { id: "bosque", nombre: "Bosque menta", emoji: "🍃", desc: "Verdes suaves y hojitas", fondo: "linear-gradient(170deg,#f1fff6,#cdeedb)", puntos: ["#2c9965", "#55c98f", "#bfe6d0"], barra: "#d9f2e4", deco: ["🍃", "🌿", "✨", "🍀", "🍃", "🦋", "🌱", "🍃"] },
    { id: "atardecer", nombre: "Atardecer", emoji: "🌅", desc: "Naranja, rosa y violeta", fondo: "linear-gradient(180deg,#ffe0b8,#ee9bb8 70%,#b79ae0)", puntos: ["#ee5f33", "#ff9558", "#ffcdb6"], barra: "#ffc7b0", deco: ["☁️", "✨", "🌤️", "💛", "☁️", "🕊️", "🧡", "✨"] },
  ];
  const leer = () => { try { const v = localStorage.getItem("tema-app"); return TEMAS.some(t => t.id === v) ? v : "kitty"; } catch { return "kitty"; } };
  const guardar = id => { try { localStorage.setItem("tema-app", id); } catch {} };
  const raiz = document.documentElement;

  function aplicar(id, persistir) {
    const t = TEMAS.find(x => x.id === id) || TEMAS[0];
    raiz.dataset.tema = t.id;
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.name = "theme-color"; (document.head || raiz).appendChild(m); }
    m.content = t.barra;
    if (persistir) guardar(t.id);
    document.dispatchEvent(new CustomEvent("tema-cambio", { detail: t }));
  }
  aplicar(leer(), false);            // antes de pintar: sin destello del tema por defecto

  window.TEMAS_APP = { lista: TEMAS, actual: () => TEMAS.find(t => t.id === raiz.dataset.tema) || TEMAS[0], aplicar: id => aplicar(id, true), abrir: abrirHoja };

  function abrirHoja() {
    if (document.querySelector(".tm-velo")) return;
    const velo = document.createElement("div"); velo.className = "tm-velo";
    velo.innerHTML = '<div class="tm-hoja" role="dialog" aria-modal="true" aria-label="Elegir tema"><h3>Elige tu tema 🎨</h3><p>Se queda guardado en tu celular</p><div class="tm-grid"></div><button class="btn tm-ok" type="button">Listo</button></div>';
    const grid = velo.querySelector(".tm-grid");
    TEMAS.forEach(t => {
      const b = document.createElement("button"); b.type = "button"; b.className = "tm-op"; b.setAttribute("aria-pressed", String(t.id === raiz.dataset.tema)); b.dataset.id = t.id;
      b.innerHTML = '<span class="tm-prev" style="background:' + t.fondo + '"><span aria-hidden="true">' + t.emoji + '</span>' + t.puntos.map(c => '<i style="background:' + c + '"></i>').join("") + '</span><span class="tm-nom"><b></b><small></small></span>';
      b.querySelector("b").textContent = t.nombre; b.querySelector("small").textContent = t.desc;
      b.onclick = () => { aplicar(t.id, true); grid.querySelectorAll(".tm-op").forEach(o => o.setAttribute("aria-pressed", String(o === b))); };
      grid.appendChild(b);
    });
    const cerrar = () => { velo.remove(); document.removeEventListener("keydown", tecla); const bt = document.querySelector(".tm-btn"); bt && bt.focus(); };
    const tecla = e => { if (e.key === "Escape") cerrar(); };
    velo.querySelector(".tm-ok").onclick = cerrar;
    velo.addEventListener("click", e => { if (e.target === velo) cerrar(); });
    document.addEventListener("keydown", tecla);
    document.body.appendChild(velo);
    (grid.querySelector('[aria-pressed="true"]') || grid.firstChild).focus();
  }

  // botón 🎨 en todas las páginas (en la sala de juegos va abajo y se esconde mientras juega)
  document.addEventListener("DOMContentLoaded", () => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tm-btn"; b.textContent = "🎨"; b.setAttribute("aria-label", "Cambiar tema de colores");
    b.onclick = abrirHoja;
    const jugar = document.getElementById("jugar");
    if (jugar) {
      b.classList.add("abajo");
      const ver = () => b.classList.toggle("oculto", !jugar.classList.contains("oculto"));
      new MutationObserver(ver).observe(jugar, { attributes: true, attributeFilter: ["class"] }); ver();
    }
    document.body.appendChild(b);
  });
})();
