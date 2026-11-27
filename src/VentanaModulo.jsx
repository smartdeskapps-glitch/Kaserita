import React from 'react';
import { createPortal } from 'react-dom';
import { usePestanas, registrarPestana, actualizarPestana, activarPestana } from './pos/pestanas.js';

const TONOS = { ok: 'text-[#0f7b4a]', mal: 'text-[#c0262d]', aviso: 'text-[#a8650a]' };

// Mismo corte que el menú de escritorio (md = 768 px).
const CONSULTA_ANCHA = '(min-width: 768px)';
function useEsAncho() {
  const [ancho, setAncho] = React.useState(() => typeof window !== 'undefined' && window.matchMedia(CONSULTA_ANCHA).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(CONSULTA_ANCHA);
    const alCambiar = () => setAncho(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return ancho;
}

// Ventana común de los módulos (Fiados, Historial, Dashboard, Cajeros...): encabezado blanco
// y sobrio con icono, título, cifras clave y cerrar; debajo va el contenido del módulo.
// En PC (md o más) el módulo se abre dentro del área de la venta (#zona-modulo, en Catalogo) como
// una pestaña: el carrito sigue a la derecha y se puede cambiar entre módulos sin perder lo
// que había en cada uno. En celular, o con `flotante` (flujos de varios pasos como la toma de
// inventario), sigue siendo una ventana que flota sobre la pantalla.
export default function VentanaModulo({
  icono,
  titulo,
  tituloCorto,
  subtitulo,
  cifras,
  acciones,
  izquierda,
  onClose,
  onFondo,
  ancho = 'max-w-5xl',
  alto = 'max-h-[92dvh]',
  z = 'z-50',
  desplazable = true,
  flotante = false,
  children,
}) {
  const palabras = titulo.split(' ');
  const ultima = palabras.pop();
  const visibles = (cifras || []).filter(Boolean);

  const esAncho = useEsAncho();
  const host = !flotante && esAncho && typeof document !== 'undefined' ? document.getElementById('zona-modulo') : null;
  const enHost = !!host;
  const id = React.useId();
  const cerrarRef = React.useRef(onClose);
  cerrarRef.current = onClose;
  const { activa } = usePestanas();

  React.useLayoutEffect(() => {
    if (!enHost) return undefined;
    return registrarPestana({ id, titulo: tituloCorto || titulo, icono, cerrar: () => cerrarRef.current && cerrarRef.current() });
  }, [enHost, id]); // eslint-disable-line
  React.useEffect(() => {
    if (enHost) actualizarPestana(id, { titulo: tituloCorto || titulo, icono });
  }, [enHost, id, titulo, tituloCorto, icono]);

  const cabecera = (
    <header className={`shrink-0 px-4 sm:px-6 pt-4 pb-4 max-md:pt-3 max-md:pb-3 border-b border-[#eef1fd]`}>
      <div className="flex items-center gap-3">
        {izquierda}
        <span className={`w-[38px] h-[38px] rounded-xl bg-[#f1efff] text-[#5b4bd6] place-items-center shrink-0 max-md:hidden ${izquierda ? 'hidden lg:grid' : 'grid'}`}>
          <i className={`fa-solid ${icono} text-[15px]`}></i>
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[19px] leading-tight tracking-tight text-[#2d284b] truncate">
            {/* tituloCorto: en celular, donde el encabezado va apretado, se muestra esta versión. */}
            {tituloCorto && <b className="font-bold md:hidden">{tituloCorto}</b>}
            <span className={tituloCorto ? 'max-md:hidden' : undefined}>
              {palabras.length > 0 && `${palabras.join(' ')} `}<b className="font-bold">{ultima}</b>
            </span>
          </h3>
          {subtitulo && <p className="text-xs text-[#8f8cb0] mt-0.5 truncate">{subtitulo}</p>}
        </div>
        {acciones}
        {enHost && (
          <button type="button" onClick={() => activarPestana(null)} className="gst-press h-[34px] px-3.5 rounded-full bg-[#f3f5ff] hover:bg-[#e6ebff] text-[12.5px] font-bold text-[#6b6890] inline-flex items-center gap-2 shrink-0 transition-colors">
            <i className="fa-solid fa-arrow-left text-[10px]"></i>Volver a la venta
          </button>
        )}
        <button type="button" aria-label="Cerrar" onClick={onClose} className="w-[34px] h-[34px] max-md:w-10 max-md:h-10 rounded-full text-[#8f8cb0] hover:bg-[#f3f5ff] hover:text-[#2d284b] grid place-items-center shrink-0 transition">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      {/* En celular las cifras van en una sola fila compacta (el encabezado pasa de ~131 a ~100 px). */}
      {visibles.length > 0 && (
        <dl className="flex flex-wrap gap-y-2.5 mt-3.5 sm:pl-[50px] max-md:mt-2 max-md:gap-y-1 max-md:flex-nowrap max-md:overflow-x-auto hide-scrollbar">
          {visibles.map((c, i) => (
            <div key={c.etiqueta} className={`shrink-0 ${i === 0 ? 'pr-5 sm:pr-6 max-md:pr-3.5' : 'px-5 sm:px-6 max-md:px-3.5 border-l border-[#dde4fa]'}`}>
              <dt className="text-[11.5px] text-[#8f8cb0] whitespace-nowrap">{c.etiqueta}</dt>
              <dd className={`text-lg max-md:text-[15px] leading-snug font-bold tracking-tight tabular-nums whitespace-nowrap ${TONOS[c.tono] || 'text-[#2d284b]'}`}>{c.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
  const cuerpo = <div className={`flex-1 min-h-0 flex flex-col ${desplazable ? 'overflow-y-auto' : ''}`}>{children}</div>;

  if (enHost) {
    // Dentro del área de la venta: ocupa todo el alto, el ancho del módulo queda centrado y solo la
    // pestaña activa se ve (las demás siguen montadas, con su estado).
    return createPortal(
      <div className={`${activa === id ? 'flex vista-modulo-entra' : 'hidden'} absolute inset-0 justify-center pointer-events-auto`}>
        <div className={`bg-white rounded-2xl ${ancho} w-full h-full shadow-sm flex flex-col overflow-hidden`}>
          {cabecera}
          {cuerpo}
        </div>
      </div>,
      host
    );
  }

  return (
    <div className={`pantalla-movil fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center ${z} p-2 sm:p-4`} onClick={onFondo}>
      <div onClick={onFondo ? (e) => e.stopPropagation() : undefined} className={`pantalla-movil-panel bg-white rounded-[26px] ${ancho} w-full ${alto} shadow-2xl flex flex-col overflow-hidden`}>
        {cabecera}
        {cuerpo}
      </div>
    </div>
  );
}
