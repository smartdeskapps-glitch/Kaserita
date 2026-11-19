// Recorte del QR de Yape/Plin: la dueña sube la imagen completa (con el logo, el nombre, el fondo de
// color...) y en el cobro solo debe verse el código. Esta parte es solo geometría, sin pantalla.

// A partir de las cuatro esquinas que devuelve el lector de códigos, calcula el cuadrado que contiene
// el QR: centrado en él y sin salirse de la imagen. Devuelve { x, y, lado } en píxeles, o null si no
// hay esquinas válidas.
export function cajaDelQR(posicion, ancho, alto) {
  const esquinas = posicion ? [posicion.topLeft, posicion.topRight, posicion.bottomRight, posicion.bottomLeft] : [];
  if (esquinas.length !== 4 || esquinas.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const xs = esquinas.map((p) => p.x);
  const ys = esquinas.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const lado = Math.min(Math.max(maxX - minX, maxY - minY), ancho, alto);
  if (!(lado > 0)) return null;
  const x = Math.min(Math.max(0, (minX + maxX) / 2 - lado / 2), ancho - lado);
  const y = Math.min(Math.max(0, (minY + maxY) / 2 - lado / 2), alto - lado);
  return { x, y, lado };
}
