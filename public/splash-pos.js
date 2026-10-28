// Momento en que arrancó el splash -- el panel de marca del login toma
// este dato para "adelantar" su propia animación de fondo (ver
// kgSyncDelayRef más abajo en el componente) y que las manchas de color
// no den un salto de posición justo cuando el splash desaparece.
window.__kgSplashT0 = performance.now();

// Pestaña en segundo plano: se pausan los puntos del splash.
(function () {
  var el = document.getElementById('splash-kaserita');
  if (!el) return;
  document.addEventListener('visibilitychange', function () {
    el.classList.toggle('splash-pausado', document.hidden);
  });
})();

// La app (src/main.jsx) llama a esta función cuando ya sabe qué pantalla
// mostrar. IMPORTANTE: si se quita, el splash no se retira nunca (main.jsx
// tiene un respaldo, pero esta es la vía normal).
window.ocultarSplashKaserita = function () {
  const el = document.getElementById('splash-kaserita');
  if (!el) return;
  // Se desvanece (con un leve acercamiento, ver .splash-oculto en pos.html) y
  // recién entonces se quita del DOM.
  el.classList.add('splash-oculto');
  setTimeout(() => el.remove(), 550);
};
// Salvavidas: si algo tarda demasiado en cargar, el splash no se queda
// pegado para siempre.
setTimeout(() => window.ocultarSplashKaserita(), 8000);
