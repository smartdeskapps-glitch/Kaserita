import React from 'react';

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICONOS = {
  vender: <><path d="M5 8h14l-1 11a2 2 0 0 1-2 1.8H8A2 2 0 0 1 6 19L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  fiados: <><path d="M3 11h4l3 2h3a1.6 1.6 0 0 1 0 3.2H9.5" /><path d="M13 14.5 18.5 12a1.8 1.8 0 0 1 2 2.9L14 19.5 9.5 19H3" /><circle cx="15.5" cy="6.5" r="3" /></>,
  historial: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>,
  inventario: <><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4V3h6v1M9 13l2 2 4-4" /></>,
  dashboard: <><path d="M12 3v9h9a9 9 0 1 1-9-9Z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5Z" /></>,
};

// Riel de íconos pegado al borde izquierdo (solo escritorio). Cada opción abre la misma
// ventana que el menú "Más"; "Más" abre ese menú completo.
export default function RielLateral({ opciones, onMas }) {
  // Alto par (36 + 46 por opción, contando "Más") para que quede en píxeles enteros.
  const alto = 36 + 46 * (opciones.length + 1);
  const boton = (clave, etiqueta, contenido, onClick, activo) => (
    <button
      key={clave}
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      aria-current={activo ? 'page' : undefined}
      className={`riel-it ${activo ? 'riel-it-on' : ''}`}
    >
      {contenido}
      <span className="riel-tip">{etiqueta}</span>
    </button>
  );
  return (
    <nav className="riel-pos hidden md:flex" style={{ height: alto }} aria-label="Menú principal">
      {opciones.map((o) => boton(o.clave, o.etiqueta, <svg width="22" height="22" viewBox="0 0 24 24" {...trazo} aria-hidden="true">{ICONOS[o.clave]}</svg>, o.accion, o.activo))}
      <i className="riel-sep" />
      {boton('mas', 'Más opciones', <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="18" cy="12" r="1.8" /></svg>, onMas, false)}
    </nav>
  );
}
