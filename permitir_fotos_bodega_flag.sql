-- ============================================================
-- Kaserita: agrega un interruptor por bodega para permitir (o no) que
-- esa bodega suba/reemplace/borre las fotos de sus productos -- hasta
-- ahora, tras reactivar_fotos_bodega_y_flag_catalogo_maestro.sql, TODAS
-- las bodegas podían subir fotos por igual; con esto el super-admin
-- puede prender/apagar esto bodega por bodega, igual que ya se puede con
-- "Mostrar Catálogo Maestro".
--
-- Ejecutar en el SQL Editor de Supabase. Requiere haber corrido antes
-- reactivar_fotos_bodega_y_flag_catalogo_maestro.sql.
-- ============================================================

-- Paso 1: columna del interruptor. Por defecto viene activado (true)
-- para no cortarle la subida de golpe a las bodegas que ya la estaban
-- usando.
alter table public.bodegas add column if not exists permitir_subir_fotos boolean not null default true;

-- Paso 2: función que dice si la bodega de quien hace la petición tiene
-- el interruptor activado -- se reutiliza en las 3 políticas de storage
-- de abajo en vez de repetir el mismo subquery tres veces.
create or replace function public.mi_bodega_permite_fotos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(b.permitir_subir_fotos, false)
  from bodegas b
  where b.id = mi_bodega_id();
$$;

grant execute on function public.mi_bodega_permite_fotos() to authenticated;

-- Paso 3: las políticas de "propia bodega" ahora también exigen el
-- interruptor -- si está apagado, ni siquiera puede escribir en su
-- propia carpeta. Las políticas del super-admin no se tocan (siempre
-- puede, sin depender de este interruptor).
drop policy if exists "productos_fotos_insertar_propia_bodega" on storage.objects;
create policy "productos_fotos_insertar_propia_bodega"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'Productos' and (storage.foldername(name))[1] = mi_bodega_id()::text and mi_bodega_permite_fotos());

drop policy if exists "productos_fotos_actualizar_propia_bodega" on storage.objects;
create policy "productos_fotos_actualizar_propia_bodega"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'Productos' and (storage.foldername(name))[1] = mi_bodega_id()::text and mi_bodega_permite_fotos());

drop policy if exists "productos_fotos_borrar_propia_bodega" on storage.objects;
create policy "productos_fotos_borrar_propia_bodega"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'Productos' and (storage.foldername(name))[1] = mi_bodega_id()::text and mi_bodega_permite_fotos());

-- Paso 4: admin_crear_bodega acepta el nuevo interruptor al crear la
-- cuenta (parámetro nuevo al final, con default, para no romper llamados
-- viejos sin ese argumento).
create or replace function public.admin_crear_bodega(
  p_nombre_bodega text,
  p_nombre_dueno text,
  p_dni text,
  p_pin text,
  p_dias integer,
  p_telefono text default null,
  p_mostrar_catalogo_maestro boolean default true,
  p_permitir_subir_fotos boolean default true
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

  insert into bodegas (nombre, activa, activa_hasta, mostrar_catalogo_maestro, permitir_subir_fotos)
  values (p_nombre_bodega, true, v_activa_hasta, p_mostrar_catalogo_maestro, p_permitir_subir_fotos)
  returning id into v_bodega_id;

  insert into usuarios (bodega_id, nombre, dni, pin_acceso, telefono, rol, activo, auth_id)
  values (v_bodega_id, p_nombre_dueno, p_dni, p_pin, nullif(trim(p_telefono), ''), 'dueno', true, null);

  return v_bodega_id;
end;
$$;

grant execute on function public.admin_crear_bodega(text, text, text, text, integer, text, boolean, boolean) to authenticated;

-- Verificación: la columna nueva debería aparecer, todas en true por defecto.
select id, nombre, permitir_subir_fotos, mostrar_catalogo_maestro from bodegas limit 5;

NOTIFY pgrst, 'reload schema';
