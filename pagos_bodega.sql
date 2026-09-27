-- ============================================================
-- Kaserita: historial de pagos de las bodegas.
-- Ejecutar a mano en el SQL Editor de Supabase. Es ADITIVO: crea una tabla
-- y dos funciones nuevas; no cambia ni borra nada existente.
--
-- Para qué: hoy "registrar un pago" solo suma días a la vigencia y no queda
-- ningún rastro. Con esto cada cobro (por Yape, efectivo o transferencia)
-- queda anotado: quién pagó, cuánto, qué plan, cuántos días se sumaron y a qué
-- fecha pasó a vencer. El panel de administrador lo muestra como "Historial de
-- pagos" de cada bodega y suma lo cobrado en el mes.
--
-- Seguridad: solo el super-administrador puede ver o registrar pagos
-- (es_superadmin()). Las bodegas NO ven esta tabla. No hay políticas de
-- escritura directa: solo se escribe con las funciones de abajo.
-- ============================================================

alter table public.bodegas add column if not exists combo_primer_pago_en timestamptz;

create table if not exists public.pagos_bodega (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null references public.bodegas(id) on delete cascade,
  fecha_pago date not null default current_date,
  monto numeric(10,2) not null check (monto >= 0),
  medio text not null default 'yape',
  plan_nombre text,
  con_catalogo boolean,
  dias integer not null default 30 check (dias >= 0),
  vence_antes date,
  vence_despues date,
  nota text,
  anulado boolean not null default false,
  anulado_en timestamptz,
  motivo_anulacion text,
  registrado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create index if not exists pagos_bodega_bodega_fecha_idx
  on public.pagos_bodega (bodega_id, fecha_pago desc);

alter table public.pagos_bodega enable row level security;

drop policy if exists "pagos_bodega_superadmin_select" on public.pagos_bodega;
create policy "pagos_bodega_superadmin_select" on public.pagos_bodega
  for select to authenticated using (es_superadmin());

revoke all on public.pagos_bodega from anon;

-- ------------------------------------------------------------
-- Registrar un pago: en UNA transaccion anota el pago, suma los dias a la
-- vigencia (desde el vencimiento actual, o desde hoy si ya vencio), deja la
-- bodega activa y, si el pago es de otro plan, cambia el plan (prende o
-- apaga "Pedidos WhatsApp"). Con p_dias = 0 solo anota el pago (por ejemplo
-- para cargar un cobro antiguo sin mover la vigencia).
-- ------------------------------------------------------------
create or replace function public.admin_registrar_pago_bodega(
  p_bodega_id uuid,
  p_monto numeric,
  p_dias integer default 30,
  p_plan_id text default null,
  p_medio text default 'yape',
  p_nota text default null,
  p_fecha date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.bodegas%rowtype;
  v_plan public.planes_kaserita%rowtype;
  v_con_catalogo boolean;
  v_plan_nombre text;
  v_antes date;
  v_despues date;
  v_id uuid;
begin
  if not es_superadmin() then
    raise exception 'No autorizado.';
  end if;
  if p_monto is null or p_monto < 0 then
    raise exception 'El monto no es válido.';
  end if;
  if p_dias is null or p_dias < 0 or p_dias > 400 then
    raise exception 'Los días deben estar entre 0 y 400.';
  end if;

  select * into v_b from public.bodegas where id = p_bodega_id for update;
  if not found then
    raise exception 'La bodega no existe.';
  end if;

  v_con_catalogo := coalesce(v_b.delivery_permitido, false);
  if p_plan_id is not null then
    select * into v_plan from public.planes_kaserita where id = p_plan_id;
    if not found then
      raise exception 'El plan no existe.';
    end if;
    v_con_catalogo := v_plan.permite_delivery;
    v_plan_nombre := v_plan.nombre;
  else
    select nombre into v_plan_nombre
    from public.planes_kaserita
    where permite_delivery = v_con_catalogo
    order by precio_soles
    limit 1;
  end if;

  v_antes := v_b.activa_hasta;
  if p_dias > 0 then
    v_despues := greatest(coalesce(v_antes, current_date), current_date) + p_dias;
  else
    v_despues := v_antes;
  end if;

  update public.bodegas
  set delivery_permitido = v_con_catalogo,
      delivery_habilitado = case when v_con_catalogo then delivery_habilitado else false end,
      combo_primer_pago_en = case when v_con_catalogo and combo_primer_pago_en is null then now() else combo_primer_pago_en end,
      activa = case when p_dias > 0 then true else activa end,
      activa_hasta = v_despues
  where id = p_bodega_id;

  insert into public.pagos_bodega (
    bodega_id, fecha_pago, monto, medio, plan_nombre, con_catalogo,
    dias, vence_antes, vence_despues, nota
  )
  values (
    p_bodega_id, coalesce(p_fecha, current_date), p_monto,
    coalesce(nullif(trim(p_medio), ''), 'yape'), v_plan_nombre, v_con_catalogo,
    p_dias, v_antes, v_despues, nullif(trim(p_nota), '')
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'vence_despues', v_despues);
end;
$$;

revoke all on function public.admin_registrar_pago_bodega(uuid, numeric, integer, text, text, text, date) from public, anon;
grant execute on function public.admin_registrar_pago_bodega(uuid, numeric, integer, text, text, text, date) to authenticated;

-- ------------------------------------------------------------
-- Anular un pago cargado por error: lo marca como anulado (queda en el
-- historial, no se borra) y le quita a la bodega los dias que ese pago habia
-- sumado. No deshace un cambio de plan.
-- ------------------------------------------------------------
create or replace function public.admin_anular_pago_bodega(
  p_pago_id uuid,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.pagos_bodega%rowtype;
begin
  if not es_superadmin() then
    raise exception 'No autorizado.';
  end if;

  select * into v_p from public.pagos_bodega where id = p_pago_id for update;
  if not found then
    raise exception 'El pago no existe.';
  end if;
  if v_p.anulado then
    raise exception 'Ese pago ya está anulado.';
  end if;

  update public.pagos_bodega
  set anulado = true,
      anulado_en = now(),
      motivo_anulacion = coalesce(nullif(trim(p_motivo), ''), 'Sin motivo')
  where id = p_pago_id;

  if v_p.dias > 0 then
    update public.bodegas
    set activa_hasta = activa_hasta - v_p.dias
    where id = v_p.bodega_id and activa_hasta is not null;
  end if;
end;
$$;

revoke all on function public.admin_anular_pago_bodega(uuid, text) from public, anon;
grant execute on function public.admin_anular_pago_bodega(uuid, text) to authenticated;

NOTIFY pgrst, 'reload schema';
