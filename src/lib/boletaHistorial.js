// Convierte una venta del historial (fila de `ventas` con ventas_detalle y clientes) al formato
// que usa el PDF de la boleta al cobrar, para poder reenviarla por WhatsApp más tarde.
// No se guarda cuánto recibió el cliente ni quién cobró, así que la boleta sale sin esos datos.
export function ventaHistorialParaBoleta(v) {
  const total = Number(v?.total_venta) || 0;
  const descuento = Number(v?.descuento_monto) || 0;
  const nombre = v?.clientes?.nombre_completo;
  return {
    nro_boleta: v?.nro_boleta,
    medio_pago: v?.medio_pago,
    total_venta: total,
    subtotal: total + descuento,
    descuento,
    items: (v?.ventas_detalle || []).map((d) => ({
      descripcion: d.productos?.descripcion || d.descripcion || 'Producto',
      cantidad: d.cantidad,
      precioUnitario: Number(d.precio_unitario) || 0,
      unidad: d.productos?.unidad || 'UND',
      subtotal: Number(d.subtotal) || 0,
    })),
    cliente: nombre && nombre !== 'Desconocido' ? nombre : 'Cliente sin registrar',
    telefono: v?.clientes?.telefono || '',
    cajero: '',
    fecha_hora: v?.fecha_hora,
    recibido: 0,
  };
}
