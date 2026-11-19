-- QR de Yape/Plin de cada bodega, guardado en la base (antes solo vivía en el navegador donde se subía).
-- Ya está aplicado en producción; este archivo es el registro. Se puede volver a correr sin problema.
-- Una fila por bodega y medio. La imagen es el QR ya recortado, como "data:image/...;base64,...".
create table if not exists public.qr_pago (
  bodega_id uuid not null references public.bodegas(id) on delete cascade,
  medio text not null check (medio in ('YAPE', 'PLIN')),
  imagen text not null check (imagen like 'data:image/%' and length(imagen) <= 600000),
  actualizado timestamptz not null default now(),
  primary key (bodega_id, medio)
);
alter table public.qr_pago enable row level security;
revoke all on public.qr_pago from anon;

drop policy if exists qr_pago_select on public.qr_pago;
create policy qr_pago_select on public.qr_pago for select to authenticated
  using (bodega_id = (select public.mi_bodega_id()));
drop policy if exists qr_pago_insert on public.qr_pago;
create policy qr_pago_insert on public.qr_pago for insert to authenticated
  with check (bodega_id = (select public.mi_bodega_id()));
drop policy if exists qr_pago_update on public.qr_pago;
create policy qr_pago_update on public.qr_pago for update to authenticated
  using (bodega_id = (select public.mi_bodega_id()))
  with check (bodega_id = (select public.mi_bodega_id()));
drop policy if exists qr_pago_delete on public.qr_pago;
create policy qr_pago_delete on public.qr_pago for delete to authenticated
  using (bodega_id = (select public.mi_bodega_id()));
