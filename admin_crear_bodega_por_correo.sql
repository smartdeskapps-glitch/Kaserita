-- ============================================================
-- Kaserita: crear bodegas con el CORREO del dueño (sin DNI ni PIN).
-- Ejecutar a mano en el SQL Editor de Supabase. Es ADITIVO: agrega una
-- columna, dos funciones nuevas y afloja dos restricciones; no borra ni
-- cambia nada existente. Las bodegas que ya entran con DNI + PIN siguen
-- funcionando igual.
--
-- Cómo funciona:
--   1) El super-admin crea la bodega desde el panel escribiendo el correo
--      de Google del dueño (admin_crear_bodega_por_correo). Queda una fila
--      de dueño con ese correo y sin cuenta vinculada todavía.
--   2) El dueño entra a la app con "Continuar con Google" usando ese
--      correo. En su primer ingreso, reclamar_cuenta_por_correo() une su
--      cuenta de Google con esa fila y ya ve su bodega.
--
-- Seguridad:
--   - Crear bodegas sigue exigiendo es_superadmin().
--   - Solo se vincula si la cuenta entró con GOOGLE y ese correo es el que
--     Google verificó (auth.identities). Así nadie puede reclamar una
--     bodega registrando una cuenta con correo y contraseña ajenos.
--   - Una fila solo se puede vincular una vez (auth_id is null).
-- ============================================================

-- 1) Columna del correo y unicidad (sin distinguir mayúsculas).
alter table public.usuarios add column if not exists email text;
create unique index if not exists usuarios_email_uidx
  on public.usuarios (lower(email)) where email is not null;

-- 2) El dueño ya no tiene DNI: se permite vacío. Si alguna de estas
--    columnas ya aceptaba vacío, la instrucción no cambia nada.
alter table public.usuarios alter column dni drop not null;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cajeros'
      and column_name = 'dni' and is_nullable = 'NO'
  ) then
    alter table public.cajeros alter column dni drop not null;
  end if;
end $$;

-- 3) Crear la bodega con el correo del dueño.
create or replace function public.admin_crear_bodega_por_correo(
  p_correo text,
  p_nombre_bodega text,
  p_nombre_dueno text,
  p_dias integer,
  p_telefono text default null,
  p_mostrar_catalogo_maestro boolean default true,
  p_permitir_subir_fotos boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_correo text := lower(trim(coalesce(p_correo, '')));
  v_bodega_id uuid;
  v_activa_hasta date;
begin
  if not es_superadmin() then
    raise exception 'No autorizado.';
  end if;

  if v_correo !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'El correo no es válido.';
  end if;
  if coalesce(trim(p_nombre_bodega), '') = '' then
    raise exception 'Falta el nombre de la bodega.';
  end if;
  if coalesce(trim(p_nombre_dueno), '') = '' then
    raise exception 'Falta el nombre del dueño.';
  end if;

  -- Ese correo no puede tener ya una bodega (ni pendiente ni ya vinculada).
  if exists (select 1 from usuarios where lower(email) = v_correo) then
    raise exception 'Ese correo ya tiene una bodega registrada.';
  end if;
  if exists (
    select 1 from usuarios u join auth.users a on a.id = u.auth_id
    where lower(a.email) = v_correo
  ) then
    raise exception 'Esa cuenta de Google ya tiene una bodega.';
  end if;

  v_activa_hasta := case when p_dias > 0 then (current_date + (p_dias || ' days')::interval)::date else null end;

  insert into bodegas (nombre, activa, activa_hasta, mostrar_catalogo_maestro, permitir_subir_fotos)
  values (trim(p_nombre_bodega), true, v_activa_hasta, p_mostrar_catalogo_maestro, p_permitir_subir_fotos)
  returning id into v_bodega_id;

  insert into usuarios (bodega_id, nombre, email, telefono, rol, activo, auth_id)
  values (v_bodega_id, trim(p_nombre_dueno), v_correo, nullif(trim(p_telefono), ''), 'dueno', true, null);

  return v_bodega_id;
end;
$$;

revoke all on function public.admin_crear_bodega_por_correo(text, text, text, integer, text, boolean, boolean) from public, anon;
grant execute on function public.admin_crear_bodega_por_correo(text, text, text, integer, text, boolean, boolean) to authenticated;

-- 4) Vincular la cuenta de Google del dueño con su bodega (la llama la app
--    sola, en el primer ingreso). Devuelve el id de la bodega, o null si ese
--    correo no tiene ninguna bodega pendiente.
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

  -- Si esta cuenta ya está vinculada, no hay nada que hacer.
  if exists (select 1 from usuarios where auth_id = auth.uid()) then
    return (select bodega_id from usuarios where auth_id = auth.uid() limit 1);
  end if;

  -- Solo cuentas que entraron con Google, con el correo que Google verificó.
  select lower(identity_data->>'email') into v_correo
  from auth.identities
  where user_id = auth.uid()
    and provider = 'google'
    and coalesce((identity_data->>'email_verified')::boolean, true)
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

NOTIFY pgrst, 'reload schema';
