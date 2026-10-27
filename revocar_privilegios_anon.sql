-- ============================================================
-- Kaserita: defensa en profundidad -- quitar al rol "anon" (visitante sin
-- sesion) los permisos de tabla que no necesita. APLICADO en produccion.
--
-- Situacion antes: Supabase le daba a "anon" permisos amplios (SELECT/INSERT/
-- UPDATE/DELETE) en casi todas las tablas. No era un hueco, porque las
-- politicas RLS (bodega_id = mi_bodega_id(), que es NULL sin sesion) dejaban a
-- anon con 0 filas. Pero toda la proteccion dependia de UNA sola capa: si
-- manana alguien crea una politica abierta por error, la tabla se expone.
-- Quitar el permiso de tabla agrega una segunda llave.
--
-- Que NO se toca (anon lo usa a proposito):
--   * Tienda Delivery (repo Kaserita_Delivery): pedidos_delivery,
--     clientes_delivery, bodegas_visitadas, pedidos_seguimiento, avisos_tienda.
--   * Formularios publicos: analitica_eventos y errores_app (solo INSERT),
--     libro_reclamaciones (solo INSERT).
--   * Lectura publica: planes_kaserita, categorias, catalogo_maestro.
-- Las funciones SECURITY DEFINER (mi_bodega_id, es_superadmin, obtener_*,
-- puede_reclamar_bodega...) corren con permisos del dueno y no dependen de esto.
--
-- Para deshacerlo: revocar_privilegios_anon_REVERSA.sql
-- Probar despues: /registro, /reclamos, un catalogo de Delivery (sin sesion) y
-- el POS con sesion.
-- ============================================================

-- Tablas del negocio: anon no necesita nada.
revoke all on public.usuarios                  from anon;
revoke all on public.bodegas                   from anon;
revoke all on public.cajeros                   from anon;
revoke all on public.productos                 from anon;
revoke all on public.ventas                    from anon;
revoke all on public.ventas_detalle            from anon;
revoke all on public.clientes                  from anon;
revoke all on public.turnos_caja               from anon;
revoke all on public.proveedores               from anon;
revoke all on public.pagos_credito             from anon;
revoke all on public.pagos_proveedor           from anon;
revoke all on public.compras                   from anon;
revoke all on public.compras_detalle           from anon;
revoke all on public.mermas                    from anon;
revoke all on public.tomas_inventario          from anon;
revoke all on public.tomas_inventario_borrador from anon;
revoke all on public.combos                    from anon;
revoke all on public.combos_items              from anon;
revoke all on public.correlativos_bodega       from anon;
revoke all on public.intentos_pin_cajero       from anon;
revoke all on public.intentos_reclamo_pin      from anon;
revoke all on public.reseteos_pin              from anon;
revoke all on public.super_admins              from anon;
revoke all on public.auditoria                 from anon;
revoke all on public.pagos_bodega              from anon;
revoke all on public.pagos_registro            from anon;
revoke all on public.bodegas_eliminadas        from anon;

-- Lectura publica: se queda SELECT, se quita escribir.
revoke insert, update, delete, truncate on public.planes_kaserita  from anon;
revoke insert, update, delete, truncate on public.categorias       from anon;
revoke insert, update, delete, truncate on public.catalogo_maestro from anon;

-- Formulario publico: solo se necesita INSERT.
revoke select, update, delete, truncate on public.libro_reclamaciones from anon;

-- Vistas de la tienda Delivery: solo lectura.
revoke insert, update, delete, truncate on public.bodegas_delivery   from anon;
revoke insert, update, delete, truncate on public.productos_delivery from anon;
revoke insert, update, delete, truncate on public.combos_delivery    from anon;

-- Verificacion: lo que le queda a anon.
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as permisos_anon
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
group by table_name
order by table_name;
