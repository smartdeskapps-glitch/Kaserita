-- ============================================================
-- Kaserita: guarda el celular del dueño al crear una bodega desde el
-- panel, para poder escribirle por WhatsApp directo desde ahí (cobros,
-- avisos de vencimiento, soporte).
--
-- Ejecutar en el SQL Editor de Supabase. Requiere haber corrido antes
-- admin_crear_bodega_atomico.sql.
-- ============================================================

-- ============================================================
-- ¡NO VOLVER A CORRER! Script histórico, bloqueado a propósito (auditoría 2026-11).
-- Motivo: recrea admin_crear_bodega con PIN en texto plano (eliminada en quitar_acceso_dni_pin.sql).
-- ============================================================
do $$
begin
  raise exception 'SCRIPT HISTORICO BLOQUEADO: no correr bodega_telefono.sql. Motivo: recrea admin_crear_bodega con PIN en texto plano (eliminada en quitar_acceso_dni_pin.sql). Estado vigente y orden de scripts: README.md (sección Base de datos). Para una base nueva usa un dump de produccion (supabase db dump). Si de verdad hace falta, borra este bloque a mano.';
end $$;


alter table public.usuarios add column if not exists telefono text;

-- Se agrega p_telefono al final con default null: los llamados viejos
-- (sin ese argumento) siguen funcionando igual, ver notas de Postgres
-- sobre CREATE OR REPLACE FUNCTION con parámetros nuevos al final.
create or replace function public.admin_crear_bodega(
  p_nombre_bodega text,
  p_nombre_dueno text,
  p_dni text,
  p_pin text,
  p_dias integer,
  p_telefono text default null
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

  insert into usuarios (bodega_id, nombre, dni, pin_acceso, telefono, rol, activo, auth_id)
  values (v_bodega_id, p_nombre_dueno, p_dni, p_pin, nullif(trim(p_telefono), ''), 'dueno', true, null);

  return v_bodega_id;
end;
$$;

grant execute on function public.admin_crear_bodega(text, text, text, text, integer, text) to authenticated;

NOTIFY pgrst, 'reload schema';
