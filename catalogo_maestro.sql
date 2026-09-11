-- ============================================================
-- Kaserita: catálogo maestro -- un "banco de productos" que administras
-- solo tú (descripción + categoría + foto), del que cualquier bodega
-- puede buscar e "importar" un producto a su propio inventario (le pone
-- su propio precio y stock, pero la descripción/foto/categoría ya
-- vienen listas). Así las fotos se mantienen en un solo lugar, no una
-- por cada bodega.
--
-- Requiere haber corrido antes panel_admin.sql (usa es_superadmin()) y
-- productos_fotos.sql / bloquear_fotos_bodega.sql (bucket "Productos" y
-- sus políticas de admin, que ya cubren cualquier carpeta del bucket).
--
-- Ejecutar todo este script de una sola vez en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.catalogo_maestro (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null,
  categoria text,
  cod_ean text,
  foto_url text,
  creado_en timestamptz not null default now()
);
alter table public.catalogo_maestro enable row level security;

-- Cualquier bodega con sesión puede leer el catálogo maestro completo
-- (para buscar qué importar) -- no es información sensible, es un
-- catálogo de referencia común a todas.
drop policy if exists "catalogo_maestro_select_todos" on public.catalogo_maestro;
create policy "catalogo_maestro_select_todos" on public.catalogo_maestro
  for select to authenticated using (true);

-- Solo el super-admin puede crear, editar o borrar productos del
-- catálogo maestro.
drop policy if exists "catalogo_maestro_admin_todo" on public.catalogo_maestro;
create policy "catalogo_maestro_admin_todo" on public.catalogo_maestro
  for all to authenticated
  using (es_superadmin())
  with check (es_superadmin());

-- Nota sobre las fotos: se suben al mismo bucket "Productos", carpeta
-- "maestro/{id}.jpg" en vez de "{bodega_id}/{producto_id}.jpg". Las
-- políticas de admin que ya creaste en bloquear_fotos_bodega.sql
-- (productos_fotos_insertar_admin / actualizar_admin / borrar_admin) no
-- están restringidas a una carpeta -- ya cubren esto, no hace falta
-- nada nuevo ahí.

NOTIFY pgrst, 'reload schema';
