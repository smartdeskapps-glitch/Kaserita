-- ============================================================
-- Kaserita: último resto de la auditoría de "bodegas".
--
-- Tras seguridad_ronda2_politicas_y_funciones.sql, la tabla quedó con dos
-- políticas de lectura ("bodegas_select" y "bodegas_select_propia", rol
-- public) que además de "tu propia bodega" dejan leer CUALQUIER bodega que
-- todavía no tenga usuarios. Esa rama existía para cuando el registro creaba
-- la bodega desde el navegador y necesitaba leer su propia fila antes de que
-- existiera el usuario dueño. Hoy las bodegas se crean solo con
-- admin_crear_bodega / crear_bodega_post_pago (funciones con privilegios
-- elevados), así que ya no hace falta.
--
-- Se dejan una sola política de lectura, solo para usuarios con sesión y
-- solo de su propia bodega. El superadmin sigue viendo todo por
-- "bodegas_admin_todo" (no se toca).
--
-- Al final devuelve las políticas de "bodegas" y todas las de Storage
-- (quién puede subir/leer/borrar archivos) para revisarlas.
-- ============================================================

drop policy if exists "bodegas_select" on public.bodegas;
drop policy if exists "bodegas_select_propia" on public.bodegas;

create policy "bodegas_select_propia" on public.bodegas
  for select to authenticated
  using (id = mi_bodega_id());

select tablename, policyname, cmd, roles::text as roles, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename = 'bodegas')
   or schemaname = 'storage'
order by schemaname, tablename, cmd, policyname;

NOTIFY pgrst, 'reload schema';
