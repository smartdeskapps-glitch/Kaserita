import React from 'react';
import { PIN_MAX } from './PanelAdminCompartido.jsx';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function PinCajero({
  guardandoPinCajero,
  guardarPinCajero,
  modalPinCajero,
  nuevoPinCajero,
  setModalPinCajero,
  setNuevoPinCajero,
}) {
  return (
    <>
              {/* Modal: cambiar el PIN de seguridad de un Administrador */}
              {modalPinCajero && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                  <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-xs w-full p-5 shadow-2xl space-y-3">
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <i className="fa-solid fa-key text-orange-600"></i> PIN de {modalPinCajero.nombre}
                    </h3>
                    <p className="text-xs text-stone-600">Se le va a pedir a cualquiera que elija a "{modalPinCajero.nombre}" al abrir turno.</p>
                    <input
                      type="text"
                      maxLength={PIN_MAX}
                      autoComplete="off"
                      autoFocus
                      value={nuevoPinCajero}
                      onChange={(e) => setNuevoPinCajero(e.target.value)}
                      placeholder="4 a 32 caracteres"
                      className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-center text-lg tracking-widest text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setModalPinCajero(null); setNuevoPinCajero(''); }}
                        className="flex-1 py-2 bg-white/70 text-stone-600 text-xs font-semibold rounded-full shadow-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={guardarPinCajero}
                        disabled={guardandoPinCajero}
                        className="flex-1 py-2 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow"
                      >
                        {guardandoPinCajero ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
    </>
  );
}
