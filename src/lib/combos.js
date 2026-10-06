// Lógica de combos sin React: precios, margen, reparto del precio entre los
// productos que lo componen y el detalle para tickets.

// Suma de precios de lista / de costos de los productos del combo (formulario).
export const precioNormalCombo = (items) => (items || []).reduce((acc, it) => acc + it.precio_venta * it.cantidad, 0);
export const costoNormalCombo = (items) => (items || []).reduce((acc, it) => acc + it.precio_costo * it.cantidad, 0);

// Margen sobre el precio de venta. "bajo" = menos de 10%; "perdida" = precio
// por debajo del costo.
export const margenCombo = (precio, costo) => {
  const p = Number(precio) || 0;
  const c = Number(costo) || 0;
  const ganancia = p - c;
  const margenPct = p > 0 ? (ganancia / p) * 100 : 0;
  return { ganancia, margenPct, bajo: margenPct < 10, perdida: p > 0 && p < c };
};

// Convierte una línea del carrito en las líneas "reales" que se guardan en
// ventas_detalle (una por producto), repartiendo el subtotal del combo en
// proporción al precio de lista. El último componente absorbe el redondeo para
// que la suma sea EXACTAMENTE el subtotal del combo.
export const expandirLineaCombo = (item) => {
  if (!item.esCombo) return [item];
  const pesoTotal = item.itemsCombo.reduce((acc, c) => acc + c.precioVenta * c.cantidadBase, 0);
  let subtotalAsignado = 0;
  return item.itemsCombo.map((comp, i) => {
    const cantidadComponente = +(comp.cantidadBase * item.cantidad).toFixed(3);
    const esUltimo = i === item.itemsCombo.length - 1;
    let subtotalComponente;
    if (esUltimo) {
      subtotalComponente = +(item.subtotal - subtotalAsignado).toFixed(2);
    } else {
      const fraccion = pesoTotal > 0 ? (comp.precioVenta * comp.cantidadBase) / pesoTotal : 1 / item.itemsCombo.length;
      subtotalComponente = +(item.subtotal * fraccion).toFixed(2);
      subtotalAsignado = +(subtotalAsignado + subtotalComponente).toFixed(2);
    }
    return {
      productoId: comp.productoId,
      cod_ean: comp.cod_ean,
      descripcion: `${comp.descripcion} (${item.descripcion})`,
      cantidad: cantidadComponente,
      precioUnitario: cantidadComponente > 0 ? +(subtotalComponente / cantidadComponente).toFixed(2) : 0,
      precioCosto: comp.precioCosto,
      subtotal: subtotalComponente,
      unidadesStock: cantidadComponente,
      comboId: item.comboId,
    };
  });
};

// Contenido del combo para los tickets: "Coca Cola 500ml x2". [] si no es combo.
export const detalleComboTicket = (it) => {
  if (!it || !it.esCombo || !Array.isArray(it.itemsCombo)) return [];
  return it.itemsCombo.map((c) => {
    const cant = +(Number(c.cantidadBase) * Number(it.cantidad || 1)).toFixed(3);
    return `${c.descripcion} x${cant}`;
  });
};
