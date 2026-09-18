-- Kaserita: chequeo antes de borrar dos tablas que no usa ningún código
-- de ninguno de los dos repos (Kaserita POS ni KaseritaDelivery):
--   - ventas_espera: se creó en schema.sql con RLS, pero el POS guarda
--     las "ventas en espera" en localStorage del navegador, no acá.
--   - gastos: no aparece en ningún archivo, ni siquiera un CREATE TABLE
--     -- se creó directo en el SQL Editor en algún momento y quedó sin usar.
--
-- Ejecutar a mano en el SQL Editor de Supabase. Esto NO borra nada,
-- solo muestra cuántas filas tiene cada una.

select 'ventas_espera' as tabla, count(*) as filas from public.ventas_espera
union all
select 'gastos' as tabla, count(*) as filas from public.gastos;
