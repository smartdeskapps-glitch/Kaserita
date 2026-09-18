-- Kaserita: cerrar_cajas_automatico no tiene "search_path" fijo -- el
-- linter de seguridad de Supabase lo marca porque una función SECURITY
-- DEFINER sin search_path fijo puede ser engañada si alguien logra crear
-- un objeto con el mismo nombre que una tabla que la función usa, en un
-- schema que quede antes en el search_path de quien la ejecuta.
--
-- No encontré esta función en ningún archivo de este repo (se ve que se
-- creó a mano en el SQL Editor en algún momento y no quedó guardada acá)
-- -- por eso este script la busca dinámicamente por nombre en vez de
-- reescribirla con CREATE OR REPLACE (así no hay riesgo de pisar su
-- lógica real, que no tengo a la vista).
--
-- Ejecutar a mano en el SQL Editor de Supabase.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cerrar_cajas_automatico'
  loop
    execute format('alter function %s set search_path = public', r.firma);
  end loop;
end $$;

-- Verificación: "proconfig" debería mostrar algo como {search_path=public}.
select p.oid::regprocedure as firma, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'cerrar_cajas_automatico';
