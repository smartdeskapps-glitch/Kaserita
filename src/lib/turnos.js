// Antigüedad de un turno de caja. Una caja que sigue abierta días después hace
// que el arqueo mezcle las ventas de todos esos días (pasó en la demo: una caja
// del 24/09 seguía abierta el 5/10 y el cierre sumó 11 días). A partir de 24
// horas se considera "antigua" y la app avisa para que se cierre.
export const LIMITE_HORAS_TURNO = 24;

export const antiguedadTurno = (fechaApertura, ahora = new Date()) => {
  const inicio = fechaApertura ? new Date(fechaApertura) : null;
  if (!inicio || Number.isNaN(inicio.getTime())) {
    return { valida: false, horas: 0, dias: 0, antiguo: false, etiqueta: '' };
  }
  const ms = Math.max(0, ahora.getTime() - inicio.getTime());
  const horas = Math.floor(ms / 3600000);
  const dias = Math.floor(horas / 24);
  const antiguo = horas >= LIMITE_HORAS_TURNO;
  let etiqueta;
  if (horas < 1) etiqueta = 'hace menos de 1 hora';
  else if (!antiguo) etiqueta = `hace ${horas} hora${horas === 1 ? '' : 's'}`;
  else etiqueta = `hace ${dias} día${dias === 1 ? '' : 's'}`;
  return { valida: true, horas, dias, antiguo, etiqueta };
};
