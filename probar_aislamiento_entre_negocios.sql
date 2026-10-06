-- ============================================================
-- Kaserita: prueba de aislamiento entre negocios (multi-tenant).
-- NO modifica datos: todo corre dentro de una transacción que termina en
-- ROLLBACK. Ejecutar en el SQL Editor de Supabase.
--
-- Por qué hace falta: las pruebas hechas desde la web usan la cuenta de
-- superadmin (que puede ver y editar todo), así que no demuestran nada sobre un
-- dueño normal. Esta prueba se hace "como" el dueño de un negocio A (mismo rol
-- y mismo JWT que usa la app) e intenta tocar datos del negocio B.
--
-- ANTES DE CORRERLA necesitas DOS negocios reales de prueba (no la demo):
--   1) créalos desde el panel de superadmin (Nueva bodega), con dos correos
--      distintos, y haz que cada dueño entre una vez con Google;
--   2) busca el auth_id de cada dueño:
--        select u.auth_id, u.bodega_id, b.nombre
--        from usuarios u join bodegas b on b.id = u.bodega_id
--        where u.rol = 'dueno';
--   3) reemplaza abajo AUTH_A (dueño del negocio A) y BODEGA_B (id del negocio B).
--
-- Cómo leer el resultado: cada fila dice PASA (bien) o FALLA (hay un hueco).
-- ============================================================

begin;

-- Pasar a actuar como el dueño A, igual que la app.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'AUTH_A', 'role', 'authenticated')::text, true);

create temp table resultado_aislamiento (prueba text, resultado text) on commit drop;
grant all on resultado_aislamiento to authenticated;

-- 1) No debe ver filas del negocio B.
insert into resultado_aislamiento
select 'A no ve productos de B',
       case when (select count(*) from productos where bodega_id = 'BODEGA_B') = 0 then 'PASA' else 'FALLA' end;
insert into resultado_aislamiento
select 'A no ve ventas de B',
       case when (select count(*) from ventas where bodega_id = 'BODEGA_B') = 0 then 'PASA' else 'FALLA' end;
insert into resultado_aislamiento
select 'A no ve clientes de B',
       case when (select count(*) from clientes where bodega_id = 'BODEGA_B') = 0 then 'PASA' else 'FALLA' end;
insert into resultado_aislamiento
select 'A no ve la bodega B',
       case when (select count(*) from bodegas where id = 'BODEGA_B') = 0 then 'PASA' else 'FALLA' end;
insert into resultado_aislamiento
select 'A no ve usuarios de B',
       case when (select count(*) from usuarios where bodega_id = 'BODEGA_B') = 0 then 'PASA' else 'FALLA' end;

-- 2) No debe poder modificar ni borrar filas de B (0 filas afectadas).
do $$
declare n int;
begin
  update productos set precio_venta = precio_venta where bodega_id = 'BODEGA_B';
  get diagnostics n = row_count;
  insert into resultado_aislamiento values ('A no puede editar productos de B', case when n = 0 then 'PASA' else 'FALLA' end);

  delete from ventas where bodega_id = 'BODEGA_B';
  get diagnostics n = row_count;
  insert into resultado_aislamiento values ('A no puede borrar ventas de B', case when n = 0 then 'PASA' else 'FALLA' end);
end $$;

-- 3) No debe poder escribir con el bodega_id de B.
do $$
begin
  begin
    insert into productos (bodega_id, descripcion, precio_venta) values ('BODEGA_B', 'prueba', 1);
    insert into resultado_aislamiento values ('A no puede crear productos en B', 'FALLA');
  exception when others then
    insert into resultado_aislamiento values ('A no puede crear productos en B', 'PASA');
  end;
end $$;

-- 4) No debe poder extender su propia suscripción ni activar módulos.
do $$
declare n int;
begin
  update bodegas set activa_hasta = current_date + 365 where id = (select bodega_id from usuarios where auth_id = 'AUTH_A');
  get diagnostics n = row_count;
  insert into resultado_aislamiento values ('A no puede cambiar su activa_hasta', case when n = 0 then 'PASA' else 'FALLA' end);

  update bodegas set delivery_permitido = true, permitir_subir_fotos = true
   where id = (select bodega_id from usuarios where auth_id = 'AUTH_A');
  get diagnostics n = row_count;
  insert into resultado_aislamiento values ('A no puede activarse delivery/fotos', case when n = 0 then 'PASA' else 'FALLA' end);
end $$;

-- 5) No debe poder ascender su rol ni agregarse como superadmin.
do $$
declare n int;
begin
  update usuarios set rol = 'administrador' where auth_id = 'AUTH_A';
  get diagnostics n = row_count;
  insert into resultado_aislamiento values ('A no puede cambiar su rol en usuarios', case when n = 0 then 'PASA' else 'FALLA' end);
  begin
    insert into super_admins (auth_id) values ('AUTH_A');
    insert into resultado_aislamiento values ('A no puede hacerse superadmin', 'FALLA');
  exception when others then
    insert into resultado_aislamiento values ('A no puede hacerse superadmin', 'PASA');
  end;
end $$;

select * from resultado_aislamiento order by resultado desc, prueba;

rollback;
