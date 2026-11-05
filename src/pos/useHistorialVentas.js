// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { mensajeError } from './utilidades.js';
import { fechaISOLocal, fechaHoyISO } from '../PanelAdminCompartido.jsx';

export default function useHistorialVentas({
  bodegaId, esModoDemo, notificar, sbClient, setAtajoHistorial, setBusquedaBoletaHistorial,
  setCargandoHistorial, setFechaFinHistorial, setFechaInicioHistorial, setLimiteHistorial,
  setMenuVentaHistorial, setModalHistorial, setVentaDetalleHistorial, setVentasDelDia,
  ventasDemoRef
}) {
  // ==========================================
  // HISTORIAL DE VENTAS DEL DÍA & ANULACIÓN
  // ==========================================
  const cargarHistorialPorRango = async (desde, hasta) => {
    setCargandoHistorial(true);
    setLimiteHistorial(40);
    const inicio = new Date(`${desde}T00:00:00`);
    const fin = new Date(`${hasta}T23:59:59.999`);

    if (esModoDemo) {
      // El catálogo/ventas del Modo Demo solo viven en memoria (ver
      // ventasDemoRef): filtrar y ordenar acá en vez de ir a Supabase.
      const enRango = ventasDemoRef.current
        .filter((v) => {
          const f = new Date(v.fecha_hora);
          return f >= inicio && f <= fin;
        })
        .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
      setVentasDelDia(enRango);
      setCargandoHistorial(false);
      return;
    }

    if (sbClient && bodegaId) {
      try {
        const { data, error } = await sbClient
          .from('ventas')
          .select('*, clientes(nombre_completo), ventas_detalle(*, productos(descripcion, unidad))')
          .eq('bodega_id', bodegaId)
          .gte('fecha_hora', inicio.toISOString())
          .lte('fecha_hora', fin.toISOString())
          .order('fecha_hora', { ascending: false });

        if (error) throw error;
        setVentasDelDia(data || []);
      } catch (err) {
        console.warn(err);
        notificar(mensajeError(err, 'No se pudo cargar el historial'), 'error');
      } finally {
        setCargandoHistorial(false);
      }
    } else {
      setCargandoHistorial(false);
    }
  };

  // Nombre del cliente en el historial: la cuenta "Desconocido" es la venta sin cliente.
  const nombreClienteHistorial = (v) => {
    const nombre = v.clientes?.nombre_completo;
    return nombre && nombre !== 'Desconocido' ? nombre : 'Cliente sin registrar';
  };
  const etiquetaDiaHistorial = (iso) => {
    const d = new Date(iso);
    const hoy = new Date();
    const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dif = Math.round((dia(hoy) - dia(d)) / 86400000);
    if (dif <= 0) return 'Hoy';
    if (dif === 1) return 'Ayer';
    return d.toLocaleDateString('es-PE', d.getFullYear() !== hoy.getFullYear() ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' });
  };
  // Atajos de fecha del historial: Hoy, Ayer, 7 días, Este mes o fechas a elección.
  const elegirAtajoHistorial = (id) => {
    setAtajoHistorial(id);
    setVentaDetalleHistorial(null);
    setMenuVentaHistorial(null);
    if (id === 'fechas') return;
    const hoy = new Date();
    let desde = fechaISOLocal(hoy);
    let hasta = desde;
    if (id === 'ayer') {
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);
      desde = fechaISOLocal(ayer);
      hasta = desde;
    } else if (id === '7dias') {
      const hace6 = new Date(hoy);
      hace6.setDate(hace6.getDate() - 6);
      desde = fechaISOLocal(hace6);
    } else if (id === 'mes') {
      desde = fechaISOLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    }
    setFechaInicioHistorial(desde);
    setFechaFinHistorial(hasta);
    setBusquedaBoletaHistorial('');
    cargarHistorialPorRango(desde, hasta);
  };

  const abrirHistorialDelDia = () => {
    setModalHistorial(true);
    setAtajoHistorial('hoy');
    setVentaDetalleHistorial(null);
    setMenuVentaHistorial(null);
    const hoy = fechaHoyISO();
    setFechaInicioHistorial(hoy);
    setFechaFinHistorial(hoy);
    setBusquedaBoletaHistorial('');
    cargarHistorialPorRango(hoy, hoy);
  };

  return {
    abrirHistorialDelDia, cargarHistorialPorRango, elegirAtajoHistorial, etiquetaDiaHistorial,
    nombreClienteHistorial
  };
}
