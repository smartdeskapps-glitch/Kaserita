-- ============================================================
-- Kaserita: endurecimiento de seguridad (ronda 2026-09-23)
-- Ejecutar todo de una sola vez en el SQL Editor de Supabase.
-- Requiere haber corrido antes hashear_pin_cajero.sql.
--
-- 1) ARREGLO: verificar_pin_cajero y establecer_pin_cajero fijaban
--    "search_path = public", pero en Supabase la extensión pgcrypto vive
--    en el schema "extensions". Resultado: crypt() y gen_salt() no se
--    encontraban y ambas funciones fallaban con "function gen_salt does
--    not exist" / "function crypt does not exist" (comprobado llamándolas
--    con la anon key). Ahora el search_path incluye "extensions".
--
-- 2) El PIN ya no es solo numérico: acepta letras, números y símbolos,
--    de 4 a 32 caracteres (tiene que coincidir con PIN_MIN / PIN_MAX en
--    src/main.jsx).
--
-- 3) Límite de intentos más estricto y sin bloqueo eterno: 5 fallos
--    seguidos bloquean 15 minutos; al vencer el bloqueo el contador
--    arranca de cero (antes, después de 8 fallos cada nuevo error
--    volvía a bloquear 15 minutos). Un cajero inexistente o de otra
--    bodega ya no registra intentos (no se puede bloquear a un cajero
--    ajeno).
--
-- 4) Las funciones que no necesitan sesión anónima dejan de estar
--    expuestas a "anon" ni a PUBLIC.
--
-- 5) Se quitan permisos que la API nunca usa (TRUNCATE, REFERENCES,
--    TRIGGER) sobre todas las tablas de public para anon/authenticated.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1 + 2 + 3) verificar_pin_cajero
-- ------------------------------------------------------------
create or replace function public.verificar_pin_cajero(p_cajero_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_bloqueado_hasta timestamptz;
  v_ok boolean;
begin
  select pin_seguridad into v_hash
    from cajeros
    where id = p_cajero_id and bodega_id = mi_bodega_id();

  -- Cajero que no existe o es de otra bodega: no se toca nada.
  if not found then
    return false;
  end if;

  select bloqueado_hasta into v_bloqueado_hasta
    from intentos_pin_cajero where cajero_id = p_cajero_id;

  if v_bloqueado_hasta is not null and v_bloqueado_hasta > now() then
    raise exception 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
  end if;

  v_ok := v_hash is not null
          and v_hash = crypt(trim(coalesce(p_pin, '')), v_hash);

  if v_ok then
    delete from intentos_pin_cajero where cajero_id = p_cajero_id;
  else
    insert into intentos_pin_cajero (cajero_id, intentos, bloqueado_hasta)
    values (p_cajero_id, 1, null)
    on conflict (cajero_id) do update set
      -- Si había un bloqueo (ya vencido, si no habría saltado arriba),
      -- se cuenta de nuevo desde 1.
      intentos = case
        when intentos_pin_cajero.bloqueado_hasta is not null then 1
        else intentos_pin_cajero.intentos + 1
      end,
      bloqueado_hasta = case
        when intentos_pin_cajero.bloqueado_hasta is null
             and intentos_pin_cajero.intentos + 1 >= 5
          then now() + interval '15 minutes'
        else null
      end;
  end if;

  return v_ok;
end;
$$;

-- ------------------------------------------------------------
-- 1 + 2) establecer_pin_cajero
-- ------------------------------------------------------------
create or replace function public.establecer_pin_cajero(p_cajero_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pin text := trim(coalesce(p_pin, ''));
begin
  if char_length(v_pin) < 4 or char_length(v_pin) > 32 then
    raise exception 'El PIN debe tener entre 4 y 32 caracteres.';
  end if;

  update cajeros
    set pin_seguridad = crypt(v_pin, gen_salt('bf'))
    where id = p_cajero_id and bodega_id = mi_bodega_id();

  if not found then
    raise exception 'No se pudo actualizar el PIN.';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 4) Quién puede ejecutar qué. PostgreSQL da EXECUTE a PUBLIC por defecto
--    y Supabase además lo da a anon explícitamente: hay que quitar las dos.
-- ------------------------------------------------------------
revoke execute on function public.verificar_pin_cajero(uuid, text) from public, anon;
revoke execute on function public.establecer_pin_cajero(uuid, text) from public, anon;
grant  execute on function public.verificar_pin_cajero(uuid, text) to authenticated;
grant  execute on function public.establecer_pin_cajero(uuid, text) to authenticated;

-- Estas tres son "security invoker" (RLS igual las frena para anon), pero
-- no hay ninguna razón para que un visitante sin sesión pueda llamarlas.
revoke execute on function public.ajustar_stock(uuid, numeric) from public, anon;
revoke execute on function public.ajustar_saldo_cliente(uuid, numeric) from public, anon;
revoke execute on function public.ajustar_saldo_proveedor(uuid, numeric) from public, anon;
grant  execute on function public.ajustar_stock(uuid, numeric) to authenticated;
grant  execute on function public.ajustar_saldo_cliente(uuid, numeric) to authenticated;
grant  execute on function public.ajustar_saldo_proveedor(uuid, numeric) to authenticated;

-- ------------------------------------------------------------
-- 5) Permisos que la API REST no usa nunca. TRUNCATE en particular no
--    pasa por RLS, así que conviene que anon/authenticated no lo tengan.
-- ------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Verificación 1: debería devolver 'f' en las dos columnas de anon.
-- ------------------------------------------------------------
select
  has_function_privilege('anon', 'public.verificar_pin_cajero(uuid, text)', 'execute') as anon_verificar,
  has_function_privilege('anon', 'public.establecer_pin_cajero(uuid, text)', 'execute') as anon_establecer,
  has_function_privilege('authenticated', 'public.verificar_pin_cajero(uuid, text)', 'execute') as auth_verificar;

NOTIFY pgrst, 'reload schema';
