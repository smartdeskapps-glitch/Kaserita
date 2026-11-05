// Ventanas de Fiados (cobrar deudas) y Cuentas por pagar (proveedores).
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React, { Suspense } from 'react';
import { FiadosModal, CuentasPagar, NuevoProveedor } from '../pos/perezosos.js';
import { IconoTrazo } from '../pos/componentes.jsx';
import { etiquetaCuandoTurno, formatoSoles } from '../pos/utilidades.js';

export default function VentanasFiadosYProveedores({
  abrirEdicionCliente, boletasDeudores, busquedaDeudores, cargandoDetalleDeudor,
  cargandoDeudores, clientesLista, confirmandoPagoDeudor, descargarEstadoCuenta,
  deudorSeleccionado, enviarEstadoCuentaWhatsApp, esAdmin, estadoDeudorSel,
  exportarClientesExcel, filtroDeudores, formEditarCliente, formProveedor,
  guardandoEdicionCliente, guardarEdicionCliente, handleGuardarNuevoProveedor, hojaPagoDeudor,
  listaCajeros, modalCobrarDeudas, modalCuentasPagar, modalNuevoProveedor, montoAbonoDeuda,
  montoMovimientoProveedor, mostrarHistorialCompletoDeuda, ordenDeudores, pagoRegistrado,
  pagosRecientes, procesarPagoDeudaCliente, proveedorSeleccionado, proveedoresLista,
  registrarMovimientoProveedor, seleccionarDeudor, setBoletasDeudor, setBusquedaDeudores,
  setClienteEditando, setConfirmandoPagoDeudor, setDeudorSeleccionado, setFiltroDeudores,
  setFormEditarCliente, setFormProveedor, setHojaPagoDeudor, setModalCobrarDeudas,
  setModalCuentasPagar, setModalNuevoCliente, setModalNuevoProveedor, setMontoAbonoDeuda,
  setMontoMovimientoProveedor, setMostrarHistorialCompletoDeuda, setOrdenDeudores,
  setPagoRegistrado, setProveedorSeleccionado
}) {
  return (
    <>
      {modalCobrarDeudas && (
        <Suspense fallback={null}>
          <FiadosModal
            IconoTrazo={IconoTrazo}
            abrirEdicionCliente={abrirEdicionCliente}
            boletasDeudores={boletasDeudores}
            busquedaDeudores={busquedaDeudores}
            cargandoDetalleDeudor={cargandoDetalleDeudor}
            cargandoDeudores={cargandoDeudores}
            clientesLista={clientesLista}
            confirmandoPagoDeudor={confirmandoPagoDeudor}
            descargarEstadoCuenta={descargarEstadoCuenta}
            deudorSeleccionado={deudorSeleccionado}
            enviarEstadoCuentaWhatsApp={enviarEstadoCuentaWhatsApp}
            esAdmin={esAdmin}
            estadoDeudorSel={estadoDeudorSel}
            etiquetaCuandoTurno={etiquetaCuandoTurno}
            exportarClientesExcel={exportarClientesExcel}
            filtroDeudores={filtroDeudores}
            formEditarCliente={formEditarCliente}
            formatoSoles={formatoSoles}
            guardandoEdicionCliente={guardandoEdicionCliente}
            guardarEdicionCliente={guardarEdicionCliente}
            hojaPagoDeudor={hojaPagoDeudor}
            listaCajeros={listaCajeros}
            modalCobrarDeudas={modalCobrarDeudas}
            montoAbonoDeuda={montoAbonoDeuda}
            mostrarHistorialCompletoDeuda={mostrarHistorialCompletoDeuda}
            ordenDeudores={ordenDeudores}
            pagoRegistrado={pagoRegistrado}
            pagosRecientes={pagosRecientes}
            procesarPagoDeudaCliente={procesarPagoDeudaCliente}
            seleccionarDeudor={seleccionarDeudor}
            setBoletasDeudor={setBoletasDeudor}
            setBusquedaDeudores={setBusquedaDeudores}
            setClienteEditando={setClienteEditando}
            setConfirmandoPagoDeudor={setConfirmandoPagoDeudor}
            setDeudorSeleccionado={setDeudorSeleccionado}
            setFiltroDeudores={setFiltroDeudores}
            setFormEditarCliente={setFormEditarCliente}
            setHojaPagoDeudor={setHojaPagoDeudor}
            setModalCobrarDeudas={setModalCobrarDeudas}
            setModalNuevoCliente={setModalNuevoCliente}
            setMontoAbonoDeuda={setMontoAbonoDeuda}
            setMostrarHistorialCompletoDeuda={setMostrarHistorialCompletoDeuda}
            setOrdenDeudores={setOrdenDeudores}
            setPagoRegistrado={setPagoRegistrado}
          />
        </Suspense>
      )}

      {modalCuentasPagar && (
        <Suspense fallback={null}>
          <CuentasPagar
            modalCuentasPagar={modalCuentasPagar}
            montoMovimientoProveedor={montoMovimientoProveedor}
            proveedorSeleccionado={proveedorSeleccionado}
            proveedoresLista={proveedoresLista}
            registrarMovimientoProveedor={registrarMovimientoProveedor}
            setModalCuentasPagar={setModalCuentasPagar}
            setModalNuevoProveedor={setModalNuevoProveedor}
            setMontoMovimientoProveedor={setMontoMovimientoProveedor}
            setProveedorSeleccionado={setProveedorSeleccionado}
          />
        </Suspense>
      )}

      {modalNuevoProveedor && (
        <Suspense fallback={null}>
          <NuevoProveedor
            formProveedor={formProveedor}
            handleGuardarNuevoProveedor={handleGuardarNuevoProveedor}
            modalNuevoProveedor={modalNuevoProveedor}
            setFormProveedor={setFormProveedor}
            setModalNuevoProveedor={setModalNuevoProveedor}
          />
        </Suspense>
      )}
    </>
  );
}
