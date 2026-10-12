import { describe, it, expect } from 'vitest';
import { fechaISOLocal, fechaHoyISO } from './fechas.js';

describe('fechaISOLocal', () => {
  it('arma AAAA-MM-DD con ceros a la izquierda', () => {
    expect(fechaISOLocal(new Date(2026, 0, 5, 10, 0))).toBe('2026-01-05');
    expect(fechaISOLocal(new Date(2026, 9, 12, 10, 0))).toBe('2026-10-12');
  });
  it('a las 23:59 sigue siendo el mismo día local (no salta al día siguiente como en UTC)', () => {
    expect(fechaISOLocal(new Date(2026, 9, 5, 23, 59, 59))).toBe('2026-10-05');
  });
  it('a las 00:00 ya es el día nuevo', () => {
    expect(fechaISOLocal(new Date(2026, 9, 6, 0, 0, 0))).toBe('2026-10-06');
  });
  it('cruza fin de mes y fin de año', () => {
    expect(fechaISOLocal(new Date(2026, 0, 31, 22, 0))).toBe('2026-01-31');
    expect(fechaISOLocal(new Date(2026, 1, 1, 0, 1))).toBe('2026-02-01');
    expect(fechaISOLocal(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
    expect(fechaISOLocal(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
  });
  it('maneja el 29 de febrero de un año bisiesto', () => {
    expect(fechaISOLocal(new Date(2028, 1, 29, 12, 0))).toBe('2028-02-29');
    expect(fechaISOLocal(new Date(2028, 2, 1, 0, 0))).toBe('2028-03-01');
  });
});

describe('fechaHoyISO', () => {
  it('coincide con la fecha local de ahora', () => {
    expect(fechaHoyISO()).toBe(fechaISOLocal(new Date()));
    expect(fechaHoyISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
