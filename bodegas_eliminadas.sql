-- ============================================================
-- Kaserita: registro de bodegas dadas de baja, para poder comparar más
-- adelante clientes ganados vs. perdidos en el tiempo.
--
-- Hoy, al eliminar una bodega, admin_eliminar_bodega() borra TODO
-- (ventas, productos, clientes, cajeros, usuarios...) incluyendo, por la
-- llave foránea "on delete cascade", sus pagos en pagos_bodega. Con esto,
-- el super-administrador puede elegir -- al momento de eliminar -- si
-- además quiere guardar un resumen de esa bodega (nombre, dueño, plan,
-- cuánto pagó en total, desde cuándo hasta cuándo) antes de que
-- desaparezca todo. Para una bodega de prueba, simplemente no se guarda
-- nada.
--
-- Ejecutar a mano en el SQL Editor de Supabase. Es ADITIVO: crea una
-- tabla nueva. admin_eliminar_bodega SÍ cambia de firma (dos parámetros
-- nuevos, ambos con valor por defecto), así que hay que borrarla primero
-- -- Postgres no deja cambiar los parámetros de una función con
-- "create or replace".
--
-- Seguridad: solo el super-admin puede ver esta tabla (es_superadmin());
-- nadie más, ni siquiera con acceso directo, y no hay forma de
-- insertar/editar/borrar salvo desde la función de abajo.
-- ============================================================

create table if not exists public.bodegas_eliminadas (
  id uuid primary key default gen_random_uuid(),
  bodega_id_original uuid,
  nombre_bodega text not null,
  nombre_dueno text,
  correo_dueno text,
  telefono_dueno text,
  plan_nombre text,
  con_catalogo boolean,
  total_pagado numeric(10,2) not null default 0,
  cantidad_pagos integer not null default 0,
  primer_pago_en date,
  ultimo_pago_en date,
  vencia_el date,
  motivo text,
  eliminado_por uuid default auth.uid(),
  eliminado_en timestamptz not null default now()
);

alter table public.bodegas_eliminadas enable row level security;

drop policy if exists "bodegas_eliminadas_superadmin_select" on public.bodegas_eliminadas;
create policy "bodegas_eliminadas_superadmin_select" on public.bodegas_eliminadas
  for select to authenticated using (es_superadmin());

revoke all on public.bodegas_eliminadas from anon, authenticated;
grant select on public.bodegas_eliminadas to authenticated; -- de todas formas filtrado por la política de arriba

-- ------------------------------------------------------------
-- admin_eliminar_bodega: ahora recibe si hay que guardar el resumen
-- (p_conservar_historial, por defecto SÍ) y un motivo opcional de por qué
-- se fue el cliente. El resto queda exactamente igual a como estaba.
-- ------------------------------------------------------------
drop function if exists public.admin_eliminar_bodega(uuid);

create or replace function public.admin_eliminar_bodega(
  p_bodega_id uuid,
  p_conservar_historial boolean default true,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emails text[];
  v_b public.bodegas%rowtype;
  v_dueno public.usuarios%rowtype;
  v_plan_nombre text;
  v_total_pagado numeric(10,2);
  v_cant_pagos integer;
  v_primer_pago date;
  v_ultimo_pago date;
begin
  if not es_superadmin() then
    raise exception 'No autorizado.';
  end if;

  select * into v_b from public.bodegas where id = p_bodega_id;
  if not found then
    raise exception 'La bodega no existe.';
  end if;

  if p_conservar_historial then
    select * into v_dueno from public.usuarios
    where bodega_id = p_bodega_id and rol = 'dueno'
    limit 1;

    select nombre into v_plan_nombre
    from public.planes_kaserita
    where permite_delivery = coalesce(v_b.delivery_permitido, false)
    order by precio_soles
    limit 1;

    select
      coalesce(sum(monto) filter (where not anulado), 0),
      count(*) filter (where not anulado),
      min(fecha_pago) filter (where not anulado),
      max(fecha_pago) filter (where not anulado)
    into v_total_pagado, v_cant_pagos, v_primer_pago, v_ultimo_pago
    from public.pagos_bodega
    where bodega_id = p_bodega_id;

    insert into public.bodegas_eliminadas (
      bodega_id_original, nombre_bodega, nombre_dueno, correo_dueno,
      telefono_dueno, plan_nombre, con_catalogo, total_pagado,
      cantidad_pagos, primer_pago_en, ultimo_pago_en, vencia_el, motivo
    ) values (
      p_bodega_id, v_b.nombre, v_dueno.nombre, v_dueno.email,
      v_dueno.telefono, v_plan_nombre, coalesce(v_b.delivery_permitido, false),
      v_total_pagado, coalesce(v_cant_pagos, 0), v_primer_pago, v_ultimo_pago,
      v_b.activa_hasta, nullif(trim(p_motivo), '')
    );
  end if;

  -- ---- De acá para abajo, exactamente igual que antes ----

  select array_agg('bodega_' || dni || '@kaserita.app') into v_emails
    from usuarios where bodega_id = p_bodega_id;

  delete from pagos_proveedor where bodega_id = p_bodega_id;
  delete from proveedores where bodega_id = p_bodega_id;
  delete from tomas_inventario where bodega_id = p_bodega_id;
  delete from mermas where bodega_id = p_bodega_id;

  delete from compras where bodega_id = p_bodega_id;
  delete from ventas where bodega_id = p_bodega_id;

  delete from pagos_credito where bodega_id = p_bodega_id;
  delete from clientes where bodega_id = p_bodega_id;
  delete from productos where bodega_id = p_bodega_id;
  delete from categorias where bodega_id = p_bodega_id;
  delete from turnos_caja where bodega_id = p_bodega_id;
  delete from cajeros where bodega_id = p_bodega_id;
  delete from usuarios where bodega_id = p_bodega_id;

  if v_emails is not null then
    delete from auth.users where email = any(v_emails);
  end if;

  delete from bodegas where id = p_bodega_id;
end;
$$;

revoke all on function public.admin_eliminar_bodega(uuid, boolean, text) from public, anon;
grant execute on function public.admin_eliminar_bodega(uuid, boolean, text) to authenticated;

NOTIFY pgrst, 'reload schema';
