-- Kaserita: /registro no revisaba si la cuenta de Google que está
-- entrando YA tiene una bodega creada -- solo miraba si había un pago
-- "pagado" sin usar. Si alguien pagó más de una vez durante pruebas (o
-- por error), quedaba un pago viejo sin reclamar que lo mandaba de
-- nuevo a "Retomá tu registro" aunque ya tuviera su cuenta activa.
--
-- Ejecutar a mano en el SQL Editor de Supabase. Requiere
-- registro_publico_planes_y_pagos.sql.

-- Paso 1: nueva función -- el frontend la consulta ANTES que
-- mi_pago_pendiente() para saber si ya no hay nada que registrar.
create or replace function public.tengo_bodega()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from usuarios where auth_id = auth.uid());
$$;

grant execute on function public.tengo_bodega() to authenticated;

-- Paso 2: crear_bodega_post_pago ahora limpia TODOS los pagos "pagado"
-- sueltos de esa cuenta al crear la bodega (no solo el más reciente),
-- para que un doble pago accidental no deje un pago fantasma dando
-- vueltas.
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

  -- Limpia CUALQUIER pago "pagado" suelto de esta cuenta (no solo el que
  -- se acaba de usar) -- si hubo más de un cobro por error/doble intento,
  -- no queda ninguno fantasma dando vueltas.
  update pagos_registro set estado = 'bodega_creada' where auth_id = auth.uid() and estado = 'pagado';

  return v_bodega_id;
exception
  when unique_violation then
    raise exception 'Ese DNI ya tiene una bodega registrada.';
end;
$$;

grant execute on function public.crear_bodega_post_pago(text, text, text) to authenticated;

-- Paso 3: limpieza puntual -- tu bodega de prueba ("Bogeda Prueba") ya
-- existe, así que esto marca como resueltos los pagos "pagado" sueltos
-- que quedaron de las pruebas anteriores.
update pagos_registro p
set estado = 'bodega_creada'
where p.estado = 'pagado'
  and exists (select 1 from usuarios u where u.auth_id = p.auth_id);

NOTIFY pgrst, 'reload schema';
