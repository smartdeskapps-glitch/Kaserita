// Columna central: encabezado, buscador, filtros y grilla del catálogo de productos y combos.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';
import CombosCatalogo, { comboCoincide } from '../CombosCatalogo.jsx';
import { ProductoCard } from '../pos/componentes.jsx';

export default function Catalogo({
  abrirCierreCaja, abrirEdicionProducto, abrirEscanerParaVenta, abrirModalCombos,
  abrirPedidosRetirar, agregarComboAlCarrito, bodegaNombre, busqueda, busquedaCategoria,
  cajeroSeleccionado, cambiarCantidadCarrito, cantidadEnCarritoPorCombo,
  cantidadEnCarritoPorProducto, cargandoProductos, cargarProductos, categoriaFiltro,
  categorias, centinelaGridRef, claseSegmento, combosActivos, combosDisponibles,
  conteoPorCategoria, esAdmin, estadoCombos, handleClicProducto, handleKeyDownBusqueda,
  hayMasEnGrid, inputBusquedaRef, limiteGrid, menuCategoriasAbierto, notificar,
  pedidosListosSinCargar, pedidosPorRetirarPendientes, productos, productosEnCombo,
  productosFiltrados, setBusqueda, setBusquedaCategoria, setBusquedaMenu, setCategoriaFiltro,
  setIndiceMenu, setMenuCategoriasAbierto, setMenuMas, setModalInventarioInicial,
  setModalTurno, turnoActivo, usuarioActivo, verCombosDesdeTarjeta
}) {
  return (
    <>
      {/* Columna Central: Catálogo (Order Line) */}
      <div className="flex-1 flex flex-col overflow-hidden md:ml-[36px]">
        <header className="flex items-center justify-between mx-3 mt-3 px-2 md:px-3 py-2 gap-3">
          <div className="flex items-center gap-3 min-w-0 max-w-full pl-1">
            <img src="/logo-horizontal-color.svg" width="2068" height="642" alt="Kaserita" className="h-7 md:h-8 w-auto shrink-0" />
            <span className="w-px h-[30px] bg-[#5b4bd6]/20 shrink-0"></span>
            <div className="min-w-0">
              <h1 className="text-sm md:text-[15px] font-bold text-[#2d284b] leading-tight tracking-tight truncate">{bodegaNombre}</h1>
              <p className="text-xs text-[#6b6890] truncate leading-tight mt-px">
                {cajeroSeleccionado?.nombre || usuarioActivo?.nombre}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {turnoActivo ? (
              <button
                onClick={abrirCierreCaja}
                className="btn-noise btn-noise-verde hidden sm:inline-flex text-xs font-medium text-green-700"
              >
                <span className="btn-noise-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Turno Abierto
                </span>
              </button>
            ) : (
              <button
                onClick={() => setModalTurno(true)}
                className="btn-noise hidden sm:inline-flex text-xs font-medium text-[#2d284b]"
              >
                <span className="btn-noise-in">
                  Abrir Turno
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="btn-noise-flecha w-3.5 h-3.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </span>
              </button>
            )}
            {/* Celular: el botón "Turno Abierto / Abrir Turno" no cabe, así que queda un ícono de caja con un punto de estado */}
            <button
              onClick={turnoActivo ? abrirCierreCaja : () => setModalTurno(true)}
              className="sm:hidden relative w-10 h-10 flex items-center justify-center bg-white border border-stone-200 rounded-xl text-stone-700 shadow-sm transition"
              aria-label={turnoActivo ? 'Turno abierto. Toca para cerrar la caja' : 'Turno cerrado. Toca para abrir turno'}
            >
              <i className="fa-solid fa-cash-register text-[15px]"></i>
              <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${turnoActivo ? 'bg-green-500' : 'bg-amber-400'}`}></span>
            </button>
            <button
              onClick={() => { setBusquedaMenu(''); setIndiceMenu(0); setMenuMas(true); }}
              className="md:hidden w-10 h-10 flex items-center justify-center bg-white border border-stone-200 rounded-xl text-stone-700 hover:text-stone-900 shadow-sm transition"
              title="Más opciones"
            >
              <i className="fa-solid fa-bars"></i>
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden p-3 md:p-4">
          {/* Panel blanco del catálogo: barra única (categoría + buscador + combos + pedidos) y grilla. */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl p-3 md:p-4 gap-3 relative z-10">
            {/* Barra: selector Productos | Combos, categoría, buscador con contador y cámara, y "Por retirar". */}
            <div className="flex flex-wrap xl:flex-nowrap items-center gap-2.5 shrink-0">
              <div className="w-full md:w-auto shrink-0 inline-flex items-center gap-0.5 p-1 h-[42px] md:h-[46px] rounded-full bg-[#ebf0ff]">
                <div className="relative h-full flex-1 md:flex-none">
                  <button
                    onClick={() => {
                      if (categoriaFiltro === '__COMBOS__') { setCategoriaFiltro('TODOS'); return; }
                      setBusquedaCategoria(''); setMenuCategoriasAbierto((v) => !v);
                    }}
                    aria-pressed={categoriaFiltro !== '__COMBOS__'}
                    aria-haspopup="listbox"
                    title="Productos: elegir categoría"
                    className={claseSegmento(categoriaFiltro !== '__COMBOS__')}
                  >
                    <i className="fa-solid fa-table-cells-large text-[12px]"></i>
                    {categoriaFiltro === '__COMBOS__' ? (
                      <span>Productos</span>
                    ) : (
                      <>
                        <span className="max-w-[140px] truncate text-[13px] font-bold text-[#2d284b]">{categoriaFiltro === 'TODOS' ? 'Todos' : categoriaFiltro}</span>
                        <i className={`fa-solid fa-chevron-down text-[9px] transition-transform ${menuCategoriasAbierto ? 'rotate-180' : ''}`}></i>
                      </>
                    )}
                  </button>
                  {menuCategoriasAbierto && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setMenuCategoriasAbierto(false)}></div>
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white/80 backdrop-blur-2xl border border-white/90 rounded-3xl shadow-[0_24px_60px_-24px_rgba(60,20,120,0.28)] ring-1 ring-[#5b4bd6]/5 p-2 z-30">
                        <div className="relative mb-2">
                          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] text-stone-400"></i>
                          <input
                            type="text"
                            value={busquedaCategoria}
                            onChange={(e) => setBusquedaCategoria(e.target.value)}
                            placeholder="Buscar categoría"
                            className="w-full bg-white rounded-full pl-9 pr-3 py-2 text-[13px] text-stone-900 placeholder-stone-400 ring-1 ring-[#5b4bd6]/10 focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
                          />
                        </div>
                        <div
                          className="max-h-[340px] overflow-y-auto hide-scrollbar pb-5"
                          style={{ WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)', maskImage: 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)' }}
                        >
                          {(() => {
                            const q = busquedaCategoria.trim().toLowerCase();
                            const lista = q ? categorias.filter(cat => cat !== 'TODOS' && String(cat).toLowerCase().includes(q)) : categorias;
                            if (lista.length === 0) {
                              return <p className="text-xs text-stone-400 text-center py-4">Sin resultados</p>;
                            }
                            return lista.map(cat => {
                              const cantidad = cat === 'TODOS' ? productos.length : (conteoPorCategoria.get(cat) || 0);
                              const activo = categoriaFiltro === cat;
                              return (
                                <React.Fragment key={cat}>
                                  <button
                                    onClick={() => { setCategoriaFiltro(cat); setMenuCategoriasAbierto(false); }}
                                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-full text-left text-sm transition ${activo ? 'bg-[#dde4fa] text-[#2d284b] font-bold' : 'text-stone-800 font-medium hover:bg-[#5b4bd6]/5'}`}
                                  >
                                    <span className="truncate">{cat === 'TODOS' ? 'Todos' : cat}</span>
                                    <span className={`text-xs shrink-0 tabular-nums ${activo ? 'bg-white text-[#5b4bd6] font-semibold px-2 py-0.5 rounded-full' : 'text-stone-400'}`}>{cantidad}</span>
                                  </button>
                                  {cat === 'TODOS' && !q && <div className="h-px bg-[#5b4bd6]/10 mx-3.5 my-1.5"></div>}
                                </React.Fragment>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {combosActivos.length > 0 && (
                  <div className="flex-1 md:flex-none h-full">
                  <button
                    onClick={() => setCategoriaFiltro('__COMBOS__')}
                    aria-pressed={categoriaFiltro === '__COMBOS__'}
                    title="Combos"
                    className={claseSegmento(categoriaFiltro === '__COMBOS__')}
                  >
                    <i className="fa-solid fa-gift text-[12px]"></i>
                    <span>Combos</span>
                    <span className="tabular-nums">{combosDisponibles}</span>
                  </button>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 md:min-w-[290px] flex items-center h-[42px] md:h-[46px] pl-4 pr-1 bg-white border border-[#dde4fa] rounded-full transition focus-within:border-[#5b4bd6] focus-within:ring-4 focus-within:ring-[#5b4bd6]/10 group/bus">
                <i className="fa-solid fa-magnifying-glass text-[13px] text-[#8f8cb0] group-focus-within/bus:text-[#5b4bd6] transition shrink-0 mr-2"></i>
                  <input
                    ref={inputBusquedaRef}
                    type="text"
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value);
                      // En la pestaña Combos se filtran los combos (por nombre o por sus productos);
                      // si ninguno coincide (p. ej. al escanear un código) se pasa a Todos.
                      if (e.target.value && categoriaFiltro === '__COMBOS__' && !combosActivos.some((c) => comboCoincide(c, e.target.value))) {
                        setCategoriaFiltro('TODOS');
                      }
                    }}
                    onKeyDown={handleKeyDownBusqueda}
                    placeholder="Busca o escanea un código"
                    className="flex-1 min-w-0 text-ellipsis bg-transparent text-[13px] md:text-[14px] font-medium text-stone-900 placeholder:text-[#8f8cb0] placeholder:font-normal focus:outline-none"
                  />
                  {busqueda && (
                    <>
                      <span className={`${categoriaFiltro === '__COMBOS__' ? 'hidden' : 'hidden sm:inline-flex'} shrink-0 text-xs font-bold text-[#2d284b] bg-[#edf0fa] rounded-full px-2.5 py-1.5 tabular-nums`}>
                        {productosFiltrados.length} {productosFiltrados.length === 1 ? 'resultado' : 'resultados'}
                      </span>
                      <button aria-label="Limpiar búsqueda"
                        onClick={() => {
                          setBusqueda('');
                          cargarProductos('');
                          inputBusquedaRef.current?.blur();
                        }}
                        className="shrink-0 w-[26px] h-[26px] flex items-center justify-center bg-[#f2f3f7] hover:bg-[#e5e9f6] text-[#6b6890] rounded-full transition"
                      ><i className="fa-solid fa-xmark text-xs"></i></button>
                    </>
                  )}
                  {!busqueda && (
                    <span className="shrink-0 pr-2.5 text-[12px] font-bold text-[#8f8cb0] tabular-nums" title={categoriaFiltro === '__COMBOS__' ? 'Combos' : 'Productos'}>
                      {categoriaFiltro === '__COMBOS__' ? combosActivos.length : productosFiltrados.length}
                    </span>
                  )}
                  <button
                    onClick={abrirEscanerParaVenta}
                    title="Escanear código de barras con la cámara"
                    aria-label="Escanear código de barras con la cámara"
                    className="shrink-0 flex items-center justify-center w-[34px] h-[34px] md:w-[38px] md:h-[38px] rounded-full text-white bg-gradient-to-br from-[#9687f5] to-[#5b4bd6] hover:brightness-105 active:scale-95 transition"
                  >
                    <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
                  </button>
              </div>
                <button
                  onClick={abrirPedidosRetirar}
                  title="Pedidos por retirar (clientes con cuenta)"
                  aria-label="Pedidos por retirar"
                  className="relative flex items-center justify-center h-[42px] md:h-[46px] w-[42px] md:w-[46px] shrink-0 bg-white hover:bg-[#ebf0ff] text-[#5f5d76] rounded-full border border-[#dde4fa] transition"
                >
                  <i className="fa-solid fa-bag-shopping text-[16px]"></i>
                  {pedidosPorRetirarPendientes > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 flex items-center justify-center bg-rose-600 text-white text-[10px] font-bold rounded-full border-2 border-white animate-pulse">
                      {pedidosPorRetirarPendientes > 9 ? '9+' : pedidosPorRetirarPendientes}
                    </span>
                  ) : pedidosListosSinCargar > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 flex items-center justify-center bg-emerald-600 text-white text-[10px] font-bold rounded-full border-2 border-white">
                      {pedidosListosSinCargar > 9 ? '9+' : pedidosListosSinCargar}
                    </span>
                  )}
                </button>
            </div>

          {/* Grilla de Productos */}
          {/* pb-24 en mobile: dejar espacio para que la última fila no
              quede tapada por la barra flotante del carrito (fixed
              bottom-3) ni pegada contra el borde de la pantalla. */}
          {/* pt-1.5 pl-1: margen para que el hover (sube 2px + sombra + anillo)
              no se corte contra el borde del contenedor con scroll. */}
          <div className="flex-1 overflow-y-auto pt-1.5 pl-1 pr-1 pb-24 md:pb-6 hide-scrollbar">
            {categoriaFiltro === '__COMBOS__' ? (
              <CombosCatalogo
                combos={combosActivos}
                estadoCombos={estadoCombos}
                enCarrito={cantidadEnCarritoPorCombo}
                busqueda={busqueda}
                esAdmin={esAdmin}
                onAgregar={(combo) => {
                  const est = estadoCombos.get(combo.id) || { unidades: Infinity };
                  if ((cantidadEnCarritoPorCombo.get(combo.id) || 0) + 1 > est.unidades) {
                    notificar(`No hay stock para más de ${est.unidades} de este combo.`, 'error');
                    return;
                  }
                  agregarComboAlCarrito(combo);
                }}
                onQuitar={(combo) => cambiarCantidadCarrito(`combo::${combo.id}`, -1)}
                onCrear={abrirModalCombos}
              />
            ) : cargandoProductos && productos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-stone-600 gap-2">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs">Cargando productos...</p>
              </div>
            ) : productos.length === 0 && !busqueda.trim() ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-3">
                  <i className="fa-solid fa-boxes-stacked text-2xl text-amber-600"></i>
                </div>
                <p className="text-base font-bold text-stone-900">Aún no tienes productos registrados</p>
                <p className="text-xs text-stone-500 mt-1 max-w-xs">
                  Antes de vender, registra el inventario de tu negocio: qué productos tienes, sus precios y si se venden por unidad o por peso.
                </p>
                <button
                  onClick={() => setModalInventarioInicial(true)}
                  className="mt-4 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-bold rounded-xl shadow-lg shadow-stone-900/25 flex items-center gap-2"
                >
                  <i className="fa-solid fa-boxes-stacked"></i> Registrar Productos
                </button>
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-stone-500 text-center">
                <p className="text-base font-semibold">No se encontraron productos</p>
                <p className="text-xs text-stone-400 mt-1">Prueba con otra búsqueda o categoría.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {(hayMasEnGrid ? productosFiltrados.slice(0, limiteGrid) : productosFiltrados).map((prod) => (
                  <ProductoCard
                    key={prod.id}
                    prod={prod}
                    esAdmin={esAdmin}
                    enCarrito={cantidadEnCarritoPorProducto.get(prod.id) || 0}
                    onSelect={handleClicProducto}
                    onEdit={abrirEdicionProducto}
                    tieneCombo={productosEnCombo.has(prod.id)}
                    onVerCombo={verCombosDesdeTarjeta}
                  />
                ))}
                {hayMasEnGrid && <div ref={centinelaGridRef} className="col-span-full h-10" aria-hidden="true"></div>}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
