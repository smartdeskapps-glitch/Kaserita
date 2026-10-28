-- ============================================================
-- Kaserita: defensa en profundidad (parte 2) -- quitar el permiso de EJECUTAR
-- por la API (/rest/v1/rpc/...) a funciones que nadie debe llamar desde afuera.
--
-- Por que: en Postgres toda funcion nueva nace ejecutable por PUBLIC, y por
-- eso Supabase la expone a "anon" (visitante sin sesion) y "authenticated".
-- Las funciones SECURITY DEFINER corren con permisos del dueno de la base, asi
-- que si una se puede llamar desde afuera, el visitante la usa con esos poderes.
--
-- Que se hace:
--   1) Disparadores (triggers) y la tarea de cierre automatico: la base los
--      ejecuta sola. El permiso EXECUTE solo se comprueba al CREAR el
--      disparador, no al dispararse, asi que se puede quitar a todos.
--   2) Funciones que solo usa una sesion iniciada: se quitan a PUBLIC y anon y
--      se dejan explicitas para "authenticated".
--
-- Que NO se toca (anon o las politicas RLS lo necesitan):
--   puede_reclamar_bodega y reclamar_cuenta_bodega (login, antes de tener sesion),
--   bodega_admite_pedido_delivery, stock_reservado_delivery, mi_bodega_id,
--   es_superadmin, mi_cliente_delivery_id, mi_bodega_permite_fotos y las
--   obtener_*_delivery / obtener_*_barberia de la tienda.
--
-- Para deshacerlo: revocar_ejecucion_funciones_REVERSA.sql
-- ============================================================

-- 1) Disparadores y tarea automatica: nadie por la API.
revoke execute on function public.bloquear_cambio_slug_bodega()      from public, anon, authenticated;
revoke execute on function public.bodega_asignar_serie_boleta()      from public, anon, authenticated;
revoke execute on function public.bodega_avisar_novedad()            from public, anon, authenticated;
revoke execute on function public.combos_sincronizar_stock()         from public, anon, authenticated;
revoke execute on function public.errores_app_poner_bodega()         from public, anon, authenticated;
revoke execute on function public.validar_entrega_pedido_delivery()  from public, anon, authenticated;
revoke execute on function public.validar_productos_activos_pedido() from public, anon, authenticated;
revoke execute on function public.cerrar_cajas_automatico()          from public, anon, authenticated;

-- 2) Solo con sesion iniciada.
revoke execute on function public.marcar_pedido_en_camino(uuid)               from public, anon;
revoke execute on function public.mi_pago_pendiente()                         from public, anon;
revoke execute on function public.resumen_avisos_clientes()                   from public, anon;
revoke execute on function public.siguiente_correlativo(text)                 from public, anon;
revoke execute on function public.tengo_bodega()                              from public, anon;
revoke execute on function public.ajustar_stock_inicializando(uuid, numeric)  from public, anon;

grant execute on function public.marcar_pedido_en_camino(uuid)               to authenticated;
grant execute on function public.mi_pago_pendiente()                         to authenticated;
grant execute on function public.resumen_avisos_clientes()                   to authenticated;
grant execute on function public.siguiente_correlativo(text)                 to authenticated;
grant execute on function public.tengo_bodega()                              to authenticated;
grant execute on function public.ajustar_stock_inicializando(uuid, numeric)  to authenticated;

-- Verificacion: que funciones de "public" puede ejecutar todavia anon (sin las
-- de la extension btree_gist, que no son nuestras).
select p.proname, pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and p.proname !~ '^(gbt|gbtreekey)'
  and p.proname !~ '_dist$'
order by p.proname;
