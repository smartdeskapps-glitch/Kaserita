import { describe, it, expect } from 'vitest';
import { estadoDeudor, coberturaPago, restoPrimeraBoleta } from './deudas.js';

// 20/10/2026 12:00: la boleta A tiene 41 días, la B 19 y la C 8.
const AHORA = Date.parse('2026-10-20T12:00:00Z');
const A = { id: 'a', fecha_hora: '2026-09-09T12:00:00Z', total_venta: 128.5 };
const B = { id: 'b', fecha_hora: '2026-10-01T12:00:00Z', total_venta: 96.4 };
const C = { id: 'c', fecha_hora: '2026-10-12T12:00:00Z', total_venta: 240 };
const TOTAL = 464.9;

describe('estadoDeudor', () => {
  it('sin abonos todas las boletas siguen pendientes', () => {
    const e = estadoDeudor({ saldo: TOTAL, diasCredito: 30 }, [C, A, B], AHORA);
    expect(e.pendientesAsc.map((b) => b.id)).toEqual(['a', 'b', 'c']);
    expect(e.parcial).toBe(0);
  });

  it('la lista completa va de la más nueva a la más vieja', () => {
    const e = estadoDeudor({ saldo: TOTAL, diasCredito: 30 }, [A, B, C], AHORA);
    expect(e.boletas.map((b) => b.id)).toEqual(['c', 'b', 'a']);
  });

  it('un abono que cubre justo la boleta más vieja la marca pagada (FIFO)', () => {
    const e = estadoDeudor({ saldo: 336.4, diasCredito: 30 }, [A, B, C], AHORA);
    expect(e.boletas.find((b) => b.id === 'a').pagada).toBe(true);
    expect(e.pendientesAsc.map((b) => b.id)).toEqual(['b', 'c']);
    expect(e.parcial).toBe(0);
  });

  it('un abono menor que la boleta más vieja queda como pago a cuenta', () => {
    const e = estadoDeudor({ saldo: 404.9, diasCredito: 30 }, [A, B, C], AHORA);
    expect(e.pendientesAsc).toHaveLength(3);
    expect(e.parcial).toBe(60);
  });

  it('vencida es lo que pasó del plazo de crédito del cliente', () => {
    const e = estadoDeudor({ saldo: TOTAL, diasCredito: 30 }, [A, B, C], AHORA);
    expect(e.vencidas.map((b) => b.id)).toEqual(['a']);
    expect(e.vencidas[0].diasVencido).toBe(11);
    expect(e.vencidoMonto).toBe(128.5);
    expect(e.masVieja.id).toBe('a');
  });

  it('con un plazo más corto vence más deuda; una boleta pagada nunca vence', () => {
    const corto = estadoDeudor({ saldo: TOTAL, diasCredito: 15 }, [A, B, C], AHORA);
    expect(corto.vencidas.map((b) => b.id)).toEqual(['a', 'b']);
    const pagada = estadoDeudor({ saldo: 336.4, diasCredito: 30 }, [A, B, C], AHORA);
    expect(pagada.vencidas).toHaveLength(0);
  });

  it('sin boletas no hay nada pendiente ni vencido', () => {
    const e = estadoDeudor({ saldo: 0, diasCredito: 30 }, [], AHORA);
    expect(e.pendientesAsc).toEqual([]);
    expect(e.masVieja).toBeNull();
    expect(e.vencidoMonto).toBe(0);
  });
});

describe('coberturaPago', () => {
  const estado = estadoDeudor({ saldo: 404.9, diasCredito: 30 }, [A, B, C], AHORA); // 60 ya abonados a A

  it('cuenta lo ya abonado a la primera boleta', () => {
    expect(coberturaPago(estado, 68.5).ids).toEqual(['a']);
    expect(coberturaPago(estado, 68.4).cubiertas).toBe(0);
  });
  it('cubre varias boletas, las más viejas primero', () => {
    expect(coberturaPago(estado, 68.5 + 96.4).ids).toEqual(['a', 'b']);
    expect(coberturaPago(estado, 404.9).cubiertas).toBe(3);
  });
  it('lo que falta de la boleta más vieja', () => {
    expect(restoPrimeraBoleta(estado)).toBe(68.5);
    expect(restoPrimeraBoleta(estadoDeudor({ saldo: 0, diasCredito: 30 }, [], AHORA))).toBe(0);
  });
});
