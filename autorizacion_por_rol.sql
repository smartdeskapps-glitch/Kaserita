-- ============================================================
-- Kaserita: autorización por rol EN EL SERVIDOR (hallazgo A3).
-- Ejecutar a mano en el SQL Editor de Supabase. Es idempotente.
--
-- Problema: todos los empleados comparten la sesión del dueño y la base solo
-- distinguía la bodega, no el rol. "Administrador" era un candado de pantalla:
-- quien tuviera el token (devtools) podía borrar ventas, cambiar precios,
-- editar cajeros, etc. llamando a la API directo.
--
-- Cómo queda:
--   * Quien elige un perfil Dueño/Administrador al abrir turno escribe el PIN de
--     ese perfil. El servidor lo verifica (elevar_admin) y deja una "elevación"
--     atada a ESA sesión (session_id del JWT), de 8 horas como máximo.
--   * Triggers en las tablas sensibles rechazan la escritura si la sesión no
--     está elevada (salvo superadmin y funciones internas SECURITY DEFINER).
--   * El dueño también tiene PIN de administrador (no es el de ingreso: se entra
--     con Google). Se crea una sola vez, justo después de iniciar sesión con
--     Google (login reciente). Si lo olvida, el superadmin lo restablece
--     (admin_quitar_pin_dueno) y lo vuelve a crear.
--
-- ORDEN DE DESPLIEGUE: primero publicar la versión nueva de la app (en Vercel)
-- y recién después ejecutar este script. Con la app vieja, las pantallas de
-- administración fallarían con "Desbloquea la administración con tu PIN".
--
-- Qué NO cambia: vender, cobrar, abrir/cerrar turno, fiados, mermas, toma de
-- inventario y ajustes de stock siguen funcionando para cualquier cajero.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Elevaciones (una por sesión). Sin acceso directo desde la API.
-- ------------------------------------------------------------
create table if not exists public.elevaciones_admin (
  sesion_id text primary key,
  auth_id   uuid not null,
  bodega_id uuid not null,
  cajero_id uuid not null references public.cajeros(id) on delete cascade,
  hasta     timestamptz not null
);
alter table public.elevaciones_admin enable row level security;
revoke all on public.elevaciones_admin from anon, authenticated;

-- ------------------------------------------------------------
-- 2) Helpers
-- ------------------------------------------------------------
-- ¿La persona inició sesión con Google hace poco? (amr trae la hora del login)
create or replace function public.login_reciente(p_minutos integer default 10)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((
    select max((e->>'timestamp')::numeric)
    from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) e
    where jsonb_typeof(e) = 'object'
  ), 0) >= extract(epoch from (now() - make_interval(mins => p_minutos)));
$$;

-- Rol con el que está elevada esta sesión ('dueno' | 'administrador') o null.
create or replace function public.estoy_elevado()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.rol
  from public.elevaciones_admin e
  join public.cajeros c on c.id = e.cajero_id
  where e.sesion_id = coalesce(auth.jwt()->>'session_id', '')
    and e.auth_id = auth.uid()
    and e.hasta > now()
    and e.bodega_id = public.mi_bodega_id()
    and c.activo
    and c.rol in ('dueno', 'administrador')
  limit 1;
$$;

create or replace function public.es_admin_elevado()
returns boolean language sql stable security definer set search_path = public
as $$ select public.estoy_elevado() is not null; $$;

create or replace function public.es_dueno_elevado()
returns boolean language sql stable security definer set search_path = public
as $$ select public.estoy_elevado() = 'dueno'; $$;

