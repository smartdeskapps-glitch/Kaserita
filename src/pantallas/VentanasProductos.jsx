// Ventanas de productos e inventario: cantidad/balanza, escáner, registrar productos, combos, merma, toma de inventario, editar producto y entrada de mercadería.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React, { Suspense } from 'react';
import { EscanerCamara, InventarioInicial, InventarioValorizado, CombosModal, MermaModal, TomaInventario, EditarProducto, EntradaMercaderia } from '../pos/perezosos.js';
import { IconoTrazo, PestanasModal } from '../pos/componentes.jsx';
import { formatoSoles } from '../pos/utilidades.js';

export default function VentanasProductos({
  abrirEscanerParaFilaInventario, abrirEscanerParaMerma, abrirHistorialInventario,
  abrirProductoNuevoEntrada, actualizarCantidadItemCombo, actualizarCodigoEanFila,
  actualizarCodigoEanPackFila, actualizarFilaInventario, actualizarPendienteConteo,
  actualizarStockContado, agregarCategoriaPersonalizada, agregarHallazgo,
  agregarItemEntradaMercaderia, agregarProductoAConteo, agregarProductoAFormCombo,
  alternarActivoCombo, aplicarDescuentoRapidoCombo, aplicarPrecioCombo,
  buscarProductoPorCodigo, busquedaCombos, busquedaCompra, busquedaMerma,
  busquedaProductoCombo, camarasDisponibles, cambiarCamara, cambiarCantidadCarrito,
  cambiarTipoEntrada, cargandoCombos, carrito, categoriasDB, cerrarEditorCombo,
  cerrarModalCombos, cerrarModalEntradaMercaderia, cerrarModalMerma, combos, compraCabecera,
  compraItemTemp, compraItems, confirmarCantidadBalanza, conteoFisicoBusqueda,
  continuarARevisionInventario, costoNormalCombo, crearProductoInlineCompra,
  desactivarProducto, destelloEscaner, desvincularFilaInventario, duplicarCombo,
  editandoPackParaId, editarCombo, editarLineaEntrada, elegirProductoEntrada,
  elegirProductoMerma, eliminarCombo, eliminarFilaInventario, entradaRegistrada, errorEscaner,
  esBarberia, estadoCombos, filaInventarioExpandidaIdx, filaInventarioVacia, filasInventario,
  filasTomaInventario, filasTomaInventarioVisibles, filtroCombos, filtroCompra, formCombo,
  formComboOriginal, formEditarOriginal, formEditarProducto, formMerma, guardandoCombo,
  guardandoEdicionProducto, guardandoEntrada, guardandoInventario, guardandoMerma,
  guardandoProductoInlineCompra, guardandoTomaInventario, guardarCombo, guardarEdicionProducto,
  guardarEntradaMercaderia, guardarInventarioInicial, guardarTomaInventario,
  historialConteoAbierto, idsNuevosCompra, inputBusquedaRef, inputCantidad, listaEscaneada,
  modalCantidad, modalCombos, modalEditarProducto, modalEntradaMercaderia, modalEscaner,
  modalInventarioInicial, modalInventarioValorizado, modalMerma, setModalInventarioValorizado, modalTomaInventario, modoEscaner, notificar, nuevoCombo,
  nuevoProductoInlineCompra, pasoInventario, pasoTomaInventario, pedirCerrarEntrada,
  pedirConfirmacion, precioNormalCombo, productoEscaneadoId, productoSeleccionadoCantidad,
  productos, promoverAActivoConteo, proveedoresLista, quitarFotoExtra, quitarHallazgo,
  quitarItemCombo, quitarItemEntradaMercaderia, quitarProductoDeConteo, refsPendientesConteo,
  registrarMermaProducto, resaltadoCompra, resaltadoProductoCombo, resultadosBusquedaConteo,
  sesion, setBusquedaCombos, setBusquedaCompra, setBusquedaMerma, setBusquedaProductoCombo,
  setCompraCabecera, setCompraItemTemp, setConteoFisicoBusqueda, setEditandoPackParaId,
  setEntradaRegistrada, setFilaInventarioExpandidaIdx, setFilasInventario, setFiltroCombos,
  setFiltroCompra, setFormCombo, setFormEditarProducto, setFormMerma,
  setHistorialConteoAbierto, setInputCantidad, setMetodoForzado, setModalCantidad,
  setModalEditarProducto, setModalEscaner, setModalInventarioInicial, setModalTomaInventario,
  setModoEscaner, setMostrarResumenMobile, setNuevoProductoInlineCompra, setPasoInventario,
  setPasoTomaInventario, setResaltadoCompra, setResaltadoProductoCombo, setTabEditarProducto,
  setTipoVentaSeleccionado, setTomaInventarioBusqueda, setTomaInventarioCategoria,
  snapshotCombo, subiendoFotoExtra, subiendoFotoFilaIdx, subiendoFotoProducto,
  subirFotoExtraProducto, subirFotoFilaInventario, subirFotoProducto,
  sugerenciasMaestroParaFila, sugerenciasParaFila, sugerenciasParaFilaPack, tabEditarProducto,
  tipoVentaSeleccionado, tomaInventarioBusqueda, tomaInventarioCategoria, totalConDescuento,
  usarSugerenciaMaestraEnFila, vaciarConteoInventario, videoNativoRef,
  vincularProductoExistenteEnFila
}) {
  return (
    <>
      {/* Modal: Cantidad / Balanza para Peso KG */}
      {modalCantidad && productoSeleccionadoCantidad && (
        <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[26px] max-w-xs w-full p-5 shadow-2xl space-y-4 text-center">
            <h3 className="text-[17px] font-bold text-[#2d284b] leading-tight tracking-tight">{productoSeleccionadoCantidad.descripcion}</h3>

            {productoSeleccionadoCantidad.unidad === 'KG' ? (
              <>
                <p className="text-[13px] text-[#8f8cb0]">Ingresa la cantidad o peso en KG</p>
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="number"
                    step="0.005"
                    min="0.001"
                    value={inputCantidad}
                    onChange={(e) => setInputCantidad(e.target.value)}
                    className="w-36 h-14 bg-[#f3f5ff] text-center font-bold text-3xl tabular-nums text-[#2d284b] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
                    autoFocus
                  />
                  <span className="text-sm font-bold text-[#8f8cb0]">KG</span>
                </div>
              </>
            ) : (
              <>
                {Number(productoSeleccionadoCantidad.unidades_por_pack) > 1 && (
                  <div className="flex bg-[#f3f5ff] p-1 rounded-full">
                    <button
                      type="button"
                      onClick={() => setTipoVentaSeleccionado('UNIDAD')}
                      aria-pressed={tipoVentaSeleccionado === 'UNIDAD'}
                      className={`flex-1 py-2.5 text-[12.5px] font-bold rounded-full transition ${tipoVentaSeleccionado === 'UNIDAD' ? 'bg-white text-[#473bb5] shadow-[0_1px_0_#dde4fa,0_6px_14px_-8px_rgba(45,40,75,0.35)]' : 'text-[#8f8cb0]'}`}
                    >
                      Suelto · S/ {Number(productoSeleccionadoCantidad.precio_venta).toFixed(2)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoVentaSeleccionado('PACK')}
                      aria-pressed={tipoVentaSeleccionado === 'PACK'}
                      className={`flex-1 py-2.5 text-[12.5px] font-bold rounded-full transition ${tipoVentaSeleccionado === 'PACK' ? 'bg-white text-[#473bb5] shadow-[0_1px_0_#dde4fa,0_6px_14px_-8px_rgba(45,40,75,0.35)]' : 'text-[#8f8cb0]'}`}
                    >
                      Pack x{productoSeleccionadoCantidad.unidades_por_pack} · S/ {(Number(productoSeleccionadoCantidad.precio_venta_pack) || Number(productoSeleccionadoCantidad.precio_venta) * Number(productoSeleccionadoCantidad.unidades_por_pack)).toFixed(2)}
                    </button>
                  </div>
                )}
                <p className="text-[13px] text-[#8f8cb0]">
                  {tipoVentaSeleccionado === 'PACK' ? `¿Cuántos packs de ${productoSeleccionadoCantidad.unidades_por_pack}?` : '¿Cuántas unidades sueltas?'}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={inputCantidad}
                    onChange={(e) => setInputCantidad(e.target.value)}
                    className="w-36 h-14 bg-[#f3f5ff] text-center font-bold text-3xl tabular-nums text-[#2d284b] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
                    autoFocus
                  />
                  <span className="text-sm font-bold text-[#8f8cb0]">{tipoVentaSeleccionado === 'PACK' ? 'pack(s)' : 'und'}</span>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setModalCantidad(false)} className="flex-1 h-12 bg-[#f3f5ff] hover:bg-[#dde4fa] text-[#473bb5] rounded-full text-sm font-bold transition">Cancelar</button>
              <button onClick={confirmarCantidadBalanza} className="flex-1 h-12 bg-[#5b4bd6] hover:bg-[#473bb5] text-white rounded-full text-sm font-bold shadow-[0_8px_18px_-8px_rgba(91,75,214,0.6)] transition">Aceptar</button>
            </div>
          </div>
        </div>
      )}

      {modalEscaner && (
        <Suspense fallback={null}>
          <EscanerCamara
            IconoTrazo={IconoTrazo}
            actualizarPendienteConteo={actualizarPendienteConteo}
            agregarHallazgo={agregarHallazgo}
            camarasDisponibles={camarasDisponibles}
            cambiarCamara={cambiarCamara}
            cambiarCantidadCarrito={cambiarCantidadCarrito}
            carrito={carrito}
            destelloEscaner={destelloEscaner}
            editandoPackParaId={editandoPackParaId}
            errorEscaner={errorEscaner}
            filasTomaInventario={filasTomaInventario}
            formatoSoles={formatoSoles}
            inputBusquedaRef={inputBusquedaRef}
            listaEscaneada={listaEscaneada}
            modalEscaner={modalEscaner}
            modoEscaner={modoEscaner}
            productoEscaneadoId={productoEscaneadoId}
            productos={productos}
            quitarHallazgo={quitarHallazgo}
            setEditandoPackParaId={setEditandoPackParaId}
            setModalEscaner={setModalEscaner}
            setMostrarResumenMobile={setMostrarResumenMobile}
            totalConDescuento={totalConDescuento}
            videoNativoRef={videoNativoRef}
          />
        </Suspense>
      )}

      {modalInventarioInicial && (
        <Suspense fallback={null}>
          <InventarioInicial
            abrirEscanerParaFilaInventario={abrirEscanerParaFilaInventario}
            actualizarCodigoEanFila={actualizarCodigoEanFila}
            actualizarCodigoEanPackFila={actualizarCodigoEanPackFila}
            actualizarFilaInventario={actualizarFilaInventario}
            agregarCategoriaPersonalizada={agregarCategoriaPersonalizada}
            categoriasDB={categoriasDB}
            desvincularFilaInventario={desvincularFilaInventario}
            eliminarFilaInventario={eliminarFilaInventario}
            filaInventarioVacia={filaInventarioVacia}
            esBarberia={esBarberia}
            filaInventarioExpandidaIdx={filaInventarioExpandidaIdx}
            filasInventario={filasInventario}
            guardandoInventario={guardandoInventario}
            guardarInventarioInicial={guardarInventarioInicial}
            modalInventarioInicial={modalInventarioInicial}
            notificar={notificar}
            pasoInventario={pasoInventario}
            productos={productos}
            sesion={sesion}
            setFilaInventarioExpandidaIdx={setFilaInventarioExpandidaIdx}
            setFilasInventario={setFilasInventario}
            setModalInventarioInicial={setModalInventarioInicial}
            setPasoInventario={setPasoInventario}
            subiendoFotoFilaIdx={subiendoFotoFilaIdx}
            subirFotoFilaInventario={subirFotoFilaInventario}
            sugerenciasMaestroParaFila={sugerenciasMaestroParaFila}
            sugerenciasParaFila={sugerenciasParaFila}
            sugerenciasParaFilaPack={sugerenciasParaFilaPack}
            usarSugerenciaMaestraEnFila={usarSugerenciaMaestraEnFila}
            vincularProductoExistenteEnFila={vincularProductoExistenteEnFila}
          />
        </Suspense>
      )}

      {modalCombos && (
        <Suspense fallback={null}>
          <CombosModal
            actualizarCantidadItemCombo={actualizarCantidadItemCombo}
            agregarProductoAFormCombo={agregarProductoAFormCombo}
            alternarActivoCombo={alternarActivoCombo}
            aplicarDescuentoRapidoCombo={aplicarDescuentoRapidoCombo}
            aplicarPrecioCombo={aplicarPrecioCombo}
            buscarProductoPorCodigo={buscarProductoPorCodigo}
            busquedaCombos={busquedaCombos}
            busquedaProductoCombo={busquedaProductoCombo}
            cargandoCombos={cargandoCombos}
            carrito={carrito}
            cerrarEditorCombo={cerrarEditorCombo}
            cerrarModalCombos={cerrarModalCombos}
            combos={combos}
            costoNormalCombo={costoNormalCombo}
            duplicarCombo={duplicarCombo}
            editarCombo={editarCombo}
            eliminarCombo={eliminarCombo}
            esBarberia={esBarberia}
            estadoCombos={estadoCombos}
            filtroCombos={filtroCombos}
            formCombo={formCombo}
            formComboOriginal={formComboOriginal}
            guardandoCombo={guardandoCombo}
            guardarCombo={guardarCombo}
            modalCombos={modalCombos}
            notificar={notificar}
            nuevoCombo={nuevoCombo}
            precioNormalCombo={precioNormalCombo}
            productos={productos}
            quitarItemCombo={quitarItemCombo}
            resaltadoProductoCombo={resaltadoProductoCombo}
            setBusquedaCombos={setBusquedaCombos}
            setBusquedaProductoCombo={setBusquedaProductoCombo}
            setFiltroCombos={setFiltroCombos}
            setFormCombo={setFormCombo}
            setResaltadoProductoCombo={setResaltadoProductoCombo}
            snapshotCombo={snapshotCombo}
          />
        </Suspense>
      )}

      {modalInventarioValorizado && (
        <Suspense fallback={null}>
          <InventarioValorizado productos={productos} onClose={() => setModalInventarioValorizado(false)} />
        </Suspense>
      )}

      {modalMerma && (
        <Suspense fallback={null}>
          <MermaModal
            IconoTrazo={IconoTrazo}
            abrirEscanerParaMerma={abrirEscanerParaMerma}
            buscarProductoPorCodigo={buscarProductoPorCodigo}
            busquedaMerma={busquedaMerma}
            cerrarModalMerma={cerrarModalMerma}
            elegirProductoMerma={elegirProductoMerma}
            formMerma={formMerma}
            guardandoMerma={guardandoMerma}
            modalMerma={modalMerma}
            productos={productos}
            registrarMermaProducto={registrarMermaProducto}
            setBusquedaMerma={setBusquedaMerma}
            setFormMerma={setFormMerma}
            formatoSoles={formatoSoles}
          />
        </Suspense>
      )}

      {/* Modal: Toma de Inventario (conteo físico vs. sistema) -- 2 pasos:
          "conteo" (se busca y anota lo contado, sin ver el stock del
          sistema) y "revision" (recién ahí se compara y se guarda, lo
          que ajusta el stock automáticamente si hay diferencia). */}
      {modalTomaInventario && (
        <Suspense fallback={null}>
          <TomaInventario
            PestanasModal={PestanasModal}
            abrirHistorialInventario={abrirHistorialInventario}
            actualizarPendienteConteo={actualizarPendienteConteo}
            actualizarStockContado={actualizarStockContado}
            agregarHallazgo={agregarHallazgo}
            agregarProductoAConteo={agregarProductoAConteo}
            categoriasDB={categoriasDB}
            conteoFisicoBusqueda={conteoFisicoBusqueda}
            continuarARevisionInventario={continuarARevisionInventario}
            editandoPackParaId={editandoPackParaId}
            filasTomaInventario={filasTomaInventario}
            filasTomaInventarioVisibles={filasTomaInventarioVisibles}
            guardandoTomaInventario={guardandoTomaInventario}
            guardarTomaInventario={guardarTomaInventario}
            historialConteoAbierto={historialConteoAbierto}
            modalTomaInventario={modalTomaInventario}
            pasoTomaInventario={pasoTomaInventario}
            productos={productos}
            promoverAActivoConteo={promoverAActivoConteo}
            quitarHallazgo={quitarHallazgo}
            quitarProductoDeConteo={quitarProductoDeConteo}
            refsPendientesConteo={refsPendientesConteo}
            resultadosBusquedaConteo={resultadosBusquedaConteo}
            setConteoFisicoBusqueda={setConteoFisicoBusqueda}
            setEditandoPackParaId={setEditandoPackParaId}
            setHistorialConteoAbierto={setHistorialConteoAbierto}
            setMetodoForzado={setMetodoForzado}
            setModalEscaner={setModalEscaner}
            setModalTomaInventario={setModalTomaInventario}
            setModoEscaner={setModoEscaner}
            setPasoTomaInventario={setPasoTomaInventario}
            setTomaInventarioBusqueda={setTomaInventarioBusqueda}
            setTomaInventarioCategoria={setTomaInventarioCategoria}
            tomaInventarioBusqueda={tomaInventarioBusqueda}
            tomaInventarioCategoria={tomaInventarioCategoria}
            vaciarConteoInventario={vaciarConteoInventario}
          />
        </Suspense>
      )}

      {modalEditarProducto && formEditarProducto && (
        <Suspense fallback={null}>
          <EditarProducto
            agregarCategoriaPersonalizada={agregarCategoriaPersonalizada}
            categoriasDB={categoriasDB}
            combos={combos}
            desactivarProducto={desactivarProducto}
            esBarberia={esBarberia}
            formEditarOriginal={formEditarOriginal}
            formEditarProducto={formEditarProducto}
            guardandoEdicionProducto={guardandoEdicionProducto}
            guardarEdicionProducto={guardarEdicionProducto}
            modalEditarProducto={modalEditarProducto}
            pedirConfirmacion={pedirConfirmacion}
            productos={productos}
            quitarFotoExtra={quitarFotoExtra}
            sesion={sesion}
            setFormEditarProducto={setFormEditarProducto}
            setMetodoForzado={setMetodoForzado}
            setModalEditarProducto={setModalEditarProducto}
            setModalEscaner={setModalEscaner}
            setModoEscaner={setModoEscaner}
            setTabEditarProducto={setTabEditarProducto}
            subiendoFotoExtra={subiendoFotoExtra}
            subiendoFotoProducto={subiendoFotoProducto}
            subirFotoExtraProducto={subirFotoExtraProducto}
            subirFotoProducto={subirFotoProducto}
            tabEditarProducto={tabEditarProducto}
          />
        </Suspense>
      )}

      {modalEntradaMercaderia && (
        <Suspense fallback={null}>
          <EntradaMercaderia
            abrirProductoNuevoEntrada={abrirProductoNuevoEntrada}
            agregarItemEntradaMercaderia={agregarItemEntradaMercaderia}
            buscarProductoPorCodigo={buscarProductoPorCodigo}
            busquedaCompra={busquedaCompra}
            cambiarTipoEntrada={cambiarTipoEntrada}
            categoriasDB={categoriasDB}
            cerrarModalEntradaMercaderia={cerrarModalEntradaMercaderia}
            compraCabecera={compraCabecera}
            compraItemTemp={compraItemTemp}
            compraItems={compraItems}
            crearProductoInlineCompra={crearProductoInlineCompra}
            editarLineaEntrada={editarLineaEntrada}
            elegirProductoEntrada={elegirProductoEntrada}
            entradaRegistrada={entradaRegistrada}
            filtroCompra={filtroCompra}
            guardandoEntrada={guardandoEntrada}
            guardandoProductoInlineCompra={guardandoProductoInlineCompra}
            guardarEntradaMercaderia={guardarEntradaMercaderia}
            idsNuevosCompra={idsNuevosCompra}
            modalEntradaMercaderia={modalEntradaMercaderia}
            nuevoProductoInlineCompra={nuevoProductoInlineCompra}
            pedirCerrarEntrada={pedirCerrarEntrada}
            productos={productos}
            proveedoresLista={proveedoresLista}
            quitarItemEntradaMercaderia={quitarItemEntradaMercaderia}
            resaltadoCompra={resaltadoCompra}
            setBusquedaCompra={setBusquedaCompra}
            setCompraCabecera={setCompraCabecera}
            setCompraItemTemp={setCompraItemTemp}
            setEntradaRegistrada={setEntradaRegistrada}
            setFiltroCompra={setFiltroCompra}
            setMetodoForzado={setMetodoForzado}
            setModalEscaner={setModalEscaner}
            setModoEscaner={setModoEscaner}
            setNuevoProductoInlineCompra={setNuevoProductoInlineCompra}
            setResaltadoCompra={setResaltadoCompra}
          />
        </Suspense>
      )}
    </>
  );
}
