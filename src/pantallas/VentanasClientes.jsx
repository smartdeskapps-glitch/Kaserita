// Ventanas de clientes del POS: buscar/elegir cliente y registrar uno nuevo.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React, { Suspense } from 'react';
import { formatoSoles } from '../pos/utilidades.js';
import { NuevoCliente } from '../pos/perezosos.js';

export default function VentanasClientes({
  busquedaClientePOS, cargandoClientes, clientesFiltradosPOS, formCliente,
  handleGuardarNuevoCliente, modalBuscarCliente, modalNuevoCliente, seleccionarClientePOS,
  setBusquedaClientePOS, setFormCliente, setModalBuscarCliente, setModalNuevoCliente
}) {
  return (
    <>
      {/* Modal: Nuevo Cliente con Límite de Crédito */}
      {/* Modal: Buscar/Seleccionar Cliente (POS) */}
      {modalBuscarCliente && (
        <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2"><span className="w-8 h-8 rounded-xl bg-[#dde4fa] text-[#5b4bd6] flex items-center justify-center text-sm"><i className="fa-solid fa-user"></i></span> Seleccionar cliente</h3>
              <button aria-label="Cerrar" onClick={() => setModalBuscarCliente(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <input
              type="text"
              autoFocus
              value={busquedaClientePOS}
              onChange={(e) => setBusquedaClientePOS(e.target.value)}
              placeholder="Buscar por nombre o DNI..."
              className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-4 py-2 text-sm text-stone-900 shrink-0 focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
            />
            <div className="flex-1 overflow-y-auto hide-scrollbar -mx-1 px-1 space-y-2">
              <button
                onClick={() => seleccionarClientePOS({ dni: '99999999', nombre_completo: 'Cliente sin registrar', saldo_actual: 0 })}
                className="w-full text-left px-4 py-3 bg-white/60 hover:bg-[#ebf0ff] backdrop-blur-xl border border-white/80 rounded-2xl shadow-sm transition"
              >
                <p className="text-sm font-semibold text-stone-900">Cliente sin registrar</p>
                <p className="text-xs text-stone-500">Sin DNI registrado</p>
              </button>
              {cargandoClientes ? (
                <p className="text-xs text-stone-500 text-center py-4">Cargando clientes...</p>
              ) : clientesFiltradosPOS().length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-4">No se encontraron clientes.</p>
              ) : (
                clientesFiltradosPOS().map((c) => (
                  <button
                    key={c.id}
                    onClick={() => seleccionarClientePOS(c)}
                    className="w-full text-left px-4 py-3 bg-white/60 hover:bg-[#ebf0ff] backdrop-blur-xl border border-white/80 rounded-2xl shadow-sm transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-stone-900 truncate">{c.nombre_completo}</p>
                      {Number(c.saldo_actual) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-xs font-bold text-rose-600 shrink-0 whitespace-nowrap">S/ {formatoSoles(Number(c.saldo_actual))}</span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500">DNI/RUC: {c.dni}</p>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => { setModalBuscarCliente(false); setModalNuevoCliente(true); }}
              className="shrink-0 w-full py-2 text-xs font-semibold text-[#5b4bd6] hover:underline"
            >
              + Registrar cliente nuevo
            </button>
          </div>
        </div>
      )}

      {modalNuevoCliente && (
        <Suspense fallback={null}>
          <NuevoCliente
            formCliente={formCliente}
            handleGuardarNuevoCliente={handleGuardarNuevoCliente}
            setFormCliente={setFormCliente}
            setModalNuevoCliente={setModalNuevoCliente}
          />
        </Suspense>
      )}
    </>
  );
}
