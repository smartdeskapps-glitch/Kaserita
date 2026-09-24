-- ============================================================
-- Kaserita: registro de actividad (quién tocó qué y cuándo).
-- Ejecutar todo de una sola vez en el SQL Editor de Supabase.
-- Idempotente: se puede volver a correr.
--
-- Cómo funciona: triggers en la propia base anotan, en la tabla
-- "auditoria", los cambios que más importan si algo raro pasa:
--   productos   -> precio de venta / costo, producto desactivado o borrado
--   ventas      -> venta anulada (con el motivo), total o medio de pago
--                  modificado, venta borrada
--   turnos_caja -> apertura y cierre (monto contado y diferencia)
--   cajeros     -> empleado creado, borrado, cambio de rol, activado o
--                  desactivado, cambio de PIN (nunca se guarda el PIN)
--   mermas      -> pérdidas registradas o borradas
--
-- Se hace en la base y no en la pantalla a propósito: nadie puede
-- "olvidarse" de anotar algo ni borrar su rastro desde la app (la tabla
-- no tiene permisos de escritura ni borrado para la API).
--
-- Límite: la base sabe QUÉ cuenta hizo el cambio, pero en Kaserita todos
-- los empleados trabajan con la sesión del dueño. Por eso cada registro
-- guarda también los empleados que tenían un turno abierto en ese
-- momento ("turnos_abiertos"), que es la mejor pista de quién estaba
-- operando la caja.
--
-- Seguridad de la propia auditoría: si por cualquier motivo un trigger
-- falla, la operación del negocio (vender, editar, cerrar caja) sigue
-- adelante igual; nunca se bloquea una venta por un error de auditoría.
-- ============================================================

create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  bodega_id uuid not null,
  tabla text not null,
  operacion text not null,            -- INSERT | UPDATE | DELETE
  registro_id text,
  resumen text not null,              -- frase lista para mostrar
  cambios jsonb,                      -- { columna: { antes, despues } }
  turnos_abiertos text[],             -- empleados con turno abierto en ese momento
  autor_auth uuid                     -- cuenta de Auth que hizo el cambio
);

create index if not exists auditoria_bodega_fecha_idx on public.auditoria (bodega_id, creado_en desc);

alter table public.auditoria enable row level security;

drop policy if exists "auditoria_select_bodega" on public.auditoria;
create policy "auditoria_select_bodega" on public.auditoria
  for select to authenticated
  using (bodega_id = mi_bodega_id() or es_superadmin());

-- Solo lectura desde la API: sin insert, update ni delete para nadie.
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;

-- ------------------------------------------------------------
-- Función común de los triggers. Usa to_jsonb(NEW/OLD) en vez de nombrar
-- columnas: si una columna no existe simplemente no aparece, y el trigger
-- no puede fallar por un cambio de estructura.
-- Argumentos del trigger = columnas a vigilar en los UPDATE.
-- ------------------------------------------------------------
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_fila jsonb := coalesce(v_new, v_old);
  v_col text;
  v_cambios jsonb := '{}'::jsonb;
  v_bodega uuid;
  v_nombre text;
  v_etiqueta text;
  v_verbo text;
  v_detalle text;
  v_abiertos text[];
