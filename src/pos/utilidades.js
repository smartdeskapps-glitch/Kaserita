// Utilidades del POS sin estado (formatos, códigos, carga de librerías, avisos).
// Extraídas de src/main.jsx.
import { asegurarXLSX } from '../PanelAdminCompartido.jsx';
import { reportarFallo } from '../monitoreo.js';

export const generarUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Librerías pesadas: se bajan solo al usarlas, empaquetadas con la propia app
// (mismo dominio; la CSP ya no permite scripts de CDN externos).
export const asegurarJsPDF = async () => {
  if (!window.jspdf) { const m = await import('jspdf'); window.jspdf = { jsPDF: m.jsPDF }; }
};

export const asegurarConfetti = async () => {
  if (!window.confetti) { window.confetti = (await import('canvas-confetti')).default; }
};

// Devuelve la URL del .wasm (servido por la propia app) para zxing.
export const asegurarZXing = async () => {
  if (!window.ZXingWASM) {
    const [m, wasm] = await Promise.all([import('zxing-wasm/reader'), import('zxing-wasm/reader/zxing_reader.wasm?url')]);
    window.ZXingWASM = m;
    window.__zxingWasmUrl = wasm.default;
  }
  return window.__zxingWasmUrl;
};

// La tabla productos exige cod_ean (no admite vacío), aunque hay artículos
// reales sin código de barras (a granel, hechos en casa, etc.). Cuando el
// cajero lo deja en blanco se genera un código interno único para que el
// producto igual se pueda registrar.
export let contadorCodigoInterno = 0;

export const generarCodigoInterno = () => {
  contadorCodigoInterno += 1;
  return `INT-${Date.now()}-${contadorCodigoInterno}`;
};

// Convierte los campos de pack de un formulario (vendeEnPack,
// unidades_por_pack, precio_venta_pack, cod_ean_pack -- como strings,
// que es como los guardan los inputs) a los valores que espera la
// columna de `productos`. Centralizado porque esta misma normalización
// se repetía en cada lugar que crea o actualiza un producto -- si
// alguna vez cambian las reglas (ej. permitir unidades_por_pack === 1),
// solo hay que tocarlo acá.

// Zona horaria del celular: el dia y la hora de las ventas se agrupan en la
// base con esta zona para que coincidan con lo que ve el usuario.
export const zonaLocal = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima'; } catch (e) { return 'America/Lima'; }
};

export const normalizarCamposPack = (f) => ({
  unidades_por_pack: f.vendeEnPack && Number(f.unidades_por_pack) > 1 ? Number(f.unidades_por_pack) : 1,
  precio_venta_pack: f.vendeEnPack && f.precio_venta_pack ? Number(f.precio_venta_pack) : null,
  cod_ean_pack: f.vendeEnPack && (f.cod_ean_pack || '').trim() ? f.cod_ean_pack.trim() : null
});

// La otra dirección: de una fila de `productos` a los campos (todos en
// string, como los maneja un <input>) que arman un formulario de
// creación/edición. Usado tanto al vincular una fila de "Registrar
// Productos" a un producto existente como al abrir "Editar Producto" --
// cada llamador le agrega encima los campos propios de su formulario
// (stock_actual, productoExistenteId, etc.).
export const datosFormularioDesdeProducto = (producto) => ({
  descripcion: producto.descripcion || '',
  cod_ean: producto.cod_ean || '',
  sku: producto.sku || '',
  categoria: producto.categoria || 'General',
  precio_costo: producto.precio_costo != null ? String(producto.precio_costo) : '',
  precio_venta: producto.precio_venta != null ? String(producto.precio_venta) : '',
  unidad: producto.unidad || 'UND',
  vendeEnPack: Number(producto.unidades_por_pack) > 1,
  unidades_por_pack: Number(producto.unidades_por_pack) > 1 ? String(producto.unidades_por_pack) : '',
  precio_venta_pack: producto.precio_venta_pack != null ? String(producto.precio_venta_pack) : '',
  cod_ean_pack: producto.cod_ean_pack || '',
  foto_url: producto.foto_url || '',
  fotos_extra: producto.fotos_extra || [],
  descripcion_larga: producto.descripcion_larga || '',
  es_destacado: !!producto.es_destacado
});

