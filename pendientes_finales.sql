-- ============================================================
-- Kaserita: pendientes finales. Correr todo de una vez en el
-- SQL Editor de Supabase.
-- ============================================================

-- 1) Columna para guardar el descuento aplicado en cada venta
--    (necesaria para el nuevo botón "Aplicar descuento").
alter table ventas add column if not exists descuento_monto numeric not null default 0;

-- 2) Columna que faltaba en categorias (arregla el error
--    "column categorias.creado_en does not exist" en la consola).
alter table categorias add column if not exists creado_en timestamptz not null default now();

-- 3) Migrar productos con categorías viejas a la lista nueva.
--    Los siguientes cambios son renombres directos y sin ambigüedad:
update productos set categoria = 'Golosinas y Snacks'  where categoria = 'Golosinas';
update productos set categoria = 'Carnes y Embutidos'  where categoria = 'Carnes';
update productos set categoria = 'Verduras y Frutas'   where categoria = 'Verduras';
update productos set categoria = 'Huevos y Frescos'    where categoria = 'Frescos';
update productos set categoria = 'Limpieza del Hogar'  where categoria = 'Limpieza';

-- "Bebidas" es ambiguo (podría ser Gaseosas, Jugos o Aguas según el
-- producto), así que NO se migra automáticamente. Revisa cuántos
-- productos quedan así:
select id, descripcion, categoria from productos where categoria = 'Bebidas';

-- ...y si quieres mandarlos todos a "Gaseosas" por defecto (puedes
-- reasignar los que no correspondan después, uno por uno, desde
-- "Editar Producto"), descomenta y corre esta línea:
-- update productos set categoria = 'Gaseosas' where categoria = 'Bebidas';
