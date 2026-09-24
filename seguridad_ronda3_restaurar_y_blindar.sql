-- ============================================================
-- Kaserita: restaura lo que deshizo una nueva ejecución de
-- rls_migracion.sql y lo blinda para que no se pueda deshacer otra vez.
-- Ejecutar todo de una sola vez en el SQL Editor de Supabase.
-- Idempotente: se puede volver a correr sin problema.
--
-- Qué había pasado: rls_migracion.sql es el script ORIGINAL de RLS. Al
-- correrlo de nuevo pisó cosas que después se habían corregido:
--   - mi_bodega_id(): volvió a la versión vieja que NO mira si la bodega
--     está activa ni vencida. Con eso, una bodega desactivada o con la
--     suscripción vencida recuperaba acceso completo a sus datos (todas
--     las políticas dependen de esta función).
--   - reclamar_cuenta_bodega(): volvió a la versión que no exige sesión y
--     que deja el PIN de acceso en texto plano en usuarios.pin_acceso.
--   - bodegas_insert / bodegas_update / bodegas_select: reaparecieron
--     (crear bodegas sin ser superadmin, editarse activa_hasta, leer
--     bodegas ajenas sin usuarios).
--   - usuarios_insert: volvió la rama "bodega sin usuarios".
--
-- Además de restaurar, se agregan políticas RESTRICTIVE. Una política
-- restrictiva se suma con AND a las demás, así que aunque un script viejo
-- vuelva a crear una política abierta, no puede abrir el hueco de nuevo.
-- ============================================================

-- ------------------------------------------------------------
-- 1) mi_bodega_id(): versión de panel_admin.sql (exige activa y vigente)
-- ------------------------------------------------------------
create or replace function public.mi_bodega_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.bodega_id
  from usuarios u
  join bodegas b on b.id = u.bodega_id
  where u.auth_id = auth.uid()
    and b.activa = true
    and (b.activa_hasta is null or b.activa_hasta >= current_date)
  limit 1;
$$;

grant execute on function public.mi_bodega_id() to anon, authenticated;

-- ------------------------------------------------------------
-- 2) reclamar_cuenta_bodega() y puede_reclamar_bodega(): versiones de
--    cerrar_huecos_criticos_auth.sql (sesión obligatoria, borra el PIN
--    de acceso al reclamar, freno de 8 intentos por DNI).
-- ------------------------------------------------------------
create table if not exists public.intentos_reclamo_pin (
  dni text primary key,
  intentos integer not null default 0,
  bloqueado_hasta timestamptz
);
alter table public.intentos_reclamo_pin enable row level security;

