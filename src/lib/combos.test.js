import { describe, it, expect } from 'vitest';
import { precioNormalCombo, costoNormalCombo, margenCombo, expandirLineaCombo, detalleComboTicket } from './combos.js';

// Combo QA de la demo: Coca Cola (precio 3.50, costo 2.80) + Galletas (8.50, 6.50) a S/ 9.50.
const itemsForm = [
  { precio_venta: 3.5, precio_costo: 2.8, cantidad: 1 },
  { precio_venta: 8.5, precio_costo: 6.5, cantidad: 1 },
];

describe('precioNormalCombo / costoNormalCombo', () => {
  it('suman precio y costo por cantidad', () => {
    expect(precioNormalCombo(itemsForm)).toBe(12);
    expect(costoNormalCombo(itemsForm)).toBeCloseTo(9.3, 2);
  });
  it('respetan las cantidades (Combo Desayuno: pan x4)', () => {
    expect(precioNormalCombo([{ precio_venta: 0.4, precio_costo: 0.2, cantidad: 4 }])).toBeCloseTo(1.6, 2);
  });
  it('lista vacía o undefined = 0', () => {
    expect(precioNormalCombo([])).toBe(0);
    expect(costoNormalCombo(undefined)).toBe(0);
  });
});

describe('margenCombo', () => {
  it('calcula ganancia y margen sobre el precio (combo QA: 2% = margen bajo)', () => {
    const m = margenCombo(9.5, 9.3);
    expect(m.ganancia).toBeCloseTo(0.2, 2);
    expect(m.margenPct).toBeCloseTo(2.1, 1);
    expect(m.bajo).toBe(true);
  });
  it('un margen sano no es "bajo" (precio 12 sobre costo 9.30 = 22%)', () => {
    const m = margenCombo(12, 9.3);
    expect(m.margenPct).toBeCloseTo(22.5, 1);
    expect(m.bajo).toBe(false);
  });
  it('el límite está en 10%', () => {
    expect(margenCombo(100, 90).bajo).toBe(false); // exactamente 10%
    expect(margenCombo(100, 90.01).bajo).toBe(true);
  });
  it('precio bajo el costo: margen negativo y pérdida', () => {
    const m = margenCombo(3, 9.3);
    expect(m.margenPct).toBeLessThan(0);
    expect(m.perdida).toBe(true);
  });
  it('precio 0 no divide por cero', () => {
    const m = margenCombo(0, 5);
    expect(Number.isFinite(m.margenPct)).toBe(true);
  });
});

const lineaCombo = (cantidad, subtotal = 9.5 * cantidad) => ({
  esCombo: true,
  comboId: 'c1',
  descripcion: 'Combo: Combo QA Gaseosas',
  cantidad,
  subtotal,
  itemsCombo: [
    { productoId: 'p1', cod_ean: '1', descripcion: 'Coca Cola 500ml', precioVenta: 3.5, precioCosto: 2.8, cantidadBase: 1 },
    { productoId: 'p2', cod_ean: '2', descripcion: 'Galletas Casino', precioVenta: 8.5, precioCosto: 6.5, cantidadBase: 1 },
  ],
});

describe('expandirLineaCombo (prorrateo del precio entre componentes)', () => {
  it('una línea normal pasa tal cual', () => {
    const it1 = { productoId: 'x', cantidad: 2, subtotal: 5 };
    expect(expandirLineaCombo(it1)).toEqual([it1]);
  });
  it('genera una línea por producto con la cantidad multiplicada', () => {
    const l = expandirLineaCombo(lineaCombo(2));
    expect(l).toHaveLength(2);
    expect(l.map((x) => x.cantidad)).toEqual([2, 2]);
    expect(l.map((x) => x.productoId)).toEqual(['p1', 'p2']);
  });
  it('los subtotales suman EXACTAMENTE el subtotal del combo (sin perder centavos)', () => {
    for (const cant of [1, 2, 3, 7]) {
      const linea = lineaCombo(cant);
      const suma = expandirLineaCombo(linea).reduce((a, x) => a + x.subtotal, 0);
      expect(+suma.toFixed(2)).toBe(linea.subtotal);
    }
  });
  it('reparte en proporción al precio de lista (3.50 : 8.50)', () => {
    const [a, b] = expandirLineaCombo(lineaCombo(1));
    expect(a.subtotal).toBeCloseTo(9.5 * (3.5 / 12), 1);
    expect(b.subtotal).toBeCloseTo(9.5 - a.subtotal, 2);
  });
  it('etiqueta cada línea con el nombre del combo y conserva su comboId', () => {
    const [a] = expandirLineaCombo(lineaCombo(1));
    expect(a.descripcion).toBe('Coca Cola 500ml (Combo: Combo QA Gaseosas)');
    expect(a.comboId).toBe('c1');
  });
  it('con precios de lista en 0 reparte en partes iguales sin dividir por cero', () => {
    const linea = lineaCombo(1, 10);
    linea.itemsCombo = linea.itemsCombo.map((c) => ({ ...c, precioVenta: 0 }));
    const suma = expandirLineaCombo(linea).reduce((a, x) => a + x.subtotal, 0);
    expect(+suma.toFixed(2)).toBe(10);
  });
  it('el stock descontado es cantidadBase x cantidad de combos', () => {
    const linea = lineaCombo(3);
    linea.itemsCombo[0].cantidadBase = 2; // Coca x2 por combo
    const [coca] = expandirLineaCombo(linea);
    expect(coca.unidadesStock).toBe(6);
  });
});

describe('detalleComboTicket', () => {
  it('lista cada producto con la cantidad total', () => {
    expect(detalleComboTicket(lineaCombo(2))).toEqual(['Coca Cola 500ml x2', 'Galletas Casino x2']);
  });
  it('devuelve [] para líneas que no son combo o están incompletas', () => {
    expect(detalleComboTicket({ esCombo: false })).toEqual([]);
    expect(detalleComboTicket(null)).toEqual([]);
    expect(detalleComboTicket({ esCombo: true })).toEqual([]);
  });
});
