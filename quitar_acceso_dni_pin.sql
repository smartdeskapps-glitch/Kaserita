-- ============================================================
-- Kaserita: eliminar POR COMPLETO el acceso con DNI + PIN (hallazgos A1, A2, A5).
-- Ejecutar a mano en el SQL Editor del proyecto de Kaserita
-- (hzmrsbeamtbloudmxjrp), DESPUÉS de publicar la app nueva (que ya no tiene el
-- formulario DNI+PIN). Todo corre en una transacción: si algo falla, no cambia nada.
--
-- Qué hace:
--   1) Se detiene (sin cambiar nada) si alguna bodega quedaría sin forma de
--      entrar con Google, y te dice cuáles.
--   2) Desvincula esas filas de las cuentas bodega_<DNI>@kaserita.app y BORRA
--      esas cuentas de Auth (con sus sesiones e identidades).
--   3) Borra las funciones del flujo PIN: puede_reclamar_bodega,
--      reclamar_cuenta_bodega, admin_crear_bodega (todas las versiones),
--      admin_resetear_pin_bodega, y la tabla intentos_reclamo_pin.
--   4) Borra la columna usuarios.pin_acceso (PIN en texto plano).
--   5) Endurece reclamar_cuenta_por_correo (A5): no vincula cuentas que tengan
--      identidad de correo+contraseña (evita el "pre-secuestro").
--
-- Antes de correrlo, mira el PASO 0 (solo lectura). Los datos de las bodegas
-- (ventas, productos, clientes...) NO se tocan.
-- ============================================================

-- ------------------------------------------------------------
-- PASO 0 (solo lectura): qué cuentas se van a borrar y a quién están ligadas.
-- ------------------------------------------------------------
select a.email as cuenta_pin, a.last_sign_in_at::date as ultimo_ingreso,
       b.nombre as bodega, u.nombre as persona, u.rol,
       u.email as correo_google_guardado,
       (u.id is not null and u.email is null) as quedaria_sin_acceso
from auth.users a
left join public.usuarios u on u.auth_id = a.id
left join public.bodegas b on b.id = u.bodega_id
where a.email like 'bodega\_%@kaserita.app'
order by a.last_sign_in_at desc nulls last;

-- Filas "sin reclamar" creadas con PIN que no tienen correo de Google:
select b.nombre as bodega, u.nombre as persona, u.rol, u.dni
from public.usuarios u
join public.bodegas b on b.id = u.bodega_id
where u.auth_id is null and u.email is null;

begin;

do $$
declare
  v_sin_acceso text;
begin
  -- 1) Nadie debe quedar sin forma de entrar.
  select string_agg(distinct coalesce(b.nombre, '(sin bodega)') || ' [' || coalesce(u.nombre, '?') || ']', ', ')
    into v_sin_acceso
  from public.usuarios u
  join public.bodegas b on b.id = u.bodega_id
  left join auth.users a on a.id = u.auth_id
  where u.email is null
    and (u.auth_id is null or a.email like 'bodega\_%@kaserita.app');

  if v_sin_acceso is not null then
    raise exception
      'Estas bodegas quedarían sin acceso (no tienen correo de Google): %. Asígnales su correo (update public.usuarios set email = ''correo@gmail.com'' where ...) o elimínalas desde el panel, y vuelve a correr este script.',
      v_sin_acceso;
  end if;
end $$;

-- 2) Desvincular y borrar las cuentas con PIN.
update public.usuarios u
   set auth_id = null
  from auth.users a
 where a.id = u.auth_id
   and a.email like 'bodega\_%@kaserita.app';

delete from auth.users where email like 'bodega\_%@kaserita.app';

-- 3) Funciones y tabla del flujo PIN.
drop function if exists public.puede_reclamar_bodega(text, text);
drop function if exists public.reclamar_cuenta_bodega(text, text);
drop function if exists public.admin_resetear_pin_bodega(uuid, text);
drop table if exists public.intentos_reclamo_pin;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_crear_bodega'
  loop
    execute format('drop function %s', f.sig);
  end loop;
end $$;

-- 4) PIN de acceso en texto plano: fuera.
alter table public.usuarios drop column if exists pin_acceso;

-- 5) A5: reclamar por correo solo con Google puro (sin identidad email+contraseña).
create or replace function public.reclamar_cuenta_por_correo()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_correo text;
  v_id uuid;
  v_bodega uuid;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida.';
  end if;

  if exists (select 1 from usuarios where auth_id = auth.uid()) then
    return (select bodega_id from usuarios where auth_id = auth.uid() limit 1);
  end if;

  -- Una cuenta con contraseña (registrada a mano por correo) no puede reclamar.
  if exists (select 1 from auth.identities where user_id = auth.uid() and provider = 'email') then
    return null;
  end if;

  select lower(identity_data->>'email') into v_correo
  from auth.identities
  where user_id = auth.uid()
    and provider = 'google'
    and coalesce((identity_data->>'email_verified')::boolean, false)
  limit 1;

  if v_correo is null or v_correo = '' then
    return null;
  end if;

  select id, bodega_id into v_id, v_bodega
  from usuarios
  where lower(email) = v_correo and auth_id is null and activo
  limit 1
  for update;

  if v_id is null then
    return null;
  end if;

  update usuarios set auth_id = auth.uid() where id = v_id;
  return v_bodega;
end;
$$;

revoke all on function public.reclamar_cuenta_por_correo() from public, anon;
grant execute on function public.reclamar_cuenta_por_correo() to authenticated;

commit;

NOTIFY pgrst, 'reload schema';

-- Verificación: debe dar 0 cuentas PIN, 0 funciones del flujo PIN y sin columna pin_acceso.
select
  (select count(*) from auth.users where email like 'bodega\_%@kaserita.app') as cuentas_pin,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('puede_reclamar_bodega', 'reclamar_cuenta_bodega', 'admin_crear_bodega', 'admin_resetear_pin_bodega')) as funciones_pin,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'usuarios' and column_name = 'pin_acceso') as columna_pin_acceso;
