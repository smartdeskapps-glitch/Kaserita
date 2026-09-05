-- ============================================================
-- Kaserita: Toma de Inventario (conteo físico vs. sistema)
-- Ejecutar todo este script de una sola vez en el SQL Editor de Supabase.
-- ============================================================

-- Cada fila es un producto que se contó en una toma de inventario: cuánto
-- decía el sistema, cuánto se contó físicamente, y la diferencia. Queda
-- como historial/auditoría -- igual que "mermas" -- para poder revisar
-- después por qué cambió el stock de un producto.
create table if not exists tomas_inventario (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null,
  producto_id uuid not null references productos(id),
  cajero_id uuid,
  fecha timestamptz not null default now(),
  stock_sistema numeric not null,
  stock_contado numeric not null,
  diferencia numeric not null
);

alter table tomas_inventario enable row level security;

-- Mismo patrón de RLS que el resto de tablas de este proyecto: cada bodega
-- solo ve/escribe sus propias filas.
create policy "tomas_inventario por bodega" on tomas_inventario
  for all using (bodega_id = mi_bodega_id()) with check (bodega_id = mi_bodega_id());

grant select, insert on tomas_inventario to anon, authenticated;

NOTIFY pgrst, 'reload schema';
