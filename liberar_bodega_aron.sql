-- ============================================================
-- Kaserita: desatasca el login de "Bodega Aron" (DNI 49021764).
--
-- Un primer intento de login con un PIN distinto al final creó una
-- cuenta de Auth con esa contraseña equivocada, sin vincular a ningún
-- usuario. Al reintentar con el PIN correcto (081997), el sistema no
-- podía ni iniciar sesión (contraseña no coincide) ni crear la cuenta
-- de nuevo (el correo ya existía) -- por eso el error de "DNI o PIN
-- incorrecto" aunque los datos fueran correctos.
--
-- Este borrado es seguro: solo elimina la cuenta de Auth de ese correo
-- si NINGÚN usuario real la tiene vinculada todavía (o sea, si de
-- verdad está huérfana). Después de correr esto, el dueño puede volver
-- a intentar su login normalmente y quedará vinculado bien.
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

delete from auth.users au
where au.email = 'bodega_49021764@kaserita.app'
  and not exists (select 1 from usuarios u where u.auth_id = au.id);

-- Verificación: debería devolver 0 filas (ya no queda ninguna cuenta con
-- ese correo).
select count(*) as cuentas_restantes from auth.users where email = 'bodega_49021764@kaserita.app';
