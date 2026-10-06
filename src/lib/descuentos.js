// Descuento sobre el total de la venta (% o monto fijo). Nunca negativo ni
// mayor al propio total; el porcentaje se limita a 100.
export const calcularDescuento = ({ tipo, valor, total }) => {
  if (!tipo) return 0;
  const v = parseFloat(valor) || 0;
  if (v <= 0) return 0;
  const t = Number(total) || 0;
  const monto = tipo === 'PORCENTAJE' ? t * (Math.min(v, 100) / 100) : v;
  return +Math.min(Math.max(monto, 0), t).toFixed(2);
};
