-- ============================================================
-- Kaserita: venta por pack/caja + SKU
-- Ejecutar todo este script de una sola vez en el SQL Editor de Supabase.
-- ============================================================

-- Un producto puede venderse suelto Y por pack a la vez (ej: gaseosa
-- suelta o el six-pack). El stock siempre se guarda en unidades sueltas
-- (stock_actual ya existente) -- vender 1 pack de 6 descuenta 6 del
-- mismo número, así no hace falta llevar un contador aparte de "packs
-- cerrados" vs "unidades sueltas de un pack abierto".
alter table productos add column if not exists unidades_por_pack integer not null default 1;
alter table productos add column if not exists precio_venta_pack numeric;

-- SKU: código interno corto, independiente del código de barras (que a
-- veces no existe), para identificar el producto en reportes/estantes.
alter table productos add column if not exists sku text;

-- Registra cuántas unidades base se descontaron de stock por cada línea
-- de venta (si fue un pack, son más que "cantidad"). Se guarda al momento
-- de la venta para poder revertirlo bien al anular, sin depender de que
-- la configuración de pack del producto no haya cambiado después.
alter table ventas_detalle add column if not exists unidades_stock numeric;

NOTIFY pgrst, 'reload schema';
