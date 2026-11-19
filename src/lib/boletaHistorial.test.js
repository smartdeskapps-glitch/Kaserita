import { describe, it, expect } from 'vitest';
import { ventaHistorialParaBoleta } from './boletaHistorial.js';

const venta = {
  nro_boleta: 'B001-00000450',
  medio_pago: 'EFECTIVO',
  total_venta: '22.5',
  descuento_monto: '2.5',
  fecha_hora: '2026-11-18T21:11:00Z',
  clientes: { nombre_completo: 'Cliente QA Test', telefono: '987654321' },
  ventas_detalle: [
    { cantidad: 2, precio_unitario: '11.5', subtotal: '23', productos: { descripcion: 'Aceite Primor 1L', unidad: 'UND' } },
    { cantidad: 1.5, precio_unitario: '10.9', subtotal: '16.35', productos: { descripcion: 'Pollo Entero (kg)', unidad: 'KG' } },
  ],
};

describe('ventaHistorialParaBoleta', () => {
  it('arma el formato de la boleta con números reales y subtotal sin descuento', () => {
    const b = ventaHistorialParaBoleta(venta);
    expect(b.total_venta).toBe(22.5);
    expect(b.descuento).toBe(2.5);
    expect(b.subtotal).toBe(25);
    expect(b.telefono).toBe('987654321');
    expect(b.cliente).toBe('Cliente QA Test');
    expect(b.items).toEqual([
      { descripcion: 'Aceite Primor 1L', cantidad: 2, precioUnitario: 11.5, unidad: 'UND', subtotal: 23 },
      { descripcion: 'Pollo Entero (kg)', cantidad: 1.5, precioUnitario: 10.9, unidad: 'KG', subtotal: 16.35 },
    ]);
  });

  it('sin cliente o "Desconocido" dice "Cliente sin registrar" y sin teléfono', () => {
    expect(ventaHistorialParaBoleta({ ...venta, clientes: { nombre_completo: 'Desconocido' } }).cliente).toBe('Cliente sin registrar');
    const b = ventaHistorialParaBoleta({ ...venta, clientes: null });
    expect(b.cliente).toBe('Cliente sin registrar');
    expect(b.telefono).toBe('');
  });

  it('tolera una venta sin detalle ni descuento', () => {
    const b = ventaHistorialParaBoleta({ nro_boleta: 'B001-1', total_venta: 5 });
    expect(b.items).toEqual([]);
    expect(b.descuento).toBe(0);
    expect(b.subtotal).toBe(5);
  });
});
