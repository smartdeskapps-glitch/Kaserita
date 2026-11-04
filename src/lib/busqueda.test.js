import { describe, it, expect } from 'vitest';
import { normalizarBusqueda, filtrarProductos, productoCoincide } from './busqueda.js';

const catalogo = [
  { id: 1, descripcion: 'Arroz Costeño 5kg', cod_ean: '7750001000002', categoria: 'Abarrotes' },
  { id: 2, descripcion: 'Café Altomayo 200g', cod_ean: '7751111111111', categoria: 'Abarrotes', sku: 'ABA-CAF1' },
  { id: 3, descripcion: 'Cerveza Pilsen 620ml', cod_ean: '7752222222222', cod_ean_pack: '7752222222299', categoria: 'Cervezas' },
  { id: 4, descripcion: 'Corte clásico', cod_ean: null, categoria: 'Servicios' },
];

describe('normalizarBusqueda', () => {
  it('quita tildes, mayúsculas y espacios de más', () => {
    expect(normalizarBusqueda('  Café   PILSEN ')).toBe('cafe pilsen');
    expect(normalizarBusqueda('Costeño')).toBe('costeno');
    expect(normalizarBusqueda(null)).toBe('');
  });
});

describe('filtrarProductos', () => {
  it('sin término devuelve la misma lista', () => {
    expect(filtrarProductos(catalogo, '   ')).toBe(catalogo);
  });
  it('encuentra sin importar tildes', () => {
    expect(filtrarProductos(catalogo, 'cafe').map((p) => p.id)).toEqual([2]);
    expect(filtrarProductos(catalogo, 'COSTENO').map((p) => p.id)).toEqual([1]);
    expect(filtrarProductos(catalogo, 'clasico').map((p) => p.id)).toEqual([4]);
  });
  it('todas las palabras, en cualquier orden', () => {
    expect(filtrarProductos(catalogo, '5kg arroz').map((p) => p.id)).toEqual([1]);
    expect(filtrarProductos(catalogo, 'arroz pilsen')).toEqual([]);
  });
  it('busca por código de barras, código de pack, SKU y categoría', () => {
    expect(filtrarProductos(catalogo, '7751111').map((p) => p.id)).toEqual([2]);
    expect(filtrarProductos(catalogo, '7752222222299').map((p) => p.id)).toEqual([3]);
    expect(filtrarProductos(catalogo, 'aba-caf').map((p) => p.id)).toEqual([2]);
    expect(filtrarProductos(catalogo, 'cervezas').map((p) => p.id)).toEqual([3]);
  });
  it('comas y paréntesis no rompen nada (antes rompían la consulta al servidor)', () => {
    expect(filtrarProductos(catalogo, 'arroz, (5kg)').map((p) => p.id)).toEqual([1]);
    expect(() => filtrarProductos(catalogo, ')(,.*%')).not.toThrow();
  });
  it('la caché devuelve lo mismo que sin caché', () => {
    const cache = new WeakMap();
    expect(filtrarProductos(catalogo, 'pilsen', cache)).toEqual(filtrarProductos(catalogo, 'pilsen'));
    expect(productoCoincide(catalogo[2], 'pilsen', cache)).toBe(true);
  });
});
