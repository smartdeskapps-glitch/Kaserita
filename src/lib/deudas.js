// Estado de la deuda de un cliente a crédito. Funciones puras: reciben el
// saldo actual del cliente y sus boletas a crédito y devuelven qué boletas
// siguen pendientes, cuáles están vencidas y cuánto se debe de cada una.
//
// Como los abonos se descuentan del saldo total del cliente (no boleta por
// boleta), se marcan como "pagadas" las boletas más antiguas hasta cubrir lo ya
// abonado, asumiendo que los pagos cubren primero la deuda más vieja (FIFO).

const redondear2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const MS_DIA = 86400000;

export const estadoDeudor = ({ saldo, diasCredito }, boletas, ahora = Date.now()) => {
  const dias = Number(diasCredito) || 30;
  const ascendentes = [...(boletas || [])].sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
  const totalHistorico = ascendentes.reduce((acc, b) => acc + Number(b.total_venta), 0);
  const montoYaPagado = Math.max(0, +(totalHistorico - Number(saldo)).toFixed(2));
  let acumulado = 0;
  let sumaPagadas = 0;
  const conEstado = ascendentes.map((b) => {
    acumulado += Number(b.total_venta);
    const pagada = acumulado <= montoYaPagado + 0.01;
    if (pagada) sumaPagadas += Number(b.total_venta);
    const diasTranscurridos = Math.floor((ahora - new Date(b.fecha_hora).getTime()) / MS_DIA);
    const diasVencido = diasTranscurridos - dias;
    return { ...b, pagada, vencida: !pagada && diasVencido > 0, diasVencido, diasTranscurridos };
  });
  const pendientesAsc = conEstado.filter((b) => !b.pagada);
  const vencidas = pendientesAsc.filter((b) => b.vencida);
  return {
    // Todas, de la más nueva a la más vieja.
    boletas: [...conEstado].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora)),
    // Lo que aún se debe, de la más vieja a la más nueva.
    pendientesAsc,
    vencidas,
    // Lo ya abonado a la primera boleta pendiente (pago a cuenta).
    parcial: Math.max(0, redondear2(montoYaPagado - sumaPagadas)),
    vencidoMonto: redondear2(vencidas.reduce((acc, b) => acc + Number(b.total_venta), 0)),
    masVieja: pendientesAsc[0] || null
  };
};

// Cuántas boletas pendientes cubre un abono (las más viejas primero), contando
// lo que ya se había abonado a la primera.
export const coberturaPago = (estado, monto) => {
  let resto = (Number(monto) || 0) + estado.parcial;
  const ids = [];
  for (const b of estado.pendientesAsc) {
    if (resto + 0.01 >= Number(b.total_venta)) {
      resto -= Number(b.total_venta);
      ids.push(b.id);
    } else {
      break;
    }
  }
  return { cubiertas: ids.length, total: estado.pendientesAsc.length, ids };
};

// Lo que falta para cubrir la boleta pendiente más antigua.
export const restoPrimeraBoleta = (estado) =>
  estado.pendientesAsc[0] ? Math.max(0, redondear2(Number(estado.pendientesAsc[0].total_venta) - estado.parcial)) : 0;
