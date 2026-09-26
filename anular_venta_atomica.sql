-- ============================================================
-- Kaserita: anular una boleta en UNA sola transaccion.
-- Ejecutar a mano en el SQL Editor de Supabase. Es ADITIVO e idempotente:
-- crea una funcion nueva, no cambia ni borra nada existente. La app la usa
-- apenas exista; mientras no se ejecute, anular sigue funcionando como antes.
--
-- Problema: anular una boleta hacia varios pasos separados desde el celular
-- (revertir la deuda del cliente, marcar la venta como anulada y devolver el
-- stock producto por producto). Si internet se cortaba o un paso fallaba
-- quedaba, por ejemplo, la deuda revertida sin que la boleta se anulara, o la
-- boleta anulada sin devolver el stock. Ademas, dos personas anulando la misma
-- boleta a la vez podian devolver el stock dos veces.
--
-- Solucion: esta funcion hace todo junto. O se anula completa (boleta + deuda
-- + stock), o no cambia nada. La fila de la venta se bloquea mientras se
-- anula (FOR UPDATE), asi que si dos personas intentan anularla a la vez, solo
-- la primera devuelve stock y deuda; la segunda recibe ya_anulada = true.
--
-- Seguridad: SECURITY INVOKER. Corre con los permisos de quien la llama; las
-- politicas RLS de ventas, ventas_detalle, productos y clientes siguen
-- aplicando igual que cuando la app lo hacia por pasos. Si la boleta no es de
-- su bodega, no la ve y la funcion responde que no existe. El trigger de
-- auditoria de "ventas" sigue registrando la anulacion.
--
-- p_venta_id se recibe como texto y se convierte al tipo real de ventas.id, asi
-- funciona igual si el id es numerico o uuid.
-- Devuelve: { id, nro_boleta, ya_anulada }.
-- ============================================================

create or replace function public.anular_venta(
  p_venta_id text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v record;
  d record;
  v_filas integer;
begin
  execute format(
    'select id, bodega_id, medio_pago, cliente_id, total_venta, nro_boleta, coalesce(anulada, false) as anulada
       from public.ventas where id = %L for update',
    p_venta_id
  ) into v;
  get diagnostics v_filas = row_count;

  if v_filas = 0 then
    raise exception 'La boleta no existe o no tenés permiso para anularla.';
  end if;

  if v.anulada then
    return jsonb_build_object('id', v.id, 'nro_boleta', v.nro_boleta, 'ya_anulada', true);
  end if;

  -- 1) Marcar la boleta como anulada (soft-delete: se conserva el historial).
  update public.ventas
    set anulada = true,
        motivo_anulacion = coalesce(nullif(trim(p_motivo), ''), 'Sin motivo especificado')
    where id = v.id;

  -- 2) Si era a credito, revertir la deuda del cliente.
  if v.medio_pago = 'CREDITO' and v.cliente_id is not null then
    perform public.ajustar_saldo_cliente(v.cliente_id, -v.total_venta);
  end if;

  -- 3) Devolver el stock. Se usa unidades_stock (lo que de verdad se descontó,
  --    en unidades base) y, si es una venta vieja sin esa columna, cantidad.
  --    Siempre en el mismo orden (por producto_id) para no bloquearse con otra
  --    operacion simultanea.
  for d in
    select producto_id, sum(coalesce(unidades_stock, cantidad)) as unidades
    from public.ventas_detalle
    where venta_id = v.id and producto_id is not null
    group by producto_id
    order by producto_id
  loop
    perform public.ajustar_stock(d.producto_id, d.unidades);
  end loop;

  return jsonb_build_object('id', v.id, 'nro_boleta', v.nro_boleta, 'ya_anulada', false);
end;
$$;

revoke all on function public.anular_venta(text, text) from public, anon;
grant execute on function public.anular_venta(text, text) to authenticated;

NOTIFY pgrst, 'reload schema';
