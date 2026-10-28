import React from 'react';
import { FotoProducto, estiloCategoria } from './PanelAdminCompartido.jsx';
import { esMontoNoNegativo } from './lib/validaciones.js';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function EditarProducto({
  agregarCategoriaPersonalizada,
  categoriasDB,
  combos,
  desactivarProducto,
  esBarberia,
  formEditarOriginal,
  formEditarProducto,
  guardandoEdicionProducto,
  guardarEdicionProducto,
  modalEditarProducto,
  pedirConfirmacion,
  productos,
  quitarFotoExtra,
  sesion,
  setFormEditarProducto,
  setMetodoForzado,
  setModalEditarProducto,
  setModalEscaner,
  setModoEscaner,
  setTabEditarProducto,
  subiendoFotoExtra,
  subiendoFotoProducto,
  subirFotoExtraProducto,
  subirFotoProducto,
  tabEditarProducto,
}) {
  return (
    <>
              {/* Modal: Editar / Desactivar Producto */}
              {modalEditarProducto && formEditarProducto && (() => {
                // Editar producto con pestañas (General, Precio y stock, Tienda en línea) y panel de
                // "cambios sin guardar" que compara con formEditarOriginal (el formulario al abrir).
                const f = formEditarProducto;
                const o = formEditarOriginal || formEditarProducto;
                const setF = (campo, valor) => setFormEditarProducto((prev) => ({ ...prev, [campo]: valor }));
                const esServicio = esBarberia && f.stock_actual === '';
                const pv = Number(f.precio_venta) || 0;
                const pvOriginal = Number(o.precio_venta) || 0;
                const pc = Number(f.precio_costo) || 0;
                const margenPct = pv > 0 && pc > 0 ? ((pv - pc) / pv) * 100 : null;
                const fotoDeshabilitada = sesion?.bodega?.permitir_subir_fotos === false;
                const duracionTexto = String(f.duracion_min ?? '').trim();
                const duracionOk = duracionTexto === '' || (Number.isInteger(Number(duracionTexto)) && Number(duracionTexto) >= 5 && Number(duracionTexto) <= 480);
                const mostrarPack = f.unidad !== 'KG' && (!esBarberia || f.vendeEnPack);
                const fotosExtra = f.fotos_extra || [];

                // --- Errores (bloquean "Guardar cambios" y marcan la pestaña) ---
                const errores = {};
                if (f.descripcion.trim().length < 2) errores.descripcion = 'Escribe un nombre.';
                if (!(pv > 0)) errores.precio = 'Pon un precio de venta mayor a 0.';
                if (!esMontoNoNegativo(f.precio_costo)) errores.costo = 'El costo no puede ser negativo.';
                if (!esMontoNoNegativo(f.stock_actual)) errores.stock = 'El stock no puede ser negativo.';
                if (esServicio && !duracionOk) errores.duracion = 'La duración va de 5 a 480 minutos.';
                if (f.vendeEnPack && !(Number(f.unidades_por_pack) >= 2 && Number(f.precio_venta_pack) > 0)) errores.pack = 'El pack necesita 2 o más unidades y su precio.';
                const pestanaDeError = { descripcion: 'general', precio: 'precio', costo: 'precio', stock: 'precio', duracion: 'precio', pack: 'precio' };
                const hayErrores = Object.keys(errores).length > 0;

                // --- Cambios respecto a lo guardado ---
                const distinto = (a, b) => String(a ?? '') !== String(b ?? '');
                const cambios = [];
                const agregar = (pestana, etiqueta, antes, despues, campos) => cambios.push({ pestana, etiqueta, antes: String(antes), despues: String(despues), campos });
                if (distinto(o.descripcion, f.descripcion)) agregar('general', 'Nombre', o.descripcion, f.descripcion, ['descripcion']);
                if (distinto(o.categoria, f.categoria)) agregar('general', 'Categoría', o.categoria, f.categoria, ['categoria']);
                if (distinto(o.cod_ean, f.cod_ean)) agregar('general', 'Código', o.cod_ean || 'sin código', f.cod_ean || 'sin código', ['cod_ean']);
                if (distinto(o.sku, f.sku)) agregar('general', 'SKU', o.sku || '—', f.sku || '—', ['sku']);
                if (distinto(o.foto_url, f.foto_url)) agregar('general', 'Foto', 'anterior', f.foto_url ? 'nueva' : 'sin foto', ['foto_url']);
                if (Number(o.precio_venta) !== Number(f.precio_venta)) agregar('precio', 'Precio', `S/ ${pvOriginal.toFixed(2)}`, `S/ ${pv.toFixed(2)}`, ['precio_venta']);
                if (Number(o.precio_costo || 0) !== Number(f.precio_costo || 0)) agregar('precio', 'Costo', `S/ ${(Number(o.precio_costo) || 0).toFixed(2)}`, `S/ ${pc.toFixed(2)}`, ['precio_costo']);
                if (o.unidad !== f.unidad) agregar('precio', 'Se vende por', o.unidad === 'KG' ? 'kilo' : 'unidad', f.unidad === 'KG' ? 'kilo' : 'unidad', ['unidad']);
                if (distinto(o.stock_actual, f.stock_actual)) agregar('precio', 'Stock', o.stock_actual === '' ? 'sin control' : o.stock_actual, f.stock_actual === '' ? 'sin control' : f.stock_actual, ['stock_actual']);
                if (esServicio && distinto(o.duracion_min, f.duracion_min)) agregar('precio', 'Duración', `${o.duracion_min || 30} min`, `${f.duracion_min || 30} min`, ['duracion_min']);
                if (!!o.vendeEnPack !== !!f.vendeEnPack || (f.vendeEnPack && (distinto(o.unidades_por_pack, f.unidades_por_pack) || distinto(o.precio_venta_pack, f.precio_venta_pack) || distinto(o.cod_ean_pack, f.cod_ean_pack)))) {
                  agregar('precio', 'Pack', o.vendeEnPack ? `x${o.unidades_por_pack} · S/ ${Number(o.precio_venta_pack || 0).toFixed(2)}` : 'sin pack', f.vendeEnPack ? `x${f.unidades_por_pack || '?'} · S/ ${Number(f.precio_venta_pack || 0).toFixed(2)}` : 'sin pack', ['vendeEnPack', 'unidades_por_pack', 'precio_venta_pack', 'cod_ean_pack']);
                }
                if (!!o.es_destacado !== !!f.es_destacado) agregar('tienda', 'Destacado', o.es_destacado ? 'sí' : 'no', f.es_destacado ? 'sí' : 'no', ['es_destacado']);
                if (esBarberia && (o.visible_en_tienda !== false) !== (f.visible_en_tienda !== false)) agregar('tienda', 'En la tienda', o.visible_en_tienda !== false ? 'visible' : 'oculto', f.visible_en_tienda !== false ? 'visible' : 'oculto', ['visible_en_tienda']);
                if (distinto(o.descripcion_larga, f.descripcion_larga)) agregar('tienda', 'Descripción', o.descripcion_larga ? 'escrita' : 'vacía', f.descripcion_larga ? 'editada' : 'vacía', ['descripcion_larga']);
                if (JSON.stringify(o.fotos_extra || []) !== JSON.stringify(fotosExtra)) agregar('tienda', 'Fotos extra', (o.fotos_extra || []).length, fotosExtra.length, ['fotos_extra']);
                const deshacer = (c) => setFormEditarProducto((prev) => {
                  const nuevo = { ...prev };
                  c.campos.forEach((k) => { nuevo[k] = o[k]; });
                  return nuevo;
                });
                const tieneCambios = cambios.length > 0;
                const pestana = tabEditarProducto;
                const pestanas = [['general', 'General'], ['precio', esServicio ? 'Precio y duración' : 'Precio y stock'], ['tienda', 'Tienda en línea']];

                const cerrar = async () => {
                  if (tieneCambios) {
                    const ok = await pedirConfirmacion({ titulo: 'Tienes cambios sin guardar', mensaje: 'Si cierras ahora, se pierden.', textoBoton: 'Cerrar sin guardar', peligroso: true });
                    if (!ok) return;
                  }
                  setModalEditarProducto(false);
                };
                const descartar = async () => {
                  const ok = await pedirConfirmacion({ titulo: '¿Descartar los cambios?', mensaje: `Volverás a los datos guardados de "${o.descripcion}".`, textoBoton: 'Descartar' });
                  if (ok) setFormEditarProducto(o);
                };
                const ajustarStock = (delta) => {
                  const actual = Number(f.stock_actual) || 0;
                  setF('stock_actual', String(Math.max(0, Math.round((actual + delta) * 10) / 10)));
                };
                const stockTag = esServicio
                  ? { texto: `Servicio · ${Number(f.duracion_min) || 30} min`, clase: 'bg-[#f4eefe] text-[#4d04b0]' }
                  : f.stock_actual === ''
                    ? { texto: 'Sin control de stock', clase: 'bg-[#f4eefe] text-[#4d04b0]' }
                    : Number(f.stock_actual) <= 0
                      ? { texto: 'Sin stock', clase: 'bg-rose-50 text-rose-600' }
                      : Number(f.stock_actual) <= 5
                        ? { texto: `Quedan ${f.stock_actual}${f.unidad === 'KG' ? ' kg' : ''}`, clase: 'bg-amber-50 text-amber-700' }
                        : { texto: `${f.stock_actual}${f.unidad === 'KG' ? ' kg' : ''} en stock`, clase: 'bg-emerald-50 text-emerald-700' };
                const categoriaVisibles = (() => {
                  const base = categoriasDB.slice(0, 6);
                  return f.categoria && !base.includes(f.categoria) ? [...base, f.categoria] : base;
                })();
                const inputBase = 'w-full h-11 bg-stone-50/70 border-[1.5px] border-stone-200 rounded-[14px] px-3.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#6105dc] focus:bg-white focus:ring-4 focus:ring-[#6105dc]/15 transition disabled:bg-stone-100 disabled:text-stone-500';
                const inputError = 'border-rose-400 bg-rose-50 focus:border-rose-500 focus:ring-rose-200';
                const chipClase = (activo) => `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold border-[1.5px] transition ${activo ? 'border-[#6105dc] bg-[#f4eefe] text-[#4d04b0] ring-2 ring-[#6105dc]/15' : 'border-stone-200 bg-white text-stone-600 hover:bg-[#f4eefe] hover:border-[#e4d6fb]'}`;
                const segClase = (activo) => `rounded-[11px] py-2.5 px-2 text-[13px] font-bold transition text-center ${activo ? 'bg-white text-[#4d04b0] shadow-sm' : 'text-stone-500 hover:text-stone-700'}`;
                const etiqueta = 'flex items-center justify-between gap-2 text-[12.5px] font-semibold text-stone-800 mb-1.5';
                const interruptor2 = ({ activo, onClick, icono, titulo, detalle, aviso }) => (
                  <button type="button" role="switch" aria-checked={activo} onClick={onClick} className={`w-full flex items-center justify-between gap-3 text-left rounded-2xl border-[1.5px] px-3.5 py-3 transition ${activo ? 'border-[#6105dc] bg-[#fcfaff]' : aviso ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}>
                    <span className="flex items-center gap-3 min-w-0">
                      <span className={`w-[34px] h-[34px] rounded-[11px] grid place-items-center shrink-0 text-sm ${activo ? 'bg-[#6105dc] text-white' : aviso ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-400'}`}><i className={`fa-solid ${icono}`}></i></span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-bold text-stone-800">{titulo}</span>
                        <span className="block text-xs text-stone-500 leading-snug">{detalle}</span>
                      </span>
                    </span>
                    <span className={`relative w-[42px] h-6 rounded-full shrink-0 transition-colors ${activo ? 'bg-[#6105dc]' : 'bg-stone-300'}`}>
                      <span className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-[18px]' : ''}`}></span>
                    </span>
                  </button>
                );

                return (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                  <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-4xl w-full shadow-2xl h-[95vh] max-h-[820px] flex flex-col overflow-hidden">

                    {/* Cabecera: ficha del producto + pestañas */}
                    <div className="bg-white border-b border-stone-100 px-4 sm:px-5 pt-3.5 shrink-0">
                      <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                        <b className="text-[13px] text-stone-900">Editar producto</b>
                        {f.sku && <span>· {f.sku}</span>}
                        <button onClick={cerrar} aria-label="Cerrar" className="ml-auto w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors shrink-0"><i className="fa-solid fa-xmark"></i></button>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-3.5 mt-2.5 mb-3.5">
                        <label className={`relative w-[52px] h-[52px] sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 border border-stone-200 group ${fotoDeshabilitada ? '' : 'cursor-pointer'}`} title={fotoDeshabilitada ? 'La subida de fotos está desactivada para tu negocio' : 'Cambiar foto'}>
                          <FotoProducto fotoUrl={f.foto_url} categoria={f.categoria} className="w-full h-full" iconClassName="text-2xl" />
                          {!fotoDeshabilitada && (
                            <>
                              <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition">
                                {subiendoFotoProducto ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <i className="fa-solid fa-camera text-white text-base opacity-0 group-hover:opacity-100 transition"></i>}
                              </span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (file) subirFotoProducto(file); }} />
                            </>
                          )}
                        </label>
                        <div className="min-w-0 flex-1">
                          <h1 className="text-base sm:text-[19px] font-extrabold text-stone-900 tracking-tight leading-tight truncate">{f.descripcion.trim() || 'Sin nombre'}</h1>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-[#f4eefe] text-[#4d04b0]">{f.categoria || 'Sin categoría'}</span>
                            <span className={`text-[11px] font-bold rounded-full px-2.5 py-0.5 ${stockTag.clase}`}>{stockTag.texto}</span>
                            {f.es_destacado && <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-[#fff6d6] text-[#8a6200]">★ Destacado</span>}
                            {esBarberia && f.visible_en_tienda === false && <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-amber-50 text-amber-700">Oculto en la tienda</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {pvOriginal !== pv && <s className="text-xs font-semibold text-stone-300 mr-1.5">S/ {pvOriginal.toFixed(2)}</s>}
                          <strong className="block sm:inline text-xl sm:text-2xl font-extrabold text-[#4d04b0] leading-tight">S/ {pv.toFixed(2)}</strong>
                          <small className="block text-[11px] font-semibold text-stone-400">{esBarberia ? (esServicio ? 'servicio' : 'unidad') : (f.unidad === 'KG' ? 'por kg' : 'por unidad')}</small>
                        </div>
                      </div>
                      <div className="flex gap-1 -mx-1.5 overflow-x-auto hide-scrollbar" role="tablist">
                        {pestanas.map(([id, titulo]) => {
                          const nCambios = cambios.filter((c) => c.pestana === id).length;
                          const conError = Object.keys(errores).some((k) => pestanaDeError[k] === id);
                          return (
                            <button key={id} type="button" role="tab" aria-selected={pestana === id} onClick={() => setTabEditarProducto(id)} className={`relative px-3 sm:px-4 pt-2.5 pb-3 text-[13px] sm:text-[13.5px] font-bold whitespace-nowrap flex items-center gap-2 rounded-t-xl ${pestana === id ? 'text-[#4d04b0]' : 'text-stone-500 hover:text-stone-800'}`}>
                              {titulo}
                              {conError ? <span className="w-2 h-2 rounded-full bg-rose-500 ring-[3px] ring-rose-500/15" title="Falta completar algo en esta pestaña"></span> : nCambios > 0 ? <span className="w-2 h-2 rounded-full bg-[#6105dc] ring-[3px] ring-[#6105dc]/15" title={`${nCambios} cambio${nCambios > 1 ? 's' : ''} sin guardar`}></span> : null}
                              {pestana === id && <span className="absolute left-3 right-3 -bottom-px h-[3px] rounded bg-[#6105dc]"></span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cuerpo: pestaña activa + vista previa y cambios */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid gap-4 md:gap-5 md:grid-cols-[minmax(0,1fr)_280px] content-start">
                      <div className="min-w-0">
                        <div className="bg-white border border-stone-100 rounded-[22px] p-4 sm:p-5 shadow-sm space-y-4">

                          {pestana === 'general' && (
                            <>
                              <div>
                                <h4 className="text-[17px] font-extrabold text-stone-900 tracking-tight">Datos del producto</h4>
                              </div>
                              <div>
                                <label className={etiqueta}><span>{esBarberia ? 'Nombre' : 'Nombre del producto'} <span className="text-rose-500">*</span></span></label>
                                <input type="text" autoComplete="off" value={f.descripcion} onChange={(e) => setF('descripcion', e.target.value)} className={`${inputBase} ${errores.descripcion ? inputError : ''}`} />
                                {errores.descripcion && <p className="text-[11.5px] text-rose-600 mt-1.5">{errores.descripcion}</p>}
                              </div>
                              <div>
                                <label className={etiqueta}><span>Categoría</span></label>
                                <div className="flex flex-wrap gap-2">
                                  {categoriaVisibles.map((c) => (
                                    <button key={c} type="button" onClick={() => setF('categoria', c)} className={chipClase(f.categoria === c)}>
                                      <i className={`fa-solid ${estiloCategoria(c).icono} text-[11px]`}></i>{c}
                                    </button>
                                  ))}
                                  <button type="button" onClick={() => agregarCategoriaPersonalizada((v) => setFormEditarProducto((prev) => ({ ...prev, categoria: v })))} className={`${chipClase(false)} border-dashed text-stone-500`}>
                                    <i className="fa-solid fa-plus text-[10px]"></i> Nueva
                                  </button>
                                </div>
                                {categoriasDB.length > 6 && (
                                  <select value={f.categoria} onChange={(e) => setF('categoria', e.target.value)} aria-label="Ver todas las categorías" className="mt-2 h-9 bg-stone-50/70 border border-stone-200 rounded-xl px-3 text-xs text-stone-600">
                                    {!categoriasDB.includes(f.categoria) && f.categoria && <option value={f.categoria}>{f.categoria}</option>}
                                    {categoriasDB.map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                )}
                              </div>
                              {!esServicio && (
                                <div>
                                  <label className={etiqueta}><span>Código de barras</span><span className="text-stone-400 font-normal">opcional</span></label>
                                  <input type="text" inputMode="numeric" value={f.cod_ean} onChange={(e) => setF('cod_ean', e.target.value)} className={inputBase} />
                                </div>
                              )}
                              <div>
                                <label className={etiqueta}><span>Código interno</span></label>
                                <input type="text" value={f.sku} onChange={(e) => setF('sku', e.target.value)} className={inputBase} />
                              </div>
                              <div>
                                <label className={etiqueta}><span>Foto</span><span className="text-stone-400 font-normal">también puedes tocar la foto de arriba</span></label>
                                {fotoDeshabilitada ? (
                                  <p className="text-xs text-stone-500">La subida de fotos está desactivada para tu negocio. Contacta a Kaserita si la necesitas.</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer py-2 px-3.5 rounded-xl border-[1.5px] border-stone-200 bg-white hover:bg-[#f4eefe] text-stone-700 text-xs font-semibold transition">
                                      {subiendoFotoProducto ? <i className="fa-solid fa-spinner fa-spin text-stone-500"></i> : <i className="fa-solid fa-camera text-stone-500"></i>}
                                      {f.foto_url ? 'Cambiar foto' : 'Subir foto'}
                                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (file) subirFotoProducto(file); }} />
                                    </label>
                                    {f.foto_url && (
                                      <button type="button" onClick={() => setF('foto_url', '')} className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl border-[1.5px] border-stone-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-stone-700 hover:text-rose-600 text-xs font-semibold transition">
                                        <i className="fa-solid fa-trash-can"></i> Quitar foto
                                      </button>
                                    )}
                                  </div>
                                )}
                                {!fotoDeshabilitada && <p className="text-[11px] text-stone-400 mt-1.5">O pega una imagen con Ctrl+V.</p>}
                              </div>
                            </>
                          )}

                          {pestana === 'precio' && (
                            <>
                              <div>
                                <h4 className="text-[17px] font-extrabold text-stone-900 tracking-tight">{esServicio ? 'Precio y duración' : 'Precio y stock'}</h4>
                                <p className="text-[12.5px] text-stone-500 mt-0.5">{esServicio ? 'La duración bloquea ese tiempo del barbero en la agenda.' : 'Cambia el precio, mira tu ganancia y ajusta cuánto tienes.'}</p>
                              </div>
                              <div>
                                <label className={etiqueta}><span>Precio de venta{esBarberia ? '' : ' por unidad'} <span className="text-rose-500">*</span></span></label>
                                <div className={`flex items-baseline gap-2.5 rounded-[20px] border-2 transition px-4 py-3 focus-within:ring-4 ${errores.precio ? 'border-rose-400 bg-rose-50 focus-within:ring-rose-200' : 'bg-stone-50/70 border-stone-200 focus-within:border-[#6105dc] focus-within:bg-white focus-within:ring-[#6105dc]/15'}`}>
                                  <span className="text-xl font-extrabold text-stone-300 select-none">S/</span>
                                  <input type="number" step="0.10" min="0" inputMode="decimal" value={f.precio_venta} onChange={(e) => setF('precio_venta', e.target.value)} className="w-full min-w-0 bg-transparent border-0 p-0 text-[34px] sm:text-[40px] leading-tight font-extrabold tracking-tight text-stone-900 placeholder:text-stone-300 focus:ring-0 focus:outline-none" />
                                  <span className="text-[11px] font-bold tracking-widest text-stone-300">PEN</span>
                                </div>
                                {pv > 0 && pv !== pvOriginal && pvOriginal > 0 && (
                                  <span className={`inline-flex items-center gap-1.5 mt-2 rounded-full px-2.5 py-1 text-xs font-bold ${pv > pvOriginal ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                    Antes S/ {pvOriginal.toFixed(2)} · {pv > pvOriginal ? '+' : '−'}S/ {Math.abs(pv - pvOriginal).toFixed(2)} ({pv > pvOriginal ? '+' : '−'}{Math.abs(((pv - pvOriginal) / pvOriginal) * 100).toFixed(0)}%)
                                  </span>
                                )}
                                {errores.precio && <p className="text-[11.5px] text-rose-600 mt-1.5">{errores.precio}</p>}
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                  <label className={etiqueta}><span>Costo{esServicio ? ' de insumos' : ''}</span><span className="text-stone-400 font-normal">opcional</span></label>
                                  <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-stone-300 pointer-events-none">S/</span>
                                    <input type="number" step="0.10" min="0" inputMode="decimal" value={f.precio_costo} onChange={(e) => setF('precio_costo', e.target.value)} className={`${inputBase} pl-9 ${errores.costo ? inputError : ''}`} />
                                  </div>
                                  {errores.costo && <p className="text-[11.5px] text-rose-600 mt-1.5">{errores.costo}</p>}
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
                                        <button key={m} type="button" onClick={() => setF('duracion_min', String(m))} className={chipClase(Number(f.duracion_min) === m)}>{m} min</button>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                      <input type="number" min="5" max="480" step="5" placeholder="Otra" value={f.duracion_min ?? ''} onChange={(e) => setF('duracion_min', e.target.value)} className="w-24 h-9 bg-stone-50/70 border border-stone-200 rounded-xl px-3 text-xs" />
                                      <span className="text-[11px] text-stone-500">minutos · vacío = 30</span>
                                    </div>
                                    {errores.duracion && <p className="text-[11.5px] text-rose-600 mt-1.5">{errores.duracion}</p>}
                                  </div>
                                ) : !esBarberia ? (
                                  <div>
                                    <label className={etiqueta}><span>Se vende por</span></label>
                                    <div className="grid grid-flow-col auto-cols-fr bg-[#f1eef9] rounded-[14px] p-1 gap-1">
                                      <button type="button" onClick={() => setF('unidad', 'UND')} className={segClase(f.unidad !== 'KG')}>Unidad</button>
                                      <button type="button" onClick={() => setFormEditarProducto((prev) => ({ ...prev, unidad: 'KG', vendeEnPack: false }))} className={segClase(f.unidad === 'KG')}>Peso (KG)<span className="block text-[11px] font-medium opacity-80">balanza</span></button>
                                    </div>
                                  </div>
                                ) : <div></div>}
                              </div>

                              {pc > 0 && (
                                <div className="rounded-2xl border border-dashed border-[#e4d6fb] bg-[#fcfaff] px-3.5 py-3">
                                  <p className="text-xs font-semibold text-stone-500 mb-2">Precio sugerido según tu margen</p>
                                  <div className="flex flex-wrap gap-2">
                                    {[20, 30, 40].map((m) => {
                                      const sugerido = Math.ceil((pc / (1 - m / 100)) * 10) / 10;
                                      return (
                                        <button key={m} type="button" onClick={() => setF('precio_venta', sugerido.toFixed(2))} className={chipClase(Math.abs(pv - sugerido) < 0.005)}>
                                          Ganar {m}% → S/ {sugerido.toFixed(2)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {!esServicio && (
                                <div>
                                  <label className={etiqueta}><span>Stock actual</span><span className="text-stone-400 font-normal">{esBarberia ? '' : 'para una compra, usa Entrada de Mercadería'}</span></label>
                                  <div className={`flex flex-wrap items-center gap-3.5 border-[1.5px] rounded-[18px] px-3.5 py-3 bg-stone-50/70 ${errores.stock ? 'border-rose-400' : 'border-stone-200'}`}>
                                    <div className="text-[30px] leading-none font-extrabold text-stone-900 min-w-[64px]">{f.stock_actual === '' ? '—' : f.stock_actual}<small className="text-[13px] font-bold text-stone-400 ml-1">{f.unidad === 'KG' ? 'kg' : 'und'}</small></div>
                                    <div className="flex items-center gap-2 ml-auto">
                                      <button type="button" aria-label="Menos" onClick={() => ajustarStock(f.unidad === 'KG' ? -0.5 : -1)} className="w-[42px] h-[42px] rounded-[13px] border-[1.5px] border-stone-200 bg-white grid place-items-center text-[#4d04b0] hover:bg-[#f4eefe]"><i className="fa-solid fa-minus text-xs"></i></button>
                                      <input type="number" min="0" step={f.unidad === 'KG' ? '0.1' : '1'} placeholder="—" value={f.stock_actual} onChange={(e) => setF('stock_actual', e.target.value)} className="w-24 h-[42px] text-center font-bold text-sm rounded-[13px] border-[1.5px] border-stone-200 bg-white outline-none focus:border-[#6105dc]" />
                                      <button type="button" aria-label="Más" onClick={() => ajustarStock(f.unidad === 'KG' ? 0.5 : 1)} className="w-[42px] h-[42px] rounded-[13px] border-[1.5px] border-stone-200 bg-white grid place-items-center text-[#4d04b0] hover:bg-[#f4eefe]"><i className="fa-solid fa-plus text-xs"></i></button>
                                    </div>
                                  </div>
                                  {errores.stock ? <p className="text-[11.5px] text-rose-600 mt-1.5">{errores.stock}</p> : <p className="text-[11px] text-stone-400 mt-1.5">Déjalo vacío si no llevas el control de stock de este producto.</p>}
                                </div>
                              )}

                              {mostrarPack && (
                                <div>
                                  {interruptor2({ activo: !!f.vendeEnPack, onClick: () => setF('vendeEnPack', !f.vendeEnPack), icono: "fa-box", titulo: "También lo vendo en pack o caja cerrada", detalle: "Ej: six-pack o caja x12 con precio especial" })}
                                  {f.vendeEnPack && (
                                    <div className="mt-2.5 p-3.5 bg-white border border-stone-200 rounded-2xl space-y-3">
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                          <label className="text-[11px] font-semibold text-stone-500 block mb-1">¿De cuántas unidades es el pack?</label>
                                          <input type="number" step="1" min="2" placeholder="Ej: 6" value={f.unidades_por_pack} onChange={(e) => setF('unidades_por_pack', e.target.value)} className={inputBase} />
                                        </div>
                                        <div>
                                          <label className="text-[11px] font-semibold text-stone-500 block mb-1">Precio del pack completo (S/)</label>
                                          <input type="number" step="0.10" placeholder="Ej: 27.00" value={f.precio_venta_pack} onChange={(e) => setF('precio_venta_pack', e.target.value)} className={inputBase} />
                                        </div>
                                      </div>
                                      {Number(f.unidades_por_pack) > 1 && Number(f.precio_venta_pack) > 0 && (
                                        <p className="text-[11.5px] text-stone-500">= S/ {(Number(f.precio_venta_pack) / Number(f.unidades_por_pack)).toFixed(2)} por unidad dentro del pack (vs. S/ {pv.toFixed(2)} por unidad suelta)</p>
                                      )}
                                      <div>
                                        <label className="text-[11px] font-semibold text-stone-500 block mb-1">Código de barras del pack (opcional, si es distinto al de la unidad)</label>
                                        <div className="relative">
                                          <input type="text" placeholder="Si ya existe, se vincula solo" value={f.cod_ean_pack} onChange={(e) => setF('cod_ean_pack', e.target.value)} className={`${inputBase} pr-10`} />
                                          <button type="button" onClick={() => { setModoEscaner('editar-pack-ean'); setMetodoForzado(null); setModalEscaner(true); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-stone-600 hover:text-[#6105dc] transition" title="Escanear código de barras del pack">
                                            <i className="fa-solid fa-camera text-xs"></i>
                                          </button>
                                        </div>
                                      </div>
                                      {errores.pack && <p className="text-[11.5px] text-rose-600">{errores.pack}</p>}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          {pestana === 'tienda' && (
                            <>
                              <div>
                                <h4 className="text-[17px] font-extrabold text-stone-900 tracking-tight">En tu tienda en línea</h4>
                                <p className="text-[12.5px] text-stone-500 mt-0.5">Cómo se muestra este producto a tus clientes en Kaserita Delivery.</p>
                              </div>
                              <div className="space-y-2.5">
                                {interruptor2({ activo: !!f.es_destacado, onClick: () => setF('es_destacado', !f.es_destacado), icono: "fa-star", titulo: "Destacar en Kaserita Delivery", detalle: "Aparece en el carrusel de destacados de tu tienda en línea. Puedes marcar varios productos." })}
                                {esBarberia && interruptor2({ activo: f.visible_en_tienda !== false, onClick: () => setF('visible_en_tienda', f.visible_en_tienda === false), aviso: f.visible_en_tienda === false, icono: "fa-eye", titulo: "Mostrar en la tienda en línea", detalle: f.visible_en_tienda === false ? 'Oculto: lo puedes vender en caja y usarlo en combos, pero no aparece en la tienda.' : 'Los clientes lo ven y lo pueden pedir.' })}
                              </div>
                              {!fotoDeshabilitada && (
                                <>
                                  <div>
                                    <label className={etiqueta}><span>Descripción para la tienda en línea</span><span className="text-stone-400 font-normal">{(f.descripcion_larga || '').length} caracteres</span></label>
                                    <textarea
                                      value={f.descripcion_larga}
                                      onChange={(e) => setF('descripcion_larga', e.target.value)}
                                      rows={3}
                                      placeholder={esBarberia ? 'Ej: degradado con máquina, perfilado y toalla caliente' : 'Ej: tela, talla, colores disponibles, sabor...'}
                                      className="w-full bg-stone-50/70 border-[1.5px] border-stone-200 rounded-[14px] px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#6105dc] focus:bg-white focus:ring-4 focus:ring-[#6105dc]/15 transition"
                                    />
                                  </div>
                                  <div>
                                    <label className={etiqueta}><span>Fotos adicionales</span><span className="text-stone-400 font-normal">{fotosExtra.length} de 4</span></label>
                                    <div className="grid grid-cols-4 gap-2.5">
                                      {fotosExtra.map((url, i) => (
                                        <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-stone-200">
                                          <img src={url} className="w-full h-full object-cover" alt="" />
                                          <button type="button" aria-label="Quitar foto" onClick={() => quitarFotoExtra(i)} className="absolute top-1.5 right-1.5 w-[22px] h-[22px] rounded-full bg-black/65 text-white grid place-items-center text-[10px]"><i className="fa-solid fa-xmark"></i></button>
                                        </div>
                                      ))}
                                      {fotosExtra.length < 4 && (
                                        <label className="aspect-square rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/70 grid place-items-center cursor-pointer text-stone-400 hover:border-[#6105dc] hover:text-[#6105dc] hover:bg-[#f4eefe] transition">
                                          {subiendoFotoExtra ? <span className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin"></span> : <i className="fa-solid fa-plus text-lg"></i>}
                                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (file) subirFotoExtraProducto(file); }} />
                                        </label>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-stone-400 mt-1.5">Se ven al abrir el producto en la tienda.</p>
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Vista previa y cambios sin guardar */}
                      <aside className="md:sticky md:top-0 md:self-start min-w-0">
                        <p className="hidden md:block text-[11px] font-bold tracking-wider uppercase text-stone-400 mb-2">Así se ve en tu caja</p>
                        <div className="hidden md:block bg-white border border-stone-100 rounded-[22px] p-3 shadow-sm">
                          <div className="aspect-[1/0.72] rounded-2xl bg-gradient-to-br from-[#f4eefe] to-white overflow-hidden relative">
                            <FotoProducto fotoUrl={f.foto_url} categoria={f.categoria} className="w-full h-full" iconClassName="text-5xl" />
                            {f.vendeEnPack && !esBarberia && Number(f.unidades_por_pack) > 1 && <span className="absolute top-2 left-2 bg-[#ffc81a] text-stone-900 text-[10.5px] font-extrabold rounded-full px-2 py-0.5">Pack x{f.unidades_por_pack}</span>}
                            {f.es_destacado && <span className="absolute top-2 right-2 w-[26px] h-[26px] rounded-full bg-white grid place-items-center text-[#d99a00] shadow text-xs"><i className="fa-solid fa-star"></i></span>}
                          </div>
                          <span className="inline-block mt-2.5 text-[10.5px] font-bold text-[#4d04b0] bg-[#f4eefe] rounded-full px-2 py-0.5">{f.categoria || 'Sin categoría'}</span>
                          <p className="text-sm font-bold leading-tight mt-1.5 min-h-[2.2rem] text-stone-900">{f.descripcion.trim() || 'Sin nombre'}</p>
                          <div className="flex items-baseline justify-between mt-1.5">
                            <span>{pvOriginal !== pv && <s className="text-xs font-semibold text-stone-300 mr-1.5">S/ {pvOriginal.toFixed(2)}</s>}<strong className="text-[22px] font-extrabold text-stone-900">S/ {pv.toFixed(2)}</strong></span>
                            <small className="text-[11px] text-stone-400">{esBarberia ? (esServicio ? `${Number(f.duracion_min) || 30} min` : 'unidad') : (f.unidad === 'KG' ? 'por kg' : 'por unidad')}</small>
                          </div>
                          <div className={`grid place-items-center mt-2.5 h-9 rounded-xl text-white text-[12.5px] font-bold ${!esServicio && f.stock_actual !== '' && Number(f.stock_actual) <= 0 ? 'bg-stone-300' : 'bg-[#6105dc] opacity-90'}`}>{!esServicio && f.stock_actual !== '' && Number(f.stock_actual) <= 0 ? 'Sin stock' : 'Agregar'}</div>
                        </div>
                        <details className="mt-3.5 bg-white border border-stone-100 rounded-[18px] overflow-hidden group" open={tieneCambios}>
                          <summary className="list-none cursor-pointer flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-bold text-stone-800">
                            Cambios sin guardar
                            <span className="bg-[#6105dc] text-white rounded-full text-[11px] px-2 py-px">{cambios.length}</span>
                            <i className="fa-solid fa-chevron-down text-stone-400 text-xs ml-auto transition group-open:rotate-180"></i>
                          </summary>
                          {cambios.length === 0 ? (
                            <p className="px-3.5 pb-3 text-xs text-stone-500">Todavía no cambias nada.</p>
                          ) : (
                            <ul className="px-2.5 pb-2.5 grid gap-1.5">
                              {cambios.map((c) => (
                                <li key={c.etiqueta} className="flex items-center gap-2 bg-[#faf8ff] rounded-xl pl-2.5 pr-1.5 py-1.5 text-xs">
                                  <span className="text-stone-500 font-semibold whitespace-nowrap">{c.etiqueta}</span>
                                  <span className="flex-1 min-w-0 truncate font-bold text-stone-800"><i className="not-italic text-stone-300 font-semibold line-through mr-1">{c.antes}</i>{c.despues}</span>
                                  <button type="button" onClick={() => deshacer(c)} title="Deshacer este cambio" className="text-[#6105dc] hover:bg-[#f4eefe] rounded-lg px-1.5 py-1"><i className="fa-solid fa-rotate-left text-[11px]"></i></button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </details>
                      </aside>
                    </div>

                    {/* Pie */}
                    <div className="shrink-0 bg-white border-t border-stone-200 px-4 sm:px-5 py-3 flex items-center gap-2 sm:gap-2.5 shadow-[0_-4px_18px_rgba(15,23,42,0.06)]">
                      <button type="button" onClick={desactivarProducto} title="Quitar de mis productos" className="h-11 px-3.5 rounded-[14px] text-sm font-bold text-rose-600 hover:bg-rose-50 transition flex items-center gap-2">
                        <i className="fa-solid fa-trash-can text-xs"></i><span className="hidden sm:inline">Quitar de mis productos</span>
                      </button>
                      <span className="flex-1"></span>
                      <span className={`hidden sm:flex items-center gap-1.5 text-xs ${hayErrores ? 'text-rose-600' : tieneCambios ? 'text-[#4d04b0] font-semibold' : 'text-stone-500'}`}>
                        {hayErrores ? <><i className="fa-solid fa-triangle-exclamation"></i>{Object.values(errores)[0]}</> : tieneCambios ? `${cambios.length} cambio${cambios.length > 1 ? 's' : ''} sin guardar` : 'Sin cambios'}
                      </span>
                      {tieneCambios && <button type="button" onClick={descartar} disabled={guardandoEdicionProducto} className="h-11 px-3.5 rounded-[14px] text-sm font-bold text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition">Descartar</button>}
                      <button type="button" onClick={guardarEdicionProducto} disabled={guardandoEdicionProducto || !tieneCambios || hayErrores} className="h-11 px-5 rounded-[14px] bg-[#6105dc] hover:bg-[#4d04b0] disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md flex items-center gap-2 transition">
                        {guardandoEdicionProducto ? (<><i className="fa-solid fa-spinner fa-spin"></i> Guardando...</>) : (<><i className="fa-solid fa-check"></i> Guardar cambios</>)}
                      </button>
                    </div>
                  </div>
                </div>
                );
              })()}
    </>
  );
}
