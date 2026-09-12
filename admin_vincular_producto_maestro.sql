-- ============================================================
-- Kaserita: le permite al super-admin vincular el producto de una bodega
-- (que ella agregó por su cuenta) con una ficha del catálogo maestro --
-- lo usa la sección "Productos de Clientes" del panel, al promover un
-- producto de un cliente al catálogo general.
--
-- Hace falta una función así porque el admin solo tiene permiso de LEER
-- productos de cualquier bodega (ver admin_lectura_backup.sql), no de
-- escribirlos -- esta función, al ser security definer, hace ese único
-- UPDATE puntual (catalogo_maestro_id) sin abrirle al admin edición
-- general sobre productos ajenos.
--
-- Requiere haber corrido antes catalogo_maestro_enlazar_foto.sql (agrega
-- la columna productos.catalogo_maestro_id).
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create or replace function public.admin_vincular_producto_maestro(p_producto_id uuid, p_catalogo_maestro_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_superadmin() then
    raise exception 'No autorizado.';
  end if;

  update productos
    set catalogo_maestro_id = p_catalogo_maestro_id
    where id = p_producto_id;
end;
$$;

grant execute on function public.admin_vincular_producto_maestro(uuid, uuid) to authenticated;

NOTIFY pgrst, 'reload schema';