// Exporta un arreglo de objetos a un archivo Excel (.xlsx) real descargable,
// generado en el propio navegador con SheetJS (sin backend).
export const exportarExcel = async (nombreArchivo, filas, nombreHoja = 'Datos') => {
  if (!filas || filas.length === 0) return;
  try {
    await asegurarXLSX();
  } catch (err) {
    console.error(err);
    alert('No se pudo cargar el generador de Excel. Revisa tu conexión e intenta de nuevo.');
    return;
  }
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  XLSX.writeFile(libro, nombreArchivo);
};

// ID fijo usado únicamente por "Modo Demo Local" (no corresponde a ninguna
// bodega real). Solo en ese caso se muestra el catálogo de ejemplo; una
// bodega real sin productos debe ver un catálogo vacío de verdad.
export const BODEGA_DEMO_ID = 'a0000000-0000-0000-0000-000000000001';

// Base de la vitrina pública de KaseritaDelivery (repo y deploy
// separados de este). El link final de cada bodega es esta URL + su
// slug, ej. KASERITA_DELIVERY_URL + '/san-luis'.
export const KASERITA_DELIVERY_URL = 'https://delivery.smartdeskapps.com';

// Aviso sonoro cuando llega un pedido nuevo de KaseritaDelivery. Los
// navegadores no dejan reproducir sonido antes de que haya habido algún
// clic/interacción en la página; por eso puede no sonar el primer pedido
// si se acaba de abrir la pestaña.
// Dos tonos cortos generados con Web Audio: sin archivo de sonido externo.
export let contextoAvisoPedidoNuevo = null;

export const sonarAvisoPedidoNuevo = () => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!contextoAvisoPedidoNuevo) contextoAvisoPedidoNuevo = new AC();
    const ctx = contextoAvisoPedidoNuevo;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    [[880, 0], [1175, 0.18]].forEach(([frecuencia, inicio]) => {
      const osc = ctx.createOscillator();
      const ganancia = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frecuencia;
      const t0 = ctx.currentTime + inicio;
      ganancia.gain.setValueAtTime(0.0001, t0);
      ganancia.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      osc.connect(ganancia).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    });
  } catch (err) {
    console.warn('No se pudo reproducir el aviso sonoro:', err.message);
  }
};

// "25 oct 2026 · 11:22" -- fecha y hora de la boleta (para la pantalla de venta
// exitosa, la boleta impresa y la ticketera).
export function formatoFechaHoraBoleta(iso) {
  const d = iso ? new Date(iso) : new Date();
  const fecha = d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fecha} · ${hora}`;
}

// Confeti que salta del visto al emitir la boleta: [color, x, y, tamaño].
export const CONFETI_BOLETA = [
  ['#ffc81a', -46, -30, 8], ['#7466e8', 46, -34, 7], ['#ff7aa2', -58, 6, 6],
  ['#34d399', 56, 10, 7], ['#5b4bd6', -30, -52, 6], ['#f59e0b', 30, -54, 6],
];

export const ICONO_MEDIO_PAGO = { EFECTIVO: 'efectivo', YAPE: 'movil', PLIN: 'movil', TARJETA: 'tarjeta', CREDITO: 'credito', MIXTO: 'mixto' };

// Mensajes de error para la persona: si el sistema devolvió un texto claro en español
// se muestra; si es un texto técnico (en inglés o de la base de datos) se cambia por
// un aviso corto, y el detalle queda solo en la consola.
export const TEXTO_TECNICO = /(violates|constraint|duplicate key|jwt|relation |column |function |permission denied|row-level|null value|syntax|fetch|network|timeout|failed|exception|undefined|\bpg|pgrst|supabase|postgres|schema|cannot|could not|invalid|already exists|\bnull\b)/i;

// Enlace a Google Maps solo si latitud y longitud son números reales
// (vienen de clientes anónimos de la tienda: no se confía en el texto).
export function urlMapa(lat, lng) {
  const la = Number(lat), lo = Number(lng);
  if (lat === null || lng === null || lat === '' || lng === '' || !Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return `https://www.google.com/maps?q=${la},${lo}`;
}

