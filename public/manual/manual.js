/* Manual de uso de Kaserita.
 *
 * Esta pagina es solo el cascaron: el contenido y las capturas se piden a
 * /api/manual con la sesion de Supabase de quien esta usando el POS. Sin sesion
 * valida (o siendo cliente de la tienda y no personal de un negocio) no se
 * recibe nada.
 */
(function () {
  'use strict';

  var CLAVE_SESION = 'sb-hzmrsbeamtbloudmxjrp-auth-token';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var app = $('#app');

  // ---------------------------------------------------------------- sesion y API
  function token() {
    try {
      var s = JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null');
      return (s && (s.access_token || (s.currentSession && s.currentSession.access_token))) || '';
    } catch (e) { return ''; }
  }
  function pedir(consulta) {
    return fetch('/api/manual?' + consulta, {
      headers: { Authorization: 'Bearer ' + token() },
      cache: 'no-store'
    });
  }
  function aviso(titulo, texto, boton) {
    app.innerHTML = '<div class="estado"><strong></strong><span></span>' +
      (boton ? '<br><a class="ir-pos" href="/pos"></a>' : '') + '</div>';
    $('strong', app).textContent = titulo;
    $('span', app).textContent = texto;
    if (boton) $('.ir-pos', app).textContent = boton;
  }

  function cargar() {
    if (!token()) {
      aviso('Este manual es para quienes usan Kaserita',
        'Inicia sesión en el POS y ábrelo desde el menú ≡ → «Manual de uso».', 'Ir al POS');
      return;
    }
    pedir('f=contenido').then(function (r) {
      if (r.status === 401 || r.status === 403) {
        aviso('No pudimos confirmar tu sesión',
          'Vuelve al POS, inicia sesión y abre el manual desde el menú ≡ → «Manual de uso».', 'Ir al POS');
        return null;
      }
      if (!r.ok) throw new Error('http ' + r.status);
      return r.text();
    }).then(function (html) {
      if (html === null) return;
      app.innerHTML = html;
      iniciar();
    }).catch(function () {
      aviso('No se pudo cargar el manual', 'Revisa tu conexión e intenta de nuevo.', 'Ir al POS');
    });
  }

  // ---------------------------------------------------------------- imagenes (con sesion)
  var urls = {};      // nombre -> blob URL ya descargado
  var enCurso = {};   // nombre -> promesa
  function imagen(nombre) {
    if (urls[nombre]) return Promise.resolve(urls[nombre]);
    if (!enCurso[nombre]) {
      enCurso[nombre] = pedir('f=img&n=' + encodeURIComponent(nombre)).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.blob();
      }).then(function (b) {
        urls[nombre] = URL.createObjectURL(b);
        return urls[nombre];
      });
    }
    return enCurso[nombre];
  }
  function cargarImagenes() {
    var imgs = $$('img[data-n]:not([src])', app);
    function poner(img) {
      imagen(img.getAttribute('data-n')).then(function (u) { img.src = u; }).catch(function () {});
    }
    if (!('IntersectionObserver' in window)) { imgs.forEach(poner); return; }
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        obs.unobserve(en.target);
        poner(en.target);
      });
    }, { rootMargin: '700px 0px' });
    imgs.forEach(function (i) { obs.observe(i); });
  }

  // ---------------------------------------------------------------- todo lo demas, ya con el contenido
  function iniciar() {
    var indice = $('#indice');
    var velo = $('.velo');
    var btnMenu = $('.btn-menu');
    btnMenu.hidden = false;

    function abrirIndice(abrir) {
      indice.classList.toggle('abierto', abrir);
      velo.hidden = !abrir;
      btnMenu.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    }
    btnMenu.addEventListener('click', function () { abrirIndice(!indice.classList.contains('abierto')); });
    velo.addEventListener('click', function () { abrirIndice(false); });
    indice.addEventListener('click', function (e) { if (e.target.closest('a')) abrirIndice(false); });

    // buscador
    var normalizar = function (t) {
      return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    };
    var temas = $$('.tema[data-t]');
    var preguntas = $$('.pregunta[data-t]');
    var grupos = $$('.grupo');
    var vacio = $('.sin-resultados');
    var portada = $('.portada');
    var buscador = $('#buscador');
    var textos = new Map();
    temas.concat(preguntas).forEach(function (el) { textos.set(el, normalizar(el.getAttribute('data-t'))); });

    function filtrar() {
      var q = normalizar(buscador.value).trim();
      var palabras = q ? q.split(/\s+/) : [];
      var hay = 0;
      function coincide(el) {
        var t = textos.get(el);
        return palabras.every(function (p) { return t.indexOf(p) !== -1; });
      }
      temas.forEach(function (t) {
        if (t.hasAttribute('data-faq')) return;
        var ok = !palabras.length || coincide(t);
        t.hidden = !ok;
        if (ok) hay++;
      });
      preguntas.forEach(function (p) {
        var ok = !palabras.length || coincide(p);
        p.hidden = !ok;
        if (ok) hay++;
        if (palabras.length && ok) p.open = true;
        if (!palabras.length) p.open = false;
      });
      grupos.forEach(function (g) {
        g.hidden = $$('.tema:not([hidden]):not([data-faq]), .pregunta:not([hidden])', g).length === 0;
      });
      $$('.indice li[data-n]').forEach(function (li) {
        var id = li.getAttribute('data-n');
        var destino = document.getElementById(id);
        if (id === 'faq') li.hidden = !!palabras.length && !preguntas.some(function (p) { return !p.hidden; });
        else li.hidden = destino ? destino.hidden : false;
      });
      $$('.nav-grupo').forEach(function (g) { g.hidden = $$('li:not([hidden])', g).length === 0; });
      if (portada) portada.hidden = !!palabras.length;
      vacio.hidden = !palabras.length || hay > 0;
      cargarImagenes();
    }
    buscador.addEventListener('input', filtrar);

    // tema actual resaltado en el indice
    var lis = {};
    $$('.indice li[data-n]').forEach(function (li) { lis[li.getAttribute('data-n')] = li; });
    if ('IntersectionObserver' in window) {
      var actual = null;
      var obs = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (en) {
          if (!en.isIntersecting) return;
          var li = lis[en.target.id];
          if (!li) return;
          if (actual) actual.classList.remove('activo');
          li.classList.add('activo');
          actual = li;
          var caja = indice.getBoundingClientRect();
          var r = li.getBoundingClientRect();
          if (r.top < caja.top + 60 || r.bottom > caja.bottom - 20) indice.scrollTop += (r.top - caja.top) - caja.height / 2 + r.height / 2;
        });
      }, { rootMargin: '-80px 0px -65% 0px' });
      $$('.tema[id]').forEach(function (t) { obs.observe(t); });
    }

    // visor de imagenes
    var visor = $('#visor');
    var visorImg = visor && $('img', visor);
    if (visor && typeof visor.showModal === 'function') {
      app.addEventListener('click', function (e) {
        var a = e.target.closest('a[data-zoom]');
        if (!a) return;
        e.preventDefault();
        var origen = $('img', a);
        imagen(a.getAttribute('data-n')).then(function (u) {
          visorImg.src = u;
          visorImg.alt = origen ? origen.alt : '';
          visor.showModal();
        });
      });
      visor.addEventListener('click', function () { visor.close(); });
      $('.visor-cerrar', visor).addEventListener('click', function (e) { e.stopPropagation(); visor.close(); });
    }

    cargarImagenes();

    // si se abrio con un ancla (#cobrar), vuelve a ella ya con el contenido puesto
    if (location.hash) {
      var destino = document.getElementById(location.hash.slice(1));
      if (destino) destino.scrollIntoView();
    }
  }

  cargar();
})();
