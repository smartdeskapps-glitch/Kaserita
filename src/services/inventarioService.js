import { supabase } from '../lib/supabase';

/**
 * SERVICIO DE INVENTARIO Y ENTRADA DE MERCADERÍA
 */
export const inventarioService = {
  /**
   * 1. Registrar un nuevo producto en el catálogo.
   * @param {Object} params
   * @param {string} params.bodegaId - UUID de la bodega.
   * @param {string} params.descripcion - Nombre o descripción del producto.
   * @param {string} [params.cod_ean] - Código de barras EAN/UPC.
   * @param {number} params.precio_venta - Precio de venta al público.
   * @param {number} [params.precio_costo] - Precio de costo o compra.
   * @param {string} [params.categoria] - Categoría (Abarrotes, Bebidas, etc.).
   * @param {string} [params.unidad_medida] - 'UND' o 'KG'.
   * @returns {Promise<Object>} Producto creado.
   */
  async crearProducto({
    bodegaId,
    descripcion,
    cod_ean = '',
    sku = '',
    precio_venta,
    precio_costo = 0,
    categoria = 'General',
    unidad_medida = 'UND'
  }) {
    try {
      if (!bodegaId || !descripcion?.trim() || !precio_venta) {
        throw new Error('La bodega, descripción y precio de venta son obligatorios.');
      }

      const payload = {
        bodega_id: bodegaId,
        descripcion: descripcion.trim(),
        cod_ean: cod_ean ? cod_ean.trim() : null,
        sku: sku ? sku.trim() : null,
        precio_costo: Number(precio_costo) || 0,
        precio_venta: Number(precio_venta) || 0,
        categoria: categoria ? categoria.trim() : 'General',
        unidad_medida: unidad_medida === 'KG' ? 'KG' : 'UND'
      };

      const { data, error } = await supabase
        .from('productos')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al crear producto:', error.message);
      throw error;
    }
  },

  /**
   * 2. Registrar Entrada de Mercadería (Compras / Abastecimiento).
   * Inserta en `compras` y `compras_detalle`, y actualiza precios de costo en `productos`.
   * @param {Object} params
   * @param {string} params.bodegaId - UUID de la bodega.
   * @param {string} [params.proveedorNombre] - Nombre del proveedor.
   * @param {string} [params.proveedorRuc] - RUC o documento del proveedor.
   * @param {string} [params.nroFactura] - Número de factura / guía / boleta de compra.
   * @param {string} [params.cajeroId] - ID del usuario que registra la entrada.
   * @param {number} params.totalCompra - Importe total de la compra.
   * @param {Array<{productoId: string, cantidad: number, costoUnitario: number, subtotal: number}>} params.items
   * @returns {Promise<{ compra: Object, detalles: Array }>}
   */
  async registrarEntradaMercaderia({
    bodegaId,
    proveedorNombre = 'Proveedor Varios',
    proveedorRuc = '',
    nroFactura = '',
    cajeroId = null,
    totalCompra = 0,
    items = []
  }) {
    if (!items || items.length === 0) {
      throw new Error('Debes agregar al menos un producto a la entrada de mercadería.');
    }

    try {
      // A. Insertar Cabecera de Compra
      const payloadCompra = {
        bodega_id: bodegaId,
        cajero_id: cajeroId || null,
        nro_comprobante: nroFactura.trim() || `COMP-${Date.now().toString().slice(-8)}`,
        total_compra: Number(totalCompra) || 0,
        fecha: new Date().toISOString()
      };

      let compraCreada = null;
      const { data: cData, error: cErr } = await supabase
        .from('compras')
        .insert([payloadCompra])
        .select()
        .single();

      if (cErr) {
        console.warn('Advertencia al insertar en compras:', cErr.message);
        compraCreada = { id: Date.now(), ...payloadCompra };
      } else {
        compraCreada = cData;
      }

      // B. Insertar Detalles de Compra
      const payloadDetalles = items.map(item => ({
        compra_id: compraCreada.id,
        producto_id: item.productoId,
        cantidad: Number(item.cantidad) || 1,
        costo_unitario: Number(item.costoUnitario) || 0,
        subtotal: Number(item.subtotal) || 0
      }));

      const { data: detallesCreados, error: dErr } = await supabase
        .from('compras_detalle')
        .insert(payloadDetalles)
        .select();

      if (dErr) {
        console.warn('Aviso en compras_detalle:', dErr.message);
      }

      // C. Actualizar Precios de Costo en la tabla `productos`
      for (const item of items) {
        if (item.productoId && item.costoUnitario > 0) {
          await supabase
            .from('productos')
            .update({ precio_costo: Number(item.costoUnitario) })
            .eq('id', item.productoId);
        }
      }

      return {
        compra: compraCreada,
        detalles: detallesCreados || payloadDetalles
      };
    } catch (error) {
      console.error('Error al registrar entrada de mercadería:', error.message);
      throw error;
    }
  },

  /**
   * 3. Listar historial de compras / entradas de mercadería.
   * @param {string} bodegaId
   */
  async obtenerHistorialCompras(bodegaId) {
    try {
      const { data, error } = await supabase
        .from('compras')
        .select('*, compras_detalle(*, productos(descripcion, cod_ean))')
        .eq('bodega_id', bodegaId)
        .order('fecha', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al listar compras:', error.message);
      return [];
    }
  }
};
