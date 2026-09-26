-- ============================================================
-- Kaserita: resumen del periodo del dashboard sumado en la base
-- (sin tope de 1.000 filas). Ejecutar a mano en el SQL Editor de Supabase.
-- Es ADITIVO e idempotente: no cambia ni borra nada existente. Complementa a
-- dashboard_ventas_por_dia.sql (que cubre el calendario y "Ventas por mes").
--
-- Problema: las tarjetas del rango elegido (venta total, utilidad, hora pico,
-- metodos de pago, productos mas vendidos, comparacion con el periodo
-- anterior) se calculaban en el celular con las ventas traidas de la base, y
-- Supabase corta cada consulta en 1.000 filas. Con un rango largo (o una
-- bodega con mucho movimiento) los numeros salian incompletos, sin aviso.
--
-- Solucion: esta funcion calcula todo en la base y devuelve UN jsonb chico:
--   { total, utilidad, n,
--     por_hora:  { "13": {total, n}, ... },
--     por_dia:   [ {fecha, total}, ... ],
--     por_medio: { "EFECTIVO": total, ... },
--     top_productos: [ {descripcion, cantidad, monto, utilidad} ] (8 primeros),
--     anterior:  { total, utilidad } }   -- periodo previo de igual duracion
--
-- Seguridad: SECURITY INVOKER (corre con los permisos de quien la llama; las
-- politicas RLS de ventas y ventas_detalle siguen filtrando) y ademas filtra
-- por p_bodega_id. Las ventas anuladas no se cuentan. Dia y hora se calculan
-- en la zona horaria que manda la app (por defecto America/Lima).
-- ============================================================

create or replace function public.dashboard_resumen_periodo(
  p_bodega_id uuid,
  p_desde date,
  p_hasta date,
  p_zona text default 'America/Lima'
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with rango as (
    select
      (p_desde::timestamp at time zone p_zona) as ini,
      ((p_hasta + 1)::timestamp at time zone p_zona) as fin,
      ((p_desde - (p_hasta - p_desde + 1))::timestamp at time zone p_zona) as ini_ant
  ),
  ok as (
    select
      v.id,
      coalesce(v.medio_pago, 'OTRO') as medio,
      v.total_venta::numeric as total,
      coalesce(v.utilidad_total, 0)::numeric as utilidad,
      (v.fecha_hora at time zone p_zona)::date as dia,
      extract(hour from (v.fecha_hora at time zone p_zona))::int as hora
    from public.ventas v, rango r
    where v.bodega_id = p_bodega_id
      and not coalesce(v.anulada, false)
      and v.fecha_hora >= r.ini
      and v.fecha_hora <  r.fin
  ),
  top as (
    select
      coalesce(d.descripcion, 'Producto') as descripcion,
      sum(d.cantidad)::numeric as cantidad,
      sum(d.subtotal)::numeric as monto,
      sum(coalesce(d.utilidad, 0))::numeric as utilidad
    from ok
    join public.ventas_detalle d on d.venta_id = ok.id
    group by 1
    order by 3 desc
    limit 8
  ),
  ant as (
    select
      coalesce(sum(v.total_venta), 0)::numeric as total,
      coalesce(sum(coalesce(v.utilidad_total, 0)), 0)::numeric as utilidad
    from public.ventas v, rango r
    where v.bodega_id = p_bodega_id
      and not coalesce(v.anulada, false)
      and v.fecha_hora >= r.ini_ant
      and v.fecha_hora <  r.ini
  )
  select jsonb_build_object(
    'total',   coalesce((select sum(total) from ok), 0),
    'utilidad', coalesce((select sum(utilidad) from ok), 0),
    'n',       (select count(*) from ok),
    'por_hora', coalesce((
      select jsonb_object_agg(hora::text, jsonb_build_object('total', t, 'n', n))
      from (select hora, sum(total) as t, count(*) as n from ok group by hora) x
    ), '{}'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', dia, 'total', t) order by dia)
      from (select dia, sum(total) as t from ok group by dia) x
    ), '[]'::jsonb),
    'por_medio', coalesce((
      select jsonb_object_agg(medio, t)
      from (select medio, sum(total) as t from ok group by medio) x
    ), '{}'::jsonb),
    'top_productos', coalesce((
      select jsonb_agg(
        jsonb_build_object('descripcion', descripcion, 'cantidad', cantidad, 'monto', monto, 'utilidad', utilidad)
        order by monto desc
      )
      from top
    ), '[]'::jsonb),
    'anterior', (select jsonb_build_object('total', total, 'utilidad', utilidad) from ant)
  );
$$;

revoke all on function public.dashboard_resumen_periodo(uuid, date, date, text) from public, anon;
grant execute on function public.dashboard_resumen_periodo(uuid, date, date, text) to authenticated;

-- Comprobacion (opcional): reemplaza el uuid por el de tu bodega.
-- select public.dashboard_resumen_periodo('00000000-0000-0000-0000-000000000000', '2026-09-20', '2026-09-26', 'America/Lima');
