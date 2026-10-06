import { describe, it, expect } from 'vitest';
import { esDniValido, esDocumentoValido, esRucValido, esMontoNoNegativo } from './validaciones.js';

describe('esDniValido', () => {
  it('acepta exactamente 8 dígitos', () => {
    expect(esDniValido('12345678')).toBe(true);
    expect(esDniValido(' 12345678 ')).toBe(true);
  });
  it('rechaza largos distintos, letras y vacíos', () => {
    expect(esDniValido('123')).toBe(false);
    expect(esDniValido('123456789')).toBe(false);
    expect(esDniValido('1234567a')).toBe(false);
    expect(esDniValido('')).toBe(false);
    expect(esDniValido(null)).toBe(false);
    expect(esDniValido(undefined)).toBe(false);
  });
});

describe('esDocumentoValido (cliente/cajero: DNI, RUC o carné)', () => {
  it('acepta DNI, RUC y carné/pasaporte de 9 a 12 caracteres', () => {
    expect(esDocumentoValido('12345678')).toBe(true);
    expect(esDocumentoValido('20123456789')).toBe(true);
    expect(esDocumentoValido('CE1234567')).toBe(true);
    expect(esDocumentoValido('123456789')).toBe(true); // carné de 9 dígitos
    expect(esDocumentoValido('123456789012')).toBe(true); // carné de 12 dígitos
    expect(esDocumentoValido('99999999')).toBe(true); // "Cliente varios"
  });
  it('rechaza los valores que antes se aceptaban por error', () => {
    expect(esDocumentoValido('123')).toBe(false);
    expect(esDocumentoValido('12')).toBe(false);
    expect(esDocumentoValido('abc')).toBe(false);
    expect(esDocumentoValido('1234567890')).toBe(false); // 10 dígitos no es DNI ni RUC
    expect(esDocumentoValido('')).toBe(false);
  });
  it('rechaza espacios y símbolos dentro del documento', () => {
    expect(esDocumentoValido('1234 5678')).toBe(false);
    expect(esDocumentoValido('1234-5678')).toBe(false);
  });
});

describe('esRucValido', () => {
  it('exige 11 dígitos', () => {
    expect(esRucValido('20123456789')).toBe(true);
    expect(esRucValido('123')).toBe(false);
    expect(esRucValido('2012345678a')).toBe(false);
    expect(esRucValido('')).toBe(false);
  });
});

describe('esMontoNoNegativo', () => {
  it('acepta cero, positivos, decimales y vacío (campo opcional)', () => {
    expect(esMontoNoNegativo('0')).toBe(true);
    expect(esMontoNoNegativo('3.5')).toBe(true);
    expect(esMontoNoNegativo(12)).toBe(true);
    expect(esMontoNoNegativo('')).toBe(true);
    expect(esMontoNoNegativo(null)).toBe(true);
    expect(esMontoNoNegativo(undefined)).toBe(true);
  });
  it('rechaza negativos y texto no numérico (el bug del precio -5)', () => {
    expect(esMontoNoNegativo('-5')).toBe(false);
    expect(esMontoNoNegativo(-0.01)).toBe(false);
    expect(esMontoNoNegativo('abc')).toBe(false);
    expect(esMontoNoNegativo(NaN)).toBe(false);
    expect(esMontoNoNegativo(Infinity)).toBe(false);
  });
});
