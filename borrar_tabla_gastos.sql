-- Kaserita: borra la tabla "gastos" -- confirmado sin filas (0) y sin
-- ninguna referencia en el código de ninguno de los dos repos (ni
-- Kaserita POS ni KaseritaDelivery). Quedó de algo que nunca se conectó.
--
-- Ejecutar a mano en el SQL Editor de Supabase.

drop table if exists public.gastos;

-- Verificación: debería fallar con "relation does not exist" si lo
-- corrés de nuevo, o podés confirmar que ya no aparece en:
-- select table_name from information_schema.tables where table_schema = 'public' order by 1;
