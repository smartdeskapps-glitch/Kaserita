import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function HistorialInventario({
  FiltroFechasRapido,
  PestanasModal,
  abrirTomaInventario,
  cargandoHistorialInventario,
  cargarHistorialInventarioPorRango,
  fechaFinHistInventario,
  fechaInicioHistInventario,
  historialInventarioAgrupado,
  historialInventarioBusqueda,
  historialInventarioSoloDif,
  listaCajeros,
  modalHistorialInventario,
  setFechaFinHistInventario,
  setFechaInicioHistInventario,
  setHistorialInventarioBusqueda,
  setHistorialInventarioSoloDif,
  setModalHistorialInventario,
}) {
  return (
    <>
              {modalHistorialInventario && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-lg w-full p-5 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center shrink-0">
                      <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                        <i className="fa-solid fa-scale-balanced text-orange-600"></i> Historial de Inventario
                      </h3>
                      <button aria-label="Cerrar" onClick={() => setModalHistorialInventario(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                    </div>

                    <PestanasModal pestanas={[
                      { texto: 'Nueva toma', onClick: () => { setModalHistorialInventario(false); abrirTomaInventario(); } },
                      { texto: 'Historial', activa: true },
                    ]} />

                    <FiltroFechasRapido
                      desde={fechaInicioHistInventario}
                      hasta={fechaFinHistInventario}
                      setDesde={setFechaInicioHistInventario}
                      setHasta={setFechaFinHistInventario}
                      onRango={cargarHistorialInventarioPorRango}
                      diasAtras={30}
                    />

                    <div className="flex gap-2 shrink-0">
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={historialInventarioBusqueda}
                        onChange={(e) => setHistorialInventarioBusqueda(e.target.value)}
                        className="flex-1 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                      />
                      <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 font-semibold cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={historialInventarioSoloDif}
                          onChange={(e) => setHistorialInventarioSoloDif(e.target.checked)}
                        />
                        Solo con diferencia
                      </label>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3">
                      {cargandoHistorialInventario ? (
                        <p className="text-xs text-center py-8 text-stone-600">Cargando...</p>
                      ) : historialInventarioAgrupado.length === 0 ? (
                        <p className="text-xs text-center py-8 text-stone-500">No hay conteos registrados en ese rango.</p>
                      ) : (
                        historialInventarioAgrupado.map((grupo) => (
                          <div key={grupo.dia}>
                            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wide mb-1.5">
                              {new Date(`${grupo.dia}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long' })}
                            </p>
                            <div className="space-y-1.5">
                              {grupo.items.map((h) => {
                                const dif = Number(h.diferencia);
                                const cajero = listaCajeros.find((c) => c.id === h.cajero_id);
                                return (
                                  <div key={h.id} className="p-2.5 bg-white rounded-xl border border-stone-200 text-xs">
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="min-w-0">
                                        <p className="font-semibold text-stone-800 truncate">{h.productos?.descripcion || 'Producto eliminado'}</p>
                                        <p className="text-[10px] text-stone-500">
                                          {new Date(h.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                                          {cajero ? ` · ${cajero.nombre}` : ''}
                                        </p>
                                      </div>
                                      <span className={`shrink-0 font-black ${dif === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {dif === 0 ? (<><i className="fa-solid fa-circle-check mr-1"></i>Cuadró</>) : (dif > 0 ? `+${dif}` : dif)}
                                      </span>
                                    </div>
                                    <div className="flex gap-3 mt-1 text-[11px] text-stone-600">
                                      <span>Sistema: <b className="text-stone-800">{Number(h.stock_sistema)}</b></span>
                                      <span>Contado: <b className="text-stone-800">{Number(h.stock_contado)}</b></span>
                                    </div>
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
