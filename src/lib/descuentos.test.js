import { describe, it, expect } from 'vitest';
import { calcularDescuento } from './descuentos.js';

describe('calcularDescuento', () => {
  it('sin tipo no hay descuento', () => {
    expect(calcularDescuento({ tipo: null, valor: '10', total: 100 })).toBe(0);
  });
  it('porcentaje: 10% de 14.50 = 1.45', () => {
    expect(calcularDescuento({ tipo: 'PORCENTAJE', valor: '10', total: 14.5 })).toBe(1.45);
  });
  it('porcentaje: se redondea a 2 decimales', () => {
    expect(calcularDescuento({ tipo: 'PORCENTAJE', valor: '33', total: 10 })).toBe(3.3);
    expect(calcularDescuento({ tipo: 'PORCENTAJE', valor: '7', total: 14.72 })).toBe(1.03);
  });
  it('porcentaje: más de 100% se limita a 100% (nunca mayor al total)', () => {
    expect(calcularDescuento({ tipo: 'PORCENTAJE', valor: '150', total: 20 })).toBe(20);
  });
  it('monto fijo: se aplica tal cual', () => {
    expect(calcularDescuento({ tipo: 'MONTO', valor: '2', total: 14.5 })).toBe(2);
  });
  it('monto fijo mayor al total: se limita al total', () => {
    expect(calcularDescuento({ tipo: 'MONTO', valor: '99', total: 14.5 })).toBe(14.5);
  });
  it('valores negativos, vacíos o texto no generan descuento', () => {
    expect(calcularDescuento({ tipo: 'PORCENTAJE', valor: '-5', total: 100 })).toBe(0);
    expect(calcularDescuento({ tipo: 'MONTO', valor: '', total: 100 })).toBe(0);
    expect(calcularDescuento({ tipo: 'MONTO', valor: 'abc', total: 100 })).toBe(0);
    expect(calcularDescuento({ tipo: 'MONTO', valor: '0', total: 100 })).toBe(0);
  });
  it('con total en cero no hay descuento', () => {
    expect(calcularDescuento({ tipo: 'PORCENTAJE', valor: '10', total: 0 })).toBe(0);
  });
});
