import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function CuentasPagar({
  modalCuentasPagar,
  montoMovimientoProveedor,
  proveedorSeleccionado,
  proveedoresLista,
  registrarMovimientoProveedor,
  setModalCuentasPagar,
  setModalNuevoProveedor,
  setMontoMovimientoProveedor,
  setProveedorSeleccionado,
}) {
  return (
    <>
              {/* Modal: Cuentas por Pagar (proveedores) */}
              {modalCuentasPagar && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full p-5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                        <i className="fa-solid fa-file-invoice text-orange-600"></i> Cuentas por Pagar
                      </h3>
                      <button aria-label="Cerrar" onClick={() => setModalCuentasPagar(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                    </div>

                    {proveedorSeleccionado ? (
                      <div className="p-3 bg-stone-50 rounded-xl border border-amber-500/40 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                            <i className="fa-solid fa-truck-field text-orange-600"></i> {proveedorSeleccionado.nombre}
                          </span>
                          <button onClick={() => setProveedorSeleccionado(null)} className="text-xs text-stone-600 underline">Cambiar</button>
                        </div>
                        <div className="text-xs">
                          {proveedorSeleccionado.ruc && <p className="text-stone-600">RUC: {proveedorSeleccionado.ruc}</p>}
                          {proveedorSeleccionado.telefono && <p className="text-stone-600">Tel: {proveedorSeleccionado.telefono}</p>}
                          <p className="text-rose-600 font-bold mt-1 text-sm">Le debemos: S/ {Number(proveedorSeleccionado.saldo_actual).toFixed(2)}</p>
                        </div>

                        <div>
                          <label className="text-xs text-stone-600 block mb-1">Monto (S/):</label>
                          <input
                            type="number"
                            step="1.00"
                            placeholder="0.00"
                            value={montoMovimientoProveedor}
                            onChange={(e) => setMontoMovimientoProveedor(e.target.value)}
                            className="w-full bg-stone-100 border border-stone-200 rounded-lg p-2 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => registrarMovimientoProveedor('deuda')}
                            className="py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl border border-stone-300 flex items-center justify-center gap-1.5"
                          >
                            <i className="fa-solid fa-plus"></i> Agregar Deuda
                          </button>
                          <button
                            onClick={() => registrarMovimientoProveedor('pago')}
                            className="py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1.5"
                          >
                            <i className="fa-solid fa-check"></i> Registrar Pago
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto space-y-1.5">
                        {proveedoresLista.length === 0 ? (
                          <p className="text-xs text-stone-600 text-center py-6">Aún no registras proveedores.</p>
                        ) : (
                          proveedoresLista.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => { setProveedorSeleccionado(p); setMontoMovimientoProveedor(''); }}
                              className="flex justify-between items-center p-2.5 bg-stone-50 hover:bg-stone-200 border border-stone-200 rounded-xl cursor-pointer transition"
                            >
                              <div>
                                <p className="text-xs font-bold text-stone-800">{p.nombre}</p>
                                {p.ruc && <p className="text-xs text-stone-600">RUC: {p.ruc}</p>}
                              </div>
                              <span className={`text-sm font-black ${Number(p.saldo_actual) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                S/ {Number(p.saldo_actual).toFixed(2)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {!proveedorSeleccionado && (
                      <button
                        onClick={() => setModalNuevoProveedor(true)}
                        className="w-full py-2 bg-white/70 hover:bg-[#ece0fd] text-stone-600 font-bold text-xs rounded-full border border-stone-300 border-dashed flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <i className="fa-solid fa-plus"></i> Nuevo Proveedor
                      </button>
                    )}
                  </div>
                </div>
              )}
    </>
  );
}
