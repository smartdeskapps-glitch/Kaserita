-- ============================================================
-- Kaserita: defensa en profundidad -- quitar al rol "anon" los permisos de
-- tabla que no necesita. OPCIONAL, pero recomendado antes de tener clientes.
--
-- Situación hoy: Supabase le da a "anon" permisos amplios (SELECT/INSERT/
-- UPDATE/DELETE) en casi todas las tablas. Hoy eso NO es un hueco porque las
-- políticas RLS (bodega_id = mi_bodega_id(), que es NULL sin sesión) dejan a
-- anon con 0 filas -- lo comprobé desde fuera: sin sesión no se lee ni se
-- modifica ninguna fila. Pero toda la protección depende de UNA sola capa: si
-- mañana alguien crea una política abierta por error, la tabla se expone.
-- Quitar el permiso de tabla agrega una segunda capa.
--
-- Qué NO se toca (anon sí lo usa): analitica_eventos (INSERT), libro_reclamaciones
-- (INSERT), pedidos_delivery (INSERT), planes_kaserita / categorias /
-- catalogo_maestro (SELECT). Las funciones SECURITY DEFINER de Delivery
-- (obtener_*) no dependen de estos permisos.
--
-- Para deshacer una tabla:  grant select, insert, update, delete on public.<tabla> to anon;
-- Probar después: abrir /registro, /reclamos, un catálogo de Delivery (anónimo)
-- y el POS con sesión.
-- ============================================================

revoke all on public.usuarios                 from anon;
revoke all on public.bodegas                  from anon;
revoke all on public.cajeros                  from anon;
revoke all on public.productos                from anon;
revoke all on public.ventas                   from anon;
revoke all on public.ventas_detalle           from anon;
revoke all on public.clientes                 from anon;
revoke all on public.turnos_caja              from anon;
revoke all on public.proveedores              from anon;
revoke all on public.pagos_credito            from anon;
revoke all on public.pagos_proveedor          from anon;
revoke all on public.compras                  from anon;
revoke all on public.compras_detalle          from anon;
revoke all on public.mermas                   from anon;
revoke all on public.tomas_inventario         from anon;
revoke all on public.tomas_inventario_borrador from anon;
revoke all on public.combos                   from anon;
revoke all on public.combos_items             from anon;
revoke all on public.correlativos_bodega      from anon;
revoke all on public.intentos_pin_cajero      from anon;
revoke all on public.intentos_reclamo_pin     from anon;
revoke all on public.reseteos_pin             from anon;
revoke all on public.super_admins             from anon;
revoke all on public.auditoria                from anon;
revoke all on public.pagos_bodega             from anon;
revoke all on public.pagos_registro           from anon;
revoke all on public.bodegas_eliminadas       from anon;

-- Solo lo que anon necesita en las tablas públicas: escribir y nada más.
revoke select, update, delete on public.analitica_eventos   from anon;
revoke select, update, delete on public.libro_reclamaciones from anon;
revoke select, update, delete on public.pedidos_delivery    from anon;

-- Verificación: debe quedar vacío (anon sin permisos en tablas de negocios).
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as permisos_anon
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
group by table_name
order by table_name;
