-- ============================================================
-- Kaserita: auditoría de seguridad de Supabase -- SOLO LECTURA.
-- No modifica nada. Correr en el SQL Editor y revisar (o pasarle a
-- Claude) el resultado: es una sola tabla con una fila por hallazgo.
--
-- Columnas: revision | objeto | detalle
-- Lo importante es lo que dice "REVISAR" o "SIN RLS"; el resto es
-- informativo para comparar con rls_estado_actual.sql.
-- ============================================================

-- 1) Tablas de public sin RLS activado (cualquiera con el GRANT podría
--    leer/escribir todas las filas).
select 'SIN RLS' as revision, c.relname::text as objeto, 'tabla sin row level security' as detalle
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

union all
-- 2) Políticas abiertas: "using (true)" o "with check (true)".
select 'REVISAR: politica abierta', tablename || '.' || policyname,
       cmd || ' | roles=' || roles::text
       || ' | using=' || coalesce(qual, '-') || ' | check=' || coalesce(with_check, '-')
from pg_policies
where schemaname in ('public', 'storage')
  and (qual = 'true' or with_check = 'true')

union all
-- 3) Políticas de ESCRITURA que aplican a anon o a PUBLIC.
select 'REVISAR: escritura para anon', tablename || '.' || policyname,
       cmd || ' | using=' || coalesce(qual, '-') || ' | check=' || coalesce(with_check, '-')
from pg_policies
where schemaname in ('public', 'storage')
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and (roles::text ilike '%anon%' or roles::text ilike '%public%')

union all
-- 4) Funciones SECURITY DEFINER (corren con privilegios de dueño de la
--    base) que un visitante sin sesión puede ejecutar. Las que no
--    mencionan auth.uid(), mi_bodega_id() ni es_superadmin() en su código
--    son las candidatas a revisar a mano.
select case when pg_get_functiondef(p.oid) ~* '(auth\.uid|mi_bodega_id|es_superadmin|mi_cliente_delivery_id)'
            then 'info: definer ejecutable por anon (valida sesion)'
            else 'REVISAR: definer ejecutable por anon SIN validar sesion' end,
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       'lectura/escritura con privilegios elevados'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')

union all
-- 5) Funciones SECURITY DEFINER sin search_path fijo (permite que alguien
--    con permiso de crear objetos "secuestre" nombres de función).
select 'REVISAR: definer sin search_path fijo',
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ''
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')

union all
-- 6) Vistas que saltan RLS (corren con los permisos del dueño de la vista)
--    y que anon puede leer.
select 'REVISAR: vista sin security_invoker legible por anon', c.relname::text,
       'las vistas por defecto ignoran RLS'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
  and not coalesce(c.reloptions::text ilike '%security_invoker=true%', false)
  and has_table_privilege('anon', c.oid, 'select')

union all
-- 7) Tablas donde anon tiene GRANT de escritura (informativo: es el
--    default de Supabase; lo que protege es la política de RLS, ver 3).
select 'info: anon con grant de escritura', table_name::text, string_agg(privilege_type, ', ' order by privilege_type)
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
group by table_name

union all
-- 8) Buckets de Storage públicos (cualquiera con la URL lee el archivo).
select 'info: bucket publico', name::text, 'lectura publica por URL'
from storage.buckets where public

union all
-- 9) Dónde está pgcrypto (si no es "extensions" o "public", las funciones
--    de hash de PIN no lo encuentran).
select 'info: extension', extname::text, 'schema=' || extnamespace::regnamespace::text
from pg_extension where extname in ('pgcrypto', 'pg_net', 'pg_graphql')

union all
-- 10) Usuarios superadmin registrados (tienen acceso total por diseño).
select 'info: superadmin', auth_id::text, coalesce(nombre, '(sin nombre)')
from public.super_admins

order by 1, 2;
