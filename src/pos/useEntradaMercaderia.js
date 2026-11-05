// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { generarCodigoInterno, mensajeError } from './utilidades.js';
import { generarSKU } from '../PanelAdminCompartido.jsx';

export default function useEntradaMercaderia({
  bodegaId, cajeroSeleccionado, cargarProductos, catalogoDemoInicial, catalogoDemoRef,
  categoriasDB, compraCabecera, compraItemTemp, compraItems, esModoDemo, guardandoEntrada,
  idsNuevosCompra, notificar, nuevoProductoInlineCompra, pedirConfirmacion, productos,
  proveedoresLista, refrescarProductosPorId, sbClient, setBusquedaCompra, setCompraCabecera,
  setCompraItemTemp, setCompraItems, setEntradaRegistrada, setFiltroCompra,
  setGuardandoEntrada, setGuardandoProductoInlineCompra, setIdsNuevosCompra,
  setModalEntradaMercaderia, setNuevoProductoInlineCompra, setProductos, setProveedoresLista,
  setResaltadoCompra
}) {
  // ==========================================
  // ENTRADA DE MERCADERÍA (COMPRAS)
  // ==========================================

  // Ficha rápida de producto, sin salir de "Entrada de Mercadería":
  // solo lo esencial para poder seguir cargando la entrada (EAN/SKU se
  // autogeneran, igual que en los demás formularios de creación). Si
  // después hace falta el EAN real, pack, etc., se completa desde
  // "Editar Producto".
  const crearProductoInlineCompra = async () => {
    const f = nuevoProductoInlineCompra;
    if (!f || !f.descripcion.trim() || !f.precio_venta) {
      notificar('Completa la descripción y el precio de venta.', 'error');
      return;
    }
    setGuardandoProductoInlineCompra(true);
    try {
      const payload = {
        bodega_id: bodegaId,
        descripcion: f.descripcion.trim(),
        cod_ean: generarCodigoInterno(),
        sku: generarSKU(f.categoria),
        categoria: f.categoria.trim() || 'General',
        precio_costo: Number(f.precio_costo) || 0,
        precio_venta: Number(f.precio_venta) || 0,
        unidad: f.unidad === 'KG' ? 'KG' : 'UND',
        stock_actual: 0
      };
      let nuevoProd = null;
      if (esModoDemo) {
        if (!catalogoDemoRef.current) catalogoDemoRef.current = catalogoDemoInicial();
        const siguienteId = catalogoDemoRef.current.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
        nuevoProd = { id: String(siguienteId), activo: true, unidades_por_pack: 1, cod_ean_pack: '', ...payload };
        catalogoDemoRef.current = [...catalogoDemoRef.current, nuevoProd];
      } else if (sbClient) {
        const { data, error } = await sbClient.from('productos').insert([payload]).select().single();
        if (error) throw error;
        nuevoProd = data;
      }
      if (nuevoProd) {
        // Se agrega al catálogo en memoria al toque -- no hay que
        // esperar un refetch completo solo para poder seleccionarlo.
        setProductos((prev) => [...prev, nuevoProd]);
        setIdsNuevosCompra((prev) => [...prev, nuevoProd.id]);
        setCompraItemTemp({ productoId: nuevoProd.id, cantidad: '', costoUnitario: payload.precio_costo > 0 ? String(payload.precio_costo) : '', tipo: 'UNIDAD' });
        setBusquedaCompra('');
      }
      setNuevoProductoInlineCompra(null);
      notificar(`Producto "${payload.descripcion}" creado. Ya lo puedes agregar a la entrada.`, 'success');
    } catch (err) {
      notificar(mensajeError(err, 'Error al crear el producto'), 'error');
    } finally {
      setGuardandoProductoInlineCompra(false);
    }
  };

  // Arma una línea de la entrada a partir de lo que escribe la persona:
  // cantidad y costo "por pack" o "por unidad". El proveedor a veces
  // entrega en packs cerrados (ej: 10 packs de 6) pero el stock siempre se
  // guarda en unidades sueltas -- por eso se convierte aquí, así el
  // usuario solo escribe "10 packs" y no tiene que calcular a mano que
  // son 60 unidades.
  const armarLineaEntrada = (prod, esPack, cant, costo) => {
    const unidadesPorPack = Number(prod.unidades_por_pack) || 1;
    const pack = esPack && unidadesPorPack > 1;
    return {
      productoId: prod.id,
      descripcion: prod.descripcion,
      cantidad: cant,
      cantidadStock: pack ? cant * unidadesPorPack : cant,
      esPack: pack,
      unidadesPorPack,
      costoUnitario: pack ? costo / unidadesPorPack : costo,
      costoIngresado: costo,
      subtotal: +(cant * costo).toFixed(2)
    };
  };

  // Elige un producto del buscador (o del escáner): deja listo el costo
  // del último que se pagó, para que solo haya que escribir la cantidad.
  const elegirProductoEntrada = (prod, esPack = false) => {
    const uds = Number(prod.unidades_por_pack) || 1;
    const pack = esPack && uds > 1;
    const costo = Number(prod.precio_costo) || 0;
    setCompraItemTemp({
      productoId: prod.id,
      cantidad: '',
      costoUnitario: costo > 0 ? String(Math.round((pack ? costo * uds : costo) * 100) / 100) : '',
      tipo: pack ? 'PACK' : 'UNIDAD'
    });
    setBusquedaCompra('');
    setNuevoProductoInlineCompra(null);
  };

  // Al pasar de "unidades sueltas" a "packs" el costo escrito se convierte
  // (y al revés), para que siga siendo el mismo precio.
  const cambiarTipoEntrada = (tipo) => {
    const prod = productos.find((p) => p.id === compraItemTemp.productoId);
    if (!prod || tipo === compraItemTemp.tipo) return;
    const uds = Number(prod.unidades_por_pack) || 1;
    const c = Number(compraItemTemp.costoUnitario) || 0;
    const costoNuevo = c > 0 ? String(Math.round((tipo === 'PACK' ? c * uds : c / uds) * 100) / 100) : compraItemTemp.costoUnitario;
    setCompraItemTemp({ ...compraItemTemp, tipo, costoUnitario: costoNuevo });
  };

  const abrirProductoNuevoEntrada = (nombre) => {
    setNuevoProductoInlineCompra({
      descripcion: nombre,
      categoria: categoriasDB.includes('Abarrotes') ? 'Abarrotes' : (categoriasDB[0] || 'General'),
      precio_costo: '',
      precio_venta: '',
      unidad: 'UND'
    });
  };

  const agregarItemEntradaMercaderia = () => {
    const prod = productos.find(p => p.id === compraItemTemp.productoId);
    const cant = Number(compraItemTemp.cantidad) || 0;
    const costo = Number(compraItemTemp.costoUnitario) || 0;
    if (!prod || costo <= 0 || cant <= 0) {
      notificar('Selecciona producto, cantidad y costo unitario.', 'error');
      return;
    }
    const esPack = compraItemTemp.tipo === 'PACK';
    const linea = armarLineaEntrada(prod, esPack, cant, costo);
    setCompraItems(prev => {
      // Si ya está la misma línea (mismo producto, forma de entrega y
      // costo), se suma la cantidad en vez de repetirla.
      const i = prev.findIndex((it) => it.productoId === prod.id && it.esPack === linea.esPack && it.costoIngresado === costo);
      if (i < 0) return [...prev, linea];
      return prev.map((it, k) => (k === i ? armarLineaEntrada(prod, esPack, Math.round((it.cantidad + cant) * 100) / 100, costo) : it));
    });
    setCompraItemTemp({ productoId: '', cantidad: '', costoUnitario: '', tipo: 'UNIDAD' });
    setBusquedaCompra('');
    notificar(`${prod.descripcion} añadido a la entrada`, 'success');
  };

  // Corrige la cantidad o el costo de una línea ya añadida.
  const editarLineaEntrada = (idx, campo, valor) => {
    setCompraItems(prev => prev.map((it, k) => {
      if (k !== idx) return it;
      const prod = productos.find((p) => p.id === it.productoId) || { id: it.productoId, descripcion: it.descripcion, unidades_por_pack: it.unidadesPorPack };
      const cant = campo === 'cantidad' ? Math.max(0, Number(valor) || 0) : it.cantidad;
      const costo = campo === 'costo' ? Math.max(0, Number(valor) || 0) : it.costoIngresado;
      return armarLineaEntrada(prod, it.esPack, cant, costo);
    }));
  };

  const quitarItemEntradaMercaderia = (idx) => {
    setCompraItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Deja la entrada en blanco (sin cerrar el módulo).
  const vaciarEntradaMercaderia = () => {
    setCompraItems([]);
    setCompraCabecera({ proveedor: '', ruc: '', nroComprobante: '' });
    setCompraItemTemp({ productoId: '', cantidad: '', costoUnitario: '', tipo: 'UNIDAD' });
    setNuevoProductoInlineCompra(null);
    setBusquedaCompra('');
    setFiltroCompra('todos');
    setResaltadoCompra(0);
    setIdsNuevosCompra([]);
  };

  // Cierra el modal descartando lo que no se haya confirmado -- si no se
  // limpia este estado, reabrir el modal muestra el proveedor y los
  // productos ya agregados de la vez anterior, y se pueden duplicar.
  const cerrarModalEntradaMercaderia = () => {
    setModalEntradaMercaderia(false);
    setEntradaRegistrada(null);
    vaciarEntradaMercaderia();
  };

  // Cierra con aviso si hay algo anotado que todavía no se confirmó.
  const pedirCerrarEntrada = async () => {
    const hayAlgo = compraItems.length > 0 || compraCabecera.proveedor.trim() || compraCabecera.nroComprobante.trim();
    if (hayAlgo) {
      const ok = await pedirConfirmacion({
        titulo: '¿Descartar esta entrada?',
        mensaje: compraItems.length > 0
          ? `Anotaste ${compraItems.length} producto${compraItems.length === 1 ? '' : 's'} que todavía no se confirmaron. Si sales ahora, se pierden.`
          : 'Si sales ahora, se pierden los datos escritos.',
        textoBoton: 'Descartar',
        peligroso: true
      });
      if (!ok) return;
    }
    cerrarModalEntradaMercaderia();
  };

  // Abre el módulo y, si hace falta, trae los nombres de proveedores
  // para sugerirlos al escribir (los mismos de "Cuentas por Pagar").
  const abrirEntradaMercaderia = async () => {
    setEntradaRegistrada(null);
    setModalEntradaMercaderia(true);
    if (sbClient && bodegaId && proveedoresLista.length === 0) {
      try {
        const { data } = await sbClient.from('proveedores').select('*').eq('bodega_id', bodegaId).order('saldo_actual', { ascending: false });
        if (data) setProveedoresLista(data);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const guardarEntradaMercaderia = async () => {
    if (guardandoEntrada) return;
    if (compraItems.length === 0) {
      notificar('Agrega productos a la compra.', 'error');
      return;
    }
    if (compraItems.some((i) => !(i.cantidad > 0) || !(i.costoIngresado > 0))) {
      notificar('Revisa las líneas: la cantidad y el costo deben ser mayores a 0.', 'error');
      return;
    }
    const totalCompra = compraItems.reduce((acc, i) => acc + i.subtotal, 0);
    const unidadesTotal = compraItems.reduce((acc, i) => acc + Number(i.cantidadStock ?? i.cantidad), 0);
    const subidas = compraItems.filter((it) => {
      const prod = productos.find((p) => p.id === it.productoId);
      const prev = prod && !idsNuevosCompra.includes(prod.id) ? Number(prod.precio_costo) || 0 : 0;
      return prev > 0 && (it.costoUnitario - prev) / prev >= 0.10;
    }).length;
    const ok = await pedirConfirmacion({
      titulo: '¿Confirmar la entrada?',
      mensaje: `Se sumarán ${Math.round(unidadesTotal * 100) / 100} unidades al stock de ${compraItems.length} producto${compraItems.length > 1 ? 's' : ''} y se guardará el costo nuevo. Total de la compra: S/ ${totalCompra.toFixed(2)}.${subidas ? ` ${subidas} producto${subidas > 1 ? 's' : ''} subió de costo más de 10%.` : ''}`,
      textoBoton: 'Sí, confirmar'
    });
    if (!ok) return;
    // Foto de cómo queda el stock, para la pantalla final.
    const resumen = {
      proveedor: compraCabecera.proveedor.trim(),
      comprobante: compraCabecera.nroComprobante.trim() || 'Se asignó uno automático',
      total: totalCompra,
      unidades: unidadesTotal,
      lineas: compraItems.map((it) => {
        const prod = productos.find((p) => p.id === it.productoId);
        const antes = !prod || prod.stock_actual === null || prod.stock_actual === undefined || prod.stock_actual === '' ? null : Number(prod.stock_actual);
        return { descripcion: it.descripcion, unidad: prod?.unidad, antes, despues: (antes || 0) + Number(it.cantidadStock ?? it.cantidad) };
      })
    };

    setGuardandoEntrada(true);
    try {
      if (esModoDemo) {
        if (catalogoDemoRef.current) {
          const incrementosPorId = new Map();
          const costoPorId = new Map();
          compraItems.forEach((it) => {
            const unidadesStock = Number(it.cantidadStock ?? it.cantidad);
            incrementosPorId.set(it.productoId, (incrementosPorId.get(it.productoId) || 0) + unidadesStock);
            costoPorId.set(it.productoId, it.costoUnitario);
          });
          catalogoDemoRef.current = catalogoDemoRef.current.map((p) => {
            if (!incrementosPorId.has(p.id)) return p;
            return {
              ...p,
              stock_actual: (Number(p.stock_actual) || 0) + incrementosPorId.get(p.id),
              precio_costo: costoPorId.get(p.id)
            };
          });
        }
      } else if (sbClient) {
        // Todo en una transacción (registrar_entrada_mercaderia.sql): compra,
        // detalle, stock y costo, en un solo viaje de red.
        const { error: errEntrada } = await sbClient.rpc('registrar_entrada_mercaderia', {
          p_compra: {
            cajero_id: cajeroSeleccionado?.id || null,
            proveedor_nombre: compraCabecera.proveedor || null,
            nro_factura: compraCabecera.nroComprobante || null,
            total: totalCompra,
          },
          p_items: compraItems.map((it) => ({
            producto_id: it.productoId,
            cantidad: it.cantidad,
            costo_unitario: it.costoUnitario,
            subtotal: it.subtotal,
            unidades_stock: Number(it.cantidadStock ?? it.cantidad),
          })),
        });
        const sinFuncion = errEntrada && (errEntrada.code === 'PGRST202' || errEntrada.code === '42883');
        if (errEntrada && !sinFuncion) throw errEntrada;
        if (sinFuncion) {
          // La función todavía no se ejecutó en Supabase: camino anterior.
          const { data: cData, error: cErr } = await sbClient
            .from('compras')
            .insert([{
              bodega_id: bodegaId,
              cajero_id: cajeroSeleccionado?.id,
              proveedor_nombre: compraCabecera.proveedor || null,
              nro_factura: compraCabecera.nroComprobante || `COMP-${Date.now().toString().slice(-6)}`,
              total: totalCompra,
              fecha_registro: new Date().toISOString()
            }])
            .select()
            .single();

          if (cErr) throw cErr;

          const detalles = compraItems.map(item => ({
            compra_id: cData.id,
            bodega_id: bodegaId,
            producto_id: item.productoId,
            cantidad: item.cantidad,
            costo_unitario: item.costoUnitario,
            subtotal: item.subtotal
          }));
          const { error: detErr } = await sbClient.from('compras_detalle').insert(detalles);
          if (detErr) throw detErr;

          // Actualizar precio de costo y sumar el stock recibido en cada
          // producto (el stock se ajusta de forma atómica por separado).
          // Si el producto no tenía seguimiento de stock (null), la propia
          // entrada de mercadería lo inicializa con lo recibido.
          // Cada línea de la compra es un producto distinto -- se procesan
          // todas a la vez en vez de esperar una por una (una factura con
          // 30 líneas antes hacía 30 viajes de red seguidos).
          await Promise.all(compraItems.map(async (it) => {
            const unidadesStock = Number(it.cantidadStock ?? it.cantidad);
            // ajustar_stock_inicializando suma y, si el producto no tenía stock
            // (null), lo inicializa, todo en una sola sentencia (sin carrera).
            // Si esa función todavía no existe, se usa el camino anterior.
            const { error: errInicializando } = await sbClient.rpc('ajustar_stock_inicializando', { p_producto_id: it.productoId, p_delta: unidadesStock });
            if (errInicializando) {
              const { data: nuevoStock } = await sbClient.rpc('ajustar_stock', { p_producto_id: it.productoId, p_delta: unidadesStock });
              if (nuevoStock === null) {
                await sbClient.from('productos').update({ stock_actual: unidadesStock }).eq('id', it.productoId);
              }
            }
            await sbClient.from('productos').update({ precio_costo: it.costoUnitario }).eq('id', it.productoId);
          }));
        }
      }

      const idsEntrada = compraItems.map((it) => it.productoId);
      vaciarEntradaMercaderia();
      setEntradaRegistrada(resumen);
      // Solo se vuelven a leer los productos de la entrada (no todo el catálogo).
      // Si alguno se creó recién en esta entrada y aún no está en la grilla, sí se recarga todo.
      if (idsEntrada.some((id) => !productos.some((p) => p.id === id))) cargarProductos();
      else refrescarProductosPorId(idsEntrada);
    } catch (err) {
      notificar(mensajeError(err, 'Error al registrar la entrada'), 'error');
    } finally {
      setGuardandoEntrada(false);
    }
  };

  return {
    abrirEntradaMercaderia, abrirProductoNuevoEntrada, agregarItemEntradaMercaderia,
    cambiarTipoEntrada, cerrarModalEntradaMercaderia, crearProductoInlineCompra,
    editarLineaEntrada, elegirProductoEntrada, guardarEntradaMercaderia, pedirCerrarEntrada,
    quitarItemEntradaMercaderia
  };
}
