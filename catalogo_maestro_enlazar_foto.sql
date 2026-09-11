-- ============================================================
-- Kaserita: enlaza cada producto importado del catálogo maestro con su
-- ficha maestra, para que si más adelante le agregas o cambias la foto
-- en el maestro, se actualice sola en todas las bodegas que ya lo
-- tienen -- hoy la foto se copiaba una sola vez al momento de importar
-- y quedaba desconectada para siempre.
--
-- Un producto creado a mano (no importado del maestro) simplemente
-- queda con catalogo_maestro_id = null y sigue mostrando su propia
-- foto/ícono de categoría como hasta ahora -- esto no cambia nada para
-- ellos.
--
-- Ejecutar en el SQL Editor de Supabase. Requiere haber corrido antes
-- catalogo_maestro.sql.
-- ============================================================

alter table public.productos
  add column if not exists catalogo_maestro_id uuid references public.catalogo_maestro(id) on delete set null;

NOTIFY pgrst, 'reload schema';
