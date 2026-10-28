import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function AgendaCitas({
  ajustarDuracionCita,
  cargandoAgenda,
  cargarAgenda,
  citasAgenda,
  esBarberia,
  fechaAgenda,
  modalAgenda,
  setFechaAgenda,
  setModalAgenda,
}) {
  return (
    <>
              {/* Modal: agenda de citas por día (solo cuentas de barbería) */}
              {modalAgenda && esBarberia && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-white border border-stone-200 rounded-[28px] max-w-lg w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2 shrink-0">
                      <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2"><i className="fa-solid fa-calendar-days text-[#6105dc]"></i> Agenda de citas</h3>
                      <button aria-label="Cerrar" onClick={() => setModalAgenda(false)} className="text-stone-600 hover:text-stone-900 shrink-0"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <div className="px-5 pb-3 shrink-0">
                      <input
                        type="date"
                        value={fechaAgenda}
                        onChange={(e) => { setFechaAgenda(e.target.value); cargarAgenda(e.target.value); }}
                        className="px-3 py-1.5 border border-stone-200 rounded-xl text-xs text-stone-800 bg-white"
                      />
                    </div>
                    <div className="px-5 pb-4 overflow-y-auto space-y-3">
                      {cargandoAgenda ? (
                        <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
                      ) : citasAgenda.length === 0 ? (
                        <p className="text-xs text-stone-500 text-center py-6">No hay citas para este día.</p>
                      ) : (
                        [...new Set(citasAgenda.map((c) => c.barbero))].map((nombreBarbero) => (
                          <div key={nombreBarbero}>
                            <p className="text-xs font-bold text-stone-800 mb-1.5">{nombreBarbero}</p>
                            <div className="space-y-1.5">
                              {citasAgenda.filter((c) => c.barbero === nombreBarbero).map((c) => {
                                const hora = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
                                const seg = c.pedidos_seguimiento || {};
                                const servicios = (seg.items || []).map((it) => `${it.cantidad} × ${String(it.descripcion || '').replace(/^Combo: /, '')}`).join(', ');
                                return (
                                  <div key={c.id} className="flex items-start gap-3 p-2.5 bg-stone-50 border border-stone-200 rounded-xl">
                                    <p className="text-xs font-bold text-[#4d04b0] tabular-nums shrink-0 pt-0.5">{hora(c.inicio)}–{hora(c.fin)}</p>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-stone-800 truncate">{seg.cliente_nombre || 'Cliente'}</p>
                                      <p className="text-[11px] text-stone-500 truncate">{servicios}</p>
                                      <p className="text-[10px] text-stone-400"><span className="font-mono">{seg.codigo_corto}</span>{seg.estado === 'retirado' ? ' · atendida' : ''}</p>
                                    </div>
                                    <label className="ml-auto shrink-0 flex items-center gap-1 text-[10px] text-stone-500" title="Cambia cuánto dura esta cita (por ejemplo, si el tinte toma más tiempo)">
                                      Dura
                                      <input
                                        key={`${c.id}-${c.fin}`}
                                        type="number" min="5" max="480" step="5"
                                        defaultValue={Math.round((new Date(c.fin) - new Date(c.inicio)) / 60000)}
                                        onBlur={(e) => ajustarDuracionCita(c, e.target.value)}
                                        className="w-14 px-1.5 py-1 border border-stone-200 rounded-lg text-xs text-stone-800 text-right"
                                      />
                                      min
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
    </>
  );
}
