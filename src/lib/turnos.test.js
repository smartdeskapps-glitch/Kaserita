import { describe, it, expect } from 'vitest';
import { antiguedadTurno, LIMITE_HORAS_TURNO } from './turnos.js';

const ahora = new Date(2026, 9, 5, 22, 0); // 5/10/2026 22:00 (hora local)
const hace = (horas) => new Date(ahora.getTime() - horas * 3600 * 1000).toISOString();

describe('antiguedadTurno', () => {
  it('el límite es de 24 horas', () => {
    expect(LIMITE_HORAS_TURNO).toBe(24);
  });
  it('un turno abierto hace minutos no es antiguo', () => {
    const r = antiguedadTurno(hace(0.2), ahora);
    expect(r.antiguo).toBe(false);
    expect(r.etiqueta).toBe('hace menos de 1 hora');
  });
  it('en horas: singular y plural', () => {
    expect(antiguedadTurno(hace(1), ahora).etiqueta).toBe('hace 1 hora');
    expect(antiguedadTurno(hace(5), ahora).etiqueta).toBe('hace 5 horas');
    expect(antiguedadTurno(hace(23), ahora).antiguo).toBe(false);
  });
  it('desde las 24 horas es antiguo y se cuenta en días', () => {
    const r24 = antiguedadTurno(hace(24), ahora);
    expect(r24.antiguo).toBe(true);
    expect(r24.etiqueta).toBe('hace 1 día');
    expect(antiguedadTurno(hace(49), ahora).etiqueta).toBe('hace 2 días');
  });
  it('el caso real de la demo: abierto el 24/09 y visto el 5/10 = 11 días', () => {
    const apertura = new Date(2026, 8, 24, 21, 57).toISOString();
    const r = antiguedadTurno(apertura, ahora);
    expect(r.dias).toBe(11);
    expect(r.antiguo).toBe(true);
    expect(r.etiqueta).toBe('hace 11 días');
  });
  it('fecha inválida o vacía: no es antiguo y no rompe', () => {
    for (const x of [null, undefined, '', 'no-es-fecha']) {
      const r = antiguedadTurno(x, ahora);
      expect(r.valida).toBe(false);
      expect(r.antiguo).toBe(false);
      expect(r.etiqueta).toBe('');
    }
  });
  it('una fecha futura (reloj desfasado) cuenta como recién abierto', () => {
    const r = antiguedadTurno(new Date(ahora.getTime() + 3600 * 1000).toISOString(), ahora);
    expect(r.antiguo).toBe(false);
    expect(r.horas).toBe(0);
  });
  it('sin "ahora" usa la hora actual', () => {
    expect(antiguedadTurno(new Date().toISOString()).antiguo).toBe(false);
  });
});
