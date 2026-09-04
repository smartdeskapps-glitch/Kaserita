-- ============================================================
-- Kaserita: arregla dos huecos de concurrencia para cuando varios
-- cajeros usan la app al mismo tiempo desde dispositivos distintos.
-- Ejecutar todo este script de una sola vez en el SQL Editor de Supabase.
-- ============================================================

-- 1) Ajuste atómico de la deuda de un cliente (crédito). Antes se leía
--    saldo_actual y se volvía a escribir por separado -- si dos cajeros
--    vendían a crédito al MISMO cliente casi al mismo tiempo, uno de los
--    dos aumentos de deuda se podía perder. Con esta función, Postgres
--    bloquea la fila mientras calcula el nuevo valor, así que los ajustes
--    simultáneos se aplican uno tras otro, nunca se pisan.
create or replace function public.ajustar_saldo_cliente(p_cliente_id uuid, p_delta numeric)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nuevo numeric;
begin
  update clientes
    set saldo_actual = greatest(0, saldo_actual + p_delta)
    where id = p_cliente_id
    returning saldo_actual into v_nuevo;
  return v_nuevo;
end;
$$;

grant execute on function public.ajustar_saldo_cliente(uuid, numeric) to anon, authenticated;

-- 2) Lo mismo para la deuda con un proveedor (Cuentas por Pagar).
create or replace function public.ajustar_saldo_proveedor(p_proveedor_id uuid, p_delta numeric)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nuevo numeric;
begin
  update proveedores
    set saldo_actual = greatest(0, saldo_actual + p_delta)
    where id = p_proveedor_id
    returning saldo_actual into v_nuevo;
  return v_nuevo;
end;
$$;

grant execute on function public.ajustar_saldo_proveedor(uuid, numeric) to anon, authenticated;

-- 3) Evita que queden dos turnos de caja "abiertos" a la vez para la
--    misma bodega (por ejemplo si dos cajeros abren turno casi al mismo
--    tiempo desde dispositivos distintos). Un índice único parcial: solo
--    puede existir UNA fila con fecha_cierre nula por bodega.

-- Revisa primero si ya hay bodegas con más de un turno abierto (de
-- pruebas anteriores, por ejemplo). Si esta consulta devuelve filas, hay
-- que cerrar manualmente los turnos de más antes de seguir, o el índice
-- de abajo va a fallar al crearse.
select bodega_id, count(*) as turnos_abiertos
from turnos_caja
where fecha_cierre is null
group by bodega_id
having count(*) > 1;

create unique index if not exists turnos_caja_una_abierta
  on turnos_caja(bodega_id)
  where fecha_cierre is null;
