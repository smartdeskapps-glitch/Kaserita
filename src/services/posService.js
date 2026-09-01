import { supabase } from '../lib/supabase';

/**
 * SERVICIO DE PUNTO DE VENTA (POS) - MULTI-TIENDA
 */
export const posService = {
  /**
   * 1. Cargar catálogo de productos por bodega.
   */
  async obtenerProductos(bodegaId, terminoBusqueda = '') {
    try {
      let query = supabase
        .from('productos')
        .select('*')
        .eq('bodega_id', bodegaId)
        .order('descripcion', { ascending: true });

      if (terminoBusqueda.trim()) {
        const busqueda = terminoBusqueda.trim();
        query = query.or(
          `cod_ean.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%,categoria.ilike.%${busqueda}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener productos:', error.message);
      throw error;
    }
  },

  /**
   * 2. Buscar cliente por DNI o asignar 'Desconocido' (99999999).
   */
  async buscarOCrearCliente(bodegaId, dni = '99999999') {
    try {
      const dniLimpio = (dni || '').trim() || '99999999';

      const { data: cliente, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('bodega_id', bodegaId)
        .eq('dni', dniLimpio)
        .maybeSingle();

      if (error) throw error;
      if (cliente) return cliente;

      const nuevoCliente = {
        bodega_id: bodegaId,
        dni: dniLimpio,
        nombre_completo: dniLimpio === '99999999' ? 'Desconocido' : `CLIENTE DNI ${dniLimpio}`,
        saldo_actual: 0.00
      };

      const { data: clienteCreado, error: insertError } = await supabase
        .from('clientes')
        .insert([nuevoCliente])
        .select()
        .single();

      if (insertError) throw insertError;
      return clienteCreado;
    } catch (error) {
      console.error('Error al buscar o crear cliente:', error.message);
      throw error;
    }
  },

  /**
   * 3. Obtener el turno de caja abierto actual.
   */
  async obtenerTurnoActivo(bodegaId, cajeroId = null) {
    try {
      // Un turno se considera abierto si su estado lo indica O si aún no tiene fecha_cierre
      // (esto último es el indicador más confiable, independiente de qué variante de texto
      // haya quedado guardada en `estado`).
      let query = supabase
        .from('turnos_caja')
        .select('*')
        .eq('bodega_id', bodegaId)
        .or('estado.ilike.%abierto%,estado.ilike.%open%,estado.ilike.%activo%,fecha_cierre.is.null')
        .order('fecha_apertura', { ascending: false })
        .limit(1);

      if (cajeroId) {
        query = query.eq('cajero_id', cajeroId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al verificar turno de caja:', error.message);
      throw error;
    }
  },

  /**
   * 4. Abrir turno de caja.
   */
  async abrirTurnoCaja({ bodegaId, cajeroId, montoInicial = 0 }) {
    try {
      const turnoExistente = await this.obtenerTurnoActivo(bodegaId, cajeroId);
      if (turnoExistente) return turnoExistente;

      const fechaApertura = new Date().toISOString();
      const monto = Number(montoInicial) || 0;

      const resDefault = await supabase
        .from('turnos_caja')
        .insert([{
          bodega_id: bodegaId,
          cajero_id: cajeroId,
          fecha_apertura: fechaApertura,
          monto_inicial: monto,
          ventas_sistema: 0.00
        }])
        .select()
        .single();

      if (!resDefault.error && resDefault.data) {
        return resDefault.data;
      }

      const variantes = ['abierto', 'ABIERTO', 'open', 'OPEN', 'activo', 'ACTIVO'];
      let errorFinal = null;

      for (const est of variantes) {
        const res = await supabase
          .from('turnos_caja')
          .insert([{
            bodega_id: bodegaId,
            cajero_id: cajeroId,
            fecha_apertura: fechaApertura,
            monto_inicial: monto,
            ventas_sistema: 0.00,
            estado: est
          }])
          .select()
          .single();

        if (!res.error && res.data) {
          return res.data;
        }
        errorFinal = res.error;
      }

      throw errorFinal || new Error('No se pudo abrir turno en turnos_caja.');
    } catch (error) {
      console.error('Error al abrir turno de caja:', error.message);
      throw error;
    }
  },

  /**
   * 5. Cerrar turno de caja con Arqueo (Cuadre de Efectivo).
   */
  async cerrarTurnoConArqueo({
    turnoId,
    montoFinalReal = 0,
    montoInicial = 0,
    ventasEfectivo = 0
  }) {
    try {
      const fechaCierre = new Date().toISOString();
      const esperado = Number(montoInicial) + Number(ventasEfectivo);
      const real = Number(montoFinalReal);
      const diferencia = real - esperado;

      const variantes = ['cerrado', 'CERRADO', 'closed', 'CLOSED', 'inactivo', 'INACTIVO'];

      for (const est of variantes) {
        const { data, error } = await supabase
          .from('turnos_caja')
          .update({
            fecha_cierre: fechaCierre,
            monto_final_real: real,
            ventas_sistema: Number(ventasEfectivo),
            diferencia: diferencia,
            estado: est
          })
          .eq('id', turnoId)
          .select()
          .single();

        if (!error && data) {
          return {
            turno: data,
            resumen: {
              inicio: Number(montoInicial),
              ventas: Number(ventasEfectivo),
              esperado,
              real,
              diferencia
            }
          };
        }
      }

      throw new Error('No se pudo actualizar el cierre en turnos_caja.');
    } catch (error) {
      console.error('Error al cerrar turno con arqueo:', error.message);
      throw error;
    }
  },

  /**
   * 6. Generar correlativo de boleta.
   */
  async generarNumeroBoleta(bodegaId) {
    try {
      const { count, error } = await supabase
        .from('ventas')
        .select('*', { count: 'exact', head: true })
        .eq('bodega_id', bodegaId);

      if (error) throw error;
      const correlativo = (count || 0) + 1;
      return `B001-${String(correlativo).padStart(8, '0')}`;
    } catch {
      return `B001-${Date.now().toString().slice(-8)}`;
    }
  },

  /**
   * 7. Registrar una venta completa (con soporte para crédito y actualización de saldo).
   */
  async registrarVenta({
    bodegaId,
    turnoCajaId,
    cajeroId,
    clienteId = null,
    nroBoleta = null,
    medioPago = 'EFECTIVO',
    totalVenta,
    items = [],
    montoEfectivo = 0,
    montoOtro = 0
  }) {
    if (!items || items.length === 0) {
      throw new Error('El carrito no puede estar vacío.');
    }

    try {
      let finalClienteId = clienteId;
      if (!finalClienteId) {
        const clienteGenerico = await this.buscarOCrearCliente(bodegaId, '99999999');
        finalClienteId = clienteGenerico.id;
      }

      const finalNroBoleta = nroBoleta || await this.generarNumeroBoleta(bodegaId);

      // A. Insertar Venta
      const payloadVenta = {
        bodega_id: bodegaId,
        turno_caja_id: turnoCajaId || null,
        cajero_id: cajeroId,
        cliente_id: finalClienteId,
        nro_boleta: finalNroBoleta,
        medio_pago: medioPago,
        total_venta: Number(totalVenta),
        monto_efectivo: medioPago === 'MIXTO' ? Number(montoEfectivo) || 0 : 0,
        monto_otro: medioPago === 'MIXTO' ? Number(montoOtro) || 0 : 0
      };

      const { data: ventaCreada, error: ventaError } = await supabase
        .from('ventas')
        .insert([payloadVenta])
        .select()
        .single();

      if (ventaError) throw ventaError;

      // B. Insertar Detalles
      const payloadDetalles = items.map((item) => ({
        venta_id: ventaCreada.id,
        producto_id: typeof item.productoId === 'string' && item.productoId.length > 10 ? item.productoId : null,
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precioUnitario),
        subtotal: Number(item.subtotal)
      }));

      await supabase.from('ventas_detalle').insert(payloadDetalles);

      // C. Si es a CRÉDITO, aumentar el saldo_actual del cliente
      if (medioPago === 'CREDITO' && finalClienteId) {
        const { data: cInfo } = await supabase
          .from('clientes')
          .select('saldo_actual')
          .eq('id', finalClienteId)
          .single();

        const saldoActual = Number(cInfo?.saldo_actual) || 0;
        await supabase
          .from('clientes')
          .update({ saldo_actual: +(saldoActual + Number(totalVenta)).toFixed(2) })
          .eq('id', finalClienteId);
      }

      return {
        venta: ventaCreada,
        detalles: payloadDetalles
      };
    } catch (error) {
      console.error('Error en registrarVenta:', error.message);
      throw error;
    }
  },

  /**
   * 8. Obtener ventas del día de una bodega.
   */
  async obtenerVentasDelDia(bodegaId) {
    try {
      const hoyInicio = new Date();
      hoyInicio.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('ventas')
        .select('*, clientes(nombre_completo, dni), cajeros(nombre), ventas_detalle(*, productos(descripcion, cod_ean))')
        .eq('bodega_id', bodegaId)
        .gte('created_at', hoyInicio.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener ventas del día:', error.message);
      return [];
    }
  },

  /**
   * 9. Anular una venta emitida (soft-delete: conserva historial y trazabilidad).
   */
  async anularVenta(ventaId, motivo = 'Anulación de venta por cajero') {
    try {
      // Obtener datos de la venta
      const { data: venta, error: errV } = await supabase
        .from('ventas')
        .select('*')
        .eq('id', ventaId)
        .single();

      if (errV) throw errV;
      if (venta.anulada) {
        throw new Error('Esta venta ya se encuentra anulada.');
      }

      // Si fue a crédito, descontar la deuda del cliente
      if (venta.medio_pago === 'CREDITO' && venta.cliente_id) {
        const { data: cInfo } = await supabase
          .from('clientes')
          .select('saldo_actual')
          .eq('id', venta.cliente_id)
          .single();

        const saldoActual = Number(cInfo?.saldo_actual) || 0;
        const nuevoSaldo = Math.max(0, +(saldoActual - Number(venta.total_venta)).toFixed(2));
        await supabase
          .from('clientes')
          .update({ saldo_actual: nuevoSaldo })
          .eq('id', venta.cliente_id);
      }

      // Marcar como anulada (no se elimina para mantener el correlativo y el historial)
      const { data: ventaAnulada, error: errUp } = await supabase
        .from('ventas')
        .update({ anulada: true, motivo_anulacion: motivo })
        .eq('id', ventaId)
        .select()
        .single();

      if (errUp) throw errUp;

      return { success: true, ventaAnulada };
    } catch (error) {
      console.error('Error al anular venta:', error.message);
      throw error;
    }
  },

  /**
   * 10. Poner una venta "en espera" (aparcar) guardando el carrito actual.
   */
  async aparcarVenta({ bodegaId, cajeroId, clienteId = null, nombreReferencia = '', items = [], total = 0 }) {
    if (!items || items.length === 0) {
      throw new Error('No hay productos en el carrito para aparcar.');
    }
    try {
      const payload = {
        bodega_id: bodegaId,
        cajero_id: cajeroId,
        cliente_id: clienteId,
        nombre_referencia: nombreReferencia?.trim() || null,
        items,
        total: Number(total) || 0
      };

      const { data, error } = await supabase
        .from('ventas_espera')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al aparcar venta:', error.message);
      throw error;
    }
  },

  /**
   * 11. Listar ventas en espera de una bodega.
   */
  async obtenerVentasEnEspera(bodegaId) {
    try {
      const { data, error } = await supabase
        .from('ventas_espera')
        .select('*')
        .eq('bodega_id', bodegaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al listar ventas en espera:', error.message);
      return [];
    }
  },

  /**
   * 12. Recuperar (y eliminar de la cola) una venta en espera.
   */
  async recuperarVentaEnEspera(ventaEsperaId) {
    try {
      const { data: venta, error: errGet } = await supabase
        .from('ventas_espera')
        .select('*')
        .eq('id', ventaEsperaId)
        .single();

      if (errGet) throw errGet;

      const { error: errDel } = await supabase
        .from('ventas_espera')
        .delete()
        .eq('id', ventaEsperaId);

      if (errDel) throw errDel;

      return venta;
    } catch (error) {
      console.error('Error al recuperar venta en espera:', error.message);
      throw error;
    }
  }
};
