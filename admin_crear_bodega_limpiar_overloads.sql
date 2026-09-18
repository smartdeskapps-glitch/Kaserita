-- Kaserita: admin_crear_bodega quedó con 4 versiones (5, 6, 7 y 8
-- argumentos) acumuladas -- cada vez que se agregó un parámetro nuevo se
-- usó CREATE OR REPLACE, pero Postgres identifica una función por su
-- nombre + tipos de argumentos, así que agregar un parámetro (aunque
-- tenga default) crea una función nueva en vez de reemplazar la vieja.
-- Las 3 versiones viejas siguen ahí, siguen siendo llamables, y aunque
-- todas validan es_superadmin() (no es una falla de seguridad), cualquier
-- llamado viejo se olvidaría de setear teléfono/catálogo maestro/permitir
-- fotos en la bodega nueva.
--
-- Ejecutar a mano en el SQL Editor de Supabase. Deja solo la versión
-- final (8 argumentos, de permitir_fotos_bodega_flag.sql).

drop function if exists public.admin_crear_bodega(text, text, text, text, integer);
drop function if exists public.admin_crear_bodega(text, text, text, text, integer, text);
drop function if exists public.admin_crear_bodega(text, text, text, text, integer, text, boolean);

-- Verificación: debería devolver una sola fila (la de 8 argumentos).
select p.oid::regprocedure
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'admin_crear_bodega';

NOTIFY pgrst, 'reload schema';
