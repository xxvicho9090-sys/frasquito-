/* Decoración que cae despacito; los dibujitos cambian con el tema elegido */
(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const porDefecto = ["🎀", "💖", "⭐", "🌸", "🎀", "✨", "🍓", "🎀"];
  const cont = document.createElement("div");
  cont.className = "kt-deco"; cont.setAttribute("aria-hidden", "true");
  const cuantos = navigator.deviceMemory && navigator.deviceMemory <= 2 ? 5 : 10;
  function llenar() {
    const t = window.TEMAS_APP && window.TEMAS_APP.actual();
    const em = (t && t.deco) || porDefecto;
    cont.textContent = "";
    for (let i = 0; i < cuantos; i++) {
      const s = document.createElement("span");
      s.textContent = em[i % em.length];
      s.style.left = (4 + Math.random() * 92) + "vw";
      s.style.fontSize = (15 + Math.random() * 17) + "px";
      s.style.animationDuration = (16 + Math.random() * 16) + "s";
      s.style.animationDelay = (-Math.random() * 28) + "s";
      cont.appendChild(s);
    }
  }
  llenar();
  document.body.appendChild(cont);
  document.addEventListener("tema-cambio", llenar);
  document.addEventListener("visibilitychange", () => cont.classList.toggle("pausa", document.hidden));
})();
