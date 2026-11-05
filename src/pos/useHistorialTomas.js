// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { mensajeError } from './utilidades.js';
import { fechaHoyISO, fechaISOLocal } from '../PanelAdminCompartido.jsx';
import { useMemo } from 'react';

export default function useHistorialTomas({
  bodegaId, historialInventario, historialInventarioBusqueda, historialInventarioSoloDif,
  notificar, sbClient, setCargandoHistorialInventario, setFechaFinHistInventario,
  setFechaInicioHistInventario, setHistorialInventario, setHistorialInventarioBusqueda,
  setHistorialInventarioSoloDif, setModalHistorialInventario
}) {
  // ==========================================
  // HISTORIAL DE TOMAS DE INVENTARIO (comparar cuadres a lo largo del tiempo)
  // ==========================================
  const cargarHistorialInventarioPorRango = async (desde, hasta) => {
    if (!sbClient || !bodegaId) return;
    setCargandoHistorialInventario(true);
    try {
      const inicio = new Date(`${desde}T00:00:00`);
      const fin = new Date(`${hasta}T23:59:59.999`);
      const { data, error } = await sbClient
        .from('tomas_inventario')
        .select('*, productos(descripcion, categoria)')
        .eq('bodega_id', bodegaId)
        .gte('fecha', inicio.toISOString())
        .lte('fecha', fin.toISOString())
        .order('fecha', { ascending: false })
        .limit(500);
      if (error) throw error;
      setHistorialInventario(data || []);
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo cargar el historial'), 'error');
    } finally {
      setCargandoHistorialInventario(false);
    }
  };

  const abrirHistorialInventario = () => {
    const hoy = fechaHoyISO();
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 29);
    const desde = fechaISOLocal(hace30dias);
    setFechaInicioHistInventario(desde);
    setFechaFinHistInventario(hoy);
    setHistorialInventarioBusqueda('');
    setHistorialInventarioSoloDif(false);
    setModalHistorialInventario(true);
    cargarHistorialInventarioPorRango(desde, hoy);
  };

  // Agrupado por día (más nuevo primero) para poder leer el historial
  // como una comparación día a día: "el 12 cuadró, el 13 no, el 14 se
  // mantuvo" -- en vez de una lista plana sin contexto de fecha.
  const historialInventarioAgrupado = useMemo(() => {
    const t = historialInventarioBusqueda.trim().toLowerCase();
    const filtrado = historialInventario
      .filter((h) => !t || (h.productos?.descripcion || '').toLowerCase().includes(t))
      .filter((h) => !historialInventarioSoloDif || Number(h.diferencia) !== 0);
    const grupos = [];
    let grupoActual = null;
    filtrado.forEach((h) => {
      const dia = h.fecha.slice(0, 10);
      if (!grupoActual || grupoActual.dia !== dia) {
        grupoActual = { dia, items: [] };
        grupos.push(grupoActual);
      }
      grupoActual.items.push(h);
    });
    return grupos;
  }, [historialInventario, historialInventarioBusqueda, historialInventarioSoloDif]);

  return {
    abrirHistorialInventario, cargarHistorialInventarioPorRango, historialInventarioAgrupado
  };
}
