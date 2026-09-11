-- ============================================================
-- Kaserita: evita que un PIN mal tecleado en el primer login de una
-- bodega deje una cuenta de Auth "huérfana" y atascada para siempre.
--
-- Antes, si el DNI+PIN no coincidía, igual se creaba la cuenta de Auth
-- (con esa contraseña equivocada) y recién después se validaba contra
-- "usuarios" -- si no coincidía, la cuenta ya estaba creada pero sin
-- vincular, y como el correo (derivado del DNI) queda ocupado, ningún
-- intento posterior -- ni con el PIN correcto -- podía volver a crearla
-- ni iniciar sesión con ella.
--
-- Esta función se llama ANTES de crear la cuenta de Auth: solo si
-- confirma que el DNI+PIN corresponde a una bodega real sin reclamar
-- todavía, el cliente procede a crear la cuenta.
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create or replace function public.puede_reclamar_bodega(p_dni text, p_pin text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from usuarios
    where dni = p_dni and pin_acceso = p_pin and auth_id is null
  );
$$;

grant execute on function public.puede_reclamar_bodega(text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
