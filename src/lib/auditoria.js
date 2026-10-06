// Registro de actividad: convierte una fila de "auditoria" en una frase legible
// (título + detalle por campo) en vez del texto técnico de la base (con UUID,
// nombres de columna y flechas). Usa los cambios estructurados ("cambios") y,
// para el nombre, lo que viene en "resumen". Sin barras invertidas en las regex.

export const AUDITORIA_CAMPOS = {
  precio_venta: ['Precio de venta', 'dinero'], precio_costo: ['Costo', 'dinero'],
  activo: ['Activo', 'bool'], anulada: ['Anulada', 'bool'], motivo_anulacion: ['Motivo', 'texto'],
  total_venta: ['Total', 'dinero'], medio_pago: ['Medio de pago', 'texto'],
  estado: ['Estado', 'estado'], monto_inicial: ['Monto inicial', 'dinero'],
  monto_final_real: ['Efectivo contado', 'dinero'], diferencia: ['Diferencia', 'dinero'],
  rol: ['Rol', 'texto'], nombre: ['Nombre', 'texto'], pin_seguridad: ['PIN de seguridad', 'texto'],
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMPIEZA_CON_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

export function valorAuditoria(tipo, v) {
  if (v === null || v === undefined || v === '') return 'sin dato';
  if (tipo === 'dinero' && !Number.isNaN(Number(v))) return `S/ ${Number(v).toFixed(2)}`;
  if (tipo === 'bool') return (v === true || v === 'true') ? 'Sí' : 'No';
  if (tipo === 'estado') return String(v).toUpperCase() === 'ABIERTA' ? 'abierto' : String(v).toUpperCase() === 'CERRADA' ? 'cerrado' : String(v).toLowerCase();
  return String(v);
}

export function describirAuditoria(f) {
  const cambios = f.cambios && typeof f.cambios === 'object' ? f.cambios : {};
  const m = /^[^:]+: *(.*?)(?: [(].*)?$/.exec(f.resumen || '');
  let nombre = (m && m[1] ? m[1] : '').trim();
  if (EMPIEZA_CON_UUID_RE.test(nombre)) nombre = '';
  const con = nombre ? `: ${nombre}` : '';
  let titulo;
  const op = f.operacion;
  if (f.tabla === 'productos') titulo = `Producto ${op === 'DELETE' ? 'eliminado' : 'modificado'}${con}`;
  else if (f.tabla === 'ventas') titulo = cambios.anulada && valorAuditoria('bool', cambios.anulada.despues) === 'Sí' ? `Venta anulada${con}` : `Venta ${op === 'DELETE' ? 'eliminada' : 'modificada'}${con}`;
  else if (f.tabla === 'turnos_caja') {
    const est = cambios.estado ? valorAuditoria('estado', cambios.estado.despues) : '';
    titulo = op === 'INSERT' ? 'Turno de caja abierto' : est === 'cerrado' ? 'Turno de caja cerrado' : op === 'DELETE' ? 'Turno de caja eliminado' : 'Turno de caja modificado';
  }
  else if (f.tabla === 'cajeros') titulo = `Empleado ${op === 'INSERT' ? 'creado' : op === 'DELETE' ? 'eliminado' : 'modificado'}${con}`;
  else if (f.tabla === 'mermas') titulo = `Merma ${op === 'DELETE' ? 'eliminada' : 'registrada'}${con}`;
  else titulo = (f.resumen || 'Cambio registrado').replace(UUID_RE, '').replace(/ {2,}/g, ' ').trim();
  const detalle = Object.entries(cambios)
    .filter(([k]) => !(f.tabla === 'turnos_caja' && k === 'estado'))
    .map(([k, c]) => {
      const [etq, tipo] = AUDITORIA_CAMPOS[k] || [k.replace(/_/g, ' '), 'texto'];
      const antes = c && c.antes, despues = c && c.despues;
      if (k === 'pin_seguridad') return 'PIN de seguridad cambiado';
      return (antes === null || antes === undefined || antes === '') && f.tabla === 'turnos_caja'
        ? `${etq}: ${valorAuditoria(tipo, despues)}`
        : `${etq}: ${valorAuditoria(tipo, antes)} → ${valorAuditoria(tipo, despues)}`;
    });
  return { titulo, detalle };
}
