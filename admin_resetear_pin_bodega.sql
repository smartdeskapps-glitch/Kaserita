-- ============================================================
-- Kaserita: le permite al super-admin resetear el PIN de acceso de una
-- bodega (dueño olvidó su PIN, o quiere cambiarlo) sin necesitar el
-- service_role key para tocar Auth directamente.
--
-- Cómo funciona: borra la cuenta de Auth de ese dueño (si existe, esté
-- reclamada o no) y guarda el PIN nuevo en texto plano en pin_acceso,
-- exactamente como cuando se crea una bodega nueva -- así el dueño vuelve
-- a "reclamar" su cuenta en su próximo login con el PIN nuevo (ver
-- reclamar_cuenta_bodega), y ese PIN se vuelve a poner en null apenas lo
-- hace (ver limpiar_pin_acceso_reclamado.sql).
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create or replace function public.admin_resetear_pin_bodega(p_bodega_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario record;
  v_email text;
begin
  if not es_superadmin() then
    raise exception 'No autorizado.';
  end if;

  if p_pin is null or length(trim(p_pin)) < 4 then
    raise exception 'El PIN debe tener al menos 4 caracteres.';
  end if;

  select id, dni into v_usuario from usuarios where bodega_id = p_bodega_id and rol = 'dueno' limit 1;
  if v_usuario.id is null then
    raise exception 'No se encontró el dueño de esta bodega.';
  end if;

  v_email := 'bodega_' || v_usuario.dni || '@kaserita.app';

  delete from auth.users where email = v_email;

  update usuarios set auth_id = null, pin_acceso = trim(p_pin) where id = v_usuario.id;
end;
$$;

grant execute on function public.admin_resetear_pin_bodega(uuid, text) to authenticated;

NOTIFY pgrst, 'reload schema';
