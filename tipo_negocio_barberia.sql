-- ============================================================
-- Kaserita: tipo de negocio por cuenta (barberia, paso 1)
-- Ejecutar a mano en el SQL Editor de Supabase. Aditivo e idempotente:
-- no borra ni cambia nada existente. Todas las cuentas actuales quedan
-- como 'bodega' y la app se ve exactamente igual que hoy.
--
-- Las cuentas con tipo_negocio = 'barberia' ven el POS sin los modulos de
-- mercaderia (Entrada de Mercaderia, Toma/Levantamiento de Inventario,
-- Combos, Catalogo Maestro, Cuentas por Pagar) y con "Barberos" en vez de
-- "Cajeros y Empleados".
--
-- Los SERVICIOS (corte, barba...) son productos con stock vacio (NULL): la
-- venta no los bloquea ni los descuenta (ver registrar_venta_atomica.sql).
-- ============================================================

alter table public.bodegas add column if not exists tipo_negocio text not null default 'bodega';

do $$
begin
  alter table public.bodegas add constraint bodegas_tipo_negocio_check
    check (tipo_negocio in ('bodega', 'barberia'));
exception
  when duplicate_object then null;
end $$;

NOTIFY pgrst, 'reload schema';

-- Para convertir una cuenta existente en barberia (cambia el nombre/id):
--   update public.bodegas set tipo_negocio = 'barberia' where id = '<id-de-la-bodega>';
-- Para volver a bodega:
--   update public.bodegas set tipo_negocio = 'bodega' where id = '<id-de-la-bodega>';

-- Verificacion
select id, nombre, tipo_negocio from public.bodegas order by creado_en, id;