-- ------------------------------------------------------------
-- 3) Elevar / bajar
-- ------------------------------------------------------------
-- Devuelve 'ok' | 'sin_pin' | 'incorrecto'. 5 fallos seguidos bloquean 15 min.
create or replace function public.elevar_admin(p_cajero_id uuid, p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_bodega uuid := public.mi_bodega_id();
  v_sesion text := coalesce(auth.jwt()->>'session_id', '');
  v_c record;
  v_bloqueado_hasta timestamptz;
  v_ok boolean;
begin
  if v_bodega is null or v_sesion = '' then
    raise exception 'No autorizado.';
  end if;

  select id, rol, activo, pin_seguridad into v_c
    from cajeros where id = p_cajero_id and bodega_id = v_bodega;
  if not found or not v_c.activo or v_c.rol not in ('dueno', 'administrador') then
    return 'incorrecto';
  end if;
  if v_c.pin_seguridad is null then
    return 'sin_pin';
  end if;

  select bloqueado_hasta into v_bloqueado_hasta
    from intentos_pin_cajero where cajero_id = p_cajero_id;
  if v_bloqueado_hasta is not null and v_bloqueado_hasta > now() then
    raise exception 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
  end if;

  v_ok := v_c.pin_seguridad = crypt(trim(coalesce(p_pin, '')), v_c.pin_seguridad);

  if v_ok then
    delete from intentos_pin_cajero where cajero_id = p_cajero_id;
    delete from elevaciones_admin where hasta < now();
    insert into elevaciones_admin (sesion_id, auth_id, bodega_id, cajero_id, hasta)
    values (v_sesion, auth.uid(), v_bodega, p_cajero_id, now() + interval '8 hours')
    on conflict (sesion_id) do update
      set auth_id = excluded.auth_id, bodega_id = excluded.bodega_id,
          cajero_id = excluded.cajero_id, hasta = excluded.hasta;
    return 'ok';
  end if;

  insert into intentos_pin_cajero (cajero_id, intentos, bloqueado_hasta)
  values (p_cajero_id, 1, null)
  on conflict (cajero_id) do update set
    intentos = case when intentos_pin_cajero.bloqueado_hasta is not null then 1
                    else intentos_pin_cajero.intentos + 1 end,
    bloqueado_hasta = case when intentos_pin_cajero.bloqueado_hasta is null
                                and intentos_pin_cajero.intentos + 1 >= 5
                           then now() + interval '15 minutes' else null end;
  return 'incorrecto';
end;
$$;

create or replace function public.bajar_admin()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.elevaciones_admin
  where sesion_id = coalesce(auth.jwt()->>'session_id', '') and auth_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 4) establecer_pin_cajero: ya no lo puede usar cualquiera
