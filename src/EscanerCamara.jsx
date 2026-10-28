import React from 'react';
import { FotoProducto } from './PanelAdminCompartido.jsx';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function EscanerCamara({
  IconoTrazo,
  actualizarPendienteConteo,
  agregarHallazgo,
  camarasDisponibles,
  cambiarCamara,
  cambiarCantidadCarrito,
  carrito,
  destelloEscaner,
  editandoPackParaId,
  errorEscaner,
  filasTomaInventario,
  formatoSoles,
  inputBusquedaRef,
  listaEscaneada,
  modalEscaner,
  modoEscaner,
  productoEscaneadoId,
  productos,
  quitarHallazgo,
  setEditandoPackParaId,
  setModalEscaner,
  setMostrarResumenMobile,
  totalConDescuento,
  videoNativoRef,
}) {
  return (
    <>
              {/* Modal: Lector de Código de Barras por Cámara */}
              {modalEscaner && (
                <div className="fixed inset-0 bg-black z-[70] flex flex-col">
                  <div className="flex-1 relative overflow-hidden bg-black">
                    <video ref={videoNativoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay></video>

                    {/* Visor: esquinas blancas (verdes al leer un código) y una línea que recorre el recuadro */}
                    <div
                      className={`absolute left-1/2 ${modoEscaner === 'toma-inventario' ? 'top-[45%]' : 'top-[42%]'} -translate-x-1/2 -translate-y-1/2 w-[78%] max-w-sm aspect-[1.55/1] rounded-[26px] shadow-[0_0_0_9999px_rgba(12,9,18,0.62)] pointer-events-none transition ${destelloEscaner ? 'bg-green-400/10' : ''}`}
                    >
                      {[
                        'left-[-2px] top-[-2px] border-r-0 border-b-0 rounded-tl-[24px]',
                        'right-[-2px] top-[-2px] border-l-0 border-b-0 rounded-tr-[24px]',
                        'left-[-2px] bottom-[-2px] border-r-0 border-t-0 rounded-bl-[24px]',
                        'right-[-2px] bottom-[-2px] border-l-0 border-t-0 rounded-br-[24px]',
                      ].map((pos) => (
                        <i key={pos} className={`absolute w-[40px] h-[40px] border-4 transition-colors ${destelloEscaner ? 'border-green-400 drop-shadow-[0_0_10px_rgba(61,220,151,0.7)]' : 'border-white drop-shadow-[0_0_8px_rgba(160,100,255,0.55)]'} ${pos}`}></i>
                      ))}
                      {!destelloEscaner && (
                        <p className="absolute left-0 right-0 -bottom-10 text-center text-[12.5px] font-semibold text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
                          Centra el código dentro del recuadro
                        </p>
                      )}
                    </div>

                    {/* Aviso de lo que se acaba de leer (solo al vender) */}
                    {destelloEscaner && modoEscaner === 'venta' && (() => {
                      const ultimo = listaEscaneada[0]
                        ? carrito.find((it) => (it.claveCarrito || it.productoId) === listaEscaneada[0])
                        : null;
                      if (!ultimo) return null;
                      return (
                        <div key={`${ultimo.claveCarrito || ultimo.productoId}-${ultimo.cantidad}`} className="absolute left-1/2 -translate-x-1/2 top-[88px] max-w-[88%] flex items-center gap-2.5 bg-white text-[#2d284b] rounded-full py-1.5 pl-2 pr-3.5 text-[13px] font-bold shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)] animate-[escaner-pop_0.45s_cubic-bezier(0.2,1.4,0.3,1)_both]">
                          <span className="w-6 h-6 shrink-0 rounded-full bg-[#22b573] text-white flex items-center justify-center">
                            <IconoTrazo nombre="check" className="w-3.5 h-3.5" />
                          </span>
                          <span className="truncate">{ultimo.descripcion}</span>
                          <span className="text-[#5b4bd6] tabular-nums shrink-0">×{ultimo.cantidad}</span>
                        </div>
                      );
                    })()}

                    <div className="absolute left-3.5 right-3.5 top-3.5 flex items-center gap-2.5">
                      <div className="flex-1 min-w-0 text-white">
                        <p className="text-base font-bold tracking-tight leading-tight">{modoEscaner === 'toma-inventario' ? 'Escanear para el conteo' : 'Escanear código'}</p>
                        <p className="text-xs text-white/70 mt-0.5">{modoEscaner === 'toma-inventario' ? 'Sigue escaneando uno tras otro' : 'Apunta al código de barras'}</p>
                      </div>
                      {camarasDisponibles.length > 1 && (
                        <button
                          onClick={cambiarCamara}
                          title="Cambiar de cámara"
                          aria-label="Cambiar de cámara"
                          className="w-[42px] h-[42px] rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/20 text-white flex items-center justify-center hover:bg-white/25 transition"
                        >
                          <IconoTrazo nombre="camaraGira" className="w-[18px] h-[18px]" />
                        </button>
                      )}
                      <button
                        onClick={() => setModalEscaner(false)}
                        aria-label="Cerrar"
                        className="w-[42px] h-[42px] rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/20 text-white flex items-center justify-center hover:bg-white/25 transition"
                      >
                        <IconoTrazo nombre="x" className="w-[18px] h-[18px]" />
                      </button>
                    </div>

                    {errorEscaner && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-8 bg-gradient-to-br from-[#191821] to-[#0b0b10]">
                        <span className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                          <IconoTrazo nombre="camaraOff" className="w-7 h-7" />
                        </span>
                        <p className="text-[17px] font-bold text-white">{errorEscaner}</p>
                        <p className="text-[13.5px] text-white/70 leading-snug max-w-[260px]">Verifica que le diste permiso de cámara a esta página en tu navegador.</p>
                        <button
                          type="button"
                          onClick={() => { setModalEscaner(false); setTimeout(() => setModalEscaner(true), 60); }}
                          className="mt-1.5 h-[46px] px-6 rounded-full bg-white text-[#2d284b] text-sm font-semibold"
                        >
                          Reintentar
                        </button>
                        {modoEscaner === 'venta' && (
                          <button
                            type="button"
                            onClick={() => { setModalEscaner(false); setTimeout(() => inputBusquedaRef.current?.focus(), 80); }}
                            className="text-[13px] font-semibold text-white/70 hover:text-white"
                          >
                            Buscar escribiendo
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {modoEscaner === 'toma-inventario' ? (
                    <div className="bg-white rounded-t-[28px] shadow-2xl">
                      {productoEscaneadoId && (() => {
                        const f = filasTomaInventario.find((x) => x.productoId === productoEscaneadoId);
                        if (!f) return null;
                        const porPack = Number(f.pendienteUnidadesPorPack) || 1;
                        const totalPendiente = (Number(f.pendientePacks) || 0) * porPack + (Number(f.pendienteSueltas) || 0);
                        return (
                          <div className="p-4 border-b border-stone-200 space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                                <i className="fa-solid fa-box text-lg"></i>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-stone-900 truncate">{f.descripcion}</p>
                                <p className="text-xs text-stone-500">
                                  {f.stockContado === '' ? 'Aún sin contar' : `Ya llevas ${f.stockContado} und`}
                                </p>
                              </div>
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
                                  autoFocus
                                  placeholder="0"
                                  value={f.pendientePacks}
                                  onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendientePacks', e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') agregarHallazgo(f.productoId); }}
                                  className="w-14 bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm text-stone-900 text-center"
                                />
                                <span className="text-[9px] text-stone-500">packs</span>
                              </div>
                              <span className="text-xs text-stone-400">de</span>
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
                                    className="w-14 bg-white border border-orange-400 rounded-lg px-2 py-2 text-sm text-stone-900 text-center"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setEditandoPackParaId(f.productoId)}
                                    title="Tocar para cambiar las unidades por pack"
                                    className="w-14 h-[38px] bg-stone-100 border border-stone-200 rounded-lg text-sm font-bold text-stone-700"
                                  >
                                    x{f.pendienteUnidadesPorPack || 1}
                                  </button>
                                )}
                                <span className="text-[9px] text-stone-500 flex items-center gap-0.5">
                                  {editandoPackParaId !== f.productoId && <i className="fa-solid fa-lock text-[7px]"></i>} und c/u
                                </span>
                              </div>
                              <span className="text-xs text-stone-400">+</span>
                              <div className="flex flex-col items-center">
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={f.pendienteSueltas}
                                  onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendienteSueltas', e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') agregarHallazgo(f.productoId); }}
                                  className="w-14 bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm text-stone-900 text-center"
                                />
                                <span className="text-[9px] text-stone-500">sueltas</span>
                              </div>
                              <span className="text-xs font-bold text-orange-600 ml-auto shrink-0">= {totalPendiente} und</span>
                            </div>
                            <button onClick={() => agregarHallazgo(f.productoId)} className="w-full h-[50px] bg-[#5b4bd6] hover:bg-[#473bb5] text-white rounded-full text-[15px] font-semibold">
                              <i className="fa-solid fa-plus"></i> Agregar
                            </button>
                          </div>
                        );
                      })()}
                      <div className="px-4 py-3 text-center space-y-1">
                        <p className="text-xs text-stone-600">
                          {productoEscaneadoId ? 'Confirma y sigue escaneando el siguiente.' : 'Apunta la cámara al código de barras del producto.'}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          <i className="fa-solid fa-clipboard-check mr-1"></i>
                          {filasTomaInventario.length} producto{filasTomaInventario.length === 1 ? '' : 's'} en el conteo
                        </p>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const escaneados = modoEscaner === 'venta'
                        ? listaEscaneada
                            .map((c) => carrito.find((it) => (it.claveCarrito || it.productoId) === c))
                            .filter(Boolean)
                            .slice(0, 3)
                        : [];
                      if (escaneados.length === 0) {
                        return (
                          <div className="absolute left-3 right-3 bottom-3 rounded-[28px] bg-white/15 backdrop-blur-xl ring-1 ring-white/20 px-4 py-3.5 text-center">
                            <p className="text-[13.5px] font-medium text-white/95 leading-snug">Cada producto que leas se suma a la venta</p>
                            <p className="text-xs text-white/65 mt-0.5">Puedes seguir escaneando uno tras otro</p>
                          </div>
                        );
                      }
                      return (
                        <div className="absolute left-3 right-3 bottom-3 rounded-[28px] bg-[#13121d]/90 backdrop-blur-xl ring-1 ring-white/10 px-3.5 pb-3.5 pt-2 text-white">
                          <div className="w-9 h-1 rounded-full bg-white/25 mx-auto mb-2.5"></div>
                          <div className="flex items-center justify-between mb-1 text-xs font-semibold text-white/65">
                            <span>Escaneado ahora</span>
                            <b className="text-[12.5px] text-white bg-white/10 rounded-full px-2.5 py-0.5">{carrito.length} {carrito.length === 1 ? 'producto' : 'productos'}</b>
                          </div>
                          {escaneados.map((it, i) => {
                            const clave = it.claveCarrito || it.productoId;
                            return (
                              <div key={clave} className={`flex items-center gap-2.5 py-[7px] ${i > 0 ? 'border-t border-white/10' : ''}`}>
                                <FotoProducto fotoUrl={it.foto_url} categoria={it.categoria} className={`w-[34px] h-[34px] rounded-[10px] shrink-0 bg-white ${i === 0 ? 'ring-2 ring-green-400' : 'ring-1 ring-black/5'}`} iconClassName="text-xs" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13.5px] font-semibold leading-tight truncate">{it.descripcion}</p>
                                  <p className="text-[11.5px] text-white/60">S/ {formatoSoles(it.precioUnitario)} c/u</p>
                                </div>
                                <div className="flex items-center bg-white/[0.12] rounded-full shrink-0">
                                  <button type="button" onClick={() => cambiarCantidadCarrito(clave, -1)} className="w-[30px] h-[30px] flex items-center justify-center text-white" aria-label="Quitar uno">
                                    <IconoTrazo nombre="minus" className="w-[13px] h-[13px]" />
                                  </button>
                                  <span className="min-w-[22px] text-center text-[13.5px] font-bold tabular-nums">{it.cantidad}</span>
                                  <button type="button" onClick={() => cambiarCantidadCarrito(clave, 1)} className="w-[30px] h-[30px] flex items-center justify-center text-white" aria-label="Agregar uno">
                                    <IconoTrazo nombre="plus" className="w-[13px] h-[13px]" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => { setModalEscaner(false); setMostrarResumenMobile(true); }}
                            className="w-full h-[52px] mt-2.5 rounded-full bg-white hover:bg-[#f7f9ff] text-[#2d284b] flex items-center justify-between pl-[18px] pr-1.5 text-[14px] font-bold whitespace-nowrap transition"
                          >
                            Listo · ver venta
                            <span className="px-4 py-2.5 rounded-full bg-gradient-to-br from-[#7466e8] to-[#473bb5] text-white text-sm tabular-nums shadow-[0_8px_18px_-8px_rgba(91,75,214,0.8)]">S/ {formatoSoles(totalConDescuento)}</span>
                          </button>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
    </>
  );
}
