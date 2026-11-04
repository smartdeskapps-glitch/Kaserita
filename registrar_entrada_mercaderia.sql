-- ============================================================
-- Kaserita: registrar una entrada de mercadería en UNA sola transacción.
-- Ejecutar a mano en el SQL Editor de Supabase. Aditivo e idempotente: crea
-- una función nueva. La app la usa apenas exista; mientras no se ejecute,
-- sigue con el camino de antes.
--
-- Problema: la app hacía 2 viajes de red (compra + detalle) y luego 2 a 3 por
-- cada línea (sumar stock y actualizar el costo), sin transacción y sin revisar
-- el error del costo. Si internet fallaba a mitad, quedaba la compra guardada
-- con el stock o el costo a medias. Con la base en Oregón, una factura de 30
-- líneas eran ~60 viajes.
--
-- Solución: todo junto. O se guarda la compra con su detalle, el stock sumado
-- y el costo nuevo de cada producto, o no se guarda nada.
--
-- Seguridad: SECURITY INVOKER. Corre con los permisos de quien llama: aplican
-- las políticas RLS por bodega y, si ya se ejecutó autorizacion_por_rol.sql,
-- los triggers que exigen la administración desbloqueada (compras y costos).
-- La bodega la pone el servidor (mi_bodega_id), no el navegador.
--
-- Parámetros:
--   p_compra: { cajero_id, proveedor_nombre, nro_factura, total }
--   p_items : [ { producto_id, cantidad, costo_unitario, subtotal, unidades_stock } ]
--             unidades_stock = lo que se suma al stock (unidades base; con
--             packs puede ser distinto de cantidad).
-- Devuelve: { compra_id, lineas }
-- ============================================================

create or replace function public.registrar_entrada_mercaderia(p_compra jsonb, p_items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bodega uuid := public.mi_bodega_id();
  v_compra_id uuid;
  v_lineas integer;
  r record;
begin
  if v_bodega is null then
    raise exception 'No autorizado.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La entrada no tiene productos.';
  end if;
  if jsonb_array_length(p_items) > 500 then
    raise exception 'La entrada tiene demasiadas líneas (máximo 500).';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) it
    where (it->>'producto_id') is null
       or coalesce((it->>'cantidad')::numeric, 0) <= 0
       or coalesce((it->>'unidades_stock')::numeric, 0) <= 0
       or coalesce((it->>'costo_unitario')::numeric, -1) < 0
  ) then
    raise exception 'Revisa las cantidades y costos de la entrada.';
  end if;

  insert into compras (bodega_id, cajero_id, proveedor_nombre, nro_factura, total, fecha_registro)
  values (
    v_bodega,
    nullif(p_compra->>'cajero_id', '')::uuid,
    nullif(trim(coalesce(p_compra->>'proveedor_nombre', '')), ''),
    coalesce(nullif(trim(coalesce(p_compra->>'nro_factura', '')), ''), 'COMP-' || to_char(now(), 'YYMMDDHH24MISS')),
    coalesce((p_compra->>'total')::numeric, 0),
    now()
  )
  returning id into v_compra_id;

  insert into compras_detalle (compra_id, bodega_id, producto_id, cantidad, costo_unitario, subtotal)
  select v_compra_id, v_bodega,
         (it->>'producto_id')::uuid,
         (it->>'cantidad')::numeric,
         (it->>'costo_unitario')::numeric,
         coalesce((it->>'subtotal')::numeric, (it->>'cantidad')::numeric * (it->>'costo_unitario')::numeric)
  from jsonb_array_elements(p_items) it;
  get diagnostics v_lineas = row_count;

  -- Stock y costo por producto. Si un producto aparece en dos líneas se suman
  -- las unidades y queda el costo de la última. Siempre en el mismo orden (por
  -- id) para no bloquearse con una venta simultánea.
  for r in
    select x.producto_id,
           sum(x.unidades) as unidades,
           (array_agg(x.costo order by x.orden desc))[1] as costo
    from (
      select (e.it->>'producto_id')::uuid as producto_id,
             (e.it->>'unidades_stock')::numeric as unidades,
             (e.it->>'costo_unitario')::numeric as costo,
             e.orden
      from jsonb_array_elements(p_items) with ordinality as e(it, orden)
    ) x
    group by x.producto_id
    order by x.producto_id
  loop
    update productos
       set stock_actual = greatest(0, coalesce(stock_actual, 0) + r.unidades),
           precio_costo = r.costo
     where id = r.producto_id and bodega_id = v_bodega;
    if not found then
      raise exception 'Uno de los productos de la entrada ya no existe en tu negocio.';
    end if;
  end loop;

  return jsonb_build_object('compra_id', v_compra_id, 'lineas', v_lineas);
end;
$$;

revoke all on function public.registrar_entrada_mercaderia(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_entrada_mercaderia(jsonb, jsonb) to authenticated;

NOTIFY pgrst, 'reload schema';
