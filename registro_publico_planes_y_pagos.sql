-- Kaserita: base para el registro público de bodegas (/registro) -- planes
-- con precio configurable, y el rastro de pagos que conecta "pagué" con
-- "ya puedo crear mi bodega" sin depender de nada que se pierda si el
-- cliente cierra la pestaña a mitad de camino.
--
-- Ejecutar en el SQL Editor de Supabase. Requiere panel_admin.sql (usa
-- es_superadmin() indirectamente a través de admin_crear_bodega, y la
-- estructura de bodegas/usuarios ya existente).

-- ============================================================
-- 1) Planes -- precio editable sin tocar código, insertá/actualizá filas
--    acá para cambiar precios más adelante.
-- ============================================================

create table if not exists public.planes_kaserita (
  id text primary key,                    -- 'pos' | 'combo'
  nombre text not null,
  precio_soles numeric(10,2) not null,     -- precio normal
  precio_soles_promo numeric(10,2),        -- precio con descuento (null = sin promo)
  meses_promo integer,                     -- cuántos pagos de esa cuenta usan el precio promo
  permite_delivery boolean not null default false,
  activo boolean not null default true
);

insert into public.planes_kaserita (id, nombre, precio_soles, precio_soles_promo, meses_promo, permite_delivery)
values
  ('pos', 'Punto de Venta', 30.00, null, null, false),
  ('combo', 'Punto de Venta + Catálogo Online', 54.90, 49.90, 6, true)
on conflict (id) do update set
  nombre = excluded.nombre,
  precio_soles = excluded.precio_soles,
  precio_soles_promo = excluded.precio_soles_promo,
  meses_promo = excluded.meses_promo,
  permite_delivery = excluded.permite_delivery;

alter table public.planes_kaserita enable row level security;

drop policy if exists "planes_lectura_publica" on public.planes_kaserita;
create policy "planes_lectura_publica"
  on public.planes_kaserita for select
  using (true);

grant select on public.planes_kaserita to anon, authenticated;

-- ============================================================
-- 2) combo_primer_pago_en -- para saber, en cada renovación, si a esa
--    bodega todavía le toca el precio promo o ya pasó a precio normal.
-- ============================================================

alter table public.bodegas add column if not exists combo_primer_pago_en timestamptz;

-- ============================================================
-- 3) pagos_registro -- el pago se confirma ANTES de pedir los datos de
--    la bodega (nombre, DNI, celular) -- esta tabla es lo que evita que
--    un pago confirmado quede "perdido" si el cliente cierra la pestaña
--    antes de terminar: como ya está logueado con Google en ese momento,
--    auth_id identifica exactamente de quién es la plata, y si vuelve a
--    entrar con la misma cuenta de Google más tarde, puede retomar desde
--    "Tu bodega" sin pagar de nuevo.
-- ============================================================

create table if not exists public.pagos_registro (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.planes_kaserita(id),
  monto_cobrado numeric(10,2) not null,
  culqi_charge_id text not null,
  estado text not null default 'pagado' check (estado in ('pagado', 'bodega_creada')),
  creado_en timestamptz not null default now()
);

create index if not exists pagos_registro_auth_idx on public.pagos_registro (auth_id, estado);

alter table public.pagos_registro enable row level security;

drop policy if exists "pago_registro_lee_el_propio" on public.pagos_registro;
create policy "pago_registro_lee_el_propio"
  on public.pagos_registro for select
  to authenticated
  using (auth_id = auth.uid());

-- Sin política de insert/update para authenticated a propósito: los
-- escribe únicamente la Edge Function cobrar-plan-culqi, con service
-- role (que ignora RLS) -- así el monto y el estado "pagado" solo los
-- puede poner el servidor después de confirmar el cobro con Culqi, nunca
-- el navegador.

-- ============================================================
-- 4) crear_bodega_post_pago -- paso 3 del registro ("Tu bodega"). Exige
--    un pago confirmado (pagos_registro) para la cuenta de Google que
--    está llamando -- sin eso, no crea nada.
-- ============================================================

create or replace function public.crear_bodega_post_pago(
  p_nombre_bodega text,
  p_dni text,
  p_celular text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago record;
  v_plan record;
  v_bodega_id uuid;
  v_nombre_dueno text;
begin
  if auth.uid() is null then
    raise exception 'No autorizado.';
  end if;

  if exists (select 1 from usuarios where auth_id = auth.uid()) then
    raise exception 'Ya tenés una bodega creada con esta cuenta.';
  end if;

  if coalesce(trim(p_nombre_bodega), '') = '' then
    raise exception 'Ingresá el nombre de tu bodega.';
  end if;
  if p_dni !~ '^\d{8}$' then
    raise exception 'El DNI debe tener 8 dígitos.';
  end if;
  if p_celular !~ '^\d{9}$' then
    raise exception 'El celular debe tener 9 dígitos.';
  end if;

  select * into v_pago
    from pagos_registro
    where auth_id = auth.uid() and estado = 'pagado'
    order by creado_en desc
    limit 1;

  if v_pago is null then
    raise exception 'No encontramos un pago confirmado para tu cuenta. Completá el pago primero.';
  end if;

  select * into v_plan from planes_kaserita where id = v_pago.plan_id;

  -- Google ya nos dio el nombre -- lo usamos para la fila de "dueño" en
  -- vez de pedirlo de nuevo en el formulario.
  select coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
    into v_nombre_dueno
    from auth.users where id = auth.uid();

  insert into bodegas (nombre, activa, activa_hasta, delivery_permitido, combo_primer_pago_en)
  values (
    trim(p_nombre_bodega),
    true,
    current_date + interval '1 month',
    v_plan.permite_delivery,
    case when v_plan.permite_delivery then now() else null end
  )
  returning id into v_bodega_id;

  insert into usuarios (bodega_id, nombre, dni, telefono, rol, activo, auth_id)
  values (v_bodega_id, coalesce(v_nombre_dueno, 'Dueño'), trim(p_dni), trim(p_celular), 'dueno', true, auth.uid());

  update pagos_registro set estado = 'bodega_creada' where id = v_pago.id;

  return v_bodega_id;
exception
  when unique_violation then
    raise exception 'Ese DNI ya tiene una bodega registrada.';
end;
$$;

grant execute on function public.crear_bodega_post_pago(text, text, text) to authenticated;

-- ============================================================
-- 5) mi_pago_pendiente -- para cuando alguien vuelve a entrar con Google
--    después de pagar pero sin terminar "Tu bodega": el frontend llama
--    esto para saber si tiene que arrancar en el paso 1 (plan), o saltar
--    directo al paso 3 (ya pagó, solo le falta cargar los datos).
-- ============================================================

create or replace function public.mi_pago_pendiente()
returns table (plan_id text, monto_cobrado numeric)
language sql
stable
security definer
set search_path = public
as $$
  select plan_id, monto_cobrado
  from pagos_registro
  where auth_id = auth.uid() and estado = 'pagado'
  order by creado_en desc
  limit 1;
$$;

grant execute on function public.mi_pago_pendiente() to authenticated;

NOTIFY pgrst, 'reload schema';
