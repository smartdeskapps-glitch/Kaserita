import React from 'react';
import { PIN_MAX, PIN_MIN_DUENO } from './PanelAdminCompartido.jsx';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function PinDueno({
  cambiandoPinDueno,
  cambiarPinDueno,
  formPinDueno,
  modalPinDueno,
  setFormPinDueno,
  setModalPinDueno,
}) {
  return (
    <>
              {/* Modal: cambiar el PIN de acceso de la cuenta del dueño */}
              {modalPinDueno && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                  <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-xs w-full p-5 shadow-2xl space-y-3">
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <i className="fa-solid fa-key text-orange-600"></i> Cambiar mi PIN de acceso
                    </h3>
                    <p className="text-xs text-stone-600">
                      Es el PIN con el que entras a Kaserita. Usa {PIN_MIN_DUENO} caracteres o más, mezclando letras y números.
                    </p>
                    {[['actual', 'PIN actual'], ['nuevo', 'PIN nuevo'], ['repetir', 'Repite el PIN nuevo']].map(([campo, etiqueta]) => (
                      <input
                        key={campo}
                        type="password"
                        maxLength={PIN_MAX}
                        autoComplete="off"
                        value={formPinDueno[campo]}
                        onChange={(e) => setFormPinDueno((f) => ({ ...f, [campo]: e.target.value }))}
                        placeholder={etiqueta}
                        className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                      />
                    ))}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setModalPinDueno(false); setFormPinDueno({ actual: '', nuevo: '', repetir: '' }); }}
                        className="flex-1 py-2 bg-white/70 text-stone-600 text-xs font-semibold rounded-full shadow-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={cambiarPinDueno}
                        disabled={cambiandoPinDueno || !formPinDueno.actual.trim() || !formPinDueno.nuevo.trim()}
                        className="flex-1 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-xs font-bold rounded-full"
                      >
                        {cambiandoPinDueno ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
    </>
  );
}
