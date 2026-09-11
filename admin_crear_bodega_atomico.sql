-- ============================================================
-- Kaserita: crear una bodega desde el panel hacía 2 inserts separados
-- (bodegas, luego usuarios) -- si el segundo fallaba (ej. DNI repetido
-- con otra bodega), el primero ya había quedado guardado: una bodega
-- "huérfana" sin dueño y sin forma de arreglarla desde el panel.
--
-- Esta función junta los dos inserts en una sola transacción: si
-- cualquiera de los dos falla, no se guarda ninguno.
--
-- Ejecutar en el SQL Editor de Supabase. Requiere haber corrido antes
-- panel_admin.sql (usa es_superadmin()).
-- ============================================================

create or replace function public.admin_crear_bodega(
  p_nombre_bodega text,
  p_nombre_dueno text,
  p_dni text,
  p_pin text,
  p_dias integer
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

  insert into bodegas (nombre, activa, activa_hasta)
  values (p_nombre_bodega, true, v_activa_hasta)
  returning id into v_bodega_id;

  -- Si el DNI ya existe en otra bodega (viola el índice único), esta
  -- línea falla y con ella toda la función -- el insert de arriba
  -- también se deshace, no queda ninguna bodega huérfana.
  insert into usuarios (bodega_id, nombre, dni, pin_acceso, rol, activo, auth_id)
  values (v_bodega_id, p_nombre_dueno, p_dni, p_pin, 'dueno', true, null);

  return v_bodega_id;
end;
$$;

grant execute on function public.admin_crear_bodega(text, text, text, text, integer) to authenticated;

NOTIFY pgrst, 'reload schema';
