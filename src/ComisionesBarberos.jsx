import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function ComisionesBarberos({
  cargandoComisiones,
  cargarComisiones,
  combos,
  esBarberia,
  filasComisiones,
  modalComisiones,
  periodoComisiones,
  productos,
  setModalComisiones,
  setPeriodoComisiones,
}) {
  return (
    <>
              {/* Modal: Comisiones de barberos (solo cuentas de barbería) */}
              {modalComisiones && esBarberia && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-white border border-stone-200 rounded-[28px] max-w-lg w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2 shrink-0">
                      <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2"><i className="fa-solid fa-percent text-[#6105dc]"></i> Comisiones de barberos</h3>
                      <button aria-label="Cerrar" onClick={() => setModalComisiones(false)} className="text-stone-600 hover:text-stone-900 shrink-0"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <div className="px-5 pb-3 flex gap-1.5 shrink-0">
                      {[['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes']].map(([valor, etiqueta]) => (
                        <button
                          key={valor}
                          onClick={() => { setPeriodoComisiones(valor); cargarComisiones(valor); }}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${periodoComisiones === valor ? 'bg-[#6105dc] text-white' : 'bg-[#f4eefe] text-[#4d04b0] hover:bg-[#ece0fd]'}`}
                        >
                          {etiqueta}
                        </button>
                      ))}
                    </div>
                    <div className="px-5 pb-4 overflow-y-auto space-y-2">
                      {cargandoComisiones ? (
                        <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
                      ) : filasComisiones.length === 0 ? (
                        <p className="text-xs text-stone-500 text-center py-6">Sin barberos o sin ventas en este período.</p>
                      ) : (
                        <>
                          {filasComisiones.map((f) => (
                            <div key={f.id} className="p-3 bg-stone-50 border border-stone-200 rounded-2xl">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm font-bold text-stone-900">{f.nombre}</p>
                                {f.esDueno
                                  ? <p className="text-xs font-semibold text-stone-500">Dueño · sin comisión</p>
                                  : <p className="text-sm font-extrabold text-[#4d04b0] tabular-nums">Comisión S/ {f.comision.toFixed(2)}</p>}
                              </div>
                              <p className="text-xs text-stone-500 mt-1">
                                {f.atenciones} {f.atenciones === 1 ? 'atención' : 'atenciones'}
                              </p>
                              <p className="text-xs text-stone-500">
                                Cortes y servicios S/ {f.servicios.toFixed(2)}{f.esDueno ? '' : ` × ${f.pct}% = S/ ${f.comisionServicios.toFixed(2)}`}
                              </p>
                              <p className="text-xs text-stone-500">
                                Productos S/ {f.productos.toFixed(2)}{f.esDueno ? '' : ` × ${f.pctProductos}% = S/ ${f.comisionProductos.toFixed(2)}`}
                              </p>
                              {f.insumosCombo > 0 && (
                                <p className="text-xs text-stone-400">Productos dentro de combos S/ {f.insumosCombo.toFixed(2)} (sin comisión)</p>
                              )}
                            </div>
                          ))}
                          <div className="flex items-baseline justify-between gap-2 px-1 pt-1 text-sm font-bold text-stone-900">
                            <span>Total a pagar en comisiones</span>
                            <span className="tabular-nums">S/ {filasComisiones.reduce((a, f) => a + f.comision, 0).toFixed(2)}</span>
                          </div>
                          <p className="text-[11px] text-stone-500">Cada barbero tiene un % por cortes y servicios y otro por productos. Se cambian en "Barberos".</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
    </>
  );
}
