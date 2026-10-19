-- ============================================================
-- Kaserita: barbero y comision (barberia, paso 2)
-- Ejecutar a mano en el SQL Editor de Supabase DESPUES de
-- tipo_negocio_barberia.sql. Aditivo e idempotente: no borra datos y las
-- ventas de las bodegas siguen igual (barbero_id queda en NULL).
--
--  - ventas.barbero_id : el barbero (fila de cajeros) que atendio la venta.
--  - cajeros.comision_pct : su % de comision sobre los servicios (0 a 100).
--  - registrar_venta : misma funcion de siempre, solo que ahora tambien
--    guarda barbero_id al insertar la venta.
-- ============================================================

alter table public.ventas add column if not exists barbero_id uuid references public.cajeros(id) on delete set null;
create index if not exists ventas_barbero_fecha_idx on public.ventas (bodega_id, barbero_id, fecha_hora) where barbero_id is not null;

alter table public.cajeros add column if not exists comision_pct numeric(5,2) not null default 0;
do $$
begin
  alter table public.cajeros add constraint cajeros_comision_pct_check check (comision_pct >= 0 and comision_pct <= 100);
exception
  when duplicate_object then null;
end $$;

-- cajeros tiene permisos POR COLUMNA (para esconder pin_seguridad): sin este
-- grant, leer comision_pct da "permission denied for table cajeros".
grant select (comision_pct) on public.cajeros to authenticated;
revoke insert (comision_pct), update (comision_pct) on public.cajeros from anon;
grant update (comision_pct) on public.cajeros to authenticated;

-- Dos porcentajes por barbero: comision_pct = sobre los SERVICIOS (cortes...)
-- y comision_productos_pct = sobre los PRODUCTOS que ayuda a vender.
alter table public.cajeros add column if not exists comision_productos_pct numeric(5,2) not null default 0;
do $$
begin
  alter table public.cajeros add constraint cajeros_comision_productos_pct_check check (comision_productos_pct >= 0 and comision_productos_pct <= 100);
exception
  when duplicate_object then null;
end $$;
grant select (comision_productos_pct), update (comision_productos_pct) on public.cajeros to authenticated;
revoke insert (comision_productos_pct), update (comision_productos_pct) on public.cajeros from anon;

create or replace function public.registrar_venta(
  p_venta jsonb,
  p_detalles jsonb,
  p_ajustes jsonb default '[]'::jsonb,
  p_credito jsonb default null,
  p_permitir_sin_stock boolean default false
)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_id public.ventas.id%type;
  v_boleta text;
  v_bodega uuid;
  v_id_local text;
  v_stock numeric;
  v_desc text;
  r record;
begin
  v_bodega := (p_venta->>'bodega_id')::uuid;
  v_id_local := nullif(p_venta->>'id_local', '');

  -- 1) La venta. Si ya existe una con el mismo id_local, no se inserta.
  insert into public.ventas (
    bodega_id, turno_caja_id, cajero_id, cliente_id, nro_boleta, medio_pago,
    total_venta, descuento_monto, utilidad_total, monto_efectivo, monto_otro,
    fecha_hora, id_local, barbero_id
  )
  select
    x.bodega_id, x.turno_caja_id, x.cajero_id, x.cliente_id, x.nro_boleta, x.medio_pago,
    x.total_venta, x.descuento_monto, x.utilidad_total, x.monto_efectivo, x.monto_otro,
    coalesce(x.fecha_hora, now()), x.id_local, x.barbero_id
  from jsonb_populate_record(null::public.ventas, p_venta) x
  on conflict (bodega_id, id_local) where id_local is not null do nothing
  returning id, nro_boleta into v_id, v_boleta;

  if v_id is null then
    -- Reintento de una venta que ya se guardo completa: no se repite nada.
    select id, nro_boleta into v_id, v_boleta
    from public.ventas
    where bodega_id = v_bodega and id_local = v_id_local;
    return jsonb_build_object('id', v_id, 'nro_boleta', v_boleta, 'duplicada', true);
  end if;

  -- 2) El detalle.
  insert into public.ventas_detalle (
    venta_id, bodega_id, producto_id, combo_id, cod_ean, descripcion, cantidad,
    precio_unitario, precio_costo, subtotal, utilidad, unidades_stock
  )
  select
    v_id, d.bodega_id, d.producto_id, d.combo_id, d.cod_ean, d.descripcion, d.cantidad,
    d.precio_unitario, d.precio_costo, d.subtotal, d.utilidad, d.unidades_stock
  from jsonb_populate_recordset(null::public.ventas_detalle, p_detalles) d;

  -- 3) La deuda del cliente, si fue a credito.
  if p_credito is not null and p_credito ? 'cliente_id' and (p_credito->>'cliente_id') is not null then
    perform public.ajustar_saldo_cliente((p_credito->>'cliente_id')::uuid, (p_credito->>'monto')::numeric);
  end if;

  -- 4) El stock. Se suma por producto y se aplica siempre en el mismo orden
  --    (por producto_id): asi dos ventas simultaneas con los mismos productos
  --    no se bloquean entre si (evita el "deadlock").
  for r in
    select a.producto_id, sum(a.delta) as delta
    from jsonb_to_recordset(coalesce(p_ajustes, '[]'::jsonb)) as a(producto_id uuid, delta numeric)
    where a.producto_id is not null
    group by a.producto_id
    order by a.producto_id
  loop
    if r.delta < 0 and not coalesce(p_permitir_sin_stock, false) then
      select stock_actual, descripcion into v_stock, v_desc
      from public.productos
      where id = r.producto_id
      for update;
      if v_stock is not null and v_stock < -r.delta then
        raise exception 'Stock insuficiente de "%": hay % y se piden %.',
          coalesce(v_desc, 'producto'), trim_scale(v_stock), trim_scale(-r.delta);
      end if;
    end if;
    perform public.ajustar_stock(r.producto_id, r.delta);
  end loop;

  return jsonb_build_object('id', v_id, 'nro_boleta', v_boleta, 'duplicada', false);
end;
$$;

NOTIFY pgrst, 'reload schema';
