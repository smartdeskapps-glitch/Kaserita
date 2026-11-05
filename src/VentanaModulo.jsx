import React from 'react';

const TONOS = { ok: 'text-[#0f7b4a]', mal: 'text-[#c0262d]', aviso: 'text-[#a8650a]' };

// Ventana común de los módulos (Fiados, Historial, Dashboard, Cajeros...): encabezado blanco
// y sobrio con icono, título, cifras clave y cerrar; debajo va el contenido del módulo.
// El velo lleva `ventana-riel` para que el riel quede encima y la ventana se centre a su lado.
export default function VentanaModulo({
  icono,
  titulo,
  subtitulo,
  cifras,
  acciones,
  izquierda,
  onClose,
  onFondo,
  ancho = 'max-w-5xl',
  alto = 'max-h-[92vh]',
  z = 'z-50',
  desplazable = true,
  children,
}) {
  const palabras = titulo.split(' ');
  const ultima = palabras.pop();
  const visibles = (cifras || []).filter(Boolean);
  return (
    <div className={`ventana-riel fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center ${z} p-2 sm:p-4`} onClick={onFondo}>
      <div onClick={onFondo ? (e) => e.stopPropagation() : undefined} className={`bg-white rounded-[26px] ${ancho} w-full ${alto} shadow-2xl flex flex-col overflow-hidden`}>
        <header className="shrink-0 px-4 sm:px-6 pt-4 pb-4 border-b border-[#eef1fd]">
          <div className="flex items-center gap-3">
            {izquierda}
            <span className={`w-[38px] h-[38px] rounded-xl bg-[#f1efff] text-[#5b4bd6] place-items-center shrink-0 ${izquierda ? 'hidden lg:grid' : 'grid'}`}>
              <i className={`fa-solid ${icono} text-[15px]`}></i>
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-[19px] leading-tight tracking-tight text-[#2d284b] truncate">
                {palabras.length > 0 && `${palabras.join(' ')} `}<b className="font-bold">{ultima}</b>
              </h3>
              {subtitulo && <p className="text-xs text-[#8f8cb0] mt-0.5 truncate">{subtitulo}</p>}
            </div>
            {acciones}
            <button type="button" aria-label="Cerrar" onClick={onClose} className="w-[34px] h-[34px] rounded-full text-[#8f8cb0] hover:bg-[#f3f5ff] hover:text-[#2d284b] grid place-items-center shrink-0 transition">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          {visibles.length > 0 && (
            <dl className="flex flex-wrap gap-y-2.5 mt-3.5 sm:pl-[50px]">
              {visibles.map((c, i) => (
                <div key={c.etiqueta} className={i === 0 ? 'pr-5 sm:pr-6' : 'px-5 sm:px-6 border-l border-[#dde4fa]'}>
                  <dt className="text-[11.5px] text-[#8f8cb0]">{c.etiqueta}</dt>
                  <dd className={`text-lg leading-snug font-bold tracking-tight tabular-nums ${TONOS[c.tono] || 'text-[#2d284b]'}`}>{c.valor}</dd>
                </div>
              ))}
            </dl>
          )}
        </header>
        <div className={`flex-1 min-h-0 flex flex-col ${desplazable ? 'overflow-y-auto' : ''}`}>{children}</div>
      </div>
    </div>
  );
}
