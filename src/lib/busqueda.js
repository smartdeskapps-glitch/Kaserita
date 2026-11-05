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

const textoCacheado = (p, cache) => {
  let texto = cache ? cache.get(p) : undefined;
  if (texto === undefined) {
    texto = textoBuscable(p);
    if (cache) cache.set(p, texto);
  }
  return texto;
};

// Filtra la lista sin modificarla. `cache` (WeakMap opcional) evita recalcular
// el texto normalizado de cada producto en cada tecla. Las palabras del término
// se separan una sola vez (no una vez por producto).
export const filtrarProductos = (lista, termino, cache) => {
  const t = normalizarBusqueda(termino);
  if (!t) return lista;
  const palabras = t.split(' ');
  const resultado = [];
  for (const p of lista || []) {
    const texto = textoCacheado(p, cache);
    let ok = true;
    for (let i = 0; i < palabras.length; i++) {
      if (texto.indexOf(palabras[i]) === -1) { ok = false; break; }
    }
    if (ok) resultado.push(p);
  }
  return resultado;
};

// Filtro que recuerda la última búsqueda: mientras se sigue escribiendo
// ("arr" -> "arro" -> "arroz"), filtra sobre el resultado anterior en vez de
// recorrer todo el catálogo. Si cambia la lista o el texto deja de ser una
// continuación (se borró algo), vuelve a filtrar desde la lista completa.
export const crearFiltroProductos = () => {
  const cache = new WeakMap();
  let ultimaLista = null;
  let ultimoTermino = '';
  let ultimoResultado = null;
  return (lista, termino) => {
    const t = normalizarBusqueda(termino);
    if (!t) {
      ultimaLista = lista; ultimoTermino = ''; ultimoResultado = lista;
      return lista;
    }
    const base = lista === ultimaLista && ultimoTermino && t.startsWith(ultimoTermino) ? ultimoResultado : lista;
    const resultado = filtrarProductos(base, t, cache);
    ultimaLista = lista; ultimoTermino = t; ultimoResultado = resultado;
    return resultado;
  };
};
