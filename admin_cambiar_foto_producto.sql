-- ============================================================
-- Kaserita: el super-admin cambia la foto de un producto de CUALQUIER bodega.
-- (Ya aplicado en Supabase el 2026-11-17.) Es aditivo: crea una función nueva.
--
-- Por qué una función: la política de UPDATE de "productos" solo deja a cada bodega editar
-- los suyos (bodega_id = mi_bodega_id()); el super-admin puede LEER todos pero no escribir en los
-- de otra bodega. La función corre como dueño de la tabla, pero solo si es_superadmin() y solo
-- acepta direcciones del bucket público "Productos" de este proyecto. El trigger de auditoría
-- de "productos" registra el cambio igual.
--
-- La subida del archivo a Storage la hace el panel con la política que ya existe para
-- el super-admin (productos_fotos_insertar_admin / _actualizar_admin).
--
-- REVERSA: drop function if exists public.admin_cambiar_foto_producto(uuid, text);
-- ============================================================

create or replace function public.admin_cambiar_foto_producto(p_producto_id uuid, p_foto_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'No autorizado.';
  end if;
  if p_foto_url is not null
     and p_foto_url !~ '^https://hzmrsbeamtbloudmxjrp\.supabase\.co/storage/v1/object/public/Productos/' then
    raise exception 'Dirección de foto no válida.';
  end if;
  update public.productos set foto_url = p_foto_url where id = p_producto_id;
  if not found then
    raise exception 'Producto no encontrado.';
  end if;
end;
$$;

revoke all on function public.admin_cambiar_foto_producto(uuid, text) from public, anon;
grant execute on function public.admin_cambiar_foto_producto(uuid, text) to authenticated;

NOTIFY pgrst, 'reload schema';