begin
  begin
    v_bodega := nullif(v_fila->>'bodega_id', '')::uuid;
    if v_bodega is null then
      return coalesce(new, old);
    end if;

    if tg_op = 'UPDATE' then
      foreach v_col in array tg_argv loop
        if v_col = 'pin_seguridad' then
          if (v_old->v_col) is distinct from (v_new->v_col) then
            v_cambios := v_cambios || jsonb_build_object('pin_seguridad', jsonb_build_object('antes', 'oculto', 'despues', 'cambiado'));
          end if;
        elsif (v_old->v_col) is distinct from (v_new->v_col) then
          v_cambios := v_cambios || jsonb_build_object(v_col, jsonb_build_object('antes', v_old->v_col, 'despues', v_new->v_col));
        end if;
      end loop;
      if v_cambios = '{}'::jsonb then
        return new;
      end if;
    end if;

    v_nombre := coalesce(v_fila->>'descripcion', v_fila->>'nombre', v_fila->>'nro_boleta', v_fila->>'id');
    v_etiqueta := case tg_table_name
      when 'productos' then 'Producto'
      when 'ventas' then 'Venta'
      when 'turnos_caja' then 'Turno de caja'
      when 'cajeros' then 'Empleado'
      when 'mermas' then 'Merma'
      else tg_table_name end;
    v_verbo := case tg_op when 'INSERT' then 'creado' when 'UPDATE' then 'modificado' else 'eliminado' end;
    if tg_table_name = 'turnos_caja' then
      v_verbo := case tg_op when 'INSERT' then 'abierto' when 'UPDATE' then 'modificado' else 'eliminado' end;
      v_nombre := coalesce(v_fila->>'id', '');
    end if;

    select string_agg(k || ': ' || coalesce(c->>'antes', '-') || ' → ' || coalesce(c->>'despues', '-'), ' | ')
      into v_detalle
      from jsonb_each(v_cambios) as e(k, c);

    select array_agg(distinct ca.nombre)
      into v_abiertos
      from turnos_caja t
      join cajeros ca on ca.id::text = t.cajero_id::text
      where t.bodega_id::text = v_bodega::text and t.fecha_cierre is null;

    insert into auditoria (bodega_id, tabla, operacion, registro_id, resumen, cambios, turnos_abiertos, autor_auth)
    values (
      v_bodega, tg_table_name, tg_op, v_fila->>'id',
      v_etiqueta || ' ' || v_verbo || case when v_nombre <> '' then ': ' || v_nombre else '' end
        || case when v_detalle is not null then ' (' || v_detalle || ')' else '' end,
      nullif(v_cambios, '{}'::jsonb), v_abiertos, auth.uid()
    );
  exception when others then
    null; -- nunca bloquear la operación real por un fallo de auditoría
  end;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.registrar_auditoria() from public, anon, authenticated;

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
drop trigger if exists auditoria_productos_upd on public.productos;
create trigger auditoria_productos_upd after update on public.productos
  for each row execute function public.registrar_auditoria('precio_venta', 'precio_costo', 'activo');
drop trigger if exists auditoria_productos_del on public.productos;
create trigger auditoria_productos_del after delete on public.productos
  for each row execute function public.registrar_auditoria();

drop trigger if exists auditoria_ventas_upd on public.ventas;
create trigger auditoria_ventas_upd after update on public.ventas
  for each row execute function public.registrar_auditoria('anulada', 'motivo_anulacion', 'total_venta', 'medio_pago');
drop trigger if exists auditoria_ventas_del on public.ventas;
create trigger auditoria_ventas_del after delete on public.ventas
  for each row execute function public.registrar_auditoria();

drop trigger if exists auditoria_turnos_ins on public.turnos_caja;
create trigger auditoria_turnos_ins after insert on public.turnos_caja
  for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_turnos_upd on public.turnos_caja;
create trigger auditoria_turnos_upd after update on public.turnos_caja
  for each row execute function public.registrar_auditoria('estado', 'monto_inicial', 'monto_final_real', 'diferencia');

drop trigger if exists auditoria_cajeros_ins on public.cajeros;
create trigger auditoria_cajeros_ins after insert on public.cajeros
  for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_cajeros_upd on public.cajeros;
create trigger auditoria_cajeros_upd after update on public.cajeros
  for each row execute function public.registrar_auditoria('rol', 'activo', 'nombre', 'pin_seguridad');
drop trigger if exists auditoria_cajeros_del on public.cajeros;
create trigger auditoria_cajeros_del after delete on public.cajeros
  for each row execute function public.registrar_auditoria();

drop trigger if exists auditoria_mermas_ins on public.mermas;
create trigger auditoria_mermas_ins after insert on public.mermas
  for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_mermas_del on public.mermas;
create trigger auditoria_mermas_del after delete on public.mermas
  for each row execute function public.registrar_auditoria();

-- Verificación: debería listar 12 triggers "auditoria_*".
select event_object_table as tabla, trigger_name, event_manipulation as evento
from information_schema.triggers
where trigger_schema = 'public' and trigger_name like 'auditoria\_%' escape '\'
order by event_object_table, trigger_name;

NOTIFY pgrst, 'reload schema';
