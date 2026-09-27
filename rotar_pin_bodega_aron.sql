-- ============================================================
-- Kaserita: rota el PIN de "Bodega Aron" (DNI 49021764), cuyo PIN
-- anterior quedó expuesto en el historial del repo público
-- (liberar_bodega_aron.sql, commit 67fd598 del 2026-09-11). Aunque
-- ese archivo ya se borró del repo, sigue en el historial de git, así
-- que ese PIN debe darse por comprometido.
--
-- Qué hace (todo en una transacción): genera un PIN nuevo DE 8 DÍGITOS
-- AL AZAR -- no queda escrito en este archivo, solo en el resultado
-- que ves al correrlo en el SQL Editor. Borra la cuenta de Auth vieja
-- de ese dueño (así la contraseña filtrada deja de servir para
-- cualquier cosa) y deja el PIN nuevo listo para que el dueño
-- "reclame" su cuenta en su próximo login -- exactamente lo mismo que
-- hace "Resetear PIN" del panel de administrador (admin_resetear_pin_bodega),
-- solo que este script no depende de una sesión de super-admin.
--
-- Ejecutar en el SQL Editor de Supabase. Después de correrlo, mira la
-- columna "pin_nuevo" del resultado y avísale al dueño por teléfono o
-- WhatsApp -- no lo pegues en un commit, en un archivo del repo ni en
-- ningún lugar que vaya a quedar guardado en texto plano.
-- ============================================================

do $$
declare
  v_usuario record;
  v_pin text := lpad((random() * 99999999)::bigint::text, 8, '0');
  v_email text;
begin
  select u.id, u.dni into v_usuario
  from public.usuarios u
  where u.dni = '49021764' and u.rol = 'dueno';

  if v_usuario.id is null then
    raise notice 'No se encontró ningún dueño con DNI 49021764 (puede que esa bodega ya no exista). Nada que rotar.';
    return;
  end if;

  v_email := 'bodega_' || v_usuario.dni || '@kaserita.app';

  -- Cierra la cuenta de Auth vieja: la contraseña filtrada (kst- + PIN viejo)
  -- deja de abrir sesión desde este momento.
  delete from auth.users where email = v_email;

  update public.usuarios
  set auth_id = null, pin_acceso = v_pin
  where id = v_usuario.id;

  drop table if exists _pin_rotado;
  create temporary table _pin_rotado (pin_nuevo text);
  insert into _pin_rotado values (v_pin);
end $$;

select pin_nuevo from _pin_rotado;

NOTIFY pgrst, 'reload schema';
