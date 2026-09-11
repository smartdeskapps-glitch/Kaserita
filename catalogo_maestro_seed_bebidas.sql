-- ============================================================
-- Kaserita: refuerzo del catálogo maestro centrado en Gaseosas,
-- Cervezas y Licores/Vinos -- las categorías que más SKUs distintos
-- manejan en cualquier bodega (misma marca, muchas presentaciones).
-- Abarrotes se deja tal cual quedó en catalogo_maestro_seed.sql (ahí ya
-- están los básicos indispensables).
--
-- "Vinos" es una categoría nueva -- ya se agregó como alias del ícono
-- de "Licores" (botella de vino) en el código, así que se ve bien sin
-- tener que definirla aparte.
--
-- Seguro de correr más de una vez -- si ya existe una fila con la misma
-- descripción, no la duplica. También es seguro correrlo sin haber
-- corrido antes catalogo_maestro_seed.sql.
--
-- Ejecutar en el SQL Editor de Supabase. Requiere haber corrido antes
-- catalogo_maestro.sql y catalogo_maestro_sku.sql.
-- ============================================================

insert into public.catalogo_maestro (descripcion, categoria)
select v.descripcion, v.categoria
from (values
  -- ===== GASEOSAS =====
  ('Inca Kola 500ml', 'Gaseosas'),
  ('Inca Kola 1L', 'Gaseosas'),
  ('Inca Kola 1.5L', 'Gaseosas'),
  ('Inca Kola 2L', 'Gaseosas'),
  ('Inca Kola 3L', 'Gaseosas'),
  ('Inca Kola Zero 500ml', 'Gaseosas'),
  ('Inca Kola Zero 1.5L', 'Gaseosas'),
  ('Coca Cola 500ml', 'Gaseosas'),
  ('Coca Cola 1L', 'Gaseosas'),
  ('Coca Cola 1.5L', 'Gaseosas'),
  ('Coca Cola 2L', 'Gaseosas'),
  ('Coca Cola 3L', 'Gaseosas'),
  ('Coca Cola Zero 500ml', 'Gaseosas'),
  ('Coca Cola Zero 1.5L', 'Gaseosas'),
  ('Coca Cola Light 500ml', 'Gaseosas'),
  ('Sprite 500ml', 'Gaseosas'),
  ('Sprite 1.5L', 'Gaseosas'),
  ('Sprite 3L', 'Gaseosas'),
  ('Fanta Naranja 500ml', 'Gaseosas'),
  ('Fanta Naranja 1.5L', 'Gaseosas'),
  ('Fanta Piña 500ml', 'Gaseosas'),
  ('Fanta Piña 1.5L', 'Gaseosas'),
  ('Guaraná Backus 500ml', 'Gaseosas'),
  ('Guaraná Backus 1.5L', 'Gaseosas'),
  ('Kola Real 500ml', 'Gaseosas'),
  ('Kola Real 1.5L', 'Gaseosas'),
  ('Kola Real 3L', 'Gaseosas'),
  ('Kola Inglesa 500ml', 'Gaseosas'),
  ('Kola Inglesa 1.5L', 'Gaseosas'),
  ('Concordia Naranja 500ml', 'Gaseosas'),
  ('Concordia Naranja 1.5L', 'Gaseosas'),
  ('Triple Kola 500ml', 'Gaseosas'),
  ('Triple Kola 1.5L', 'Gaseosas'),
  ('Crush Naranja 500ml', 'Gaseosas'),
  ('Crush Naranja 1.5L', 'Gaseosas'),
  ('Viva Manzanita 500ml', 'Gaseosas'),
  ('Viva Manzanita 1.5L', 'Gaseosas'),
  ('7Up 500ml', 'Gaseosas'),
  ('7Up 1.5L', 'Gaseosas'),
  ('Canada Dry Ginger Ale 500ml', 'Gaseosas'),

  -- ===== CERVEZAS =====
  ('Cerveza Cristal Lata 355ml', 'Cervezas'),
  ('Cerveza Cristal Botella 620ml', 'Cervezas'),
  ('Cerveza Cristal Personal 305ml', 'Cervezas'),
  ('Cerveza Cristal Six Pack Lata 355ml x6', 'Cervezas'),
  ('Cerveza Pilsen Callao Lata 355ml', 'Cervezas'),
  ('Cerveza Pilsen Callao Botella 620ml', 'Cervezas'),
  ('Cerveza Pilsen Callao Personal 305ml', 'Cervezas'),
  ('Cerveza Pilsen Callao Six Pack Lata 355ml x6', 'Cervezas'),
  ('Cerveza Cusqueña Dorada Lata 355ml', 'Cervezas'),
  ('Cerveza Cusqueña Dorada Botella 620ml', 'Cervezas'),
  ('Cerveza Cusqueña Dorada Personal 330ml', 'Cervezas'),
  ('Cerveza Cusqueña Negra Personal 330ml', 'Cervezas'),
  ('Cerveza Cusqueña Negra Botella 620ml', 'Cervezas'),
  ('Cerveza Cusqueña Trigo Personal 330ml', 'Cervezas'),
  ('Cerveza Cusqueña Red Lager Personal 330ml', 'Cervezas'),
  ('Cerveza Barena Botella 620ml', 'Cervezas'),
  ('Cerveza Barena Lata 355ml', 'Cervezas'),
  ('Cerveza Corona Botella 355ml', 'Cervezas'),
  ('Cerveza Stella Artois Botella 330ml', 'Cervezas'),
  ('Cerveza Heineken Botella 330ml', 'Cervezas'),
  ('Cerveza Heineken Lata 350ml', 'Cervezas'),
  ('Cerveza Budweiser Lata 355ml', 'Cervezas'),
  ('Cerveza Miller Genuine Draft Botella 330ml', 'Cervezas'),

  -- ===== LICORES =====
  ('Ron Cartavio Añejo 750ml', 'Licores'),
  ('Ron Cartavio Superior 750ml', 'Licores'),
  ('Ron Cartavio Black 750ml', 'Licores'),
  ('Ron Flor de Caña 750ml', 'Licores'),
  ('Ron Pomalca 750ml', 'Licores'),
  ('Pisco Queirolo Quebranta 750ml', 'Licores'),
  ('Pisco Queirolo Acholado 750ml', 'Licores'),
  ('Pisco Ocucaje Puro 750ml', 'Licores'),
  ('Pisco Barsol Quebranta 750ml', 'Licores'),
  ('Pisco Cuatro Gallos Quebranta 750ml', 'Licores'),
  ('Pisco Portón Mosto Verde 750ml', 'Licores'),
  ('Whisky Johnnie Walker Red Label 750ml', 'Licores'),
  ('Whisky Johnnie Walker Black Label 750ml', 'Licores'),
  ('Whisky Old Parr 750ml', 'Licores'),
  ('Whisky Chivas Regal 12 Años 750ml', 'Licores'),
  ('Whisky Ballantine''s Finest 750ml', 'Licores'),
  ('Vodka Ruso Estándar 750ml', 'Licores'),
  ('Vodka Absolut 750ml', 'Licores'),
  ('Vodka Smirnoff 750ml', 'Licores'),
  ('Tequila Jose Cuervo Especial 750ml', 'Licores'),
  ('Anisado Nájar 750ml', 'Licores'),
  ('Cañazo 750ml', 'Licores'),

  -- ===== VINOS =====
  ('Vino Tabernero Tinto 750ml', 'Vinos'),
  ('Vino Tabernero Blanco 750ml', 'Vinos'),
  ('Vino Santiago Queirolo Borgoña 750ml', 'Vinos'),
  ('Vino Santiago Queirolo Rosé 750ml', 'Vinos'),
  ('Vino Santiago Queirolo Blanco 750ml', 'Vinos'),
  ('Vino Gran Tinto Santiago Queirolo 750ml', 'Vinos'),
  ('Vino Casillero del Diablo Cabernet Sauvignon 750ml', 'Vinos'),
  ('Vino Concha y Toro Frontera Tinto 750ml', 'Vinos'),
  ('Vino Navarro Correa Borgoña 750ml', 'Vinos'),
  ('Vino San Juan Borgoña 750ml', 'Vinos'),
  ('Espumante Santiago Queirolo Brut 750ml', 'Vinos'),
  ('Espumante Tabernero Brut 750ml', 'Vinos')
) as v(descripcion, categoria)
where not exists (
  select 1 from public.catalogo_maestro cm where cm.descripcion = v.descripcion
);

-- Verificación: cuántos productos quedaron en total.
select count(*) as total_productos_maestro from public.catalogo_maestro;

NOTIFY pgrst, 'reload schema';
