-- ============================================================
-- Arregla admin_registrar_pago_bodega: se creó con p_plan_id como uuid,
-- pero el id de planes_kaserita en realidad es texto ('pos' / 'combo').
-- Por eso al registrar un pago con el plan "Combo" salía el error:
--   invalid input syntax for type uuid: "combo"
--
-- Postgres no deja cambiar el tipo de un parámetro con "create or
-- replace", así que primero hay que borrar la función vieja (con su
-- firma exacta) y volver a crearla con el tipo correcto.
--
-- Ejecutar a mano en el SQL Editor de Supabase. No borra datos: los
-- pagos que ya se registraron antes de este error no se tocan.
-- ============================================================

drop function if exists public.admin_registrar_pago_bodega(uuid, numeric, integer, uuid, text, text, date);

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

NOTIFY pgrst, 'reload schema';
