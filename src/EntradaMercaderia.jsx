import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function EntradaMercaderia({
  abrirProductoNuevoEntrada,
  agregarItemEntradaMercaderia,
  buscarProductoPorCodigo,
  busquedaCompra,
  cambiarTipoEntrada,
  categoriasDB,
  cerrarModalEntradaMercaderia,
  compraCabecera,
  compraItemTemp,
  compraItems,
  crearProductoInlineCompra,
  editarLineaEntrada,
  elegirProductoEntrada,
  entradaRegistrada,
  filtroCompra,
  guardandoEntrada,
  guardandoProductoInlineCompra,
  guardarEntradaMercaderia,
  idsNuevosCompra,
  modalEntradaMercaderia,
  nuevoProductoInlineCompra,
  pedirCerrarEntrada,
  productos,
  proveedoresLista,
  quitarItemEntradaMercaderia,
  resaltadoCompra,
  setBusquedaCompra,
  setCompraCabecera,
  setCompraItemTemp,
  setEntradaRegistrada,
  setFiltroCompra,
  setMetodoForzado,
  setModalEscaner,
  setModoEscaner,
  setNuevoProductoInlineCompra,
  setResaltadoCompra,
}) {
  return (
    <>
              {/* Modal: Entrada de Mercadería (Compras) */}
              {modalEntradaMercaderia && (() => {
                const BAJO = 5;
                const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                const dinero = (v) => `S/ ${(Number(v) || 0).toFixed(2)}`;
                const fmtQ = (v, u) => `${Math.round((Number(v) || 0) * 100) / 100}${u === 'KG' ? ' kg' : ''}`;
                const stockDe = (p) => (p.stock_actual === null || p.stock_actual === undefined || p.stock_actual === '') ? null : Number(p.stock_actual);
                const esBajo = (p) => { const s = stockDe(p); return s !== null && s <= BAJO; };
                const textoStock = (p) => { const s = stockDe(p); return s === null ? 'Sin control de stock' : `${fmtQ(s, p.unidad)} en stock`; };
                // Lo que pasa con un producto al recibirlo: cuántas unidades suma al
                // stock, cuánto cambia el costo y cuánto gana al venderlo.
                const calc = (p, esPack, cant, costoIngresado) => {
                  const f = esPack ? (Number(p.unidades_por_pack) || 1) : 1;
                  const unidades = cant * f;
                  const costoUnit = costoIngresado / f;
                  const costoPrev = idsNuevosCompra.includes(p.id) ? 0 : (Number(p.precio_costo) || 0);
                  const pv = Number(p.precio_venta) || 0;
                  const stockPrev = stockDe(p);
                  return {
                    f, unidades, costoUnit, subtotal: cant * costoIngresado, costoPrev, pv, stockPrev,
                    stockNuevo: (stockPrev || 0) + unidades,
                    delta: costoPrev > 0 ? (costoUnit - costoPrev) / costoPrev : null,
                    margen: pv > 0 ? (pv - costoUnit) / pv : null
                  };
                };
                const avisosDe = (c) => {
                  if (c.costoUnit > 0 && c.pv > 0 && c.costoUnit >= c.pv) return [{ tipo: 'bad', texto: `El costo (${dinero(c.costoUnit)}) es igual o mayor que el precio de venta (${dinero(c.pv)}). Vas a vender a pérdida.` }];
                  if (c.delta !== null && c.delta >= 0.10) return [{ tipo: 'warn', texto: `El costo subió ${Math.round(c.delta * 100)}%. Revisa si quieres actualizar el precio de venta.` }];
                  return [];
                };
                const etiquetaDelta = (d) => {
                  if (d === null) return <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 bg-[#f1eef9] text-stone-500">costo nuevo</span>;
                  if (Math.abs(d) < 0.005) return <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 bg-[#f1eef9] text-stone-500">igual que antes</span>;
                  return d > 0
                    ? <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 bg-amber-50 text-amber-700"><i className="fa-solid fa-arrow-up text-[9px]"></i>{Math.round(d * 100)}%</span>
                    : <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700"><i className="fa-solid fa-arrow-down text-[9px]"></i>{Math.abs(Math.round(d * 100))}%</span>;
                };

                const sel = productos.find((p) => p.id === compraItemTemp.productoId) || null;
                const creando = nuevoProductoInlineCompra;
                const nLineas = compraItems.length;
                const totalCompra = compraItems.reduce((a, c) => a + c.subtotal, 0);
                const unidadesTotal = compraItems.reduce((a, c) => a + Number(c.cantidadStock ?? c.cantidad), 0);
                const lineaInvalida = compraItems.some((i) => !(i.cantidad > 0) || !(i.costoIngresado > 0));
                const nBajos = productos.filter(esBajo).length;

                const q = norm(busquedaCompra.trim());
                let lista = productos.filter((p) => filtroCompra !== 'bajo' || esBajo(p));
                if (q) {
                  lista = lista.filter((p) => norm(p.descripcion).includes(q) || norm(p.categoria).includes(q) || String(p.cod_ean || '').toLowerCase().includes(q) || String(p.sku || '').toLowerCase().includes(q));
                } else {
                  lista = [...lista].sort((a, b) => (esBajo(a) ? 0 : 1) - (esBajo(b) ? 0 : 1) || (stockDe(a) ?? 1e9) - (stockDe(b) ?? 1e9) || String(a.descripcion).localeCompare(String(b.descripcion)));
                }
                const visibles = lista.slice(0, 40);
                const idxRes = Math.min(resaltadoCompra, Math.max(0, visibles.length - 1));
                const teclasBusqueda = (e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setResaltadoCompra(Math.min(idxRes + 1, visibles.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setResaltadoCompra(Math.max(idxRes - 1, 0)); }
                  else if (e.key === 'Enter') {
                    e.preventDefault();
                    const porCodigo = buscarProductoPorCodigo(busquedaCompra);
                    if (porCodigo) elegirProductoEntrada(porCodigo.producto, porCodigo.esPack);
                    else if (visibles[idxRes]) elegirProductoEntrada(visibles[idxRes]);
                    else if (busquedaCompra.trim()) abrirProductoNuevoEntrada(busquedaCompra.trim());
                  }
                };

                const inputBase = 'w-full h-11 bg-stone-50/70 border-[1.5px] border-stone-200 rounded-[14px] px-3.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#6105dc] focus:bg-white focus:ring-4 focus:ring-[#6105dc]/15 transition';
                const etiquetaCampo = 'flex items-center justify-between gap-2 text-[12.5px] font-semibold text-stone-800 mb-1.5';
                const segClase = (activo) => `rounded-[11px] py-2.5 px-2 text-[13px] font-bold transition text-center ${activo ? 'bg-white text-[#4d04b0] shadow-sm' : 'text-stone-500 hover:text-stone-700'}`;
                const chipClase = (activo) => `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold border-[1.5px] transition ${activo ? 'border-[#6105dc] bg-[#f4eefe] text-[#4d04b0] ring-2 ring-[#6105dc]/15' : 'border-stone-200 bg-white text-stone-600 hover:bg-[#f4eefe] hover:border-[#e4d6fb]'}`;
                const claveBloque = 'bg-white border border-stone-100 rounded-[22px] p-4 shadow-sm flex flex-col md:min-h-0';
                const sugeridos = proveedoresLista
                  .map((p) => p.nombre)
                  .filter((n) => n && norm(n).includes(norm(compraCabecera.proveedor)) && norm(n) !== norm(compraCabecera.proveedor))
                  .slice(0, 3);

                // ----- Izquierda: elegir producto, cantidad y costo -----
                const panelAgregar = (() => {
                  if (creando) {
                    const pcN = Number(creando.precio_costo) || 0;
                    const pvN = Number(creando.precio_venta) || 0;
                    return (
                      <>
                        <button type="button" onClick={() => setNuevoProductoInlineCompra(null)} className="self-start inline-flex items-center gap-1.5 text-[12.5px] font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg px-2 py-1 -ml-1 mb-2"><i className="fa-solid fa-chevron-left text-[10px]"></i> Volver a la búsqueda</button>
                        <h4 className="text-base font-extrabold text-stone-900 tracking-tight">Producto nuevo</h4>
                        <p className="text-[12.5px] text-stone-500 mt-0.5 mb-3">Solo lo esencial para seguir con la entrada. El código y los demás datos los completas luego en «Editar producto».</p>
                        <div className="space-y-3.5 md:flex-1 md:min-h-0 md:overflow-y-auto">
                          <div>
                            <label className={etiquetaCampo}><span>Nombre <span className="text-rose-500">*</span></span></label>
                            <input type="text" autoFocus autoComplete="off" value={creando.descripcion} onChange={(e) => setNuevoProductoInlineCompra({ ...creando, descripcion: e.target.value })} className={inputBase} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={etiquetaCampo}><span>Categoría</span></label>
                              <select value={creando.categoria} onChange={(e) => setNuevoProductoInlineCompra({ ...creando, categoria: e.target.value })} className={inputBase}>
                                {categoriasDB.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={etiquetaCampo}><span>Se vende por</span></label>
                              <div className="grid grid-cols-2 bg-[#f1eef9] rounded-[14px] p-1 gap-1">
                                <button type="button" onClick={() => setNuevoProductoInlineCompra({ ...creando, unidad: 'UND' })} className={segClase(creando.unidad === 'UND')}>Unidad</button>
                                <button type="button" onClick={() => setNuevoProductoInlineCompra({ ...creando, unidad: 'KG' })} className={segClase(creando.unidad === 'KG')}>Peso (kg)</button>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={etiquetaCampo}><span>Costo</span><span className="text-stone-400 font-normal">{creando.unidad === 'KG' ? 'por kilo' : 'por unidad'}</span></label>
                              <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-stone-300">S/</span><input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={creando.precio_costo} onChange={(e) => setNuevoProductoInlineCompra({ ...creando, precio_costo: e.target.value })} className={`${inputBase} pl-9 font-bold`} /></div>
                            </div>
                            <div>
                              <label className={etiquetaCampo}><span>Precio de venta <span className="text-rose-500">*</span></span></label>
                              <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-stone-300">S/</span><input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={creando.precio_venta} onChange={(e) => setNuevoProductoInlineCompra({ ...creando, precio_venta: e.target.value })} className={`${inputBase} pl-9 font-bold`} /></div>
                            </div>
                          </div>
                          {pcN > 0 && pvN > 0 && (pvN > pcN
                            ? <div className="flex gap-2 items-start rounded-[14px] bg-[#f4eefe] text-[#4d04b0] px-3 py-2.5 text-xs leading-snug"><i className="fa-solid fa-circle-info mt-0.5"></i><span>Ganas {dinero(pvN - pcN)} por cada {creando.unidad === 'KG' ? 'kilo' : 'unidad'} ({Math.round((pvN - pcN) / pvN * 100)}%).</span></div>
                            : <div className="flex gap-2 items-start rounded-[14px] bg-rose-50 text-rose-600 px-3 py-2.5 text-xs leading-snug"><i className="fa-solid fa-triangle-exclamation mt-0.5"></i><span>El precio de venta es menor o igual al costo.</span></div>)}
                        </div>
                        <button type="button" onClick={crearProductoInlineCompra} disabled={guardandoProductoInlineCompra} className="mt-3 w-full h-[46px] rounded-[14px] bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-50 text-white font-bold text-[13.5px] shadow-lg shadow-[#6105dc]/30 inline-flex items-center justify-center gap-2">
                          <i className="fa-solid fa-check"></i>{guardandoProductoInlineCompra ? 'Creando...' : 'Crear y usar en la entrada'}
                        </button>
                      </>
                    );
                  }

                  if (sel) {
                    const uds = Number(sel.unidades_por_pack) || 1;
                    const tieneP = uds > 1;
                    const esPack = tieneP && compraItemTemp.tipo === 'PACK';
                    const cant = Number(compraItemTemp.cantidad) || 0;
                    const costoIn = Number(compraItemTemp.costoUnitario) || 0;
                    const c = calc(sel, esPack, cant, costoIn);
                    const listo = cant > 0 && costoIn > 0;
                    const avisos = costoIn > 0 ? avisosDe(c) : [];
                    const alEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarItemEntradaMercaderia(); } };
                    const costoPrevVisible = c.costoPrev > 0;
                    return (
                      <>
                        <button type="button" onClick={() => setCompraItemTemp({ productoId: '', cantidad: '', costoUnitario: '', tipo: 'UNIDAD' })} className="self-start inline-flex items-center gap-1.5 text-[12.5px] font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg px-2 py-1 -ml-1 mb-2"><i className="fa-solid fa-chevron-left text-[10px]"></i> Elegir otro producto</button>
                        <div className="flex items-center gap-3 mb-3.5">
                          <div className="w-[54px] h-[54px] rounded-2xl overflow-hidden shrink-0 border border-stone-200"><FotoProducto fotoUrl={sel.foto_url} categoria={sel.categoria} className="w-full h-full" iconClassName="text-xl" /></div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-stone-900 tracking-tight leading-tight">{sel.descripcion}</h4>
                            <p className="text-xs text-stone-500 mt-0.5">{sel.categoria || 'Sin categoría'} · {textoStock(sel)} · precio de venta {dinero(sel.precio_venta)}</p>
                          </div>
                        </div>
                        <div className="space-y-3.5 md:flex-1 md:min-h-0 md:overflow-y-auto">
                          {tieneP && (
                            <div>
                              <label className={etiquetaCampo}><span>¿Cómo te llegó?</span></label>
                              <div className="grid grid-cols-2 bg-[#f1eef9] rounded-[14px] p-1 gap-1">
                                <button type="button" onClick={() => cambiarTipoEntrada('UNIDAD')} className={segClase(!esPack)}>Unidades sueltas</button>
                                <button type="button" onClick={() => cambiarTipoEntrada('PACK')} className={segClase(esPack)}>Packs o cajas<small className="block text-[11px] font-medium opacity-80">de {uds} unidades</small></button>
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={etiquetaCampo}><span>{esPack ? 'Cantidad de packs' : (sel.unidad === 'KG' ? 'Kilos recibidos' : 'Cantidad')} <span className="text-rose-500">*</span></span></label>
                              <div className="flex items-center gap-1.5">
                                <button type="button" aria-label="Menos" onClick={() => setCompraItemTemp({ ...compraItemTemp, cantidad: String(Math.max(0, Math.round(((Number(compraItemTemp.cantidad) || 0) - 1) * 100) / 100)) })} className="w-11 h-11 shrink-0 rounded-[13px] border-[1.5px] border-stone-200 bg-white text-[#4d04b0] hover:bg-[#f4eefe]"><i className="fa-solid fa-minus text-xs"></i></button>
                                <input type="number" autoFocus min="0" step={sel.unidad === 'KG' ? '0.1' : '1'} inputMode="decimal" placeholder="0" value={compraItemTemp.cantidad} onChange={(e) => setCompraItemTemp({ ...compraItemTemp, cantidad: e.target.value })} onKeyDown={alEnter} className={`${inputBase} text-center font-bold text-base px-1 min-w-0`} />
                                <button type="button" aria-label="Más" onClick={() => setCompraItemTemp({ ...compraItemTemp, cantidad: String(Math.round(((Number(compraItemTemp.cantidad) || 0) + 1) * 100) / 100) })} className="w-11 h-11 shrink-0 rounded-[13px] border-[1.5px] border-stone-200 bg-white text-[#4d04b0] hover:bg-[#f4eefe]"><i className="fa-solid fa-plus text-xs"></i></button>
                              </div>
                            </div>
                            <div>
                              <label className={etiquetaCampo}><span>{esPack ? 'Costo por pack' : (sel.unidad === 'KG' ? 'Costo por kilo' : 'Costo por unidad')} <span className="text-rose-500">*</span></span></label>
                              <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-stone-300">S/</span><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={compraItemTemp.costoUnitario} onChange={(e) => setCompraItemTemp({ ...compraItemTemp, costoUnitario: e.target.value })} onKeyDown={alEnter} className={`${inputBase} pl-9 font-bold text-base`} /></div>
                            </div>
                          </div>
                          {avisos.map((a, i) => (
                            <div key={i} className={`flex gap-2 items-start rounded-[14px] px-3 py-2.5 text-xs leading-snug ${a.tipo === 'bad' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}><i className="fa-solid fa-triangle-exclamation mt-0.5"></i><span>{a.texto}</span></div>
                          ))}
                          <div className="border border-stone-100 rounded-[18px] bg-[#fcfaff] px-3.5 divide-y divide-dashed divide-[#e4d6fb]">
                            {esPack && cant > 0 && (
                              <div className="flex items-center justify-between gap-2 py-2.5 text-[12.5px]"><span className="font-semibold text-stone-500">Equivale a</span><b>{cant} × {uds} = {fmtQ(c.unidades, sel.unidad)} und</b></div>
                            )}
                            <div className="flex items-center justify-between gap-2 py-2.5 text-[12.5px]"><span className="font-semibold text-stone-500">Stock</span><b>{c.stockPrev === null ? 'Sin control' : fmtQ(c.stockPrev, sel.unidad)} <span className="text-stone-300 font-semibold">→</span> {cant > 0 ? fmtQ(c.stockNuevo, sel.unidad) : '—'}</b></div>
                            <div className="flex items-center justify-between gap-2 py-2.5 text-[12.5px] flex-wrap"><span className="font-semibold text-stone-500">Costo{esPack ? ' por unidad' : ''}</span><b className="flex items-center gap-1.5 flex-wrap justify-end">{costoPrevVisible && <s className="text-stone-300 font-semibold">{dinero(c.costoPrev)}</s>}{costoIn > 0 ? dinero(c.costoUnit) : '—'}{costoIn > 0 && etiquetaDelta(c.delta)}</b></div>
                            {costoIn > 0 && c.margen !== null && (
                              <div className="flex items-center justify-between gap-2 py-2.5 text-[12.5px]"><span className="font-semibold text-stone-500">Ganancia al vender a {dinero(c.pv)}</span><b className="flex items-center gap-1.5">{dinero(c.pv - c.costoUnit)}<span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${c.margen < 0.1 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{Math.round(c.margen * 100)}%</span></b></div>
                            )}
                            <div className="flex items-center justify-between gap-2 py-2.5 text-[12.5px]"><span className="font-semibold text-stone-500">Subtotal</span><b className="text-[15px] font-extrabold">{dinero(c.subtotal)}</b></div>
                          </div>
                        </div>
                        <button type="button" onClick={agregarItemEntradaMercaderia} disabled={!listo} className="mt-3 w-full h-[46px] rounded-[14px] bg-[#6105dc] hover:bg-[#4d04b0] disabled:bg-[#d9d2ea] disabled:shadow-none text-white font-bold text-[13.5px] shadow-lg shadow-[#6105dc]/30 inline-flex items-center justify-center gap-2 transition">
                          <i className="fa-solid fa-plus text-xs"></i> Añadir a la entrada
                        </button>
                        <p className="text-[11.5px] text-stone-400 text-center mt-1.5">Enter también lo añade</p>
                      </>
                    );
                  }

                  return (
                    <>
                      <h4 className="text-base font-extrabold text-stone-900 tracking-tight">Agregar productos</h4>
                      <p className="text-[12.5px] text-stone-500 mt-0.5 mb-3">Busca por nombre o escanea el código de barras.</p>
                      {nLineas > 0 && (
                        <button type="button" onClick={() => document.getElementById('entrada-lista')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="md:hidden flex items-center gap-2 w-full rounded-[14px] border-[1.5px] border-[#e4d6fb] bg-[#f4eefe] text-[#4d04b0] px-3.5 py-2.5 text-[12.5px] font-bold mb-3 text-left">
                          <span className="flex-1">{nLineas} producto{nLineas > 1 ? 's' : ''} · {dinero(totalCompra)}</span>Ver la entrada <i className="fa-solid fa-arrow-down text-[10px]"></i>
                        </button>
                      )}
                      <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 text-[15px] pointer-events-none"></i>
                        <input type="text" autoFocus autoComplete="off" placeholder="Ej: leche, arroz, 775…" value={busquedaCompra} onChange={(e) => { setBusquedaCompra(e.target.value); setResaltadoCompra(0); }} onKeyDown={teclasBusqueda} className="w-full h-[50px] bg-stone-50/70 border-[1.5px] border-stone-200 rounded-2xl pl-11 pr-[118px] text-[15px] text-stone-900 placeholder:text-stone-300 outline-none focus:border-[#6105dc] focus:bg-white focus:ring-4 focus:ring-[#6105dc]/15 transition" />
                        <button type="button" onClick={() => { setModoEscaner('entrada-mercaderia'); setMetodoForzado(null); setModalEscaner(true); }} title="Escanear con la cámara" className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-[11px] border border-[#e4d6fb] bg-[#f4eefe] text-[#4d04b0] hover:bg-[#ece0fd] text-[12.5px] font-bold inline-flex items-center gap-1.5"><i className="fa-solid fa-camera text-xs"></i> Escanear</button>
                      </div>
                      <div className="flex flex-wrap gap-2 my-3">
                        <button type="button" onClick={() => { setFiltroCompra('todos'); setResaltadoCompra(0); }} className={chipClase(filtroCompra === 'todos')}>Todos</button>
                        <button type="button" onClick={() => { setFiltroCompra('bajo'); setResaltadoCompra(0); }} className={chipClase(filtroCompra === 'bajo')}>Por reponer <span className={`text-[10.5px] rounded-full px-1.5 ${filtroCompra === 'bajo' ? 'bg-[#6105dc] text-white' : 'bg-amber-50 text-amber-700'}`}>{nBajos}</span></button>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5 max-h-80 overflow-y-auto md:max-h-none md:flex-1 md:min-h-0 content-start">
                        {visibles.map((p, i) => {
                          const s = stockDe(p);
                          return (
                            <button key={p.id} type="button" onClick={() => elegirProductoEntrada(p)} className={`flex items-center gap-3 w-full text-left rounded-2xl border-[1.5px] bg-white px-3 py-2 transition hover:bg-[#fcfaff] hover:border-[#e4d6fb] ${i === idxRes ? 'border-[#6105dc] ring-2 ring-[#6105dc]/15' : 'border-stone-100'}`}>
                              <span className="w-[42px] h-[42px] rounded-[13px] overflow-hidden shrink-0 border border-stone-100"><FotoProducto fotoUrl={p.foto_url} categoria={p.categoria} className="w-full h-full" iconClassName="text-base" /></span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13.5px] font-bold text-stone-900 leading-tight truncate">{p.descripcion}</span>
                                <span className="block text-[11.5px] text-stone-500 mt-0.5">{textoStock(p)} · último costo {dinero(p.precio_costo)}{p.unidad === 'KG' ? ' /kg' : ''}</span>
                              </span>
                              {s !== null && s <= 0 && <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-rose-50 text-rose-600 whitespace-nowrap">Sin stock</span>}
                              {s !== null && s > 0 && s <= BAJO && <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-amber-50 text-amber-700 whitespace-nowrap">Quedan {fmtQ(s, p.unidad)}</span>}
                            </button>
                          );
                        })}
                        {busquedaCompra.trim() && (
                          <button type="button" onClick={() => abrirProductoNuevoEntrada(busquedaCompra.trim())} className="flex items-center gap-3 w-full text-left rounded-2xl border-[1.5px] border-dashed border-[#e4d6fb] bg-[#fcfaff] px-3 py-2 hover:bg-[#f4eefe] transition">
                            <span className="w-[42px] h-[42px] rounded-[13px] shrink-0 bg-[#6105dc] text-white grid place-items-center"><i className="fa-solid fa-plus"></i></span>
                            <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-bold text-stone-900 leading-tight truncate">Crear «{busquedaCompra.trim()}» como producto nuevo</span><span className="block text-[11.5px] text-stone-500 mt-0.5">Lo creas aquí mismo y sigues con la entrada</span></span>
                          </button>
                        )}
                        {!busquedaCompra.trim() && visibles.length === 0 && <p className="text-center text-[13px] text-stone-400 py-6">{filtroCompra === 'bajo' ? 'No hay productos por reponer.' : 'Aún no tienes productos registrados.'}</p>}
                        {lista.length > visibles.length && <p className="text-center text-[11.5px] text-stone-400 py-1">Hay {lista.length - visibles.length} más. Escribe para afinar la búsqueda.</p>}
                      </div>
                    </>
                  );
                })();

                // ----- Derecha: la entrada (proveedor, líneas, total) -----
                const panelEntrada = (
                  <>
                    <h4 className="text-base font-extrabold text-stone-900 tracking-tight">La entrada</h4>
                    <p className="text-[12.5px] text-stone-500 mt-0.5 mb-3">{nLineas ? `${nLineas} producto${nLineas > 1 ? 's' : ''} para recibir` : 'Aquí verás lo que vas anotando.'}</p>
                    <div className="grid sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-3">
                      <div>
                        <label className={etiquetaCampo}><span>Proveedor</span><span className="text-stone-400 font-normal">opcional</span></label>
                        <input type="text" autoComplete="off" placeholder="Ej: Distribuidora Andina" value={compraCabecera.proveedor} onChange={(e) => setCompraCabecera({ ...compraCabecera, proveedor: e.target.value })} className={inputBase} />
                      </div>
                      <div>
                        <label className={etiquetaCampo}><span>N° factura o guía</span><span className="text-stone-400 font-normal">opcional</span></label>
                        <input type="text" autoComplete="off" placeholder="F001-0234" value={compraCabecera.nroComprobante} onChange={(e) => setCompraCabecera({ ...compraCabecera, nroComprobante: e.target.value })} className={inputBase} />
                      </div>
                    </div>
                    {sugeridos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {sugeridos.map((n) => <button key={n} type="button" onClick={() => setCompraCabecera({ ...compraCabecera, proveedor: n })} className="px-2.5 py-1 rounded-full border-[1.5px] border-stone-200 bg-white text-xs font-semibold text-stone-600 hover:bg-[#f4eefe] hover:border-[#e4d6fb]">{n}</button>)}
                      </div>
                    )}
                    <div className="h-px bg-stone-100 my-3.5"></div>
                    <div className="md:flex-1 md:min-h-0 md:overflow-y-auto -mx-1 px-1">
                      {nLineas === 0 ? (
                        <div className="text-center py-6 px-3 text-[13px] text-stone-500 leading-snug">
                          <div className="w-[60px] h-[60px] rounded-[20px] bg-[#f4eefe] text-[#6105dc] grid place-items-center text-2xl mx-auto mb-2.5"><i className="fa-solid fa-box-open"></i></div>
                          <b className="block text-[15px] text-stone-900 mb-0.5">Todavía no hay productos</b>
                          Busca uno, pon cuánto llegó y a qué costo.
                        </div>
                      ) : (
                        <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
                          {compraItems.map((it, idx) => {
                            const p = productos.find((x) => x.id === it.productoId);
                            if (!p) return null;
                            const c = calc(p, it.esPack, it.cantidad, it.costoIngresado);
                            const av = avisosDe(c);
                            const invalida = !(it.cantidad > 0) || !(it.costoIngresado > 0);
                            const unidadCant = it.esPack ? 'packs' : (p.unidad === 'KG' ? 'kg' : 'und');
                            const unidadCosto = it.esPack ? 'x pack' : (p.unidad === 'KG' ? 'x kg' : 'x und');
                            const commit = (campo) => (e) => { const v = e.target.value; if (Number(v) !== (campo === 'cantidad' ? it.cantidad : it.costoIngresado)) editarLineaEntrada(idx, campo, v); };
                            const alEnter = (e) => { if (e.key === 'Enter') e.target.blur(); };
                            const estilo = invalida || av.some((a) => a.tipo === 'bad') ? 'border-rose-300 bg-rose-50' : av.length ? 'border-amber-300 bg-amber-50/60' : 'border-stone-100 bg-white';
                            return (
                              <div key={`${it.productoId}-${idx}`} id={idx === nLineas - 1 ? 'entrada-ultima' : undefined} className={`rounded-2xl border-[1.5px] px-3 py-2.5 ${estilo}`}>
                                <div className="flex items-center gap-2.5">
                                  <span className="w-[34px] h-[34px] rounded-[11px] overflow-hidden shrink-0 border border-stone-100"><FotoProducto fotoUrl={p.foto_url} categoria={p.categoria} className="w-full h-full" iconClassName="text-sm" /></span>
                                  <span className="flex-1 min-w-0 text-[13px] font-bold text-stone-900 leading-tight">{it.descripcion}</span>
                                  <button type="button" onClick={() => quitarItemEntradaMercaderia(idx)} title="Quitar esta línea" aria-label="Quitar esta línea" className="w-[30px] h-[30px] rounded-lg text-stone-300 hover:text-rose-600 hover:bg-rose-50 grid place-items-center shrink-0"><i className="fa-solid fa-trash-can text-sm"></i></button>
                                </div>
                                <div className="grid grid-cols-[78px_minmax(0,1fr)_auto] gap-2 items-center mt-2.5">
                                  <div className="relative">
                                    <input key={`q-${idx}-${it.cantidad}`} type="number" min="0" step={p.unidad === 'KG' ? '0.1' : '1'} inputMode="decimal" defaultValue={it.cantidad} onBlur={commit('cantidad')} onKeyDown={alEnter} aria-label="Cantidad" className="w-full h-9 rounded-[11px] border-[1.5px] border-stone-200 bg-white text-[13px] font-bold text-center pl-2 pr-8 outline-none focus:border-[#6105dc] focus:ring-4 focus:ring-[#6105dc]/15" />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] font-semibold text-stone-400 pointer-events-none">{unidadCant}</span>
                                  </div>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-bold text-stone-300">S/</span>
                                    <input key={`c-${idx}-${it.costoIngresado}`} type="number" min="0" step="0.01" inputMode="decimal" defaultValue={it.costoIngresado} onBlur={commit('costo')} onKeyDown={alEnter} aria-label={it.esPack ? 'Costo por pack' : 'Costo por unidad'} className="w-full h-9 rounded-[11px] border-[1.5px] border-stone-200 bg-white text-[13px] font-bold pl-7 pr-12 outline-none focus:border-[#6105dc] focus:ring-4 focus:ring-[#6105dc]/15" />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] font-semibold text-stone-400 pointer-events-none">{unidadCosto}</span>
                                  </div>
                                  <span className="text-sm font-extrabold text-stone-900 whitespace-nowrap">{dinero(c.subtotal)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap mt-2 text-[11.5px] text-stone-500">
                                  {it.esPack && <><span>= <b className="text-stone-800">{fmtQ(c.unidades, p.unidad)}{p.unidad === 'KG' ? '' : ' und'}</b></span><span>·</span></>}
                                  <span>Stock <b className="text-stone-800">{c.stockPrev === null ? 'sin control' : fmtQ(c.stockPrev, p.unidad)}</b> → <b className="text-stone-800">{fmtQ(c.stockNuevo, p.unidad)}</b></span>
                                  {it.costoIngresado > 0 && etiquetaDelta(c.delta)}
                                </div>
                                {invalida
                                  ? <p className="text-[11.5px] font-semibold text-rose-600 mt-1.5">Pon una cantidad y un costo mayores a 0.</p>
                                  : av.map((a, i) => <p key={i} className={`flex gap-1.5 items-start text-[11.5px] font-semibold mt-1.5 ${a.tipo === 'bad' ? 'text-rose-600' : 'text-amber-700'}`}><i className="fa-solid fa-triangle-exclamation mt-0.5"></i><span>{a.texto}</span></p>)}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-stone-100 shrink-0">
                      <div className="flex justify-between items-baseline"><span className="text-[12.5px] font-semibold text-stone-500">Total de la compra</span><strong className="text-[28px] font-extrabold text-[#4d04b0] tracking-tight leading-none">{dinero(totalCompra)}</strong></div>
                      <p className="text-[11.5px] text-stone-500 mt-1">{nLineas ? `${nLineas} producto${nLineas > 1 ? 's' : ''} · ${Math.round(unidadesTotal * 100) / 100} unidades en total` : 'S/ 0.00 hasta que añadas productos'}</p>
                    </div>
                  </>
                );

                const fin = entradaRegistrada;
                return (
                  <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-4xl w-full shadow-2xl h-[95vh] max-h-[800px] flex flex-col overflow-hidden">

                      <div className="bg-white border-b border-stone-100 px-4 sm:px-5 py-3.5 shrink-0 flex items-center gap-3">
                        <span className="w-11 h-11 rounded-[14px] bg-[#f4eefe] text-[#6105dc] grid place-items-center text-xl shrink-0"><i className="fa-solid fa-truck-ramp-box"></i></span>
                        <div className="min-w-0">
                          <h3 className="text-[17px] sm:text-lg font-extrabold text-stone-900 tracking-tight leading-tight">Entrada de mercadería</h3>
                          <p className="hidden sm:block text-[12.5px] text-stone-500 mt-0.5">Anota lo que te dejó el proveedor. El stock y el costo se actualizan al confirmar.</p>
                        </div>
                        <button onClick={fin ? cerrarModalEntradaMercaderia : pedirCerrarEntrada} aria-label="Cerrar" className="ml-auto w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors shrink-0"><i className="fa-solid fa-xmark"></i></button>
                      </div>

                      {fin ? (
                        <div className="flex-1 overflow-y-auto grid place-items-center p-5">
                          <div className="text-center max-w-md w-full">
                            <div className="w-[84px] h-[84px] rounded-full bg-emerald-50 text-emerald-600 grid place-items-center text-4xl mx-auto mb-3.5"><i className="fa-solid fa-check"></i></div>
                            <h4 className="text-[22px] font-extrabold text-stone-900 tracking-tight">Entrada registrada</h4>
                            <p className="text-[13.5px] text-stone-500 mt-1 mb-4">El stock y los costos ya están al día.</p>
                            <div className="bg-white border border-stone-100 rounded-[20px] px-4 py-1.5 text-left mb-4 divide-y divide-dashed divide-stone-200">
                              <div className="flex justify-between gap-3 py-2.5 text-[13px]"><span className="text-stone-500">Proveedor</span><b className="text-right">{fin.proveedor || 'Sin proveedor'}</b></div>
                              <div className="flex justify-between gap-3 py-2.5 text-[13px]"><span className="text-stone-500">Comprobante</span><b className="text-right">{fin.comprobante}</b></div>
                              <div className="flex justify-between gap-3 py-2.5 text-[13px]"><span className="text-stone-500">Productos</span><b className="text-right">{fin.lineas.length} · {Math.round(fin.unidades * 100) / 100} unidades</b></div>
                              <div className="flex justify-between gap-3 py-2.5 text-[13px] items-baseline"><span className="text-stone-500">Total de la compra</span><b className="text-base font-extrabold">{dinero(fin.total)}</b></div>
                            </div>
                            <details className="text-left mb-5">
                              <summary className="cursor-pointer text-[12.5px] font-bold text-[#4d04b0] py-1">Ver cómo quedó el stock</summary>
                              <div className="bg-white border border-stone-100 rounded-[20px] px-4 py-1.5 mt-2 divide-y divide-dashed divide-stone-200">
                                {fin.lineas.map((l, i) => <div key={i} className="flex justify-between gap-3 py-2.5 text-[13px]"><span className="text-stone-500 min-w-0 truncate">{l.descripcion}</span><b className="text-right whitespace-nowrap">{l.antes === null ? 'Sin control' : fmtQ(l.antes, l.unidad)} → {fmtQ(l.despues, l.unidad)}</b></div>)}
                              </div>
                            </details>
                            <div className="flex gap-2 justify-center flex-wrap">
                              <button type="button" onClick={() => setEntradaRegistrada(null)} className="h-[46px] px-5 rounded-[14px] bg-[#f4eefe] hover:bg-[#ece0fd] text-[#4d04b0] font-bold text-[13.5px] inline-flex items-center gap-2"><i className="fa-solid fa-plus text-xs"></i> Registrar otra entrada</button>
                              <button type="button" onClick={cerrarModalEntradaMercaderia} className="h-[46px] px-6 rounded-[14px] bg-[#6105dc] hover:bg-[#4d04b0] text-white font-bold text-[13.5px] shadow-lg shadow-[#6105dc]/30">Listo</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden p-3.5 sm:p-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_380px] md:grid-rows-1 content-start">
                            <div className={`${claveBloque} min-w-0`}>{panelAgregar}</div>
                            <div id="entrada-lista" className={`${claveBloque} min-w-0`}>{panelEntrada}</div>
                          </div>
                          <div className="shrink-0 bg-white border-t border-stone-100 px-4 sm:px-5 py-3 flex items-center gap-2.5 shadow-[0_-8px_24px_-14px_rgba(40,10,90,0.18)]">
                            <button type="button" onClick={pedirCerrarEntrada} className="h-[46px] px-4 sm:px-5 rounded-[14px] text-stone-500 hover:text-stone-800 hover:bg-stone-100 font-bold text-[13.5px]">Cancelar</button>
                            <span className="flex-1"></span>
                            <span className={`hidden md:flex items-center text-xs ${nLineas ? 'text-[#4d04b0] font-semibold' : 'text-stone-500'}`}>{nLineas ? `${nLineas} producto${nLineas > 1 ? 's' : ''} · ${dinero(totalCompra)}` : 'Añade al menos un producto para confirmar'}</span>
                            <button type="button" onClick={guardarEntradaMercaderia} disabled={!nLineas || lineaInvalida || guardandoEntrada} className="h-[46px] px-4 sm:px-5 rounded-[14px] bg-[#6105dc] hover:bg-[#4d04b0] disabled:bg-[#d9d2ea] disabled:shadow-none disabled:cursor-not-allowed text-white font-bold text-[13.5px] shadow-lg shadow-[#6105dc]/30 inline-flex items-center justify-center gap-2 transition">
                              <i className="fa-solid fa-check text-xs"></i><span>{guardandoEntrada ? 'Guardando...' : <>Confirmar<span className="hidden sm:inline"> entrada</span>{nLineas ? ` · ${dinero(totalCompra)}` : ''}</>}</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
    </>
  );
}
