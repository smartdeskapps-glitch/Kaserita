// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { useCallback } from 'react';
import { datosFormularioDesdeProducto, generarCodigoInterno, normalizarCamposPack, mensajeError } from './utilidades.js';
import { esMontoNoNegativo } from '../lib/validaciones.js';
import { generarSKU } from '../PanelAdminCompartido.jsx';

export default function useEditarProducto({
  busqueda, cargarProductos, catalogoDemoRef, esBarberia, esModoDemo, formEditarProducto,
  notificar, pedirConfirmacion, productoEditando, sbClient, setFormEditarOriginal,
  setFormEditarProducto, setGuardandoEdicionProducto, setModalEditarProducto,
  setProductoEditando, setTabEditarProducto
}) {
  // ==========================================
  // EDITAR / DESACTIVAR PRODUCTO
  // ==========================================
  const abrirEdicionProducto = useCallback((prod) => {
    const inicial = {
      ...datosFormularioDesdeProducto(prod),
      stock_actual: prod.stock_actual != null ? String(prod.stock_actual) : '',
      visible_en_tienda: prod.visible_en_tienda !== false,
      duracion_min: prod.duracion_min != null ? String(prod.duracion_min) : ''
    };
    setProductoEditando(prod);
    setFormEditarProducto(inicial);
    setFormEditarOriginal(inicial);
    setTabEditarProducto('general');
    setModalEditarProducto(true);
  }, []);

  const guardarEdicionProducto = async () => {
    if (!productoEditando || !formEditarProducto) return;
    if (!formEditarProducto.descripcion.trim() || !formEditarProducto.precio_venta) {
      notificar('Descripción y Precio de Venta son obligatorios.', 'error');
      return;
    }
    if (!(Number(formEditarProducto.precio_venta) > 0)) {
      notificar('El precio de venta debe ser mayor que 0.', 'error');
      return;
    }
    if (!esMontoNoNegativo(formEditarProducto.precio_costo)) {
      notificar('El precio de costo no puede ser negativo.', 'error');
      return;
    }
    if (!esMontoNoNegativo(formEditarProducto.stock_actual)) {
      notificar('El stock no puede ser negativo.', 'error');
      return;
    }
    // Barbería: un servicio (sin stock) puede llevar su duración en minutos para la agenda.
    const duracionServicio = esBarberia && formEditarProducto.stock_actual === '' && String(formEditarProducto.duracion_min || '').trim() !== ''
      ? Number(formEditarProducto.duracion_min)
      : null;
    if (duracionServicio !== null && !(Number.isInteger(duracionServicio) && duracionServicio >= 5 && duracionServicio <= 480)) {
      notificar('La duración debe ser un número entero de minutos, entre 5 y 480.', 'error');
      return;
    }
    setGuardandoEdicionProducto(true);
    try {
      const payload = {
        descripcion: formEditarProducto.descripcion.trim(),
        cod_ean: formEditarProducto.cod_ean.trim() || generarCodigoInterno(),
        sku: formEditarProducto.sku.trim() || generarSKU(formEditarProducto.categoria),
        categoria: formEditarProducto.categoria.trim() || 'General',
        precio_costo: Number(formEditarProducto.precio_costo) || 0,
        precio_venta: Number(formEditarProducto.precio_venta) || 0,
        unidad: formEditarProducto.unidad === 'KG' ? 'KG' : 'UND',
        stock_actual: formEditarProducto.stock_actual === '' ? null : Number(formEditarProducto.stock_actual),
        foto_url: formEditarProducto.foto_url || null,
        fotos_extra: formEditarProducto.fotos_extra && formEditarProducto.fotos_extra.length ? formEditarProducto.fotos_extra : null,
        descripcion_larga: formEditarProducto.descripcion_larga.trim() || null,
        es_destacado: !!formEditarProducto.es_destacado,
        // Solo barbería: esconder el producto de la tienda en línea sin desactivarlo
        // (productos.visible_en_tienda, ver migration_43 de KaseritaDelivery).
        ...(esBarberia ? { visible_en_tienda: formEditarProducto.visible_en_tienda !== false, duracion_min: duracionServicio } : {}),
        ...normalizarCamposPack(formEditarProducto)
      };
      if (esModoDemo) {
        if (catalogoDemoRef.current) {
          catalogoDemoRef.current = catalogoDemoRef.current.map((p) =>
            p.id === productoEditando.id ? { ...p, ...payload } : p
          );
        }
      } else if (sbClient) {
        const { error } = await sbClient.from('productos').update(payload).eq('id', productoEditando.id);
        if (error) throw error;
      }
      setModalEditarProducto(false);
      setProductoEditando(null);
      cargarProductos(busqueda);
      notificar('Producto actualizado.', 'success');
    } catch (err) {
      notificar(mensajeError(err, 'Error al guardar'), 'error');
    } finally {
      setGuardandoEdicionProducto(false);
    }
  };

  const desactivarProducto = async () => {
    if (!productoEditando) return;
    const ok = await pedirConfirmacion({
      titulo: 'Quitar producto',
      mensaje: `¿Quitar "${productoEditando.descripcion}" de tus productos? No se borra tu historial de ventas, solo deja de aparecer para vender.`,
      textoBoton: 'Quitar producto',
      peligroso: true
    });
    if (!ok) return;
    try {
      if (esModoDemo) {
        if (catalogoDemoRef.current) {
          catalogoDemoRef.current = catalogoDemoRef.current.map((p) => (p.id === productoEditando.id ? { ...p, activo: false } : p));
        }
      } else if (sbClient) {
        const { error } = await sbClient.from('productos').update({ activo: false }).eq('id', productoEditando.id);
        if (error) throw error;
      }
      setModalEditarProducto(false);
      setProductoEditando(null);
      cargarProductos(busqueda);
      notificar('Producto quitado de tus productos.', 'info');
    } catch (err) {
      notificar(mensajeError(err, 'Error al quitar el producto'), 'error');
    }
  };

  return {
    abrirEdicionProducto, desactivarProducto, guardarEdicionProducto
  };
}
