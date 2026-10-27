// Momento en que arrancó el splash -- el panel de marca del login toma
// este dato para "adelantar" su propia animación de fondo (ver
// kgSyncDelayRef más abajo en el componente) y que las manchas de color
// no den un salto de posición justo cuando el splash desaparece.
window.__kgSplashT0 = performance.now();

// Equipos modestos: menos capas animadas (ver .splash-ligero en pos.html).
(function () {
  var el = document.getElementById('splash-kaserita');
  if (!el) return;
  var pocosNucleos = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  var pocaMemoria = navigator.deviceMemory && navigator.deviceMemory <= 4;
  var ahorro = navigator.connection && navigator.connection.saveData;
  if (pocosNucleos || pocaMemoria || ahorro) el.classList.add('splash-ligero');
  // Pestaña en segundo plano: se pausan las animaciones.
  document.addEventListener('visibilitychange', function () {
    el.classList.toggle('splash-pausado', document.hidden);
  });
})();

// Frases cortas que se van turnando en el splash mientras carga --  no
// reflejan un progreso real (no hay forma de medirlo acá), solo dan la
// sensación de que algo sigue pasando en vez de una pantalla estática.
const FRASES_SPLASH = [
  'Preparando tu catálogo...',
  'Cargando tus productos...',
  'Afinando el punto de venta...',
  'Ya casi está listo...'
];
let fraseSplashIdx = 0;
let fraseSplashIntervalo = setInterval(() => {
  const elFrase = document.getElementById('splash-status');
  if (!elFrase) return;
  elFrase.classList.add('splash-status-oculto');
  setTimeout(() => {
    fraseSplashIdx = (fraseSplashIdx + 1) % FRASES_SPLASH.length;
    elFrase.textContent = FRASES_SPLASH[fraseSplashIdx];
    elFrase.classList.remove('splash-status-oculto');
  }, 250);
}, 1800);

window.ocultarSplashKaserita = function () {
  const el = document.getElementById('splash-kaserita');
  if (!el) return;
  clearInterval(fraseSplashIntervalo);
  // Se desvanece (con un leve acercamiento, ver .splash-oculto en pos.html) y
  // recién entonces se quita del DOM.
  el.classList.add('splash-oculto');
  setTimeout(() => el.remove(), 550);
};
// Salvavidas: si algo tarda demasiado en cargar, el splash no se queda
// pegado para siempre.
setTimeout(() => window.ocultarSplashKaserita(), 8000);
