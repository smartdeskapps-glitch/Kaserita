-- ============================================================
-- Kaserita: código de barras propio del pack/caja (distinto al de
-- la unidad suelta -- así al escanear cualquiera de los dos se sabe
-- automáticamente si es una venta por pack o por unidad).
-- Ejecutar en el SQL Editor de Supabase (después de packs_y_sku.sql).
-- ============================================================

alter table productos add column if not exists cod_ean_pack text;

NOTIFY pgrst, 'reload schema';
