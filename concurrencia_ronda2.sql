-- ============================================================
-- Kaserita: concurrencia, ronda 2 (auditoria del 2026-09-26).
-- Ejecutar a mano en el SQL Editor de Supabase. Es ADITIVO e
-- idempotente: no cambia ni borra nada que ya funcione; solo agrega las
-- piezas que la app puede empezar a usar. Nada de esto se usa todavia
-- desde el frontend hasta que se aplique el cambio correspondiente.
--
-- Contexto: ajustar_stock, ajustar_saldo_cliente y ajustar_saldo_proveedor
-- (concurrencia_fix.sql / ajustar_stock.sql) ya hacen los ajustes de forma
-- atomica. Esto cubre lo que faltaba:
--   1) Numero de boleta correlativo por bodega, sin choques.
--   2) Ventas offline idempotentes (que un reintento no duplique la venta).
--   3) Entrada de mercaderia que inicializa el stock sin carrera.
--   4) Categorias sin duplicados (base para usar ON CONFLICT).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Correlativo de boleta por bodega y serie
-- ------------------------------------------------------------
-- Hoy la app arma "B001-" + los ultimos 8 digitos de Date.now(): no es
-- correlativo y dos ventas en el mismo milisegundo (o en dias distintos
-- con el mismo sufijo) pueden repetir numero. Esta funcion entrega el
-- siguiente numero con un UPSERT atomico: si dos cajeros piden numero a la
-- vez, Postgres los pone en fila y cada uno recibe uno distinto.

create table if not exists public.correlativos_bodega (
  bodega_id uuid not null references public.bodegas(id) on delete cascade,
  serie text not null,
  ultimo bigint not null default 0,
  primary key (bodega_id, serie)
);

alter table public.correlativos_bodega enable row level security;
-- Sin politicas: solo se toca a traves de la funcion.

create or replace function public.siguiente_correlativo(p_serie text default 'B001')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bodega_id uuid;
  v_numero bigint;
begin
  v_bodega_id := public.mi_bodega_id();
  if v_bodega_id is null then
    raise exception 'No autorizado.';
  end if;
  if p_serie is null or p_serie !~ '^[A-Z0-9]{2,6}$' then
    raise exception 'Serie inválida.';
  end if;

  insert into correlativos_bodega (bodega_id, serie, ultimo)
  values (v_bodega_id, p_serie, 1)
  on conflict (bodega_id, serie)
  do update set ultimo = correlativos_bodega.ultimo + 1
  returning ultimo into v_numero;

  return p_serie || '-' || lpad(v_numero::text, 8, '0');
end;
$$;

grant execute on function public.siguiente_correlativo(text) to authenticated;

-- ------------------------------------------------------------
-- 2) Ventas offline idempotentes
-- ------------------------------------------------------------
-- La cola offline (sincronizarVentasPendientes) inserta la venta y, si la
-- respuesta se pierde (red inestable), reintenta: sin una llave unica se
-- guardaria la misma venta dos veces. Cada venta offline ya tiene un
-- idLocal unico; se guarda como id_local y un indice unico parcial evita el
-- duplicado. El frontend usara:
--   .upsert(payload, { onConflict: 'bodega_id,id_local', ignoreDuplicates: true })

alter table public.ventas add column if not exists id_local text;

create unique index if not exists ventas_bodega_id_local_uidx
  on public.ventas (bodega_id, id_local)
  where id_local is not null;

-- ------------------------------------------------------------
-- 3) Stock que se inicializa solo si era NULL (entrada de mercaderia)
-- ------------------------------------------------------------
-- Hoy: rpc('ajustar_stock') y, si devuelve NULL, un UPDATE aparte que
-- escribe el stock -- si dos entradas del mismo producto sin seguimiento de
-- stock coinciden, ambas ven NULL y la segunda pisa a la primera. Con
-- coalesce dentro del mismo UPDATE se resuelve en una sola sentencia.

create or replace function public.ajustar_stock_inicializando(p_producto_id uuid, p_delta numeric)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nuevo numeric;
begin
  update productos
    set stock_actual = greatest(0, coalesce(stock_actual, 0) + p_delta)
    where id = p_producto_id
    returning stock_actual into v_nuevo;
  return v_nuevo;
end;
$$;

grant execute on function public.ajustar_stock_inicializando(uuid, numeric) to authenticated;

-- ------------------------------------------------------------
-- 4) Categorias unicas por bodega (para poder usar ON CONFLICT)
-- ------------------------------------------------------------
-- Si ya hay categorias repetidas en alguna bodega, el indice no se puede
-- crear: el bloque avisa en vez de fallar. Para ver los repetidos:
--   select bodega_id, lower(nombre), count(*) from categorias
--   group by 1, 2 having count(*) > 1;

do $$
begin
  create unique index if not exists categorias_bodega_nombre_uidx
    on public.categorias (bodega_id, lower(nombre));
exception
  when unique_violation then
    raise notice 'Hay categorias repetidas: limpialas y vuelve a correr este bloque.';
end $$;

NOTIFY pgrst, 'reload schema';

-- Verificacion
select proname from pg_proc
where proname in ('siguiente_correlativo', 'ajustar_stock_inicializando')
  and pronamespace = 'public'::regnamespace;
