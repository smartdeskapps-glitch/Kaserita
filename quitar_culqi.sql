-- Kaserita: quita el nombre "Culqi" de la base de datos.
-- Ejecutar a mano en el SQL Editor de Supabase. No borra datos: solo
-- renombra la columna de pagos_registro que guardaba el id del cargo de
-- Culqi (el cobro con tarjeta en /registro ya no existe; hoy el alta es manual
-- y el pago con tarjeta va por links de Izipay anotados en pagos_bodega).
--
-- Si la columna ya no existe con ese nombre (ya renombrada), no hace nada.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pagos_registro' and column_name = 'culqi_charge_id'
  ) then
    alter table public.pagos_registro rename column culqi_charge_id to referencia_pasarela;
  end if;
end $$;
