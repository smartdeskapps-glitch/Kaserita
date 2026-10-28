import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function NuevoCliente({
  formCliente,
  handleGuardarNuevoCliente,
  modalNuevoCliente,
  setFormCliente,
  setModalNuevoCliente,
}) {
  return (
    <>
              {modalNuevoCliente && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-stone-900"><i className="fa-solid fa-user-plus mr-1.5"></i> Registrar cliente</h3>
                      <button aria-label="Cerrar" onClick={() => setModalNuevoCliente(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <form onSubmit={handleGuardarNuevoCliente} className="space-y-2.5">
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">DNI *</label>
                        <input
                          type="text"
                          required
                          value={formCliente.dni}
                          onChange={(e) => setFormCliente({ ...formCliente, dni: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Nombre completo *</label>
                        <input
                          type="text"
                          required
                          value={formCliente.nombre}
                          onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-stone-600 block mb-1">Teléfono</label>
                          <input
                            type="text"
                            value={formCliente.telefono}
                            onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })}
                            className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-stone-600 block mb-1">Correo</label>
                          <input
                            type="text"
                            value={formCliente.correo}
                            onChange={(e) => setFormCliente({ ...formCliente, correo: e.target.value })}
                            className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Límite de crédito (S/) *</label>
                        <input
                          type="number"
                          step="10"
                          required
                          value={formCliente.limiteCredito}
                          onChange={(e) => setFormCliente({ ...formCliente, limiteCredito: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-3 py-1.5 text-sm font-bold text-orange-600"
                        />
                      </div>
                      <button type="submit" className="w-full py-2.5 bg-[#5b4bd6] hover:bg-[#473bb5] text-white font-bold text-xs rounded-full shadow mt-2">
                        Guardar cliente
                      </button>
                    </form>
                  </div>
                </div>
              )}
    </>
  );
}
