// Monitoreo de errores propio: escucha los errores no controlados del navegador
// y los guarda en la tabla errores_app (ver errores_app.sql). Se ven en el panel
// de superadmin, pestaña "Errores". No usa servicios externos ni cookies.
import { esRuidoConocido, huellaError, decidirReporte, armarReporte } from './lib/errores.js';

let cliente = null;
let estado = null;
let ultimaAccion = '';

const textoDeBoton = (el) => {
  const boton = el && el.closest ? el.closest('button, a, [role="button"]') : null;
  if (!boton) return '';
  const etiqueta = boton.getAttribute('aria-label') || boton.getAttribute('title') || boton.textContent || '';
  const t = etiqueta.replace(/\s+/g, ' ').trim();
  return t.length > 30 ? '' : t; // un texto largo suele ser contenido (nombres, montos), no el nombre del botón
};

// Envía un error. Nunca lanza: el monitoreo no puede romper la app que vigila.
export const reportarError = ({ mensaje, stack, origen }) => {
  try {
    if (!cliente || esRuidoConocido(mensaje)) return;
    const huella = huellaError(mensaje, origen);
    const decision = decidirReporte(estado, huella);
    estado = decision.estado;
    if (!decision.enviar) return;
    const fila = armarReporte({
      mensaje, stack, origen,
      accion: ultimaAccion,
      ruta: typeof location !== 'undefined' ? location.pathname : '',
      navegador: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    });
    cliente.from('errores_app').insert([fila]).then(() => {}, () => {});
  } catch (e) { /* silencioso a propósito */ }
};

// Devuelve una función para detener la escucha (útil para el efecto de React).
export const iniciarMonitoreo = (sbClient) => {
  cliente = sbClient || null;
  if (typeof window === 'undefined' || !cliente) return () => {};
  const alClic = (e) => { ultimaAccion = textoDeBoton(e.target) || ultimaAccion; };
  const alError = (e) => reportarError({
    mensaje: (e.error && e.error.message) || e.message,
    stack: e.error && e.error.stack,
    origen: 'js'
  });
  const alRechazo = (e) => {
    const r = e.reason;
    reportarError({ mensaje: (r && r.message) || String(r), stack: r && r.stack, origen: 'promesa' });
  };
  document.addEventListener('click', alClic, true);
  window.addEventListener('error', alError);
  window.addEventListener('unhandledrejection', alRechazo);
  return () => {
    document.removeEventListener('click', alClic, true);
    window.removeEventListener('error', alError);
    window.removeEventListener('unhandledrejection', alRechazo);
    // no se vacía `cliente`: el límite de error de React aún debe poder reportar
  };
};
