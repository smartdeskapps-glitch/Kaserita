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
-- Stock: NO se puede vender mas de lo que hay. Si algun producto con
-- seguimiento de stock no alcanza, se rechaza la venta completa con el mensaje
-- 'Stock insuficiente de "X": hay N y se piden M.' y no se guarda nada. Los
-- productos sin seguimiento de stock (NULL) no se bloquean ni se tocan. La
-- comprobacion bloquea la fila del producto (FOR UPDATE), asi que dos cajeros
-- vendiendo lo ultimo que queda no pueden pasar los dos: el segundo es
-- rechazado. Excepcion: las ventas hechas sin conexion (p_permitir_sin_stock =
-- true, al sincronizar) ya ocurrieron en el mostrador, asi que se registran
-- igual y el stock queda en 0 como minimo.
--
-- Parametros (todos jsonb):
--   p_venta    : columnas de la venta (bodega_id, turno_caja_id, cajero_id,
--                cliente_id, nro_boleta, medio_pago, total_venta,
--                descuento_monto, utilidad_total, monto_efectivo, monto_otro,
--                [fecha_hora], [id_local]).
--   p_detalles : arreglo con las lineas del detalle (sin venta_id).
--   p_ajustes  : arreglo [{producto_id, delta}] con lo que se descuenta de stock.
--   p_credito  : null, o {cliente_id, monto} para sumar a la deuda del cliente.
--   p_permitir_sin_stock : false (por defecto) rechaza si no alcanza el stock;
--                true solo para ventas offline que se sincronizan.
-- Devuelve: { id, nro_boleta, duplicada }.
-- ============================================================

-- Se borra la version anterior (4 parametros) para que no queden dos funciones
-- con el mismo nombre: la app no sabria a cual llamar.
drop function if exists public.registrar_venta(jsonb, jsonb, jsonb, jsonb);

create or replace function public.registrar_venta(
  p_venta jsonb,
  p_detalles jsonb,
  p_ajustes jsonb default '[]'::jsonb,
  p_credito jsonb default null,
  p_permitir_sin_stock boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
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

revoke all on function public.registrar_venta(jsonb, jsonb, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.registrar_venta(jsonb, jsonb, jsonb, jsonb, boolean) to authenticated;

NOTIFY pgrst, 'reload schema';
