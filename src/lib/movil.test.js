import { describe, it, expect } from 'vitest';
import { campoNecesitaLetraGrande } from './movil.js';

const campo = (tagName, type = 'text') => ({ tagName, type });

describe('campoNecesitaLetraGrande', () => {
  it('sube la letra de un campo de texto chico en celular', () => {
    expect(campoNecesitaLetraGrande(campo('INPUT'), 375, 14)).toBe(true);
    expect(campoNecesitaLetraGrande(campo('TEXTAREA', 'textarea'), 390, 13)).toBe(true);
    expect(campoNecesitaLetraGrande(campo('SELECT', 'select-one'), 360, 14)).toBe(true);
  });

  it('no toca los campos que ya miden 16 px o más', () => {
    expect(campoNecesitaLetraGrande(campo('INPUT'), 375, 16)).toBe(false);
    expect(campoNecesitaLetraGrande(campo('INPUT', 'number'), 375, 32)).toBe(false);
  });

  it('no cambia nada en pantallas grandes', () => {
    expect(campoNecesitaLetraGrande(campo('INPUT'), 768, 14)).toBe(false);
    expect(campoNecesitaLetraGrande(campo('INPUT'), 1280, 14)).toBe(false);
  });

  it('ignora lo que no es un campo de texto', () => {
    expect(campoNecesitaLetraGrande(campo('BUTTON', 'submit'), 375, 14)).toBe(false);
    expect(campoNecesitaLetraGrande(campo('DIV', ''), 375, 14)).toBe(false);
    expect(campoNecesitaLetraGrande(campo('INPUT', 'checkbox'), 375, 14)).toBe(false);
    expect(campoNecesitaLetraGrande(campo('INPUT', 'radio'), 375, 14)).toBe(false);
    expect(campoNecesitaLetraGrande(null, 375, 14)).toBe(false);
  });
});