create or replace function public.puede_reclamar_bodega(p_dni text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bloqueado_hasta timestamptz;
  v_ok boolean;
begin
  select bloqueado_hasta into v_bloqueado_hasta from intentos_reclamo_pin where dni = p_dni;

  if v_bloqueado_hasta is not null and v_bloqueado_hasta > now() then
    raise exception 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
  end if;

  v_ok := exists (
    select 1 from usuarios
    where dni = p_dni and pin_acceso = p_pin and auth_id is null
  );

  if v_ok then
    delete from intentos_reclamo_pin where dni = p_dni;
  else
    insert into intentos_reclamo_pin (dni, intentos, bloqueado_hasta)
    values (p_dni, 1, null)
    on conflict (dni) do update set
      intentos = intentos_reclamo_pin.intentos + 1,
      bloqueado_hasta = case
        when intentos_reclamo_pin.intentos + 1 >= 8 then now() + interval '15 minutes'
        else intentos_reclamo_pin.bloqueado_hasta
      end;
  end if;

  return v_ok;
end;
$$;

create or replace function public.reclamar_cuenta_bodega(p_dni text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_bodega uuid;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida.';
  end if;

  select id, bodega_id into v_id, v_bodega from usuarios
    where dni = p_dni and pin_acceso = p_pin and auth_id is null
    limit 1;
  if v_id is null then
    return null;
  end if;
  update usuarios set auth_id = auth.uid(), pin_acceso = null where id = v_id;
  return v_bodega;
end;
$$;

grant execute on function public.puede_reclamar_bodega(text, text) to anon, authenticated;
grant execute on function public.reclamar_cuenta_bodega(text, text) to anon, authenticated;

-- PIN de acceso en texto plano que quedó guardado de cuentas ya reclamadas
-- (la versión vieja de la función no lo borraba).
update public.usuarios set pin_acceso = null where auth_id is not null and pin_acceso is not null;

-- ------------------------------------------------------------
-- 3) Políticas permisivas: solo lo necesario
-- ------------------------------------------------------------
drop policy if exists "bodegas_insert" on public.bodegas;
drop policy if exists "bodegas_insert_autenticado" on public.bodegas;
drop policy if exists "bodegas_update" on public.bodegas;
drop policy if exists "bodegas_update_propia" on public.bodegas;
drop policy if exists "bodegas_select" on public.bodegas;

-- Lectura de la propia bodega SIN mirar si está vencida (la app necesita
-- leerla para mostrar el aviso de "suscripción vencida"), y sin la rama
-- "o la bodega no tiene usuarios todavía".
drop policy if exists "bodegas_select_propia" on public.bodegas;
create policy "bodegas_select_propia" on public.bodegas
  for select to authenticated
  using (id = (select u.bodega_id from public.usuarios u where u.auth_id = auth.uid()));

drop policy if exists "usuarios_insert" on public.usuarios;
create policy "usuarios_insert" on public.usuarios
  for insert with check (bodega_id = mi_bodega_id());

-- ------------------------------------------------------------
-- 4) Políticas RESTRICTIVAS (blindaje contra scripts viejos)
-- ------------------------------------------------------------
drop policy if exists "bodegas_solo_admin_insert" on public.bodegas;
create policy "bodegas_solo_admin_insert" on public.bodegas
  as restrictive for insert to anon, authenticated
  with check (es_superadmin());

drop policy if exists "bodegas_solo_admin_update" on public.bodegas;
create policy "bodegas_solo_admin_update" on public.bodegas
  as restrictive for update to anon, authenticated
  using (es_superadmin())
  with check (es_superadmin());

drop policy if exists "bodegas_solo_propia_select" on public.bodegas;
create policy "bodegas_solo_propia_select" on public.bodegas
  as restrictive for select to anon, authenticated
  using (
    id = (select u.bodega_id from public.usuarios u where u.auth_id = auth.uid())
    or es_superadmin()
  );

drop policy if exists "usuarios_solo_propia_bodega_insert" on public.usuarios;
create policy "usuarios_solo_propia_bodega_insert" on public.usuarios
  as restrictive for insert to anon, authenticated
  with check (bodega_id = mi_bodega_id() or es_superadmin());

-- ------------------------------------------------------------
-- Verificación: una sola tabla. Columna "esperado" dice qué debería dar.
-- ------------------------------------------------------------
select 'mi_bodega_id exige bodega activa' as revision,
       (pg_get_functiondef('public.mi_bodega_id()'::regprocedure) ilike '%b.activa = true%')::text as valor,
       'true' as esperado
union all
select 'reclamar_cuenta_bodega exige sesion y borra el PIN',
       (pg_get_functiondef('public.reclamar_cuenta_bodega(text, text)'::regprocedure) ilike '%auth.uid() is null%'
        and pg_get_functiondef('public.reclamar_cuenta_bodega(text, text)'::regprocedure) ilike '%pin_acceso = null%')::text,
       'true'
union all
select 'usuarios con PIN de acceso en texto plano ya reclamados',
       (select count(*) from public.usuarios where auth_id is not null and pin_acceso is not null)::text,
       '0'
union all
select 'bodegas: ' || permissive || ' ' || cmd, policyname::text,
       'admin_todo, insert_admin, select_propia + 3 restrictivas'
from pg_policies where schemaname = 'public' and tablename = 'bodegas'
union all
select 'usuarios INSERT: ' || permissive, policyname::text, 'usuarios_insert + 1 restrictiva'
from pg_policies where schemaname = 'public' and tablename = 'usuarios' and cmd = 'INSERT'
union all
select 'storage: ' || cmd || ' ' || roles::text, policyname::text,
       'using=' || coalesce(qual, '-') || ' | check=' || coalesce(with_check, '-')
from pg_policies where schemaname = 'storage'
order by 1, 2;

NOTIFY pgrst, 'reload schema';
