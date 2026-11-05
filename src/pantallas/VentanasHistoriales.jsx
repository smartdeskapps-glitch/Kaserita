// Historiales: cierres de caja y tomas de inventario.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React, { Suspense } from 'react';
import { HistorialCierres, HistorialInventario } from '../pos/perezosos.js';
import { formatoSoles } from '../pos/utilidades.js';
import { FiltroFechasRapido, PestanasModal } from '../pos/componentes.jsx';

export default function VentanasHistoriales({
  abrirHistorialDelDia, abrirTomaInventario, atajoCierres, cargandoCierres,
  cargandoHistorialInventario, cargarHistorialCierresPorRango,
  cargarHistorialInventarioPorRango, cierreDetalle, cierresCaja, elegirAtajoCierres,
  etiquetaDiaHistorial, fechaFinCierres, fechaFinHistInventario, fechaInicioCierres,
  fechaInicioHistInventario, historialInventarioAgrupado, historialInventarioBusqueda,
  historialInventarioSoloDif, listaCajeros, modalHistorialCierres, modalHistorialInventario,
  setCierreDetalle, setFechaFinCierres, setFechaFinHistInventario, setFechaInicioCierres,
  setFechaInicioHistInventario, setHistorialInventarioBusqueda, setHistorialInventarioSoloDif,
  setModalHistorialCierres, setModalHistorialInventario, setSoloConDiferenciaCierres,
  soloConDiferenciaCierres
}) {
  return (
    <>
      {modalHistorialCierres && (
        <Suspense fallback={null}>
          <HistorialCierres
            abrirHistorialDelDia={abrirHistorialDelDia}
            atajoCierres={atajoCierres}
            cargandoCierres={cargandoCierres}
            cargarHistorialCierresPorRango={cargarHistorialCierresPorRango}
            cierreDetalle={cierreDetalle}
            cierresCaja={cierresCaja}
            elegirAtajoCierres={elegirAtajoCierres}
            etiquetaDiaHistorial={etiquetaDiaHistorial}
            fechaFinCierres={fechaFinCierres}
            fechaInicioCierres={fechaInicioCierres}
            formatoSoles={formatoSoles}
            modalHistorialCierres={modalHistorialCierres}
            setCierreDetalle={setCierreDetalle}
            setFechaFinCierres={setFechaFinCierres}
            setFechaInicioCierres={setFechaInicioCierres}
            setModalHistorialCierres={setModalHistorialCierres}
            setSoloConDiferenciaCierres={setSoloConDiferenciaCierres}
            soloConDiferenciaCierres={soloConDiferenciaCierres}
          />
        </Suspense>
      )}

      {/* Modal: Historial de Toma de Inventario -- comparar, producto por
          producto, si un día cuadró contra el sistema y otro no. */}
      {modalHistorialInventario && (
        <Suspense fallback={null}>
          <HistorialInventario
            FiltroFechasRapido={FiltroFechasRapido}
            PestanasModal={PestanasModal}
            abrirTomaInventario={abrirTomaInventario}
            cargandoHistorialInventario={cargandoHistorialInventario}
            cargarHistorialInventarioPorRango={cargarHistorialInventarioPorRango}
            fechaFinHistInventario={fechaFinHistInventario}
            fechaInicioHistInventario={fechaInicioHistInventario}
            historialInventarioAgrupado={historialInventarioAgrupado}
            historialInventarioBusqueda={historialInventarioBusqueda}
            historialInventarioSoloDif={historialInventarioSoloDif}
            listaCajeros={listaCajeros}
            modalHistorialInventario={modalHistorialInventario}
            setFechaFinHistInventario={setFechaFinHistInventario}
            setFechaInicioHistInventario={setFechaInicioHistInventario}
            setHistorialInventarioBusqueda={setHistorialInventarioBusqueda}
            setHistorialInventarioSoloDif={setHistorialInventarioSoloDif}
            setModalHistorialInventario={setModalHistorialInventario}
          />
        </Suspense>
      )}
    </>
  );
}
