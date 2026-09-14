-- ============================================================
-- Kaserita: cierra el hueco donde CUALQUIER cajero podía volverse
-- Administrador (Dashboard de Ventas, Cuentas por Pagar, editar
-- productos, cierres de caja, etc.) con solo elegir ese nombre en el
-- selector de "Abrir Turno" -- ese selector no pedía nada, porque en
-- Kaserita no hay login individual por empleado (todos comparten la
-- misma sesión del dueño), así que "elegir cajero" era solo una
-- etiqueta sin ninguna verificación real detrás.
--
-- Con esto, cada cuenta con rol "Administrador" tiene su propio PIN.
-- El dueño queda exento al elegirse a sí mismo (ya probó su identidad
-- al iniciar sesión); elegir a otro Administrador desde el selector va
-- a pedir ese PIN, verificado en el servidor (nunca se manda el PIN
-- guardado al navegador -- ver el "revoke" del paso 2).
--
-- Ejecutar en el SQL Editor de Supabase. Requiere mi_bodega_id()
-- (rls_migracion.sql).
-- ============================================================

-- Paso 1: columna del PIN (solo se usa para cajeros con rol
-- 'administrador' -- un cajero normal no la necesita, ya que no
-- desbloquea nada).
alter table public.cajeros add column if not exists pin_seguridad text;

-- Paso 2: aunque las políticas de RLS de "cajeros" ya limitan las filas
-- visibles a la propia bodega, todas comparten la MISMA sesión --
-- cualquiera con acceso a las herramientas de desarrollador del
-- navegador podría leer esta columna en la respuesta de un
-- select('*') normal. Se le saca el permiso de LECTURA a esta columna
-- puntual (la escritura para crearla/cambiarla sigue igual) -- de ahí
-- en más, solo verificar_pin_cajero() (más abajo, con privilegios
-- elevados) puede leerla.
revoke select (pin_seguridad) on public.cajeros from authenticated;
revoke select (pin_seguridad) on public.cajeros from anon;

-- Paso 3: freno contra probar PINs de 4 dígitos uno por uno -- igual
-- que intentos_reclamo_pin (cerrar_huecos_criticos_auth.sql), después
-- de 8 intentos fallidos contra el MISMO cajero, se bloquea 15 minutos.
create table if not exists public.intentos_pin_cajero (
  cajero_id uuid primary key references public.cajeros(id) on delete cascade,
  intentos integer not null default 0,
  bloqueado_hasta timestamptz
);
alter table public.intentos_pin_cajero enable row level security;

-- Paso 4: única forma de confirmar un PIN -- recibe el id del cajero y
-- el PIN tipeado, devuelve true/false. Nunca devuelve el PIN guardado.
create or replace function public.verificar_pin_cajero(p_cajero_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bloqueado_hasta timestamptz;
  v_ok boolean;
begin
  select bloqueado_hasta into v_bloqueado_hasta from intentos_pin_cajero where cajero_id = p_cajero_id;

  if v_bloqueado_hasta is not null and v_bloqueado_hasta > now() then
    raise exception 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
  end if;

  v_ok := exists (
    select 1 from cajeros
    where id = p_cajero_id
      and bodega_id = mi_bodega_id()
      and pin_seguridad is not null
      and pin_seguridad = p_pin
  );

  if v_ok then
    delete from intentos_pin_cajero where cajero_id = p_cajero_id;
  else
    insert into intentos_pin_cajero (cajero_id, intentos, bloqueado_hasta)
    values (p_cajero_id, 1, null)
    on conflict (cajero_id) do update set
      intentos = intentos_pin_cajero.intentos + 1,
      bloqueado_hasta = case
        when intentos_pin_cajero.intentos + 1 >= 8 then now() + interval '15 minutes'
        else intentos_pin_cajero.bloqueado_hasta
      end;
  end if;

  return v_ok;
end;
$$;

grant execute on function public.verificar_pin_cajero(uuid, text) to authenticated;

-- Verificación: la columna nueva debería existir, pero NO debería
-- poder seleccionarse por su nombre desde el rol "authenticated" (esta
-- consulta debería fallar con "permission denied for column
-- pin_seguridad" si el revoke funcionó -- eso es lo esperado).
select id, nombre, rol from public.cajeros limit 1;

NOTIFY pgrst, 'reload schema';
