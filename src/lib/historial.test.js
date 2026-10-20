import { describe, it, expect } from 'vitest';
import { isoLocal, fechasDeRango, resumenVentas } from './historial.js';

// Fechas armadas con hora local para que la prueba no dependa de la zona horaria.
const hora = (h, m = 0) => new Date(2026, 9, 20, h, m).toISOString();

describe('isoLocal', () => {
  it('da la fecha local con ceros a la izquierda', () => {
    expect(isoLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(isoLocal(new Date(2026, 9, 20))).toBe('2026-10-20');
  });
});

describe('fechasDeRango', () => {
  const hoy = new Date(2026, 9, 20);
  it('hoy y ayer son un solo día', () => {
    expect(fechasDeRango('hoy', hoy)).toEqual({ desde: '2026-10-20', hasta: '2026-10-20' });
    expect(fechasDeRango('ayer', hoy)).toEqual({ desde: '2026-10-19', hasta: '2026-10-19' });
  });
  it('7 días cuenta hoy', () => {
    expect(fechasDeRango('7', hoy)).toEqual({ desde: '2026-10-14', hasta: '2026-10-20' });
  });
  it('mes va del día 1 hasta hoy', () => {
    expect(fechasDeRango('mes', hoy)).toEqual({ desde: '2026-10-01', hasta: '2026-10-20' });
  });
  it('cruza el cambio de mes', () => {
    const primeros = new Date(2026, 10, 3);
    expect(fechasDeRango('ayer', primeros).desde).toBe('2026-11-02');
    expect(fechasDeRango('7', primeros).desde).toBe('2026-10-28');
    expect(fechasDeRango('mes', primeros).desde).toBe('2026-11-01');
  });
});

describe('resumenVentas', () => {
  const ventas = [
    { medio_pago: 'EFECTIVO', total_venta: 20, utilidad_total: 5, fecha_hora: hora(9, 15) },
    { medio_pago: 'YAPE', total_venta: 30, utilidad_total: 9, fecha_hora: hora(10), anulada: true },
    { medio_pago: 'MIXTO', total_venta: 40, utilidad_total: 8, monto_efectivo: 25, monto_otro: 15, fecha_hora: hora(9, 40) },
    { medio_pago: 'CREDITO', total_venta: 10, utilidad_total: 2, fecha_hora: hora(14, 5) }
  ];

  it('suma solo las ventas vigentes', () => {
    const r = resumenVentas(ventas);
    expect(r.n).toBe(3);
    expect(r.total).toBe(70);
    expect(r.utilidad).toBe(15);
    expect(r.ticket).toBe(23.33);
    expect(r.anuladas).toBe(1);
  });

  it('reparte por medio de pago y parte las ventas mixtas', () => {
    const r = resumenVentas(ventas);
    expect(r.porMedio).toEqual({ EFECTIVO: 45, OTRO: 15, CREDITO: 10 });
  });

  it('agrupa lo vendido por hora', () => {
    const r = resumenVentas(ventas);
    expect(r.porHora).toEqual({ 9: 60, 14: 10 });
  });

  it('tolera lista vacía y null', () => {
    expect(resumenVentas([])).toEqual({ n: 0, total: 0, utilidad: 0, ticket: 0, porMedio: {}, porHora: {}, anuladas: 0 });
    expect(resumenVentas(null).n).toBe(0);
  });
});
