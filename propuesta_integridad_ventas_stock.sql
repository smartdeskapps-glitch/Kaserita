-- ============================================================
-- Kaserita: PROPUESTA de integridad para ventas, stock y caja.
-- NO está ejecutada. Revisar y ejecutar a mano en el SQL Editor de Supabase.
-- Todo es aditivo y reversible (al final hay un bloque de reversa).
--
-- Se probó contra los datos reales (solo lectura, 17-nov-2026): 482 ventas,
-- 0 con total distinto al detalle, 0 sin detalle, 0 subtotales incoherentes,
-- 0 productos con stock negativo, 0 id_local repetidos, 16 ventas MIXTO con el
-- desglose efectivo + otro igual al total. Por eso las restricciones de abajo se
-- pueden agregar sin que falle ninguna fila existente.
-- ============================================================

-- 1) Restricciones: la base rechaza lo que no tiene sentido, aunque el cliente falle.
--    NOT VALID + VALIDATE: no bloquea la tabla y comprueba las filas viejas aparte.
alter table public.ventas
  add constraint ventas_importes_check
    check (total_venta >= 0 and coalesce(descuento_monto, 0) >= 0) not valid,
  add constraint ventas_mixto_cuadra_check
    check (medio_pago <> 'MIXTO'
           or abs(coalesce(monto_efectivo, 0) + coalesce(monto_otro, 0) - total_venta) <= 0.02) not valid;
alter table public.ventas_detalle
  add constraint ventas_detalle_importes_check
    check (cantidad > 0 and precio_unitario >= 0 and subtotal >= 0) not valid;
alter table public.productos
  add constraint productos_precios_stock_check
    check (precio_venta >= 0 and coalesce(precio_costo, 0) >= 0
           and (stock_actual is null or stock_actual >= 0)) not valid;

alter table public.ventas validate constraint ventas_importes_check;
alter table public.ventas validate constraint ventas_mixto_cuadra_check;
alter table public.ventas_detalle validate constraint ventas_detalle_importes_check;
alter table public.productos validate constraint productos_precios_stock_check;

-- 2) Total de la venta = suma del detalle - descuento, comprobado por la base al confirmar.
--    Hoy esa cuenta solo la hace el celular; si un cliente viejo o manipulado enviara otro
--    total, se guardaría igual. Es "deferred": se evalúa al final de la transacción de
--    registrar_venta, cuando ya están la cabecera y todas las líneas.
create or replace function public.verificar_total_venta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_total numeric;
  v_detalle numeric;
  v_desc numeric;
begin
  select total_venta, coalesce(descuento_monto, 0) into v_total, v_desc
    from public.ventas where id = new.venta_id;
  if not found then
    return null;
  end if;
  select coalesce(sum(subtotal), 0) into v_detalle
    from public.ventas_detalle where venta_id = new.venta_id;
  if abs(v_total - (v_detalle - v_desc)) > 0.02 then
    raise exception 'El total de la venta (%) no coincide con su detalle (%) menos el descuento (%).',
      v_total, v_detalle, v_desc;
  end if;
  return null;
end;
$$;

drop trigger if exists verificar_total_venta on public.ventas_detalle;
create constraint trigger verificar_total_venta
  after insert on public.ventas_detalle
  deferrable initially deferred
  for each row execute function public.verificar_total_venta();

-- 3) Historial de movimientos de stock: quién, cuándo, cuánto y por qué.
--    Hoy hay tablas por tipo (ventas, compras, mermas, tomas) pero ninguna lista única
--    del stock de un producto, y ajustar_stock no deja rastro.
create table if not exists public.movimientos_stock (
  id bigint generated always as identity primary key,
  bodega_id uuid not null,
  producto_id uuid not null references public.productos(id) on delete cascade,
  delta numeric not null,
  stock_antes numeric,
  stock_despues numeric,
  -- Lo que pidió el movimiento y no se pudo aplicar porque el stock quedaría negativo.
  -- Sin este dato, una venta sin conexión que se anula después devolvería más de lo que sacó.
  faltante numeric not null default 0,
  motivo text,
  auth_id uuid default auth.uid(),
  creado timestamptz not null default now()
);
create index if not exists movimientos_stock_producto_idx on public.movimientos_stock (producto_id, creado desc);
create index if not exists movimientos_stock_bodega_idx on public.movimientos_stock (bodega_id, creado desc);
alter table public.movimientos_stock enable row level security;
drop policy if exists movimientos_stock_lectura on public.movimientos_stock;
create policy movimientos_stock_lectura on public.movimientos_stock
  for select to authenticated using (bodega_id = (select public.mi_bodega_id()));

-- ajustar_stock deja de borrar en silencio lo que no alcanza: lo anota en `faltante`.
-- Mantiene la misma firma (la app no cambia). SECURITY INVOKER, igual que ahora.
create or replace function public.ajustar_stock(p_producto_id uuid, p_delta numeric)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  v_antes numeric;
  v_nuevo numeric;
  v_bodega uuid;
begin
  select stock_actual, bodega_id into v_antes, v_bodega
    from public.productos
    where id = p_producto_id and stock_actual is not null
    for update;
  if not found then
    return null;
  end if;
  v_nuevo := greatest(0, v_antes + p_delta);
  update public.productos set stock_actual = v_nuevo where id = p_producto_id;
  insert into public.movimientos_stock (bodega_id, producto_id, delta, stock_antes, stock_despues, faltante, motivo)
    values (v_bodega, p_producto_id, v_nuevo - v_antes, v_antes, v_nuevo,
            greatest(0, v_nuevo - (v_antes + p_delta)), null);
  return v_nuevo;
end;
$$;

-- 4) Índice que falta según el asesor de Supabase.
create index if not exists elevaciones_admin_cajero_id_idx on public.elevaciones_admin (cajero_id);

-- ============================================================
-- REVERSA (si algo no gusta):
--   drop trigger if exists verificar_total_venta on public.ventas_detalle;
--   drop function if exists public.verificar_total_venta();
--   alter table public.ventas drop constraint if exists ventas_importes_check, drop constraint if exists ventas_mixto_cuadra_check;
--   alter table public.ventas_detalle drop constraint if exists ventas_detalle_importes_check;
--   alter table public.productos drop constraint if exists productos_precios_stock_check;
--   -- ajustar_stock: volver a la versión de ajustar_stock.sql
--   drop table if exists public.movimientos_stock;
--   drop index if exists public.elevaciones_admin_cajero_id_idx;
--
-- NO incluido a propósito (cambia reglas de negocio, decidir primero):
--   * Qué hacer al anular una venta hecha sin conexión cuyo stock quedó recortado en 0:
--     con `faltante` en el historial se puede devolver solo lo que de verdad salió.
--   * Reescribir las políticas RLS con (select auth.uid()) y unir las políticas
--     duplicadas de SELECT (aviso de rendimiento del asesor): conviene hacerlo tabla por tabla.
-- ============================================================
