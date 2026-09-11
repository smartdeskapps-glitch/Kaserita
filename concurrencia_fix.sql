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

-- 3) Evita que un mismo CAJERO tenga dos turnos de caja "abiertos" a la
--    vez (ej. dos dispositivos suyos abriendo turno casi al mismo
--    tiempo). Ya NO es "una sola caja por bodega" -- ahora la app deja
--    que varios cajeros de la misma bodega tengan cada uno su propia
--    caja abierta en paralelo (varias registradoras a la vez), así que
--    el índice único pasa a ser por (bodega_id, cajero_id) en vez de
--    solo bodega_id.

-- Si ya existe el índice viejo (una sola caja por BODEGA, sin importar
-- el cajero), se borra -- si no, el "if exists" no falla igual.
drop index if exists turnos_caja_una_abierta;

-- Diagnóstico -- cajeros con más de un turno abierto ahora mismo (de
-- pruebas anteriores, por ejemplo). Solo informativo: el paso de abajo
-- ya los cierra automáticamente antes de crear el índice.
select bodega_id, cajero_id, count(*) as turnos_abiertos
from turnos_caja
where fecha_cierre is null
group by bodega_id, cajero_id
having count(*) > 1;

-- Cierra los duplicados: por cada (bodega, cajero) con más de un turno
-- "abierto", deja abierto solo el más reciente y cierra los demás con
-- el mismo criterio manual que se usaba antes (monto_final_real =
-- monto_inicial, sin diferencia) -- así el índice único de abajo se
-- puede crear sin fallar.
with turnos_a_cerrar as (
  select id
  from (
    select id, row_number() over (partition by bodega_id, cajero_id order by fecha_apertura desc) as orden
    from turnos_caja
    where fecha_cierre is null
  ) ranked
  where orden > 1
)
update turnos_caja
set fecha_cierre = now(),
    estado = 'CERRADA',
    monto_final_real = monto_inicial,
    ventas_sistema = 0,
    diferencia = 0
where id in (select id from turnos_a_cerrar);

-- Verificación: debería devolver 0 filas antes de crear el índice.
select bodega_id, cajero_id, count(*) as turnos_abiertos
from turnos_caja
where fecha_cierre is null
group by bodega_id, cajero_id
having count(*) > 1;

create unique index if not exists turnos_caja_una_abierta_por_cajero
  on turnos_caja(bodega_id, cajero_id)
  where fecha_cierre is null;

NOTIFY pgrst, 'reload schema';
