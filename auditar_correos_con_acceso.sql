-- ============================================================
-- Kaserita: ¿quién tiene acceso? (hallazgo A5). SOLO LECTURA.
-- Ejecutar en el SQL Editor del proyecto de Kaserita (hzmrsbeamtbloudmxjrp).
-- Es una sola tabla; léela de arriba abajo. Lo que dice REVISAR es lo que
-- hay que mirar con lupa.
--
-- Además, en el panel de Supabase (no se puede hacer por SQL):
--   Authentication > Providers > Email > activar "Confirm email".
--   (El superadmin ya tiene su correo confirmado; esto evita que alguien se
--   registre con el correo de un dueño antes que él.)
-- ============================================================

with cuentas as (
  select a.id, a.email, a.created_at, a.last_sign_in_at, a.email_confirmed_at,
         a.banned_until,
         coalesce((select string_agg(distinct i.provider, ',') from auth.identities i where i.user_id = a.id), '-') as proveedores
  from auth.users a
)
-- 1) Superadmins: tienen acceso a TODAS las bodegas. Deben ser solo tú.
select 'SUPERADMIN' as tipo, c.email::text as correo, c.proveedores as detalle,
       'ultimo ingreso: ' || coalesce(c.last_sign_in_at::date::text, 'nunca') as nota
from public.super_admins s join cuentas c on c.id = s.auth_id

union all
-- 2) Cuentas con correo+contraseña que NO son superadmin: no deberían existir.
select 'REVISAR: correo+contraseña sin ser superadmin', c.email::text, c.proveedores,
       'creada ' || c.created_at::date::text || case when c.email_confirmed_at is null then ' · SIN confirmar' else '' end
from cuentas c
where c.proveedores like '%email%'
  and not exists (select 1 from public.super_admins s where s.auth_id = c.id)

union all
-- 3) Personas con acceso a una bodega: su correo de Google vs. el invitado.
select case when lower(c.email) is distinct from lower(u.email) then 'REVISAR: correo distinto al invitado'
            else 'DUEÑO/USUARIO con acceso' end,
       c.email::text,
       b.nombre || ' · rol ' || u.rol,
       'invitado: ' || coalesce(u.email, '(sin correo)') || ' · ingresos: ' || c.proveedores
from public.usuarios u
join cuentas c on c.id = u.auth_id
join public.bodegas b on b.id = u.bodega_id

union all
-- 4) Invitaciones pendientes: bodegas creadas con un correo que aún no entró.
select 'PENDIENTE: invitación sin reclamar', u.email::text, b.nombre,
       'creada ' || b.creado_en::date::text
from public.usuarios u join public.bodegas b on b.id = u.bodega_id
where u.auth_id is null and u.email is not null

union all
-- 5) Cuentas sin bodega y sin ser superadmin (gente que solo entró con Google
--    a /registro o curioseó). Sin permisos, pero conviene saber cuántas hay.
select 'info: cuenta sin bodega', c.email::text, c.proveedores,
       'creada ' || c.created_at::date::text
from cuentas c
where not exists (select 1 from public.usuarios u where u.auth_id = c.id)
  and not exists (select 1 from public.super_admins s where s.auth_id = c.id)
  and c.email not like 'bodega\_%@kaserita.app'

union all
-- 6) Restos del acceso con DNI+PIN (debe dar 0 después de quitar_acceso_dni_pin.sql).
select 'REVISAR: cuenta DNI+PIN todavía existe', c.email::text, c.proveedores,
       'ultimo ingreso: ' || coalesce(c.last_sign_in_at::date::text, 'nunca')
from cuentas c where c.email like 'bodega\_%@kaserita.app'

order by 1, 2;
