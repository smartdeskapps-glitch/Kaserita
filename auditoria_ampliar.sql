-- ============================================================
-- Kaserita: amplía el registro de actividad (hallazgo menor del informe).
-- Ejecutar a mano en el SQL Editor de Supabase. Idempotente.
--
-- Cambios respecto a auditoria_acciones_sensibles.sql:
--   1) Si un trigger de auditoría falla, ya no se traga el error: queda un
--      WARNING en los logs de Postgres (Supabase > Logs > Postgres). La
--      operación del negocio sigue adelante igual.
--   2) Se auditan también: pagos de deuda de clientes (alta y borrado),
--      cambios de límite de crédito y bajas de clientes, pagos a proveedores,
--      borrado de compras y altas, bajas o cambios de rol de cuentas de acceso.
-- ============================================================

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

    v_nombre := coalesce(v_fila->>'descripcion', v_fila->>'nombre', v_fila->>'nombre_completo', v_fila->>'nro_boleta', v_fila->>'id');
    v_etiqueta := case tg_table_name
      when 'productos' then 'Producto'
      when 'ventas' then 'Venta'
      when 'turnos_caja' then 'Turno de caja'
      when 'cajeros' then 'Empleado'
      when 'mermas' then 'Merma'
      when 'pagos_credito' then 'Pago de deuda de cliente'
      when 'pagos_proveedor' then 'Pago a proveedor'
      when 'clientes' then 'Cliente'
      when 'usuarios' then 'Cuenta de acceso'
      when 'compras' then 'Compra'
      else tg_table_name end;
    v_verbo := case tg_op when 'INSERT' then 'creado' when 'UPDATE' then 'modificado' else 'eliminado' end;
    if tg_table_name in ('pagos_credito', 'pagos_proveedor') then
      v_nombre := 'S/ ' || coalesce(v_fila->>'monto_pagado', v_fila->>'monto', '?');
    end if;
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
    -- Nunca se bloquea la operación real por un fallo de auditoría, pero el
    -- fallo ya no es silencioso: queda en los logs de Postgres de Supabase.
    raise warning 'auditoria fallo en % (%): %', tg_table_name, tg_op, sqlerrm;
  end;
  return coalesce(new, old);
end;
$$;


revoke execute on function public.registrar_auditoria() from public, anon, authenticated;

drop trigger if exists auditoria_pagos_credito_ins on public.pagos_credito;
create trigger auditoria_pagos_credito_ins after insert on public.pagos_credito
  for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_pagos_credito_del on public.pagos_credito;
create trigger auditoria_pagos_credito_del after delete on public.pagos_credito
  for each row execute function public.registrar_auditoria();

drop trigger if exists auditoria_clientes_upd on public.clientes;
create trigger auditoria_clientes_upd after update on public.clientes
  for each row execute function public.registrar_auditoria('limite_credito');
drop trigger if exists auditoria_clientes_del on public.clientes;
create trigger auditoria_clientes_del after delete on public.clientes
  for each row execute function public.registrar_auditoria();

drop trigger if exists auditoria_pagos_proveedor_ins on public.pagos_proveedor;
create trigger auditoria_pagos_proveedor_ins after insert on public.pagos_proveedor
  for each row execute function public.registrar_auditoria();

drop trigger if exists auditoria_compras_del on public.compras;
create trigger auditoria_compras_del after delete on public.compras
  for each row execute function public.registrar_auditoria();

drop trigger if exists auditoria_usuarios_ins on public.usuarios;
create trigger auditoria_usuarios_ins after insert on public.usuarios
  for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_usuarios_upd on public.usuarios;
create trigger auditoria_usuarios_upd after update on public.usuarios
  for each row execute function public.registrar_auditoria('rol', 'activo');
drop trigger if exists auditoria_usuarios_del on public.usuarios;
create trigger auditoria_usuarios_del after delete on public.usuarios
  for each row execute function public.registrar_auditoria();

-- Verificación: debe listar los triggers nuevos además de los 12 anteriores.
select event_object_table as tabla, trigger_name, event_manipulation as evento
from information_schema.triggers
where trigger_schema = 'public' and trigger_name like 'auditoria\_%' escape '\'
order by event_object_table, trigger_name;

NOTIFY pgrst, 'reload schema';
