// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { generarUUID, mensajeError } from './utilidades.js';
import { esDocumentoValido, esMontoNoNegativo } from '../lib/validaciones.js';

export default function useCreditoCliente({
  bodegaId, desconocidoCacheRef, enLinea, esModoDemo, formCliente, modalCobrarDeudas,
  notificar, sbClient, setBoletasDeudor, setBoletasDeudores, setBusquedaDeudores,
  setCargandoDeudores, setClienteActual, setClienteEditando, setClientesLista,
  setDeudorSeleccionado, setDniCliente, setFiltroDeudores, setFormCliente,
  setModalCobrarDeudas, setModalNuevoCliente, setOrdenDeudores, setPagoRegistrado,
  setPagosRecientes
}) {
  // ==========================================
  // CLIENTE & GESTIÓN DE CRÉDITOS
  // ==========================================
  const obtenerOCrearCliente = async (dni = '99999999') => {
    const dniLimpio = dni.trim() || '99999999';

    // Sin conexión: no se puede consultar/crear en Supabase. Si ya
    // teníamos el cliente "Desconocido" real (cacheado la última vez
    // que sí hubo internet), se reutiliza -- así una venta offline
    // sigue apuntando a un cliente_id válido que existe de verdad en
    // la base de datos, en vez de un id inventado que fallaría al
    // sincronizar.
    if (!enLinea && dniLimpio === '99999999' && desconocidoCacheRef.current) {
      setClienteActual(desconocidoCacheRef.current);
      return desconocidoCacheRef.current;
    }

    if (!sbClient || !bodegaId || !enLinea || esModoDemo) {
      const mock = { id: generarUUID(), bodega_id: bodegaId, dni: dniLimpio, nombre_completo: dniLimpio === '99999999' ? 'Desconocido' : `CLIENTE DNI ${dniLimpio}`, saldo_actual: 0 };
      setClienteActual(mock);
      return mock;
    }

    try {
      const { data } = await sbClient
        .from('clientes')
        .select('*')
        .eq('bodega_id', bodegaId)
        .eq('dni', dniLimpio)
        .maybeSingle();

      if (data) {
        setClienteActual(data);
        if (dniLimpio === '99999999') desconocidoCacheRef.current = data;
        return data;
      }

      const nuevo = {
        bodega_id: bodegaId,
        dni: dniLimpio,
        nombre_completo: dniLimpio === '99999999' ? 'Desconocido' : `CLIENTE DNI ${dniLimpio}`,
        saldo_actual: 0.00
      };

      const { data: creado } = await sbClient
        .from('clientes')
        .insert([nuevo])
        .select()
        .single();

      setClienteActual(creado || nuevo);
      if (dniLimpio === '99999999') desconocidoCacheRef.current = creado || nuevo;
      return creado || nuevo;
    } catch (err) {
      console.warn(err);
    }
  };

  const handleGuardarNuevoCliente = async (e) => {
    e.preventDefault();
    const { dni, nombre, telefono, correo, limiteCredito } = formCliente;
    if (!dni.trim() || !nombre.trim()) {
      notificar('DNI y Nombre son obligatorios.', 'error');
      return;
    }
    if (!esDocumentoValido(dni)) {
      notificar('Revisa el documento: DNI de 8 dígitos, RUC de 11 o carné/pasaporte de 9 a 12 letras o números.', 'error');
      return;
    }
    if (!esMontoNoNegativo(limiteCredito)) {
      notificar('El límite de crédito no puede ser negativo.', 'error');
      return;
    }
    const limite = Number(limiteCredito) || 0;

    try {
      if (sbClient && !esModoDemo) {
        const { data, error } = await sbClient
          .from('clientes')
          .insert([{
            bodega_id: bodegaId,
            dni: dni.trim(),
            nombre_completo: nombre.trim(),
            telefono: telefono.trim() || null,
            correo: correo.trim() || null,
            limite_credito: limite,
            dias_credito: 30,
            saldo_actual: 0.00
          }])
          .select()
          .single();

        if (error) throw error;
        setClienteActual(data);
        setDniCliente(data.dni);
        // Si se creó desde dentro de "Fiados", que aparezca en la
        // lista al toque en vez de tener que cerrar y volver a entrar.
        if (modalCobrarDeudas) {
          setClientesLista((prev) => [...prev, data].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '')));
        }
      } else {
        const cLocal = { id: generarUUID(), bodega_id: bodegaId, dni: dni.trim(), nombre_completo: nombre.trim(), telefono, correo, limite_credito: limite, dias_credito: 30, saldo_actual: 0 };
        setClienteActual(cLocal);
        setDniCliente(cLocal.dni);
        // En Modo Demo Local se agrega siempre a la lista (sin importar
        // desde qué modal se creó) para que luego aparezca en "Fiados".
        if (modalCobrarDeudas || esModoDemo) {
          setClientesLista((prev) => [...prev, cLocal].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '')));
        }
      }

      setModalNuevoCliente(false);
      setFormCliente({ dni: '', nombre: '', telefono: '', correo: '', limiteCredito: '300.00' });
      notificar(`¡Cliente "${nombre}" registrado con éxito!`, 'success');
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo completar la acción'), 'error');
    }
  };

  // Cargar deudores
  // Trae los clientes con deuda y, aparte, sus boletas a crédito para
  // saber cuáles tienen deuda vencida. Si las boletas llegan cortadas por
  // el tope de filas del servidor, no se usan (mejor no mostrar el
  // vencimiento que mostrarlo mal).
  const recargarDeudores = async () => {
    if (esModoDemo) {
      // No hay servidor real del que traer boletas: Fiados trabaja con los
      // clientes creados en esta misma demo y no muestra vencimientos.
      setBoletasDeudores(null);
      return;
    }
    if (sbClient && bodegaId) {
      setCargandoDeudores(true);
      try {
        const { data } = await sbClient
          .from('clientes')
          .select('*')
          .eq('bodega_id', bodegaId)
          .order('nombre_completo', { ascending: true });

        // Fiados muestra a todos los clientes (para cobrar y para editar sus datos);
        // los boletas a crédito solo se piden de los que deben.
        const todos = data || [];
        setClientesLista(todos);
        const idsDeudores = todos.filter((c) => (Number(c.saldo_actual) || 0) > 0).map((c) => c.id);

        // Las boletas se piden de a 40 clientes, todos los grupos a la vez.
        const grupos = [];
        for (let i = 0; i < idsDeudores.length; i += 40) grupos.push(idsDeudores.slice(i, i + 40));
        const respuestas = await Promise.all(grupos.map((ids) => sbClient
          .from('ventas')
          .select('id, cliente_id, total_venta, fecha_hora')
          .in('cliente_id', ids)
          .eq('medio_pago', 'CREDITO')
          .eq('anulada', false)
          .limit(1000)));
        const completo = grupos.length > 0 && respuestas.every(({ data: boletas, error }) => !error && boletas && boletas.length < 1000);
        const porCliente = {};
        if (completo) {
          respuestas.forEach(({ data: boletas }) => boletas.forEach((b) => { (porCliente[b.cliente_id] = porCliente[b.cliente_id] || []).push(b); }));
        }
        setBoletasDeudores(completo ? porCliente : null);
      } catch (err) {
        console.warn(err);
      } finally {
        setCargandoDeudores(false);
      }
    }
  };

  const abrirModuloCobroDeudas = async () => {
    setModalCobrarDeudas(true);
    setDeudorSeleccionado(null);
    setClienteEditando(null);
    setPagoRegistrado(null);
    setBoletasDeudor([]);
    setBusquedaDeudores('');
    setFiltroDeudores('todos');
    setOrdenDeudores('deuda');
    await recargarDeudores();
  };

  // Últimos pagos que hizo el cliente (los que ya se guardan en
  // pagos_credito al registrar un abono).
  const cargarPagosRecientes = async (cliente) => {
    try {
      const { data } = await sbClient
        .from('pagos_credito')
        .select('monto_pagado, fecha, cajero_id')
        .eq('cliente_id', cliente.id)
        .order('fecha', { ascending: false })
        .limit(3);
      setPagosRecientes(data || []);
    } catch (err) {
      console.warn(err);
    }
  };

  return {
    abrirModuloCobroDeudas, cargarPagosRecientes, handleGuardarNuevoCliente,
    obtenerOCrearCliente, recargarDeudores
  };
}
