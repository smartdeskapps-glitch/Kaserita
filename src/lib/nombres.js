// Iniciales de un nombre para los avatares ("Rosa Chávez Mendoza" -> "RC").
// `vacio` es lo que se devuelve si no hay nombre.
export const iniciales = (nombre, vacio = '') => {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
  return partes.length ? partes.slice(0, 2).map((p) => p[0]).join('').toUpperCase() : vacio;
};
