/* Decoración kawaii: moños, corazones y estrellitas que caen despacito */
(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const em = ["🎀", "💖", "⭐", "🌸", "🎀", "✨", "🍓", "🎀"];
  const cont = document.createElement("div");
  cont.className = "kt-deco"; cont.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 10; i++) {
    const s = document.createElement("span");
    s.textContent = em[i % em.length];
    s.style.left = (4 + Math.random() * 92) + "vw";
    s.style.fontSize = (15 + Math.random() * 17) + "px";
    s.style.animationDuration = (16 + Math.random() * 16) + "s";
    s.style.animationDelay = (-Math.random() * 28) + "s";
    cont.appendChild(s);
  }
  document.body.appendChild(cont);
})();
