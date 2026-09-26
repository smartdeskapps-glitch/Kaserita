-- ============================================================
-- Kaserita: registrar una venta en UNA sola transaccion.
-- Ejecutar a mano en el SQL Editor de Supabase. Es ADITIVO e idempotente:
-- crea una funcion nueva, no cambia ni borra nada existente. La app la usa
-- apenas exista; mientras no se ejecute, la app sigue con el camino de antes.
--
-- Problema: al cobrar, la app hacia varios pasos separados desde el celular:
--   1) guardar la venta, 2) guardar su detalle, 3) sumar la deuda del cliente
--   (si era a credito), 4) descontar el stock producto por producto.
-- Si internet se cortaba o algo fallaba entre pasos quedaban ventas sin
-- detalle, ventas sin descuento de stock o deuda sin registrar, y la app solo
-- podia avisarlo para corregirlo a mano.
--
-- Solucion: esta funcion hace los cuatro pasos juntos. O se guarda todo, o no
-- se guarda nada (si algo falla, Postgres deshace la venta completa).
--
-- Idempotencia: si la venta trae id_local y ya existe (un reintento despues de
-- perder la respuesta de la red), NO se repite nada y se devuelve la venta
-- ya guardada con duplicada = true.
--
-- Seguridad: SECURITY INVOKER. Corre con los permisos de quien la llama, asi
-- que las politicas RLS de ventas, ventas_detalle, productos y clientes siguen
-- aplicando igual que cuando la app insertaba directo.
--
-- Stock: se mantiene la regla actual (ajustar_stock): el stock nunca baja de 0
-- y no se bloquea la venta por falta de stock, porque el conteo de una bodega
-- suele estar desactualizado y el cajero debe poder cobrar lo que tiene en la
-- mano. Los productos con stock sin seguimiento (NULL) no se tocan.
--
-- Parametros (todos jsonb):
--   p_venta    : columnas de la venta (bodega_id, turno_caja_id, cajero_id,
--                cliente_id, nro_boleta, medio_pago, total_venta,
--                descuento_monto, utilidad_total, monto_efectivo, monto_otro,
--                [fecha_hora], [id_local]).
--   p_detalles : arreglo con las lineas del detalle (sin venta_id).
--   p_ajustes  : arreglo [{producto_id, delta}] con lo que se descuenta de stock.
--   p_credito  : null, o {cliente_id, monto} para sumar a la deuda del cliente.
-- Devuelve: { id, nro_boleta, duplicada }.
-- ============================================================

create or replace function public.registrar_venta(
  p_venta jsonb,
  p_detalles jsonb,
  p_ajustes jsonb default '[]'::jsonb,
  p_credito jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id bigint;
  v_boleta text;
  v_bodega uuid;
  v_id_local text;
  r record;
begin
  v_bodega := (p_venta->>'bodega_id')::uuid;
  v_id_local := nullif(p_venta->>'id_local', '');

  -- 1) La venta. Si ya existe una con el mismo id_local, no se inserta.
  insert into public.ventas (
    bodega_id, turno_caja_id, cajero_id, cliente_id, nro_boleta, medio_pago,
    total_venta, descuento_monto, utilidad_total, monto_efectivo, monto_otro,
    fecha_hora, id_local
  )
  select
    x.bodega_id, x.turno_caja_id, x.cajero_id, x.cliente_id, x.nro_boleta, x.medio_pago,
    x.total_venta, x.descuento_monto, x.utilidad_total, x.monto_efectivo, x.monto_otro,
    coalesce(x.fecha_hora, now()), x.id_local
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
    perform public.ajustar_stock(r.producto_id, r.delta);
  end loop;

  return jsonb_build_object('id', v_id, 'nro_boleta', v_boleta, 'duplicada', false);
end;
$$;

revoke all on function public.registrar_venta(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_venta(jsonb, jsonb, jsonb, jsonb) to authenticated;

NOTIFY pgrst, 'reload schema';
