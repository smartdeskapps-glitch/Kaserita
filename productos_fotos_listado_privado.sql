-- Kaserita: el bucket "Productos" ya no se puede LISTAR sin sesión.
-- Ejecutar a mano en el SQL Editor de Supabase.
--
-- Hallazgo (auditoría de KaseritaDelivery, 2026-09-17): con la anon key
-- pública, POST /storage/v1/object/list/Productos devolvía todas las
-- carpetas del bucket -- o sea, el UUID de TODAS las bodegas (tengan
-- delivery o no) y el nombre de cada foto. Las fotos son públicas por
-- diseño (el bucket es público y cada URL se sirve sin RLS), pero el
-- índice completo no tenía por qué serlo.
--
-- Causa: productos_fotos_lectura_publica daba SELECT sobre storage.objects
-- al rol public (anon incluido). Listar = SELECT sobre esa tabla. Se
-- recrea igual pero solo para authenticated:
--   - Las fotos se siguen viendo en Kaserita y en la vitrina: el bucket es
--     público y /object/public/... no consulta esta política.
--   - El panel admin sigue pudiendo listar/borrar carpetas (usa sesión
--     autenticada, ver .list() en index.html).
--   - Solo cambia que un anónimo ya no puede pedir el índice del bucket.

drop policy if exists productos_fotos_lectura_publica on storage.objects;

create policy productos_fotos_lectura_autenticada
  on storage.objects for select
  to authenticated
  using (bucket_id = 'Productos');