-- ------------------------------------------------------------
create or replace function public.establecer_pin_cajero(p_cajero_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pin text := trim(coalesce(p_pin, ''));
  v_c record;
begin
  if char_length(v_pin) < 4 or char_length(v_pin) > 32 then
    raise exception 'El PIN debe tener entre 4 y 32 caracteres.';
  end if;

  select id, rol, pin_seguridad into v_c
    from cajeros where id = p_cajero_id and bodega_id = public.mi_bodega_id();
  if not found then
    raise exception 'No se pudo actualizar el PIN.';
  end if;

  if v_c.rol = 'dueno' then
    if char_length(v_pin) < 6 then
      raise exception 'El PIN del dueño debe tener al menos 6 caracteres.';
    end if;
    -- El primero se crea con un ingreso reciente con Google; después, solo el
    -- propio dueño ya desbloqueado puede cambiarlo.
    if not (public.es_dueno_elevado() or (v_c.pin_seguridad is null and public.login_reciente(10))) then
      raise exception 'Para crear tu PIN de administrador cierra sesión y vuelve a entrar con Google.';
    end if;
  else
    if not public.es_admin_elevado() then
      raise exception 'Desbloquea la administración con tu PIN para hacer esto.';
    end if;
  end if;

  update cajeros set pin_seguridad = crypt(v_pin, gen_salt('bf')) where id = p_cajero_id;

  delete from intentos_pin_cajero where cajero_id = p_cajero_id;
  -- Quien tenía ese perfil desbloqueado en otro equipo tendrá que volver a entrar.
  delete from elevaciones_admin
   where cajero_id = p_cajero_id and sesion_id <> coalesce(auth.jwt()->>'session_id', '');
end;
$$;

-- El superadmin restablece el PIN de administrador del dueño (lo olvidó).
create or replace function public.admin_quitar_pin_dueno(p_bodega_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'No autorizado.';
  end if;
  update cajeros set pin_seguridad = null where bodega_id = p_bodega_id and rol = 'dueno';
  delete from elevaciones_admin where bodega_id = p_bodega_id;
  delete from intentos_pin_cajero where cajero_id in (select id from cajeros where bodega_id = p_bodega_id);
end;
$$;

-- ------------------------------------------------------------
-- 5) Triggers que exigen la elevación
--    Solo se aplican a quien llega por la API (authenticated/anon). El SQL
--    Editor, service_role y las funciones SECURITY DEFINER no se ven afectados.
-- ------------------------------------------------------------
create or replace function public.trg_requiere_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  if public.es_superadmin() or public.es_admin_elevado() then
    return coalesce(new, old);
  end if;
  raise exception 'Desbloquea la administración con tu PIN para hacer esto.' using errcode = '42501';
end;
$$;

-- Tablas que solo toca la administración (cualquier escritura).
do $$
declare t text;
begin
  foreach t in array array['proveedores', 'pagos_proveedor', 'compras', 'compras_detalle',
                           'combos', 'combos_items']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists exigir_admin on public.%I', t);
      execute format('create trigger exigir_admin before insert or update or delete on public.%I
                      for each row execute function public.trg_requiere_admin()', t);
    end if;
  end loop;
end $$;

-- Ventas: vender (INSERT) es libre; anular, editar o borrar es de administración.
drop trigger if exists exigir_admin on public.ventas;
create trigger exigir_admin before update or delete on public.ventas
  for each row execute function public.trg_requiere_admin();
drop trigger if exists exigir_admin on public.ventas_detalle;
create trigger exigir_admin before update or delete on public.ventas_detalle
  for each row execute function public.trg_requiere_admin();

-- Productos: el stock lo mueve cualquier cajero (ventas, mermas, toma de
-- inventario); precio, costo, nombre, estado, altas y bajas son de administración.
create or replace function public.trg_productos_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.es_superadmin() then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'stock_actual' - 'updated_at' - 'actualizado_en')
       = (to_jsonb(old) - 'stock_actual' - 'updated_at' - 'actualizado_en') then
    return new;
  end if;
  if public.es_admin_elevado() then
    return coalesce(new, old);
  end if;
  raise exception 'Desbloquea la administración con tu PIN para hacer esto.' using errcode = '42501';
end;
$$;
drop trigger if exists exigir_admin on public.productos;
create trigger exigir_admin before insert or update or delete on public.productos
  for each row execute function public.trg_productos_admin();

-- Clientes: la deuda la mueven los cajeros; el límite de crédito y las bajas, no.
create or replace function public.trg_clientes_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.es_superadmin() then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.limite_credito is not distinct from old.limite_credito then
    return new;
  end if;
  if public.es_admin_elevado() then
    return coalesce(new, old);
  end if;
  raise exception 'Desbloquea la administración con tu PIN para hacer esto.' using errcode = '42501';
end;
$$;
drop trigger if exists exigir_admin on public.clientes;
create trigger exigir_admin before insert or update or delete on public.clientes
  for each row execute function public.trg_clientes_admin();

-- Cajeros: administración; las filas con rol "dueno" solo las toca el dueño
-- desbloqueado. Excepción: la auto-reparación de la app crea la fila del dueño
-- si no existe (una sola vez, solo para el dueño de la cuenta).
create or replace function public.trg_cajeros_admin()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_toca_dueno boolean;
begin
  if current_user not in ('authenticated', 'anon') or public.es_superadmin() then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT'
     and new.rol = 'dueno'
     and exists (select 1 from usuarios u where u.auth_id = auth.uid() and u.rol = 'dueno'
                  and u.bodega_id = new.bodega_id)
     and not exists (select 1 from cajeros c where c.bodega_id = new.bodega_id and c.rol = 'dueno') then
    return new;
  end if;

  v_toca_dueno := false;
  if tg_op in ('UPDATE', 'DELETE') then
    v_toca_dueno := coalesce(old.rol = 'dueno', false);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_toca_dueno := v_toca_dueno or coalesce(new.rol = 'dueno', false);
  end if;
  if v_toca_dueno then
    if public.es_dueno_elevado() then return coalesce(new, old); end if;
  elsif public.es_admin_elevado() then
    return coalesce(new, old);
  end if;
  raise exception 'Desbloquea la administración con tu PIN para hacer esto.' using errcode = '42501';
end;
$$;
drop trigger if exists exigir_admin on public.cajeros;
create trigger exigir_admin before insert or update or delete on public.cajeros
  for each row execute function public.trg_cajeros_admin();

-- Usuarios (cuentas con acceso): igual que cajeros. Las funciones internas
-- (reclamar_cuenta_por_correo, altas del superadmin) pasan por SECURITY DEFINER.
create or replace function public.trg_usuarios_admin()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_toca_dueno boolean;
begin
  if current_user not in ('authenticated', 'anon') or public.es_superadmin() then
    return coalesce(new, old);
  end if;
  v_toca_dueno := false;
  if tg_op in ('UPDATE', 'DELETE') then
    v_toca_dueno := coalesce(old.rol = 'dueno', false);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_toca_dueno := v_toca_dueno or coalesce(new.rol = 'dueno', false);
  end if;
  if v_toca_dueno then
    if public.es_dueno_elevado() then return coalesce(new, old); end if;
  elsif public.es_admin_elevado() then
    return coalesce(new, old);
  end if;
  raise exception 'Desbloquea la administración con tu PIN para hacer esto.' using errcode = '42501';
end;
$$;
drop trigger if exists exigir_admin on public.usuarios;
create trigger exigir_admin before insert or update or delete on public.usuarios
  for each row execute function public.trg_usuarios_admin();

-- El link de pedidos (actualizar_mi_delivery) también exige administración
-- desbloqueada; esa función vive en slug_delivery_validado.sql (ejecutarlo después).

-- ------------------------------------------------------------
-- 6) Permisos de ejecución
-- ------------------------------------------------------------
revoke execute on function public.login_reciente(integer)              from public, anon;
revoke execute on function public.estoy_elevado()                      from public, anon;
revoke execute on function public.es_admin_elevado()                   from public, anon;
revoke execute on function public.es_dueno_elevado()                   from public, anon;
revoke execute on function public.elevar_admin(uuid, text)             from public, anon;
revoke execute on function public.bajar_admin()                        from public, anon;
revoke execute on function public.establecer_pin_cajero(uuid, text)    from public, anon;
revoke execute on function public.admin_quitar_pin_dueno(uuid)         from public, anon;
revoke execute on function public.trg_requiere_admin()                 from public, anon, authenticated;
revoke execute on function public.trg_productos_admin()                from public, anon, authenticated;
revoke execute on function public.trg_clientes_admin()                 from public, anon, authenticated;
revoke execute on function public.trg_cajeros_admin()                  from public, anon, authenticated;
revoke execute on function public.trg_usuarios_admin()                 from public, anon, authenticated;

grant execute on function public.login_reciente(integer)              to authenticated;
grant execute on function public.estoy_elevado()                      to authenticated;
grant execute on function public.es_admin_elevado()                   to authenticated;
grant execute on function public.es_dueno_elevado()                   to authenticated;
grant execute on function public.elevar_admin(uuid, text)             to authenticated;
grant execute on function public.bajar_admin()                        to authenticated;
grant execute on function public.establecer_pin_cajero(uuid, text)    to authenticated;
grant execute on function public.admin_quitar_pin_dueno(uuid)         to authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verificación: 11 triggers "exigir_admin" (menos los de tablas que no existan).
-- ------------------------------------------------------------
select event_object_table as tabla, count(*) as eventos
from information_schema.triggers
where trigger_schema = 'public' and trigger_name = 'exigir_admin'
group by 1 order by 1;
