import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function TomaInventario({
  PestanasModal,
  abrirHistorialInventario,
  actualizarPendienteConteo,
  actualizarStockContado,
  agregarHallazgo,
  agregarProductoAConteo,
  categoriasDB,
  conteoFisicoBusqueda,
  continuarARevisionInventario,
  editandoPackParaId,
  filasTomaInventario,
  filasTomaInventarioVisibles,
  guardandoTomaInventario,
  guardarTomaInventario,
  historialConteoAbierto,
  modalTomaInventario,
  pasoTomaInventario,
  productos,
  promoverAActivoConteo,
  quitarHallazgo,
  quitarProductoDeConteo,
  refsPendientesConteo,
  resultadosBusquedaConteo,
  setConteoFisicoBusqueda,
  setEditandoPackParaId,
  setHistorialConteoAbierto,
  setMetodoForzado,
  setModalEscaner,
  setModalTomaInventario,
  setModoEscaner,
  setPasoTomaInventario,
  setTomaInventarioBusqueda,
  setTomaInventarioCategoria,
  tomaInventarioBusqueda,
  tomaInventarioCategoria,
  vaciarConteoInventario,
}) {
  return (
    <>
              {modalTomaInventario && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-2xl w-full p-5 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-start shrink-0">
                      <div>
                        <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                          <i className="fa-solid fa-clipboard-check text-orange-600"></i> Toma de Inventario
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                            Paso {pasoTomaInventario === 'conteo' ? '1' : '2'} de 2
                          </span>
                        </h3>
                        <p className="text-xs text-stone-600 mt-0.5">
                          {pasoTomaInventario === 'conteo'
                            ? 'Busca cada producto y ve sumando lo que encuentres en cada lugar del local.'
                            : 'Revisa lo contado contra el sistema y guarda para ajustar el stock.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {filasTomaInventario.length > 0 && (
                          <button onClick={vaciarConteoInventario} className="text-[11px] font-semibold text-rose-600 hover:text-rose-700">
                            Vaciar
                          </button>
                        )}
                        <button aria-label="Cerrar" onClick={() => setModalTomaInventario(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                      </div>
                    </div>

                    <PestanasModal pestanas={[
                      { texto: 'Nueva toma', activa: true },
                      { texto: 'Historial', onClick: () => { setModalTomaInventario(false); abrirHistorialInventario(); } },
                    ]} />

                    {pasoTomaInventario === 'conteo' ? (
                      <>
                        <div className="flex gap-1.5 shrink-0">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Buscar o escanear producto..."
                              value={conteoFisicoBusqueda}
                              onChange={(e) => setConteoFisicoBusqueda(e.target.value)}
                              className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-2 text-xs text-stone-900"
                            />
                            {resultadosBusquedaConteo.length > 0 && (
                              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                                {resultadosBusquedaConteo.map((p) => {
                                  const yaContado = filasTomaInventario.find((f) => f.productoId === p.id);
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => agregarProductoAConteo(p)}
                                      className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-xs text-stone-800 hover:bg-orange-50 border-b border-stone-100 last:border-0"
                                    >
                                      <span className="truncate">{p.descripcion}</span>
                                      {yaContado && (
                                        <span className="shrink-0 text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                                          {yaContado.stockContado === '' ? 'sumar más' : `${yaContado.stockContado} und · sumar más`}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => { setModoEscaner('toma-inventario'); setMetodoForzado(null); setModalEscaner(true); }}
                            title="Escanear con la cámara"
                            className="shrink-0 w-10 flex items-center justify-center bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg"
                          >
                            <i className="fa-solid fa-camera"></i>
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                          {filasTomaInventario.length === 0 ? (
                            <p className="text-xs text-stone-500 text-center py-8">Aún no agregas ningún producto al conteo.</p>
                          ) : (
                            <>
                              {(() => {
                                const f = filasTomaInventario[0];
                                const porPack = Number(f.pendienteUnidadesPorPack) || 1;
                                const totalPendiente = (Number(f.pendientePacks) || 0) * porPack + (Number(f.pendienteSueltas) || 0);
                                return (
                                  <div className="p-2.5 bg-stone-50 border border-orange-300 rounded-xl space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <p className="flex-1 min-w-0 text-xs font-semibold text-stone-800 truncate">{f.descripcion}</p>
                                      <span className="text-xs font-bold text-orange-600 shrink-0">
                                        {f.stockContado === '' ? 'Sin contar' : `${f.stockContado} und`}
                                      </span>
                                      <button aria-label="Eliminar" onClick={() => quitarProductoDeConteo(f.productoId)} className="text-stone-400 hover:text-rose-600 shrink-0">
                                        <i className="fa-solid fa-trash-can"></i>
                                      </button>
                                    </div>

                                    {f.historial.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {f.historial.map((h) => (
                                          <span key={h.id} className="inline-flex items-center gap-1 bg-stone-200 rounded-full pl-2 pr-1 py-0.5 text-[11px] text-stone-700">
                                            +{h.cantidad}
                                            <button aria-label="Cerrar" onClick={() => quitarHallazgo(f.productoId, h.id)} className="w-3.5 h-3.5 flex items-center justify-center text-stone-500 hover:text-rose-600">
                                              <i className="fa-solid fa-xmark text-[9px]"></i>
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <div className="flex flex-col items-center">
                                        <input
                                          type="number"
                                          ref={(el) => { refsPendientesConteo.current[f.productoId] = el; }}
                                          placeholder="0"
                                          value={f.pendientePacks}
                                          onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendientePacks', e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') agregarHallazgo(f.productoId); }}
                                          className="w-14 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2 py-1.5 text-xs text-stone-900 text-center"
                                        />
                                        <span className="text-[9px] text-stone-500">packs</span>
                                      </div>
                                      <span className="text-[10px] text-stone-400">de</span>
                                      <div className="flex flex-col items-center">
                                        {editandoPackParaId === f.productoId ? (
                                          <input
                                            type="number"
                                            autoFocus
                                            placeholder="1"
                                            value={f.pendienteUnidadesPorPack}
                                            onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendienteUnidadesPorPack', e.target.value)}
                                            onBlur={() => setEditandoPackParaId(null)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') setEditandoPackParaId(null); }}
                                            className="w-14 bg-white border border-orange-400 rounded-lg px-2 py-1.5 text-xs text-stone-900 text-center"
                                          />
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setEditandoPackParaId(f.productoId)}
                                            title="Tocar para cambiar las unidades por pack"
                                            className="w-14 h-[30px] bg-stone-200 border border-stone-300 rounded-lg text-xs font-bold text-stone-700"
                                          >
                                            x{f.pendienteUnidadesPorPack || 1}
                                          </button>
                                        )}
                                        <span className="text-[9px] text-stone-500 flex items-center gap-0.5">
                                          {editandoPackParaId !== f.productoId && <i className="fa-solid fa-lock text-[7px]"></i>} und c/u
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-stone-400">+</span>
                                      <div className="flex flex-col items-center">
                                        <input
                                          type="number"
                                          placeholder="0"
                                          value={f.pendienteSueltas}
                                          onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendienteSueltas', e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') agregarHallazgo(f.productoId); }}
                                          className="w-14 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2 py-1.5 text-xs text-stone-900 text-center"
                                        />
                                        <span className="text-[9px] text-stone-500">sueltas</span>
                                      </div>
                                      <span className="text-xs font-bold text-orange-600 ml-auto shrink-0">= {totalPendiente} und</span>
                                    </div>
                                    <button onClick={() => agregarHallazgo(f.productoId)} className="w-full py-1.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white rounded-full text-[11px] font-bold">
                                      <i className="fa-solid fa-plus"></i> Agregar
                                    </button>
                                  </div>
                                );
                              })()}

                              {filasTomaInventario.length > 1 && (
                                <div className="border border-stone-200 rounded-xl overflow-hidden shrink-0">
                                  <button
                                    onClick={() => setHistorialConteoAbierto((v) => !v)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-stone-200/60 hover:bg-stone-200 text-xs font-bold text-stone-700"
                                  >
                                    <span><i className="fa-solid fa-clock-rotate-left mr-1.5"></i>Historial ({filasTomaInventario.length - 1})</span>
                                    <i className={`fa-solid fa-chevron-${historialConteoAbierto ? 'up' : 'down'}`}></i>
                                  </button>
                                  {historialConteoAbierto && (
                                    <div className="divide-y divide-stone-200 max-h-40 overflow-y-auto">
                                      {filasTomaInventario.slice(1).map((f) => (
                                        <div key={f.productoId} className="flex items-center gap-2 px-3 py-2 bg-white text-xs">
                                          <span className="flex-1 min-w-0 truncate text-stone-700">{f.descripcion}</span>
                                          <span className="font-bold text-orange-600 shrink-0">
                                            {f.stockContado === '' ? 'Sin contar' : `${f.stockContado} und`}
                                          </span>
                                          <button
                                            onClick={() => promoverAActivoConteo(f.productoId)}
                                            className="shrink-0 text-[10px] font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-md"
                                          >
                                            Sumar más
                                          </button>
                                          <button aria-label="Eliminar" onClick={() => quitarProductoDeConteo(f.productoId)} className="shrink-0 text-stone-400 hover:text-rose-600">
                                            <i className="fa-solid fa-trash-can"></i>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        <button
                          onClick={continuarARevisionInventario}
                          disabled={filasTomaInventario.length === 0}
                          className="w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-50 text-white font-bold text-xs rounded-full shadow shrink-0"
                        >
                          {filasTomaInventario.length === 0 ? 'Agrega al menos un producto' : `Continuar a Revisión (${filasTomaInventario.length})`}
                          {filasTomaInventario.length > 0 && <i className="fa-solid fa-arrow-right ml-1.5"></i>}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex gap-2 shrink-0">
                          <input
                            type="text"
                            placeholder="Buscar en lo contado..."
                            value={tomaInventarioBusqueda}
                            onChange={(e) => setTomaInventarioBusqueda(e.target.value)}
                            className="flex-1 min-w-0 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                          />
                          <select
                            value={tomaInventarioCategoria}
                            onChange={(e) => setTomaInventarioCategoria(e.target.value)}
                            className="min-w-0 max-w-[48%] truncate bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                          >
                            <option value="">Todas las categorías</option>
                            {categoriasDB.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1.5">
                          {filasTomaInventarioVisibles.length === 0 ? (
                            <p className="text-xs text-stone-500 text-center py-8">No hay productos que coincidan.</p>
                          ) : (
                            filasTomaInventarioVisibles.map((f) => {
                              const diferencia = f.stockContado === '' ? null : (Number(f.stockContado) || 0) - f.stockSistema;
                              return (
                                <div key={f.productoId} className="flex items-center gap-2 p-2.5 bg-stone-50 border border-stone-200 rounded-xl">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-stone-800 truncate">{f.descripcion}</p>
                                    <p className="text-xs text-stone-500">Sistema: {f.stockSistema}</p>
                                  </div>
                                  <input
                                    type="number"
                                    step="0.10"
                                    placeholder="Contado"
                                    value={f.stockContado}
                                    onChange={(e) => actualizarStockContado(f.productoId, e.target.value)}
                                    className="w-20 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2 py-1.5 text-xs text-stone-900 text-right"
                                  />
                                  <span className={`w-14 text-right text-xs font-bold ${
                                    diferencia === null || diferencia === 0 ? 'text-stone-400' : diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                                  }`}>
                                    {diferencia === null ? '—' : diferencia > 0 ? `+${diferencia}` : diferencia}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 text-center shrink-0">
                          <i className="fa-solid fa-circle-info mr-1"></i>
                          Al guardar, el stock del sistema se ajusta solo para que quede igual al contado.
                        </p>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => setPasoTomaInventario('conteo')}
                            className="py-2.5 px-4 bg-white/70 hover:bg-[#ece0fd] text-stone-600 font-bold text-xs rounded-full shrink-0 shadow-sm"
                          >
                            <i className="fa-solid fa-arrow-left mr-1.5"></i> Seguir contando
                          </button>
                          <button
                            onClick={guardarTomaInventario}
                            disabled={guardandoTomaInventario}
                            className="flex-1 py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-50 text-white font-bold text-xs rounded-full shadow"
                          >
                            {guardandoTomaInventario ? 'Guardando...' : 'Guardar y Ajustar Stock'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
    </>
  );
}
