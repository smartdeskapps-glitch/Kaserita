import React from 'react';
import { usePestanas, activarPestana } from './pos/pestanas.js';

// Barra de pestañas de la pantalla de venta (solo PC): «Venta» siempre está; cada módulo abierto
// es otra pestaña con su ✕. Esc vuelve a la venta sin cerrar los módulos.
export default function PestanasModulos() {
  const { tabs, activa } = usePestanas();

  React.useEffect(() => {
    if (!tabs.length) return undefined;
    const alTeclear = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !activa) return;
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      // Hay otra ventana (flotante, menú, escáner) por encima: Esc es para ella.
      if (document.querySelector('div.fixed.inset-0')) return;
      activarPestana(null);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [tabs.length, activa]);

  if (!tabs.length) return null;
  return (
    <div role="tablist" aria-label="Venta y módulos abiertos" className="hidden md:flex items-center gap-1.5 mx-3 md:mx-4 mt-1 -mb-1 overflow-x-auto hide-scrollbar shrink-0">
      <button
        type="button"
        role="tab"
        aria-selected={!activa}
        onClick={() => activarPestana(null)}
        className={`gst-press shrink-0 h-9 px-4 rounded-full text-[13px] font-bold inline-flex items-center gap-2 ${!activa ? 'bg-[#2d284b] text-white' : 'bg-white text-[#6b6890] hover:bg-[#f3f5ff]'}`}
      >
        <i className="fa-solid fa-cart-shopping text-[11px]"></i>Venta
      </button>
      {tabs.map((t) => (
        <span
          key={t.id}
          role="tab"
          aria-selected={activa === t.id}
          className={`pestana-entra shrink-0 h-9 pl-3.5 pr-1.5 rounded-full text-[13px] font-bold inline-flex items-center gap-2 transition-colors duration-150 ${activa === t.id ? 'bg-[#2d284b] text-white' : 'bg-white text-[#6b6890] hover:bg-[#f3f5ff]'}`}
        >
          <button type="button" onClick={() => activarPestana(t.id)} className="gst-press inline-flex items-center gap-2 h-full">
            <i className={`fa-solid ${t.icono} text-[11px] shrink-0 ${activa === t.id ? 'text-[#c5bcff]' : 'text-[#5b4bd6]'}`}></i>
            <span className="truncate max-w-[130px]">{t.titulo}</span>
          </button>
          <button
            type="button"
            onClick={() => t.cerrar()}
            aria-label={`Cerrar ${t.titulo}`}
            className={`gst-press w-6 h-6 rounded-full grid place-items-center ${activa === t.id ? 'hover:bg-white/15' : 'hover:bg-[#e6ebff]'}`}
          >
            <i className="fa-solid fa-xmark text-[10px]"></i>
          </button>
        </span>
      ))}
    </div>
  );
}
