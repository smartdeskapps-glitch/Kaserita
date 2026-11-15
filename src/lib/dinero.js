// Un solo formateador de soles para toda la app: "1,234.50" (el Intl se crea una vez porque
// crear uno nuevo en cada llamada era de lo más caro al dibujar listas).
export const FMT_SOLES = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatoSoles = (n) => FMT_SOLES.format(Number(n || 0));
// Con el símbolo: "S/ 1,234.50".
export const dinero = (n) => `S/ ${formatoSoles(n)}`;
