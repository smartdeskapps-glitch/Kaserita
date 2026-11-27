import React from 'react';
import VentanaModulo from './VentanaModulo.jsx';
import { IconoTrazo } from './pos/componentes.jsx';

// Estilos compartidos de la ventana (misma paleta que cobro, carrito y Fiados).
const CAMPO = 'bg-[#f3f5ff] rounded-full px-4 h-11 text-[14px] text-[#2d284b] placeholder:text-[#8f8cb0] outline-none focus:ring-2 focus:ring-[#c5bcff]';
const CAMPO_NUM = 'w-16 h-10 bg-[#f3f5ff] rounded-xl text-[14px] font-semibold text-[#2d284b] text-center outline-none focus:ring-2 focus:ring-[#c5bcff]';
const TARJETA = 'bg-white rounded-[20px] ring-1 ring-[#dde4fa]';
const BTN_PRIMARIO = 'h-12 bg-[#5b4bd6] hover:bg-[#473bb5] disabled:opacity-50 text-white font-bold text-sm rounded-full shadow-[0_8px_18px_-8px_rgba(91,75,214,0.6)] transition';
const BTN_SECUNDARIO = 'h-12 px-5 bg-[#f3f5ff] hover:bg-[#dde4fa] text-[#473bb5] font-bold text-sm rounded-full shrink-0 transition';

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
                <VentanaModulo
                  icono="fa-clipboard-check"
                  titulo="Toma de inventario"
                  subtitulo={pasoTomaInventario === 'conteo'
                    ? 'Busca cada producto y ve sumando lo que encuentres en cada lugar del local.'
                    : 'Revisa lo contado contra el sistema y guarda para ajustar el stock.'}
                  cifras={[
                    { etiqueta: 'Paso', valor: `${pasoTomaInventario === 'conteo' ? '1' : '2'} de 2` },
                    filasTomaInventario.length > 0 && { etiqueta: 'Productos contados', valor: filasTomaInventario.length },
                  ]}
                  acciones={filasTomaInventario.length > 0 && (
                    <button type="button" onClick={vaciarConteoInventario} className="h-9 px-3.5 rounded-full text-[12.5px] font-bold text-[#c0262d] hover:bg-[#fde0e5] shrink-0 transition">Vaciar</button>
                  )}
                  onClose={() => setModalTomaInventario(false)}
                  ancho="max-w-2xl"
                  desplazable={false}
                  flotante
                >
                  <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 gap-3.5">
                    <PestanasModal pestanas={[
                      { texto: 'Nueva toma', activa: true },
                      { texto: 'Historial', onClick: () => { setModalTomaInventario(false); abrirHistorialInventario(); } },
                    ]} />

                    {pasoTomaInventario === 'conteo' ? (
                      <>
                        <div className="flex gap-2 shrink-0">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Buscar o escanear producto..."
                              value={conteoFisicoBusqueda}
                              onChange={(e) => setConteoFisicoBusqueda(e.target.value)}
                              className={`w-full ${CAMPO}`}
                            />
                            {resultadosBusquedaConteo.length > 0 && (
                              <div className="absolute z-10 top-full left-0 right-0 mt-1.5 bg-white rounded-[18px] ring-1 ring-[#dde4fa] shadow-[0_14px_30px_-14px_rgba(45,40,75,0.4)] max-h-52 overflow-y-auto">
                                {resultadosBusquedaConteo.map((p) => {
                                  const yaContado = filasTomaInventario.find((f) => f.productoId === p.id);
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => agregarProductoAConteo(p)}
                                      className="w-full flex items-center justify-between gap-2 text-left px-4 py-3 text-[13px] text-[#2d284b] hover:bg-[#f3f5ff] border-b border-[#eef1fd] last:border-0"
                                    >
                                      <span className="truncate">{p.descripcion}</span>
                                      {yaContado && (
                                        <span className="shrink-0 text-[10.5px] font-bold text-[#473bb5] bg-[#f1efff] px-2 py-0.5 rounded-full">
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
                            aria-label="Escanear con la cámara"
                            className="shrink-0 w-11 h-11 grid place-items-center bg-[#f1efff] hover:bg-[#dde4fa] text-[#5b4bd6] rounded-full transition"
                          >
                            <IconoTrazo nombre="camara" className="w-[18px] h-[18px]" />
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2.5">
                          {filasTomaInventario.length === 0 ? (
                            <p className="text-[13px] text-[#8f8cb0] text-center py-8">Aún no agregas ningún producto al conteo.</p>
                          ) : (
                            <>
                              {(() => {
                                const f = filasTomaInventario[0];
                                const porPack = Number(f.pendienteUnidadesPorPack) || 1;
                                const totalPendiente = (Number(f.pendientePacks) || 0) * porPack + (Number(f.pendienteSueltas) || 0);
                                return (
                                  <div className="p-3.5 bg-white rounded-[22px] ring-2 ring-[#c5bcff] shadow-[0_10px_24px_-16px_rgba(91,75,214,0.5)] space-y-3">
                                    <div className="flex items-center gap-2">
                                      <p className="flex-1 min-w-0 text-[14px] font-bold text-[#2d284b] truncate">{f.descripcion}</p>
                                      <span className={`text-[12.5px] font-bold shrink-0 ${f.stockContado === '' ? 'text-[#8f8cb0]' : 'text-[#473bb5]'}`}>
                                        {f.stockContado === '' ? 'Sin contar' : `${f.stockContado} und`}
                                      </span>
                                      <button aria-label="Quitar del conteo" onClick={() => quitarProductoDeConteo(f.productoId)} className="w-8 h-8 grid place-items-center rounded-full text-[#8f8cb0] hover:bg-[#fde0e5] hover:text-[#c0262d] shrink-0 transition">
                                        <IconoTrazo nombre="papelera" className="w-4 h-4" />
                                      </button>
                                    </div>

                                    {f.historial.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {f.historial.map((h) => (
                                          <span key={h.id} className="inline-flex items-center gap-1 bg-[#f1efff] rounded-full pl-2.5 pr-1 py-0.5 text-[12px] font-semibold text-[#473bb5]">
                                            +{h.cantidad}
                                            <button aria-label="Quitar este conteo" onClick={() => quitarHallazgo(f.productoId, h.id)} className="w-5 h-5 grid place-items-center rounded-full text-[#8f8cb0] hover:bg-white hover:text-[#c0262d]">
                                              <IconoTrazo nombre="x" className="w-2.5 h-2.5" grosor={2.6} />
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="flex flex-col items-center gap-0.5">
                                        <input
                                          type="number"
                                          inputMode="numeric"
                                          ref={(el) => { refsPendientesConteo.current[f.productoId] = el; }}
                                          placeholder="0"
                                          value={f.pendientePacks}
                                          onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendientePacks', e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') agregarHallazgo(f.productoId); }}
                                          className={CAMPO_NUM}
                                        />
                                        <span className="text-[10.5px] text-[#8f8cb0]">packs</span>
                                      </div>
                                      <span className="text-[11px] text-[#8f8cb0] -mt-4">de</span>
                                      <div className="flex flex-col items-center gap-0.5">
                                        {editandoPackParaId === f.productoId ? (
                                          <input
                                            type="number"
                                            inputMode="numeric"
                                            autoFocus
                                            placeholder="1"
                                            value={f.pendienteUnidadesPorPack}
                                            onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendienteUnidadesPorPack', e.target.value)}
                                            onBlur={() => setEditandoPackParaId(null)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') setEditandoPackParaId(null); }}
                                            className={`${CAMPO_NUM} ring-2 ring-[#c5bcff]`}
                                          />
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setEditandoPackParaId(f.productoId)}
                                            title="Tocar para cambiar las unidades por pack"
                                            className="w-16 h-10 bg-[#ebf0ff] hover:bg-[#dde4fa] rounded-xl text-[14px] font-bold text-[#473bb5] transition"
                                          >
                                            x{f.pendienteUnidadesPorPack || 1}
                                          </button>
                                        )}
                                        <span className="text-[10.5px] text-[#8f8cb0]">
                                          {editandoPackParaId === f.productoId ? 'und c/u' : 'und c/u · tocar'}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-[#8f8cb0] -mt-4">+</span>
                                      <div className="flex flex-col items-center gap-0.5">
                                        <input
                                          type="number"
                                          inputMode="numeric"
                                          placeholder="0"
                                          value={f.pendienteSueltas}
                                          onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendienteSueltas', e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') agregarHallazgo(f.productoId); }}
                                          className={CAMPO_NUM}
                                        />
                                        <span className="text-[10.5px] text-[#8f8cb0]">sueltas</span>
                                      </div>
                                      <span className="text-[15px] font-bold text-[#2d284b] tabular-nums ml-auto shrink-0">= {totalPendiente} und</span>
                                    </div>
                                    <button onClick={() => agregarHallazgo(f.productoId)} className="w-full h-11 inline-flex items-center justify-center gap-1.5 bg-[#5b4bd6] hover:bg-[#473bb5] text-white rounded-full text-[13px] font-bold transition">
                                      <IconoTrazo nombre="plus" className="w-4 h-4" grosor={2.4} /> Agregar
                                    </button>
                                  </div>
                                );
                              })()}

                              {filasTomaInventario.length > 1 && (
                                <div className={`${TARJETA} overflow-hidden shrink-0`}>
                                  <button
                                    onClick={() => setHistorialConteoAbierto((v) => !v)}
                                    className="w-full flex items-center justify-between px-4 h-11 bg-[#f3f5ff] hover:bg-[#ebf0ff] text-[13px] font-bold text-[#2d284b] transition"
                                  >
                                    <span>Contados antes ({filasTomaInventario.length - 1})</span>
                                    <IconoTrazo nombre="abajo" className={`w-4 h-4 text-[#8f8cb0] transition-transform ${historialConteoAbierto ? 'rotate-180' : ''}`} />
                                  </button>
                                  {historialConteoAbierto && (
                                    <div className="divide-y divide-[#eef1fd] max-h-44 overflow-y-auto">
                                      {filasTomaInventario.slice(1).map((f) => (
                                        <div key={f.productoId} className="flex items-center gap-2 px-4 py-2.5 bg-white text-[13px]">
                                          <span className="flex-1 min-w-0 truncate text-[#2d284b]">{f.descripcion}</span>
                                          <span className={`font-bold shrink-0 ${f.stockContado === '' ? 'text-[#8f8cb0]' : 'text-[#473bb5]'}`}>
                                            {f.stockContado === '' ? 'Sin contar' : `${f.stockContado} und`}
                                          </span>
                                          <button
                                            onClick={() => promoverAActivoConteo(f.productoId)}
                                            className="shrink-0 text-[11.5px] font-bold text-[#473bb5] bg-[#f1efff] hover:bg-[#dde4fa] px-3 h-8 rounded-full transition"
                                          >
                                            Sumar más
                                          </button>
                                          <button aria-label="Quitar del conteo" onClick={() => quitarProductoDeConteo(f.productoId)} className="shrink-0 w-8 h-8 grid place-items-center rounded-full text-[#8f8cb0] hover:bg-[#fde0e5] hover:text-[#c0262d] transition">
                                            <IconoTrazo nombre="papelera" className="w-4 h-4" />
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
                          className={`w-full inline-flex items-center justify-center gap-2 shrink-0 ${BTN_PRIMARIO}`}
                        >
                          {filasTomaInventario.length === 0 ? 'Agrega al menos un producto' : `Continuar a Revisión (${filasTomaInventario.length})`}
                          {filasTomaInventario.length > 0 && <IconoTrazo nombre="flecha" className="w-4 h-4" grosor={2.4} />}
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
                            className={`flex-1 min-w-0 ${CAMPO}`}
                          />
                          <select
                            value={tomaInventarioCategoria}
                            onChange={(e) => setTomaInventarioCategoria(e.target.value)}
                            className={`min-w-0 max-w-[46%] truncate font-semibold ${CAMPO}`}
                          >
                            <option value="">Todas las categorías</option>
                            {categoriasDB.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                          {filasTomaInventarioVisibles.length === 0 ? (
                            <p className="text-[13px] text-[#8f8cb0] text-center py-8">No hay productos que coincidan.</p>
                          ) : (
                            filasTomaInventarioVisibles.map((f) => {
                              const diferencia = f.stockContado === '' ? null : (Number(f.stockContado) || 0) - f.stockSistema;
                              return (
                                <div key={f.productoId} className={`flex items-center gap-3 p-3 ${TARJETA}`}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13.5px] font-semibold text-[#2d284b] truncate">{f.descripcion}</p>
                                    <p className="text-[12px] text-[#8f8cb0] tabular-nums">Sistema: {f.stockSistema}</p>
                                  </div>
                                  <input
                                    type="number"
                                    step="0.10"
                                    inputMode="decimal"
                                    placeholder="Contado"
                                    value={f.stockContado}
                                    onChange={(e) => actualizarStockContado(f.productoId, e.target.value)}
                                    className="w-24 h-10 bg-[#f3f5ff] rounded-xl px-3 text-[14px] font-semibold text-[#2d284b] text-right tabular-nums placeholder:font-normal placeholder:text-[#8f8cb0] outline-none focus:ring-2 focus:ring-[#c5bcff]"
                                  />
                                  <span className={`min-w-[3rem] text-center text-[12.5px] font-bold tabular-nums rounded-full px-2 py-1 ${
                                    diferencia === null || diferencia === 0 ? 'text-[#8f8cb0]' : diferencia > 0 ? 'text-[#0f7b4a] bg-[#e4f6ec]' : 'text-[#c0262d] bg-[#fde0e5]'
                                  }`}>
                                    {diferencia === null ? '—' : diferencia > 0 ? `+${diferencia}` : diferencia}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <p className="text-[12px] text-[#8f8cb0] shrink-0 flex items-start justify-center gap-1.5 text-center">
                          <IconoTrazo nombre="info" className="w-3.5 h-3.5 mt-px shrink-0" />
                          <span>Al guardar, el stock del sistema se ajusta solo para que quede igual al contado.</span>
                        </p>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => setPasoTomaInventario('conteo')}
                            className={`inline-flex items-center gap-1.5 ${BTN_SECUNDARIO}`}
                          >
                            <IconoTrazo nombre="back" className="w-4 h-4" grosor={2.4} /> Seguir contando
                          </button>
                          <button
                            onClick={guardarTomaInventario}
                            disabled={guardandoTomaInventario}
                            className={`flex-1 ${BTN_PRIMARIO}`}
                          >
                            {guardandoTomaInventario ? 'Guardando...' : 'Guardar y Ajustar Stock'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </VentanaModulo>
              )}
    </>
  );
}