export function mensajeError(err, base) {
  const generico = 'No se pudo completar la acción';
  const limpio = String(base || generico).replace(/[\s.:]+$/, '');
  const m = String(err && err.message ? err.message : '').trim();
  const claro = m.length > 8 && /^[¡¿A-ZÁÉÍÓÚ]/.test(m) && /[áéíóúñ¿¡]|\b(no|el|la|los|las|tu|tus|ya|de|que|para|se|elige|ingresa)\b/i.test(m) && !TEXTO_TECNICO.test(m);
  if (claro) return limpio === generico ? m : `${limpio}: ${m}`;
  if (err) { console.warn(limpio, err); reportarFallo(limpio, err); }
  return `${limpio}. Revisa tu conexión e inténtalo de nuevo.`;
}

// Fecha corta para mostrar cuándo pasó algo: "hoy 08:02", "ayer 21:30" o "17/10 18:40".
export const etiquetaCuandoTurno = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hoy.toDateString()) return `hoy ${hora}`;
  if (d.toDateString() === ayer.toDateString()) return `ayer ${hora}`;
  return `${d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })} ${hora}`;
};

// Calculadora de billetes y monedas para abrir/cerrar caja: solo ayuda a
// sumar -- lo que se guarda sigue siendo el total que queda en el campo
// de monto. Es un componente aparte (no dentro de PosApp) para que no se
// vuelva a crear en cada render y los campos no pierdan el foco.
export const COLOR_BILLETE = { 200: '#b45309', 100: '#2563eb', 50: '#a21caf', 20: '#d97706', 10: '#059669' };

// Montos del Dashboard con separador de miles (1,752.90) y siempre 2 decimales.
// Los formateadores se crean una sola vez: toLocaleString con opciones arma uno
// nuevo en cada llamada y era de lo más caro al dibujar tarjetas y carrito.
export const FMT_SOLES = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const FMT_ENTERO = new Intl.NumberFormat('es-PE');

export const formatoSoles = (n) => FMT_SOLES.format(Number(n || 0));

// Cifras compactas para el calendario de "Ventas por día", que no se rompe
// con montos grandes: entero hasta 9,999; luego 12.3k / 123k / 1.2M.
export const montoCorto = (n) => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e5) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return FMT_ENTERO.format(Math.round(n));
};

// Para las tarjetas de resumen y de semana: con céntimos hasta 9,999.99, sin
// céntimos desde 10 mil y abreviado desde un millón.
export const montoResumen = (n) => {
  if (n >= 1e6) return `S/ ${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e4) return `S/ ${FMT_ENTERO.format(Math.round(n))}`;
  return `S/ ${formatoSoles(n)}`;
};

// Tono del panel de la tarjeta según la categoría: las categorías las pone
// cada negocio, así que el tono sale de un hash estable del nombre (la misma
// categoría siempre queda del mismo color). Sin categoría: lila de marca.
export const TONOS_TARJETA = [
  { t: '#dde4fa', td: '#5b4bd6' },
  { t: '#dfeafd', td: '#3b66b8' },
  { t: '#fde8d6', td: '#c0662a' },
  { t: '#fff1c7', td: '#a97c10' },
  { t: '#dcf3e6', td: '#238458' },
  { t: '#fde3ea', td: '#c0405f' },
];

export function tonoCategoria(categoria) {
  if (!categoria) return TONOS_TARJETA[0];
  let h = 0;
  for (const ch of String(categoria).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONOS_TARJETA[h % TONOS_TARJETA.length];
}
