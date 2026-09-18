-- Kaserita: ajusta el precio promo del combo -- S/39.90 los primeros 3
-- pagos de cada cuenta (antes S/49.90 los primeros 6), después S/54.90
-- igual que antes. Punto de Venta (S/30) no cambia.
--
-- Ejecutar a mano en el SQL Editor de Supabase. No requiere redesplegar
-- nada -- tanto /registro como la Edge Function cobrar-plan-culqi leen
-- estos valores en vivo de la tabla en cada pago.

update public.planes_kaserita
set precio_soles_promo = 39.90,
    meses_promo = 3
where id = 'combo';

-- Verificación: debería mostrar S/39.90 / 3 meses para el combo.
select id, nombre, precio_soles, precio_soles_promo, meses_promo from public.planes_kaserita;
