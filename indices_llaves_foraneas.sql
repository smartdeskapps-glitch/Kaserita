-- ============================================================
-- Kaserita: indices en llaves foraneas (aviso "unindexed_foreign_keys" del
-- asesor de rendimiento de Supabase, 2026-10-27).
--
-- ADITIVO y repetible: solo crea indices que faltan, no cambia datos ni
-- permisos. Acelera los cruces y los borrados en cascada de ventas, turnos,
-- compras, pagos y productos a medida que crece el volumen.
-- Aplicado en produccion el 2026-10-27 (migracion "indices_llaves_foraneas").
-- Para deshacer un indice: drop index public.idx_<tabla>_<columna>;
-- ============================================================

create index if not exists idx_cajeros_bodega_id on public.cajeros (bodega_id);
create index if not exists idx_combos_items_bodega_id on public.combos_items (bodega_id);
create index if not exists idx_compras_bodega_id on public.compras (bodega_id);
create index if not exists idx_compras_cajero_id on public.compras (cajero_id);
create index if not exists idx_compras_proveedor_id on public.compras (proveedor_id);
create index if not exists idx_compras_detalle_bodega_id on public.compras_detalle (bodega_id);
create index if not exists idx_compras_detalle_compra_id on public.compras_detalle (compra_id);
create index if not exists idx_compras_detalle_producto_id on public.compras_detalle (producto_id);
create index if not exists idx_mermas_bodega_id on public.mermas (bodega_id);
create index if not exists idx_mermas_cajero_id on public.mermas (cajero_id);
create index if not exists idx_mermas_producto_id on public.mermas (producto_id);
create index if not exists idx_pagos_credito_bodega_id on public.pagos_credito (bodega_id);
create index if not exists idx_pagos_credito_cajero_id on public.pagos_credito (cajero_id);
create index if not exists idx_pagos_credito_cliente_id on public.pagos_credito (cliente_id);
create index if not exists idx_pagos_proveedor_bodega_id on public.pagos_proveedor (bodega_id);
create index if not exists idx_pagos_proveedor_proveedor_id on public.pagos_proveedor (proveedor_id);
create index if not exists idx_pagos_registro_plan_id on public.pagos_registro (plan_id);
create index if not exists idx_pedidos_delivery_cliente_id on public.pedidos_delivery (cliente_id);
create index if not exists idx_productos_catalogo_maestro_id on public.productos (catalogo_maestro_id);
create index if not exists idx_productos_categoria_id on public.productos (categoria_id);
create index if not exists idx_proveedores_bodega_id on public.proveedores (bodega_id);
create index if not exists idx_tomas_inventario_producto_id on public.tomas_inventario (producto_id);
create index if not exists idx_turnos_caja_cajero_id on public.turnos_caja (cajero_id);
create index if not exists idx_usuarios_bodega_id on public.usuarios (bodega_id);
create index if not exists idx_ventas_barbero_id on public.ventas (barbero_id);
create index if not exists idx_ventas_cajero_id on public.ventas (cajero_id);
create index if not exists idx_ventas_cliente_id on public.ventas (cliente_id);
create index if not exists idx_ventas_turno_caja_id on public.ventas (turno_caja_id);
create index if not exists idx_ventas_detalle_bodega_id on public.ventas_detalle (bodega_id);
create index if not exists idx_ventas_detalle_combo_id on public.ventas_detalle (combo_id);
create index if not exists idx_ventas_detalle_producto_id on public.ventas_detalle (producto_id);
create index if not exists idx_ventas_detalle_venta_id on public.ventas_detalle (venta_id);
