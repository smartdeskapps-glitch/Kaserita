-- ============================================================
-- Kaserita: ventas del dashboard agrupadas por dia (sin tope de 1.000 filas).
-- Ejecutar a mano en el SQL Editor de Supabase. Es ADITIVO e idempotente:
-- no cambia ni borra datos ni funciones existentes.
--
-- Problema: el dashboard pedia todas las ventas del anio con un SELECT y
-- Supabase responde como maximo 1.000 filas, sin avisar. Una bodega con mas
-- de 1.000 ventas en el anio veia el calendario, "Ventas por mes" y el
-- detalle del dia con montos incompletos (faltaban las mas recientes).
--
-- Solucion: esta funcion suma en la base de datos y devuelve UN solo valor
-- jsonb (una entrada por dia con venta), asi que no le aplica el tope de
-- filas y viajan ~365 renglones como maximo en vez de miles.
--
-- Seguridad: es SECURITY INVOKER, o sea corre con los permisos de quien la
-- llama; las politicas RLS de "ventas" siguen filtrando (nadie ve ventas de
-- otra bodega) y ademas se filtra por p_bodega_id.
--
-- Cada elemento del resultado:
--   { fecha: 'YYYY-MM-DD', total, n,
--     medios: { EFECTIVO: {total, n}, YAPE: {...}, ... },
--     horas:  { "13": total, "14": total, ... },
--     mixto_efectivo, mixto_otro }
-- Las ventas anuladas no se cuentan. El dia y la hora se calculan en la zona
-- horaria que manda la app (la del celular); por defecto America/Lima.
-- ============================================================

create index if not exists ventas_bodega_fecha_idx
  on public.ventas (bodega_id, fecha_hora);

create or replace function public.dashboard_ventas_por_dia(
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
  with base as (
    select
      (v.fecha_hora at time zone p_zona)::date as dia,
      extract(hour from (v.fecha_hora at time zone p_zona))::int as hora,
      coalesce(v.medio_pago, 'OTRO') as medio,
      v.total_venta::numeric as total,
      case when v.medio_pago = 'MIXTO' then coalesce(v.monto_efectivo, 0) else 0 end as mx_ef,
      case when v.medio_pago = 'MIXTO' then coalesce(v.monto_otro, 0) else 0 end as mx_ot
    from public.ventas v
    where v.bodega_id = p_bodega_id
      and not coalesce(v.anulada, false)
      and v.fecha_hora >= (p_desde::timestamp at time zone p_zona)
      and v.fecha_hora <  ((p_hasta + 1)::timestamp at time zone p_zona)
  ),
  por_dia as (
    select dia, sum(total) as total, count(*) as n, sum(mx_ef) as mx_ef, sum(mx_ot) as mx_ot
    from base
    group by dia
  ),
  por_medio as (
    select dia, jsonb_object_agg(medio, jsonb_build_object('total', total, 'n', n)) as medios
    from (
      select dia, medio, sum(total) as total, count(*) as n
      from base
      group by dia, medio
    ) x
    group by dia
  ),
  por_hora as (
    select dia, jsonb_object_agg(hora::text, total) as horas
    from (
      select dia, hora, sum(total) as total
      from base
      group by dia, hora
    ) x
    group by dia
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'fecha', d.dia,
        'total', d.total,
        'n', d.n,
        'mixto_efectivo', d.mx_ef,
        'mixto_otro', d.mx_ot,
        'medios', m.medios,
        'horas', h.horas
      )
      order by d.dia
    ),
    '[]'::jsonb
  )
  from por_dia d
  join por_medio m using (dia)
  join por_hora h using (dia);
$$;

revoke all on function public.dashboard_ventas_por_dia(uuid, date, date, text) from public, anon;
grant execute on function public.dashboard_ventas_por_dia(uuid, date, date, text) to authenticated;

-- Comprobacion (opcional): reemplaza el uuid por el de tu bodega; debe
-- devolver un arreglo con un elemento por dia con ventas.
-- select public.dashboard_ventas_por_dia('00000000-0000-0000-0000-000000000000', '2026-01-01', '2026-12-31', 'America/Lima');
