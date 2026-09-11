-- ============================================================
-- Kaserita: deja de guardar el PIN en texto plano una vez que la bodega
-- ya fue reclamada (primer login exitoso).
--
-- Mientras una bodega está "sin reclamar", usuarios.pin_acceso SÍ necesita
-- tener el PIN en texto plano -- es la única forma de validarlo antes de
-- que exista una cuenta real de Auth. Pero una vez que el dueño inicia
-- sesión por primera vez y queda vinculado (auth_id ya no es null), la
-- contraseña de verdad vive -- cifrada -- del lado de Supabase Auth, y ese
-- texto plano ya no hace falta para nada: solo queda ahí como un dato
-- sensible expuesto sin necesidad.
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- Limpieza retroactiva: bodegas que ya se reclamaron antes de este fix y
-- todavía tienen el PIN en texto plano guardado sin necesidad.
update usuarios set pin_acceso = null where auth_id is not null and pin_acceso is not null;

-- De ahora en adelante: reclamar_cuenta_bodega también borra el PIN en
-- texto plano en el mismo momento en que vincula la cuenta.
create or replace function public.reclamar_cuenta_bodega(p_dni text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_bodega uuid;
begin
  select id, bodega_id into v_id, v_bodega from usuarios
    where dni = p_dni and pin_acceso = p_pin and auth_id is null
    limit 1;
  if v_id is null then
    return null;
  end if;
  update usuarios set auth_id = auth.uid(), pin_acceso = null where id = v_id;
  return v_bodega;
end;
$$;

grant execute on function public.reclamar_cuenta_bodega(text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
