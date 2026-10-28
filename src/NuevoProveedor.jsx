import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function NuevoProveedor({
  formProveedor,
  handleGuardarNuevoProveedor,
  modalNuevoProveedor,
  setFormProveedor,
  setModalNuevoProveedor,
}) {
  return (
    <>
              {/* Modal: Nuevo Proveedor */}
              {modalNuevoProveedor && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-stone-900"><i className="fa-solid fa-truck mr-1.5"></i> Nuevo Proveedor</h3>
                      <button aria-label="Cerrar" onClick={() => setModalNuevoProveedor(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <form onSubmit={handleGuardarNuevoProveedor} className="space-y-2.5">
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Nombre *</label>
                        <input
                          type="text"
                          required
                          value={formProveedor.nombre}
                          onChange={(e) => setFormProveedor({ ...formProveedor, nombre: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-stone-600 block mb-1">RUC</label>
                          <input
                            type="text"
                            value={formProveedor.ruc}
                            onChange={(e) => setFormProveedor({ ...formProveedor, ruc: e.target.value })}
                            className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-stone-600 block mb-1">Teléfono</label>
                          <input
                            type="text"
                            value={formProveedor.telefono}
                            onChange={(e) => setFormProveedor({ ...formProveedor, telefono: e.target.value })}
                            className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Deuda inicial (S/, opcional)</label>
                        <input
                          type="number"
                          step="1.00"
                          placeholder="0.00"
                          value={formProveedor.saldoInicial}
                          onChange={(e) => setFormProveedor({ ...formProveedor, saldoInicial: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white font-bold text-xs rounded-full shadow"
                      >
                        Guardar proveedor
                      </button>
                    </form>
                  </div>
                </div>
              )}
    </>
  );
}
