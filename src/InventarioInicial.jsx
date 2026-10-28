import React from 'react';
import { FotoProducto, estiloCategoria } from './PanelAdminCompartido.jsx';
import { esMontoNoNegativo } from './lib/validaciones.js';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function InventarioInicial({
  abrirEscanerParaFilaInventario,
  actualizarCodigoEanFila,
  actualizarCodigoEanPackFila,
  actualizarFilaInventario,
  agregarCategoriaPersonalizada,
  categoriasDB,
  desvincularFilaInventario,
  eliminarFilaInventario,
  esBarberia,
  filaInventarioExpandidaIdx,
  filasInventario,
  guardandoInventario,
  guardarInventarioInicial,
  modalInventarioInicial,
  notificar,
  pasoInventario,
  productos,
  sesion,
  setFilaInventarioExpandidaIdx,
  setFilasInventario,
  setModalInventarioInicial,
  setPasoInventario,
  subiendoFotoFilaIdx,
  subirFotoFilaInventario,
  sugerenciasMaestroParaFila,
  sugerenciasParaFila,
  sugerenciasParaFilaPack,
  usarSugerenciaMaestraEnFila,
  vincularProductoExistenteEnFila,
}) {
  return (
    <>
              {/* Modal: Inventario Inicial (carga de varios productos a la vez) */}
              {modalInventarioInicial && (() => {
                // Registrar productos con stepper: una ficha a la vez (producto -> precio -> revisar).
                // La ficha activa es filasInventario[filaInventarioExpandidaIdx]; las demás ya
                // cargadas se ven arriba como "En esta carga" y se guardan todas juntas al final.
                const idx = filasInventario[filaInventarioExpandidaIdx] ? filaInventarioExpandidaIdx : 0;
                const fila = filasInventario[idx];
                const esExistente = !!fila.productoExistenteId;
                const tipoActual = fila.tipoItem || 'servicio';
                const esServicio = esBarberia && tipoActual !== 'producto';
                const esProductoBarberia = esBarberia && tipoActual === 'producto';
                const duracionTexto = String(fila.duracion_min ?? '').trim();
                const duracionOk = duracionTexto === '' || (Number.isInteger(Number(duracionTexto)) && Number(duracionTexto) >= 5 && Number(duracionTexto) <= 480);
                // La categoría por defecto de una ficha nueva ("Abarrotes") solo vale si esta bodega la tiene; en una barbería, por ejemplo, hay que elegir una.
                const categoriaElegida = !!fila.categoria && (categoriasDB.includes(fila.categoria) || esExistente || !!fila.catalogoMaestroId);
                const ok1 = fila.descripcion.trim().length >= 2 && categoriaElegida;
                const ok2 = Number(fila.precio_venta) > 0
                  && esMontoNoNegativo(fila.precio_costo)
                  && (!fila.vendeEnPack || (Number(fila.unidades_por_pack) >= 2 && Number(fila.precio_venta_pack) > 0))
                  && (!esServicio || duracionOk)
                  && (!esProductoBarberia || esMontoNoNegativo(fila.stock_inicial || '0'));
                const paso = pasoInventario;
                const puedeAvanzar = paso === 1 ? ok1 : paso === 2 ? (ok1 && ok2) : true;
                const pasosInfo = esBarberia
                  ? [['Qué es', 'Servicio o producto'], ['Precio', 'Y duración o stock'], ['Revisar', 'Y guardar']]
                  : [['Producto', 'Identificación'], ['Precio', 'Y forma de venta'], ['Revisar', 'Y guardar']];
                const validoHasta = (n) => (n <= 1 ? true : n === 2 ? ok1 : ok1 && ok2);
                const irAPaso = (n) => {
                  if (n < 1 || n > 3 || guardandoInventario) return;
                  if (n > paso && !validoHasta(n)) {
                    notificar(paso === 1 ? 'Completa el nombre y la categoría para seguir.' : 'Pon el precio de venta para seguir.', 'error');
                    return;
                  }
                  setPasoInventario(n);
                };
                const sugerencias = sugerenciasParaFila(fila);
                const sugerenciasMaestro = sugerenciasMaestroParaFila(fila);
                const sugerenciasPack = sugerenciasParaFilaPack(fila);
                const pv = Number(fila.precio_venta) || 0;
                const pc = Number(fila.precio_costo) || 0;
                const margenPct = pv > 0 && pc > 0 ? ((pv - pc) / pv) * 100 : null;
                const unidadTexto = esBarberia ? (esServicio ? `${Number(fila.duracion_min) || 30} min` : 'unidad') : (fila.unidad === 'KG' ? 'por kg' : 'por unidad');
                // Las demás fichas de esta carga (las que ya tienen nombre).
                const listos = filasInventario.map((f, i) => ({ f, i })).filter(({ f, i }) => i !== idx && f.descripcion.trim());
                const incompletas = listos.filter(({ f }) => !(Number(f.precio_venta) > 0)).length;
                const totalAGuardar = listos.filter(({ f }) => Number(f.precio_venta) > 0).length + (ok1 && ok2 ? 1 : 0);
                const checklist = [
                  ['Nombre', fila.descripcion.trim().length >= 2, 30],
                  ['Categoría', categoriaElegida, 15],
                  ['Precio de venta', pv > 0, 30],
                  ['Costo (para ver tu ganancia)', pc > 0, 10],
                  ['Foto (vende más)', !!fila.foto_url, 10],
                  ['Código de barras', !!(fila.cod_ean || '').trim(), 5]
                ];
                const completitud = checklist.reduce((a, [, ok, pts]) => a + (ok ? pts : 0), 0);
                const inputBase = 'w-full h-11 bg-stone-50/70 border-[1.5px] border-stone-200 rounded-[14px] px-3.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#5b4bd6] focus:bg-white focus:ring-4 focus:ring-[#5b4bd6]/15 transition disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed';
                const chipClase = (activo) => `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold border-[1.5px] transition disabled:opacity-50 disabled:cursor-not-allowed ${activo ? 'border-[#5b4bd6] bg-[#ebf0ff] text-[#2d284b] ring-2 ring-[#5b4bd6]/15' : 'border-stone-200 bg-white text-stone-600 hover:bg-[#ebf0ff] hover:border-[#d2d9f5]'}`;
                const segClase = (activo) => `rounded-[11px] py-2.5 px-2 text-[13px] font-bold transition text-center disabled:opacity-50 disabled:cursor-not-allowed ${activo ? 'bg-white text-[#2d284b] shadow-sm' : 'text-stone-500 hover:text-stone-700'}`;
                const etiqueta = 'flex items-center justify-between gap-2 text-[12.5px] font-semibold text-stone-800 mb-1.5';
                const categoriasChips = (() => {
                  const base = categoriasDB.slice(0, 6);
                  return categoriaElegida && !base.includes(fila.categoria) ? [...base, fila.categoria] : base;
                })();
                const filaVaciaConDatos = (f) => f.descripcion.trim() || Number(f.precio_venta) > 0;
                const guardarYAgregarOtro = () => {
                  const { categoria, tipoItem } = fila;
                  setFilasInventario((prev) => {
                    setFilaInventarioExpandidaIdx(prev.length);
                    return [...prev, { ...filaInventarioVacia(), categoria, ...(esBarberia ? { tipoItem } : {}) }];
                  });
                  setPasoInventario(1);
                  notificar(`"${fila.descripcion.trim()}" agregado a esta carga.`, 'success');
                };
                const editarListo = (i, f) => {
                  setFilaInventarioExpandidaIdx(i);
                  setPasoInventario(f.descripcion.trim().length >= 2 && Number(f.precio_venta) > 0 ? 3 : 1);
                };
                const fotoDeshabilitada = sesion?.bodega?.permitir_subir_fotos === false;

                return (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                  <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-4xl w-full shadow-2xl h-[95vh] max-h-[820px] flex flex-col overflow-hidden">

                    {/* Cabecera + stepper */}
                    <div className="bg-white border-b border-stone-100 px-4 sm:px-5 pt-3.5 shrink-0">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl bg-[#5b4bd6] text-white flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-boxes-stacked text-sm"></i>
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-[17px] font-extrabold text-stone-900 tracking-tight leading-tight">{esBarberia ? 'Registrar Servicios y Productos' : 'Registrar Productos'}</h3>
                          <p className="hidden sm:block text-xs text-stone-500">Crea el producto en 3 pasos rápidos.</p>
                        </div>
                        <button onClick={() => setModalInventarioInicial(false)} aria-label="Cerrar" className="ml-auto w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors shrink-0"><i className="fa-solid fa-xmark"></i></button>
                      </div>
                      <ol className="flex items-start mt-3.5 pb-3.5">
                        {pasosInfo.map(([titulo, sub], i) => {
                          const n = i + 1;
                          const estado = n < paso ? 'hecho' : n === paso ? 'activo' : 'pendiente';
                          return (
                            <li key={n} className="flex-1 relative flex flex-col items-center text-center min-w-0">
                              {i > 0 && <span className={`absolute top-[17px] right-1/2 w-full h-[3px] rounded-full transition-colors duration-500 ${n <= paso ? 'bg-[#5b4bd6]' : 'bg-stone-200'}`}></span>}
                              <button
                                type="button"
                                onClick={() => irAPaso(n)}
                                aria-label={`Paso ${n}: ${titulo}`}
                                aria-current={estado === 'activo' ? 'step' : undefined}
                                className={`relative z-[1] w-9 h-9 rounded-full grid place-items-center border-2 text-sm font-extrabold transition ${estado === 'hecho' ? 'bg-[#5b4bd6] border-[#5b4bd6] text-white' : estado === 'activo' ? 'bg-white border-[#5b4bd6] text-[#5b4bd6] ring-[6px] ring-[#5b4bd6]/15' : 'bg-white border-stone-200 text-stone-400'}`}
                              >
                                {estado === 'hecho' ? <i className="fa-solid fa-check text-xs"></i> : n}
                              </button>
                              <span className={`mt-2 text-[13px] font-bold ${estado === 'pendiente' ? 'text-stone-400' : 'text-stone-900'} ${estado !== 'activo' ? 'hidden sm:block' : ''}`}>{titulo}</span>
                              <span className="hidden sm:block text-[11px] text-stone-400">{sub}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </div>

                    {/* En esta carga */}
                    {listos.length > 0 && (
                      <div className="bg-white border-b border-stone-100 px-4 sm:px-5 py-2 flex items-center gap-2 overflow-x-auto hide-scrollbar shrink-0">
                        <span className="text-[11.5px] font-bold text-stone-500 whitespace-nowrap">En esta carga ({listos.length})</span>
                        {listos.map(({ f, i }) => {
                          const sinPrecio = !(Number(f.precio_venta) > 0);
                          return (
                            <span key={f.id || i} className={`inline-flex items-center gap-1.5 rounded-full border pl-1 pr-1 py-0.5 text-xs font-semibold whitespace-nowrap ${sinPrecio ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-[#ebf0ff] border-[#d2d9f5] text-[#2d284b]'}`}>
                              <button type="button" onClick={() => editarListo(i, f)} title="Tocar para editar" className="inline-flex items-center gap-1.5">
                                <FotoProducto fotoUrl={f.foto_url} categoria={f.categoria} className="w-5 h-5 rounded-full shrink-0" iconClassName="text-[8px]" />
                                <span className="max-w-[140px] truncate">{f.descripcion}</span>
                                <span className="font-medium opacity-70">{sinPrecio ? 'sin precio' : `S/ ${Number(f.precio_venta).toFixed(2)}`}</span>
                              </button>
                              <button type="button" onClick={() => eliminarFilaInventario(i)} aria-label="Quitar de la carga" className="w-[18px] h-[18px] rounded-full flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-white"><i className="fa-solid fa-xmark text-[9px]"></i></button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Cuerpo: formulario del paso + vista previa */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid gap-4 md:gap-5 md:grid-cols-[minmax(0,1fr)_280px] content-start">
                      <div className="min-w-0 order-2 md:order-1">
                        <div className="bg-white border border-stone-100 rounded-[22px] p-4 sm:p-5 shadow-sm">

                          {paso === 1 && (
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-[17px] font-extrabold text-stone-900 tracking-tight">{esBarberia ? '¿Qué vas a registrar?' : 'Identifica el producto'}</h4>
                                <p className="text-[12.5px] text-stone-500 mt-0.5">{esBarberia ? 'Elige el tipo y ponle nombre. Lo demás viene en el siguiente paso.' : 'Escanea el código o escribe el nombre. Si ya existe, lo reconocemos.'}</p>
                              </div>

                              {esBarberia && !esExistente && (
                                <div className="grid grid-flow-col auto-cols-fr bg-[#eef1fb] rounded-[14px] p-1 gap-1">
                                  {[['servicio', 'Servicio', 'Sin stock (corte, barba…)'], ['producto', 'Producto', 'Con stock (pomada…)']].map(([valor, titulo, ayuda]) => (
                                    <button key={valor} type="button" onClick={() => actualizarFilaInventario(idx, 'tipoItem', valor)} className={segClase(tipoActual === valor)}>
                                      {titulo}
                                      <span className="block text-[11px] font-medium opacity-80">{ayuda}</span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {!esServicio && (
                                <div>
                                  <label className={etiqueta}><span>Código de barras</span><span className="text-stone-400 font-normal">opcional</span></label>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="Escanea o escribe el código..."
                                      value={fila.cod_ean}
                                      disabled={esExistente}
                                      onChange={(e) => actualizarCodigoEanFila(idx, e.target.value)}
                                      className={`${inputBase} pr-28`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => abrirEscanerParaFilaInventario(idx)}
                                      disabled={esExistente}
                                      className="absolute inset-y-1 right-1 px-3 bg-[#ebf0ff] hover:bg-[#dde4fa] text-[#2d284b] disabled:opacity-40 rounded-[10px] text-xs font-bold flex items-center gap-1.5 border border-[#d2d9f5] transition active:scale-95"
                                      title="Escanear código de barras"
                                    >
                                      <i className="fa-solid fa-camera text-xs"></i> Escanear
                                    </button>
                                  </div>
                                </div>
                              )}

                              {esExistente && (
                                <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-[14px] px-3 py-2.5 text-[12.5px] font-semibold">
                                  <span><i className="fa-solid fa-circle-check mr-1.5"></i>Ya está en tus productos: se actualizará</span>
                                  <button type="button" onClick={() => desvincularFilaInventario(idx)} className="underline text-xs shrink-0">Desvincular</button>
                                </div>
                              )}

                              <div className="relative">
                                <label className={etiqueta}>
                                  <span>{esBarberia ? 'Nombre' : 'Nombre del producto'} <span className="text-rose-500">*</span></span>
                                  {!esBarberia && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5b4bd6]"><i className="fa-solid fa-wand-magic-sparkles"></i> Sugeridos por Kaserita</span>}
                                </label>
                                <input
                                  type="text"
                                  autoComplete="off"
                                  placeholder={esBarberia ? (esServicio ? 'Ej: Corte fade' : 'Ej: Pomada mate 100g') : 'Ej: Leche Gloria Entera 400g...'}
                                  value={fila.descripcion}
                                  disabled={esExistente}
                                  onChange={(e) => actualizarFilaInventario(idx, 'descripcion', e.target.value)}
                                  className={inputBase}
                                />
                                {(sugerencias.length > 0 || sugerenciasMaestro.length > 0) && (
                                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                                    {sugerencias.length > 0 && (
                                      <div className="px-3.5 pt-2 pb-1 text-[10px] font-bold text-stone-500 uppercase tracking-wide bg-stone-50">Tus productos</div>
                                    )}
                                    {sugerencias.map((s) => (
                                      <button type="button" key={`propio-${s.id}`} onClick={() => vincularProductoExistenteEnFila(idx, s)} className="w-full text-left px-3.5 py-2 text-[13px] text-stone-800 hover:bg-[#ebf0ff] flex items-center gap-2">
                                        <span className="truncate flex-1 font-semibold">{s.descripcion}</span>
                                        <span className="text-stone-500 shrink-0 text-xs">S/ {Number(s.precio_venta).toFixed(2)}</span>
                                        <span className="shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700">Tuyo</span>
                                      </button>
                                    ))}
                                    {sugerenciasMaestro.length > 0 && (
                                      <div className="px-3.5 pt-2 pb-1 text-[10px] font-bold text-stone-500 uppercase tracking-wide bg-stone-50">Productos de Kaserita</div>
                                    )}
                                    {sugerenciasMaestro.map((s) => (
                                      <button type="button" key={`maestro-${s.id}`} onClick={() => usarSugerenciaMaestraEnFila(idx, s)} className="w-full text-left px-3.5 py-2 text-[13px] text-stone-800 hover:bg-[#ebf0ff] flex items-center gap-2">
                                        <FotoProducto fotoUrl={s.foto_url} categoria={s.categoria} className="w-7 h-7 rounded-md shrink-0" iconClassName="text-[10px]" />
                                        <span className="truncate flex-1 font-semibold">{s.descripcion}</span>
                                        <span className="text-stone-500 shrink-0 text-[11px]">{s.categoria}</span>
                                        <span className="shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 bg-[#ebf0ff] text-[#2d284b]">Sugerido</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className={etiqueta}><span>Categoría <span className="text-rose-500">*</span></span></label>
                                <div className="flex flex-wrap gap-2">
                                  {categoriasChips.map((c) => (
                                    <button key={c} type="button" disabled={esExistente} onClick={() => actualizarFilaInventario(idx, 'categoria', c)} className={chipClase(categoriaElegida && fila.categoria === c)}>
                                      <i className={`fa-solid ${estiloCategoria(c).icono} text-[11px]`}></i>{c}
                                    </button>
                                  ))}
                                  {!esExistente && (
                                    <button type="button" onClick={() => agregarCategoriaPersonalizada((v) => actualizarFilaInventario(idx, 'categoria', v))} className={`${chipClase(false)} border-dashed text-stone-500`}>
                                      <i className="fa-solid fa-plus text-[10px]"></i> Nueva
                                    </button>
                                  )}
                                </div>
                                {categoriasDB.length > 6 && !esExistente && (
                                  <select
                                    value={categoriaElegida ? fila.categoria : ''}
                                    onChange={(e) => actualizarFilaInventario(idx, 'categoria', e.target.value)}
                                    className="mt-2 h-9 bg-stone-50/70 border border-stone-200 rounded-xl px-3 text-xs text-stone-600"
                                    aria-label="Ver todas las categorías"
                                  >
                                    {!categoriaElegida && <option value="" disabled>Ver todas las categorías…</option>}
                                    {categoriasDB.map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                )}
                              </div>

                              {!esExistente && (
                                <div>
                                  <label className={etiqueta}><span>Foto</span><span className="text-stone-400 font-normal">opcional</span></label>
                                  {fotoDeshabilitada ? (
                                    <div className="flex items-center gap-3">
                                      <FotoProducto fotoUrl={fila.foto_url} categoria={fila.categoria} className="w-16 h-16 rounded-xl shrink-0 border border-stone-200" iconClassName="text-xl" />
                                      <p className="text-[11px] text-stone-500">La subida de fotos está desactivada para tu negocio.</p>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-3.5">
                                      <FotoProducto fotoUrl={fila.foto_url} categoria={fila.categoria} className="w-[76px] h-[76px] rounded-[18px] shrink-0 border-2 border-dashed border-stone-200" iconClassName="text-2xl" />
                                      <div className="flex-1 flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                          <label className="flex-1 cursor-pointer py-2 px-2.5 rounded-xl border-[1.5px] border-stone-200 bg-white hover:bg-[#ebf0ff] text-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition">
                                            {subiendoFotoFilaIdx === idx ? <i className="fa-solid fa-spinner fa-spin text-stone-500 text-xs"></i> : <i className="fa-solid fa-camera text-stone-500 text-xs"></i>}
                                            <span>Cámara</span>
                                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (file) subirFotoFilaInventario(idx, file); }} />
                                          </label>
                                          <label className="flex-1 cursor-pointer py-2 px-2.5 rounded-xl border-[1.5px] border-stone-200 bg-white hover:bg-[#ebf0ff] text-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition">
                                            <i className="fa-solid fa-image text-stone-500 text-xs"></i>
                                            <span>Galería</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (file) subirFotoFilaInventario(idx, file); }} />
                                          </label>
                                        </div>
                                        <p className="text-[11px] text-stone-400">O pega una imagen directamente desde el portapapeles (Ctrl+V)</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {paso === 2 && (
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-[17px] font-extrabold text-stone-900 tracking-tight">{esServicio ? 'Precio y duración' : 'Precio y forma de venta'}</h4>
                                <p className="text-[12.5px] text-stone-500 mt-0.5">{esServicio ? 'La duración se usa en la agenda de reservas.' : 'Pon el precio y, si quieres, tu costo para ver la ganancia.'}</p>
                              </div>

                              <div>
                                <label className={etiqueta}><span>Precio de venta{esBarberia ? '' : ' por unidad'} <span className="text-rose-500">*</span></span></label>
                                <div className="flex items-baseline gap-2.5 rounded-[20px] bg-stone-50/70 border-2 border-stone-200 focus-within:border-[#5b4bd6] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#5b4bd6]/15 transition px-4 py-3">
                                  <span className="text-xl font-extrabold text-stone-300 select-none">S/</span>
                                  <input
                                    type="number"
                                    step="0.10"
                                    min="0"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={fila.precio_venta}
                                    onChange={(e) => actualizarFilaInventario(idx, 'precio_venta', e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && ok2) irAPaso(3); }}
                                    className="w-full min-w-0 bg-transparent border-0 p-0 text-[34px] sm:text-[40px] leading-tight font-extrabold tracking-tight text-stone-900 placeholder:text-stone-300 focus:ring-0 focus:outline-none"
                                  />
                                  <span className="text-[11px] font-bold tracking-widest text-stone-300">PEN</span>
                                </div>
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                  <label className={etiqueta}><span>Costo{esServicio ? ' de insumos' : ''}</span><span className="text-stone-400 font-normal">opcional</span></label>
                                  <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-stone-300 pointer-events-none">S/</span>
                                    <input type="number" step="0.10" min="0" inputMode="decimal" placeholder="0.00" value={fila.precio_costo} onChange={(e) => actualizarFilaInventario(idx, 'precio_costo', e.target.value)} className={`${inputBase} pl-9`} />
                                  </div>
                                  {margenPct !== null && (
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 mt-2 text-[11.5px] font-bold ${margenPct < 0 ? 'bg-rose-50 text-rose-600' : margenPct < 10 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                      Ganancia S/ {(pv - pc).toFixed(2)} · {margenPct.toFixed(0)}%{margenPct < 0 ? ' (pérdida)' : margenPct < 10 ? ' (bajo)' : ''}
                                    </span>
                                  )}
                                </div>

                                {esServicio ? (
                                  <div>
                                    <label className={etiqueta}><span>Duración del servicio</span></label>
                                    <div className="flex flex-wrap gap-2">
                                      {[15, 30, 45, 60, 90].map((m) => (
                                        <button key={m} type="button" onClick={() => actualizarFilaInventario(idx, 'duracion_min', String(m))} className={chipClase(Number(fila.duracion_min) === m)}>{m} min</button>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                      <input type="number" min="5" max="480" step="5" placeholder="Otra" value={fila.duracion_min || ''} onChange={(e) => actualizarFilaInventario(idx, 'duracion_min', e.target.value)} className="w-24 h-9 bg-stone-50/70 border border-stone-200 rounded-xl px-3 text-xs" />
                                      <span className="text-[11px] text-stone-500">minutos · vacío = 30</span>
                                    </div>
                                    {!duracionOk && <p className="text-[11px] text-rose-600 mt-1">Escribe un número de 5 a 480 minutos.</p>}
                                  </div>
                                ) : esProductoBarberia ? (
                                  <div>
                                    <label className={etiqueta}><span>Cantidad que tienes ahora</span></label>
                                    <div className="inline-flex items-center border-[1.5px] border-stone-200 rounded-[14px] overflow-hidden bg-stone-50/70">
                                      <button type="button" aria-label="Menos" onClick={() => actualizarFilaInventario(idx, 'stock_inicial', String(Math.max(0, (Number(fila.stock_inicial) || 0) - 1)))} className="w-11 h-11 grid place-items-center text-[#2d284b] hover:bg-[#ebf0ff]"><i className="fa-solid fa-minus text-xs"></i></button>
                                      <input type="number" min="0" step="1" value={fila.stock_inicial || ''} placeholder="0" onChange={(e) => actualizarFilaInventario(idx, 'stock_inicial', e.target.value)} className="w-20 h-11 text-center font-bold text-sm bg-white border-x-[1.5px] border-stone-200 outline-none" />
                                      <button type="button" aria-label="Más" onClick={() => actualizarFilaInventario(idx, 'stock_inicial', String((Number(fila.stock_inicial) || 0) + 1))} className="w-11 h-11 grid place-items-center text-[#2d284b] hover:bg-[#ebf0ff]"><i className="fa-solid fa-plus text-xs"></i></button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <label className={etiqueta}><span>Se vende por</span></label>
                                    <div className="grid grid-flow-col auto-cols-fr bg-[#eef1fb] rounded-[14px] p-1 gap-1">
                                      <button type="button" disabled={esExistente} onClick={() => actualizarFilaInventario(idx, 'unidad', 'UND')} className={segClase(fila.unidad !== 'KG')}>Unidad</button>
                                      <button type="button" disabled={esExistente} onClick={() => actualizarFilaInventario(idx, 'unidad', 'KG')} className={segClase(fila.unidad === 'KG')}>Peso (KG)<span className="block text-[11px] font-medium opacity-80">balanza</span></button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {pc > 0 && (
                                <div className="rounded-2xl border border-dashed border-[#d2d9f5] bg-[#f8faff] px-3.5 py-3">
                                  <p className="text-xs font-semibold text-stone-500 mb-2">Precio sugerido según tu margen</p>
                                  <div className="flex flex-wrap gap-2">
                                    {[20, 30, 40].map((m) => {
                                      const sugerido = Math.ceil((pc / (1 - m / 100)) * 10) / 10;
                                      return (
                                        <button key={m} type="button" onClick={() => actualizarFilaInventario(idx, 'precio_venta', sugerido.toFixed(2))} className={chipClase(Math.abs(pv - sugerido) < 0.005)}>
                                          Ganar {m}% → S/ {sugerido.toFixed(2)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Venta por pack: la misma bolsa de stock sirve para vender el pack
                                  cerrado o unidades sueltas si se abre -- se descuenta en unidades base. */}
                              {!esBarberia && fila.unidad !== 'KG' && (
                                <div>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={!!fila.vendeEnPack}
                                    onClick={() => actualizarFilaInventario(idx, 'vendeEnPack', !fila.vendeEnPack)}
                                    className={`w-full flex items-center justify-between gap-3 text-left rounded-2xl border-[1.5px] px-3.5 py-3 transition ${fila.vendeEnPack ? 'border-[#5b4bd6] bg-[#f8faff]' : 'border-stone-200 bg-white hover:bg-stone-50'}`}
                                  >
                                    <span>
                                      <span className="block text-[13.5px] font-bold text-stone-800">También lo vendo en pack o caja cerrada</span>
                                      <span className="block text-xs text-stone-500">Ideal para six-packs de cerveza, displays x12 o cajas x24 con precio especial.</span>
                                    </span>
                                    <span className={`relative w-[42px] h-6 rounded-full shrink-0 transition-colors ${fila.vendeEnPack ? 'bg-[#5b4bd6]' : 'bg-stone-300'}`}>
                                      <span className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${fila.vendeEnPack ? 'translate-x-[18px]' : ''}`}></span>
                                    </span>
                                  </button>
                                  {esExistente && fila.vendeEnPackOriginal && !fila.vendeEnPack && (
                                    <p className="text-[11px] text-rose-600 font-semibold mt-1.5">
                                      <i className="fa-solid fa-triangle-exclamation mr-1"></i> Este producto ya vendía por pack: al guardar se le va a quitar esa configuración.
                                    </p>
                                  )}
                                  {fila.vendeEnPack && (
                                    <div className="mt-2.5 p-3.5 bg-white border border-stone-200 rounded-2xl space-y-3">
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                          <label className="text-[11px] font-semibold text-stone-500 block mb-1">¿De cuántas unidades es el pack?</label>
                                          <input type="number" step="1" min="2" placeholder="Ej: 6" value={fila.unidades_por_pack} onChange={(e) => actualizarFilaInventario(idx, 'unidades_por_pack', e.target.value)} className={inputBase} />
                                        </div>
                                        <div>
                                          <label className="text-[11px] font-semibold text-stone-500 block mb-1">Precio del pack completo (S/)</label>
                                          <input type="number" step="0.10" placeholder="Ej: 27.00" value={fila.precio_venta_pack} onChange={(e) => actualizarFilaInventario(idx, 'precio_venta_pack', e.target.value)} className={inputBase} />
                                        </div>
                                      </div>
                                      {Number(fila.unidades_por_pack) > 1 && Number(fila.precio_venta_pack) > 0 && (
                                        <p className="text-[11.5px] text-stone-500">
                                          = S/ {(Number(fila.precio_venta_pack) / Number(fila.unidades_por_pack)).toFixed(2)} por unidad dentro del pack (vs. S/ {pv.toFixed(2)} por unidad suelta)
                                        </p>
                                      )}
                                      <div>
                                        <label className="text-[11px] font-semibold text-stone-500 block mb-1">Código de barras del pack (opcional)</label>
                                        <div className="relative">
                                          <input type="text" placeholder="Si ya existe, se vincula solo" value={fila.cod_ean_pack} onChange={(e) => actualizarCodigoEanPackFila(idx, e.target.value)} className={`${inputBase} pr-10`} />
                                          <button type="button" onClick={() => abrirEscanerParaFilaInventario(idx, 'cod_ean_pack')} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-stone-600 hover:text-[#5b4bd6] transition" title="Escanear código de barras del pack">
                                            <i className="fa-solid fa-camera text-xs"></i>
                                          </button>
                                          {sugerenciasPack.length > 0 && (
                                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden">
                                              {sugerenciasPack.map((s) => (
                                                <button type="button" key={s.id} onClick={() => vincularProductoExistenteEnFila(idx, s)} className="w-full text-left px-3.5 py-2 text-[13px] text-stone-800 hover:bg-[#ebf0ff] flex items-center justify-between gap-2">
                                                  <span className="truncate">{s.descripcion}{s.sku ? ` · ${s.sku}` : ''}</span>
                                                  <span className="text-stone-500 shrink-0">S/ {Number(s.precio_venta).toFixed(2)}</span>
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {!esBarberia && (
                                <div className="flex gap-2 items-start bg-[#ebf0ff] rounded-xl px-3 py-2.5 text-xs text-[#2d284b] leading-snug">
                                  <i className="fa-solid fa-circle-info mt-0.5"></i>
                                  <span>La cantidad en stock se carga después desde <b>Entrada de Mercadería</b>.</span>
                                </div>
                              )}
                            </div>
                          )}

                          {paso === 3 && (
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-[17px] font-extrabold text-stone-900 tracking-tight">Revisa y guarda</h4>
                                <p className="text-[12.5px] text-stone-500 mt-0.5">Así queda el producto. Puedes volver a cualquier paso para corregir.</p>
                              </div>
                              <div className="flex items-center gap-3.5 p-3.5 rounded-[18px] bg-[#ebf0ff]">
                                <FotoProducto fotoUrl={fila.foto_url} categoria={fila.categoria} className="w-16 h-16 rounded-2xl shrink-0 bg-white" iconClassName="text-2xl" />
                                <div className="min-w-0">
                                  <p className="text-[17px] font-extrabold text-stone-900 tracking-tight leading-tight truncate">{fila.descripcion}</p>
                                  <span className="inline-block mt-1 text-[10.5px] font-bold text-[#2d284b] bg-white rounded-full px-2.5 py-0.5">{fila.categoria}</span>
                                  {esExistente && <span className="inline-block mt-1 ml-1.5 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5">Ya existía</span>}
                                </div>
                                <span className="ml-auto text-[22px] font-extrabold text-[#2d284b] whitespace-nowrap">S/ {pv.toFixed(2)}</span>
                              </div>
                              <div className="border border-stone-100 rounded-2xl overflow-hidden">
                                {[
                                  esBarberia ? ['Tipo', esServicio ? 'Servicio (sin stock)' : 'Producto (con stock)', 1, false] : ['Código', (fila.cod_ean || '').trim() || 'Sin código', 1, !(fila.cod_ean || '').trim()],
                                  ['Precio de venta', `S/ ${pv.toFixed(2)}${esBarberia ? '' : (fila.unidad === 'KG' ? ' por kg' : ' por unidad')}`, 2, false],
                                  ['Costo y ganancia', pc > 0 ? `S/ ${pc.toFixed(2)} · ganancia ${margenPct !== null ? margenPct.toFixed(0) + '%' : ''}` : 'Sin costo', 2, !(pc > 0)],
                                  ...(esServicio ? [['Duración', `${Number(fila.duracion_min) || 30} minutos`, 2, false]] : []),
                                  ...(esProductoBarberia ? [['Stock inicial', `${Number(fila.stock_inicial) || 0} unidades`, 2, false]] : []),
                                  ...(!esBarberia ? [['Pack', fila.vendeEnPack ? `x${fila.unidades_por_pack} por S/ ${Number(fila.precio_venta_pack || 0).toFixed(2)}` : 'No se vende en pack', 2, !fila.vendeEnPack]] : []),
                                  ['Foto', fila.foto_url ? 'Agregada' : 'Sin foto', 1, !fila.foto_url]
                                ].map(([clave, valor, pasoEditar, vacio]) => (
                                  <div key={clave} className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] border-t border-stone-100 first:border-t-0 bg-white">
                                    <span className="w-28 shrink-0 text-stone-500">{clave}</span>
                                    <span className={`flex-1 min-w-0 truncate ${vacio ? 'text-stone-300' : 'font-semibold text-stone-800'}`}>{valor}</span>
                                    <button type="button" onClick={() => setPasoInventario(pasoEditar)} className="text-xs font-bold text-[#5b4bd6] hover:bg-[#ebf0ff] rounded-lg px-2 py-1 flex items-center gap-1"><i className="fa-solid fa-pen text-[10px]"></i> Editar</button>
                                  </div>
                                ))}
                              </div>
                              <div>
                                <label className={etiqueta}><span>Código interno <span className="text-stone-400 font-normal">opcional</span></span><span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-[#ebf0ff] text-[#2d284b]">Auto</span></label>
                                <input type="text" placeholder="Se genera solo si lo dejas vacío" value={fila.sku} onChange={(e) => actualizarFilaInventario(idx, 'sku', e.target.value)} className={inputBase} />
                              </div>
                              {incompletas > 0 ? (
                                <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 leading-snug">
                                  <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
                                  <span>{incompletas === 1 ? 'Hay 1 producto de esta carga sin precio' : `Hay ${incompletas} productos de esta carga sin precio`}: no se guardará hasta que la completes (tócala arriba).</span>
                                </div>
                              ) : (
                                <div className="flex gap-2 items-start bg-[#ebf0ff] rounded-xl px-3 py-2.5 text-xs text-[#2d284b] leading-snug">
                                  <i className="fa-solid fa-circle-info mt-0.5"></i>
                                  <span>{listos.length > 0 ? <>Ya tienes <b>{listos.length}</b> producto{listos.length === 1 ? '' : 's'} listo{listos.length === 1 ? '' : 's'} en esta carga. Se guardan todas juntas.</> : <>¿Tienes más? Usa <b>Guardar y agregar otro</b>: te dejamos la misma categoría para ir más rápido.</>}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vista previa: cómo se verá en la caja */}
                      <aside className="order-1 md:order-2 md:sticky md:top-0 md:self-start min-w-0">
                        <p className="hidden md:block text-[11px] font-bold tracking-wider uppercase text-stone-400 mb-2">Así se verá en tu caja</p>
                        <div className="bg-white border border-stone-100 rounded-[20px] md:rounded-[22px] p-2.5 md:p-3 shadow-sm flex md:block items-center gap-3">
                          <div className="w-14 h-14 md:w-full md:h-auto md:aspect-[1/0.78] shrink-0 rounded-[14px] md:rounded-2xl bg-gradient-to-br from-[#ebf0ff] to-white overflow-hidden relative">
                            <FotoProducto fotoUrl={fila.foto_url} categoria={fila.categoria} className="w-full h-full" iconClassName="text-3xl md:text-5xl" />
                            {fila.vendeEnPack && Number(fila.unidades_por_pack) > 1 && <span className="absolute top-2 left-2 bg-[#ffc81a] text-stone-900 text-[10.5px] font-extrabold rounded-full px-2 py-0.5">Pack x{fila.unidades_por_pack}</span>}
                          </div>
                          <div className="min-w-0 flex-1 md:mt-2.5">
                            <span className="inline-block text-[10.5px] font-bold text-[#2d284b] bg-[#ebf0ff] rounded-full px-2 py-0.5">{categoriaElegida ? fila.categoria : 'Sin categoría'}</span>
                            <p className={`text-sm font-bold leading-tight mt-1 md:min-h-[2.2rem] truncate md:whitespace-normal ${fila.descripcion.trim() ? 'text-stone-900' : 'text-stone-300 font-medium'}`}>{fila.descripcion.trim() || 'Nombre del producto'}</p>
                            <div className="flex items-baseline justify-between mt-1">
                              <strong className="text-lg md:text-[22px] font-extrabold text-stone-900">S/ {pv.toFixed(2)}</strong>
                              <small className="text-[11px] text-stone-400">{unidadTexto}</small>
                            </div>
                            <div className="hidden md:grid place-items-center mt-2.5 h-9 rounded-xl bg-[#5b4bd6] text-white text-[12.5px] font-bold opacity-90">Agregar</div>
                          </div>
                        </div>
                        <div className="mt-3 md:mt-3.5">
                          <div className="flex justify-between text-xs font-bold text-stone-700 mb-1.5"><span className="hidden md:inline">Producto completo</span><span className="ml-auto md:ml-0">{completitud}%</span></div>
                          <div className="h-2 rounded-full bg-[#e6e8f1] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#7466e8] to-[#5b4bd6] transition-all duration-500" style={{ width: `${completitud}%` }}></div></div>
                          <ul className="hidden md:grid gap-1.5 mt-2.5 text-xs">
                            {checklist.map(([texto, ok]) => (
                              <li key={texto} className={`flex items-center gap-2 ${ok ? 'text-stone-800' : 'text-stone-400'}`}>
                                <span className={`w-4 h-4 rounded-full border-[1.5px] grid place-items-center shrink-0 ${ok ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300'}`}>{ok && <i className="fa-solid fa-check text-[8px]"></i>}</span>
                                {texto}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </aside>
                    </div>

                    {/* Pie con los botones del paso */}
                    <div className="shrink-0 bg-white border-t border-stone-200 px-4 sm:px-5 py-3 flex items-center gap-2.5 shadow-[0_-4px_18px_rgba(15,23,42,0.06)]">
                      {paso === 1 ? (
                        <button type="button" onClick={() => setModalInventarioInicial(false)} className="h-11 px-4 rounded-[14px] text-sm font-bold text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition">Cancelar</button>
                      ) : (
                        <button type="button" onClick={() => irAPaso(paso - 1)} disabled={guardandoInventario} className="h-11 px-4 rounded-[14px] text-sm font-bold text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition flex items-center gap-1.5"><i className="fa-solid fa-chevron-left text-xs"></i> Atrás</button>
                      )}
                      <span className="flex-1"></span>
                      {paso < 3 && !puedeAvanzar && (
                        <span className="hidden sm:flex items-center gap-1.5 text-xs text-stone-500"><i className="fa-solid fa-circle-info"></i>{paso === 1 ? (fila.descripcion.trim().length < 2 ? (categoriaElegida ? 'Falta el nombre' : 'Falta nombre y categoría') : 'Falta elegir la categoría') : 'Falta el precio de venta'}</span>
                      )}
                      {paso < 3 ? (
                        <button type="button" onClick={() => irAPaso(paso + 1)} disabled={!puedeAvanzar} className="h-11 px-5 rounded-[14px] bg-[#5b4bd6] hover:bg-[#473bb5] disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md flex items-center gap-2 transition">
                          {paso === 1 ? 'Siguiente: Precio' : 'Siguiente: Revisar'} <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                      ) : (
                        <>
                          <button type="button" onClick={guardarYAgregarOtro} disabled={guardandoInventario} className="h-11 px-4 rounded-[14px] bg-[#ebf0ff] hover:bg-[#dde4fa] disabled:opacity-60 text-[#2d284b] text-sm font-bold flex items-center gap-1.5 transition">
                            <i className="fa-solid fa-plus text-xs"></i> <span className="hidden sm:inline">Guardar y </span>agregar otro
                          </button>
                          <button type="button" onClick={guardarInventarioInicial} disabled={guardandoInventario} className="h-11 px-5 rounded-[14px] bg-[#5b4bd6] hover:bg-[#473bb5] disabled:opacity-60 text-white text-sm font-bold shadow-md flex items-center gap-2 transition">
                            {guardandoInventario ? (<><i className="fa-solid fa-spinner fa-spin"></i> Guardando...</>) : (<><i className="fa-solid fa-check"></i> {totalAGuardar > 1 ? `Guardar los ${totalAGuardar} productos` : 'Guardar producto'}</>)}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                );
              })()}
    </>
  );
}
