(function () {
  var header = document.querySelector('header');
  if (!header) return;
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 4);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// MacBook que se abre con el scroll. Mismos puntos de animación que el
// componente "MacBook Scroll" de Aceternity, pero sin React ni framer-motion
// (la portada es HTML plano y así no carga librerías de más).
(function () {
  var scene = document.getElementById('mbScene');
  var fit = document.getElementById('mbFit');
  var keys = document.getElementById('mbKeys');
  if (!scene || !fit) return;

  if (keys) {
    var filas = [
      { cls: 'fn', teclas: ['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', '⏻'] },
      { teclas: ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { t: '⌫', c: 'w15' }] },
      { teclas: [{ t: 'tab', c: 'w15' }, 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'] },
      { teclas: [{ t: 'caps', c: 'w15' }, 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { t: 'enter', c: 'w2' }] },
      { teclas: [{ t: 'shift', c: 'w2' }, 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { t: 'shift', c: 'w2' }] },
      { teclas: ['fn', 'ctrl', 'alt', { t: 'cmd', c: 'w15' }, { t: '', c: 'w5' }, { t: 'cmd', c: 'w15' }, 'alt', '◀', '▲▼', '▶'] }
    ];
    var html = '';
    filas.forEach(function (f) {
      html += '<div class="mb-row' + (f.cls ? ' ' + f.cls : '') + '">';
      f.teclas.forEach(function (k) {
        var o = typeof k === 'string' ? { t: k } : k;
        html += '<span class="mb-key' + (o.c ? ' ' + o.c : '') + '">' + o.t + '</span>';
      });
      html += '</div>';
    });
    keys.innerHTML = html;
  }

  var DISENO = 512;      // ancho de la laptop en px antes de escalarla
  var ALTO = 544;        // tapa (192) + base (352)
  var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pendiente = false;

  function tramo(p, a, b, desde, hasta) {
    var t = Math.min(1, Math.max(0, (p - a) / (b - a)));
    return desde + (hasta - desde) * t;
  }

  function dibujar() {
    pendiente = false;
    var pin = document.getElementById('mbPin');
    var ancho = scene.parentElement.clientWidth;
    var movil = window.innerWidth < 768;
    var sFinal = movil ? 1.15 : 1.5;
    // Que la tapa abierta quepa a lo ancho y que la laptop completa quepa a lo alto.
    var porAncho = ancho / (DISENO * sFinal + 24);
    var cab = document.getElementById('mbHead');
    var altoCab = cab ? cab.offsetHeight : 90;
    // Para el alto se cuenta solo la pantalla abierta (444 px + margen): el teclado
    // se desvanece al abrir y puede asomar por debajo sin estorbar.
    var porAlto = pin ? (pin.clientHeight - altoCab - 36) / 470 : 1;
    var ajuste = Math.max(0.3, Math.min(1, porAncho, porAlto));
    var p;
    if (reducido) {
      p = 0.6;
    } else {
      // La escena queda fija en pantalla mientras se abre; p va de 0 a 1 en
      // todo el recorrido del scroll de la escena.
      var r = scene.getBoundingClientRect();
      var recorrido = Math.max(1, r.height - window.innerHeight);
      p = Math.min(1, Math.max(0, -r.top / recorrido));
    }
    var s = scene.style;
    s.setProperty('--fit', ajuste.toFixed(4));
    s.setProperty('--mb-h', ALTO + 'px');
    s.setProperty('--mb-sx', tramo(p, 0, 0.5, 0.8, sFinal / 1.5).toFixed(4));
    s.setProperty('--mb-sy', tramo(p, 0, 0.5, 0.4, sFinal / 1.5).toFixed(4));
    s.setProperty('--mb-rot', tramo(p, 0.06, 0.5, -28, 0).toFixed(3) + 'deg');
    // La base (teclado) cede el lugar a la pantalla cuando esta crece.
    s.setProperty('--mb-base-op', tramo(p, 0.15, 0.45, 1, 0).toFixed(3));
    s.setProperty('--c1', tramo(p, 0.5, 0.66, 0, 1).toFixed(3));
    s.setProperty('--c2', tramo(p, 0.62, 0.78, 0, 1).toFixed(3));
    var opTexto = reducido ? 1 : tramo(p, 0, 0.25, 1, 0);
    s.setProperty('--mb-text-ty', (reducido ? 0 : tramo(p, 0, 0.3, 0, 40)).toFixed(1) + 'px');
    s.setProperty('--mb-text-op', opTexto.toFixed(3));
    // Con el texto ya desvanecido, el boton de arriba no debe seguir recibiendo clics;
    // en celular aparece la barra fija con el mismo boton.
    // Al irse el texto, la laptop sube a ocupar su lugar.
    s.setProperty('--mb-fit-ty', (reducido ? 0 : -(altoCab - 24) * tramo(p, 0.08, 0.3, 0, 1)).toFixed(1) + 'px');
    // Con la pantalla ya abierta, bajo la laptop queda el resto de la altura
    // fija (la escena es tan alta como la ventana). Se recoge para que la
    // siguiente seccion no quede lejos: abajo de la pantalla sobran ~40 px.
    if (pin && !reducido) {
      var fondoPantalla = fit.offsetTop - (altoCab - 24) + 444 * (sFinal / 1.5) * ajuste;
      var sobra = Math.max(0, pin.clientHeight - fondoPantalla - 40);
      scene.style.marginBottom = (-sobra).toFixed(0) + 'px';
    }
    var oculto = opTexto < 0.04;
    if (cab) cab.classList.toggle('mb-head-off', oculto);
    var barra = document.getElementById('ctaBar');
    if (barra) barra.classList.toggle('show', oculto);
    document.body.classList.toggle('has-bar', oculto);
  }

  function pedir() {
    if (!pendiente) { pendiente = true; requestAnimationFrame(dibujar); }
  }
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir);
  dibujar();
})();

// Onda sobre la cuadricula de fondo: al tocar un punto libre de la escena.
// Solo en pantallas anchas y sin "reducir movimiento" (en celular queda fija).
(function () {
  var escena = document.getElementById('mbScene');
  var capa = document.getElementById('mbOndas');
  if (!escena || !capa) return;
  var quieta = window.matchMedia('(max-width: 899px), (prefers-reduced-motion: reduce)');
  escena.addEventListener('pointerdown', function (e) {
    if (quieta.matches || e.target.closest('a, button, input, label')) return;
    var r = capa.getBoundingClientRect();
    var onda = document.createElement('i');
    onda.className = 'mb-onda';
    onda.style.setProperty('--x', (e.clientX - r.left) + 'px');
    onda.style.setProperty('--y', (e.clientY - r.top) + 'px');
    onda.addEventListener('animationend', function () { onda.remove(); });
    while (capa.children.length > 3) capa.removeChild(capa.firstChild);
    capa.appendChild(onda);
  });
})();

// Las tarjetas de la fila (pantallas angostas) aparecen al entrar en vista.
(function () {
  var figs = document.querySelectorAll('#mbStrip .mb-fig');
  if (!figs.length) return;
  if (!('IntersectionObserver' in window)) {
    for (var i = 0; i < figs.length; i++) figs[i].classList.add('in');
    return;
  }
  var io = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.2 });
  for (var j = 0; j < figs.length; j++) io.observe(figs[j]);
})();

// Conteo anónimo de visitas y del clic en "Crear mi cuenta" (ver
// analitica_eventos.sql). No usa cookies ni identifica a nadie: cada
// llamada es solo "se abrió esta página" o "se tocó este botón", sin
// nada que junte dos visitas de la misma persona.
(function () {
  var SUPABASE_URL = 'https://hzmrsbeamtbloudmxjrp.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_RHAkd7pZIadDnSQClFdjMQ_lrG3p-gw';

  function anotar(evento, dato) {
    try {
      fetch(SUPABASE_URL + '/rest/v1/analitica_eventos', {
        method: 'POST',
        keepalive: true,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ pagina: 'inicio', evento: evento, dato: dato || null })
      }).catch(function () {});
    } catch (err) {
      // Si falla (bloqueador de anuncios, sin red), no afecta a la página.
    }
  }

  anotar('vista');
  var ctas = document.querySelectorAll('a[href="/registro"]');
  for (var i = 0; i < ctas.length; i++) {
    ctas[i].addEventListener('click', function (e) {
      // El dato dice desde que boton se hizo clic (encabezado, hero, planes...).
      anotar('click_crear_cuenta', e.currentTarget.getAttribute('data-cta'));
    });
  }
})();
