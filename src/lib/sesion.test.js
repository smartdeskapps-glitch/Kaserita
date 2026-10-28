import { describe, it, expect } from 'vitest';
import { claveAuthSupabase, puedeUsarSesionGuardada, debeReintentar, PAUSAS_REINTENTO_SESION } from './sesion.js';

describe('claveAuthSupabase', () => {
  it('arma la llave con el id del proyecto', () => {
    expect(claveAuthSupabase('https://hzmrsbeamtbloudmxjrp.supabase.co')).toBe('sb-hzmrsbeamtbloudmxjrp-auth-token');
    expect(claveAuthSupabase('  https://abc.supabase.co ')).toBe('sb-abc-auth-token');
  });
  it('devuelve null si la dirección no sirve', () => {
    expect(claveAuthSupabase('')).toBeNull();
    expect(claveAuthSupabase(undefined)).toBeNull();
  });
});

describe('puedeUsarSesionGuardada', () => {
  const guardada = { refresh_token: 'r', user: { id: 'u1' } };
  const copia = { usuario: { auth_id: 'u1', nombre: 'Dueño' }, bodega: { id: 'b1' } };
  it('sí, cuando es la misma cuenta y hay token de renovación', () => {
    expect(puedeUsarSesionGuardada(guardada, copia)).toBe(true);
  });
  it('no, si la copia es de otra cuenta', () => {
    expect(puedeUsarSesionGuardada(guardada, { usuario: { auth_id: 'otro' } })).toBe(false);
  });
  it('no, si Supabase ya no guarda sesión o no tiene token de renovación', () => {
    expect(puedeUsarSesionGuardada(null, copia)).toBe(false);
    expect(puedeUsarSesionGuardada({ user: { id: 'u1' } }, copia)).toBe(false);
  });
  it('no, si no hay copia o está incompleta', () => {
    expect(puedeUsarSesionGuardada(guardada, null)).toBe(false);
    expect(puedeUsarSesionGuardada(guardada, { usuario: {} })).toBe(false);
    expect(puedeUsarSesionGuardada(guardada, { usuario: { auth_id: 'u1' } })).toBe(true);
  });
});

describe('reintentos al abrir', () => {
  it('reintenta solo ante un error y con internet', () => {
    expect(debeReintentar('error', true)).toBe(true);
    expect(debeReintentar('error', undefined)).toBe(true);
    expect(debeReintentar('error', false)).toBe(false);
    expect(debeReintentar('ok', true)).toBe(false);
    expect(debeReintentar('sin-sesion', true)).toBe(false);
    expect(debeReintentar('sin-suscripcion', true)).toBe(false);
  });
  it('el primer intento es inmediato y la espera total es corta', () => {
    expect(PAUSAS_REINTENTO_SESION[0]).toBe(0);
    expect(PAUSAS_REINTENTO_SESION.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(7000);
  });
});
