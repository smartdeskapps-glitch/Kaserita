import { describe, it, expect } from 'vitest';
import { efectivoEntrante, desgloseMediosPago, esperadoEnCaja, diferenciaArqueo } from './arqueo.js';

const venta = (medio_pago, total_venta, extra = {}) => ({ medio_pago, total_venta, ...extra });

describe('efectivoEntrante', () => {
  it('suma las ventas en efectivo completas', () => {
    expect(efectivoEntrante([venta('EFECTIVO', 24.5), venta('EFECTIVO', 21.9)])).toBeCloseTo(46.4, 2);
  });
  it('de las ventas mixtas solo cuenta la parte en efectivo', () => {
    expect(efectivoEntrante([venta('MIXTO', 27.7, { monto_efectivo: 17.7, monto_otro: 10 })])).toBeCloseTo(17.7, 2);
  });
  it('ignora Yape, Plin, tarjeta y crédito: no entran a la caja física', () => {
    expect(efectivoEntrante([venta('YAPE', 30), venta('PLIN', 5), venta('TARJETA', 14.72), venta('CREDITO', 27.7)])).toBe(0);
  });
  it('REGRESIÓN: una venta anulada NO suma al efectivo esperado', () => {
    const ventas = [venta('EFECTIVO', 50), venta('EFECTIVO', 100, { anulada: true })];
    expect(efectivoEntrante(ventas)).toBe(50);
  });
  it('REGRESIÓN: una venta mixta anulada tampoco suma', () => {
    expect(efectivoEntrante([venta('MIXTO', 27.7, { monto_efectivo: 17.7, anulada: true })])).toBe(0);
  });
  it('tolera lista vacía, null y montos faltantes', () => {
    expect(efectivoEntrante([])).toBe(0);
    expect(efectivoEntrante(null)).toBe(0);
    expect(efectivoEntrante([venta('MIXTO', 10)])).toBe(0); // sin monto_efectivo
  });
});

describe('desgloseMediosPago', () => {
  it('agrupa por medio y de las mixtas toma solo la parte no efectivo', () => {
    const d = desgloseMediosPago([
      venta('YAPE', 31.5),
      venta('TARJETA', 14.72),
      venta('CREDITO', 81.5),
      venta('MIXTO', 27.7, { monto_otro: 10 }),
    ]);
    expect(d).toEqual({ YAPE: 31.5, PLIN: 0, TARJETA: 14.72, CREDITO: 81.5, MIXTO_OTRO: 10 });
  });
  it('REGRESIÓN: la venta Yape anulada no entra al desglose (44.55 vs 31.50)', () => {
    const d = desgloseMediosPago([venta('YAPE', 31.5), venta('YAPE', 13.05, { anulada: true })]);
    expect(d.YAPE).toBe(31.5);
  });
  it('el efectivo no aparece en el desglose informativo', () => {
    expect(desgloseMediosPago([venta('EFECTIVO', 99)])).toEqual({ YAPE: 0, PLIN: 0, TARJETA: 0, CREDITO: 0, MIXTO_OTRO: 0 });
  });
});

describe('esperadoEnCaja', () => {
  it('fondo inicial + efectivo del turno, redondeado a 2 decimales', () => {
    expect(esperadoEnCaja(100, [venta('EFECTIVO', 24.5), venta('EFECTIVO', 21.9)])).toBe(146.4);
  });
  it('un fondo inicial vacío o inválido cuenta como 0', () => {
    expect(esperadoEnCaja('', [venta('EFECTIVO', 10)])).toBe(10);
    expect(esperadoEnCaja(undefined, [])).toBe(0);
  });
  it('evita errores de punto flotante (0.1 + 0.2)', () => {
    expect(esperadoEnCaja(0.1, [venta('EFECTIVO', 0.2)])).toBe(0.3);
  });
});

describe('diferenciaArqueo', () => {
  it('cero cuando cuadra, positivo si sobra, negativo si falta', () => {
    expect(diferenciaArqueo(532.4, 532.4)).toBe(0);
    expect(diferenciaArqueo(600, 532.4)).toBe(67.6);
    expect(diferenciaArqueo(500, 532.4)).toBe(-32.4);
  });
  it('un conteo vacío cuenta como 0', () => {
    expect(diferenciaArqueo('', 100)).toBe(-100);
  });
});
