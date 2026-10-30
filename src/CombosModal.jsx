import React from 'react';
import { FotoProducto } from './PanelAdminCompartido.jsx';
import { margenCombo } from './lib/combos.js';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function CombosModal({
  actualizarCantidadItemCombo,
  agregarProductoAFormCombo,
  alternarActivoCombo,
  aplicarDescuentoRapidoCombo,
  aplicarPrecioCombo,
  buscarProductoPorCodigo,
  busquedaCombos,
  busquedaProductoCombo,
  cargandoCombos,
  carrito,
  cerrarEditorCombo,
  cerrarModalCombos,
  combos,
  costoNormalCombo,
  duplicarCombo,
  editarCombo,
  eliminarCombo,
  esBarberia,
  estadoCombos,
  filtroCombos,
  formCombo,
  formComboOriginal,
  guardandoCombo,
  guardarCombo,
  modalCombos,
  notificar,
  nuevoCombo,
  precioNormalCombo,
  productos,
  quitarItemCombo,
  resaltadoProductoCombo,
  setBusquedaCombos,
  setBusquedaProductoCombo,
  setFiltroCombos,
  setFormCombo,
  setResaltadoProductoCombo,
  snapshotCombo,
}) {
  return (
    <>
              {/* Modal: Combos */}
              {modalCombos && (() => {
                const dinero = (v) => `S/ ${(Number(v) || 0).toFixed(2)}`;
                const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                const unidadesDe = (n) => `${n} combo${n === 1 ? '' : 's'}`;
                const inputBase = 'w-full h-11 bg-stone-50/70 border-[1.5px] border-stone-200 rounded-[14px] px-3.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#5b4bd6] focus:bg-white focus:ring-4 focus:ring-[#5b4bd6]/15 transition';
                const etiquetaCampo = 'flex items-center justify-between gap-2 text-[12.5px] font-semibold text-stone-800 mb-1.5';
                const chipClase = (activo) => `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold border-[1.5px] transition ${activo ? 'border-[#5b4bd6] bg-[#ebf0ff] text-[#2d284b] ring-2 ring-[#5b4bd6]/15' : 'border-stone-200 bg-white text-stone-600 hover:bg-[#ebf0ff] hover:border-[#d2d9f5]'}`;
                const panelClase = 'bg-white border border-stone-100 rounded-[22px] p-4 sm:p-5 shadow-sm';
                const panelP = 'bg-white border border-[#e6e9f5] rounded-2xl px-5 sm:px-6 py-5 sm:py-[22px] shadow-[0_1px_2px_rgba(20,10,50,0.03)]';
                const labP = 'flex items-center justify-between gap-2 text-[12.5px] font-medium text-stone-700 mb-1.5';
                const inputP = 'w-full h-11 bg-white border border-[#e6e9f5] rounded-[10px] px-3.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#5b4bd6] focus:ring-[3px] focus:ring-[#5b4bd6]/10 transition';
                const chipP = (activo) => `h-8 px-3.5 rounded-lg border text-[13px] transition ${activo ? 'border-[#5b4bd6] bg-[#eff2fd] text-[#2d284b] font-semibold' : 'border-[#e6e9f5] bg-white text-stone-700 font-medium hover:bg-[#f7f8fc]'}`;
                const chispa = (<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" /><path d="M19 15c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8Z" /></svg>);
                const miniatura = (url, categoria, tam = 'w-10 h-10') => (
                  <span className={`block ${tam} rounded-[13px] overflow-hidden shrink-0 border-2 border-white ring-1 ring-stone-200 bg-white`}><FotoProducto fotoUrl={url} categoria={categoria} className="w-full h-full" iconClassName="text-sm" /></span>
                );
                const vivo = (id) => productos.find((p) => p.id === id);
                // Estado de un combo ya guardado: en venta, sin stock (se apaga
                // y se enciende solo) o pausado a mano.
                const estadoDe = (combo) => {
                  const e = estadoCombos.get(combo.id);
                  if ((combo.activo || combo.apagado_auto) && e?.disponible === false) return 'sinstock';
                  return combo.activo ? 'venta' : 'pausado';
                };

                // ----- Editor -----
                if (formCombo) {
                  const f = formCombo;
                  const precio = Number(f.precio_venta) || 0;
                  const suma = precioNormalCombo(f);
                  const costo = costoNormalCombo(f);
                  const ahorro = suma > 0 && precio > 0 ? (1 - precio / suma) * 100 : 0;
                  const m = margenCombo(precio, costo);
                  // Cuántos combos alcanza a armar el stock de hoy (los servicios
                  // de una barbería, que no llevan stock, no limitan).
                  let maxCombos = Infinity;
                  const faltan = [];
                  f.items.forEach((it) => {
                    const pr = vivo(it.producto_id);
                    const sinSeguimiento = esBarberia && pr && (pr.stock_actual === null || pr.stock_actual === undefined);
                    const stock = pr ? (sinSeguimiento ? Infinity : Number(pr.stock_actual) || 0) : 0;
                    if (stock < it.cantidad) faltan.push(it.descripcion);
                    maxCombos = Math.min(maxCombos, Math.floor(stock / it.cantidad));
                  });
                  const errores = [];
                  if (!f.nombre.trim()) errores.push('Ponle un nombre');
                  if (f.items.length === 0) errores.push('Agrega al menos un producto');
                  if (!(precio > 0)) errores.push('Pon el precio del combo');
                  const hayCambios = snapshotCombo(f) !== formComboOriginal;
                  const rapidos = [5, 10, 15].map((pct) => ({ pct, valor: suma * (1 - pct / 100) }));
                  const redondos = [];
                  if (suma > 0) {
                    [Math.floor(suma * 0.95) + 0.9, Math.floor(suma * 0.9) + 0.9].forEach((v) => { if (v > 0 && v < suma && !redondos.includes(v)) redondos.push(v); });
                  }
                  const q = norm(busquedaProductoCombo.trim());
                  const encontrados = q
                    ? productos.filter((p) => norm(p.descripcion).includes(q) || String(p.cod_ean || '').toLowerCase().includes(q) || String(p.sku || '').toLowerCase().includes(q)).slice(0, 6)
                    : [];
                  const idxRes = Math.min(resaltadoProductoCombo, Math.max(0, encontrados.length - 1));
                  const teclasBusqueda = (e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setResaltadoProductoCombo(Math.min(idxRes + 1, encontrados.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setResaltadoProductoCombo(Math.max(idxRes - 1, 0)); }
                    else if (e.key === 'Enter') {
                      e.preventDefault();
                      const porCodigo = buscarProductoPorCodigo(busquedaProductoCombo);
                      if (porCodigo) agregarProductoAFormCombo(porCodigo.producto);
                      else if (encontrados[idxRes]) agregarProductoAFormCombo(encontrados[idxRes]);
                    }
                    else if (e.key === 'Escape' && busquedaProductoCombo) { e.stopPropagation(); setBusquedaProductoCombo(''); }
                  };
                  const pvFotos = f.items.slice(0, 3);

                  return (
                    <div className="ventana-riel fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                      <div className="bg-[#f7f8fc] border border-black/5 rounded-[18px] max-w-5xl w-full shadow-2xl h-[95vh] max-h-[800px] flex flex-col overflow-hidden">

                        <div className="bg-white border-b border-[#e6e9f5] px-4 sm:px-7 py-4 shrink-0 flex items-center gap-3">
                          <button type="button" onClick={cerrarEditorCombo} className="h-9 px-3 rounded-[10px] border border-[#e6e9f5] bg-white hover:bg-[#f7f8fc] text-[13px] font-medium text-stone-700 inline-flex items-center gap-1.5 shrink-0"><i className="fa-solid fa-chevron-left text-[10px]"></i> Combos</button>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[19px] sm:text-[21px] font-bold text-stone-900 tracking-tight leading-tight truncate">{f.id ? (f.nombre.trim() || 'Combo sin nombre') : 'Nuevo combo'}</h3>
                            <p className="hidden sm:block text-[13px] text-stone-500 mt-0.5">{f.id ? 'Edita lo que incluye y su precio.' : 'Elige qué incluye y ponle un precio especial.'}</p>
                          </div>
                          <button aria-label="Cerrar" onClick={cerrarEditorCombo} className="w-9 h-9 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-[#eef1fb] transition-colors shrink-0"><i className="fa-solid fa-xmark"></i></button>
                        </div>

                        <div className="flex-1 overflow-y-auto hide-scrollbar p-4 sm:p-7 grid gap-5 md:gap-6 md:grid-cols-[minmax(0,1fr)_310px] content-start">
                          <div className="min-w-0 space-y-4">

                            <div className={panelP}>
                              <h4 className="text-base font-semibold text-stone-900 tracking-tight">Datos del combo</h4>
                              <p className="text-[13px] text-stone-500 mt-1 mb-[18px] leading-snug">Cómo se llama y cómo lo verán tus clientes.</p>
                              <div className="space-y-3.5">
                                <div>
                                  <label className={labP}><span>Nombre del combo</span></label>
                                  <input type="text" autoFocus={!f.id} autoComplete="off" placeholder={esBarberia ? 'Ej: Corte + Barba' : 'Ej: Combo Desayuno'} value={f.nombre} onChange={(e) => setFormCombo({ ...f, nombre: e.target.value })} className={inputP} />
                                </div>
                                <div>
                                  <label className={labP}><span>Descripción</span><span className="text-stone-400 font-normal">opcional</span></label>
                                  <input type="text" autoComplete="off" placeholder={esBarberia ? 'Ej: El clásico de los sábados' : 'Ej: Pan, leche y café para empezar el día'} value={f.descripcion} onChange={(e) => setFormCombo({ ...f, descripcion: e.target.value })} className={inputP} />
                                </div>
                              </div>
                            </div>

                            <div className={panelP}>
                              <h4 className="text-base font-semibold text-stone-900 tracking-tight">Qué incluye</h4>
                              <p className="text-[13px] text-stone-500 mt-1 mb-[18px] leading-snug">Busca {esBarberia ? 'servicios o productos' : 'productos'} y ajusta cuántos lleva cada uno.</p>
                              <div className="relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-[14px] pointer-events-none"></i>
                                <input type="text" autoComplete="off" placeholder="Buscar para agregar…" value={busquedaProductoCombo} onChange={(e) => { setBusquedaProductoCombo(e.target.value); setResaltadoProductoCombo(0); }} onKeyDown={teclasBusqueda} className={`${inputP} pl-10`} />
                              </div>
                              {q && (
                                <div className="mt-2 border border-[#d2d9f5] rounded-[14px] bg-white overflow-hidden shadow-lg shadow-[#5b4bd6]/10">
                                  {encontrados.length === 0 && <p className="px-3.5 py-3.5 text-[13px] text-stone-500">No encontré «{busquedaProductoCombo.trim()}». Prueba con otro nombre.</p>}
                                  {encontrados.map((p, i) => {
                                    const ya = f.items.find((it) => it.producto_id === p.id);
                                    const s = p.stock_actual === null || p.stock_actual === undefined ? null : Number(p.stock_actual);
                                    return (
                                      <button type="button" key={p.id} onClick={() => agregarProductoAFormCombo(p)} className={`w-full flex items-center gap-3 text-left px-3 py-2 border-b border-[#eef0f9] last:border-b-0 hover:bg-[#f9fbff] ${i === idxRes ? 'bg-[#f9fbff]' : 'bg-white'}`}>
                                        <span className="w-[40px] h-[40px] rounded-[10px] overflow-hidden shrink-0 bg-gradient-to-br from-[#f4f6fc] to-[#e5e9f6] [&_img]:object-contain [&_img]:mix-blend-multiply"><FotoProducto fotoUrl={p.foto_url} categoria={p.categoria} className="w-full h-full" iconClassName="text-sm" /></span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block text-[13px] font-semibold text-stone-900 leading-tight truncate">{p.descripcion}</span>
                                          <span className="block text-xs text-stone-500 mt-0.5">{dinero(p.precio_venta)}{s === null ? (esBarberia ? ' · servicio' : '') : s <= 0 ? ' · sin stock' : ` · ${s} en stock`}</span>
                                        </span>
                                        <span className="text-xs font-semibold text-[#2d284b] flex items-center gap-1 shrink-0">{ya ? `Ya lleva ${ya.cantidad} · sumar otro` : 'Agregar'} <i className="fa-solid fa-plus text-[10px]"></i></span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                              {f.items.length === 0 ? (
                                <div className="mt-3.5 border border-dashed border-[#d5dbef] rounded-[14px] py-6 px-4 text-center text-[13px] text-stone-500">
                                  <b className="block text-stone-900 mb-0.5">Aún no agregaste {esBarberia ? 'nada' : 'productos'}</b>
                                  Escribe arriba para buscar y añadir {esBarberia ? 'servicios o productos' : 'productos'}.
                                </div>
                              ) : (
                                <div className="mt-3.5">
                                  {f.items.map((it) => {
                                    const pr = vivo(it.producto_id);
                                    const sinSeguimiento = esBarberia && pr && (pr.stock_actual === null || pr.stock_actual === undefined);
                                    const stock = pr ? (sinSeguimiento ? null : Number(pr.stock_actual) || 0) : 0;
                                    const corto = stock !== null && stock < it.cantidad;
                                    return (
                                      <div key={it.producto_id} className="flex flex-wrap items-center gap-x-3.5 gap-y-2 py-3 border-t border-[#eef0f9]">
                                        <span className="w-12 h-12 rounded-[10px] overflow-hidden shrink-0 bg-gradient-to-br from-[#f4f6fc] to-[#e5e9f6] [&_img]:object-contain [&_img]:mix-blend-multiply"><FotoProducto fotoUrl={pr?.foto_url || it.foto_url} categoria={pr?.categoria || it.categoria} className="w-full h-full" iconClassName="text-base" /></span>
                                        <span className="min-w-0 flex-1 basis-[140px]">
                                          <span className="block text-[14px] font-semibold text-stone-900 leading-tight">{it.descripcion}</span>
                                          <span className="block text-[12.5px] text-stone-500 mt-0.5">
                                            {dinero(it.precio_venta)} c/u{stock === null ? ' · servicio' : ` · ${stock} en stock`}
                                            {stock !== null && stock < 1 && <b className="text-[#c0262d] font-semibold"> · sin stock</b>}
                                            {stock !== null && stock >= 1 && corto && <b className="text-[#a15c07] font-semibold"> · solo alcanza para {stock}</b>}
                                          </span>
                                        </span>
                                        <span className="inline-flex items-center border border-[#e6e9f5] rounded-[9px] shrink-0">
                                          <button type="button" aria-label="Menos" onClick={() => actualizarCantidadItemCombo(it.producto_id, it.cantidad - 1)} className="w-[30px] h-8 rounded-[8px] text-stone-700 hover:bg-[#f7f8fc]"><i className="fa-solid fa-minus text-[10px]"></i></button>
                                          <b className="min-w-[24px] text-center text-[13.5px] font-semibold tabular-nums">{it.cantidad}</b>
                                          <button type="button" aria-label="Más" onClick={() => actualizarCantidadItemCombo(it.producto_id, it.cantidad + 1)} className="w-[30px] h-8 rounded-[8px] text-stone-700 hover:bg-[#f7f8fc]"><i className="fa-solid fa-plus text-[10px]"></i></button>
                                        </span>
                                        <span className="text-sm font-semibold text-stone-900 min-w-[64px] text-right shrink-0 tabular-nums">{dinero(it.precio_venta * it.cantidad)}</span>
                                        <button type="button" aria-label="Quitar" title="Quitar" onClick={() => quitarItemCombo(it.producto_id)} className="w-7 h-7 rounded-[7px] text-stone-300 hover:text-[#c0262d] hover:bg-[#fdf1f1] grid place-items-center shrink-0"><i className="fa-solid fa-xmark text-sm"></i></button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className={panelP}>
                              <h4 className="text-base font-semibold text-stone-900 tracking-tight">Precio del combo</h4>
                              <p className="text-[13px] text-stone-500 mt-1 mb-[18px] leading-snug">Si lo dejas sin tocar, es la suma de lo que incluye. Bájalo para dar un descuento.</p>
                              <label className="flex items-baseline gap-2.5 border border-[#e6e9f5] rounded-xl px-[18px] py-3 focus-within:border-[#5b4bd6] focus-within:ring-[3px] focus-within:ring-[#5b4bd6]/10 transition cursor-text">
                                <span className="text-[22px] font-medium text-stone-400">S/</span>
                                <input type="number" min="0" step="0.10" inputMode="decimal" placeholder="0.00" aria-label="Precio del combo" value={f.precio_venta} onChange={(e) => setFormCombo({ ...f, precioTocado: true, precio_venta: e.target.value })} className="w-full min-w-0 bg-transparent outline-none border-0 text-[34px] sm:text-[40px] font-bold tracking-tight text-stone-900 placeholder:text-stone-300 tabular-nums" />
                                {suma > 0 && <span className="hidden sm:block text-[13px] text-stone-500 whitespace-nowrap">suma {dinero(suma)}</span>}
                              </label>
                              {suma > 0 && (
                                <>
                                  <div className="flex flex-wrap items-center gap-2 mt-3.5">
                                    <span className="text-[12.5px] text-stone-500 mr-1">Descuento rápido</span>
                                    <button type="button" onClick={() => aplicarPrecioCombo(suma)} className={chipP(Math.abs(precio - suma) < 0.005)}>Sin descuento</button>
                                    {rapidos.map((r) => <button key={r.pct} type="button" onClick={() => aplicarDescuentoRapidoCombo(r.pct)} className={chipP(Math.abs(precio - r.valor) < 0.005)}>-{r.pct}%</button>)}
                                  </div>
                                  {redondos.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                      <span className="text-[12.5px] text-stone-500 mr-1">Precio redondo</span>
                                      {redondos.map((v) => <button key={v} type="button" onClick={() => aplicarPrecioCombo(v)} className={chipP(Math.abs(precio - v) < 0.005)}>{dinero(v)}</button>)}
                                    </div>
                                  )}
                                  {ahorro > 0.5 && <p className="text-[13px] text-stone-500 mt-3">Tu cliente ahorra <b className="text-stone-900">{dinero(suma - precio)}</b> ({Math.round(ahorro)}%).</p>}
                                  {precio > suma + 0.005 && <p className="text-[13px] text-stone-500 mt-3">El combo sale más caro que comprar por separado ({dinero(suma)}).</p>}
                                </>
                              )}
                              {suma > 0 && costo > 0 && precio > 0 && (
                                <div className="mt-[18px] pt-[18px] border-t border-[#eef0f9]">
                                  {(() => {
                                    const total = Math.max(precio, costo);
                                    const wCosto = Math.min(100, costo / total * 100);
                                    const wGana = m.perdida ? 100 - wCosto : Math.max(0, (precio - costo) / total * 100);
                                    const colorGana = m.perdida ? 'bg-[#c0262d]' : m.bajo ? 'bg-[#d98a14]' : 'bg-[#0f7b4a]';
                                    const textoGana = m.perdida ? 'text-[#c0262d]' : m.bajo ? 'text-[#a15c07]' : 'text-[#0f7b4a]';
                                    return (
                                      <>
                                        <div className="flex h-2 rounded overflow-hidden bg-[#e8ecf7]"><i className="block h-full bg-[#c8c6da]" style={{ width: `${wCosto}%` }}></i><i className={`block h-full ${colorGana}`} style={{ width: `${wGana}%` }}></i></div>
                                        <div className="grid grid-cols-3 gap-3.5 mt-3.5">
                                          <div><span className="block text-[12.5px] text-stone-500">Te cuesta</span><b className="block text-[19px] font-bold tracking-tight mt-0.5 tabular-nums">{dinero(costo)}</b></div>
                                          <div><span className="block text-[12.5px] text-stone-500">{m.perdida ? 'Pierdes' : 'Ganas'}</span><b className={`block text-[19px] font-bold tracking-tight mt-0.5 tabular-nums ${textoGana}`}>{dinero(Math.abs(m.ganancia))}</b></div>
                                          <div><span className="block text-[12.5px] text-stone-500">Margen</span><b className="block text-[19px] font-bold tracking-tight mt-0.5 tabular-nums">{m.margenPct.toFixed(m.margenPct < 10 ? 1 : 0)}%</b></div>
                                        </div>
                                        {m.perdida
                                          ? <p className="mt-3.5 text-[13px] rounded-[9px] px-3 py-2.5 leading-snug bg-[#fdf1f1] text-[#c0262d]">El precio ({dinero(precio)}) es menor que lo que te cuestan estos productos ({dinero(costo)}). Estarías vendiendo a pérdida.</p>
                                          : m.bajo
                                            ? <p className="mt-3.5 text-[13px] rounded-[9px] px-3 py-2.5 leading-snug bg-[#fdf5e8] text-[#a15c07]">Margen muy bajo. Revisa el precio para no trabajar casi gratis.</p>
                                            : <p className="mt-3.5 text-[13px] rounded-[9px] px-3 py-2.5 leading-snug bg-[#eef8f2] text-[#0f7b4a]">Buen margen: ganas {dinero(m.ganancia)} por cada combo que vendas.</p>}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                              {suma > 0 && !(costo > 0) && precio > 0 && (
                                <p className="mt-[18px] text-[13px] rounded-[9px] px-3 py-2.5 leading-snug bg-[#eff2fd] text-[#2d284b]">{esBarberia ? 'Los servicios no tienen costo cargado, así que no puedo calcular tu ganancia.' : 'Estos productos no tienen costo cargado, así que no puedo calcular tu ganancia.'}</p>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-4 bg-white border border-[#e6e9f5] rounded-2xl px-5 py-4">
                              <span>
                                <span className="block text-sm font-semibold text-stone-900">En venta</span>
                                <span className="block text-[13px] text-stone-500 leading-snug mt-0.5">{f.activo ? 'Aparece en la caja para vender. Se pausa solo si falta stock y se enciende al reponer.' : 'Pausado: no aparece en la caja.'}</span>
                              </span>
                              <span className="flex items-center gap-2.5 shrink-0">
                                <span className={`text-[13px] font-semibold ${f.activo ? 'text-[#0f7b4a]' : 'text-stone-500'}`}>{f.activo ? 'Activo' : 'Pausado'}</span>
                                <button type="button" role="switch" aria-checked={f.activo} aria-label="En venta" onClick={() => setFormCombo({ ...f, activo: !f.activo })} className={`kz-sw ${f.activo ? 'on' : ''}`}><i></i></button>
                              </span>
                            </div>
                          </div>

                          <div className="min-w-0 md:sticky md:top-0 md:self-start order-first md:order-none">
                            <p className="hidden md:block text-[12.5px] font-medium text-stone-500 mb-2.5">Así lo verá el cajero</p>
                            <div className="hidden md:block bg-white border border-[#e6e9f5] rounded-[18px] overflow-hidden shadow-[0_18px_40px_-22px_rgba(20,10,50,0.35)]">
                              <div className={`relative grid gap-[2px] bg-[#e6e9f5] h-[118px] ${pvFotos.length >= 3 ? 'grid-cols-3' : pvFotos.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {pvFotos.length === 0
                                  ? <span className="grid place-items-center bg-gradient-to-br from-[#f4f6fc] to-[#e5e9f6] text-[#8f8cb0] text-3xl"><i className="fa-solid fa-gift"></i></span>
                                  : pvFotos.map((it) => (
                                    <span key={it.producto_id} className="relative bg-gradient-to-br from-[#f4f6fc] to-[#e5e9f6] overflow-hidden [&_img]:object-contain [&_img]:mix-blend-multiply [&_img]:p-2">
                                      <FotoProducto fotoUrl={vivo(it.producto_id)?.foto_url || it.foto_url} categoria={vivo(it.producto_id)?.categoria || it.categoria} className="w-full h-full" iconClassName="text-xl" />
                                      {it.cantidad > 1 && <em className="absolute right-1.5 bottom-1.5 not-italic bg-[#14172b] text-white rounded-full text-[10.5px] font-bold px-1.5">×{it.cantidad}</em>}
                                    </span>
                                  ))}
                                {ahorro > 0.5 && <span className="absolute left-3 top-3 bg-[#ffc81a] text-[#14172b] text-[11.5px] font-bold rounded-full px-2.5 py-0.5 shadow-md">Ahorras {Math.round(ahorro)}%</span>}
                              </div>
                              <div className="px-[18px] pt-4 pb-[18px]">
                                <h5 className="text-[15.5px] font-semibold tracking-tight text-stone-900 leading-tight">{f.nombre.trim() || 'Nombre del combo'}</h5>
                                {f.descripcion.trim() && <p className="text-[12.5px] text-stone-500 leading-snug mt-1">{f.descripcion.trim()}</p>}
                                {f.items.length > 0 && (
                                  <ul className="mt-2.5 text-[13px] text-stone-700">
                                    {f.items.map((it) => <li key={it.producto_id} className="flex gap-2 py-0.5"><b className="text-[#5b4bd6] min-w-[22px] font-semibold">{it.cantidad}×</b><span>{it.descripcion}</span></li>)}
                                  </ul>
                                )}
                                <div className="flex items-baseline gap-2 mt-3 pt-3 border-t border-dashed border-[#e6e9f5]">
                                  <strong className="text-[26px] font-bold tracking-tight tabular-nums">{dinero(precio)}</strong>
                                  {ahorro > 0.5 && <s className="text-[13px] text-stone-400">{dinero(suma)}</s>}
                                </div>
                                <div className={`mt-3.5 h-11 grid place-items-center text-[13.5px] font-semibold ${f.activo ? 'kz-pri !pointer-events-none' : 'rounded-full bg-[#e6e9f5] text-[#8b869a]'}`}>{f.activo ? 'Agregar al carrito' : 'Pausado'}</div>
                              </div>
                            </div>
                            {f.items.length > 0 && (
                              maxCombos === Infinity
                                ? <p className="mt-3 rounded-xl bg-[#eef1fb] text-stone-600 px-3.5 py-3 text-[13px] leading-snug">Solo incluye servicios: siempre está disponible.</p>
                                : maxCombos === 0
                                  ? <p className="mt-3 rounded-xl bg-[#fdf1f1] text-[#c0262d] px-3.5 py-3 text-[13px] leading-snug">Hoy no se puede vender: falta stock de <b>{faltan.join(', ')}</b>.</p>
                                  : <p className="mt-3 rounded-xl bg-[#eef8f2] text-[#0f7b4a] px-3.5 py-3 text-[13px] leading-snug">Con tu stock de hoy puedes armar <b className="text-[15px]">{maxCombos}</b> combo{maxCombos === 1 ? '' : 's'}.</p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 bg-white border-t border-[#e6e9f5] px-4 sm:px-7 py-3.5 flex items-center gap-3">
                          <button type="button" onClick={cerrarEditorCombo} className="h-11 px-5 rounded-full border border-[#e6e9f5] bg-white hover:bg-[#f7f8fc] text-stone-700 font-medium text-[13.5px]">Cancelar</button>
                          <span className="flex-1"></span>
                          <span className={`hidden md:flex items-center text-[13px] ${errores.length ? 'text-stone-500' : 'text-[#2d284b] font-medium'}`}>{errores.length ? errores.join(' · ') : hayCambios ? 'Hay cambios sin guardar' : 'Todo en orden'}</span>
                          <button type="button" onClick={guardarCombo} disabled={guardandoCombo || errores.length > 0 || (!!f.id && !hayCambios)} className="kz-pri h-11 px-6 text-[13.5px] font-semibold inline-flex items-center justify-center gap-2">
                            <span>{guardandoCombo ? 'Guardando...' : (f.id ? 'Guardar cambios' : 'Guardar combo')}</span>{chispa}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ----- Lista -----
                const filas = combos.map((c) => ({ c, est: estadoDe(c) }));
                const nVenta = filas.filter((x) => x.est === 'venta').length;
                const nSin = filas.filter((x) => x.est === 'sinstock').length;
                const nPausa = filas.filter((x) => x.est === 'pausado').length;
                const qLista = norm(busquedaCombos.trim());
                const visibles = filas.filter((x) => (filtroCombos === 'todos' || x.est === filtroCombos) && (!qLista || norm(x.c.nombre).includes(qLista)));

                return (
                  <div className="ventana-riel fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-[#f7f8fc] border border-black/5 rounded-[18px] max-w-5xl w-full shadow-2xl h-[95vh] max-h-[800px] flex flex-col overflow-hidden">

                      <div className="bg-white border-b border-[#e6e9f5] px-4 sm:px-7 py-4 shrink-0 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[19px] sm:text-[21px] font-bold text-stone-900 tracking-tight leading-tight">Combos</h3>
                          <p className="hidden sm:block text-[13px] text-stone-500 mt-1 max-w-[520px] leading-snug">Paquetes de varios {esBarberia ? 'servicios y productos' : 'productos'} a un precio especial. Al venderse, descuentan el stock de cada producto que incluyen.</p>
                        </div>
                        <button type="button" onClick={nuevoCombo} className="kz-pri h-11 px-5 text-[13.5px] font-semibold inline-flex items-center gap-2 shrink-0"><span>Nuevo<span className="hidden sm:inline"> combo</span></span>{chispa}</button>
                        <button aria-label="Cerrar" onClick={cerrarModalCombos} className="w-9 h-9 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-[#eef1fb] transition-colors shrink-0"><i className="fa-solid fa-xmark"></i></button>
                      </div>

                      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 sm:px-7 py-5 sm:py-6">
                        <div className="flex gap-6 sm:gap-9 mb-5">
                          <div><b className="block text-[26px] sm:text-[30px] font-bold tracking-tight leading-none">{nVenta}</b><span className="block text-[12.5px] text-stone-500 mt-1.5">En venta ahora</span></div>
                          <div><b className={`block text-[26px] sm:text-[30px] font-bold tracking-tight leading-none ${nSin ? 'text-[#a15c07]' : ''}`}>{nSin}</b><span className="block text-[12.5px] text-stone-500 mt-1.5">Sin stock</span></div>
                          <div><b className="block text-[26px] sm:text-[30px] font-bold tracking-tight leading-none">{nPausa}</b><span className="block text-[12.5px] text-stone-500 mt-1.5">Pausados</span></div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mb-5">
                          <label className="flex items-center gap-2.5 h-10 w-full sm:w-[280px] px-3.5 rounded-[10px] border border-[#e6e9f5] bg-white text-stone-400 focus-within:border-[#5b4bd6]">
                            <i className="fa-solid fa-magnifying-glass text-[13px]"></i>
                            <input type="text" autoComplete="off" placeholder="Buscar combo" value={busquedaCombos} onChange={(e) => setBusquedaCombos(e.target.value)} className="flex-1 min-w-0 bg-transparent text-[13.5px] text-stone-900 outline-none placeholder:text-stone-400" />
                          </label>
                          <div className="flex w-full sm:w-auto bg-[#e8ecf7] rounded-[10px] p-[3px] max-w-full overflow-x-auto hide-scrollbar">
                            {[['todos', 'Todos', filas.length], ['venta', 'En venta', nVenta], ['sinstock', 'Sin stock', nSin], ['pausado', 'Pausados', nPausa]].map(([k, t, n]) => (
                              <button key={k} type="button" onClick={() => setFiltroCombos(k)} className={`h-8 px-2 sm:px-3.5 flex-1 sm:flex-none justify-center rounded-[8px] text-[12px] sm:text-[13px] whitespace-nowrap flex items-center gap-1 sm:gap-1.5 transition ${filtroCombos === k ? 'bg-white text-stone-900 font-semibold shadow-[0_1px_3px_rgba(20,10,50,0.12)]' : 'text-stone-500 font-medium hover:text-stone-900'}`}>{t} <span className="text-[11.5px] text-stone-500 font-normal">{n}</span></button>
                            ))}
                          </div>
                        </div>

                        {cargandoCombos ? (
                          <p className="text-[13px] text-center py-10 text-stone-500">Cargando combos...</p>
                        ) : combos.length === 0 ? (
                          <div className="text-center max-w-xs mx-auto py-10 text-[13.5px] text-stone-500 leading-snug">
                            <div className="w-16 h-16 rounded-2xl bg-white border border-[#e6e9f5] text-[#5b4bd6] grid place-items-center text-[26px] mx-auto mb-3"><i className="fa-solid fa-gift"></i></div>
                            <b className="block text-base text-stone-900 mb-0.5">Todavía no tienes combos</b>
                            Junta varios {esBarberia ? 'servicios y productos' : 'productos'} en un paquete a precio especial. Toca «Nuevo combo» para crear el primero.
                          </div>
                        ) : visibles.length === 0 ? (
                          <p className="text-center py-8 text-[13.5px] text-stone-500"><b className="block text-stone-900">Ningún combo coincide</b>Prueba con otro filtro o con otra palabra.</p>
                        ) : (
                          <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
                            {visibles.map(({ c: combo, est }) => {
                              const items = combo.combos_items || [];
                              const suma = items.reduce((acc, ci) => acc + (Number(ci.productos?.precio_venta) || 0) * Number(ci.cantidad), 0);
                              const costo = items.reduce((acc, ci) => acc + (Number(ci.productos?.precio_costo) || 0) * Number(ci.cantidad), 0);
                              const precio = Number(combo.precio_venta) || 0;
                              const ahorro = suma > 0 ? (1 - precio / suma) * 100 : 0;
                              const mc = costo > 0 && precio > 0 ? margenCombo(precio, costo) : null;
                              const e = estadoCombos.get(combo.id);
                              const enVenta = est === 'venta';
                              const fotos = items.slice(0, 3);
                              return (
                                <div key={combo.id} className="bg-white rounded-2xl border border-[#e6e9f5] shadow-[0_1px_2px_rgba(20,10,50,0.04),0_12px_28px_-18px_rgba(20,10,50,0.18)] hover:shadow-[0_1px_2px_rgba(20,10,50,0.04),0_18px_36px_-16px_rgba(20,10,50,0.28)] hover:-translate-y-px flex flex-col overflow-hidden transition">
                                  <div className={`relative grid gap-[2px] bg-[#e6e9f5] h-[132px] ${fotos.length >= 3 ? 'grid-cols-3' : fotos.length === 2 ? 'grid-cols-2' : 'grid-cols-1'} ${enVenta ? '' : 'opacity-60'}`}>
                                    {fotos.map((ci, i) => (
                                      <span key={ci.id || i} className="relative bg-gradient-to-br from-[#f4f6fc] to-[#e5e9f6] overflow-hidden [&_img]:object-contain [&_img]:mix-blend-multiply [&_img]:p-2.5">
                                        <FotoProducto fotoUrl={vivo(ci.producto_id)?.foto_url || ci.productos?.foto_url} categoria={vivo(ci.producto_id)?.categoria || ci.productos?.categoria} className="w-full h-full" iconClassName="text-2xl" />
                                        {Number(ci.cantidad) > 1 && <em className="absolute right-1.5 bottom-1.5 not-italic bg-[#14172b] text-white rounded-full text-[10.5px] font-bold px-1.5">×{Number(ci.cantidad)}</em>}
                                      </span>
                                    ))}
                                    {items.length > 3 && <em className="absolute right-3 top-3 not-italic bg-[#14172b] text-white rounded-full text-[11px] font-bold px-2 py-0.5">+{items.length - 3}</em>}
                                    {enVenta && ahorro > 0.5 && <span className="absolute left-3 top-3 bg-[#ffc81a] text-[#14172b] text-[11.5px] font-bold rounded-full px-2.5 py-0.5 shadow-md">Ahorra {Math.round(ahorro)}%</span>}
                                    {!enVenta && <span className={`absolute left-3 top-3 text-[11.5px] font-semibold rounded-full px-2.5 py-0.5 bg-white/90 ${est === 'sinstock' ? 'text-[#c0262d]' : 'text-stone-600'}`}>{est === 'sinstock' ? 'Sin stock' : 'Pausado'}</span>}
                                  </div>
                                  <div className={`px-4 pt-4 pb-3 flex flex-col gap-2 flex-1 ${enVenta ? '' : 'opacity-70'}`}>
                                    <h5 className="text-[15.5px] font-semibold text-stone-900 tracking-tight leading-tight">{combo.nombre}</h5>
                                    <p className="text-[12.5px] text-stone-500 leading-relaxed">{items.map((ci) => `${Number(ci.cantidad) > 1 ? `${Number(ci.cantidad)}× ` : ''}${ci.productos?.descripcion || '(producto eliminado)'}`).join(' · ')}</p>
                                    <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
                                      <strong className="text-2xl font-bold tracking-tight tabular-nums">{dinero(precio)}</strong>
                                      {suma > precio + 0.005 && <s className="text-[13px] text-stone-400">{dinero(suma)}</s>}
                                    </div>
                                    {mc && (
                                      <p className="text-[12.5px] text-stone-500">
                                        {mc.perdida
                                          ? <b className="text-[#c0262d] font-semibold">Pérdida {dinero(-mc.ganancia)}</b>
                                          : <>Ganas <b className={`font-semibold ${mc.bajo ? 'text-[#a15c07]' : 'text-[#0f7b4a]'}`}>{dinero(mc.ganancia)}</b> · {mc.margenPct.toFixed(mc.margenPct < 10 ? 1 : 0)}%</>}
                                      </p>
                                    )}
                                    {est === 'sinstock' && (
                                      <p className="text-[12.5px] rounded-lg bg-[#fdf1f1] text-[#c0262d] px-2.5 py-2 leading-snug">Pausado por falta de stock: {(e?.faltan || []).join(', ')}. Se enciende solo al reponer.</p>
                                    )}
                                    {enVenta && e && Number.isFinite(e.unidades) && (
                                      <p className="text-[12.5px] text-stone-500">Con tu stock puedes vender hasta <b className="text-stone-800 font-semibold">{unidadesDe(e.unidades)}</b>.</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 pl-4 pr-3 py-2.5 border-t border-[#eef0f9]">
                                    <button type="button" role="switch" aria-checked={enVenta} onClick={() => (est === 'sinstock' ? notificar('Se enciende solo cuando repongas el stock.', 'info') : alternarActivoCombo(combo))} className="flex items-center gap-2.5 whitespace-nowrap text-[13px] font-medium text-stone-700">
                                      <span className={`kz-sw ${enVenta ? 'on' : ''}`}><i></i></span>
                                      {enVenta ? 'En venta' : est === 'sinstock' ? 'Pausado por stock' : 'Pausado'}
                                    </button>
                                    <span className="flex-1"></span>
                                    <button type="button" onClick={() => duplicarCombo(combo)} title="Duplicar" aria-label="Duplicar" className="w-8 h-8 rounded-[9px] text-stone-400 hover:text-[#5b4bd6] hover:bg-[#eff2fd] grid place-items-center"><i className="fa-regular fa-copy text-[15px]"></i></button>
                                    <button type="button" onClick={() => editarCombo(combo)} title="Editar" aria-label="Editar" className="w-8 h-8 rounded-[9px] text-stone-400 hover:text-[#5b4bd6] hover:bg-[#eff2fd] grid place-items-center"><i className="fa-solid fa-pen text-[14px]"></i></button>
                                    <button type="button" onClick={() => eliminarCombo(combo)} title="Eliminar" aria-label="Eliminar" className="w-8 h-8 rounded-[9px] text-stone-400 hover:text-[#c0262d] hover:bg-[#fdf1f1] grid place-items-center"><i className="fa-solid fa-trash-can text-[14px]"></i></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
    </>
  );
}
