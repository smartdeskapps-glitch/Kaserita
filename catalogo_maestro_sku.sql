-- ============================================================
-- Kaserita: el catálogo maestro usaba un código EAN, pero el EAN real
-- de un producto varía según el proveedor/empaque -- no tiene sentido
-- fijar uno solo a nivel del catálogo maestro. Se reemplaza por un SKU
-- (código interno de Kaserita, generado solo, el admin no lo escribe).
--
-- Ejecutar en el SQL Editor de Supabase. Requiere haber corrido antes
-- catalogo_maestro.sql.
-- ============================================================

alter table public.catalogo_maestro rename column cod_ean to sku;

NOTIFY pgrst, 'reload schema';
