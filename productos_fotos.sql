-- ============================================================
-- Kaserita: agrega soporte para subir una foto real por producto
-- (opcional -- si no se sube ninguna, la tarjeta sigue mostrando el
-- ícono de su categoría, como hasta ahora).
--
-- Ya existe el bucket "Productos" (con mayúscula, público) creado a mano
-- desde el dashboard -- este script NO crea uno nuevo, solo lo ajusta:
-- la app siempre recomprime la foto a JPEG (~20KB) antes de subirla, así
-- que el bucket tiene que aceptar image/jpeg además de image/png.
--
-- Ejecutar todo este script de una sola vez en el SQL Editor de Supabase.
-- ============================================================

-- Paso 1: columna donde queda la URL pública de la foto una vez subida.
-- null = sin foto (cae de vuelta al ícono de categoría).
alter table productos add column if not exists foto_url text;

-- Paso 2: el bucket "Productos" solo aceptaba image/png -- se agrega
-- image/jpeg (lo que sube la app) y de paso un límite de tamaño real
-- (100KB, con margen sobre los ~20KB a los que la app ya comprime) como
-- respaldo del servidor por si algo raro pasara del lado del navegador.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg'],
    file_size_limit = 102400
where id = 'Productos';

-- Paso 3: solo un usuario autenticado puede subir/reemplazar/borrar
-- fotos, y solo dentro de la carpeta de SU PROPIA bodega. La app sube
-- cada foto a la ruta "{bodega_id}/{producto_id}.jpg", así que el primer
-- segmento de la ruta identifica de quién es.
drop policy if exists "productos_fotos_insertar_propia_bodega" on storage.objects;
create policy "productos_fotos_insertar_propia_bodega"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'Productos' and (storage.foldername(name))[1] = mi_bodega_id()::text);

drop policy if exists "productos_fotos_actualizar_propia_bodega" on storage.objects;
create policy "productos_fotos_actualizar_propia_bodega"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'Productos' and (storage.foldername(name))[1] = mi_bodega_id()::text);

drop policy if exists "productos_fotos_borrar_propia_bodega" on storage.objects;
create policy "productos_fotos_borrar_propia_bodega"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'Productos' and (storage.foldername(name))[1] = mi_bodega_id()::text);

-- Verificación: debería devolver el bucket "Productos" con public = true,
-- allowed_mime_types incluyendo image/jpeg, y file_size_limit = 102400.
select id, public, allowed_mime_types, file_size_limit from storage.buckets where id = 'Productos';

NOTIFY pgrst, 'reload schema';
