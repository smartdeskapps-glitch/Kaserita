-- ============================================================
-- Kaserita: siembra el catálogo maestro con ~85 productos típicos de
-- una bodega peruana, agrupados en las mismas categorías que ya usa la
-- app (así el ícono/color de cada uno sale bien solo, sin foto).
--
-- Ninguno trae foto todavía -- se ve el ícono de su categoría hasta que
-- le subas una desde el panel (Catálogo Maestro > editar). No hace
-- falta subir foto a todos: solo a los que más vendas vale la pena.
--
-- Seguro de correr más de una vez -- si ya existe una fila con la misma
-- descripción, no la duplica.
--
-- Ejecutar en el SQL Editor de Supabase. Requiere haber corrido antes
-- catalogo_maestro.sql y catalogo_maestro_sku.sql.
-- ============================================================

insert into public.catalogo_maestro (descripcion, categoria)
select v.descripcion, v.categoria
from (values
  -- Abarrotes
  ('Arroz Extra Costeño 750g', 'Abarrotes'),
  ('Arroz Superior Paisana 750g', 'Abarrotes'),
  ('Azúcar Rubia Cartavio 1kg', 'Abarrotes'),
  ('Aceite Vegetal Primor 1L', 'Abarrotes'),
  ('Aceite Vegetal Cocinero 900ml', 'Abarrotes'),
  ('Fideos Spaghetti Don Vittorio 500g', 'Abarrotes'),
  ('Atún Florida en Aceite 170g', 'Abarrotes'),
  ('Sal de Mesa Emsal 1kg', 'Abarrotes'),
  ('Harina Sin Preparar Blanca Flor 1kg', 'Abarrotes'),
  ('Avena Quaker Tradicional 170g', 'Abarrotes'),
  ('Café Instantáneo Altomayo 100g', 'Abarrotes'),
  ('Menestra Frijol Canario 500g', 'Abarrotes'),
  ('Menestra Lenteja 500g', 'Abarrotes'),
  ('Salsa de Tomate Alacena 200g', 'Abarrotes'),
  ('Mayonesa Alacena 200g', 'Abarrotes'),

  -- Lácteos
  ('Leche Gloria Entera 400g', 'Lácteos'),
  ('Leche Evaporada Ideal 400g', 'Lácteos'),
  ('Yogurt Gloria Fresa 1L', 'Lácteos'),
  ('Mantequilla Gloria con Sal 200g', 'Lácteos'),
  ('Queso Fresco Laive 500g', 'Lácteos'),
  ('Manjar Blanco Nestlé 320g', 'Lácteos'),

  -- Panadería
  ('Pan Francés (unidad)', 'Panadería'),
  ('Pan de Molde Bimbo Blanco', 'Panadería'),
  ('Pan Integral Bimbo', 'Panadería'),
  ('Keke Inglés Bimbo', 'Panadería'),

  -- Carnes y Embutidos
  ('Pollo Fresco Entero (por KG)', 'Carnes y Embutidos'),
  ('Carne de Res Molida (por KG)', 'Carnes y Embutidos'),
  ('Jamonada San Fernando 200g', 'Carnes y Embutidos'),
  ('Hot Dog San Fernando 225g', 'Carnes y Embutidos'),
  ('Jamón Inglés San Fernando 200g', 'Carnes y Embutidos'),

  -- Verduras y Frutas
  ('Papa Amarilla (por KG)', 'Verduras y Frutas'),
  ('Cebolla Roja (por KG)', 'Verduras y Frutas'),
  ('Tomate (por KG)', 'Verduras y Frutas'),
  ('Limón (por KG)', 'Verduras y Frutas'),
  ('Plátano de Seda (por KG)', 'Verduras y Frutas'),
  ('Palta Fuerte (por KG)', 'Verduras y Frutas'),

  -- Huevos y Frescos
  ('Huevos Pardos (Docena)', 'Huevos y Frescos'),
  ('Huevos Pardos Panal x30', 'Huevos y Frescos'),

  -- Gaseosas
  ('Inca Kola 500ml', 'Gaseosas'),
  ('Inca Kola 1.5L', 'Gaseosas'),
  ('Coca Cola 500ml', 'Gaseosas'),
  ('Coca Cola 1.5L', 'Gaseosas'),
  ('Sprite 500ml', 'Gaseosas'),
  ('Guaraná Backus 500ml', 'Gaseosas'),
  ('Kola Real 1.5L', 'Gaseosas'),

  -- Jugos y Néctares
  ('Frugos Naranja 300ml', 'Jugos y Néctares'),
  ('Frugos Durazno 300ml', 'Jugos y Néctares'),
  ('Pulp Naranja 1L', 'Jugos y Néctares'),
  ('Cifrut Naranja 300ml', 'Jugos y Néctares'),

  -- Aguas
  ('Agua San Luis 625ml', 'Aguas'),
  ('Agua Cielo 625ml', 'Aguas'),
  ('Agua San Mateo con Gas 500ml', 'Aguas'),

  -- Energizantes e Isotónicas
  ('Volt Energy 500ml', 'Energizantes e Isotónicas'),
  ('Gatorade 500ml', 'Energizantes e Isotónicas'),
  ('Red Bull 250ml', 'Energizantes e Isotónicas'),

  -- Cervezas
  ('Cerveza Cristal 620ml', 'Cervezas'),
  ('Cerveza Pilsen Callao 620ml', 'Cervezas'),
  ('Cerveza Cusqueña Dorada 620ml', 'Cervezas'),
  ('Cerveza Cusqueña Negra 620ml', 'Cervezas'),
  ('Cerveza Corona 355ml', 'Cervezas'),

  -- Licores
  ('Ron Cartavio Añejo 750ml', 'Licores'),
  ('Pisco Queirolo Quebranta 750ml', 'Licores'),
  ('Vodka Ruso Estándar 750ml', 'Licores'),

  -- Golosinas y Snacks
  ('Papas Lays Clásicas 45g', 'Golosinas y Snacks'),
  ('Doritos Nacho 52g', 'Golosinas y Snacks'),
  ('Cheetos Bolita 40g', 'Golosinas y Snacks'),
  ('Galleta Oreo 108g', 'Golosinas y Snacks'),
  ('Galleta Casino 6 paq', 'Golosinas y Snacks'),
  ('Galleta Margarita Field 6 paq', 'Golosinas y Snacks'),
  ('Chocolate Sublime 45g', 'Golosinas y Snacks'),
  ('Chocolate Triángulo 40g', 'Golosinas y Snacks'),
  ('Chicle Trident Menta', 'Golosinas y Snacks'),
  ('Caramelos Halls Menta', 'Golosinas y Snacks'),

  -- Limpieza del Hogar
  ('Detergente Bolívar 800g', 'Limpieza del Hogar'),
  ('Detergente Ariel 720g', 'Limpieza del Hogar'),
  ('Lejía Clorox 1L', 'Limpieza del Hogar'),
  ('Jabón de Lavar Bolívar (barra)', 'Limpieza del Hogar'),
  ('Esponja Scotch Brite', 'Limpieza del Hogar'),
  ('Papel Higiénico Suave x4', 'Limpieza del Hogar'),
  ('Servilletas Elite x100', 'Limpieza del Hogar'),

  -- Cuidado Personal
  ('Jabón de Tocador Lux 90g', 'Cuidado Personal'),
  ('Jabón de Tocador Dove 90g', 'Cuidado Personal'),
  ('Shampoo Sedal 400ml', 'Cuidado Personal'),
  ('Pasta Dental Colgate Triple Acción 90g', 'Cuidado Personal'),
  ('Desodorante Rexona Roll On', 'Cuidado Personal'),
  ('Toallas Higiénicas Nosotras x8', 'Cuidado Personal'),

  -- Mascotas
  ('Alimento para Perro Ricocan 1kg', 'Mascotas'),
  ('Alimento para Gato Whiskas 1kg', 'Mascotas'),
  ('Snack para Perro Dog Chow', 'Mascotas')
) as v(descripcion, categoria)
where not exists (
  select 1 from public.catalogo_maestro cm where cm.descripcion = v.descripcion
);

-- Verificación: cuántos productos quedaron en total.
select count(*) as total_productos_maestro from public.catalogo_maestro;

NOTIFY pgrst, 'reload schema';
