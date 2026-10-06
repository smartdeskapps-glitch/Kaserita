// Lógica pura del monitoreo de errores (sin navegador ni Supabase, para poder
// probarla). La parte que escucha los errores y los envía está en monitoreo.js.

export const MAX_REPORTES_POR_SESION = 10;
export const SEGUNDOS_ENTRE_REPETIDOS = 60;

// Errores que no son un fallo de la app y solo llenarían la lista de ruido.
// - "Failed to fetch"/"Load failed"/"NetworkError": sin internet (el POS funciona
//   sin conexión, así que es un estado normal).
// - "ResizeObserver loop": aviso inofensivo del navegador.
// - "Script error.": error de otro origen del que el navegador no da detalle.
const RUIDO = [
  /failed to fetch/i,
  /load failed/i,
  /networkerror/i,
  /network request failed/i,
  /resizeobserver loop/i,
  /^script error\.?$/i,
  /non-error promise rejection/i,
  /chunkloaderror|loading chunk|dynamically imported module/i
];

export const esRuidoConocido = (mensaje) => {
  const m = String(mensaje || '').trim();
  if (!m) return true;
  return RUIDO.some((re) => re.test(m));
};

// Quita lo que no debe guardarse: datos de la URL (?token=...), correos y
// números largos (DNI, teléfonos, tarjetas). Corta al largo máximo.
export const limpiarTexto = (texto, max = 500) => {
  let t = String(texto ?? '');
  t = t.replace(/(https?:\/\/[^\s)?#]+)[?#][^\s):]*/g, '$1');
  t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[correo]');
  t = t.replace(/[0-9]{8,}/g, '[numero]');
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

// Dos errores "iguales" (mismo mensaje en la misma pantalla) comparten huella,
// aunque cambien los números (ids, cantidades) del mensaje.
export const huellaError = (mensaje, origen = '') => {
  const base = limpiarTexto(mensaje, 160).replace(/[0-9]+/g, '#').toLowerCase();
  return `${origen}|${base}`;
};

// Devuelve el nuevo estado y si este error debe enviarse. Evita inundar la tabla
// si un error se repite en bucle: máximo 10 por sesión y el mismo error solo
// una vez por minuto.
export const decidirReporte = (estado, huella, ahora = Date.now()) => {
  const previo = estado || { total: 0, vistos: {} };
  if (previo.total >= MAX_REPORTES_POR_SESION) return { enviar: false, estado: previo };
  const ultimo = previo.vistos[huella];
  if (ultimo != null && ahora - ultimo < SEGUNDOS_ENTRE_REPETIDOS * 1000) {
    return { enviar: false, estado: previo };
  }
  return {
    enviar: true,
    estado: { total: previo.total + 1, vistos: { ...previo.vistos, [huella]: ahora } }
  };
};

// Arma la fila que se guarda. `origen`: 'js' | 'promesa' | 'render'.
export const armarReporte = ({ mensaje, stack, origen, accion, ruta, navegador }) => ({
  origen: ['js', 'promesa', 'render'].includes(origen) ? origen : 'js',
  mensaje: limpiarTexto(mensaje, 300),
  detalle: stack ? limpiarTexto(stack, 1500) : null,
  accion: accion ? limpiarTexto(accion, 60) : null,
  ruta: ruta ? limpiarTexto(ruta, 120) : null,
  navegador: navegador ? String(navegador).slice(0, 160) : null
});
