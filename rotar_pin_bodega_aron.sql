-- ============================================================
-- Kaserita: rota el PIN de "Bodega Aron" (DNI 49021764), cuyo PIN
-- anterior quedó expuesto en el historial del repo público
-- (liberar_bodega_aron.sql, commit 67fd598 del 2026-09-11). Aunque
-- ese archivo ya se borró del repo, sigue en el historial de git, así
-- que ese PIN debe darse por comprometido.
--
-- Qué hace, en una sola sentencia (evita bloques DO / tablas
-- temporales: el SQL Editor de Supabase a veces ejecuta cada
-- sentencia en una conexión distinta, y una tabla temporal no
-- sobrevive de una a la otra):
--   1) Borra la cuenta de Auth vieja de ese dueño (así la contraseña
--      filtrada, kst- + el PIN viejo, deja de abrir sesión).
--   2) Le pone un PIN nuevo DE 8 DÍGITOS AL AZAR -- no queda escrito
--      en este archivo, solo en el resultado que ves al correrlo.
--   3) Deja auth_id en null, para que el dueño "reclame" su cuenta de
--      nuevo en su próximo login, exactamente lo mismo que hace
--      "Resetear PIN" en el panel de administrador.
--
-- Ejecutar en el SQL Editor de Supabase. Si esa bodega ya no existe,
-- no actualiza nada y el resultado sale vacío. Después de correrlo,
-- mira la columna "pin_nuevo" del resultado y avísale al dueño por
-- teléfono o WhatsApp -- no lo pegues en un commit, en un archivo del
-- repo ni en ningún lugar que vaya a quedar guardado en texto plano.
-- ============================================================

with dueno as (
  select id, dni
  from public.usuarios
  where dni = '49021764' and rol = 'dueno'
),
borrar_auth as (
  delete from auth.users
  where email = (select 'bodega_' || dni || '@kaserita.app' from dueno)
  returning 1
)
update public.usuarios u
set auth_id = null,
    pin_acceso = lpad((random() * 99999999)::bigint::text, 8, '0')
from dueno d
where u.id = d.id
returning u.dni, u.pin_acceso as pin_nuevo;

NOTIFY pgrst, 'reload schema';
