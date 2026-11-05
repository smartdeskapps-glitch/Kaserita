// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { resumirVentasPeriodo, agruparVentasPorDia, calcularCambioPct } from '../lib/dashboard.js';
import { zonaLocal, mensajeError, exportarExcel } from './utilidades.js';
import { fechaHoyISO, fechaISOLocal, asegurarXLSX } from '../PanelAdminCompartido.jsx';
import { useMemo } from 'react';

export default function useDashboard({
  bodegaId, busqueda, cargarProductos, catalogoDemoRef, clienteActual, clientesDeuda,
  clientesLista, combos, diasAnioDash, esModoDemo, fechaFinDash, fechaFinHistorial,
  fechaInicioDash, fechaInicioHistorial, notificar, pedirConfirmacion, pedirTexto,
  proveedoresDeudaDash, resumenPeriodo, sbClient, setCargandoDashboard, setClienteActual,
  setClientesDeuda, setClientesLista, setCombosVendidos, setDiasAnioDash, setDiasAnioRango,
  setFechaFinDash, setFechaInicioDash, setMesCalendario, setModalDashboard,
  setProveedoresDeudaDash, setResumenPeriodo, setVentasDelDia, ventasDelDia, ventasDemoRef
}) {
  // ==========================================
  // DASHBOARD DE VENTAS (detallado, solo Administrador)
  // ==========================================
  const cargarDashboard = async (desde, hasta) => {
    setCargandoDashboard(true);
    setMesCalendario(null);
    const inicio = new Date(`${desde}T00:00:00`);
    const fin = new Date(`${hasta}T23:59:59.999`);

    if (esModoDemo) {
      // Mismo cálculo, pero leyendo del catálogo/ventas en memoria del
      // Modo Demo en vez de Supabase (ver ventasDemoRef).
      const enRango = ventasDemoRef.current.filter((v) => {
        const f = new Date(v.fecha_hora);
        return f >= inicio && f <= fin;
      });
      const duracionMs = fin.getTime() - inicio.getTime();
      const finAnterior = new Date(inicio.getTime() - 1);
      const inicioAnterior = new Date(finAnterior.getTime() - duracionMs);
      const anterior = ventasDemoRef.current.filter((v) => {
        const f = new Date(v.fecha_hora);
        return f >= inicioAnterior && f <= finAnterior;
      });
      setResumenPeriodo(resumirVentasPeriodo(enRango, anterior));

      setClientesDeuda(clientesLista.filter((c) => (Number(c.saldo_actual) || 0) > 0).sort((a, b) => (Number(b.saldo_actual) || 0) - (Number(a.saldo_actual) || 0)));
      setProveedoresDeudaDash([]);

      const anioActual = new Date().getFullYear();
      const inicioAnio = new Date(anioActual, 0, 1);
      const finAnio = new Date(anioActual, 11, 31, 23, 59, 59, 999);
      setDiasAnioDash(agruparVentasPorDia(ventasDemoRef.current.filter((v) => {
        const f = new Date(v.fecha_hora);
        return f >= inicioAnio && f <= finAnio;
      })));
      const anioRangoDemo = Number(hasta.slice(0, 4));
      setDiasAnioRango(anioRangoDemo === anioActual ? [] : agruparVentasPorDia(ventasDemoRef.current.filter((v) => new Date(v.fecha_hora).getFullYear() === anioRangoDemo)));

      setCargandoDashboard(false);
      return;
    }

    if (sbClient && bodegaId) {
      try {
        // Combos vendidos en el período: el resumen por producto reparte cada
        // combo entre sus componentes, así que se consulta aparte por combo_id.
        // Una venta anulada no cuenta. Si falla, simplemente no se muestra.
        try {
          const { data: filasCombo } = await sbClient
            .from('ventas_detalle')
            .select('combo_id, producto_id, cantidad, subtotal, utilidad, ventas!inner(fecha_hora, anulada, bodega_id)')
            .not('combo_id', 'is', null)
            .eq('ventas.bodega_id', bodegaId)
            .eq('ventas.anulada', false)
            .gte('ventas.fecha_hora', inicio.toISOString())
            .lte('ventas.fecha_hora', fin.toISOString())
            .limit(5000);
          const porCombo = new Map();
          (filasCombo || []).forEach((d) => {
            const g = porCombo.get(d.combo_id) || { monto: 0, utilidad: 0, porProducto: new Map() };
            g.monto += Number(d.subtotal) || 0;
            g.utilidad += Number(d.utilidad) || 0;
            g.porProducto.set(d.producto_id, (g.porProducto.get(d.producto_id) || 0) + (Number(d.cantidad) || 0));
            porCombo.set(d.combo_id, g);
          });
          setCombosVendidos([...porCombo.entries()].map(([id, g]) => {
            const combo = combos.find((c) => c.id === id);
            const base = combo && (combo.combos_items || [])[0];
            const unidades = base && Number(base.cantidad) > 0 ? (g.porProducto.get(base.producto_id) || 0) / Number(base.cantidad) : 0;
            return { id, nombre: combo ? combo.nombre : 'Combo eliminado', unidades: Math.round(unidades * 100) / 100, monto: g.monto, utilidad: g.utilidad };
          }).sort((a, b) => b.monto - a.monto));
        } catch (errCombos) {
          console.warn('No se pudo cargar el resumen de combos', errCombos);
          setCombosVendidos([]);
        }

        const { data: resumen, error: errResumen } = await sbClient.rpc('dashboard_resumen_periodo', {
          p_bodega_id: bodegaId,
          p_desde: desde,
          p_hasta: hasta,
          p_zona: zonaLocal()
        });
        if (!errResumen && resumen && typeof resumen === 'object') {
          setResumenPeriodo(resumen);
        } else {
          // Plan B si la funcion SQL aun no existe: las consultas de
          // siempre (Supabase las corta en 1.000 filas, por eso se prefiere
          // la funcion).
          console.warn('dashboard_resumen_periodo no disponible, se usa la consulta directa', errResumen);
          const { data, error } = await sbClient
            .from('ventas')
            .select('*, ventas_detalle(*)')
            .eq('bodega_id', bodegaId)
            .gte('fecha_hora', inicio.toISOString())
            .lte('fecha_hora', fin.toISOString())
            .order('fecha_hora', { ascending: true });
          if (error) throw error;

          // Período anterior de igual duración, para comparar tendencia
          // (ej: "últimos 7 días" vs los 7 días previos a esos).
          const duracionMs = fin.getTime() - inicio.getTime();
          const finAnterior = new Date(inicio.getTime() - 1);
          const inicioAnterior = new Date(finAnterior.getTime() - duracionMs);
          const { data: dataAnterior, error: errAnterior } = await sbClient
            .from('ventas')
            .select('total_venta, utilidad_total, anulada')
            .eq('bodega_id', bodegaId)
            .gte('fecha_hora', inicioAnterior.toISOString())
            .lte('fecha_hora', finAnterior.toISOString());
          if (errAnterior) throw errAnterior;
          setResumenPeriodo(resumirVentasPeriodo(data || [], dataAnterior || []));
        }

        // Deuda de clientes (crédito): es un saldo vigente, no depende del
        // rango de fechas elegido -- se muestra el estado actual siempre.
        const { data: deudores, error: errDeudores } = await sbClient
          .from('clientes')
          .select('nombre_completo, dni, saldo_actual')
          .eq('bodega_id', bodegaId)
          .gt('saldo_actual', 0)
          .order('saldo_actual', { ascending: false });
        if (errDeudores) throw errDeudores;
        setClientesDeuda(deudores || []);

        // Deuda de la bodega con proveedores: también es un saldo
        // vigente, independiente del rango de fechas.
        const { data: proveedoresConDeuda, error: errProveedores } = await sbClient
          .from('proveedores')
          .select('nombre, saldo_actual')
          .eq('bodega_id', bodegaId)
          .gt('saldo_actual', 0)
          .order('saldo_actual', { ascending: false });
        if (errProveedores) console.warn(errProveedores);
        setProveedoresDeudaDash(proveedoresConDeuda || []);

        // Ventas del año calendario en curso, para "Ventas por Mes" --
        // independiente del rango de fechas elegido en el filtro rápido.
        const anioActual = new Date().getFullYear();
        const zona = zonaLocal();
        const { data: diasAnio, error: errAnio } = await sbClient.rpc('dashboard_ventas_por_dia', {
          p_bodega_id: bodegaId,
          p_desde: `${anioActual}-01-01`,
          p_hasta: `${anioActual}-12-31`,
          p_zona: zona
        });
        if (!errAnio && Array.isArray(diasAnio)) {
          setDiasAnioDash(diasAnio);
        } else {
          // Plan B si la funcion SQL aun no existe: el SELECT de siempre
          // (Supabase lo corta en 1.000 filas, por eso se prefiere la funcion).
          console.warn('dashboard_ventas_por_dia no disponible, se usa la consulta directa', errAnio);
          const inicioAnio = new Date(anioActual, 0, 1).toISOString();
          const finAnio = new Date(anioActual, 11, 31, 23, 59, 59, 999).toISOString();
          const { data: ventasAnio, error: errAnio2 } = await sbClient
            .from('ventas')
            .select('fecha_hora, total_venta, anulada, medio_pago, monto_efectivo, monto_otro')
            .eq('bodega_id', bodegaId)
            .gte('fecha_hora', inicioAnio)
            .lte('fecha_hora', finAnio);
          if (errAnio2) console.warn(errAnio2);
          setDiasAnioDash(agruparVentasPorDia(ventasAnio || []));
        }

        // Si el rango termina en otro anio, el calendario muestra ese anio.
        const anioRango = Number(hasta.slice(0, 4));
        if (anioRango && anioRango !== anioActual) {
          const { data: diasOtro } = await sbClient.rpc('dashboard_ventas_por_dia', {
            p_bodega_id: bodegaId,
            p_desde: `${anioRango}-01-01`,
            p_hasta: `${anioRango}-12-31`,
            p_zona: zona
          });
          setDiasAnioRango(Array.isArray(diasOtro) ? diasOtro : []);
        } else {
          setDiasAnioRango([]);
        }
      } catch (err) {
        console.warn(err);
        notificar(mensajeError(err, 'No se pudo cargar el dashboard'), 'error');
      } finally {
        setCargandoDashboard(false);
      }
    } else {
      setCargandoDashboard(false);
    }
  };

  const abrirDashboard = () => {
    const hoy = fechaHoyISO();
    const hace6dias = new Date();
    hace6dias.setDate(hace6dias.getDate() - 6);
    const desde = fechaISOLocal(hace6dias);
    setFechaInicioDash(desde);
    setFechaFinDash(hoy);
    setModalDashboard(true);
    cargarDashboard(desde, hoy);
  };


  const dashStats = useMemo(() => {
    const R = resumenPeriodo || resumirVentasPeriodo([], []);
    const totalVenta = Number(R.total) || 0;
    const totalUtilidad = Number(R.utilidad) || 0;
    // utilidad_total ya es total_venta - costo, así que el costo sale despejando.
    const totalCosto = totalVenta - totalUtilidad;
    const numVentas = Number(R.n) || 0;
    const ticketPromedio = numVentas ? totalVenta / numVentas : 0;
    const margenPct = totalVenta ? (totalUtilidad / totalVenta) * 100 : 0;

    const porHora = Array.from({ length: 24 }, (_, h) => ({
      hora: h,
      total: Number(R.por_hora?.[h]?.total) || 0,
      cantidad: Number(R.por_hora?.[h]?.n) || 0
    }));
    const maxHora = Math.max(1, ...porHora.map(h => h.total));
    const horaPico = porHora.reduce((mejor, h) => (h.total > mejor.total ? h : mejor), porHora[0]);

    const porDia = (R.por_dia || []).map(d => ({ fecha: d.fecha, total: Number(d.total) || 0 }));
    const maxDia = Math.max(1, ...porDia.map(d => d.total));

    const porMedio = Object.entries(R.por_medio || {})
      .map(([medio, total]) => ({ medio, total: Number(total) || 0, pct: totalVenta ? ((Number(total) || 0) / totalVenta) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);

    // Las líneas de combo llegan como "Producto (Combo: Nombre)": se suman al
    // producto base para que cada uno salga una sola vez (el detalle de los
    // combos va en su propia sección "Combos vendidos").
    const productosUnidos = new Map();
    (R.top_productos || []).forEach((p) => {
      const descripcion = String(p.descripcion || '').replace(/\s*\(Combo:[^)]*\)\s*$/, '');
      const previo = productosUnidos.get(descripcion) || { descripcion, cantidad: 0, monto: 0, utilidad: 0 };
      previo.cantidad += Number(p.cantidad) || 0;
      previo.monto += Number(p.monto) || 0;
      previo.utilidad += Number(p.utilidad) || 0;
      productosUnidos.set(descripcion, previo);
    });
    const topProductos = [...productosUnidos.values()]
      .map((p) => ({ ...p, monto: +p.monto.toFixed(2), utilidad: +p.utilidad.toFixed(2) }))
      .sort((a, b) => b.monto - a.monto);
    const maxProducto = Math.max(1, ...topProductos.map(p => p.monto));

    const numDeudores = clientesDeuda.length;
    const totalDeuda = clientesDeuda.reduce((a, c) => a + Number(c.saldo_actual || 0), 0);
    const maxDeuda = Math.max(1, ...clientesDeuda.map(c => Number(c.saldo_actual || 0)));

    const numProveedoresDeuda = proveedoresDeudaDash.length;
    const totalPorPagar = proveedoresDeudaDash.reduce((a, c) => a + Number(c.saldo_actual || 0), 0);
    const maxPorPagar = Math.max(1, ...proveedoresDeudaDash.map(c => Number(c.saldo_actual || 0)));

    // Comparación contra el período inmediatamente anterior de igual
    // duración (ej. "últimos 7 días" vs los 7 días previos a esos).
    const totalVentaAnterior = Number(R.anterior?.total) || 0;
    const totalUtilidadAnterior = Number(R.anterior?.utilidad) || 0;
    const cambioVentaPct = calcularCambioPct(totalVenta, totalVentaAnterior);
    const cambioUtilidadPct = calcularCambioPct(totalUtilidad, totalUtilidadAnterior);

    // Ventas por mes del año en curso -- para la sección "Ventas por Mes",
    // independiente del rango de fechas del filtro rápido.
    const anioActual = new Date().getFullYear();
    const porMes = Array.from({ length: 12 }, (_, m) => ({ mes: m, total: 0, cantidad: 0 }));
    diasAnioDash.forEach(d => {
      const m = Number(String(d.fecha).slice(5, 7)) - 1;
      if (!porMes[m]) return;
      porMes[m].total += Number(d.total);
      porMes[m].cantidad += Number(d.n);
    });
    const maxMes = Math.max(1, ...porMes.map(m => m.total));
    const mesPico = porMes.reduce((mejor, m) => (m.total > mejor.total ? m : mejor), porMes[0]);
    const mesActualIdx = new Date().getMonth();
    // Promedio sobre los meses ya transcurridos del año (incluye el actual),
    // no sobre los 12 -- si no, diluiría el promedio con meses futuros vacíos.
    const mesesTranscurridos = porMes.slice(0, mesActualIdx + 1);
    const totalAnio = mesesTranscurridos.reduce((a, m) => a + m.total, 0);
    const promedioMensual = mesesTranscurridos.length ? totalAnio / mesesTranscurridos.length : 0;
    const mesAnteriorIdx = mesActualIdx - 1;
    const totalMesAnterior = mesAnteriorIdx >= 0 ? porMes[mesAnteriorIdx].total : 0;
    const cambioMesPct = calcularCambioPct(porMes[mesActualIdx].total, totalMesAnterior);

    return {
      totalVenta, totalUtilidad, totalCosto, numVentas, ticketPromedio, margenPct,
      porHora, maxHora, horaPico, porDia, maxDia, porMedio, topProductos, maxProducto,
      numDeudores, totalDeuda, maxDeuda,
      numProveedoresDeuda, totalPorPagar, maxPorPagar,
      cambioVentaPct, cambioUtilidadPct,
      // Sin ventas en el período anterior no hay base de comparación: el
      // porcentaje (que calcularCambioPct deja en 100) se oculta en pantalla.
      hayBaseVentaAnterior: totalVentaAnterior > 0,
      hayBaseUtilidadAnterior: totalUtilidadAnterior > 0,
      hayBaseMesAnterior: totalMesAnterior > 0,
      anioActual, porMes, maxMes, mesPico, mesActualIdx, totalAnio, promedioMensual, cambioMesPct
    };
  }, [resumenPeriodo, clientesDeuda, proveedoresDeudaDash, diasAnioDash]);

  // Exporta todo el Dashboard a un Excel real (.xlsx, varias hojas),
  // no un CSV -- cada sección del dashboard es su propia hoja.
  const exportarDashboardExcel = async () => {
    await asegurarXLSX();
    // El detalle de cada venta del período se pide completo y por tandas de
    // 1.000 (Supabase corta cada consulta en 1.000 filas), solo al exportar.
    notificar('Preparando el Excel...', 'info');
    let ventasDashboard = [];
    try {
      if (esModoDemo) {
        const ini = new Date(`${fechaInicioDash}T00:00:00`);
        const fin = new Date(`${fechaFinDash}T23:59:59.999`);
        ventasDashboard = ventasDemoRef.current.filter((v) => { const f = new Date(v.fecha_hora); return f >= ini && f <= fin; });
      } else {
        const TAM = 1000;
        for (let desdeFila = 0; ; desdeFila += TAM) {
          const { data, error } = await sbClient
            .from('ventas')
            .select('*, ventas_detalle(*)')
            .eq('bodega_id', bodegaId)
            .gte('fecha_hora', new Date(`${fechaInicioDash}T00:00:00`).toISOString())
            .lte('fecha_hora', new Date(`${fechaFinDash}T23:59:59.999`).toISOString())
            .order('fecha_hora', { ascending: true })
            .order('id', { ascending: true })
            .range(desdeFila, desdeFila + TAM - 1);
          if (error) throw error;
          ventasDashboard.push(...(data || []));
          if (!data || data.length < TAM) break;
        }
      }
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo preparar el Excel'), 'error');
      return;
    }
    const libro = XLSX.utils.book_new();

    const hojaResumen = XLSX.utils.json_to_sheet([{
      'Desde': fechaInicioDash,
      'Hasta': fechaFinDash,
      'Venta Total': dashStats.totalVenta,
      'Utilidad': dashStats.totalUtilidad,
      'Costo': dashStats.totalCosto,
      'Margen %': +dashStats.margenPct.toFixed(1),
      'Ticket Promedio': +dashStats.ticketPromedio.toFixed(2),
      'N° de Ventas': dashStats.numVentas,
      'Cambio Venta vs Período Anterior %': +dashStats.cambioVentaPct.toFixed(1),
      'Cambio Utilidad vs Período Anterior %': +dashStats.cambioUtilidadPct.toFixed(1)
    }]);
    XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');

    const hojaHoras = XLSX.utils.json_to_sheet(
      dashStats.porHora.map((h) => ({ Hora: `${String(h.hora).padStart(2, '0')}:00`, 'N° Ventas': h.cantidad, Total: h.total }))
    );
    XLSX.utils.book_append_sheet(libro, hojaHoras, 'Ventas por Hora');

    const hojaDias = XLSX.utils.json_to_sheet(
      dashStats.porDia.map((d) => ({ Fecha: d.fecha, Total: d.total }))
    );
    XLSX.utils.book_append_sheet(libro, hojaDias, 'Ventas por Dia');

    const hojaMedios = XLSX.utils.json_to_sheet(
      dashStats.porMedio.map((m) => ({ 'Medio de pago': m.medio, 'Porcentaje': +m.pct.toFixed(1), Total: m.total }))
    );
    XLSX.utils.book_append_sheet(libro, hojaMedios, 'Métodos de pago');

    const hojaProductos = XLSX.utils.json_to_sheet(
      dashStats.topProductos.map((p) => ({ Producto: p.descripcion, Cantidad: p.cantidad, Monto: p.monto, Utilidad: p.utilidad }))
    );
    XLSX.utils.book_append_sheet(libro, hojaProductos, 'Top Productos');

    const hojaCobrar = XLSX.utils.json_to_sheet(
      clientesDeuda.length > 0
        ? clientesDeuda.map((c) => ({ Cliente: c.nombre_completo || c.dni, DNI: c.dni, 'Deuda': Number(c.saldo_actual) }))
        : [{ Cliente: 'Sin clientes con deuda pendiente', DNI: '', Deuda: 0 }]
    );
    XLSX.utils.book_append_sheet(libro, hojaCobrar, 'Fiados');

    const hojaPagar = XLSX.utils.json_to_sheet(
      proveedoresDeudaDash.length > 0
        ? proveedoresDeudaDash.map((p) => ({ Proveedor: p.nombre, 'Por Pagar': Number(p.saldo_actual) }))
        : [{ Proveedor: 'Sin deuda con proveedores', 'Por Pagar': 0 }]
    );
    XLSX.utils.book_append_sheet(libro, hojaPagar, 'Cuentas por Pagar');

    // Detalle de cada venta del período: una fila POR PRODUCTO vendido
    // (no por boleta), para que Subtotal/Unidades sean del producto de
    // esa fila y no de la venta completa.
    const filasDetalle = [];
    ventasDashboard.forEach((v) => {
      const detalles = v.ventas_detalle || [];
      const base = {
        Boleta: v.nro_boleta,
        'Fecha y Hora': new Date(v.fecha_hora).toLocaleString('es-PE'),
        'Medio de pago': v.medio_pago,
        Estado: v.anulada ? 'Anulada' : 'Válida'
      };
      if (detalles.length === 0) {
        filasDetalle.push({ ...base, Producto: '', Unidades: 0, 'Precio Unitario': 0, Subtotal: Number(v.total_venta), Utilidad: Number(v.utilidad_total || 0) });
        return;
      }
      detalles.forEach((d) => {
        filasDetalle.push({
          ...base,
          Producto: d.descripcion,
          Unidades: Number(d.cantidad),
          'Precio Unitario': Number(d.precio_unitario),
          Subtotal: Number(d.subtotal),
          Utilidad: Number(d.utilidad || 0)
        });
      });
    });
    const hojaDetalle = XLSX.utils.json_to_sheet(filasDetalle);
    XLSX.utils.book_append_sheet(libro, hojaDetalle, 'Detalle de Ventas');

    XLSX.writeFile(libro, `Dashboard_${fechaInicioDash}_a_${fechaFinDash}.xlsx`);
  };

  const exportarVentasExcel = () => {
    const filas = ventasDelDia.map((v) => ({
      Boleta: v.nro_boleta,
      Fecha: new Date(v.fecha_hora).toLocaleString('es-PE'),
      Cliente: v.clientes?.nombre_completo || 'Desconocido',
      'Medio de pago': v.medio_pago,
      Total: Number(v.total_venta),
      Utilidad: Number(v.utilidad_total || 0),
      Estado: v.anulada ? 'Anulada' : 'Válida'
    }));
    exportarExcel(`Ventas_${fechaInicioHistorial}_a_${fechaFinHistorial}.xlsx`, filas, 'Ventas');
  };

  const anularVentaHoy = async (venta) => {
    if (venta.anulada) return;
    const ok = await pedirConfirmacion({
      titulo: 'Anular boleta',
      mensaje: `¿Estás seguro de ANULAR la boleta ${venta.nro_boleta}? Esta acción no se puede deshacer.`,
      textoBoton: 'Sí, anular',
      peligroso: true
    });
    if (!ok) return;

    const motivoIngresado = await pedirTexto({
      titulo: 'Motivo de la anulación',
      mensaje: 'Opcional.',
      placeholder: 'Ej: Cliente se arrepintió',
      textoBoton: 'Anular boleta'
    });
    const motivo = (motivoIngresado || '').trim() || 'Sin motivo especificado';

    try {
      if (esModoDemo) {
        // Todo en memoria, igual que el resto del Modo Demo: nada de esto
        // debe tocar Supabase de verdad.
        if (venta.medio_pago === 'CREDITO' && venta.cliente_id) {
          setClientesLista((prev) => prev.map((c) => (c.id === venta.cliente_id
            ? { ...c, saldo_actual: Math.max(0, (Number(c.saldo_actual) || 0) - Number(venta.total_venta)) }
            : c)));
          if (clienteActual?.id === venta.cliente_id) {
            setClienteActual((prev) => (prev ? { ...prev, saldo_actual: Math.max(0, (Number(prev.saldo_actual) || 0) - Number(venta.total_venta)) } : prev));
          }
        }
        if (catalogoDemoRef.current) {
          const repuestoPorId = new Map((venta.ventas_detalle || [])
            .filter((d) => d.producto_id)
            .map((d) => [d.producto_id, Number(d.unidades_stock ?? d.cantidad)]));
          catalogoDemoRef.current = catalogoDemoRef.current.map((p) => (repuestoPorId.has(p.id)
            ? { ...p, stock_actual: (Number(p.stock_actual) || 0) + repuestoPorId.get(p.id) }
            : p));
        }
        ventasDemoRef.current = ventasDemoRef.current.map((v) => (v.id === venta.id ? { ...v, anulada: true, motivo_anulacion: motivo } : v));
      } else if (sbClient) {
        // Camino nuevo: boleta + deuda + stock en UNA transacción
        // (anular_venta, ver anular_venta_atomica.sql). Si la función aún no
        // existe en Supabase, sigue el camino de siempre (paso a paso).
        const { data: anulada, error: errAnulada } = await sbClient.rpc('anular_venta', {
          p_venta_id: String(venta.id),
          p_motivo: motivo
        });
        const faltaAnular = !!errAnulada && (errAnulada.code === 'PGRST202' || /could not find the function/i.test(errAnulada.message || ''));
        if (errAnulada && !faltaAnular) throw errAnulada;
        if (!errAnulada && anulada?.ya_anulada) {
          notificar(`La boleta ${venta.nro_boleta} ya estaba anulada.`, 'info');
        }
        if (faltaAnular) {
        // Si la venta era a crédito, revertir la deuda del cliente antes de anular
        // (ajuste atómico: no se pisa con otra venta/pago simultáneo al mismo cliente).
        if (venta.medio_pago === 'CREDITO' && venta.cliente_id) {
          const { error: errSaldo } = await sbClient.rpc('ajustar_saldo_cliente', {
            p_cliente_id: venta.cliente_id,
            p_delta: -Number(venta.total_venta)
          });
          if (errSaldo) throw new Error('No se pudo revertir la deuda del cliente.');
        }

        // Soft-delete: se marca como anulada en vez de borrarla, para conservar el historial
        const { error: errAnular } = await sbClient
          .from('ventas')
          .update({ anulada: true, motivo_anulacion: motivo })
          .eq('id', venta.id);
        if (errAnular) throw errAnular;

        // Reponer el stock de los productos de esta venta (ajuste atómico).
        // Usa unidades_stock (lo que de verdad se descontó, en unidades
        // base) en vez de "cantidad" -- si la línea era un pack, cantidad
        // son packs, no unidades. Si es una venta vieja sin esa columna
        // (previa a esta función), cae de vuelta a cantidad.
        await Promise.all((venta.ventas_detalle || [])
          .filter((d) => d.producto_id)
          .map((d) => sbClient.rpc('ajustar_stock', { p_producto_id: d.producto_id, p_delta: Number(d.unidades_stock ?? d.cantidad) }))
        );
        }
      }
      setVentasDelDia(prev => prev.map(v => v.id === venta.id ? { ...v, anulada: true, motivo_anulacion: motivo } : v));
      cargarProductos(busqueda); // refresca el stock repuesto en el catálogo
      notificar(`Boleta ${venta.nro_boleta} anulada correctamente.`, 'info');
    } catch (err) {
      notificar(mensajeError(err, 'Error al anular'), 'error');
    }
  };

  return {
    abrirDashboard, anularVentaHoy, cargarDashboard, dashStats, exportarDashboardExcel,
    exportarVentasExcel
  };
}
