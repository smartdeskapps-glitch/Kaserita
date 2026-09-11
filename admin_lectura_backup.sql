-- ============================================================
-- Kaserita: permite al super-admin LEER (no escribir) los datos de
-- cualquier bodega -- lo necesita el botón "Backup" del panel para poder
-- armar el archivo, porque hasta ahora esas tablas solo eran visibles
-- para la propia bodega dueña de los datos (bodega_id = mi_bodega_id(),
-- que para el admin siempre da null).
--
-- Se agrega como una política PERMISSIVE adicional de solo SELECT en
-- cada tabla -- Postgres combina varias políticas permisivas con OR, así
-- que esto no afecta en nada los permisos que ya tenía cada bodega sobre
-- sus propios datos, ni le da al admin permiso de insertar/editar/borrar
-- por esta vía (eso sigue reservado a admin_eliminar_bodega y a lo que
-- cada bodega hace con sus propias filas).
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array['cajeros','clientes','productos','compras',
                            'compras_detalle','ventas','ventas_detalle',
                            'turnos_caja','mermas','pagos_credito',
                            'categorias','proveedores','pagos_proveedor',
                            'tomas_inventario']
  loop
    execute format('drop policy if exists "%1$s_admin_select" on %1$I', t);
    execute format('create policy "%1$s_admin_select" on %1$I for select using (es_superadmin())', t);
  end loop;
end $$;

NOTIFY pgrst, 'reload schema';
