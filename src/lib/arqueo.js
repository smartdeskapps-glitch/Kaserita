// Cálculos del arqueo y cierre de caja. Funciones puras: reciben las filas de
// `ventas` del turno y devuelven números. Las ventas anuladas NUNCA cuentan
// (ese dinero no entró o se devolvió); además de filtrarlas en la consulta, se
// descartan aquí como segunda barrera.

const redondear2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const vigentes = (ventas) => (Array.isArray(ventas) ? ventas : []).filter((v) => v && !v.anulada);

// Efectivo que entró físicamente a la caja: ventas 100% en efectivo + la parte
// en efectivo de las ventas mixtas.
export const efectivoEntrante = (ventas) =>
  vigentes(ventas).reduce((acc, v) => {
    if (v.medio_pago === 'EFECTIVO') return acc + (Number(v.total_venta) || 0);
    if (v.medio_pago === 'MIXTO') return acc + (Number(v.monto_efectivo) || 0);
    return acc;
  }, 0);

// Solo informativo: cuánto se vendió en cada medio que NO es efectivo, para
// cruzarlo con el POS de tarjeta, Yape, etc. De una venta mixta se toma solo
// la parte que no fue efectivo.
export const desgloseMediosPago = (ventas) => {
  const d = { YAPE: 0, PLIN: 0, TARJETA: 0, CREDITO: 0, MIXTO_OTRO: 0 };
  vigentes(ventas).forEach((v) => {
    if (v.medio_pago === 'MIXTO') d.MIXTO_OTRO += Number(v.monto_otro) || 0;
    else if (Object.prototype.hasOwnProperty.call(d, v.medio_pago)) d[v.medio_pago] += Number(v.total_venta) || 0;
  });
  return d;
};

// "Deberías tener" en la caja: fondo inicial + efectivo del turno.
export const esperadoEnCaja = (montoInicial, ventas) =>
  redondear2((Number(montoInicial) || 0) + efectivoEntrante(ventas));

// Positivo = sobra dinero, negativo = falta.
export const diferenciaArqueo = (contado, esperado) =>
  redondear2((parseFloat(contado) || 0) - (Number(esperado) || 0));
