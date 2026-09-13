-- ============================================================
-- Kaserita: respaldo en Supabase del conteo de "Toma de Inventario" que
-- todavía está en curso (Paso 1, antes de guardarlo). Antes ese progreso
-- solo se guardaba en el localStorage del navegador -- si se perdía el
-- celular, se borraba la caché, o se cambiaba de dispositivo a la mitad
-- de un conteo de cientos de productos, se perdía todo. Con esta tabla
-- queda respaldado también del lado del servidor.
--
-- Una sola fila por bodega (bodega_id es la llave primaria): mientras se
-- cuenta, la app la va actualizando (upsert) cada pocos segundos; al
-- terminar y guardar la toma de inventario (o si se vacía a propósito),
-- se borra.
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create table if not exists tomas_inventario_borrador (
  bodega_id uuid primary key,
  datos jsonb not null default '[]'::jsonb,
  actualizado_en timestamptz not null default now()
);

alter table tomas_inventario_borrador enable row level security;

-- Mismo patrón de RLS que "tomas_inventario": cada bodega solo ve/escribe
-- su propio borrador.
drop policy if exists "tomas_inventario_borrador por bodega" on tomas_inventario_borrador;
create policy "tomas_inventario_borrador por bodega" on tomas_inventario_borrador
  for all using (bodega_id = mi_bodega_id()) with check (bodega_id = mi_bodega_id());

grant select, insert, update, delete on tomas_inventario_borrador to authenticated;

NOTIFY pgrst, 'reload schema';
