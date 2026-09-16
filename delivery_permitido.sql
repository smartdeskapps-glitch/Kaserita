-- ============================================================
-- Kaserita: gate de "Pedidos por WhatsApp" (KaseritaDelivery) por bodega
-- -- es una función paga aparte del plan base, así que solo el
-- super-admin puede otorgarla, desde el toggle "Pedidos WhatsApp" del
-- panel de administrador.
--
-- Ojo: bodegas ya NO tiene una política de UPDATE para bodegas_update
-- scoped a mi_bodega_id() (solo queda bodegas_admin_todo, para
-- es_superadmin()) -- así que el dueño no puede tocar su propia fila de
-- bodegas directo. Esta función es el único camino, y de paso obliga a
-- respetar delivery_permitido antes de dejar prender delivery_habilitado.
--
-- Requiere haber corrido antes migration.sql del repo Kaserita-Delivery
-- (agrega bodegas.slug / bodegas.delivery_habilitado).
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

alter table public.bodegas
  add column if not exists delivery_permitido boolean not null default false;

create or replace function public.actualizar_mi_delivery(p_slug text, p_delivery_habilitado boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bodega_id uuid;
  v_permitido boolean;
begin
  select bodega_id into v_bodega_id from usuarios where auth_id = auth.uid();
  if v_bodega_id is null then
    raise exception 'No autorizado.';
  end if;

  select delivery_permitido into v_permitido from bodegas where id = v_bodega_id;

  if p_delivery_habilitado and not coalesce(v_permitido, false) then
    raise exception 'Esta bodega todavía no tiene habilitados los Pedidos por WhatsApp. Contactá al administrador.';
  end if;

  update bodegas
    set slug = nullif(trim(p_slug), ''),
        delivery_habilitado = p_delivery_habilitado
    where id = v_bodega_id;
end;
$$;

grant execute on function public.actualizar_mi_delivery(text, boolean) to authenticated;

NOTIFY pgrst, 'reload schema';
