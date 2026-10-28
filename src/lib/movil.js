// iPhone (Safari) agranda la página sola al tocar un campo de texto cuya letra
// mide menos de 16 px, y el POS queda descuadrado hasta que se aleja el zoom.
// Sin limitar el zoom de la persona (no se toca el meta viewport), a los campos
// chicos se les sube la letra a 16 px justo antes de recibir el foco, solo en
// pantallas de celular.
const ES_CAMPO = /^(INPUT|SELECT|TEXTAREA)$/;
const TIPOS_SIN_TEXTO = /^(checkbox|radio|range|button|submit|reset|file|color|image)$/;

export const campoNecesitaLetraGrande = (campo, anchoPantalla, tamanoLetraPx) => {
  if (!campo || !ES_CAMPO.test(campo.tagName || '')) return false;
  if (anchoPantalla >= 768) return false;
  if (campo.type && TIPOS_SIN_TEXTO.test(campo.type)) return false;
  return tamanoLetraPx < 16;
};

export const evitarZoomEnCampos = () => {
  if (typeof document === 'undefined') return () => {};
  const revisar = (e) => {
    const campo = e.target;
    if (!campo || !campo.tagName) return;
    const letra = parseFloat(window.getComputedStyle(campo).fontSize) || 16;
    if (campoNecesitaLetraGrande(campo, window.innerWidth, letra)) campo.style.fontSize = '16px';
  };
  // pointerdown llega antes que el foco: así la letra ya es grande cuando iOS decide hacer zoom.
  document.addEventListener('pointerdown', revisar, true);
  document.addEventListener('focusin', revisar, true);
  return () => {
    document.removeEventListener('pointerdown', revisar, true);
    document.removeEventListener('focusin', revisar, true);
  };
};
