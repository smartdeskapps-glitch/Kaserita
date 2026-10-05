-- Kaserita: quita la función del flujo viejo de cobro con tarjeta (Culqi).
-- Ejecutar a mano en el SQL Editor de Supabase, DESPUÉS de revisar el paso 1.
--
-- crear_bodega_post_pago creaba una bodega a cualquier usuario con sesión que
-- tuviera una fila "pagado" en pagos_registro. Ya nada del código la llama y
-- el alta hoy es manual (admin_crear_bodega), así que se elimina para no dejar
-- una puerta abierta. La tabla pagos_registro se conserva como archivo.

-- 1) ¿Quedó algún pago histórico sin bodega creada? Si sale alguna fila,
--    atiéndelo primero (crear la bodega a mano desde el panel de admin).
select id, auth_id, plan_id, monto_cobrado, creado_en
from public.pagos_registro
where estado = 'pagado';

-- 2) Quitar la función.
drop function if exists public.crear_bodega_post_pago(text, text, text);
