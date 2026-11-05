// Avisos flotantes: notificación (toast), versión nueva, caja de un día anterior y modo sin conexión.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';
import { antiguedadTurno } from '../lib/turnos.js';

export default function AvisosSuperiores({
  abrirCierreCaja, avisoVersionOculto, enLinea, modalCierreCaja, setAvisoVersionOculto,
  sincronizandoVentas, sincronizarVentasPendientes, toast, turnoActivo, ventasPendientesSync,
  versionNueva
}) {
  return (
    <>
      {/* Toast */}
      {toast.visible && (
        <div className={`fixed top-[4.75rem] inset-x-4 md:top-4 md:inset-x-auto md:right-4 md:max-w-xs z-[100] pointer-events-none flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border-l-4 bg-white text-xs font-semibold ${toast.tipo === 'error' ? 'border-rose-500 text-rose-700' : 'border-emerald-500 text-emerald-700'}`}>
          <i className={`fa-solid ${toast.tipo === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-sm shrink-0`}></i>
          {toast.texto}
        </div>
      )}

      {versionNueva && !avisoVersionOculto && (
        <div role="status" className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:max-w-sm z-[95] flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-[#e6e9f5] shadow-2xl">
          <i className="fa-solid fa-rotate text-[#5b4bd6] shrink-0"></i>
          <p className="text-[13px] text-stone-700 leading-snug flex-1">Hay una versión nueva de Kaserita. Actualiza cuando termines esta venta.</p>
          <button type="button" onClick={() => window.location.reload()} className="kz-pri h-9 px-4 text-[13px] font-semibold shrink-0">Actualizar</button>
          <button type="button" aria-label="Ocultar aviso" onClick={() => setAvisoVersionOculto(true)} className="w-7 h-7 rounded-full text-stone-400 hover:text-stone-700 shrink-0"><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

      {/* Caja abierta de un día anterior: el cierre mezclaría las ventas de varios días */}
      {turnoActivo && !modalCierreCaja && antiguedadTurno(turnoActivo.fecha_apertura).antiguo && (
        <div className="fixed top-0 inset-x-0 z-[85] bg-amber-500 text-white text-xs font-semibold py-1.5 px-3 flex items-center justify-center gap-2 flex-wrap text-center" role="alert">
          <i className="fa-solid fa-triangle-exclamation"></i>
          Tu caja lleva abierta {antiguedadTurno(turnoActivo.fecha_apertura).etiqueta.replace('hace ', '')}: el cierre sumará las ventas de todos esos días.
          <button onClick={abrirCierreCaja} className="underline font-bold">Cerrar caja ahora</button>
        </div>
      )}

      {/* Aviso de modo offline / sincronización pendiente */}
      {(!enLinea || ventasPendientesSync.length > 0) && (
        <div className={`fixed top-0 inset-x-0 z-[90] text-center text-xs font-semibold py-1.5 px-3 flex items-center justify-center gap-2 ${!enLinea ? 'bg-stone-900 text-white' : 'bg-amber-500 text-white'}`}>
          {!enLinea ? (
            <><i className="fa-solid fa-wifi-slash"></i> Sin conexión — las ventas se guardan y se suben solas al volver el internet{ventasPendientesSync.length > 0 ? ` (${ventasPendientesSync.length} pendiente${ventasPendientesSync.length === 1 ? '' : 's'})` : ''}.</>
          ) : sincronizandoVentas ? (
            <><i className="fa-solid fa-arrows-rotate fa-spin"></i> Sincronizando {ventasPendientesSync.length} venta{ventasPendientesSync.length === 1 ? '' : 's'} pendiente{ventasPendientesSync.length === 1 ? '' : 's'}...</>
          ) : (
            <>
              <i className="fa-solid fa-triangle-exclamation"></i> {ventasPendientesSync.length} venta{ventasPendientesSync.length === 1 ? '' : 's'} sin sincronizar.
              <button onClick={sincronizarVentasPendientes} className="underline font-bold">Reintentar ahora</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
