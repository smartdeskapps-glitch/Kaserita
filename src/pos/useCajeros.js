// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { mensajeError, generarUUID } from './utilidades.js';
import { esDocumentoValido, esRucValido } from '../lib/validaciones.js';
import { pinValido, PIN_MIN, PIN_MAX, PIN_MIN_DUENO } from '../PanelAdminCompartido.jsx';
import { useEffect } from 'react';

export default function useCajeros({
  bodegaId, cajeroPendientePin, cajeroSeleccionado, cargarCajeros, crearPinAdmin, elevado,
  esBarberia, esCajeroDelUsuarioActivo, esModoDemo, fechaAgenda, formCrearPin,
  formNuevoCajero, listaCajeros, modalHorario, modalPinCajero, notificar, nuevoPinCajero,
  pedirConfirmacion, periodoComisiones, pinConfirmarCajero, rolActivo, rolesEnServidor,
  sbClient, sesion, setBarberosConHorario, setCajeroPendientePin, setCajeroSeleccionado,
  setCajerosGestion, setCargandoAgenda, setCargandoCajerosGestion, setCargandoComisiones,
  setCitasAgenda, setCrearPinAdmin, setElevado, setFechaAgenda, setFilasComisiones,
  setFormCrearPin, setFormNuevoCajero, setGuardandoCrearPin, setGuardandoHorario,
  setGuardandoNuevoCajero, setGuardandoPinCajero, setListaCajeros, setModalAgenda,
  setModalComisiones, setModalGestionCajeros, setModalHorario, setModalPinCajero,
  setMostrarFormNuevoCajero, setNuevoPinCajero, setPinConfirmarCajero, setRolesEnServidor,
  setVerificandoPinCajero
}) {
  // ==========================================
  // GESTIÓN DE CAJEROS (agregar empleados, activar/desactivar acceso)
  // ==========================================
  const abrirGestionCajeros = async () => {
    setModalGestionCajeros(true);
    setMostrarFormNuevoCajero(false);
    if (esModoDemo) {
      setCajerosGestion(listaCajeros);
      return;
    }
    if (!sbClient || !bodegaId) return;
    setCargandoCajerosGestion(true);
    try {
      const { data, error } = await sbClient
        .from('cajeros')
        .select(esBarberia ? 'id, bodega_id, nombre, dni, rol, activo, comision_pct, comision_productos_pct' :'id, bodega_id, nombre, dni, rol, activo')
        .eq('bodega_id', bodegaId)
        .order('nombre', { ascending: true });
      if (error) throw error;
      setCajerosGestion(data || []);
      if (esBarberia) {
        const { data: horarios } = await sbClient.from('barbero_horarios').select('barbero_id').eq('bodega_id', bodegaId);
        setBarberosConHorario(new Set((horarios || []).map((h) => h.barbero_id)));
      }
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo cargar la lista de cajeros'), 'error');
    } finally {
      setCargandoCajerosGestion(false);
    }
  };

  // Barbería: guarda un % de comisión de un barbero (0 a 100). `campo` es
  // comision_pct (cortes y servicios) o comision_productos_pct (productos).
  const guardarComisionBarbero = async (barbero, texto, campo = 'comision_pct') => {
    if (campo !== 'comision_pct' && campo !== 'comision_productos_pct') return;
    const pct = Number(texto);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      notificar('La comisión debe estar entre 0 y 100.', 'error');
      return;
    }
    if (Number(barbero[campo]) === pct) return;
    if (!sbClient || esModoDemo) return;
    const { error } = await sbClient.from('cajeros').update({ [campo]: pct }).eq('id', barbero.id);
    if (error) {
      notificar(mensajeError(error, 'No se pudo guardar la comisión'), 'error');
      return;
    }
    setCajerosGestion((prev) => prev.map((c) => (c.id === barbero.id ? { ...c, [campo]: pct } : c)));
    notificar(`Comisión de ${barbero.nombre} por ${campo === 'comision_pct' ? 'servicios' : 'productos'}: ${pct}%.`, 'success');
  };

  // Barbería: lo vendido por cada barbero en el período. La comisión se
  // calcula solo sobre los SERVICIOS (ítems sin stock, como el corte); lo que
  // vende de productos (pomada, shampoo) se muestra aparte y no comisiona.
  const cargarComisiones = async (periodo) => {
    if (!sbClient || !bodegaId || esModoDemo) { setFilasComisiones([]); return; }
    setCargandoComisiones(true);
    try {
      const hoy = new Date();
      const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      if (periodo === 'semana') desde.setDate(desde.getDate() - ((desde.getDay() + 6) % 7));
      if (periodo === 'mes') desde.setDate(1);
      const [resVentas, resBarberos] = await Promise.all([
        sbClient
          .from('ventas')
          .select('id, barbero_id, ventas_detalle(subtotal, combo_id, productos(stock_actual))')
          .eq('bodega_id', bodegaId)
          .eq('anulada', false)
          .not('barbero_id', 'is', null)
          .gte('fecha_hora', desde.toISOString()),
        sbClient.from('cajeros').select('id, nombre, rol, comision_pct, comision_productos_pct').eq('bodega_id', bodegaId).order('nombre', { ascending: true })
      ]);
      if (resVentas.error) throw resVentas.error;
      if (resBarberos.error) throw resBarberos.error;
      const porBarbero = new Map((resBarberos.data || []).map((b) => [b.id, {
        // El dueño no cobra comisión (es el dueño del negocio), aunque atienda.
        id: b.id, nombre: b.nombre, esDueno: b.rol === 'dueno', pct: b.rol === 'dueno' ? 0 : (Number(b.comision_pct) || 0), pctProductos: b.rol === 'dueno' ? 0 : (Number(b.comision_productos_pct) || 0), atenciones: 0, servicios: 0, cantServicios: 0, productos: 0, insumosCombo: 0
      }]));
      (resVentas.data || []).forEach((v) => {
        const fila = porBarbero.get(v.barbero_id);
        if (!fila) return;
        fila.atenciones += 1;
        (v.ventas_detalle || []).forEach((d) => {
          const esServicio = d.productos && (d.productos.stock_actual === null || d.productos.stock_actual === undefined);
          if (esServicio) { fila.servicios += Number(d.subtotal) || 0; fila.cantServicios += 1; }
          // Dentro de un combo (ej. tinte + aplicación) solo comisiona la
          // parte de servicio: el producto/insumo del combo no comisiona.
          else if (d.combo_id) fila.insumosCombo += Number(d.subtotal) || 0;
          else fila.productos += Number(d.subtotal) || 0;
        });
      });
      setFilasComisiones([...porBarbero.values()].map((f) => ({
        ...f,
        comisionServicios: +(f.servicios * f.pct / 100).toFixed(2),
        comisionProductos: +(f.productos * f.pctProductos / 100).toFixed(2),
        comision: +((f.servicios * f.pct / 100) + (f.productos * f.pctProductos / 100)).toFixed(2)
      })));
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo cargar las comisiones'), 'error');
      setFilasComisiones([]);
    } finally {
      setCargandoComisiones(false);
    }
  };

  const abrirComisiones = () => {
    setModalComisiones(true);
    cargarComisiones(periodoComisiones);
  };

  // Barbería con agenda: horario semanal de un barbero. En pantalla cada día
  // tiene una hora de inicio, una de fin y un descanso opcional; en la base
  // se guarda como bloques (un descanso parte el día en dos bloques).
  const DIAS_AGENDA = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];

  const abrirHorarioBarbero = async (barbero) => {
    if (!sbClient || esModoDemo) return;
    const { data, error } = await sbClient
      .from('barbero_horarios')
      .select('dia, desde, hasta')
      .eq('barbero_id', barbero.id)
      .order('desde', { ascending: true });
    if (error) {
      notificar(mensajeError(error, 'No se pudo cargar el horario'), 'error');
      return;
    }
    const hhmm = (t) => String(t).slice(0, 5);
    const sinHorario = (data || []).length === 0;
    const dias = DIAS_AGENDA.map(([dia, nombre]) => {
      const bloques = (data || []).filter((b) => b.dia === dia);
      if (bloques.length === 0) {
        // Sin horario cargado se propone lunes a sábado de 9 a 20 para editar.
        return { dia, nombre, activo: sinHorario && dia !== 0, desde: '09:00', hasta: '20:00', descansoDesde: '', descansoHasta: '' };
      }
      return {
        dia, nombre, activo: true,
        desde: hhmm(bloques[0].desde),
        hasta: hhmm(bloques[bloques.length - 1].hasta),
        descansoDesde: bloques.length > 1 ? hhmm(bloques[0].hasta) : '',
        descansoHasta: bloques.length > 1 ? hhmm(bloques[1].desde) : ''
      };
    });
    setModalHorario({ barbero, dias });
  };

  const cambiarDiaHorario = (dia, cambios) => {
    setModalHorario((prev) => prev && { ...prev, dias: prev.dias.map((d) => (d.dia === dia ? { ...d, ...cambios } : d)) });
  };

  // Copia el horario del primer día activo a todos los demás días activos.
  const copiarHorarioADias = () => {
    setModalHorario((prev) => {
      if (!prev) return prev;
      const base = prev.dias.find((d) => d.activo);
      if (!base) return prev;
      return { ...prev, dias: prev.dias.map((d) => (d.activo ? { ...d, desde: base.desde, hasta: base.hasta, descansoDesde: base.descansoDesde, descansoHasta: base.descansoHasta } : d)) };
    });
  };

  const guardarHorarioBarbero = async () => {
    if (!modalHorario || !sbClient || esModoDemo) return;
    const bloques = [];
    for (const d of modalHorario.dias.filter((x) => x.activo)) {
      if (!d.desde || !d.hasta || d.hasta <= d.desde) {
        notificar(`${d.nombre}: la hora de fin debe ser después de la de inicio.`, 'error');
        return;
      }
      if (d.descansoDesde || d.descansoHasta) {
        if (!(d.descansoDesde && d.descansoHasta && d.descansoDesde > d.desde && d.descansoHasta > d.descansoDesde && d.descansoHasta < d.hasta)) {
          notificar(`${d.nombre}: el descanso debe tener inicio y fin, dentro del horario.`, 'error');
          return;
        }
        bloques.push({ dia: d.dia, desde: d.desde, hasta: d.descansoDesde }, { dia: d.dia, desde: d.descansoHasta, hasta: d.hasta });
      } else {
        bloques.push({ dia: d.dia, desde: d.desde, hasta: d.hasta });
      }
    }
    setGuardandoHorario(true);
    try {
      const { error } = await sbClient.rpc('guardar_horario_barbero', { p_barbero: modalHorario.barbero.id, p_bloques: bloques });
      if (error) throw error;
      setBarberosConHorario((prev) => {
        const sig = new Set(prev);
        if (bloques.length > 0) sig.add(modalHorario.barbero.id); else sig.delete(modalHorario.barbero.id);
        return sig;
      });
      notificar(`Horario de ${modalHorario.barbero.nombre} guardado.`, 'success');
      setModalHorario(null);
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo guardar el horario'), 'error');
    } finally {
      setGuardandoHorario(false);
    }
  };

  // Agenda de citas de un día, por barbero.
  const cargarAgenda = async (fecha) => {
    if (!sbClient || !bodegaId || esModoDemo || !fecha) { setCitasAgenda([]); return; }
    setCargandoAgenda(true);
    try {
      const [a, m, d] = fecha.split('-').map(Number);
      const desde = new Date(a, m - 1, d);
      const hasta = new Date(a, m - 1, d + 1);
      const [resCitas, resBarberos] = await Promise.all([
        sbClient
          .from('citas')
          .select('id, barbero_id, inicio, fin, pedidos_seguimiento(codigo_corto, cliente_nombre, items, estado)')
          .eq('bodega_id', bodegaId)
          .gte('inicio', desde.toISOString())
          .lt('inicio', hasta.toISOString())
          .order('inicio', { ascending: true }),
        sbClient.from('cajeros').select('id, nombre').eq('bodega_id', bodegaId).order('nombre', { ascending: true })
      ]);
      if (resCitas.error) throw resCitas.error;
      if (resBarberos.error) throw resBarberos.error;
      const nombres = new Map((resBarberos.data || []).map((b) => [b.id, b.nombre]));
      setCitasAgenda((resCitas.data || []).map((c) => ({ ...c, barbero: nombres.get(c.barbero_id) || 'Barbero' })));
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo cargar la agenda'), 'error');
      setCitasAgenda([]);
    } finally {
      setCargandoAgenda(false);
    }
  };

  // Alarga o acorta una cita ya reservada (ej. un tinte que toma más tiempo).
  // El servidor revisa que no choque con la siguiente cita del barbero.
  const ajustarDuracionCita = async (cita, texto) => {
    const minutos = Number(texto);
    const actual = Math.round((new Date(cita.fin) - new Date(cita.inicio)) / 60000);
    if (!Number.isInteger(minutos) || minutos < 5 || minutos > 480 || minutos % 5 !== 0) {
      notificar('La duración debe ser de 5 a 480 minutos, de 5 en 5.', 'error');
      cargarAgenda(fechaAgenda);
      return;
    }
    if (minutos === actual || !sbClient || esModoDemo) return;
    const { error } = await sbClient.rpc('ajustar_duracion_cita', { p_cita: cita.id, p_minutos: minutos });
    if (error) {
      notificar(mensajeError(error, 'No se pudo ajustar la cita.'), 'error');
    } else {
      notificar(`Cita ajustada a ${minutos} minutos.`, 'success');
    }
    cargarAgenda(fechaAgenda);
  };

  const abrirAgenda = () => {
    const hoy = new Date();
    const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    setFechaAgenda(iso);
    setModalAgenda(true);
    cargarAgenda(iso);
  };

  // Crea un nuevo empleado en 'cajeros' (para seleccionarlo al abrir turno
  // y quedar asociado a sus ventas).
  // Los empleados (Cajero o Administrador) no tienen contraseña propia:
  // solo se agregan a la lista de turno con nombre, DNI y rol. Nadie
  // aparte del dueño puede iniciar sesión de forma independiente.
  const registrarNuevoCajeroCompleto = async () => {
    const { nombre, dni, rol, pin } = formNuevoCajero;
    if (!nombre.trim() || !dni.trim()) {
      notificar('Nombre y DNI son obligatorios.', 'error');
      return;
    }
    if (!esDocumentoValido(dni) || esRucValido(dni)) {
      notificar('Revisa el DNI: debe tener 8 dígitos (o carné/pasaporte de 9 a 12 letras o números).', 'error');
      return;
    }
    // Un Administrador desbloquea el panel completo al elegirlo en
    // "Abrir Turno" -- por eso necesita su propio PIN desde que se
    // crea (ver cajeros_pin_administrador.sql). Un Cajero normal no
    // desbloquea nada, así que no lo necesita.
    if (rol === 'administrador' && !pinValido(pin)) {
      notificar(`El PIN del Administrador debe tener entre ${PIN_MIN} y ${PIN_MAX} caracteres.`, 'error');
      return;
    }
    setGuardandoNuevoCajero(true);
    try {
      if (esModoDemo) {
        const nuevo = { id: generarUUID(), bodega_id: bodegaId, nombre: nombre.trim(), dni: dni.trim(), rol, activo: true, pin_seguridad: rol === 'administrador' ? pin.trim() : null };
        setListaCajeros((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setCajerosGestion((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      } else if (sbClient) {
        // pin_seguridad se hashea del lado del servidor (establecer_pin_cajero,
        // ver hashear_pin_cajero.sql) -- nunca se manda el texto plano en un
        // insert/update directo a la tabla.
        // "id" nada más -- pedir "*" fallaría porque pin_seguridad no
        // se puede leer desde el cliente (ver cargarCajeros más arriba).
        const { data: cajeroCreado, error: errCajero } = await sbClient
          .from('cajeros')
          .insert([{ bodega_id: bodegaId, nombre: nombre.trim(), dni: dni.trim(), rol: rol, activo: true }])
          .select('id')
          .single();
        if (errCajero) throw errCajero;
        if (rol === 'administrador') {
          const { error: errPin } = await sbClient.rpc('establecer_pin_cajero', {
            p_cajero_id: cajeroCreado.id,
            p_pin: pin.trim(),
          });
          if (errPin) throw errPin;
        }
        abrirGestionCajeros();
        cargarCajeros();
      }
      setFormNuevoCajero({ nombre: '', dni: '', rol: 'cajero', pin: '' });
      setMostrarFormNuevoCajero(false);
      notificar(`¡"${nombre}" agregado! Ya aparece en la lista para elegir al abrir turno.`, 'success');
    } catch (err) {
      notificar(mensajeError(err, 'Error al registrar'), 'error');
    } finally {
      setGuardandoNuevoCajero(false);
    }
  };

  // Activa/desactiva el acceso del cajero: bloquea su login (usuarios) y lo
  // saca del selector de turno (cajeros), sin borrar su historial de ventas.
  const alternarActivoCajero = async (cajero) => {
    const nuevoEstado = !cajero.activo;
    try {
      if (sbClient && !esModoDemo) {
        const { error: err1 } = await sbClient
          .from('cajeros')
          .update({ activo: nuevoEstado })
          .eq('id', cajero.id);
        if (err1) throw err1;

        const { error: err2 } = await sbClient
          .from('usuarios')
          .update({ activo: nuevoEstado })
          .eq('bodega_id', bodegaId)
          .eq('dni', cajero.dni);
        if (err2) console.warn('No se pudo actualizar el acceso de login:', err2.message);
      }
      setCajerosGestion((prev) => prev.map((c) => (c.id === cajero.id ? { ...c, activo: nuevoEstado } : c)));
      if (esModoDemo) {
        setListaCajeros((prev) => (nuevoEstado ? prev : prev.filter((c) => c.id !== cajero.id)));
      } else {
        cargarCajeros();
      }
      notificar(nuevoEstado ? `${cajero.nombre} reactivado.` : `${cajero.nombre} desactivado.`, 'info');
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo completar la acción'), 'error');
    }
  };

  // Borra por completo el acceso de un cajero (a diferencia de
  // desactivar, que solo lo oculta del selector conservando su
  // historial). Si tiene ventas registradas a su nombre, la base de
  // datos rechaza el borrado (esas filas dependen de este id) -- en ese
  // caso conviene usar "Desactivar" en su lugar, así se avisa.
  const eliminarCajero = async (cajero) => {
    if (cajero.rol === 'dueno') return;
    const confirmado = await pedirConfirmacion({
      titulo: 'Eliminar cajero',
      mensaje: `¿Eliminar a "${cajero.nombre}" de la lista de cajeros? Esta acción no se puede deshacer.`,
      textoBoton: 'Sí, eliminar',
      peligroso: true
    });
    if (!confirmado) return;
    try {
      if (sbClient && !esModoDemo) {
        const { error } = await sbClient.from('cajeros').delete().eq('id', cajero.id);
        if (error) throw error;
      }
      setCajerosGestion((prev) => prev.filter((c) => c.id !== cajero.id));
      setListaCajeros((prev) => prev.filter((c) => c.id !== cajero.id));
      if (cajeroSeleccionado?.id === cajero.id) setCajeroSeleccionado(null);
      notificar(`${cajero.nombre} eliminado.`, 'info');
    } catch (err) {
      if (err.code === '23503') {
        notificar(`No se puede eliminar a ${cajero.nombre}: tiene ventas registradas a su nombre. Usa "Desactivar" en su lugar.`, 'error');
      } else {
        notificar(mensajeError(err, 'No se pudo completar la acción'), 'error');
      }
    }
  };

  // El dueño ya probó su identidad al iniciar sesión, así que puede
  // elegirse a sí mismo sin nada más. Cualquier otra fila con rol
  // "administrador" (o "dueno", que no debería repetirse) desbloquea el
  // panel completo -- antes de aplicar ese cambio, se pide su PIN.
  const elegirCajeroTurno = (f) => {
    if (!f) return;
    const esUnoMismo = esCajeroDelUsuarioActivo(f);
    const esElevado = f.rol === 'administrador' || f.rol === 'dueno';
    // Con roles en el servidor, hasta el dueño escribe su PIN: la sesión es
    // compartida y la base no puede saber quién está frente a la pantalla.
    const exigePin = esElevado && !(esUnoMismo && (esModoDemo || !rolesEnServidor));
    const yaDesbloqueado = elevado && cajeroSeleccionado?.id === f.id;
    if (exigePin && !yaDesbloqueado) {
      setCajeroPendientePin(f);
      setPinConfirmarCajero('');
    } else {
      setCajeroSeleccionado(f);
    }
  };

  // Quita la elevación de esta sesión (cambio de cajero, bloqueo manual, salir).
  const soltarAdmin = async () => {
    setElevado(false);
    if (sbClient && !esModoDemo && rolesEnServidor) {
      try { await sbClient.rpc('bajar_admin'); } catch (err) { /* sin red: vence sola */ }
    }
  };

  const confirmarPinCajero = async () => {
    const f = cajeroPendientePin;
    if (!f) return;
    setVerificandoPinCajero(true);
    try {
      if (esModoDemo) {
        if (f.pin_seguridad && f.pin_seguridad === pinConfirmarCajero.trim()) {
          setCajeroSeleccionado(f);
          setCajeroPendientePin(null);
          setPinConfirmarCajero('');
        } else {
          notificar('PIN incorrecto.', 'error');
        }
        return;
      }
      if (!rolesEnServidor) {
        const { data, error } = await sbClient.rpc('verificar_pin_cajero', { p_cajero_id: f.id, p_pin: pinConfirmarCajero.trim() });
        if (error) throw error;
        if (data) {
          setCajeroSeleccionado(f);
          setCajeroPendientePin(null);
          setPinConfirmarCajero('');
        } else {
          notificar('PIN incorrecto.', 'error');
        }
        return;
      }
      const { data: resultado, error } = await sbClient.rpc('elevar_admin', { p_cajero_id: f.id, p_pin: pinConfirmarCajero.trim() });
      if (error) throw error;
      if (resultado === 'ok') {
        setElevado(true);
        setCajeroSeleccionado(f);
        setCajeroPendientePin(null);
        setPinConfirmarCajero('');
      } else if (resultado === 'sin_pin') {
        setCajeroPendientePin(null);
        setPinConfirmarCajero('');
        if (f.rol === 'dueno') {
          setFormCrearPin({ nuevo: '', repetir: '' });
          setCrearPinAdmin(f);
        } else {
          notificar('Este administrador todavía no tiene PIN. Pídele al dueño que se lo asigne en Cajeros y Empleados.', 'error');
        }
      } else {
        notificar('PIN incorrecto.', 'error');
      }
    } catch (err) {
      notificar(mensajeError(err), 'error');
    } finally {
      setVerificandoPinCajero(false);
    }
  };

  // Primer PIN de administrador del dueño. El servidor solo lo permite justo
  // después de iniciar sesión con Google (login reciente).
  const guardarCrearPinAdmin = async () => {
    const c = crearPinAdmin;
    if (!c) return;
    const nuevo = formCrearPin.nuevo.trim();
    if (nuevo.length < PIN_MIN_DUENO || nuevo.length > PIN_MAX) {
      notificar(`El PIN debe tener entre ${PIN_MIN_DUENO} y ${PIN_MAX} caracteres.`, 'error');
      return;
    }
    if (nuevo !== formCrearPin.repetir.trim()) {
      notificar('Los dos PIN no coinciden.', 'error');
      return;
    }
    setGuardandoCrearPin(true);
    try {
      const { error } = await sbClient.rpc('establecer_pin_cajero', { p_cajero_id: c.id, p_pin: nuevo });
      if (error) throw error;
      const { data: resultado, error: errElevar } = await sbClient.rpc('elevar_admin', { p_cajero_id: c.id, p_pin: nuevo });
      if (errElevar) throw errElevar;
      if (resultado !== 'ok') throw new Error('No se pudo desbloquear la administración. Intenta de nuevo.');
      setElevado(true);
      setCajeroSeleccionado(c);
      setCrearPinAdmin(null);
      setFormCrearPin({ nuevo: '', repetir: '' });
      notificar('Listo: tu PIN de administrador quedó creado. Guárdalo, lo pedirá cada vez que abras la administración.', 'success');
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo crear el PIN'), 'error');
    } finally {
      setGuardandoCrearPin(false);
    }
  };

  // Al abrir la app: ¿esta sesión ya estaba desbloqueada? Si la migración del
  // servidor no existe todavía, se sigue como antes.
  useEffect(() => {
    if (!sbClient || !sesion || esModoDemo) { setElevado(false); return undefined; }
    let cancelado = false;
    sbClient.rpc('estoy_elevado').then(({ data, error }) => {
      if (cancelado) return;
      if (error && (error.code === 'PGRST202' || error.code === '42883')) { setRolesEnServidor(false); return; }
      setRolesEnServidor(true);
      setElevado(!error && !!data);
    });
    return () => { cancelado = true; };
  }, [sbClient, sesion?.usuario?.id, esModoDemo]);

  // Si quien atiende la caja ya no es Dueño/Administrador, se baja la elevación.
  useEffect(() => {
    if (elevado && !esModoDemo && rolesEnServidor && rolActivo !== 'dueno' && rolActivo !== 'administrador') soltarAdmin();
  }, [elevado, rolActivo]);

  // El dueño cambia/asigna el PIN de un Administrador desde acá (por
  // ejemplo, si lo olvidó) -- solo se puede llegar a este modal desde
  // "Cajeros y Empleados", que ya está detrás de esAdmin.
  const guardarPinCajero = async () => {
    const cajero = modalPinCajero;
    if (!cajero) return;
    const minimo = cajero.rol === 'dueno' ? PIN_MIN_DUENO : PIN_MIN;
    const largo = nuevoPinCajero.trim().length;
    if (largo < minimo || largo > PIN_MAX) {
      notificar(`El PIN debe tener entre ${minimo} y ${PIN_MAX} caracteres.`, 'error');
      return;
    }
    setGuardandoPinCajero(true);
    try {
      if (esModoDemo) {
        setListaCajeros((prev) => prev.map((c) => (c.id === cajero.id ? { ...c, pin_seguridad: nuevoPinCajero.trim() } : c)));
        setCajerosGestion((prev) => prev.map((c) => (c.id === cajero.id ? { ...c, pin_seguridad: nuevoPinCajero.trim() } : c)));
      } else {
        const { error } = await sbClient.rpc('establecer_pin_cajero', {
          p_cajero_id: cajero.id,
          p_pin: nuevoPinCajero.trim(),
        });
        if (error) throw error;
      }
      notificar(`PIN de ${cajero.nombre} actualizado.`, 'success');
      setModalPinCajero(null);
      setNuevoPinCajero('');
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo completar la acción'), 'error');
    } finally {
      setGuardandoPinCajero(false);
    }
  };

  return {
    abrirAgenda, abrirComisiones, abrirGestionCajeros, abrirHorarioBarbero,
    ajustarDuracionCita, alternarActivoCajero, cambiarDiaHorario, cargarAgenda,
    cargarComisiones, confirmarPinCajero, copiarHorarioADias, elegirCajeroTurno,
    eliminarCajero, guardarComisionBarbero, guardarCrearPinAdmin, guardarHorarioBarbero,
    guardarPinCajero, registrarNuevoCajeroCompleto, soltarAdmin
  };
}
