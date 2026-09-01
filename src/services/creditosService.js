import { supabase } from '../lib/supabase';

/**
 * SERVICIO DE CLIENTES, CRÉDITOS (FIADOS) Y CUENTAS POR COBRAR
 */
export const creditosService = {
  /**
   * 1. Registrar o actualizar un cliente con límite de crédito.
   */
  async guardarCliente({
    bodegaId,
    dni,
    nombre,
    telefono = '',
    correo = '',
    limiteCredito = 200.00
  }) {
    try {
      const dniLimpio = String(dni || '').trim();
      const nombreLimpio = String(nombre || '').trim();

      if (!bodegaId || !dniLimpio || !nombreLimpio) {
        throw new Error('DNI, Nombre y Bodega son obligatorios.');
      }

      // Buscar si ya existe
      const { data: existente } = await supabase
        .from('clientes')
        .select('*')
        .eq('bodega_id', bodegaId)
        .eq('dni', dniLimpio)
        .maybeSingle();

      if (existente) {
        const { data: actualizado, error: errUpdate } = await supabase
          .from('clientes')
          .update({
            nombre_completo: nombreLimpio,
            telefono: telefono ? telefono.trim() : existente.telefono,
            correo: correo ? correo.trim() : existente.correo,
            limite_credito: limiteCredito != null ? Number(limiteCredito) : existente.limite_credito
          })
          .eq('id', existente.id)
          .select()
          .single();

        if (errUpdate) throw errUpdate;
        return actualizado;
      }

      const nuevoCliente = {
        bodega_id: bodegaId,
        dni: dniLimpio,
        nombre_completo: nombreLimpio,
        telefono: telefono ? telefono.trim() : null,
        correo: correo ? correo.trim() : null,
        limite_credito: Number(limiteCredito) || 0,
        saldo_actual: 0.00
      };

      const { data: creado, error: errInsert } = await supabase
        .from('clientes')
        .insert([nuevoCliente])
        .select()
        .single();

      if (errInsert) throw errInsert;
      return creado;
    } catch (error) {
      console.error('Error al guardar cliente:', error.message);
      throw error;
    }
  },

  /**
   * Alias explícito solicitado para el flujo "Nuevo Cliente con Límite de Crédito".
   */
  async crearClienteConCredito(params) {
    return this.guardarCliente(params);
  },

  /**
   * Listar todos los clientes de la bodega (para selección en ventas a crédito).
   */
  async listarClientes(bodegaId) {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('bodega_id', bodegaId)
        .order('nombre_completo', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al listar clientes:', error.message);
      return [];
    }
  },

  /**
   * 2. Validar si el cliente tiene crédito disponible antes de vender a crédito.
   * @param {string} bodegaId
   * @param {string} dni
   * @param {number} totalVenta
   * @param {number} [limiteCreditoMaximo] - Límite por defecto (ej. S/ 300.00).
   */
  async validarCredito(bodegaId, dni, totalVenta, limiteCreditoMaximo = null) {
    try {
      const { data: cliente, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('bodega_id', bodegaId)
        .eq('dni', String(dni).trim())
        .maybeSingle();

      if (error) throw error;
      if (!cliente) {
        return {
          aprobado: false,
          mensaje: 'El cliente no está registrado. Debes crearlo primero para otorgar crédito.',
          cliente: null
        };
      }

      const saldoActual = Number(cliente.saldo_actual) || 0;
      const nuevoSaldo = saldoActual + Number(totalVenta);
      // Usa el límite propio del cliente salvo que se fuerce uno explícito.
      const limite = limiteCreditoMaximo != null ? limiteCreditoMaximo : Number(cliente.limite_credito) || 0;
      const disponible = Math.max(0, limite - saldoActual);

      if (nuevoSaldo > limite) {
        return {
          aprobado: false,
          mensaje: `Límite de crédito excedido. Saldo actual: S/ ${saldoActual.toFixed(2)}, Disponible: S/ ${disponible.toFixed(2)}`,
          saldoActual,
          nuevoSaldo,
          limiteCredito: limite,
          disponible,
          cliente
        };
      }

      return {
        aprobado: true,
        mensaje: 'Crédito aprobado.',
        saldoActual,
        nuevoSaldo,
        limiteCredito: limite,
        disponible,
        cliente
      };
    } catch (error) {
      console.error('Error al validar crédito:', error.message);
      throw error;
    }
  },

  /**
   * 3. Obtener lista de clientes con deuda acumulada (saldo_actual > 0).
   */
  async obtenerClientesConDeuda(bodegaId) {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('bodega_id', bodegaId)
        .gt('saldo_actual', 0)
        .order('saldo_actual', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener clientes con deuda:', error.message);
      return [];
    }
  },

  /**
   * 4. Obtener boletas pendientes de un cliente específico.
   */
  async obtenerBoletasPendientes(bodegaId, clienteId) {
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('*, ventas_detalle(*, productos(descripcion))')
        .eq('bodega_id', bodegaId)
        .eq('cliente_id', clienteId)
        .eq('medio_pago', 'CREDITO')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener boletas pendientes:', error.message);
      return [];
    }
  },

  /**
   * 5. Procesar pago o amortización de deuda.
   * Actualiza el `saldo_actual` del cliente y registra el pago en `pagos_credito`.
   */
  async procesarPagoDeuda({
    bodegaId,
    clienteId,
    cajeroId = null,
    montoPagado,
    medioPago = 'EFECTIVO'
  }) {
    try {
      const monto = Number(montoPagado) || 0;
      if (monto <= 0) throw new Error('El monto a pagar debe ser mayor a 0.');

      // 1. Obtener saldo actual
      const { data: cliente, error: errC } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();

      if (errC) throw errC;

      const saldoAnterior = Number(cliente.saldo_actual) || 0;
      const nuevoSaldo = Math.max(0, +(saldoAnterior - monto).toFixed(2));

      // 2. Actualizar saldo del cliente
      const { data: clienteActualizado, error: errUp } = await supabase
        .from('clientes')
        .update({ saldo_actual: nuevoSaldo })
        .eq('id', clienteId)
        .select()
        .single();

      if (errUp) throw errUp;

      // 3. Registrar comprobante en `pagos_credito`
      const payloadPago = {
        bodega_id: bodegaId,
        cliente_id: clienteId,
        cajero_id: cajeroId,
        monto_pagado: monto,
        saldo_anterior: saldoAnterior,
        saldo_restante: nuevoSaldo,
        medio_pago: medioPago,
        fecha: new Date().toISOString()
      };

      const { data: pagoRegistrado, error: errPago } = await supabase
        .from('pagos_credito')
        .insert([payloadPago])
        .select()
        .maybeSingle();

      if (errPago) {
        console.warn('Aviso en pagos_credito:', errPago.message);
      }

      return {
        cliente: clienteActualizado,
        pago: pagoRegistrado || payloadPago,
        saldoAnterior,
        nuevoSaldo,
        montoPagado: monto
      };
    } catch (error) {
      console.error('Error al procesar pago de deuda:', error.message);
      throw error;
    }
  }
};
