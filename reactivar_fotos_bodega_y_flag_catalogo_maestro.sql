-- ============================================================
-- Kaserita: (1) vuelve a permitir que cada bodega suba/reemplace/borre
-- las fotos de SUS PROPIOS productos (esto se había bloqueado en
-- bloquear_fotos_bodega.sql, dejando la subida solo para el catálogo
-- maestro administrado por Kaserita); y (2) agrega un interruptor por
-- bodega para mostrar u ocultar el Catálogo Maestro en esa cuenta.
--
-- Ejecutar todo este script de una sola vez en el SQL Editor de
-- Supabase. Requiere haber corrido antes panel_admin.sql,
-- productos_fotos.sql y admin_crear_bodega_atomico.sql (+ bodega_telefono.sql).
-- ============================================================

-- Paso 1: reabrir las políticas de storage para que cada bodega pueda
-- escribir dentro de SU PROPIA carpeta ("{bodega_id}/{producto_id}.jpg").
-- Las políticas del super-admin (creadas en bloquear_fotos_bodega.sql) NO
-- se tocan -- en Postgres, varias políticas "permissive" para el mismo
-- comando se combinan con OR, así que admin y bodega dueña pueden subir
-- ambos sin pisarse.
drop policy if exists "productos_fotos_insertar_propia_bodega" on storage.objects;
create policy "productos_fotos_insertar_propia_bodega"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'Productos' and (storage.foldername(name))[1] = mi_bodega_id()::text);

drop policy if exists "productos_fotos_actualizar_propia_bodega" on storage.objects;
create policy "productos_fotos_actualizar_propia_bodega"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'Productos' and (storage.foldername(name))[1] = mi_bodega_id()::text);

drop policy if exists "productos_fotos_borrar_propia_bodega" on storage.objects;
create policy "productos_fotos_borrar_propia_bodega"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'Productos' and (storage.foldername(name))[1] = mi_bodega_id()::text);

-- Paso 2: columna para decidir, bodega por bodega, si esa cuenta ve el
-- Catálogo Maestro (el botón "Importar del Catálogo Maestro" y las
-- sugerencias automáticas al escribir un producto nuevo). Por defecto
-- viene activado (true) para no ocultarlo de golpe a las bodegas que ya
-- existen.
alter table public.bodegas add column if not exists mostrar_catalogo_maestro boolean not null default true;

-- Paso 3: admin_crear_bodega acepta el nuevo interruptor al crear la
-- cuenta (parámetro nuevo al final, con default, para no romper llamados
-- viejos sin ese argumento).
create or replace function public.admin_crear_bodega(
  p_nombre_bodega text,
  p_nombre_dueno text,
  p_dni text,
  p_pin text,
  p_dias integer,
  p_telefono text default null,
  p_mostrar_catalogo_maestro boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bodega_id uuid;
  v_activa_hasta date;
begin
  if not es_superadmin() then
    raise exception 'No autorizado.';
  end if;

  v_activa_hasta := case when p_dias > 0 then (current_date + (p_dias || ' days')::interval)::date else null end;

  insert into bodegas (nombre, activa, activa_hasta, mostrar_catalogo_maestro)
  values (p_nombre_bodega, true, v_activa_hasta, p_mostrar_catalogo_maestro)
  returning id into v_bodega_id;

  insert into usuarios (bodega_id, nombre, dni, pin_acceso, telefono, rol, activo, auth_id)
  values (v_bodega_id, p_nombre_dueno, p_dni, p_pin, nullif(trim(p_telefono), ''), 'dueno', true, null);

  return v_bodega_id;
end;
$$;

grant execute on function public.admin_crear_bodega(text, text, text, text, integer, text, boolean) to authenticated;

-- Verificación: la columna nueva debería aparecer, todas en true por defecto.
select id, nombre, mostrar_catalogo_maestro from bodegas limit 5;

NOTIFY pgrst, 'reload schema';
