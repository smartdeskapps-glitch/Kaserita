// Validaciones de formularios del POS. Funciones puras (sin React ni Supabase)
// para poder probarlas con Vitest. Sin barras invertidas en las regex a propósito.

const texto = (v) => String(v ?? '').trim();

// DNI: exactamente 8 dígitos.
export const esDniValido = (v) => /^[0-9]{8}$/.test(texto(v));

// RUC: exactamente 11 dígitos.
export const esRucValido = (v) => /^[0-9]{11}$/.test(texto(v));

// Cliente o cajero: DNI (8 dígitos), RUC (11), carné de extranjería (9 o 12
// dígitos) o pasaporte (9 a 12 caracteres con al menos una letra). Sin
// espacios ni símbolos. Un número de 10 dígitos no es ninguno de ellos.
export const esDocumentoValido = (v) => /^([0-9]{8,9}|[0-9]{11,12}|(?=.*[A-Za-z])[A-Za-z0-9]{9,12})$/.test(texto(v));

// Número >= 0. Vacío cuenta como válido cuando el campo es opcional.
export const esMontoNoNegativo = (v) =>
  v === '' || v === null || v === undefined || (Number.isFinite(Number(v)) && Number(v) >= 0);
