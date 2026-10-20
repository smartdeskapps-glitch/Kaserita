// Historial de ventas: rangos de fechas rápidos y resumen de un conjunto de
// ventas. Funciones puras. Las ventas anuladas nunca suman: ese dinero no
// entró (o se devolvió).

const redondear2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Fecha local como "AAAA-MM-DD" (la hora del negocio, no la UTC).
export const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Rangos rápidos del selector: 'hoy', 'ayer', '7' (últimos 7 días contando
// hoy) y 'mes' (desde el día 1 del mes en curso hasta hoy).
export const fechasDeRango = (clave, hoy = new Date()) => {
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const haceDias = (n) => {
    const d = new Date(base);
    d.setDate(d.getDate() - n);
    return d;
  };
  if (clave === 'ayer') return { desde: isoLocal(haceDias(1)), hasta: isoLocal(haceDias(1)) };
  if (clave === '7') return { desde: isoLocal(haceDias(6)), hasta: isoLocal(base) };
  if (clave === 'mes') return { desde: isoLocal(new Date(base.getFullYear(), base.getMonth(), 1)), hasta: isoLocal(base) };
  return { desde: isoLocal(base), hasta: isoLocal(base) };
};

// Resumen de las ventas vigentes: cuántas, cuánto, ganancia, promedio, cuánto
// entró por cada medio de pago y a qué hora. De una venta mixta, la parte en
// efectivo cuenta como EFECTIVO y el resto como OTRO.
export const resumenVentas = (ventas) => {
  const lista = Array.isArray(ventas) ? ventas.filter(Boolean) : [];
  const vigentes = lista.filter((v) => !v.anulada);
  const porMedio = {};
  const porHora = {};
  let total = 0;
  let utilidad = 0;
  vigentes.forEach((v) => {
    const monto = Number(v.total_venta) || 0;
    total += monto;
    utilidad += Number(v.utilidad_total) || 0;
    if (v.medio_pago === 'MIXTO') {
      porMedio.EFECTIVO = (porMedio.EFECTIVO || 0) + (Number(v.monto_efectivo) || 0);
      porMedio.OTRO = (porMedio.OTRO || 0) + (Number(v.monto_otro) || 0);
    } else {
      const clave = v.medio_pago || 'OTRO';
      porMedio[clave] = (porMedio[clave] || 0) + monto;
    }
    const hora = new Date(v.fecha_hora).getHours();
    if (!Number.isNaN(hora)) porHora[hora] = (porHora[hora] || 0) + monto;
  });
  Object.keys(porMedio).forEach((k) => { porMedio[k] = redondear2(porMedio[k]); });
  Object.keys(porHora).forEach((k) => { porHora[k] = redondear2(porHora[k]); });
  return {
    n: vigentes.length,
    total: redondear2(total),
    utilidad: redondear2(utilidad),
    ticket: vigentes.length ? redondear2(total / vigentes.length) : 0,
    porMedio,
    porHora,
    anuladas: lista.length - vigentes.length
  };
};
