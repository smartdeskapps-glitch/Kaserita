// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { mensajeError } from './utilidades.js';

export default function useMermasYToma({
  bodegaId, busqueda, cajeroSeleccionado, cargarProductos, catalogoDemoRef,
  claveConteoGuardado, esModoDemo, filasTomaInventario, formMerma, notificar,
  pedirConfirmacion, productoEscaneadoId, productos, sbClient, setBusquedaMerma,
  setConteoFisicoBusqueda, setFilaEscaneandoIndex, setFilasTomaInventario,
  setFocoPendienteConteo, setFormMerma, setGuardandoMerma, setGuardandoTomaInventario,
  setMetodoForzado, setModalEscaner, setModalMerma, setModalTomaInventario, setModoEscaner,
  setPasoTomaInventario, setProductoEscaneadoId, setTomaInventarioBusqueda,
  setTomaInventarioCategoria
}) {
  // ==========================================
  // MERMAS (pérdidas de producto: vencido, roto, robado, etc.)
  // ==========================================
  const cerrarModalMerma = () => {
    setModalMerma(false);
    setBusquedaMerma('');
    setFormMerma({ productoId: '', cantidad: '', motivo: 'Vencido', motivoOtro: '' });
  };

  const abrirEscanerParaMerma = () => {
    setModoEscaner('merma');
    setFilaEscaneandoIndex(null);
    setMetodoForzado(null);
    setModalEscaner(true);
  };

  // Elige el producto de la merma (por búsqueda o por código escaneado) y
  // arranca la cantidad en 1 para que el botón quede listo.
  const elegirProductoMerma = (prod) => {
    setFormMerma((f) => ({ ...f, productoId: prod.id, cantidad: f.productoId === prod.id && f.cantidad ? f.cantidad : '1' }));
    setBusquedaMerma('');
  };

  const registrarMermaProducto = async () => {
    const prod = productos.find((p) => p.id === formMerma.productoId);
    const cant = Number(formMerma.cantidad) || 0;
    if (!prod || cant <= 0) {
      notificar('Selecciona un producto y una cantidad válida.', 'error');
      return;
    }
    const detalleOtro = (formMerma.motivoOtro || '').trim();
    if (formMerma.motivo === 'Otro' && !detalleOtro) {
      notificar('Escribe el motivo de la merma.', 'error');
      return;
    }
    const motivoFinal = formMerma.motivo === 'Otro' ? `Otro: ${detalleOtro}` : formMerma.motivo;
    setGuardandoMerma(true);
    try {
      const totalCosto = +(cant * (Number(prod.precio_costo) || 0)).toFixed(2);
      let errorAjusteStock = null;
      if (esModoDemo) {
        if (catalogoDemoRef.current) {
          catalogoDemoRef.current = catalogoDemoRef.current.map((p) => (p.id === prod.id ? { ...p, stock_actual: Math.max(0, (Number(p.stock_actual) || 0) - cant) } : p));
        }
      } else if (sbClient) {
        const { error } = await sbClient.from('mermas').insert([{
          bodega_id: bodegaId,
          producto_id: prod.id,
          cajero_id: cajeroSeleccionado?.id || null,
          fecha: new Date().toISOString(),
          cantidad: cant,
          motivo: motivoFinal,
          total_costo: totalCosto
        }]);
        if (error) throw error;

        // Descuenta la merma del stock, igual que una venta (ajuste atómico)
        const { error: errAjuste } = await sbClient.rpc('ajustar_stock', { p_producto_id: prod.id, p_delta: -cant });
        if (errAjuste) console.warn('Error al ajustar stock por merma:', errAjuste);
        errorAjusteStock = errAjuste;
      }
      cerrarModalMerma();
      cargarProductos(busqueda);
      if (errorAjusteStock) {
        notificar(`Merma registrada, pero el stock no se pudo ajustar. Revísalo en la búsqueda de productos.`, 'error');
      } else {
        notificar(`Merma registrada: ${cant} x ${prod.descripcion} (S/ ${totalCosto.toFixed(2)}).`, 'info');
      }
    } catch (err) {
      notificar(mensajeError(err, 'Error al registrar la merma'), 'error');
    } finally {
      setGuardandoMerma(false);
    }
  };

  // --- Módulo: Toma de Inventario (conteo físico vs. sistema) ---
  // Paso 1 (conteo): arranca vacío -- cada producto se busca y se agrega
  // a mano a medida que se cuenta de verdad en el estante, en vez de
  // partir de los ~300 productos de la bodega ya listados (eso invitaba
  // a copiar el número que ya mostraba el sistema en vez de contar).
  const abrirTomaInventario = async () => {
    let restaurado = [];
    // Primero Supabase (el respaldo más confiable -- sobrevive a un
    // celular perdido o a la caché borrada); si no hay nada ahí (sin
    // internet en este momento, por ejemplo), se usa lo último guardado
    // en este mismo navegador.
    if (!esModoDemo && sbClient && bodegaId) {
      try {
        const { data } = await sbClient
          .from('tomas_inventario_borrador')
          .select('datos')
          .eq('bodega_id', bodegaId)
          .maybeSingle();
        if (Array.isArray(data?.datos) && data.datos.length > 0) restaurado = data.datos;
      } catch {}
    }
    if (restaurado.length === 0) {
      try {
        const guardado = localStorage.getItem(claveConteoGuardado());
        if (guardado) restaurado = JSON.parse(guardado) || [];
      } catch {}
    }
    setFilasTomaInventario(restaurado);
    setPasoTomaInventario('conteo');
    setTomaInventarioCategoria('');
    setTomaInventarioBusqueda('');
    setConteoFisicoBusqueda('');
    setModalTomaInventario(true);
    if (restaurado.length > 0) {
      notificar(`Se restauró tu conteo sin terminar: ${restaurado.length} producto(s).`, 'info');
    }
  };

  // Un mismo producto casi nunca está todo junto en un solo lugar de la
  // tienda -- se cuenta un poco en el estante, otro poco en el depósito,
  // etc. Por eso cada producto del conteo guarda un "historial" de
  // hallazgos (cada vez que se agrega una cantidad encontrada en algún
  // lugar) y el total contado es la suma de todos ellos, en vez de un
  // solo número que se pisa cada vez que se vuelve a tocar el producto.
  const agregarProductoAConteo = (producto) => {
    setFilasTomaInventario((prev) => {
      const existente = prev.find((f) => f.productoId === producto.id);
      // El producto tocado (nuevo o reencontrado en otro lugar del
      // local) sube siempre al principio de la lista -- así queda a la
      // vista arriba mientras se sigue contando, y el resto de lo ya
      // contado queda debajo como historial, sin tener que hacer scroll
      // para encontrarlo en un catálogo de cientos de productos.
      if (existente) return [existente, ...prev.filter((f) => f.productoId !== producto.id)];
      return [{
        productoId: producto.id,
        descripcion: producto.descripcion,
        categoria: producto.categoria || 'General',
        stockSistema: Number(producto.stock_actual) || 0,
        historial: [],
        stockContado: '',
        pendientePacks: '',
        // Cuántas unidades trae cada pack -- se precarga con lo que el
        // producto tenga configurado para vender (si tiene), pero es
        // editable: en la práctica cualquier producto puede llegar en
        // caja/paquete aunque no se venda así, así que no depende de
        // esa configuración para poder usar el campo de Packs.
        pendienteUnidadesPorPack: Number(producto.unidades_por_pack) > 1 ? String(producto.unidades_por_pack) : '1',
        pendienteSueltas: ''
      }, ...prev];
    });
    setConteoFisicoBusqueda('');
    // Si el producto ya estaba en la lista (se encontró de nuevo en otro
    // lugar), esto lleva el foco a SU input de "cantidad encontrada aquí"
    // en vez de no hacer nada -- así se puede sumar el nuevo hallazgo al
    // toque, sin tener que buscarlo a mano en la lista.
    setFocoPendienteConteo(producto.id);
  };

  const borrarBorradorConteoRemoto = async () => {
    try { localStorage.removeItem(claveConteoGuardado()); } catch {}
    if (!esModoDemo && sbClient && bodegaId) {
      try { await sbClient.from('tomas_inventario_borrador').delete().eq('bodega_id', bodegaId); } catch {}
    }
  };

  const vaciarConteoInventario = async () => {
    const ok = await pedirConfirmacion({
      titulo: 'Vaciar conteo',
      mensaje: `Se va a borrar todo lo contado hasta ahora (${filasTomaInventario.length} producto(s)). Esto no se puede deshacer.`,
      textoBoton: 'Vaciar todo',
      peligroso: true
    });
    if (!ok) return;
    setFilasTomaInventario([]);
    await borrarBorradorConteoRemoto();
  };

  const quitarProductoDeConteo = (productoId) => {
    setFilasTomaInventario((prev) => prev.filter((f) => f.productoId !== productoId));
  };

  const actualizarPendienteConteo = (productoId, campo, valor) => {
    setFilasTomaInventario((prev) =>
      prev.map((f) => (f.productoId === productoId ? { ...f, [campo]: valor } : f))
    );
  };

  // Confirma lo escrito en Packs/Sueltas como un hallazgo más del
  // historial, y recalcula el total sumando todos los hallazgos. Los
  // dos campos siempre están disponibles para cualquier producto --
  // "Packs" con multiplicador 1 se comporta igual que contar suelto,
  // así que no hace falta un modo separado para productos sin pack.
  const agregarHallazgo = (productoId) => {
    const f = filasTomaInventario.find((x) => x.productoId === productoId);
    if (!f) return;
    const escribioAlgo = f.pendientePacks !== '' || f.pendienteSueltas !== '';
    if (!escribioAlgo) return;
    const porPack = Number(f.pendienteUnidadesPorPack) || 1;
    const cantidad = (Number(f.pendientePacks) || 0) * porPack + (Number(f.pendienteSueltas) || 0);
    setFilasTomaInventario((prev) => {
      const actual = prev.find((x) => x.productoId === productoId);
      if (!actual) return prev;
      const historial = [...actual.historial, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, cantidad }];
      const total = historial.reduce((acc, h) => acc + h.cantidad, 0);
      const actualizado = { ...actual, historial, stockContado: String(total), pendientePacks: '', pendienteSueltas: '' };
      // Sube al principio junto con el resto -- así el producto que se
      // está contando ahora mismo siempre queda arriba, visible sin
      // scroll, y lo demás va quedando como historial debajo.
      return [actualizado, ...prev.filter((x) => x.productoId !== productoId)];
    });
    // Vuelve a enfocar el mismo input -- lo normal es seguir encontrando
    // más de este producto en otros lugares antes de pasar al siguiente.
    setFocoPendienteConteo(productoId);
    // Si se estaba escaneando, el panel de cantidad vive dentro del
    // propio visor de la cámara (que nunca se cerró) -- se limpia acá
    // para que vuelva a mostrar "apunta al siguiente código".
    if (productoId === productoEscaneadoId) setProductoEscaneadoId(null);
  };

  const quitarHallazgo = (productoId, hallazgoId) => {
    setFilasTomaInventario((prev) =>
      prev.map((f) => {
        if (f.productoId !== productoId) return f;
        const historial = f.historial.filter((h) => h.id !== hallazgoId);
        return { ...f, historial, stockContado: historial.length === 0 ? '' : String(historial.reduce((acc, h) => acc + h.cantidad, 0)) };
      })
    );
  };

  // Saca un producto del "Historial" colapsado y lo vuelve a poner como
  // el activo (arriba, con el foco listo) -- para sumarle otro hallazgo
  // sin tener que buscarlo de nuevo.
  const promoverAActivoConteo = (productoId) => {
    setFilasTomaInventario((prev) => {
      const existente = prev.find((f) => f.productoId === productoId);
      if (!existente) return prev;
      return [existente, ...prev.filter((f) => f.productoId !== productoId)];
    });
    setFocoPendienteConteo(productoId);
  };

  // Paso 2 (revisión): recién acá se vuelve a consultar el stock del
  // sistema para lo que se contó -- si pasó tiempo contando (o hubo una
  // venta mientras tanto), la diferencia que se muestra ya es la real y
  // no una foto vieja de cuando se agregó cada producto al conteo.
  const continuarARevisionInventario = async () => {
    if (filasTomaInventario.length === 0) {
      notificar('Agrega al menos un producto al conteo.', 'error');
      return;
    }
    if (!esModoDemo && sbClient) {
      const { data: stockFresco, error } = await sbClient
        .from('productos')
        .select('id, stock_actual')
        .in('id', filasTomaInventario.map((f) => f.productoId));
      if (!error && stockFresco) {
        const stockFrescoPorId = new Map(stockFresco.map((p) => [p.id, Number(p.stock_actual) || 0]));
        setFilasTomaInventario((prev) =>
          prev.map((f) => (stockFrescoPorId.has(f.productoId) ? { ...f, stockSistema: stockFrescoPorId.get(f.productoId) } : f))
        );
      }
    }
    setTomaInventarioCategoria('');
    setTomaInventarioBusqueda('');
    setPasoTomaInventario('revision');
  };

  const actualizarStockContado = (productoId, valor) => {
    setFilasTomaInventario((prev) =>
      prev.map((f) => (f.productoId === productoId ? { ...f, stockContado: valor } : f))
    );
  };

  const guardarTomaInventario = async () => {
    const filas = filasTomaInventario.filter((f) => f.stockContado !== '');
    if (filas.length === 0) {
      notificar('Ingresa la cantidad contada de al menos un producto.', 'error');
      return;
    }
    setGuardandoTomaInventario(true);
    try {
      if (esModoDemo) {
        if (catalogoDemoRef.current) {
          const contadoPorId = new Map(filas.map((f) => [f.productoId, Number(f.stockContado) || 0]));
          catalogoDemoRef.current = catalogoDemoRef.current.map((p) => (contadoPorId.has(p.id) ? { ...p, stock_actual: contadoPorId.get(p.id) } : p));
        }
      } else if (sbClient) {
        // `f.stockSistema` es una foto de cuando se abrió el modal -- si
        // pasó tiempo contando (o hubo una venta/merma mientras tanto),
        // ya no refleja el stock real. Se vuelve a consultar justo antes
        // de calcular la diferencia, para que el ajuste se aplique sobre
        // el número correcto y no sobre uno viejo.
        const idsFilas = filas.map((f) => f.productoId);
        const { data: stockFresco, error: errFresco } = await sbClient
          .from('productos')
          .select('id, stock_actual')
          .in('id', idsFilas);
        if (errFresco) throw errFresco;
        const stockFrescoPorId = new Map((stockFresco || []).map((p) => [p.id, Number(p.stock_actual) || 0]));

        const detalles = filas.map((f) => {
          const stockSistemaFresco = stockFrescoPorId.has(f.productoId) ? stockFrescoPorId.get(f.productoId) : f.stockSistema;
          return {
            bodega_id: bodegaId,
            producto_id: f.productoId,
            cajero_id: cajeroSeleccionado?.id || null,
            fecha: new Date().toISOString(),
            stock_sistema: stockSistemaFresco,
            stock_contado: Number(f.stockContado) || 0,
            diferencia: (Number(f.stockContado) || 0) - stockSistemaFresco
          };
        });
        const { error } = await sbClient.from('tomas_inventario').insert(detalles);
        if (error) throw error;

        // Solo los productos con diferencia real necesitan ajustar el
        // stock -- los que calzaron exacto ya quedaron con su registro
        // de "se contaron y estaban bien" en la tabla, sin tocar nada más.
        const conDiferencia = detalles.filter((d) => d.diferencia !== 0);
        const resultadosAjuste = await Promise.all(
          conDiferencia.map((d) =>
            sbClient.rpc('ajustar_stock', { p_producto_id: d.producto_id, p_delta: d.diferencia })
          )
        );
        const fallosAjuste = resultadosAjuste.filter((r) => r.error);
        if (fallosAjuste.length > 0) {
          console.warn('Error al ajustar stock en toma de inventario:', fallosAjuste);
          notificar(`Se guardó el conteo, pero ${fallosAjuste.length} producto(s) no se pudieron ajustar. Revísalos en la búsqueda de productos.`, 'error');
        }
      }
      setModalTomaInventario(false);
      setFilasTomaInventario([]);
      // Se limpia a mano (no alcanza con dejar que el efecto de guardado
      // automático lo borre solo): ese efecto no corre una vez que
      // modalTomaInventario ya pasó a false en este mismo guardado.
      await borrarBorradorConteoRemoto();
      cargarProductos();
      notificar(`Toma de inventario guardada: ${filas.length} producto(s) verificado(s).`, 'success');
    } catch (err) {
      notificar(mensajeError(err, 'Error al guardar la toma de inventario'), 'error');
    } finally {
      setGuardandoTomaInventario(false);
    }
  };

  return {
    abrirEscanerParaMerma, abrirTomaInventario, actualizarPendienteConteo,
    actualizarStockContado, agregarHallazgo, agregarProductoAConteo, cerrarModalMerma,
    continuarARevisionInventario, elegirProductoMerma, guardarTomaInventario,
    promoverAActivoConteo, quitarHallazgo, quitarProductoDeConteo, registrarMermaProducto,
    vaciarConteoInventario
  };
}
