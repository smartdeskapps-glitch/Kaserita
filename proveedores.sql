-- ============================================================
-- Kaserita: Cuentas por Pagar (proveedores)
-- Ejecutar todo este script de una sola vez en el SQL Editor de Supabase.
-- ============================================================

create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null references bodegas(id),
  nombre text not null,
  ruc text,
  telefono text,
  saldo_actual numeric not null default 0,
  creado_en timestamptz not null default now()
);

create table if not exists pagos_proveedor (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null references bodegas(id),
  proveedor_id uuid not null references proveedores(id),
  monto numeric not null,
  nota text,
  fecha_hora timestamptz not null default now()
);

alter table proveedores enable row level security;
alter table pagos_proveedor enable row level security;

drop policy if exists "proveedores_select" on proveedores;
drop policy if exists "proveedores_insert" on proveedores;
drop policy if exists "proveedores_update" on proveedores;
drop policy if exists "proveedores_delete" on proveedores;
create policy "proveedores_select" on proveedores for select using (bodega_id = mi_bodega_id());
create policy "proveedores_insert" on proveedores for insert with check (bodega_id = mi_bodega_id());
create policy "proveedores_update" on proveedores for update using (bodega_id = mi_bodega_id()) with check (bodega_id = mi_bodega_id());
create policy "proveedores_delete" on proveedores for delete using (bodega_id = mi_bodega_id());

drop policy if exists "pagos_proveedor_select" on pagos_proveedor;
drop policy if exists "pagos_proveedor_insert" on pagos_proveedor;
create policy "pagos_proveedor_select" on pagos_proveedor for select using (bodega_id = mi_bodega_id());
create policy "pagos_proveedor_insert" on pagos_proveedor for insert with check (bodega_id = mi_bodega_id());
