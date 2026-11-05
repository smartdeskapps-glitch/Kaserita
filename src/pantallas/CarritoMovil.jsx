// Celular: barra flotante del carrito y fondo detrás de la hoja del carrito.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';
import { formatoSoles } from '../pos/utilidades.js';
import { FotoProducto } from '../PanelAdminCompartido.jsx';
import { IconoTrazo } from '../pos/componentes.jsx';

export default function CarritoMovil({
  carrito, mostrarResumenMobile, setMostrarResumenMobile, totalConDescuento
}) {
  return (
    <>
      {/* Barra flotante del carrito (solo mobile, cuando hay productos y el panel está cerrado) */}
      {carrito.length > 0 && !mostrarResumenMobile && (() => {
        const unidades = carrito.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
        const unidadesTexto = Number.isInteger(unidades) ? String(unidades) : String(+unidades.toFixed(2));
        const ultimos = carrito.slice(-2);
        return (
          <>
            <div className="md:hidden fixed inset-x-0 bottom-0 h-28 z-30 pointer-events-none bg-gradient-to-t from-[#f8f9fd] via-[#f8f9fd]/70 to-transparent"></div>
            <button
              onClick={() => setMostrarResumenMobile(true)}
              aria-label={`Ver carrito: ${unidadesTexto} ${unidades === 1 ? 'producto' : 'productos'}, total S/ ${formatoSoles(totalConDescuento)}`}
              className="kz-pri kz-barra-carrito md:hidden !fixed left-3 right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 h-[66px] flex items-center justify-between gap-3 pl-3 pr-2.5"
            >
              <span className="flex items-center min-w-0">
                {/* Fotos de lo último que se agregó, apiladas */}
                <span className="flex items-center shrink-0 pr-1">
                  {ultimos.map((item, i) => (
                    <FotoProducto
                      key={item.claveCarrito || item.productoId}
                      fotoUrl={item.foto_url}
                      categoria={item.categoria}
                      className={`w-9 h-9 rounded-full ring-2 ring-white/90 bg-white shrink-0 ${i > 0 ? '-ml-3' : ''}`}
                      iconClassName="text-xs"
                    />
                  ))}
                  {carrito.length > 2 && (
                    <span className="-ml-3 w-9 h-9 rounded-full ring-2 ring-white/90 bg-[#2d284b] text-white text-[11px] font-bold tabular-nums flex items-center justify-center shrink-0">+{carrito.length - 2}</span>
                  )}
                </span>
                <span className="ml-2.5 text-left leading-tight min-w-0 whitespace-nowrap">
                  <span className="block font-bold text-[15px] tracking-tight">Ver carrito</span>
                  <span key={unidadesTexto} className="kz-barra-pop block text-[12px] text-stone-500 font-medium tabular-nums">{unidadesTexto} {unidades === 1 ? 'producto' : 'productos'}</span>
                </span>
              </span>
              <span className="flex items-center gap-2.5 shrink-0">
                <span className="text-right leading-tight">
                  <span className="block text-[11px] text-stone-500 font-medium">Total</span>
                  <span className="block font-bold text-[19px] tracking-tight tabular-nums"><small className="text-xs font-semibold opacity-80 mr-0.5">S/</small>{formatoSoles(totalConDescuento)}</span>
                </span>
                <span className="flex items-center justify-center w-11 h-11 rounded-full bg-[#5b4bd6] text-white shrink-0 shadow-[0_4px_10px_-4px_rgba(45,40,75,0.6)]">
                  <IconoTrazo nombre="bag" className="w-5 h-5 !text-white" />
                </span>
              </span>
            </button>
          </>
        );
      })()}

      {/* Panel Derecho: Resumen de Venta y Cobro (overlay en mobile, fijo en desktop) */}
      {/* Fondo semitransparente detrás de la hoja del carrito (solo mobile) */}
      {mostrarResumenMobile && (
        <div
          className="md:hidden fixed inset-0 bg-stone-900/40 z-40"
          onClick={() => setMostrarResumenMobile(false)}
        ></div>
      )}
    </>
  );
}
