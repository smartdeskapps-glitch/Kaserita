-- Deshace revocar_privilegios_anon.sql: devuelve a "anon" exactamente los
-- permisos que tenia antes (copiados de la base el 2026-10-27).
-- Usar solo si algo publico (registro, reclamos, tienda Delivery) deja de funcionar.

grant DELETE, INSERT, UPDATE on public.bodegas to anon;
grant DELETE, INSERT, UPDATE on public.bodegas_delivery to anon;
grant DELETE, INSERT, UPDATE on public.cajeros to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.catalogo_maestro to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.categorias to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.clientes to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.combos to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.combos_delivery to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.combos_items to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.compras to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.compras_detalle to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.correlativos_bodega to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.intentos_pin_cajero to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.intentos_reclamo_pin to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.libro_reclamaciones to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.mermas to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.pagos_credito to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.pagos_proveedor to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.pagos_registro to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.planes_kaserita to anon;
grant DELETE, INSERT, UPDATE on public.productos to anon;
grant DELETE, INSERT, UPDATE on public.productos_delivery to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.proveedores to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.reseteos_pin to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.super_admins to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.tomas_inventario to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.tomas_inventario_borrador to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.turnos_caja to anon;
grant DELETE, INSERT, UPDATE on public.usuarios to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.ventas to anon;
grant DELETE, INSERT, SELECT, UPDATE on public.ventas_detalle to anon;
