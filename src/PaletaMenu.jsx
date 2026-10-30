import React, { useEffect, useRef } from 'react';

const TONOS = {
  claro: { primario: 'bg-[#5b4bd6] text-white', rose: 'bg-rose-100 text-rose-600', amber: 'bg-amber-50 text-amber-600' },
  oscuro: { primario: 'bg-[#9687f5] text-white', rose: 'bg-[#ffb3c0]/15 text-[#ffb3c0]', amber: 'bg-amber-300/15 text-amber-200' },
};

// Sin tildes ni mayúsculas para que "inventario" encuentre "Mercadería", etc.
const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Paleta de comandos del menú "Más": buscador arriba, opciones agrupadas y navegación con
// teclado (↑ ↓ Enter Esc). Las opciones son datos para que el buscador y el teclado
// trabajen sobre la misma lista. `oscuro` es la versión que vive dentro del riel de escritorio;
// la clara es la hoja del celular.
export default function PaletaMenu({ opciones, busqueda, setBusqueda, indice, setIndice, onClose, oscuro, autoFocus }) {
  const q = normalizar(busqueda).trim();
  const visibles = q ? opciones.filter((o) => normalizar(`${o.etiqueta} ${o.grupo} ${o.buscar || ''}`).includes(q)) : opciones;
  const activo = Math.min(indice, Math.max(visibles.length - 1, 0));
  const ejecutar = (o) => { if (!o) return; o.accion(); onClose(); };
  const tonos = TONOS[oscuro ? 'oscuro' : 'claro'];

  // Solo se desplaza la lista cuando se navega con el teclado (con el mouse no debe saltar).
  const porTeclado = useRef(false);
  const filaActiva = useRef(null);
  useEffect(() => {
    if (porTeclado.current) { filaActiva.current?.scrollIntoView({ block: 'nearest' }); porTeclado.current = false; }
  }, [activo]);

  const alTeclear = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); porTeclado.current = true; setIndice(Math.min(activo + 1, visibles.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); porTeclado.current = true; setIndice(Math.max(activo - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); ejecutar(visibles[activo]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const kbd = oscuro ? 'bg-white/10 text-white/75 rounded-md px-1.5 py-0.5 font-bold' : 'bg-white border border-[#dde4fa] text-[#6b6890] rounded-md px-1.5 py-0.5 font-bold';

  return (
    <div className={`flex flex-col min-h-0 ${oscuro ? 'h-full text-white' : 'flex-1'}`} onKeyDown={alTeclear}>
      <div className={oscuro
        ? 'mx-3 mt-3 mb-1 h-[46px] flex items-center gap-2.5 px-4 rounded-full border-[1.5px] border-white/20 bg-white/5 focus-within:border-[#c5bcff] transition shrink-0'
        : 'flex items-center gap-3 px-5 py-3.5 border-b border-[#dde4fa]'}
      >
        <i className={`fa-solid fa-magnifying-glass text-sm ${oscuro ? 'text-[#c5bcff]' : 'text-[#5b4bd6]'}`}></i>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setIndice(0); }}
          placeholder="Buscar una opción..."
          autoFocus={autoFocus}
          className={`flex-1 min-w-0 bg-transparent text-[15px] font-semibold focus:outline-none ${oscuro ? 'text-white placeholder:text-white/50' : 'text-[#2d284b] placeholder:text-[#9a98bd]'}`}
        />
        {oscuro && <kbd className={`text-[10px] ${kbd}`}>Esc</kbd>}
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain hide-scrollbar ${oscuro ? 'px-2.5 pb-2' : 'p-2 pb-[max(1rem,env(safe-area-inset-bottom))]'}`}>
        {visibles.length === 0 && (
          <p className={`text-center text-sm py-10 ${oscuro ? 'text-white/60' : 'text-stone-500'}`}>Sin resultados para "{busqueda}"</p>
        )}
        {visibles.map((o, i) => {
          const esActivo = i === activo;
          const colorTexto = o.tono === 'rose' ? (oscuro ? 'text-[#ffb3c0] font-semibold' : 'text-rose-600 font-semibold') : (oscuro ? 'text-white font-semibold' : 'text-[#2d284b] font-semibold');
          return (
            <React.Fragment key={`${o.grupo}-${o.etiqueta}`}>
              {o.grupo && o.grupo !== visibles[i - 1]?.grupo && (
                <p className={`px-3 pt-3.5 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] ${oscuro ? 'text-white/45' : 'text-[#8d8ab0]'}`}>{o.grupo}</p>
              )}
              <button
                ref={esActivo ? filaActiva : undefined}
                onClick={() => ejecutar(o)}
                onMouseEnter={() => setIndice(i)}
                className={`w-full text-left px-3 py-2 rounded-2xl flex items-center gap-3 text-sm transition-colors ${oscuro
                  ? `border-[1.5px] ${esActivo ? 'bg-white/10 border-white/15' : 'border-transparent'}`
                  : `border ${esActivo ? 'menu-it-on border-[#c5bcff]' : 'border-transparent'}`} ${colorTexto}`}
              >
                <span className={`menu-ic w-8 h-8 rounded-[11px] flex items-center justify-center shrink-0 ${tonos[o.tono] || (oscuro ? 'bg-white/10 text-[#c5bcff]' : 'bg-[#ebf0ff] text-[#5b4bd6]')}`}>
                  <i className={`fa-solid ${o.icono} text-[13px]`}></i>
                </span>
                <span className="flex-1 min-w-0 truncate">{o.etiqueta}</span>
                {o.insignia && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{o.insignia}</span>}
                {oscuro && esActivo && <kbd className={`text-[10px] ${kbd}`}>↵</kbd>}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {oscuro && (
        <div className="flex items-center gap-4 px-4 py-3 text-[11px] font-medium text-white/50 shrink-0">
          <span className="flex items-center gap-1.5"><kbd className={kbd}>↑↓</kbd> Navegar</span>
          <span className="flex items-center gap-1.5"><kbd className={kbd}>↵</kbd> Abrir</span>
          <span className="flex items-center gap-1.5"><kbd className={kbd}>Esc</kbd> Cerrar</span>
        </div>
      )}
    </div>
  );
}
