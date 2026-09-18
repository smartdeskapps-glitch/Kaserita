-- Kaserita: la política de LISTAR el bucket "Productos" sigue abierta a
-- cualquier usuario autenticado (cualquier cajero de cualquier bodega, y
-- también cualquier cliente logueado de KaseritaDelivery), no solo al
-- dueño de esa carpeta -- así cualquiera con sesión puede pedir el índice
-- completo del bucket y ver el UUID de todas las bodegas + nombres de
-- archivo de todas (aunque las fotos en sí ya son públicas por diseño,
-- el índice completo no tenía por qué serlo).
--
-- Ejecutar a mano en el SQL Editor de Supabase, después de
-- productos_fotos_listado_privado.sql.
--
-- Se restringe el listado a la propia carpeta de bodega (mismo criterio
-- que ya usan insert/update/delete), y se deja abierto para el
-- super-admin (lo necesita admin_eliminar_bodega, que lista y borra la
-- carpeta de storage de la bodega que se está dando de baja).

drop policy if exists productos_fotos_lectura_autenticada on storage.objects;

create policy productos_fotos_listado_propia_bodega_o_admin
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'Productos'
    and ((storage.foldername(name))[1] = mi_bodega_id()::text or es_superadmin())
  );

NOTIFY pgrst, 'reload schema';
