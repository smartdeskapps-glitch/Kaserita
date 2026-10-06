// Resúmenes del Dashboard de ventas. Funciones puras: reciben filas de `ventas`
// (con `ventas_detalle` anidado) y devuelven lo mismo que las funciones SQL
// dashboard_resumen_periodo y dashboard_ventas_por_dia. Se usan en modo demo y
// como plan B si esas funciones aún no existen. Las ventas anuladas no cuentan.
import { fechaISOLocal } from './fechas.js';

// Variación porcentual contra el período anterior. Sin base anterior devuelve
// 100 si hay ventas y 0 si no (la pantalla oculta ese 100: no significa nada).
export const calcularCambioPct = (actual, anterior) => {
  if (anterior === 0) return actual > 0 ? 100 : 0;
  return ((actual - anterior) / anterior) * 100;
};

// Resumen de un período con la misma forma que devuelve la función SQL.
export const resumirVentasPeriodo = (filas, filasAnterior) => {
  const validas = (filas || []).filter((v) => !v.anulada);
  const r = { total: 0, utilidad: 0, n: validas.length, por_hora: {}, por_dia: [], por_medio: {}, top_productos: [], anterior: { total: 0, utilidad: 0 } };
  const dias = {};
  const prod = {};
  validas.forEach((v) => {
    const monto = Number(v.total_venta) || 0;
    r.total += monto;
    r.utilidad += Number(v.utilidad_total) || 0;
    const f = new Date(v.fecha_hora);
    const h = f.getHours();
    r.por_hora[h] = { total: (r.por_hora[h]?.total || 0) + monto, n: (r.por_hora[h]?.n || 0) + 1 };
    const dia = fechaISOLocal(f);
    dias[dia] = (dias[dia] || 0) + monto;
    const medio = v.medio_pago || 'OTRO';
    r.por_medio[medio] = (r.por_medio[medio] || 0) + monto;
    (v.ventas_detalle || []).forEach((d) => {
      const clave = d.descripcion || 'Producto';
      if (!prod[clave]) prod[clave] = { descripcion: clave, cantidad: 0, monto: 0, utilidad: 0 };
      prod[clave].cantidad += Number(d.cantidad) || 0;
      prod[clave].monto += Number(d.subtotal) || 0;
      prod[clave].utilidad += Number(d.utilidad) || 0;
    });
  });
  r.por_dia = Object.entries(dias).sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, total]) => ({ fecha, total }));
  r.top_productos = Object.values(prod).sort((a, b) => b.monto - a.monto).slice(0, 8);
  (filasAnterior || []).filter((v) => !v.anulada).forEach((v) => {
    r.anterior.total += Number(v.total_venta) || 0;
    r.anterior.utilidad += Number(v.utilidad_total) || 0;
  });
  return r;
};

// Agrupa filas de `ventas` por día (hora local): { fecha, total, n, medios,
// horas, mixto_efectivo, mixto_otro }, ordenado de menor a mayor fecha.
export const agruparVentasPorDia = (filas) => {
  const porFecha = new Map();
  (filas || []).forEach((v) => {
    if (v.anulada) return;
    const f = new Date(v.fecha_hora);
    const fecha = fechaISOLocal(f);
    let d = porFecha.get(fecha);
    if (!d) {
      d = { fecha, total: 0, n: 0, medios: {}, horas: {}, mixto_efectivo: 0, mixto_otro: 0 };
      porFecha.set(fecha, d);
    }
    const monto = Number(v.total_venta) || 0;
    const medio = v.medio_pago || 'OTRO';
    d.total += monto;
    d.n += 1;
    d.medios[medio] = { total: (d.medios[medio]?.total || 0) + monto, n: (d.medios[medio]?.n || 0) + 1 };
    d.horas[f.getHours()] = (d.horas[f.getHours()] || 0) + monto;
    if (medio === 'MIXTO') {
      d.mixto_efectivo += Number(v.monto_efectivo) || 0;
      d.mixto_otro += Number(v.monto_otro) || 0;
    }
  });
  return [...porFecha.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
};
