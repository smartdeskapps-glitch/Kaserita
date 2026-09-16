-- Kaserita: fotos adicionales y descripción larga por producto.
-- Pensado para negocios que necesitan mostrar más que una sola foto en
-- Kaserita Delivery (ej. ropa: varios ángulos + detalle de tela/talla).
-- Ejecutar a mano en el SQL Editor de Supabase.
--
-- Ambas columnas nacen vacías/null para todo producto existente -- no
-- cambia nada para una bodega que no las use. No hace falta tocar RLS:
-- las políticas de productos ya cubren cualquier columna nueva vía
-- bodega_id = mi_bodega_id() (ver rls_estado_actual.sql).

alter table productos
  add column if not exists fotos_extra text[],
  add column if not exists descripcion_larga text;
