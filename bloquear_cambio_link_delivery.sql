-- ============================================================
-- Bloquea el cambio del link de pedidos (bodegas.slug) una vez asignado
-- ============================================================
-- Por qué: ese link ya se comparte impreso, por QR y por WhatsApp. Si el
-- dueño lo cambia, el link anterior deja de funcionar y los clientes que lo
-- tenían guardado ya no encuentran la vitrina.
--
-- La pantalla "Mi link de pedidos" ya muestra el link como texto fijo; este
-- trigger cierra el hueco del lado de la base de datos (nadie puede
-- cambiarlo llamando a actualizar_mi_delivery por fuera de la app).
--
-- Reglas:
--   * Si la bodega todavía no tiene link (slug vacío), se puede asignar.
--   * Una vez asignado, solo lo puede cambiar el super-admin (panel admin)
--     o el SQL Editor / service role (auth.uid() es null).
--   * No toca actualizar_mi_delivery ni ninguna otra función.
--
-- Ejecutar en el SQL Editor de Supabase. Es idempotente.
-- ============================================================

create or replace function public.bloquear_cambio_slug_bodega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.slug, '') <> ''
     and new.slug is distinct from old.slug
     and auth.uid() is not null
     and not public.es_superadmin() then
    raise exception 'El link de pedidos ya está asignado y no se puede cambiar. Contactá al administrador.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_cambio_slug_bodega on public.bodegas;
create trigger trg_bloquear_cambio_slug_bodega
  before update of slug on public.bodegas
  for each row
  execute function public.bloquear_cambio_slug_bodega();

-- Comprobación: debe listar el trigger.
select tgname
from pg_trigger
where tgrelid = 'public.bodegas'::regclass
  and tgname = 'trg_bloquear_cambio_slug_bodega';
