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
