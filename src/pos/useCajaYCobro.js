// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { efectivoEntrante, desgloseMediosPago, totalConteo, diferenciaArqueo } from '../lib/arqueo.js';
import { useEffect } from 'react';
import { mensajeError, generarUUID, asegurarJsPDF, formatoFechaHoraBoleta } from './utilidades.js';
import { fechaHoyISO, fechaISOLocal } from '../PanelAdminCompartido.jsx';
import { antiguedadTurno } from '../lib/turnos.js';
import { reportarFallo } from '../monitoreo.js';
import { detalleComboTicket } from '../lib/combos.js';

export default function useCajaYCobro({
  arqueoEsperado, avisoTurnoViejo, barberoVentaId, bodegaDireccion, bodegaId, bodegaNombre,
  bodegaTelefono, busqueda, cajeroSeleccionado, cargarProductos, carrito, catalogoDemoRef,
  cierreAlRetomar, clienteActual, efectivoRequeridoMixto, enLinea, esBarberia, esModoDemo,
  expandirLineaCarrito, guardarVentasPendientesLS, intentoVentaRef, listaCajeros, medioPago,
  modalTurno, montoApertura, montoConteoEfectivo, montoDescuento, montoMixtoOtro,
  montoMixtoRecibido, montoRecibido, notificar, pedidosCargadosAlCarrito, pedirConfirmacion,
  refrescarProductosPorId, registrarVentaAtomica, reiniciarClienteYMedioPago, sbClient,
  sesion, setArqueoEsperado, setAtajoCierres, setAvisoTurnoViejo, setBarberoVentaId,
  setCajasAbiertasAviso, setCajeroSeleccionado, setCampoTeclado, setCargandoCierres,
  setCarrito, setCierreAlRetomar, setCierreDetalle, setCierresCaja, setClienteActual,
  setClientesLista, setConteoAbierto, setConteoEfectivo, setDescuentoTipo, setDescuentoValor,
  setFechaFinCierres, setFechaInicioCierres, setModalCierreCaja, setModalHistorialCierres,
  setModalNuevoCliente, setModalTurno, setMontoConteoEfectivo, setMontoMixtoOtro,
  setMontoMixtoRecibido, setMontoRecibido, setMostrarPago, setMostrarResumenMobile,
  setPedidosCargadosAlCarrito, setPedidosRetirar, setProcesandoVenta, setProductos,
  setResumenCierre, setSoloConDiferenciaCierres, setTurnoActivo, setUltimoCierre,
  setVentaCompletada, totalConDescuento, totalVenta, turnoActivo, usuarioActivo,
  ventasDemoRef, ventasPendientesSync, verificarSesionVigente
}) {
  // ==========================================
  // ARQUEO Y CIERRE DE CAJA
  // ==========================================
  // Las ventas anuladas no cuentan: ese dinero no entró (o se devolvió).
  // Efectivo que entró en el turno: ventas 100% en efectivo + la parte
  // en efectivo de las ventas Mixtas (ese dinero también entra
  // físicamente a la caja). Se reutiliza al abrir el modal (para
  // mostrar cuánto debería haber antes de contar) y al confirmar el
  // cierre (para el cálculo final, con los datos más frescos).
  const calcularVentasEfectivoTurno = async () => {
    if (!turnoActivo) return 0;
    const vts = esModoDemo
      ? ventasDemoRef.current.filter((v) => v.turno_caja_id === turnoActivo.id && !v.anulada && ['EFECTIVO', 'MIXTO'].includes(v.medio_pago))
      : (sbClient ? (await sbClient
          .from('ventas')
          .select('total_venta, medio_pago, monto_efectivo')
          .eq('turno_caja_id', turnoActivo.id)
          .eq('anulada', false)
          .in('medio_pago', ['EFECTIVO', 'MIXTO'])).data : null);

    return efectivoEntrante(vts);
  };

  // Solo informativo para el arqueo: cuánto se vendió en cada medio que
  // NO es efectivo, para que el cajero pueda cruzarlo contra su POS de
  // tarjeta, Yape, etc. -- no afecta el cálculo de "cuánto debería haber
  // en la caja física", que sigue siendo solo efectivo.
  const calcularDesgloseMedioPagoTurno = async () => {
    if (!turnoActivo) return null;
    const vts = esModoDemo
      ? ventasDemoRef.current.filter((v) => v.turno_caja_id === turnoActivo.id && !v.anulada)
      : (sbClient ? (await sbClient
          .from('ventas')
          .select('total_venta, medio_pago, monto_otro')
          .eq('turno_caja_id', turnoActivo.id)
          .eq('anulada', false)).data : null);

    return desgloseMediosPago(vts);
  };

  // Cambia el conteo de billetes y monedas y deja el total en el campo de
  // monto (el de apertura o el del cierre, según `setMonto`).
  const cambiarConteo = (nuevo, setMonto) => {
    setConteoEfectivo(nuevo);
    const total = totalConteo(nuevo);
    setMonto(total > 0 ? String(total) : '');
  };

  // Cuántas ventas lleva el turno y cuánto se vendió en total (todos los
  // medios de pago) -- solo para mostrar en el cierre.
  const calcularResumenVentasTurno = async () => {
    if (!turnoActivo) return { n: 0, total: 0 };
    const vts = esModoDemo
      ? ventasDemoRef.current.filter((v) => v.turno_caja_id === turnoActivo.id && !v.anulada)
      : (sbClient ? (await sbClient
          .from('ventas')
          .select('total_venta')
          .eq('turno_caja_id', turnoActivo.id)
          .eq('anulada', false)).data : null);
    const lista = Array.isArray(vts) ? vts : [];
    return { n: lista.length, total: lista.reduce((acc, v) => acc + (Number(v.total_venta) || 0), 0) };
  };

  // Abre el modal de cierre ya mostrando cuánto debería haber en caja,
  // para que el cajero sepa qué buscar antes de contar el efectivo.
  const abrirCierreCaja = async () => {
    setModalCierreCaja(true);
    setMontoConteoEfectivo('');
    setConteoEfectivo({});
    setConteoAbierto(false);
    setArqueoEsperado(null);
    if (!turnoActivo) return;
    const montoIni = Number(turnoActivo.monto_inicial) || 0;
    const [ventasEfectivo, desglose, resumenVentas] = await Promise.all([
      calcularVentasEfectivoTurno(),
      calcularDesgloseMedioPagoTurno(),
      calcularResumenVentasTurno()
    ]);
    setArqueoEsperado({
      inicio: montoIni,
      ventas: ventasEfectivo,
      esperado: +(montoIni + ventasEfectivo).toFixed(2),
      desglose,
      cantidadVentas: resumenVentas.n,
      totalVendido: resumenVentas.total
    });
  };

  // Al abrir el modal de apertura: conteo en blanco y, si hay, el monto
  // con el que se cerró la última caja (atajo "lo que quedó al cerrar").
  useEffect(() => {
    if (!modalTurno) return undefined;
    setConteoEfectivo({});
    setConteoAbierto(false);
    if (esModoDemo || !sbClient || !bodegaId) { setUltimoCierre(null); return undefined; }
    let vigente = true;
    (async () => {
      try {
        const { data } = await sbClient
          .from('turnos_caja')
          .select('monto_final_real, fecha_cierre')
          .eq('bodega_id', bodegaId)
          .not('fecha_cierre', 'is', null)
          .order('fecha_cierre', { ascending: false })
          .limit(1);
        const t = data && data[0];
        if (vigente) setUltimoCierre(t && t.monto_final_real !== null && t.monto_final_real !== undefined ? { monto: Number(t.monto_final_real), fecha: t.fecha_cierre } : null);
      } catch (err) {
        if (vigente) setUltimoCierre(null);
      }
    })();
    return () => { vigente = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalTurno]);

  useEffect(() => {
    if (cierreAlRetomar && turnoActivo) {
      setCierreAlRetomar(false);
      abrirCierreCaja();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cierreAlRetomar, turnoActivo]);

  // Si lo contado no coincide con lo esperado, pide confirmar antes de
  // cerrar (la diferencia queda registrada en el historial de cierres).
  const confirmarCierreConArqueo = async () => {
    if (arqueoEsperado) {
      const dif = diferenciaArqueo(montoConteoEfectivo, arqueoEsperado.esperado);
      if (dif !== 0) {
        const ok = await pedirConfirmacion({
          titulo: `${dif > 0 ? 'Sobran' : 'Faltan'} S/ ${Math.abs(dif).toFixed(2)}: ¿cerrar igual?`,
          mensaje: `Debería haber S/ ${arqueoEsperado.esperado.toFixed(2)} y contaste S/ ${(parseFloat(montoConteoEfectivo) || 0).toFixed(2)}. Al cerrar, la diferencia queda registrada en el historial de cierres.`,
          textoBoton: 'Cerrar de todos modos',
          peligroso: true
        });
        if (!ok) return;
      }
    }
    handleCierreConArqueo();
  };

  const handleCierreConArqueo = async () => {
    if (!turnoActivo) return;
    const montoReal = parseFloat(montoConteoEfectivo) || 0;
    const montoIni = Number(turnoActivo.monto_inicial) || 0;
    const [ventasEfectivo, desglose] = await Promise.all([
      calcularVentasEfectivoTurno(),
      calcularDesgloseMedioPagoTurno()
    ]);
    const esperado = +(montoIni + ventasEfectivo).toFixed(2);
    const dif = diferenciaArqueo(montoReal, esperado);

    if (sbClient && !esModoDemo) {
      try {
        const { error } = await sbClient
          .from('turnos_caja')
          .update({
            fecha_cierre: new Date().toISOString(),
            monto_final_real: montoReal,
            ventas_sistema: ventasEfectivo,
            diferencia: dif,
            estado: 'CERRADA'
          })
          .eq('id', turnoActivo.id);
        if (error) {
          console.warn('Error al cerrar el turno en la base de datos:', error);
          notificar(`El cierre se calculó bien, pero no se guardó en el servidor. Avisa al soporte.`, 'error');
        }
      } catch (err) {
        console.error(err);
      }
    }

    setResumenCierre({
      inicio: montoIni,
      ventas: ventasEfectivo,
      esperado,
      real: montoReal,
      diferencia: dif,
      desglose,
      cajero: turnoActivo.cajeros?.nombre || cajeroSeleccionado?.nombre || '',
      cerradoEn: new Date().toISOString()
    });

    setModalCierreCaja(false);
    setTurnoActivo(null);
    setMontoConteoEfectivo('');
    setConteoEfectivo({});
  };

  // Historial de turnos ya cerrados (arqueos pasados).
  const cargarHistorialCierresPorRango = async (desde, hasta) => {
    if (!sbClient || !bodegaId) return;
    setCargandoCierres(true);
    try {
      const inicio = new Date(`${desde}T00:00:00`);
      const fin = new Date(`${hasta}T23:59:59.999`);
      const { data, error } = await sbClient
        .from('turnos_caja')
        .select('*, cajeros(nombre)')
        .eq('bodega_id', bodegaId)
        .not('fecha_cierre', 'is', null)
        .gte('fecha_cierre', inicio.toISOString())
        .lte('fecha_cierre', fin.toISOString())
        .order('fecha_cierre', { ascending: false })
        .limit(200);
      if (error) throw error;
      setCierresCaja(data || []);
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo cargar el historial de cierres'), 'error');
    } finally {
      setCargandoCierres(false);
    }
  };

  const abrirHistorialCierres = () => {
    const hoy = fechaHoyISO();
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 29);
    const desde = fechaISOLocal(hace30dias);
    setFechaInicioCierres(desde);
    setFechaFinCierres(hoy);
    setAtajoCierres('30dias');
    setSoloConDiferenciaCierres(false);
    setCierreDetalle(null);
    setModalHistorialCierres(true);
    cargarHistorialCierresPorRango(desde, hoy);
  };

  // Atajos de fecha del historial de cierres: Hoy, 7 días, 30 días o fechas a elección.
  const elegirAtajoCierres = (id) => {
    setAtajoCierres(id);
    setCierreDetalle(null);
    if (id === 'fechas') return;
    const hoy = new Date();
    const hasta = fechaISOLocal(hoy);
    const atras = new Date(hoy);
    atras.setDate(atras.getDate() - (id === 'hoy' ? 0 : id === '7dias' ? 6 : 29));
    const desde = fechaISOLocal(atras);
    setFechaInicioCierres(desde);
    setFechaFinCierres(hasta);
    cargarHistorialCierresPorRango(desde, hasta);
  };

  // Turno activo check -- cada cajero puede tener su propia caja
  // abierta (varias registradoras a la vez en la misma bodega). Como
  // todos los dispositivos entran con el mismo usuario/login (el
  // dueño), el cajero que se autoselecciona por DNI no necesariamente
  // es quien de verdad va a operar ESTE dispositivo -- así que, apenas
  // hay alguna caja abierta (sea "la mía" u otra), se muestra siempre
  // la misma lista para elegir con cuál trabajar, en vez de engancharse
  // en silencio a una de ellas.
  // Consulta de turnos abiertos de la bodega. Se puede lanzar antes de saber quién es el
  // cajero (en el arranque va en paralelo con los demás datos) y pasarla a verificarTurno.
  const consultarTurnosAbiertos = () => Promise.resolve(
    sbClient
      .from('turnos_caja')
      .select('*, cajeros(id, bodega_id, nombre, dni, rol, activo)')
      .eq('bodega_id', bodegaId)
      .is('fecha_cierre', null)
      .order('fecha_apertura', { ascending: false })
  );

  const verificarTurno = async (cajeroActual, consultaPrevia = null) => {
    if (!sbClient || !bodegaId || esModoDemo) return;
    try {
      const { data: abiertas } = await (consultaPrevia || consultarTurnosAbiertos());

      // Mi propia caja (del cajero de este dispositivo), si es de hoy y es
      // la única mía: se retoma sola. Sin esto, tras recargar la página
      // el botón decía "Abrir Turno" aunque la caja seguía abierta.
      const propias = (abiertas || []).filter((t) => cajeroActual?.id && t.cajero_id === cajeroActual.id);
      if (propias.length === 1 && !antiguedadTurno(propias[0].fecha_apertura).antiguo) {
        const mia = propias[0];
        setTurnoActivo((previo) => previo || mia);
        if (mia.cajeros) setCajeroSeleccionado((previo) => previo || mia.cajeros);
        if (abiertas.length === 1) return;
      }

      if (abiertas && abiertas.length > 0) {
        // Se avisa una vez por combinación exacta de cajas abiertas
        // (guardado en sessionStorage) -- no en cada recarga de la
        // página, pero si la lista cambia (se abrió o cerró alguna)
        // se vuelve a avisar.
        const claveAviso = `pos_cajas_avisadas_${abiertas.map((t) => t.id).sort().join('-')}`;
        let yaAvisado = false;
        try { yaAvisado = sessionStorage.getItem(claveAviso) === '1'; } catch (e) { /* ignorar */ }
        if (!yaAvisado) {
          try { sessionStorage.setItem(claveAviso, '1'); } catch (e) { /* ignorar */ }
          // Se marca cuál es "la mía" (según el cajero autoseleccionado
          // por DNI) solo para destacarla en la lista -- no cambia qué
          // se puede hacer con ella, sigue siendo una opción más.
          setCajasAbiertasAviso(abiertas.map((t) => ({ ...t, es_propia: t.cajero_id === cajeroActual?.id })));
        }
      }
    } catch (err) {
      console.warn(err);
    }
  };

  // Este dispositivo se suma a una caja que ya abrió otro cajero: pasa
  // a operar con ese mismo cajero (no tiene sentido vender bajo otra
  // identidad en una caja que no es la suya).
  const unirseACaja = (turno) => {
    setTurnoActivo(turno);
    if (turno.cajeros) setCajeroSeleccionado(turno.cajeros);
    setCajasAbiertasAviso(null);
  };

  // En vez de sumarse a una caja existente, este dispositivo abre la
  // suya propia -- reutiliza el modal normal de "Abrir Turno" (ahí se
  // elige o se agrega el cajero).
  const abrirCajaNueva = () => {
    setCajasAbiertasAviso(null);
    setModalTurno(true);
  };

  // Caja antigua: retomarla (y cerrarla de una vez si se pide) o seguir con ella.
  const retomarTurnoViejo = (cerrar) => {
    const t = avisoTurnoViejo;
    if (!t) return;
    setTurnoActivo(t);
    if (t.cajeros) setCajeroSeleccionado(t.cajeros);
    setAvisoTurnoViejo(null);
    if (cerrar) setCierreAlRetomar(true);
  };

  // Abrir turno
  const handleAbrirTurno = async () => {
    const monto = parseFloat(montoApertura) || 0;
    const cajeroFinal = cajeroSeleccionado || listaCajeros[0];

    if (!cajeroFinal || !cajeroFinal.id) {
      notificar('Selecciona un cajero.', 'error');
      return;
    }

    // Modo Demo Local: la bodega no existe de verdad en Supabase, así
    // que ni siquiera se intenta la red -- se abre el turno directo en
    // memoria, igual que cualquier otro cambio de la demo.
    if (esModoDemo) {
      setTurnoActivo({ id: generarUUID(), bodega_id: bodegaId, cajero_id: cajeroFinal.id, monto_inicial: monto, estado: 'ABIERTA', fecha_apertura: new Date().toISOString() });
      setModalTurno(false);
      notificar(`Turno abierto con: ${cajeroFinal.nombre}`, 'success');
      return;
    }

    if (sbClient) {
      try {
        // Revisa primero si este MISMO cajero ya tiene una caja abierta
        // (ej. otro dispositivo suyo hace un instante) -- el índice
        // único en la base de datos (por bodega + cajero) es la
        // garantía real por si igual se cruzan. Esto ya no bloquea que
        // OTROS cajeros tengan su propia caja abierta en paralelo.
        const { data: yaAbierto } = await sbClient
          .from('turnos_caja')
          .select('*')
          .eq('bodega_id', bodegaId)
          .eq('cajero_id', cajeroFinal.id)
          .is('fecha_cierre', null)
          .maybeSingle();
        if (yaAbierto) {
          setModalTurno(false);
          const edad = antiguedadTurno(yaAbierto.fecha_apertura);
          if (edad.antiguo) {
            setAvisoTurnoViejo(yaAbierto);
            return;
          }
          setTurnoActivo(yaAbierto);
          notificar(`Ya tenías una caja abierta ${edad.etiqueta}: se retomó esa en vez de abrir otra.`, 'info');
          return;
        }

        let { data, error } = await sbClient
          .from('turnos_caja')
          .insert([{
            bodega_id: bodegaId,
            cajero_id: cajeroFinal.id,
            monto_inicial: monto,
            fecha_apertura: new Date().toISOString(),
            ventas_sistema: 0.00,
            estado: 'ABIERTA'
          }])
          .select()
          .single();

        if (data) {
          setTurnoActivo(data);
          setModalTurno(false);
          notificar(`Turno abierto con: ${cajeroFinal.nombre}`, 'success');
          return;
        }

        // Código 23505 = violación del índice único "una sola caja
        // abierta a la vez por cajero": otro dispositivo la abrió para
        // este mismo cajero en el mismo instante. Se adopta esa caja
        // en vez de fallar.
        if (error?.code === '23505') {
          const { data: turnoDeOtro } = await sbClient
            .from('turnos_caja')
            .select('*')
            .eq('bodega_id', bodegaId)
            .eq('cajero_id', cajeroFinal.id)
            .is('fecha_cierre', null)
            .maybeSingle();
          if (turnoDeOtro) {
            setTurnoActivo(turnoDeOtro);
            setModalTurno(false);
            return;
          }
        }

        // Si falló por una razón real estando en línea (no por estar
        // offline), NO se sigue con un turno fantasma que solo existe en
        // este dispositivo -- las ventas de ese turno quedarían
        // referenciando un turno_caja_id que no existe en la base. Se
        // corta acá y se deja reintentar.
        if (error && enLinea) {
          console.warn('Error al abrir turno en la base de datos:', error);
          reportarFallo('abrir turno', error);
          // Un rechazo por permisos casi siempre es una sesión vencida: se
          // revisa y, si es eso, se manda a ingresar de nuevo.
          if (error.code === '42501' && !(await verificarSesionVigente())) return;
          notificar(`No se pudo abrir el turno en el servidor. Intenta de nuevo.`, 'error');
          return;
        }
        if (error) {
          notificar('Sin conexión: el turno se abrió localmente y se sincroniza cuando vuelva el internet.', 'info');
        } else {
          notificar('Turno abierto.', 'info');
        }
      } catch (err) {
        console.warn(err);
        reportarFallo('abrir turno', err);
        if (enLinea) {
          notificar('No se pudo abrir el turno (error de conexión con el servidor). Intenta de nuevo.', 'error');
          return;
        }
      }
    }

    setTurnoActivo({ id: generarUUID(), bodega_id: bodegaId, cajero_id: cajeroFinal.id, monto_inicial: monto, estado: 'ABIERTA', fecha_apertura: new Date().toISOString() });
    setModalTurno(false);
  };

  // Cobrar venta
  const handleCobrar = async () => {
    if (carrito.length === 0) {
      notificar('El carrito está vacío.', 'error');
      return;
    }
    if (medioPago === 'EFECTIVO' && montoRecibido && parseFloat(montoRecibido) < totalConDescuento) {
      notificar('Monto recibido insuficiente.', 'error');
      return;
    }
    // Barbería: cada cobro lleva el barbero que atendió (de él sale la comisión).
    if (esBarberia && !esModoDemo && !barberoVentaId) {
      notificar('Elige el barbero que atendió antes de cobrar.', 'error');
      return;
    }

    // Validación de crédito: Saldo actual + Venta <= Límite
    if (medioPago === 'CREDITO') {
      if (!clienteActual || clienteActual.dni === '99999999') {
        notificar('Para vender a crédito debes seleccionar un cliente registrado.', 'error');
        setModalNuevoCliente(true);
        return;
      }
      const limiteCred = Number(clienteActual.limite_credito) || 0;
      // `clienteActual.saldo_actual` puede estar desactualizado si otro
      // dispositivo/cajero le vendió a este mismo cliente hace un
      // momento -- se vuelve a leer justo antes de cobrar para no
      // aprobar una venta contra un saldo viejo.
      let saldoAct = Number(clienteActual.saldo_actual) || 0;
      if (sbClient && !esModoDemo) {
        const { data: clienteFresco, error: errClienteFresco } = await sbClient
          .from('clientes')
          .select('saldo_actual')
          .eq('id', clienteActual.id)
          .maybeSingle();
        if (!errClienteFresco && clienteFresco) {
          saldoAct = Number(clienteFresco.saldo_actual) || 0;
        }
      }
      const nuevoSaldoProyectado = +(saldoAct + totalConDescuento).toFixed(2);
      if (nuevoSaldoProyectado > limiteCred) {
        const disponible = Math.max(0, +(limiteCred - saldoAct).toFixed(2));
        notificar(`Límite de crédito excedido. Disponible: S/ ${disponible.toFixed(2)} de S/ ${limiteCred.toFixed(2)}.`, 'error');
        return;
      }
    }

    // Validación de pago mixto: el efectivo entregado debe alcanzar para cubrir
    // lo que no se pagó con tarjeta/otro (el vuelto se calcula, no se exige exacto).
    let montoEfectivoMixto = 0;
    let montoOtroMixto = 0;
    if (medioPago === 'MIXTO') {
      montoOtroMixto = Math.min(parseFloat(montoMixtoOtro) || 0, totalConDescuento);
      montoEfectivoMixto = efectivoRequeridoMixto;
      const recibidoMixto = parseFloat(montoMixtoRecibido) || 0;
      if (montoEfectivoMixto > 0 && recibidoMixto < montoEfectivoMixto) {
        notificar(`Falta efectivo: debes recibir al menos S/ ${montoEfectivoMixto.toFixed(2)} en efectivo.`, 'error');
        return;
      }
    }

    setProcesandoVenta(true);
    // Número de boleta correlativo por bodega (siguiente_correlativo, ver
    // concurrencia_ronda2.sql): no se repite aunque dos cajeros cobren a
    // la vez. Si no hay conexión, la función no existe todavía o tarda más
    // de 3 segundos, se usa el número por hora de siempre.
    // La serie es propia de cada bodega (ver serie_boleta_por_bodega.sql)
    // para que dos bodegas distintas no emitan boletas que se vean
    // idénticas -- "B001" queda solo como respaldo si la bodega todavía
    // no tiene serie_boleta cargada (sesión vieja en caché, por ejemplo).
    const serieBoleta = (sesion?.bodega?.serie_boleta || 'B001').toUpperCase();
    let correlativo = `${serieBoleta}-${String(Date.now()).slice(-8)}`;
    if (sbClient && !esModoDemo && enLinea) {
      try {
        const respuestaCorrelativo = await Promise.race([
          sbClient.rpc('siguiente_correlativo', { p_serie: serieBoleta }),
          new Promise((resolver) => setTimeout(() => resolver(null), 3000)),
        ]);
        if (respuestaCorrelativo && !respuestaCorrelativo.error && respuestaCorrelativo.data) {
          correlativo = respuestaCorrelativo.data;
        }
      } catch {
        // se queda con el número por hora
      }
    }

    let seVendioOffline = false;
    // Boleta con la que quedó guardada la venta (si la venta ya existía por un
    // reintento, es la de la primera vez).
    let boletaFinal = correlativo;

    try {
      if (sbClient) {
        const idTurnoReal = turnoActivo?.id;
        const cajeroFinal = cajeroSeleccionado || listaCajeros[0];

        let idClienteReal = clienteActual?.id;
        const utilidadBruta = carrito.reduce((acc, item) => {
          const costoTotal = (Number(item.precioCosto) || 0) * Number(item.cantidad);
          return acc + (Number(item.subtotal) - costoTotal);
        }, 0);
        // El descuento sale directo de la ganancia: la utilidad real de la
        // venta es la bruta menos lo que se rebajó.
        const utilidadTotal = utilidadBruta - montoDescuento;
        const payloadVenta = {
          bodega_id: bodegaId,
          turno_caja_id: idTurnoReal || null,
          cajero_id: cajeroFinal?.id,
          cliente_id: idClienteReal || null,
          nro_boleta: correlativo,
          medio_pago: medioPago,
          total_venta: totalConDescuento,
          descuento_monto: montoDescuento,
          utilidad_total: +utilidadTotal.toFixed(2),
          monto_efectivo: medioPago === 'MIXTO' ? montoEfectivoMixto : 0,
          monto_otro: medioPago === 'MIXTO' ? montoOtroMixto : 0,
          // Solo barbería (ventas.barbero_id, ver barbero_en_ventas.sql).
          ...(esBarberia && barberoVentaId ? { barbero_id: barberoVentaId } : {})
        };

        // Un combo es UNA línea en el carrito pero se cobra/descuenta como
        // varias -- lineasCheckout ya viene "aplanada" a líneas reales
        // por producto (ver expandirLineaCarrito), así que todo lo de
        // abajo (detalle de venta, ajuste de stock) no necesita saber
        // que los combos existen.
        const lineasCheckout = carrito.flatMap(expandirLineaCarrito);

        const payloadDetallesSinVentaId = lineasCheckout.map(item => {
          const costoTotal = (Number(item.precioCosto) || 0) * Number(item.cantidad);
          return {
            bodega_id: bodegaId,
            producto_id: typeof item.productoId === 'string' && item.productoId.length > 10 ? item.productoId : null,
            combo_id: item.comboId || null,
            cod_ean: item.cod_ean || '',
            descripcion: item.descripcion || '',
            cantidad: Number(item.cantidad),
            precio_unitario: Number(item.precioUnitario),
            precio_costo: Number(item.precioCosto) || 0,
            subtotal: Number(item.subtotal),
            utilidad: +(Number(item.subtotal) - costoTotal).toFixed(2),
            // Unidades base descontadas de stock por esta línea (si se
            // vendió por pack, son más que "cantidad"). Se guarda tal
            // cual para poder revertirlo bien al anular, aunque después
            // cambie la configuración de pack del producto.
            unidades_stock: Number(item.unidadesStock || item.cantidad)
          };
        });

        const ajustesStock = lineasCheckout
          .filter(item => typeof item.productoId === 'string' && item.productoId.length > 10)
          .map(item => ({ productoId: item.productoId, delta: -Number(item.unidadesStock || item.cantidad) }));

        if (esModoDemo) {
          // ------------------------------------------------------------
          // MODO DEMO LOCAL: la bodega no existe de verdad en Supabase,
          // así que no se intenta la red -- se aplica todo en memoria
          // (catálogo demo, cliente, y el registro de la venta para que
          // el arqueo de "Cerrar Caja" la pueda contar).
          // ------------------------------------------------------------
          ventasDemoRef.current = [...ventasDemoRef.current, {
            id: `demo-${Date.now()}`,
            fecha_hora: new Date().toISOString(),
            nro_boleta: correlativo,
            turno_caja_id: idTurnoReal || null,
            cliente_id: idClienteReal || null,
            clientes: clienteActual ? { nombre_completo: clienteActual.nombre_completo } : null,
            medio_pago: medioPago,
            total_venta: totalConDescuento,
            descuento_monto: montoDescuento,
            utilidad_total: +utilidadTotal.toFixed(2),
            anulada: false,
            monto_efectivo: payloadVenta.monto_efectivo,
            monto_otro: payloadVenta.monto_otro,
            // A diferencia de payloadDetallesSinVentaId (que solo manda a
            // Supabase producto_id cuando es un uuid real, de más de 10
            // caracteres), acá se conserva el id del catálogo demo tal
            // cual -- si no, anular la boleta después no podría ubicar
            // qué producto reponer en catalogoDemoRef.
            ventas_detalle: lineasCheckout.map((item) => ({
              producto_id: item.productoId,
              descripcion: item.descripcion || '',
              cantidad: Number(item.cantidad),
              precio_costo: Number(item.precioCosto) || 0,
              subtotal: Number(item.subtotal),
              utilidad: +(Number(item.subtotal) - (Number(item.precioCosto) || 0) * Number(item.cantidad)).toFixed(2),
              unidades_stock: Number(item.unidadesStock || item.cantidad),
              productos: { descripcion: item.descripcion, unidad: null }
            }))
          }];

          if (catalogoDemoRef.current) {
            // Acumula por producto en vez de un Map 1:1 -- una misma línea
            // aplanada puede repetir productoId si, por ejemplo, un
            // producto está suelto en el carrito Y dentro de un combo.
            const cantidadesPorId = new Map();
            ajustesStock.forEach((a) => cantidadesPorId.set(a.productoId, (cantidadesPorId.get(a.productoId) || 0) + (-a.delta)));
            catalogoDemoRef.current = catalogoDemoRef.current.map((p) => (cantidadesPorId.has(p.id)
              ? { ...p, stock_actual: Math.max(0, (Number(p.stock_actual) || 0) - cantidadesPorId.get(p.id)) }
              : p));
          }

          if (medioPago === 'CREDITO' && idClienteReal) {
            const saldoActDemo = Number(clienteActual.saldo_actual) || 0;
            const nuevoSaldo = +(saldoActDemo + totalConDescuento).toFixed(2);
            setClienteActual(prev => (prev ? { ...prev, saldo_actual: nuevoSaldo } : prev));
            setClientesLista(prev => prev.map(c => (c.id === idClienteReal ? { ...c, saldo_actual: nuevoSaldo } : c)));
          }
        } else if (!enLinea) {
          // ------------------------------------------------------------
          // MODO OFFLINE: no se puede hablar con Supabase ahora mismo.
          // Se guarda la venta en una cola local (con su hora real) y se
          // aplican sus efectos de inmediato en pantalla (stock, deuda
          // del cliente); todo se sube solo apenas vuelva la conexión.
          // ------------------------------------------------------------
          seVendioOffline = true;
          payloadVenta.fecha_hora = new Date().toISOString();

          // id_local: llave única de esta venta offline -- si al sincronizar se
          // pierde la respuesta y se reintenta, la base de datos la reconoce
          // y no la guarda dos veces.
          const idLocal = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          payloadVenta.id_local = idLocal;
          const pendiente = {
            idLocal,
            payloadVenta,
            payloadDetalles: payloadDetallesSinVentaId,
            credito: medioPago === 'CREDITO' && idClienteReal ? { clienteId: idClienteReal, monto: totalConDescuento } : null,
            ajustesStock
          };
          guardarVentasPendientesLS([...ventasPendientesSync, pendiente]);

          // Refleja el descuento de stock en el catálogo ya mismo (la
          // cifra real de la base de datos se corrige sola al sincronizar).
          // Usa ajustesStock (ya aplanado por producto, combos incluidos)
          // en vez de buscar en carrito directo -- ahí una línea de combo
          // no tiene productoId propio.
          setProductos(prev => prev.map(p => {
            const adj = ajustesStock.find(a => a.productoId === p.id);
            if (!adj || p.stock_actual === null || p.stock_actual === undefined) return p;
            return { ...p, stock_actual: Math.max(0, Number(p.stock_actual) + adj.delta) };
          }));

          if (medioPago === 'CREDITO' && idClienteReal) {
            const saldoAct = Number(clienteActual.saldo_actual) || 0;
            setClienteActual(prev => (prev ? { ...prev, saldo_actual: +(saldoAct + totalConDescuento).toFixed(2) } : prev));
          }
        } else {
          // La misma venta reintentada (por ejemplo, si se cortó internet y no
          // se supo si llegó a guardarse) lleva el mismo id_local, así la base
          // de datos no la duplica. Si el carrito cambió, se genera uno nuevo.
          const huellaVenta = JSON.stringify([
            bodegaId, idTurnoReal || null, medioPago, totalConDescuento, idClienteReal || null,
            payloadDetallesSinVentaId.map((d) => [d.producto_id, d.combo_id, d.cantidad, d.subtotal])
          ]);
          if (!intentoVentaRef.current || intentoVentaRef.current.huella !== huellaVenta) {
            intentoVentaRef.current = { huella: huellaVenta, idLocal: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
          }
          payloadVenta.id_local = intentoVentaRef.current.idLocal;

          const atomica = await registrarVentaAtomica(
            payloadVenta,
            payloadDetallesSinVentaId,
            ajustesStock,
            medioPago === 'CREDITO' && idClienteReal ? { clienteId: idClienteReal, monto: totalConDescuento } : null
          );
          if (!atomica.faltaFuncion) {
            if (atomica.error) throw atomica.error;
            if (atomica.data?.nro_boleta) boletaFinal = atomica.data.nro_boleta;
            intentoVentaRef.current = null;
          } else {
          // Camino de siempre (paso a paso), mientras registrar_venta no exista.
          const { data: vCreada, error: vErr } = await sbClient
            .from('ventas')
            .insert([payloadVenta])
            .select()
            .single();

          if (vErr) throw vErr;

          const payloadDetalles = payloadDetallesSinVentaId.map(d => ({ ...d, venta_id: vCreada.id }));
          const { error: detErr } = await sbClient.from('ventas_detalle').insert(payloadDetalles);
          if (detErr) {
            console.error('Error al guardar el detalle de la venta:', detErr);
            notificar(`Venta registrada, pero el detalle de productos no se guardó. Avisa a soporte.`, 'error');
          }

          // Si es crédito, actualizar saldo (ajuste atómico: no se pisa
          // con otra venta/pago simultáneo al mismo cliente).
          if (medioPago === 'CREDITO' && idClienteReal) {
            const { error: errSaldoCredito } = await sbClient.rpc('ajustar_saldo_cliente', {
              p_cliente_id: idClienteReal,
              p_delta: totalConDescuento
            });
            if (errSaldoCredito) {
              console.warn('Error al actualizar la deuda del cliente:', errSaldoCredito);
              notificar(`Venta registrada, pero no se pudo actualizar la deuda del cliente. Avisa al soporte.`, 'error');
            }
          }

          // Descontar el stock vendido de cada producto real (no de catálogo de demo).
          // Se usa la función ajustar_stock (ajuste atómico en la base de
          // datos) en vez de leer y luego escribir desde aquí, para que
          // dos cajeros vendiendo el mismo producto a la vez no se pisen.
          // La venta ya se cobró y no tiene vuelta atrás en este punto,
          // así que un error acá no debe bloquear la boleta -- pero
          // tampoco debe pasar callado: si algo falla, se avisa para que
          // el stock se pueda corregir a mano.
          const resultadosAjusteStock = await Promise.all(ajustesStock.map((adj) =>
            sbClient.rpc('ajustar_stock', { p_producto_id: adj.productoId, p_delta: adj.delta })
          ));
          const fallosAjusteStock = resultadosAjusteStock.filter((r) => r.error);
          if (fallosAjusteStock.length > 0) {
            console.warn('Error al ajustar stock de la venta:', fallosAjusteStock);
            notificar(`Venta registrada, pero el stock de ${fallosAjusteStock.length} producto(s) no se pudo actualizar. Revísalo en la búsqueda de productos.`, 'error');
          }
          intentoVentaRef.current = null;
          }
        }
      }

      // Recién acá se cierran de verdad los pedidos de "Pedidos por
      // retirar" que se habían cargado a este carrito (ver
      // cargarPedidoDesdeRetirar): la venta ya se cobró y no tiene
      // vuelta atrás, así que ahora sí corresponde borrar el pedido de
      // pedidos_delivery y marcar su seguimiento como retirado. Es
      // best-effort -- si falla, no debe tumbar la boleta ya cobrada.
      if (sbClient && !esModoDemo && pedidosCargadosAlCarrito.length > 0) {
        const vinculados = pedidosCargadosAlCarrito;
        Promise.all(vinculados.map(async (p) => {
          try {
            await sbClient.from('pedidos_delivery').delete().eq('codigo_corto', p.codigoCorto);
            await sbClient.rpc('marcar_pedido_retirado', { p_codigo_corto: p.codigoCorto });
          } catch (err) {
            console.warn('No se pudo cerrar el seguimiento del pedido', p.codigoCorto, err);
          }
        })).then(() => {
          setPedidosRetirar((prev) =>
            prev.map((x) => (vinculados.some((v) => v.id === x.id) ? { ...x, estado: 'retirado' } : x))
          );
        });
        setPedidosCargadosAlCarrito([]);
      }

      const resultado = {
        nro_boleta: boletaFinal,
        medio_pago: medioPago,
        total_venta: totalConDescuento,
        subtotal: totalVenta,
        descuento: montoDescuento,
        items: [...carrito],
        cliente: clienteActual?.nombre_completo || 'Desconocido',
        telefono: clienteActual?.telefono || '',
        cajero: cajeroSeleccionado?.nombre || usuarioActivo?.nombre || 'Cajero',
        fecha: new Date().toLocaleTimeString(),
        fecha_hora: new Date().toISOString(),
        recibido: medioPago === 'EFECTIVO' && parseFloat(montoRecibido) > 0 ? parseFloat(montoRecibido) : 0,
        offline: seVendioOffline
      };

      setVentaCompletada(resultado);
      setCarrito([]);
      setDescuentoTipo(null);
      setDescuentoValor('');
      setMontoRecibido('');
      setMontoMixtoOtro('');
      setMontoMixtoRecibido('');
      setCampoTeclado(null);
      setMostrarPago(false);
      reiniciarClienteYMedioPago();
      setBarberoVentaId(null);
      // Cierra la hoja del carrito (mobile): que la venta exitosa vuelva
      // al catálogo en vez de dejar ver el carrito ya vacío detrás.
      setMostrarResumenMobile(false);
      // Refresca el stock mostrado: solo los productos vendidos, no el catálogo entero.
      if (esModoDemo) cargarProductos(busqueda);
      else if (enLinea) refrescarProductosPorId(carrito.flatMap(expandirLineaCarrito).map((l) => l.productoId));
      // No se usa notificar() aquí: el modal de "¡Venta Exitosa!" ya
      // muestra la boleta y el detalle, un toast encima sería redundante.
    } catch (err) {
      if (/^Stock insuficiente/.test(err.message || '')) {
        // La base rechazó la venta completa (no se guardó nada): se muestra
        // cuánto queda y se refresca el catálogo con el stock real.
        notificar(mensajeError(err), 'error');
        cargarProductos(busqueda);
      } else {
        notificar(mensajeError(err, 'Error al registrar venta'), 'error');
      }
    } finally {
      setProcesandoVenta(false);
    }
  };

  // Genera la boleta como PDF con formato de ticket angosto (80mm),
  // igual al que se usaría en una impresora térmica. Mismo orden que la boleta
  // impresa: negocio, boleta y fecha, tabla de productos, monto y pago.
  const generarPDFBoleta = async (venta) => {
    await asegurarJsPDF();
    const { jsPDF } = window.jspdf;
    const items = venta.items || [];
    const recibido = Number(venta.recibido) || 0;
    const vuelto = recibido >= Number(venta.total_venta) ? recibido - Number(venta.total_venta) : 0;
    const unidades = items.reduce((a, it) => a + (Number(it.cantidad) || 0), 0);
    const alturaEstimada = 78 + items.length * 11 + items.reduce((a, it) => a + detalleComboTicket(it).length * 3.4, 0)
      + (venta.descuento > 0 ? 10 : 0) + (recibido > 0 ? 8 : 0) + (bodegaDireccion ? 4 : 0) + (bodegaTelefono ? 4 : 0) + (venta.cajero ? 4 : 0);
    const doc = new jsPDF({ unit: 'mm', format: [80, Math.max(110, alturaEstimada)] });
    let y = 8;

    const punteada = (x1, x2) => {
      if (doc.setLineDashPattern) doc.setLineDashPattern([1.2, 1.2], 0);
      doc.line(x1, y, x2, y);
      if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
    };
    // Línea de corte: punteada, con una muesca redonda en cada borde del papel.
    const corte = () => {
      punteada(5, 75);
      doc.setFillColor(255, 255, 255);
      doc.circle(0, y, 2.4, 'FD');
      doc.circle(80, y, 2.4, 'FD');
      y += 5;
    };
    const rotulo = (txt, x, yy, opciones) => {
      doc.setFont(undefined, 'bold');
      doc.setFontSize(6);
      doc.text(txt.toUpperCase(), x, yy, opciones);
    };

    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text(bodegaNombre, 40, y, { align: 'center' });
    y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    if (bodegaDireccion) { doc.text(doc.splitTextToSize(bodegaDireccion, 70)[0], 40, y, { align: 'center' }); y += 3.6; }
    if (bodegaTelefono) { doc.text(`Tel. ${bodegaTelefono}`, 40, y, { align: 'center' }); y += 3.6; }
    y += 1.4;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.text('¡Gracias por su compra!', 40, y, { align: 'center' });
    y += 4.5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7.5);
    doc.text('Tu boleta se emitió correctamente', 40, y, { align: 'center' });
    y += 5;

    corte();
    rotulo('Boleta', 4, y);
    rotulo('Fecha y hora', 76, y, { align: 'right' });
    y += 4;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.text(String(venta.nro_boleta), 4, y);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.text(formatoFechaHoraBoleta(venta.fecha_hora), 76, y, { align: 'right' });
    y += 5;
    doc.setFontSize(7.5);
    doc.text(`Cliente: ${doc.splitTextToSize(String(venta.cliente), 62)[0]}`, 4, y);
    y += 3.8;
    if (venta.cajero) { doc.text(`Atendido por: ${doc.splitTextToSize(String(venta.cajero), 54)[0]}`, 4, y); y += 3.8; }
    y += 1.5;

    corte();

    // Tabla: Cant | Producto | Importe
    rotulo('Cant', 4, y);
    rotulo('Producto', 12, y);
    rotulo('Importe', 76, y, { align: 'right' });
    y += 1.8;
    doc.line(4, y, 76, y);
    y += 4;
    items.forEach((it) => {
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.text(String(it.cantidad), 4, y);
      const lineas = doc.splitTextToSize(it.descripcion, 48);
      doc.text(lineas, 12, y);
      doc.text(Number(it.subtotal).toFixed(2), 76, y, { align: 'right' });
      y += lineas.length * 3.6;
      doc.setFontSize(6.5);
      doc.text(`${Number(it.precioUnitario || 0).toFixed(2)} c/u${it.unidad && it.unidad !== 'UND' ? ` (${it.unidad})` : ''}`, 12, y);
      y += 3.2;
      detalleComboTicket(it).forEach((l) => {
        const sub = doc.splitTextToSize(`· ${l}`, 46);
        doc.text(sub, 13, y);
        y += sub.length * 3;
      });
      y += 2;
    });

    punteada(4, 76);
    y += 4;
    rotulo(`${unidades} ${unidades === 1 ? 'artículo' : 'artículos'}`, 4, y);
    y += 4;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    if (venta.descuento > 0) {
      doc.text('Subtotal', 4, y); doc.text(`S/ ${venta.subtotal.toFixed(2)}`, 76, y, { align: 'right' }); y += 4;
      doc.text('Descuento', 4, y); doc.text(`-S/ ${venta.descuento.toFixed(2)}`, 76, y, { align: 'right' }); y += 5;
    }

    rotulo('Monto', 4, y);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(14);
    doc.text(`S/ ${venta.total_venta.toFixed(2)}`, 76, y, { align: 'right' });
    y += 5;

    // Recuadro del pago (y recibido / vuelto si fue en efectivo)
    const filasPago = recibido > 0 ? 3 : 1;
    doc.roundedRect(4, y, 72, filasPago * 4 + 3, 2, 2, 'S');
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    const medioPagoTxt = String(venta.medio_pago || '');
    let yy = y + 4.2;
    doc.text('Pago', 7, yy); doc.text(medioPagoTxt.charAt(0).toUpperCase() + medioPagoTxt.slice(1).toLowerCase(), 73, yy, { align: 'right' });
    if (recibido > 0) {
      yy += 4; doc.text('Recibido', 7, yy); doc.text(`S/ ${recibido.toFixed(2)}`, 73, yy, { align: 'right' });
      yy += 4; doc.text('Vuelto', 7, yy); doc.text(`S/ ${vuelto.toFixed(2)}`, 73, yy, { align: 'right' });
    }
    y += filasPago * 4 + 8;

    corte();

    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    const disclaimer = doc.splitTextToSize(
      'Documento sin valor tributario. No válido como comprobante de pago ante SUNAT. Solo informativo.',
      72
    );
    doc.text(disclaimer, 40, y, { align: 'center' });

    return doc;
  };

  // Comparte la boleta en PDF por WhatsApp vía el share nativo del
  // celular (adjunta el archivo directo); en desktop, donde no se puede
  // adjuntar así, descarga el PDF y abre WhatsApp Web con el chat listo
  // para adjuntarlo manualmente.
  const enviarBoletaWhatsApp = async (venta) => {
    const doc = await generarPDFBoleta(venta);
    const nombreArchivo = `Boleta_${venta.nro_boleta}.pdf`;
    const blob = doc.output('blob');

    try {
      const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        await navigator.share({
          files: [archivo],
          title: 'Boleta de venta',
          text: `Boleta ${venta.nro_boleta} - ${bodegaNombre}`
        });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return; // el cajero canceló el share
      console.warn('No se pudo compartir directamente, usando alternativa:', err.message);
    }

    doc.save(nombreArchivo);
    const soloNumeros = (venta.telefono || '').replace(/\D/g, '');
    const telConCodigo = soloNumeros.length === 9 ? `51${soloNumeros}` : soloNumeros;
    const mensaje = encodeURIComponent(
      `Boleta ${venta.nro_boleta} - ${bodegaNombre}. Total: S/ ${venta.total_venta.toFixed(2)}. Adjunta el PDF que se acaba de descargar. ¡Gracias por tu compra!`
    );
    const url = telConCodigo ? `https://wa.me/${telConCodigo}?text=${mensaje}` : `https://wa.me/?text=${mensaje}`;
    window.open(url, '_blank');
    notificar('Se descargó el PDF de la boleta. Adjúntalo manualmente en el chat de WhatsApp que se abrió.', 'info');
  };

  return {
    abrirCajaNueva, abrirCierreCaja, abrirHistorialCierres, cambiarConteo,
    cargarHistorialCierresPorRango, confirmarCierreConArqueo, consultarTurnosAbiertos,
    elegirAtajoCierres, enviarBoletaWhatsApp, handleAbrirTurno, handleCobrar,
    retomarTurnoViejo, unirseACaja, verificarTurno
  };
}
