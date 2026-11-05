// Ventanas de reportes: Dashboard, Historial de ventas y Cierre de caja.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React, { Suspense } from 'react';
import { DashboardVentas, HistorialVentas, CierreCaja } from '../pos/perezosos.js';
import { formatoSoles, montoResumen, montoCorto, etiquetaCuandoTurno } from '../pos/utilidades.js';
import { FiltroFechasRapido, VariacionPct, ContadorEfectivo, DesgloseMediosPago } from '../pos/componentes.jsx';

export default function VentanasReportes({
  abrirHistorialCierres, anularVentaHoy, arqueoEsperado, atajoHistorial,
  busquedaBoletaHistorial, cajeroSeleccionado, cambiarConteo, cargandoDashboard,
  cargandoHistorial, cargarDashboard, cargarHistorialPorRango, clientesDeuda, combosVendidos,
  confirmarCierreConArqueo, conteoAbierto, conteoEfectivo, dashStats, diaCalendarioSel,
  diasAnioDash, diasAnioRango, elegirAtajoHistorial, esAdmin, etiquetaDiaHistorial,
  exportarDashboardExcel, exportarVentasExcel, fechaFinDash, fechaFinHistorial,
  fechaInicioDash, fechaInicioHistorial, horaResaltada, limiteHistorial, menuVentaHistorial,
  mesCalendario, mesResaltado, modalCierreCaja, modalDashboard, modalHistorial,
  montoConteoEfectivo, nombreClienteHistorial, pestanaDiaCal, productos, proveedoresDeudaDash,
  resumenCierre, setBusquedaBoletaHistorial, setConteoAbierto, setConteoEfectivo,
  setDiaCalendarioSel, setFechaFinDash, setFechaFinHistorial, setFechaInicioDash,
  setFechaInicioHistorial, setHoraResaltada, setLimiteHistorial, setMenuVentaHistorial,
  setMesCalendario, setMesResaltado, setModalCierreCaja, setModalDashboard, setModalHistorial,
  setMontoConteoEfectivo, setPestanaDiaCal, setReciboReimpresion, setResumenCierre,
  setVentaDetalleHistorial, turnoActivo, ventaDetalleHistorial, ventasDelDia, vuelto
}) {
  return (
    <>
      {modalDashboard && (
        <Suspense fallback={null}>
          <DashboardVentas
            cargandoDashboard={cargandoDashboard}
            cargarDashboard={cargarDashboard}
            clientesDeuda={clientesDeuda}
            combosVendidos={combosVendidos}
            dashStats={dashStats}
            diaCalendarioSel={diaCalendarioSel}
            diasAnioDash={diasAnioDash}
            diasAnioRango={diasAnioRango}
            exportarDashboardExcel={exportarDashboardExcel}
            fechaFinDash={fechaFinDash}
            fechaInicioDash={fechaInicioDash}
            horaResaltada={horaResaltada}
            mesResaltado={mesResaltado}
            mesCalendario={mesCalendario}
            pestanaDiaCal={pestanaDiaCal}
            productos={productos}
            proveedoresDeudaDash={proveedoresDeudaDash}
            setDiaCalendarioSel={setDiaCalendarioSel}
            setFechaFinDash={setFechaFinDash}
            setFechaInicioDash={setFechaInicioDash}
            setHoraResaltada={setHoraResaltada}
            setMesCalendario={setMesCalendario}
            setMesResaltado={setMesResaltado}
            setModalDashboard={setModalDashboard}
            setPestanaDiaCal={setPestanaDiaCal}
            formatoSoles={formatoSoles}
            montoResumen={montoResumen}
            montoCorto={montoCorto}
            FiltroFechasRapido={FiltroFechasRapido}
            VariacionPct={VariacionPct}
          />
        </Suspense>
      )}

      {modalHistorial && (
        <Suspense fallback={null}>
          <HistorialVentas
            abrirHistorialCierres={abrirHistorialCierres}
            anularVentaHoy={anularVentaHoy}
            atajoHistorial={atajoHistorial}
            busquedaBoletaHistorial={busquedaBoletaHistorial}
            cargandoHistorial={cargandoHistorial}
            cargarHistorialPorRango={cargarHistorialPorRango}
            elegirAtajoHistorial={elegirAtajoHistorial}
            esAdmin={esAdmin}
            etiquetaDiaHistorial={etiquetaDiaHistorial}
            exportarVentasExcel={exportarVentasExcel}
            fechaFinHistorial={fechaFinHistorial}
            fechaInicioHistorial={fechaInicioHistorial}
            formatoSoles={formatoSoles}
            limiteHistorial={limiteHistorial}
            menuVentaHistorial={menuVentaHistorial}
            modalHistorial={modalHistorial}
            nombreClienteHistorial={nombreClienteHistorial}
            productos={productos}
            setBusquedaBoletaHistorial={setBusquedaBoletaHistorial}
            setFechaFinHistorial={setFechaFinHistorial}
            setFechaInicioHistorial={setFechaInicioHistorial}
            setLimiteHistorial={setLimiteHistorial}
            setMenuVentaHistorial={setMenuVentaHistorial}
            setModalHistorial={setModalHistorial}
            setReciboReimpresion={setReciboReimpresion}
            setVentaDetalleHistorial={setVentaDetalleHistorial}
            ventaDetalleHistorial={ventaDetalleHistorial}
            ventasDelDia={ventasDelDia}
          />
        </Suspense>
      )}

      {(modalCierreCaja || resumenCierre) && (
        <Suspense fallback={null}>
          <CierreCaja
            abrirHistorialCierres={abrirHistorialCierres}
            arqueoEsperado={arqueoEsperado}
            cajeroSeleccionado={cajeroSeleccionado}
            cambiarConteo={cambiarConteo}
            confirmarCierreConArqueo={confirmarCierreConArqueo}
            conteoAbierto={conteoAbierto}
            conteoEfectivo={conteoEfectivo}
            modalCierreCaja={modalCierreCaja}
            montoConteoEfectivo={montoConteoEfectivo}
            resumenCierre={resumenCierre}
            setConteoAbierto={setConteoAbierto}
            setConteoEfectivo={setConteoEfectivo}
            setModalCierreCaja={setModalCierreCaja}
            setMontoConteoEfectivo={setMontoConteoEfectivo}
            setResumenCierre={setResumenCierre}
            turnoActivo={turnoActivo}
            ContadorEfectivo={ContadorEfectivo}
            DesgloseMediosPago={DesgloseMediosPago}
            etiquetaCuandoTurno={etiquetaCuandoTurno}
            vuelto={vuelto}
          />
        </Suspense>
      )}
    </>
  );
}
