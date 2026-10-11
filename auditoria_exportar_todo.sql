-- ============================================================
-- Kaserita: exporta TODA la configuracion de seguridad de Supabase
-- para auditarla. SOLO LECTURA: no modifica nada ni lee datos de clientes.
--
-- Uso: SQL Editor -> pegar -> Run -> en los resultados "Export" ->
-- "Download CSV" y guardar el archivo en la carpeta del repo Kaserita
-- como auditoria_dump.csv
--
-- Una fila por objeto: tipo | objeto | detalle
-- ============================================================

-- Tablas: RLS y permisos de anon / authenticated
select 'tabla' as tipo, c.relname::text as objeto,
       'rls=' || c.relrowsecurity::text || ' forzado=' || c.relforcerowsecurity::text
       || ' | anon=' || coalesce((select string_agg(g.privilege_type, ',' order by g.privilege_type)
                                 from information_schema.role_table_grants g
                                 where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'anon'), '-')
       || ' | authenticated=' || coalesce((select string_agg(g.privilege_type, ',' order by g.privilege_type)
                                 from information_schema.role_table_grants g
                                 where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'authenticated'), '-')
       as detalle
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')

union all
-- Politicas de RLS (public y storage)
select 'politica', schemaname || '.' || tablename || '.' || policyname,
       cmd || ' | ' || permissive || ' | roles=' || roles::text
       || ' | using=' || coalesce(qual, '-') || ' | check=' || coalesce(with_check, '-')
from pg_policies
where schemaname in ('public', 'storage')

union all
-- Funciones propias (no las de extensiones) con su codigo completo
select 'funcion', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       'definer=' || p.prosecdef::text
       || ' anon=' || has_function_privilege('anon', p.oid, 'execute')::text
       || ' authenticated=' || has_function_privilege('authenticated', p.oid, 'execute')::text
       || ' config=' || coalesce(p.proconfig::text, '-')
       || chr(10) || pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')

union all
-- Vistas (por defecto ignoran RLS si no tienen security_invoker)
select 'vista', c.relname::text,
       'opciones=' || coalesce(c.reloptions::text, '-')
       || ' anon_select=' || has_table_privilege('anon', c.oid, 'select')::text
       || chr(10) || pg_get_viewdef(c.oid)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v', 'm')

union all
-- Triggers de las tablas propias
select 'trigger', c.relname || '.' || t.tgname, pg_get_triggerdef(t.oid)
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal

union all
-- Buckets de Storage
select 'bucket', b.name::text,
       'public=' || b.public::text
       || ' limite=' || coalesce(b.file_size_limit::text, '-')
       || ' tipos=' || coalesce(b.allowed_mime_types::text, '-')
from storage.buckets b

union all
-- Solo conteos (ningun dato personal): cuentas que todavia entran con DNI + PIN
select 'dato', 'bodegas sin reclamar con PIN guardado',
       (select count(*) from public.usuarios where auth_id is null and pin_acceso is not null)::text
union all
select 'dato', 'cuentas de acceso con DNI+PIN (bodega_...@kaserita.app)',
       (select count(*) from auth.users where email like 'bodega\_%@kaserita.app')::text
union all
select 'dato', 'de esas, con ingreso en los ultimos 90 dias',
       (select count(*) from auth.users where email like 'bodega\_%@kaserita.app'
          and last_sign_in_at > now() - interval '90 days')::text

order by 1, 2;
