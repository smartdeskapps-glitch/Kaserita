// Momento en que arrancó el splash -- el panel de marca del login toma
// este dato para "adelantar" su propia animación de fondo (ver
// kgSyncDelayRef más abajo en el componente) y que las manchas de color
// no den un salto de posición justo cuando el splash desaparece.
window.__kgSplashT0 = performance.now();

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
  // En escritorio primero se encoge hacia la izquierda (mismo ancho
  // final que el panel de marca real) y recién después se desvanece --
  // así se ve como si el splash se transformara en el panel en vez de
  // simplemente taparlo y desaparecer. En mobile el login no se divide
  // en columnas, así que se salta directo al desvanecido de siempre.
  const esEscritorio = window.matchMedia('(min-width: 768px)').matches;
  const desvanecer = () => {
    el.classList.add('splash-oculto');
    setTimeout(() => el.remove(), 450);
  };
  if (esEscritorio) {
    el.classList.add('splash-encogiendo');
    setTimeout(desvanecer, 700);
  } else {
    desvanecer();
  }
};
// Salvavidas: si algo tarda demasiado en cargar, el splash no se queda
// pegado para siempre.
setTimeout(() => window.ocultarSplashKaserita(), 8000);
