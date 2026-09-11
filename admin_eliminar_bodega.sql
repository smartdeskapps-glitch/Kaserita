-- ============================================================
-- Kaserita: elimina una bodega y absolutamente todos sus datos --
-- ventas, compras, clientes, productos, turnos de caja, mermas, créditos,
-- proveedores, fotos que hubiera subido, sus usuarios y su cuenta de
-- acceso -- pensado para dar de baja definitivamente a un negocio que ya
-- no usa el sistema (o limpiar una bodega de prueba).
--
-- Es IRREVERSIBLE -- por eso valida que quien llama sea super-admin, y
-- desde el panel se exige escribir el nombre exacto de la bodega antes
-- de habilitar el botón. Conviene descargar el backup primero (botón de
-- al lado).
--
-- El orden de los DELETE respeta las llaves foráneas que no tienen
-- "on delete cascade" (proveedores, tomas_inventario, mermas, usuarios):
-- esas se borran antes que la tabla que referencian.
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create or replace function public.admin_eliminar_bodega(p_bodega_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_ids uuid[];
begin
  if not es_superadmin() then
    raise exception 'No autorizado.';
  end if;

  select array_agg(auth_id) into v_auth_ids
    from usuarios where bodega_id = p_bodega_id and auth_id is not null;

  delete from pagos_proveedor where bodega_id = p_bodega_id;
  delete from proveedores where bodega_id = p_bodega_id;
  delete from tomas_inventario where bodega_id = p_bodega_id;
  delete from mermas where bodega_id = p_bodega_id;

  -- compras_detalle / ventas_detalle no tienen bodega_id propio -- se
  -- borran solas por "on delete cascade" al borrar su cabecera.
  delete from compras where bodega_id = p_bodega_id;
  delete from ventas where bodega_id = p_bodega_id;

  delete from pagos_credito where bodega_id = p_bodega_id;
  delete from clientes where bodega_id = p_bodega_id;
  delete from productos where bodega_id = p_bodega_id;
  delete from categorias where bodega_id = p_bodega_id;
  delete from turnos_caja where bodega_id = p_bodega_id;
  delete from cajeros where bodega_id = p_bodega_id;
  delete from usuarios where bodega_id = p_bodega_id;

  -- Fotos que la bodega hubiera subido antes de bloquear esa función.
  delete from storage.objects
    where bucket_id = 'Productos' and name like (p_bodega_id::text || '/%');

  -- Cuenta(s) de acceso de esta bodega -- se borran de Auth también, para
  -- no dejar un correo ocupado que nadie más va a poder volver a usar.
  if v_auth_ids is not null then
    delete from auth.users where id = any(v_auth_ids);
  end if;

  delete from bodegas where id = p_bodega_id;
end;
$$;

grant execute on function public.admin_eliminar_bodega(uuid) to authenticated;

NOTIFY pgrst, 'reload schema';
