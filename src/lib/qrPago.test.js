import { describe, it, expect } from 'vitest';
import { cajaDelQR } from './qrPago.js';

const esquinas = (x0, y0, x1, y1) => ({
  topLeft: { x: x0, y: y0 },
  topRight: { x: x1, y: y0 },
  bottomRight: { x: x1, y: y1 },
  bottomLeft: { x: x0, y: y1 },
});

describe('cajaDelQR', () => {
  it('captura de Yape (1131x1600): recorta solo el cuadrado del código', () => {
    const c = cajaDelQR(esquinas(290, 508, 843, 1062), 1131, 1600);
    expect(c.lado).toBe(554);
    expect(c.x).toBeCloseTo(289.5, 5);
    expect(c.y).toBe(508);
  });

  it('un código ladeado usa la caja que lo contiene', () => {
    const p = { topLeft: { x: 110, y: 100 }, topRight: { x: 300, y: 130 }, bottomRight: { x: 270, y: 320 }, bottomLeft: { x: 80, y: 290 } };
    const c = cajaDelQR(p, 1000, 1000);
    expect(c.lado).toBe(220);
    expect(c.x + c.lado).toBeGreaterThanOrEqual(300);
    expect(c.y + c.lado).toBeGreaterThanOrEqual(320);
  });

  it('no se sale de la imagen cuando el código está en el borde', () => {
    const c = cajaDelQR(esquinas(-5, -5, 195, 195), 400, 300);
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
    const d = cajaDelQR(esquinas(300, 150, 400, 300), 400, 300);
    expect(d.x + d.lado).toBeLessThanOrEqual(400);
    expect(d.y + d.lado).toBeLessThanOrEqual(300);
  });

  it('sin esquinas válidas devuelve null', () => {
    expect(cajaDelQR(null, 100, 100)).toBeNull();
    expect(cajaDelQR({ topLeft: { x: 1, y: 1 } }, 100, 100)).toBeNull();
    expect(cajaDelQR(esquinas(NaN, 0, 10, 10), 100, 100)).toBeNull();
  });
});
