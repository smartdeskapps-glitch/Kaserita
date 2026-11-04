-- ============================================================
-- Kaserita: el link de pedidos (bodegas.slug) ahora se valida (hallazgo M5).
-- Ejecutar a mano en el SQL Editor de Supabase. Idempotente.
-- Va DESPUÉS de autorizacion_por_rol.sql (esta función la reemplaza y conserva
-- la exigencia de administración desbloqueada).
--
-- Antes: cualquier texto, sin largo, sin nombres reservados y sin mirar la
-- vigencia de la bodega. Como el link no se puede cambiar una vez asignado
-- (bloquear_cambio_link_delivery.sql), alguien podía quedarse para siempre con
-- /bcp, /yape o /sunat y usarlo para suplantar.
--
-- Reglas: 3 a 40 caracteres, solo minúsculas, números y guiones (sin guion al
-- principio ni al final), no reservado, único (sin importar mayúsculas), y la
-- bodega debe estar activa y vigente.
-- ============================================================

create or replace function public.actualizar_mi_delivery(p_slug text, p_delivery_habilitado boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bodega_id uuid := public.mi_bodega_id();
  v_permitido boolean;
  v_slug text := nullif(lower(trim(coalesce(p_slug, ''))), '');
  v_reservados text[] := array[
    'admin', 'administrador', 'api', 'app', 'assets', 'auth', 'ayuda', 'bbva', 'bcp', 'blog',
    'cuenta', 'delivery', 'demo', 'interbank', 'indecopi', 'kaserita', 'kaseritadelivery',
    'login', 'logout', 'manual', 'pago', 'pagos', 'plin', 'politicas', 'pos', 'privacidad',
    'reclamos', 'registro', 'reniec', 'scotiabank', 'soporte', 'static', 'sunat', 'terminos',
    'test', 'tienda', 'tiendas', 'www', 'yape', 'smartdeskapps'
  ];
begin
  if not public.es_admin_elevado() then
    raise exception 'Desbloquea la administración con tu PIN para hacer esto.' using errcode = '42501';
  end if;
  if v_bodega_id is null then
    raise exception 'No autorizado.';
  end if;

  if v_slug is not null then
    if v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
      raise exception 'El link debe tener entre 3 y 40 letras minúsculas, números o guiones (sin guion al principio ni al final).';
    end if;
    if v_slug = any(v_reservados) then
      raise exception 'Ese link no está disponible. Elige otro.';
    end if;
    if exists (select 1 from bodegas where lower(slug) = v_slug and id <> v_bodega_id) then
      raise exception 'Ese link ya está en uso. Elige otro.';
    end if;
  end if;

  select delivery_permitido into v_permitido from bodegas where id = v_bodega_id;
  if p_delivery_habilitado and not coalesce(v_permitido, false) then
    raise exception 'Esta bodega todavía no tiene habilitados los Pedidos por WhatsApp. Contactá al administrador.';
  end if;

  update bodegas
    set slug = v_slug,
        delivery_habilitado = p_delivery_habilitado
    where id = v_bodega_id;
end;
$$;

revoke execute on function public.actualizar_mi_delivery(text, boolean) from public, anon;
grant execute on function public.actualizar_mi_delivery(text, boolean) to authenticated;

-- Unicidad también en la base (por si otra ruta escribe el slug). Si ya hay
-- repetidos, avisa y sigue: resuélvelos a mano y vuelve a correr este bloque.
do $$
begin
  create unique index if not exists bodegas_slug_lower_uidx
    on public.bodegas (lower(slug)) where slug is not null and slug <> '';
exception
  when unique_violation then
    raise notice 'Hay links repetidos en bodegas.slug: corrígelos y vuelve a correr este bloque.';
end $$;

NOTIFY pgrst, 'reload schema';

-- Verificación: links ya asignados que NO cumplen las reglas nuevas (solo informativo).
select id, nombre, slug from public.bodegas
where slug is not null and slug <> '' and slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$';
