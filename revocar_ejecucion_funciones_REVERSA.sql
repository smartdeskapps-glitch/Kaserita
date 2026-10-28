-- Deshace revocar_ejecucion_funciones.sql: devuelve el permiso de ejecutar a
-- PUBLIC, anon y authenticated, como estaba antes (2026-10-27).
-- Usar solo si algo deja de funcionar despues del cambio.

grant execute on function public.bloquear_cambio_slug_bodega()      to public, anon, authenticated;
grant execute on function public.bodega_asignar_serie_boleta()      to public, anon, authenticated;
grant execute on function public.bodega_avisar_novedad()            to public, anon, authenticated;
grant execute on function public.combos_sincronizar_stock()         to public, anon, authenticated;
grant execute on function public.errores_app_poner_bodega()         to public, anon, authenticated;
grant execute on function public.validar_entrega_pedido_delivery()  to public, anon, authenticated;
grant execute on function public.validar_productos_activos_pedido() to public, anon, authenticated;
grant execute on function public.cerrar_cajas_automatico()          to public, anon, authenticated;

grant execute on function public.marcar_pedido_en_camino(uuid)               to public, anon, authenticated;
grant execute on function public.mi_pago_pendiente()                         to public, anon, authenticated;
grant execute on function public.resumen_avisos_clientes()                   to public, anon, authenticated;
grant execute on function public.siguiente_correlativo(text)                 to public, anon, authenticated;
grant execute on function public.tengo_bodega()                              to public, anon, authenticated;
grant execute on function public.ajustar_stock_inicializando(uuid, numeric)  to public, anon, authenticated;
