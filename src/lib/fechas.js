// Fecha local en formato AAAA-MM-DD. No usa toISOString(): eso convierte a UTC
// y en Perú (UTC-5) desde ~7pm hora local ya es "mañana" en UTC, así que "Hoy"
// mostraba la fecha equivocada (las ventas del día desaparecían del historial).
// Se arma la fecha con los componentes locales del Date.
export const fechaISOLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const fechaHoyISO = () => fechaISOLocal(new Date());
