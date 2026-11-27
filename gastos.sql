-- Kaserita: registro de gastos del negocio (alquiler, luz, sueldos, etc.)
-- para poder ver cuánto queda realmente: utilidad de ventas - gastos.
-- Cada bodega solo ve y escribe sus propias filas (mismo patrón que mermas).
-- Ya aplicado en producción (2026-11-26).

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null,
  fecha date not null default ((now() at time zone 'America/Lima')::date),
  monto numeric(12,2) not null check (monto > 0),
  categoria text not null,
  descripcion text,
  cajero_id uuid,
  creado_en timestamptz not null default now()
);

create index if not exists gastos_bodega_fecha_idx on public.gastos (bodega_id, fecha desc);

alter table public.gastos enable row level security;

drop policy if exists gastos_select on public.gastos;
drop policy if exists gastos_insert on public.gastos;
drop policy if exists gastos_update on public.gastos;
drop policy if exists gastos_delete on public.gastos;

create policy gastos_select on public.gastos for select to authenticated
  using (bodega_id = (select mi_bodega_id()));
create policy gastos_insert on public.gastos for insert to authenticated
  with check (bodega_id = (select mi_bodega_id()));
create policy gastos_update on public.gastos for update to authenticated
  using (bodega_id = (select mi_bodega_id()))
  with check (bodega_id = (select mi_bodega_id()));
create policy gastos_delete on public.gastos for delete to authenticated
  using (bodega_id = (select mi_bodega_id()));

revoke all on public.gastos from anon;
grant select, insert, update, delete on public.gastos to authenticated;

notify pgrst, 'reload schema';
