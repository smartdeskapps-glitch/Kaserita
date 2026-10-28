import React from 'react';
import { FotoProducto } from './PanelAdminCompartido.jsx';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function MermaModal({
  IconoTrazo,
  abrirEscanerParaMerma,
  buscarProductoPorCodigo,
  busquedaMerma,
  cerrarModalMerma,
  elegirProductoMerma,
  formMerma,
  guardandoMerma,
  modalMerma,
  productos,
  registrarMermaProducto,
  setBusquedaMerma,
  setFormMerma,
}) {
  return (
    <>
              {/* Modal: Registrar Merma */}
              {modalMerma && (() => {
                const prodMerma = productos.find((p) => p.id === formMerma.productoId) || null;
                const cantMerma = Number(formMerma.cantidad) || 0;
                const porPeso = !!prodMerma && (String(prodMerma.unidad || '').toUpperCase() === 'KG' || !Number.isInteger(Number(prodMerma.stock_actual) || 0));
                const pasoMerma = porPeso ? 0.1 : 1;
                const stockMerma = Number(prodMerma?.stock_actual) || 0;
                const costoMerma = +(cantMerma * (Number(prodMerma?.precio_costo) || 0)).toFixed(2);
                const termino = busquedaMerma.trim().toLowerCase();
                const resultados = termino
                  ? productos
                      .filter((p) => (p.descripcion || '').toLowerCase().includes(termino)
                        || (p.cod_ean || '').toLowerCase() === termino
                        || (p.cod_ean_pack || '').toLowerCase() === termino)
                      .slice(0, 6)
                  : [];
                const cambiarCantidad = (delta) => {
                  const nueva = Math.max(pasoMerma, +(cantMerma + delta).toFixed(2));
                  setFormMerma((f) => ({ ...f, cantidad: String(nueva) }));
                };
                return (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-4 shadow-2xl space-y-3.5 max-h-[92vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex items-center gap-2.5">
                      <span className="w-[38px] h-[38px] rounded-[14px] bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <IconoTrazo nombre="warn" className="w-[19px] h-[19px]" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[19px] font-bold tracking-tight text-stone-900 leading-tight">Registrar pérdida</h3>
                        <p className="text-xs text-stone-500 mt-0.5 leading-snug">Vencidos, rotos, robados o perdidos. Se descuenta del stock.</p>
                      </div>
                      <button onClick={cerrarModalMerma} className="w-9 h-9 rounded-full bg-white ring-1 ring-[#6105dc]/10 hover:bg-[#f4eefe] text-stone-500 flex items-center justify-center transition shrink-0" aria-label="Cerrar">
                        <IconoTrazo nombre="x" className="w-[15px] h-[15px]" />
                      </button>
                    </div>

                    {!prodMerma ? (
                      <>
                        <div>
                          <p className="text-[12.5px] font-semibold text-stone-700 mb-1.5">Producto</p>
                          <div className="flex gap-2">
                            <div className="flex-1 min-w-0 h-12 flex items-center gap-2 px-4 rounded-full bg-white ring-1 ring-[#6105dc]/15 focus-within:ring-2 focus-within:ring-[#6105dc]/40">
                              <IconoTrazo nombre="buscar" className="w-[17px] h-[17px] text-[#6105dc] shrink-0" />
                              <input
                                type="text"
                                autoFocus
                                value={busquedaMerma}
                                onChange={(e) => setBusquedaMerma(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return;
                                  e.preventDefault();
                                  // Un lector de códigos "escribe" el código y confirma con Enter.
                                  const porCodigo = buscarProductoPorCodigo(busquedaMerma);
                                  if (porCodigo) elegirProductoMerma(porCodigo.producto);
                                  else if (resultados.length === 1) elegirProductoMerma(resultados[0]);
                                }}
                                placeholder="Escribe o escanea el código"
                                className="w-full min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-[#a9a3b8] focus:outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={abrirEscanerParaMerma}
                              className="w-12 h-12 rounded-full bg-[#6105dc] hover:bg-[#4d04b0] text-white flex items-center justify-center shrink-0 transition"
                              aria-label="Escanear código de barras"
                              title="Escanear código de barras"
                            >
                              <IconoTrazo nombre="barras" className="w-[21px] h-[21px]" />
                            </button>
                          </div>
                          {!termino && <p className="text-[11.5px] text-stone-400 mt-1.5">Un lector de códigos de barras también funciona aquí.</p>}
                        </div>
                        {termino && (
                          resultados.length === 0 ? (
                            <p className="text-xs text-stone-400 text-center py-4">No hay productos que coincidan.</p>
                          ) : (
                            <div className="bg-white rounded-[22px] ring-1 ring-[#6105dc]/10 overflow-hidden">
                              {resultados.map((p, i) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => elegirProductoMerma(p)}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#f4eefe] transition ${i > 0 ? 'border-t border-[#efe6fc]' : ''}`}
                                >
                                  <FotoProducto fotoUrl={p.foto_url} categoria={p.categoria} className="w-[38px] h-[38px] rounded-[12px] shrink-0 ring-1 ring-black/5 bg-white" iconClassName="text-xs" />
                                  <span className="min-w-0">
                                    <span className="block text-[13.5px] font-semibold text-stone-900 leading-tight truncate">{p.descripcion}</span>
                                    <span className="block text-[11.5px] text-stone-400">{p.categoria || 'General'} · Stock {p.stock_actual}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          )
                        )}
                        {!termino && (
                          <p className="text-xs text-stone-400 text-center py-5 leading-relaxed">Elige un producto para indicar la cantidad y el motivo.</p>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-[12.5px] font-semibold text-stone-700 mb-1.5">Producto</p>
                          <div className="flex items-center gap-2.5 bg-white rounded-[22px] ring-1 ring-[#6105dc]/10 p-2.5 pr-3">
                            <FotoProducto fotoUrl={prodMerma.foto_url} categoria={prodMerma.categoria} className="w-[50px] h-[50px] rounded-[15px] shrink-0 ring-1 ring-black/5 bg-white" iconClassName="text-sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13.5px] font-semibold text-stone-900 leading-tight">{prodMerma.descripcion}</p>
                              <p className="text-[11.5px] text-stone-400 mt-0.5">Stock actual: {stockMerma}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormMerma((f) => ({ ...f, productoId: '', cantidad: '' }))}
                              className="shrink-0 px-3 py-1.5 rounded-full bg-[#f4eefe] hover:bg-[#ece0fd] text-[12.5px] font-semibold text-[#6105dc] transition"
                            >
                              Cambiar
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="text-[12.5px] font-semibold text-stone-700 mb-1.5">Cantidad</p>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center bg-white rounded-full ring-1 ring-[#6105dc]/15 shrink-0">
                              <button type="button" onClick={() => cambiarCantidad(-pasoMerma)} className="w-[46px] h-[46px] flex items-center justify-center text-[#6105dc] rounded-full hover:bg-[#f4eefe] transition" aria-label="Menos">
                                <IconoTrazo nombre="minus" className="w-[17px] h-[17px]" />
                              </button>
                              <input
                                type="number"
                                inputMode="decimal"
                                step={pasoMerma}
                                min="0"
                                value={formMerma.cantidad}
                                onChange={(e) => setFormMerma((f) => ({ ...f, cantidad: e.target.value }))}
                                className="w-14 text-center text-xl font-bold text-stone-900 tabular-nums bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button type="button" onClick={() => cambiarCantidad(pasoMerma)} className="w-[46px] h-[46px] flex items-center justify-center text-[#6105dc] rounded-full hover:bg-[#f4eefe] transition" aria-label="Más">
                                <IconoTrazo nombre="plus" className="w-[17px] h-[17px]" />
                              </button>
                            </div>
                            <div className="flex-1 text-right">
                              <p className="text-[11.5px] text-stone-500">Costo perdido</p>
                              <p className="text-xl font-bold tracking-tight text-rose-700 tabular-nums">S/ {formatoSoles(costoMerma)}</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="text-[12.5px] font-semibold text-stone-700 mb-1.5">Motivo</p>
                          <div className="flex flex-wrap gap-1.5">
                            {['Vencido', 'Roto/Dañado', 'Robo/Pérdida', 'Otro'].map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setFormMerma((f) => ({ ...f, motivo: t }))}
                                className={`px-3.5 py-2 rounded-full text-[13px] font-semibold transition ${
                                  formMerma.motivo === t ? 'bg-[#6105dc] text-white' : 'bg-white ring-1 ring-[#6105dc]/10 text-stone-600 hover:bg-[#faf8fe]'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          {formMerma.motivo === 'Otro' && (
                            <div className="mt-2 h-11 flex items-center px-4 rounded-2xl bg-white ring-1 ring-[#6105dc]/15 focus-within:ring-2 focus-within:ring-[#6105dc]/40">
                              <input
                                type="text"
                                autoFocus
                                maxLength={80}
                                value={formMerma.motivoOtro}
                                onChange={(e) => setFormMerma((f) => ({ ...f, motivoOtro: e.target.value }))}
                                placeholder="Escribe el motivo"
                                className="w-full min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-[#a9a3b8] focus:outline-none"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between bg-[#f4eefe] border border-[#efe6fc] rounded-[20px] px-3.5 py-2.5 text-[13px] font-semibold text-[#4d04b0]">
                          <span>El stock quedará en</span>
                          <b className={`text-[15px] tabular-nums ${stockMerma - cantMerma < 0 ? 'text-amber-700' : 'text-stone-900'}`}>{Math.max(0, +(stockMerma - cantMerma).toFixed(2))}</b>
                        </div>
                      </>
                    )}

                    <button
                      onClick={registrarMermaProducto}
                      disabled={guardandoMerma || !prodMerma || cantMerma <= 0}
                      className="w-full h-[54px] rounded-full bg-[#6105dc] hover:bg-[#4d04b0] disabled:bg-[#ebe8f1] disabled:text-[#8b869a] disabled:cursor-not-allowed text-white font-semibold text-base transition"
                    >
                      {guardandoMerma ? 'Guardando...' : 'Registrar pérdida'}
                    </button>
                  </div>
                </div>
                );
              })()}
    </>
  );
}
