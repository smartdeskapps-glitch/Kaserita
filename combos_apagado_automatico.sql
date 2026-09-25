-- ============================================================
-- Combos: apagado / encendido automatico segun el stock
-- ============================================================
-- Cuando a un producto de un combo se le acaba el stock (menos de lo que
-- pide el combo), o el producto se desactiva, el combo se apaga solo
-- (combos.activo = false) y asi deja de verse en el POS y en Delivery.
-- Cuando se repone, se vuelve a encender solo.
--
-- Solo se reactivan los combos que se apagaron automaticamente
-- (apagado_auto = true). Si el dueno apaga un combo a mano desde el
-- interruptor, queda apagado hasta que el mismo lo encienda.
--
-- Es idempotente: se puede correr mas de una vez.
-- Correr en Supabase -> SQL Editor.
-- ============================================================

alter table public.combos
  add column if not exists apagado_auto boolean not null default false;

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
          and (coalesce(p2.stock_actual, 0) < ci2.cantidad or p2.activo is false)
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
          and (coalesce(p2.stock_actual, 0) < ci2.cantidad or p2.activo is false)
     );

  return null;
end;
$$;

drop trigger if exists trg_combos_sincronizar_stock on public.productos;
create trigger trg_combos_sincronizar_stock
after update of stock_actual, activo on public.productos
for each row
when (old.stock_actual is distinct from new.stock_actual
      or old.activo is distinct from new.activo)
execute function public.combos_sincronizar_stock();

-- Pasada unica para dejar el estado actual al dia (apaga los combos que
-- ya estan sin stock ahora mismo).
update public.combos c
   set activo = false,
       apagado_auto = true
 where c.activo
   and exists (
     select 1
       from public.combos_items ci
       join public.productos p on p.id = ci.producto_id
      where ci.combo_id = c.id
        and (coalesce(p.stock_actual, 0) < ci.cantidad or p.activo is false)
   );

-- Verificacion: debe listar el trigger
select tgname from pg_trigger where tgname = 'trg_combos_sincronizar_stock';
