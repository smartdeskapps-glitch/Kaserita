import React from 'react';
import { FotoProducto } from './PanelAdminCompartido.jsx';
import Chispa from './Chispa.jsx';

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
  formatoSoles,
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
                  <div className="rounded-[34px] max-w-sm w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white">
                      {/* Panel oscuro: el producto y la cantidad */}
                      <div
                        className="kz-panel-oscuro relative text-white px-5 pt-4 pb-8"
                      >
                        <div className="flex items-center justify-between">
                          <span className="w-10 h-10 rounded-full border-[1.5px] border-white/25 bg-white/5 flex items-center justify-center">
                            <IconoTrazo nombre="warn" className="w-[17px] h-[17px]" />
                          </span>
                          <span className="text-[12.5px] font-semibold text-white/85">Registrar merma</span>
                          <button onClick={cerrarModalMerma} className="w-10 h-10 rounded-full border-[1.5px] border-white/25 bg-white/5 hover:bg-white/10 flex items-center justify-center transition" aria-label="Cerrar">
                            <IconoTrazo nombre="x" className="w-[15px] h-[15px]" />
                          </button>
                        </div>

                        {!prodMerma ? (
                          <>
                            <div className="text-center mt-4">
                              <p className="text-xs text-white/60 leading-snug">Vencidos, rotos, robados o perdidos.<br />Se descuenta del stock.</p>
                              <h3 className="text-[25px] font-light tracking-tight mt-1">¿Qué producto <b className="font-bold">se perdió?</b></h3>
                            </div>
                            <div className="flex gap-2.5 mt-5">
                              <div className="flex-1 min-w-0 h-[50px] flex items-center gap-2.5 px-4 rounded-full border-[1.5px] border-white/20 bg-white/5 focus-within:border-[#c5bcff] focus-within:ring-4 focus-within:ring-[#9687f5]/20 transition">
                                <IconoTrazo nombre="buscar" className="w-[16px] h-[16px] text-white/80 shrink-0" />
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
                                  className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={abrirEscanerParaMerma}
                                className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-[#9687f5] to-[#5b4bd6] hover:brightness-110 text-white flex items-center justify-center shrink-0 transition"
                                aria-label="Escanear código de barras"
                                title="Escanear código de barras"
                              >
                                <IconoTrazo nombre="barras" className="w-[20px] h-[20px]" />
                              </button>
                            </div>
                            {!termino && <p className="text-[11.5px] text-white/50 text-center mt-2.5">Un lector de códigos de barras también funciona aquí.</p>}
                          </>
                        ) : (
                          <>
                            <div className="mt-5 flex items-center gap-3 rounded-[22px] border-[1.5px] border-white/15 bg-white/5 p-2.5 pr-3">
                              <FotoProducto fotoUrl={prodMerma.foto_url} categoria={prodMerma.categoria} className="w-[50px] h-[50px] rounded-[15px] shrink-0 bg-white" iconClassName="text-sm" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-bold leading-tight">{prodMerma.descripcion}</p>
                                <p className="text-[11.5px] text-white/60 mt-0.5">Stock actual: {stockMerma}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setFormMerma((f) => ({ ...f, productoId: '', cantidad: '' }))}
                                className="shrink-0 h-8 px-3.5 rounded-full border-[1.5px] border-white/25 hover:bg-white/10 text-[12px] font-bold transition"
                              >
                                Cambiar
                              </button>
                            </div>

                            <div className="text-center mt-5">
                              <p className="text-[11.5px] text-white/55">Cantidad</p>
                              <div className="flex items-center justify-center gap-5 mt-1.5">
                                <button type="button" onClick={() => cambiarCantidad(-pasoMerma)} className="w-[46px] h-[46px] rounded-full border-[1.5px] border-white/25 bg-white/5 hover:bg-white/10 flex items-center justify-center transition" aria-label="Menos">
                                  <IconoTrazo nombre="minus" className="w-[17px] h-[17px]" />
                                </button>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step={pasoMerma}
                                  min="0"
                                  value={formMerma.cantidad}
                                  onChange={(e) => setFormMerma((f) => ({ ...f, cantidad: e.target.value }))}
                                  className="w-24 text-center text-[52px] leading-none font-light tracking-tight text-white tabular-nums bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button type="button" onClick={() => cambiarCantidad(pasoMerma)} className="w-[46px] h-[46px] rounded-full border-[1.5px] border-white/25 bg-white/5 hover:bg-white/10 flex items-center justify-center transition" aria-label="Más">
                                  <IconoTrazo nombre="plus" className="w-[17px] h-[17px]" />
                                </button>
                              </div>
                              <p className="text-xs text-white/65 mt-2.5">Costo perdido <b className="ml-1.5 text-[15px] text-[#ffb3c0] tabular-nums">S/ {formatoSoles(costoMerma)}</b></p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Hoja blanca: resultados de búsqueda, o el motivo y el stock resultante */}
                      <div className="relative -mt-5 rounded-t-[30px] bg-white px-5 pt-5 pb-2">
                        {!prodMerma ? (
                          termino ? (
                            resultados.length === 0 ? (
                              <p className="text-xs text-stone-400 text-center py-3">No hay productos que coincidan.</p>
                            ) : (
                              <div className="rounded-[22px] bg-[#f3f5ff] overflow-hidden">
                                {resultados.map((p, i) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => elegirProductoMerma(p)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#e6ebff] transition ${i > 0 ? 'border-t border-white' : ''}`}
                                  >
                                    <FotoProducto fotoUrl={p.foto_url} categoria={p.categoria} className="w-[38px] h-[38px] rounded-[12px] shrink-0 bg-white" iconClassName="text-xs" />
                                    <span className="min-w-0">
                                      <span className="block text-[13.5px] font-semibold text-stone-900 leading-tight truncate">{p.descripcion}</span>
                                      <span className="block text-[11.5px] text-stone-400">{p.categoria || 'General'} · Stock {p.stock_actual}</span>
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )
                          ) : (
                            <p className="text-xs text-stone-400 text-center py-2 leading-relaxed">Elige un producto para indicar la cantidad y el motivo.</p>
                          )
                        ) : (
                          <>
                            <p className="text-[13px] font-bold text-[#2d284b] mb-2.5">Motivo</p>
                            <div className="flex flex-wrap gap-2">
                              {['Vencido', 'Roto/Dañado', 'Robo/Pérdida', 'Otro'].map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setFormMerma((f) => ({ ...f, motivo: t }))}
                                  className={`h-10 px-4 rounded-full text-[13px] font-bold transition ${
                                    formMerma.motivo === t ? 'bg-[#2d284b] text-white' : 'bg-[#f3f5ff] text-[#6b6890] hover:bg-[#e6ebff]'
                                  }`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                            {formMerma.motivo === 'Otro' && (
                              <div className="mt-2.5 h-11 flex items-center px-4 rounded-2xl bg-[#f3f5ff] focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                                <input
                                  type="text"
                                  autoFocus
                                  maxLength={80}
                                  value={formMerma.motivoOtro}
                                  onChange={(e) => setFormMerma((f) => ({ ...f, motivoOtro: e.target.value }))}
                                  placeholder="Escribe el motivo"
                                  className="w-full min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-[#9290a2] focus:outline-none"
                                />
                              </div>
                            )}

                            <div className="mt-4 flex items-center justify-between rounded-[20px] bg-[#f3f5ff] px-4 py-3 text-[13px] font-semibold text-[#2d284b]">
                              <span>El stock quedará en</span>
                              <b className={`text-[22px] tabular-nums ${stockMerma - cantMerma < 0 ? 'text-amber-700' : 'text-[#2d284b]'}`}>{Math.max(0, +(stockMerma - cantMerma).toFixed(2))}</b>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 bg-white px-5 pb-5 pt-2">
                      <button
                        onClick={registrarMermaProducto}
                        disabled={guardandoMerma || !prodMerma || cantMerma <= 0}
                        className="kz-pri w-full h-[54px] text-base font-semibold flex items-center justify-center gap-2.5"
                      >
                        <span>{guardandoMerma ? 'Guardando...' : 'Registrar merma'}</span>
                        <Chispa />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })()}
    </>
  );
}
