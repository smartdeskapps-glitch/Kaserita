-- ============================================================
-- Kaserita: interruptor por bodega para subir fotos de producto en alta calidad.
-- (Ya aplicado en Supabase el 2026-11-17.) Es aditivo: la columna nace en false,
-- así que todas las bodegas siguen con las fotos livianas de siempre (480 px, 20 KB)
-- hasta que el super-admin active "HD" en el panel de administrador.
--
-- Solo el super-admin puede escribir en "bodegas" (ver cerrar_auto_edicion_bodegas.sql),
-- así que una bodega no puede activárselo sola.
--
-- REVERSA: alter table public.bodegas drop column if exists fotos_alta_calidad;
-- ============================================================

alter table public.bodegas
  add column if not exists fotos_alta_calidad boolean not null default false;

NOTIFY pgrst, 'reload schema';
