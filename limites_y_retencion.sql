-- ============================================================
-- Kaserita: límites a los envíos anónimos y retención de datos (hallazgos M3 y M4).
-- Ejecutar a mano en el SQL Editor de Supabase. Idempotente.
--
-- 1) errores_app y analitica_eventos aceptan INSERT sin sesión: cualquiera con la
--    clave pública podía inundarlas. Ahora cada una tiene un tope por IP y hora.
--    La IP NO se guarda: solo un contador anónimo (hash de bucket+IP) en
--    limites_anonimos, que se borra a los 2 días.
-- 2) Libro de Reclamaciones: se quita el tope GLOBAL de 60 envíos por 10 minutos
--    (permitía que un atacante bloqueara el libro, que es un canal obligatorio).
--    Quedan: máximo 5 por IP y hora (validar_reclamo) y 3 por correo y día.
-- 3) Retención automática (mantenimiento_datos_anonimos):
--      errores_app: 30 días · analitica_eventos: 400 días ·
--      libro_reclamaciones.ip_origen: se borra a los 90 días (el reclamo en sí
--      se conserva, la ley lo exige) · limites_anonimos: 2 días.
--    Se programa con pg_cron todos los días a las 03:15 (hora de Lima) si la
--    extensión está activada; si no, ver el aviso al final.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Contador anónimo por IP
-- ------------------------------------------------------------
create table if not exists public.limites_anonimos (
  clave  text primary key,
  inicio timestamptz not null default now(),
  n      integer not null default 1
);
alter table public.limites_anonimos enable row level security;
revoke all on public.limites_anonimos from anon, authenticated;

create or replace function public.anon_limitar(p_bucket text, p_max integer, p_ventana interval)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_headers json;
  v_ip text;
  v_clave text;
  v_n integer;
begin
  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(
    nullif(trim(v_headers->>'cf-connecting-ip'), ''),
    nullif(trim(split_part(v_headers->>'x-forwarded-for', ',', -1)), '')
  );
  -- Sin IP (SQL Editor, tareas internas): no se limita.
  if v_ip is null then
    return;
  end if;

  v_clave := encode(digest(p_bucket || ':' || v_ip, 'sha256'), 'hex');

  insert into limites_anonimos (clave, inicio, n)
  values (v_clave, now(), 1)
  on conflict (clave) do update set
    inicio = case when limites_anonimos.inicio < now() - p_ventana then now() else limites_anonimos.inicio end,
    n      = case when limites_anonimos.inicio < now() - p_ventana then 1 else limites_anonimos.n + 1 end
  returning n into v_n;

  if v_n > p_max then
    raise exception 'Demasiados envíos seguidos. Intenta de nuevo en un rato.' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.anon_limitar(text, integer, interval) from public, anon, authenticated;

create or replace function public.trg_limitar_errores_app()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.anon_limitar('errores_app', 60, interval '1 hour');
  return new;
end;
$$;
create or replace function public.trg_limitar_analitica()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.anon_limitar('analitica', 300, interval '1 hour');
  return new;
end;
$$;
revoke execute on function public.trg_limitar_errores_app() from public, anon, authenticated;
revoke execute on function public.trg_limitar_analitica()   from public, anon, authenticated;

drop trigger if exists errores_app_limitar on public.errores_app;
create trigger errores_app_limitar before insert on public.errores_app
  for each row execute function public.trg_limitar_errores_app();
drop trigger if exists analitica_limitar on public.analitica_eventos;
create trigger analitica_limitar before insert on public.analitica_eventos
  for each row execute function public.trg_limitar_analitica();

-- ------------------------------------------------------------
-- 2) Libro de Reclamaciones: sin tope global
-- ------------------------------------------------------------
create or replace function public.libro_reclamaciones_limitar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.libro_reclamaciones
        where lower(email) = lower(new.email)
          and creado_en > now() - interval '24 hours') >= 3 then
    raise exception 'Ya registraste varios reclamos hoy. Escríbenos a smartdeskapps@smartdeskapps.com.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.libro_reclamaciones_limitar() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3) Retención
-- ------------------------------------------------------------
create or replace function public.mantenimiento_datos_anonimos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.errores_app       where creado_en < now() - interval '30 days';
  delete from public.analitica_eventos where creado_en < now() - interval '400 days';
  delete from public.limites_anonimos  where inicio    < now() - interval '2 days';
  update public.libro_reclamaciones
     set ip_origen = null
   where ip_origen is not null and creado_en < now() - interval '90 days';
end;
$$;
revoke execute on function public.mantenimiento_datos_anonimos() from public, anon, authenticated;

-- Programación diaria (08:15 UTC = 03:15 en Lima). Requiere la extensión pg_cron
-- (Supabase > Database > Extensions > pg_cron).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'kaserita_mantenimiento_datos';
    perform cron.schedule('kaserita_mantenimiento_datos', '15 8 * * *', 'select public.mantenimiento_datos_anonimos()');
    raise notice 'Tarea diaria programada con pg_cron.';
  else
    raise notice 'pg_cron NO está activada: actívala en Database > Extensions y vuelve a correr este script, o ejecuta a mano "select public.mantenimiento_datos_anonimos();" cada tanto.';
  end if;
end $$;

-- Primera limpieza ahora mismo.
select public.mantenimiento_datos_anonimos();

NOTIFY pgrst, 'reload schema';

-- Verificación: deben salir los dos triggers de límite.
-- (La tarea programada se ve con: select jobname, schedule from cron.job; si pg_cron está activa.)
select trigger_name::text as nombre, event_object_table::text as tabla
from information_schema.triggers
where trigger_schema = 'public' and trigger_name in ('errores_app_limitar', 'analitica_limitar');
