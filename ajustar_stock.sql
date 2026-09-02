-- ============================================================
-- Kaserita: ajuste de stock atómico (evita condición de carrera
-- cuando dos cajeros venden el mismo producto casi al mismo tiempo).
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create or replace function public.ajustar_stock(p_producto_id uuid, p_delta numeric)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nuevo numeric;
begin
  -- Todo en una sola sentencia UPDATE: Postgres bloquea la fila mientras
  -- calcula el nuevo valor, así que dos ventas simultáneas del mismo
  -- producto se aplican una tras otra, nunca se pisan entre sí.
  -- Si el producto no tiene stock_actual (no se le hace seguimiento de
  -- stock), no se toca -- devuelve NULL y el llamador lo ignora.
  update productos
    set stock_actual = greatest(0, stock_actual + p_delta)
    where id = p_producto_id and stock_actual is not null
    returning stock_actual into v_nuevo;
  return v_nuevo;
end;
$$;

grant execute on function public.ajustar_stock(uuid, numeric) to anon, authenticated;
