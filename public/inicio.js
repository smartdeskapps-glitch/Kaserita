(function () {
  var header = document.querySelector('header');
  if (!header) return;
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 4);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

(function () {
  var wideShot = document.getElementById('wideShot');
  if (!wideShot) return;
  wideShot.addEventListener('scroll', function () {
    if (wideShot.scrollLeft > 12) wideShot.classList.add('scrolled');
  }, { passive: true });
})();

(function () {
  var desktop = document.getElementById('showcaseDesktop');
  var mobile = document.getElementById('showcaseMobile');
  if (!desktop || !mobile) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var section = desktop.closest('.showcase');
  var ticking = false;

  function apply() {
    ticking = false;
    var rect = section.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var progress = (vh - rect.top) / (vh + rect.height); // 0 al entrar, 1 al salir
    progress = Math.max(0, Math.min(1, progress));
    var offset = (progress - 0.5) * 2; // -1 .. 1
    desktop.style.transform = 'translateY(' + (offset * -16) + 'px)';
    mobile.style.transform = 'translateY(' + (offset * 26) + 'px)';
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(apply);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  apply();
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
  var ctas = document.querySelectorAll('a.cta-primary[href="/registro"]');
  for (var i = 0; i < ctas.length; i++) {
    ctas[i].addEventListener('click', function () { anotar('click_crear_cuenta'); });
  }
})();
