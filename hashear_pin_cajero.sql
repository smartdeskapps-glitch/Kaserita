-- Kaserita: hashea el PIN de Administrador de cajeros.pin_seguridad
-- (hoy se guarda y compara en texto plano -- ver cajeros_pin_administrador.sql).
-- Ejecutar a mano en el SQL Editor de Supabase. Requiere haber corrido
-- antes cajeros_pin_administrador.sql.
--
-- Qué cambia:
--   1. Los PIN que ya existen se hashean con bcrypt (pgcrypto).
--   2. verificar_pin_cajero() compara contra el hash, no en texto plano.
--   3. Nueva función establecer_pin_cajero() -- única forma de ahora en
--      más de crear/cambiar un PIN, hashea del lado del servidor para que
--      el texto plano nunca viaje más allá de esta función. El frontend
--      (Kaserita/index.html) deja de mandar pin_seguridad directo por
--      insert/update y pasa a llamar esta función -- ver el comentario al
--      final de este archivo con los cambios de código necesarios.

create extension if not exists pgcrypto;

-- Paso 1: migrar los valores existentes. El "where" evita hashear dos
-- veces si este script se corre más de una vez sin querer (un hash de
-- bcrypt siempre empieza con "$2a$", "$2b$" o "$2y$").
update public.cajeros
set pin_seguridad = crypt(pin_seguridad, gen_salt('bf'))
where pin_seguridad is not null
  and pin_seguridad !~ '^\$2[aby]\$';

-- Paso 2: verificar_pin_cajero ahora compara contra el hash.
create or replace function public.verificar_pin_cajero(p_cajero_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bloqueado_hasta timestamptz;
  v_ok boolean;
begin
  select bloqueado_hasta into v_bloqueado_hasta from intentos_pin_cajero where cajero_id = p_cajero_id;

  if v_bloqueado_hasta is not null and v_bloqueado_hasta > now() then
    raise exception 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
  end if;

  v_ok := exists (
    select 1 from cajeros
    where id = p_cajero_id
      and bodega_id = mi_bodega_id()
      and pin_seguridad is not null
      and pin_seguridad = crypt(p_pin, pin_seguridad)
  );

  if v_ok then
    delete from intentos_pin_cajero where cajero_id = p_cajero_id;
  else
    insert into intentos_pin_cajero (cajero_id, intentos, bloqueado_hasta)
    values (p_cajero_id, 1, null)
    on conflict (cajero_id) do update set
      intentos = intentos_pin_cajero.intentos + 1,
      bloqueado_hasta = case
        when intentos_pin_cajero.intentos + 1 >= 8 then now() + interval '15 minutes'
        else intentos_pin_cajero.bloqueado_hasta
      end;
  end if;

  return v_ok;
end;
$$;

grant execute on function public.verificar_pin_cajero(uuid, text) to authenticated;

-- Paso 3: única forma de crear/cambiar un PIN de acá en más -- hashea
-- del lado del servidor, así el texto plano nunca se guarda directo
-- desde el navegador.
create or replace function public.establecer_pin_cajero(p_cajero_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pin !~ '^\d{4,6}$' then
    raise exception 'El PIN debe tener entre 4 y 6 dígitos.';
  end if;

  update cajeros
    set pin_seguridad = crypt(p_pin, gen_salt('bf'))
    where id = p_cajero_id and bodega_id = mi_bodega_id();

  if not found then
    raise exception 'No se pudo actualizar el PIN.';
  end if;
end;
$$;

grant execute on function public.establecer_pin_cajero(uuid, text) to authenticated;

-- Verificación: todos los PIN existentes deberían empezar con "$2".
select id, nombre, left(pin_seguridad, 4) as prefijo_hash
from public.cajeros
where pin_seguridad is not null;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Cambios de código necesarios en Kaserita/index.html (ya aplicados en
-- este commit, quedan documentados acá para referencia):
--
-- 1. registrarNuevoCajeroCompleto(): el insert a "cajeros" ya no manda
--    pin_seguridad; si rol === 'administrador', después del insert se
--    llama sbClient.rpc('establecer_pin_cajero', { p_cajero_id, p_pin }).
--
-- 2. guardarPinCajero(): en vez de
--    sbClient.from('cajeros').update({ pin_seguridad: ... }), llama
--    sbClient.rpc('establecer_pin_cajero', { p_cajero_id: cajero.id, p_pin: nuevoPinCajero.trim() }).
-- ============================================================
