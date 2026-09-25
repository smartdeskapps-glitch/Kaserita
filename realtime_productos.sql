-- ============================================================
-- Realtime para el catálogo de productos
-- ============================================================
-- El POS escucha los cambios de la tabla `productos` de su bodega
-- (stock, precio, nombre, foto, altas y bajas) y los aplica al
-- instante, sin recargar el catálogo. Los cambios llegan filtrados
-- por RLS: cada usuario solo recibe los de su propia bodega.
--
-- Es idempotente: se puede correr más de una vez.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'productos'
  ) then
    alter publication supabase_realtime add table public.productos;
  end if;
end $$;

-- Comprobación: debe devolver una fila con la tabla `productos`.
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'productos';
