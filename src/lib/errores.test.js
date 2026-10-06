import { describe, it, expect } from 'vitest';
import {
  esRuidoConocido, limpiarTexto, huellaError, decidirReporte, armarReporte,
  MAX_REPORTES_POR_SESION
} from './errores.js';

describe('esRuidoConocido', () => {
  it('ignora fallos de red y avisos inofensivos', () => {
    expect(esRuidoConocido('TypeError: Failed to fetch')).toBe(true);
    expect(esRuidoConocido('Load failed')).toBe(true);
    expect(esRuidoConocido('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(esRuidoConocido('Script error.')).toBe(true);
    expect(esRuidoConocido('')).toBe(true);
  });
  it('deja pasar errores reales', () => {
    expect(esRuidoConocido("TypeError: Cannot read properties of undefined (reading 'precio')")).toBe(false);
  });
});

describe('limpiarTexto', () => {
  it('quita datos de la URL, correos y números largos', () => {
    expect(limpiarTexto('en https://x.com/a?token=abc123 falló')).toBe('en https://x.com/a falló');
    expect(limpiarTexto('cliente juan@correo.com')).toBe('cliente [correo]');
    expect(limpiarTexto('dni 12345678 y cel 987654321')).toBe('dni [numero] y cel [numero]');
  });
  it('conserva números cortos y corta el texto largo', () => {
    expect(limpiarTexto('linea 42')).toBe('linea 42');
    expect(limpiarTexto('a'.repeat(600), 100).length).toBe(101);
  });
  it('tolera null y undefined', () => {
    expect(limpiarTexto(null)).toBe('');
    expect(limpiarTexto(undefined)).toBe('');
  });
});

describe('huellaError', () => {
  it('es igual aunque cambien los números', () => {
    expect(huellaError('Fila 3 inválida', 'js')).toBe(huellaError('Fila 17 inválida', 'js'));
  });
  it('distingue origen y mensaje', () => {
    expect(huellaError('a', 'js')).not.toBe(huellaError('a', 'render'));
    expect(huellaError('a', 'js')).not.toBe(huellaError('b', 'js'));
  });
});

describe('decidirReporte', () => {
  it('envía la primera vez y no repite dentro del minuto', () => {
    const a = decidirReporte(null, 'h', 1000);
    expect(a.enviar).toBe(true);
    const b = decidirReporte(a.estado, 'h', 30000);
    expect(b.enviar).toBe(false);
    const c = decidirReporte(b.estado, 'h', 62000);
    expect(c.enviar).toBe(true);
  });
  it('un error distinto sí se envía', () => {
    const a = decidirReporte(null, 'h1', 1000);
    expect(decidirReporte(a.estado, 'h2', 1500).enviar).toBe(true);
  });
  it('corta al llegar al máximo por sesión', () => {
    let estado = null;
    for (let i = 0; i < MAX_REPORTES_POR_SESION; i++) {
      const r = decidirReporte(estado, `h${i}`, i);
      expect(r.enviar).toBe(true);
      estado = r.estado;
    }
    expect(decidirReporte(estado, 'otro', 999999).enviar).toBe(false);
  });
});

describe('armarReporte', () => {
  it('normaliza el origen y limpia los campos', () => {
    const r = armarReporte({ mensaje: 'falló juan@x.com', stack: 'at https://a.b/c.js?v=1:2', origen: 'raro', accion: 'Cobrar', ruta: '/pos', navegador: 'UA' });
    expect(r.origen).toBe('js');
    expect(r.mensaje).toBe('falló [correo]');
    expect(r.detalle).toBe('at https://a.b/c.js:2');
    expect(r.accion).toBe('Cobrar');
  });
  it('deja en null lo que no hay', () => {
    const r = armarReporte({ mensaje: 'x', origen: 'render' });
    expect(r.detalle).toBeNull();
    expect(r.accion).toBeNull();
    expect(r.navegador).toBeNull();
  });
});
