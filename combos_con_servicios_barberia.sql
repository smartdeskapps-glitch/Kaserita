-- ============================================================
-- Kaserita: combos con servicios (barberia)
-- Ejecutar a mano en el SQL Editor de Supabase DESPUES de
-- tipo_negocio_barberia.sql. Idempotente.
--
-- Un combo de barberia puede llevar un SERVICIO (producto sin stock, stock_actual
-- NULL), por ejemplo "Tinte (insumo)" + "Aplicacion de tinte". El disparador que
-- apaga/enciende combos segun el stock (combos_apagado_automatico.sql) trataba
-- NULL como 0 y habria apagado ese combo siempre.
--
-- Cambio: en una cuenta con tipo_negocio = 'barberia', un producto sin stock
-- cuenta como disponible siempre. En cualquier otra cuenta todo sigue IGUAL
-- (sin stock sigue contando como 0).
-- ============================================================

create or replace function public.combos_sincronizar_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Apagar los combos activos que ahora tienen un faltante
  update public.combos c
     set activo = false,
         apagado_auto = true
   where c.activo
     and c.id in (select ci.combo_id from public.combos_items ci where ci.producto_id = new.id)
     and exists (
       select 1
         from public.combos_items ci2
         join public.productos p2 on p2.id = ci2.producto_id
        where ci2.combo_id = c.id
          and (
            case when p2.stock_actual is null
                 then not exists (select 1 from public.bodegas b where b.id = p2.bodega_id and b.tipo_negocio = 'barberia')
                 else p2.stock_actual < ci2.cantidad
            end
            or p2.activo is false
          )
     );

  -- Encender los que se apagaron solos y ya no tienen faltantes
  update public.combos c
     set activo = true,
         apagado_auto = false
   where c.apagado_auto
     and not c.activo
     and c.id in (select ci.combo_id from public.combos_items ci where ci.producto_id = new.id)
     and not exists (
       select 1
         from public.combos_items ci2
         join public.productos p2 on p2.id = ci2.producto_id
        where ci2.combo_id = c.id
          and (
            case when p2.stock_actual is null
                 then not exists (select 1 from public.bodegas b where b.id = p2.bodega_id and b.tipo_negocio = 'barberia')
                 else p2.stock_actual < ci2.cantidad
            end
            or p2.activo is false
          )
     );

  return null;
end;
$$;

NOTIFY pgrst, 'reload schema';
