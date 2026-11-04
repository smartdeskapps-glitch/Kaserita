// Búsqueda del catálogo en memoria (sin consultar al servidor). Funciones puras
// para poder probarlas con Vitest. Sin barras invertidas en las regex a propósito.

// Minúsculas, sin tildes ni diéresis, sin signos de puntuación sueltos y con
// espacios simples: "Café,  (Pilsen)" -> "cafe pilsen".
export const normalizarBusqueda = (texto) =>
  String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[,;:()"'¿?¡!*{}]/g, ' ')
    .replace(/ +/g, ' ')
    .trim();

const CAMPOS = ['descripcion', 'cod_ean', 'cod_ean_pack', 'sku', 'cod_sku', 'categoria'];

// Texto donde se busca: nombre, códigos (unidad y pack), SKU y categoría.
export const textoBuscable = (p) => normalizarBusqueda(CAMPOS.map((c) => (p && p[c]) || '').join(' '));

// Un producto coincide si contiene TODAS las palabras buscadas, en cualquier orden
// ("arroz 5kg" encuentra "Arroz Costeño 5kg").
export const productoCoincide = (p, terminoNormalizado, cache) => {
  if (!terminoNormalizado) return true;
  let texto = cache ? cache.get(p) : undefined;
  if (texto === undefined) {
    texto = textoBuscable(p);
    if (cache) cache.set(p, texto);
  }
  return terminoNormalizado.split(' ').every((palabra) => texto.includes(palabra));
};

// Filtra la lista sin modificarla. `cache` (WeakMap opcional) evita recalcular
// el texto normalizado de cada producto en cada tecla.
export const filtrarProductos = (lista, termino, cache) => {
  const t = normalizarBusqueda(termino);
  if (!t) return lista;
  return (lista || []).filter((p) => productoCoincide(p, t, cache));
};
