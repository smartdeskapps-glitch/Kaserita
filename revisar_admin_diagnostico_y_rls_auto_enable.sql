-- Kaserita: admin_diagnostico_permisos() y rls_auto_enable() siguen
-- apareciendo como ejecutables por anon/authenticated en el Security
-- Advisor pese a que ningún archivo del repo les da ese grant a mano (ni
-- siquiera se explican por el permiso de PUBLIC, que ya se revocó en
-- migration_23_revocar_execute_publico.sql) -- probablemente alguien les
-- dio grant directo desde el SQL Editor en algún momento, sin guardarlo.
-- Ninguna de las dos parece pensada para que la llame un cliente: suenan
-- a utilidades para correr a mano como super-admin.
--
-- Ejecutar a mano en el SQL Editor de Supabase.

-- Paso 0 (diagnóstico): confirmá qué roles tienen EXECUTE hoy antes de
-- tocar nada -- "aclitem" te muestra algo como "anon=X/postgres".
select p.oid::regprocedure as firma, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_diagnostico_permisos', 'rls_auto_enable');

-- Paso 1: sacarles el acceso a anon y authenticated (quedan solo para
-- quien tenga privilegios de superusuario/dueño, como siempre se
-- corrieron según sus propios nombres).
revoke execute on function public.admin_diagnostico_permisos() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;

NOTIFY pgrst, 'reload schema';
