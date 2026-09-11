-- ============================================================
-- Kaserita: bloquea que una bodega suba, reemplace o borre fotos de
-- producto -- de ahora en más las fotos las administra solo Kaserita
-- (super-admin). La app ya no muestra ningún botón para subir fotos
-- desde una bodega; este script cierra también la puerta del lado del
-- servidor (por si alguien intentara llamar a la API de Storage
-- directamente, sin pasar por la app).
--
-- La LECTURA sigue igual de pública -- las bodegas y sus clientes
-- siguen viendo las fotos ya subidas con normalidad, solo se les quita
-- el permiso de escritura.
--
-- Requiere haber corrido antes panel_admin.sql (usa es_superadmin()).
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

drop policy if exists "productos_fotos_insertar_propia_bodega" on storage.objects;
drop policy if exists "productos_fotos_actualizar_propia_bodega" on storage.objects;
drop policy if exists "productos_fotos_borrar_propia_bodega" on storage.objects;

create policy "productos_fotos_insertar_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'Productos' and es_superadmin());

create policy "productos_fotos_actualizar_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'Productos' and es_superadmin());

create policy "productos_fotos_borrar_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'Productos' and es_superadmin());

-- Verificación: los 3 "roles" deberían salir como {authenticated}, y ya
-- no debería quedar ninguna política que dependa de mi_bodega_id() para
-- este bucket.
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'productos_fotos%';

NOTIFY pgrst, 'reload schema';
