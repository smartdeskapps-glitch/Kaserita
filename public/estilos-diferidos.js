// Hojas de estilo que no hacen falta para el primer dibujo (tipografías, íconos).
// Se piden con media="print" para que no bloqueen la pantalla, y al terminar de
// bajar pasan a media="all". Es un archivo aparte porque la política de seguridad
// (CSP) no permite atributos onload en línea.
(function () {
  var enlaces = document.querySelectorAll('link[data-diferido]');
  Array.prototype.forEach.call(enlaces, function (el) {
    var activar = function () { el.media = 'all'; };
    if (el.sheet) activar();
    else {
      el.addEventListener('load', activar);
      el.addEventListener('error', activar);
    }
  });
})();
