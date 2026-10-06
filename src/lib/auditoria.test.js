import { describe, it, expect } from 'vitest';
import { valorAuditoria, describirAuditoria } from './auditoria.js';

const UUID = '42f0f9dd-e95f-4caa-8e01-1eb708748437';

describe('valorAuditoria', () => {
  it('dinero con S/ y dos decimales', () => {
    expect(valorAuditoria('dinero', 15.5)).toBe('S/ 15.50');
    expect(valorAuditoria('dinero', '4')).toBe('S/ 4.00');
  });
  it('booleanos como Sí / No', () => {
    expect(valorAuditoria('bool', true)).toBe('Sí');
    expect(valorAuditoria('bool', 'false')).toBe('No');
  });
  it('estado de turno en minúscula legible', () => {
    expect(valorAuditoria('estado', 'ABIERTA')).toBe('abierto');
    expect(valorAuditoria('estado', 'CERRADA')).toBe('cerrado');
  });
  it('vacíos como "sin dato"', () => {
    expect(valorAuditoria('texto', null)).toBe('sin dato');
    expect(valorAuditoria('dinero', '')).toBe('sin dato');
    expect(valorAuditoria('texto', undefined)).toBe('sin dato');
  });
});

describe('describirAuditoria', () => {
  it('producto con cambio de costo', () => {
    const r = describirAuditoria({
      tabla: 'productos', operacion: 'UPDATE',
      resumen: 'Producto modificado: Huevos San Fernando x30 (precio_costo: 15.50 → 4.00)',
      cambios: { precio_costo: { antes: 15.5, despues: 4 } },
    });
    expect(r.titulo).toBe('Producto modificado: Huevos San Fernando x30');
    expect(r.detalle).toEqual(['Costo: S/ 15.50 → S/ 4.00']);
  });
  it('turno abierto: sin UUID en el título', () => {
    const r = describirAuditoria({ tabla: 'turnos_caja', operacion: 'INSERT', resumen: `Turno de caja abierto: ${UUID}`, cambios: null });
    expect(r.titulo).toBe('Turno de caja abierto');
    expect(r.titulo).not.toMatch(UUID);
    expect(r.detalle).toEqual([]);
  });
  it('turno cerrado: muestra efectivo contado y diferencia, no el estado', () => {
    const r = describirAuditoria({
      tabla: 'turnos_caja', operacion: 'UPDATE', resumen: `Turno de caja modificado: ${UUID} (estado: ABIERTA → CERRADA)`,
      cambios: { estado: { antes: 'ABIERTA', despues: 'CERRADA' }, diferencia: { antes: null, despues: 0 }, monto_final_real: { antes: null, despues: 1734.6 } },
    });
    expect(r.titulo).toBe('Turno de caja cerrado');
    expect(r.detalle).toEqual(['Diferencia: S/ 0.00', 'Efectivo contado: S/ 1734.60']);
  });
  it('venta anulada con motivo', () => {
    const r = describirAuditoria({
      tabla: 'ventas', operacion: 'UPDATE', resumen: 'Venta modificado: B001-00000010 (anulada: false → true)',
      cambios: { anulada: { antes: false, despues: true }, motivo_anulacion: { antes: null, despues: 'error de cobro' } },
    });
    expect(r.titulo).toBe('Venta anulada: B001-00000010');
    expect(r.detalle).toContain('Motivo: sin dato → error de cobro');
  });
  it('venta modificada sin anular no dice "anulada"', () => {
    const r = describirAuditoria({
      tabla: 'ventas', operacion: 'UPDATE', resumen: 'Venta modificado: B001-1 (total_venta: 10 → 12)',
      cambios: { total_venta: { antes: 10, despues: 12 } },
    });
    expect(r.titulo).toBe('Venta modificada: B001-1');
  });
  it('el PIN nunca se muestra, solo que cambió', () => {
    const r = describirAuditoria({
      tabla: 'cajeros', operacion: 'UPDATE', resumen: 'Empleado modificado: Ana (pin_seguridad: oculto → cambiado)',
      cambios: { pin_seguridad: { antes: 'oculto', despues: 'cambiado' } },
    });
    expect(r.detalle).toEqual(['PIN de seguridad cambiado']);
  });
  it('empleado y merma: verbos correctos', () => {
    expect(describirAuditoria({ tabla: 'cajeros', operacion: 'INSERT', resumen: 'Empleado creado: Cajero QA', cambios: null }).titulo).toBe('Empleado creado: Cajero QA');
    expect(describirAuditoria({ tabla: 'cajeros', operacion: 'DELETE', resumen: 'Empleado eliminado: Cajero QA', cambios: null }).titulo).toBe('Empleado eliminado: Cajero QA');
    expect(describirAuditoria({ tabla: 'mermas', operacion: 'INSERT', resumen: 'Merma creado', cambios: null }).titulo).toBe('Merma registrada');
  });
  it('tabla desconocida: usa el resumen sin UUID', () => {
    const r = describirAuditoria({ tabla: 'otra', operacion: 'UPDATE', resumen: `Algo ${UUID} cambió`, cambios: null });
    expect(r.titulo).toBe('Algo cambió');
  });
  it('tolera filas incompletas sin romper', () => {
    expect(() => describirAuditoria({ tabla: 'productos', operacion: 'UPDATE' })).not.toThrow();
    expect(describirAuditoria({ tabla: 'productos', operacion: 'UPDATE' }).detalle).toEqual([]);
  });
});
