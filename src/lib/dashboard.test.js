import { describe, it, expect } from 'vitest';
import { resumirVentasPeriodo, agruparVentasPorDia, calcularCambioPct } from './dashboard.js';
import { fechaISOLocal } from './fechas.js';

// Fechas armadas con componentes LOCALES para que las pruebas no dependan de la zona horaria.
const f = (anio, mes, dia, hora = 12, min = 0) => new Date(anio, mes - 1, dia, hora, min).toISOString();

const v = (extra) => ({ total_venta: 10, utilidad_total: 3, medio_pago: 'EFECTIVO', fecha_hora: f(2026, 10, 5, 19), ventas_detalle: [], ...extra });

describe('fechaISOLocal', () => {
  it('usa los componentes locales (no UTC): 7pm del día 5 sigue siendo el día 5', () => {
    expect(fechaISOLocal(new Date(2026, 9, 5, 19, 30))).toBe('2026-10-05');
    expect(fechaISOLocal(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
    expect(fechaISOLocal(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('calcularCambioPct', () => {
  it('variación porcentual normal', () => {
    expect(calcularCambioPct(150, 100)).toBe(50);
    expect(calcularCambioPct(5, 100)).toBe(-95);
  });
  it('sin base anterior: 100 si hay ventas, 0 si no (la pantalla oculta ese 100)', () => {
    expect(calcularCambioPct(40, 0)).toBe(100);
    expect(calcularCambioPct(0, 0)).toBe(0);
  });
  it('una caída del 99.6% es -99.6, no -100 (el "↓100%" de la demo era redondeo)', () => {
    expect(calcularCambioPct(7.5, 1734.6)).toBeCloseTo(-99.57, 1);
  });
});

describe('resumirVentasPeriodo', () => {
  it('sin datos devuelve la estructura en cero', () => {
    const r = resumirVentasPeriodo([], []);
    expect(r).toMatchObject({ total: 0, utilidad: 0, n: 0, top_productos: [], por_dia: [], anterior: { total: 0, utilidad: 0 } });
  });
  it('suma total, utilidad y cuenta ventas', () => {
    const r = resumirVentasPeriodo([v({ total_venta: 24.5, utilidad_total: 5 }), v({ total_venta: 13.05, utilidad_total: 2 })], []);
    expect(r.total).toBeCloseTo(37.55, 2);
    expect(r.utilidad).toBe(7);
    expect(r.n).toBe(2);
  });
  it('REGRESIÓN: las ventas anuladas no cuentan en nada', () => {
    const r = resumirVentasPeriodo([v({ total_venta: 10 }), v({ total_venta: 999, anulada: true, ventas_detalle: [{ descripcion: 'X', cantidad: 1, subtotal: 999 }] })], []);
    expect(r.total).toBe(10);
    expect(r.n).toBe(1);
    expect(r.top_productos).toEqual([]);
  });
  it('agrupa por medio de pago', () => {
    const r = resumirVentasPeriodo([v({ medio_pago: 'YAPE', total_venta: 31.5 }), v({ medio_pago: 'YAPE', total_venta: 5 }), v({ medio_pago: 'TARJETA', total_venta: 14.72 })], []);
    expect(r.por_medio.YAPE).toBe(36.5);
    expect(r.por_medio.TARJETA).toBe(14.72);
  });
  it('agrupa por hora local y por día (ordenado)', () => {
    const r = resumirVentasPeriodo([
      v({ fecha_hora: f(2026, 10, 5, 19, 10), total_venta: 10 }),
      v({ fecha_hora: f(2026, 10, 5, 19, 50), total_venta: 5 }),
      v({ fecha_hora: f(2026, 9, 29, 16), total_venta: 7.5 }),
    ], []);
    expect(r.por_hora[19]).toEqual({ total: 15, n: 2 });
    expect(r.por_hora[16]).toEqual({ total: 7.5, n: 1 });
    expect(r.por_dia).toEqual([{ fecha: '2026-09-29', total: 7.5 }, { fecha: '2026-10-05', total: 15 }]);
  });
  it('top de productos: agrega por descripción, ordena por monto y limita a 8', () => {
    const detalles = Array.from({ length: 10 }, (_, i) => ({ descripcion: `P${i}`, cantidad: 1, subtotal: 10 + i, utilidad: 1 }));
    const r = resumirVentasPeriodo([v({ ventas_detalle: detalles }), v({ ventas_detalle: [{ descripcion: 'P0', cantidad: 2, subtotal: 100, utilidad: 4 }] })], []);
    expect(r.top_productos).toHaveLength(8);
    expect(r.top_productos[0]).toEqual({ descripcion: 'P0', cantidad: 3, monto: 110, utilidad: 5 });
    const montos = r.top_productos.map((p) => p.monto);
    expect(montos).toEqual([...montos].sort((a, b) => b - a));
  });
  it('un detalle sin descripción se agrupa como "Producto"', () => {
    const r = resumirVentasPeriodo([v({ ventas_detalle: [{ cantidad: 1, subtotal: 4 }] })], []);
    expect(r.top_productos[0].descripcion).toBe('Producto');
  });
  it('el período anterior suma total y utilidad, sin anuladas', () => {
    const r = resumirVentasPeriodo([], [v({ total_venta: 100, utilidad_total: 40 }), v({ total_venta: 50, utilidad_total: 10, anulada: true })]);
    expect(r.anterior).toEqual({ total: 100, utilidad: 40 });
  });
});

describe('agruparVentasPorDia', () => {
  it('agrupa por fecha local con total, n, medios y horas', () => {
    const d = agruparVentasPorDia([
      v({ fecha_hora: f(2026, 10, 5, 19), total_venta: 24.5 }),
      v({ fecha_hora: f(2026, 10, 5, 20), total_venta: 13.05, medio_pago: 'YAPE' }),
    ]);
    expect(d).toHaveLength(1);
    expect(d[0].fecha).toBe('2026-10-05');
    expect(d[0].total).toBeCloseTo(37.55, 2);
    expect(d[0].n).toBe(2);
    expect(d[0].medios.EFECTIVO).toEqual({ total: 24.5, n: 1 });
    expect(d[0].medios.YAPE).toEqual({ total: 13.05, n: 1 });
    expect(d[0].horas[19]).toBe(24.5);
    expect(d[0].horas[20]).toBe(13.05);
  });
  it('de las ventas mixtas separa efectivo y otro medio', () => {
    const d = agruparVentasPorDia([v({ medio_pago: 'MIXTO', total_venta: 27.7, monto_efectivo: 17.7, monto_otro: 10 })]);
    expect(d[0].mixto_efectivo).toBe(17.7);
    expect(d[0].mixto_otro).toBe(10);
  });
  it('REGRESIÓN: ignora las anuladas y ordena los días de menor a mayor', () => {
    const d = agruparVentasPorDia([
      v({ fecha_hora: f(2026, 10, 5), total_venta: 5 }),
      v({ fecha_hora: f(2026, 9, 29), total_venta: 7.5 }),
      v({ fecha_hora: f(2026, 10, 1), total_venta: 999, anulada: true }),
    ]);
    expect(d.map((x) => x.fecha)).toEqual(['2026-09-29', '2026-10-05']);
  });
  it('lista vacía o null devuelve []', () => {
    expect(agruparVentasPorDia([])).toEqual([]);
    expect(agruparVentasPorDia(null)).toEqual([]);
  });
});
