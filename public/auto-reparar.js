// Auto-reparación de archivos de /assets/ que no cargaron.
//
// Los archivos de /assets/ se guardan un año en el navegador (cabecera
// "immutable", ver vercel.json) y eso incluye las respuestas 404. Si alguien
// abre la página justo en el instante en que Vercel cambia de versión y un
// archivo todavía no está disponible, el navegador se queda con ese 404 y la
// pantalla sale en blanco o sin estilos hasta limpiar la caché.
//
// Aquí, si falla un estilo o un script de /assets/, se vuelve a pedir ese
// archivo saltándose la caché (eso reemplaza el 404 guardado) y se recarga la
// página una sola vez por archivo y por sesión.
window.addEventListener('error', function (e) {
  var el = e.target;
  if (!el || (el.tagName !== 'LINK' && el.tagName !== 'SCRIPT')) return;
  var url = el.href || el.src || '';
  if (url.indexOf('/assets/') === -1) return;
  var clave = 'kz_reparado_' + url.split('/').pop();
  try {
    if (sessionStorage.getItem(clave)) return;
    sessionStorage.setItem(clave, '1');
  } catch (err) {
    return; // sin sessionStorage no se arriesga a recargar en bucle
  }
  var recargar = function () { window.location.reload(); };
  fetch(url, { cache: 'reload' }).then(recargar, recargar);
}, true);
