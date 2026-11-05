// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
// "tarde": valores que el POS declara después de este hook; se leen solo dentro de
// funciones y efectos (cuando ya están completos).
import { mensajeError } from './utilidades.js';
import { precioNormalCombo as sumaPreciosCombo, costoNormalCombo as sumaCostosCombo } from '../lib/combos.js';
import { useRef, useEffect, useDeferredValue, useMemo, useCallback, useState } from 'react';
import { reportarFallo } from '../monitoreo.js';
import { crearFiltroProductos } from '../lib/busqueda.js';
import { estadoDeudor } from '../lib/deudas.js';

export default function useCombos({
  bodegaId, boletasDeudor, busqueda, cargarCajeros, cargarPedidosRetirar, cargarProductos,
  carrito, categoriaFiltro, categoriasDB, comboVacio, combos, conteoFisicoBusqueda,
  deudorSeleccionado, enLinea, esBarberia, esModoDemo, filasTomaInventario,
  filtroFechaHistorial, formCombo, formComboOriginal, notificar, pedidosCargadosAlCarrito,
  pedidosRetirar, pedirConfirmacion, pedirTexto, productos, sbClient, sesion,
  setBusquedaCombos, setBusquedaProductoCombo, setCargandoCombos, setCategoriaFiltro,
  setCategoriasDB, setComboEditando, setCombos, setEnLinea, setFiltroCombos, setFormCombo,
  setFormComboOriginal, setGuardandoCombo, setModalCombos, setModalPedidosRetirar,
  setMostrarResumenMobile, setResaltadoProductoCombo, setSincronizandoVentas,
  setTabPedidosRetirar, setVentasPendientesSync, sincronizandoVentas, tomaInventarioBusqueda,
  tomaInventarioCategoria, ventasPendientesSync, tarde
}) {
  // ==========================================
  // COMBOS (paquetes de varios productos a precio especial)
  // ==========================================
  // No disponibles en Modo Demo -- la bodega demo no existe de verdad en
  // Supabase, y combos vive ahí (no en catalogoDemoRef como productos).
  const cargarCombos = async () => {
    if (!bodegaId || esModoDemo || !sbClient) { setCombos([]); return; }
    setCargandoCombos(true);
    try {
      const { data, error } = await sbClient
        .from('combos')
        .select('*, combos_items(*, productos(descripcion, cod_ean, precio_venta, precio_costo, foto_url, categoria, stock_actual, activo))')
        .eq('bodega_id', bodegaId)
        .order('nombre', { ascending: true });
      if (error) throw error;
      setCombos(data || []);
    } catch (err) {
      setCombos([]);
      notificar(mensajeError(err, 'No se pudieron cargar los combos'), 'error');
    } finally {
      setCargandoCombos(false);
    }
  };

  // Foto del estado del formulario: sirve para saber si hay cambios sin
  // guardar (al salir, y para activar "Guardar cambios").
  const snapshotCombo = (f) => JSON.stringify({
    id: f.id || null,
    nombre: f.nombre,
    descripcion: f.descripcion,
    precio_venta: String(f.precio_venta),
    activo: !!f.activo,
    items: (f.items || []).map((it) => [it.producto_id, it.cantidad])
  });

  const abrirModalCombos = () => {
    setModalCombos(true);
    setComboEditando(null);
    setFormCombo(null);
    setBusquedaProductoCombo('');
    setFiltroCombos('todos');
    setBusquedaCombos('');
    cargarCombos();
  };

  const nuevoCombo = () => {
    const f = comboVacio();
    setComboEditando(null);
    setFormCombo(f);
    setFormComboOriginal(snapshotCombo(f));
    setBusquedaProductoCombo('');
    setResaltadoProductoCombo(0);
  };

  const formDesdeCombo = (combo) => ({
    id: combo.id,
    nombre: combo.nombre,
    descripcion: combo.descripcion || '',
    precio_venta: (Number(combo.precio_venta) || 0).toFixed(2),
    activo: combo.activo,
    items: (combo.combos_items || []).map((ci) => ({
      producto_id: ci.producto_id,
      descripcion: ci.productos?.descripcion || '(producto eliminado)',
      cod_ean: ci.productos?.cod_ean || '',
      precio_venta: Number(ci.productos?.precio_venta) || 0,
      precio_costo: Number(ci.productos?.precio_costo) || 0,
      foto_url: ci.productos?.foto_url || '',
      categoria: ci.productos?.categoria || '',
      cantidad: Number(ci.cantidad)
    })),
    precioTocado: true
  });

  const editarCombo = (combo) => {
    const f = formDesdeCombo(combo);
    setComboEditando(combo);
    setFormCombo(f);
    setFormComboOriginal(snapshotCombo(f));
    setBusquedaProductoCombo('');
    setResaltadoProductoCombo(0);
  };

  // Abre una copia del combo para ajustarla: queda pausada y sin guardar
  // hasta que la persona la revise.
  const duplicarCombo = (combo) => {
    const f = { ...formDesdeCombo(combo), id: null, nombre: `${combo.nombre} (copia)`, activo: false };
    setComboEditando(null);
    setFormCombo(f);
    setFormComboOriginal('');
    setBusquedaProductoCombo('');
    setResaltadoProductoCombo(0);
  };

  // Sale del editor; si hay cambios sin guardar, pregunta antes.
  const cerrarEditorCombo = async () => {
    if (formCombo && snapshotCombo(formCombo) !== formComboOriginal) {
      const ok = await pedirConfirmacion({ titulo: 'Tienes cambios sin guardar', mensaje: 'Si sales ahora, se pierden.', textoBoton: 'Salir sin guardar', peligroso: true });
      if (!ok) return false;
    }
    setFormCombo(null);
    setComboEditando(null);
    return true;
  };

  const cerrarModalCombos = async () => {
    if (formCombo) {
      const ok = await cerrarEditorCombo();
      if (!ok) return;
    }
    setModalCombos(false);
  };

  // Suma de los precios de venta normales de cada producto del combo
  // (según su cantidad) -- referencia para que el dueño vea cuánto está
  // descontando al ponerle precio de bolsa al combo.
  const precioNormalCombo = (form) => sumaPreciosCombo(form?.items);

  // Suma de los COSTOS de cada producto del combo -- referencia para
  // avisar si el precio de bolsa quedó por debajo de lo que cuesta
  // armarlo (ver aviso de "precio bajo costo" en el formulario).
  const costoNormalCombo = (form) => sumaCostosCombo(form?.items);

  // Mientras el precio no se haya tocado a mano (precioTocado false),
  // sigue en automático a la suma de precios normales de los productos
  // -- así el formulario arranca en el precio "sin descuento" en vez de
  // en 0, y el dueño ajusta hacia abajo desde ahí.
  const actualizarItemsYPrecio = (prev, nuevosItems) => {
    if (prev.precioTocado) return { ...prev, items: nuevosItems };
    const suma = nuevosItems.reduce((acc, it) => acc + it.precio_venta * it.cantidad, 0);
    return { ...prev, items: nuevosItems, precio_venta: suma > 0 ? suma.toFixed(2) : '' };
  };

  const agregarProductoAFormCombo = (producto) => {
    setFormCombo((prev) => {
      const idx = prev.items.findIndex((it) => it.producto_id === producto.id);
      let nuevosItems;
      if (idx >= 0) {
        nuevosItems = [...prev.items];
        nuevosItems[idx] = { ...nuevosItems[idx], cantidad: nuevosItems[idx].cantidad + 1 };
      } else {
        nuevosItems = [...prev.items, {
          producto_id: producto.id,
          descripcion: producto.descripcion,
          cod_ean: producto.cod_ean || '',
          precio_venta: Number(producto.precio_venta) || 0,
          precio_costo: Number(producto.precio_costo) || 0,
          foto_url: producto.foto_url || '',
          categoria: producto.categoria || '',
          cantidad: 1
        }];
      }
      return actualizarItemsYPrecio(prev, nuevosItems);
    });
    setBusquedaProductoCombo('');
    setResaltadoProductoCombo(0);
  };

  const actualizarCantidadItemCombo = (producto_id, cantidad) => {
    setFormCombo((prev) => {
      const nuevosItems = prev.items.map((it) => (it.producto_id === producto_id ? { ...it, cantidad: Math.max(1, Number(cantidad) || 1) } : it));
      return actualizarItemsYPrecio(prev, nuevosItems);
    });
  };

  const quitarItemCombo = (producto_id) => {
    setFormCombo((prev) => actualizarItemsYPrecio(prev, prev.items.filter((it) => it.producto_id !== producto_id)));
  };

  // Botones de descuento rápido: calculan el precio de bolsa a partir
  // de la suma de productos menos un % (5/10/15), y lo dejan como si el
  // usuario lo hubiera tocado a mano (no lo vuelve a pisar el
  // autocompletado si después agrega otro producto).
  const aplicarDescuentoRapidoCombo = (pct) => {
    setFormCombo((prev) => {
      const suma = precioNormalCombo(prev);
      if (suma <= 0) return prev;
      return { ...prev, precioTocado: true, precio_venta: (suma * (1 - pct / 100)).toFixed(2) };
    });
  };

  // Deja un precio exacto (sin descuento o un precio redondo sugerido).
  const aplicarPrecioCombo = (valor) => {
    setFormCombo((prev) => (prev ? { ...prev, precioTocado: true, precio_venta: Number(valor).toFixed(2) } : prev));
  };

  const guardarCombo = async () => {
    if (!formCombo) return;
    if (!formCombo.nombre.trim()) {
      notificar('Ponle un nombre al combo.', 'error');
      return;
    }
    if (!(Number(formCombo.precio_venta) > 0)) {
      notificar('El precio del combo debe ser mayor a 0.', 'error');
      return;
    }
    if (formCombo.items.length === 0) {
      notificar('Agrega al menos un producto al combo.', 'error');
      return;
    }
    setGuardandoCombo(true);
    try {
      const payloadCombo = {
        bodega_id: bodegaId,
        nombre: formCombo.nombre.trim(),
        descripcion: formCombo.descripcion.trim() || null,
        precio_venta: Number(formCombo.precio_venta),
        activo: !!formCombo.activo
      };
      let comboId = formCombo.id;
      if (comboId) {
        const { error } = await sbClient.from('combos').update(payloadCombo).eq('id', comboId);
        if (error) throw error;
        const { error: errDel } = await sbClient.from('combos_items').delete().eq('combo_id', comboId);
        if (errDel) throw errDel;
      } else {
        const { data, error } = await sbClient.from('combos').insert(payloadCombo).select().single();
        if (error) throw error;
        comboId = data.id;
      }
      const payloadItems = formCombo.items.map((it) => ({
        bodega_id: bodegaId,
        combo_id: comboId,
        producto_id: it.producto_id,
        cantidad: it.cantidad
      }));
      const { error: errItems } = await sbClient.from('combos_items').insert(payloadItems);
      if (errItems) throw errItems;

      notificar(`Combo "${payloadCombo.nombre}" guardado.`, 'success');
      setFormCombo(null);
      setComboEditando(null);
      cargarCombos();
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo guardar el combo'), 'error');
    } finally {
      setGuardandoCombo(false);
    }
  };

  // Al tocar el interruptor a mano se limpia "apagado_auto": desde ese
  // momento manda lo que decidió el dueño y el trigger de stock (ver
  // combos_apagado_automatico.sql) ya no lo reactiva por su cuenta.
  const alternarActivoCombo = async (combo) => {
    try {
      let { error } = await sbClient.from('combos').update({ activo: !combo.activo, apagado_auto: false }).eq('id', combo.id);
      // Si todavía no se corrió el SQL (la columna no existe), se guarda solo "activo".
      if (error && /apagado_auto/.test(error.message || '')) {
        ({ error } = await sbClient.from('combos').update({ activo: !combo.activo }).eq('id', combo.id));
      }
      if (error) throw error;
      setCombos((prev) => prev.map((c) => (c.id === combo.id ? { ...c, activo: !combo.activo, apagado_auto: false } : c)));
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo actualizar el combo'), 'error');
    }
  };

  const eliminarCombo = async (combo) => {
    const ok = await pedirConfirmacion({
      titulo: 'Eliminar combo',
      mensaje: `¿Eliminar el combo "${combo.nombre}"? Esto no afecta el stock ni las ventas ya hechas con él.`,
      textoBoton: 'Sí, eliminar',
      peligroso: true
    });
    if (!ok) return;
    try {
      const { error } = await sbClient.from('combos').delete().eq('id', combo.id);
      if (error) throw error;
      setCombos((prev) => prev.filter((c) => c.id !== combo.id));
      notificar('Combo eliminado.', 'info');
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo eliminar el combo'), 'error');
    }
  };

  const avisoCarritoRecuperadoRef = useRef(false);
  useEffect(() => {
    if (sesion && bodegaId) {
      cargarProductos(busqueda);
      cargarCategorias();
      cargarCombos();
      tarde.obtenerOCrearCliente('99999999');
      // Encadenado (no en paralelo): verificarTurno necesita saber ya
      // resuelto qué cajero es "el mío" en este dispositivo (por DNI)
      // para decidir si hay que retomar mi propia caja en silencio o
      // avisar que hay otras cajas abiertas de otros cajeros.
      // La consulta de turnos sale ya, junto con las demás; solo la decisión espera al cajero.
      const turnosEnCurso = esModoDemo || !sbClient ? null : tarde.consultarTurnosAbiertos();
      (async () => {
        const cajero = await cargarCajeros();
        tarde.verificarTurno(cajero, turnosEnCurso);
      })();
      // Avisa una sola vez (por sesión iniciada) si se recuperó una venta
      // que había quedado a medias por un refresh accidental.
      if (!avisoCarritoRecuperadoRef.current) {
        avisoCarritoRecuperadoRef.current = true;
        if (carrito.length > 0) {
          notificar('Se recuperó una venta que habías dejado a medias.', 'info');
        }
      }
    }
  }, [sesion, bodegaId, sbClient]);

  // Persiste el carrito en cada cambio (ver useState de arriba para la
  // recuperación al cargar).
  useEffect(() => {
    try {
      if (carrito.length > 0) {
        localStorage.setItem('pos_carrito_actual', JSON.stringify(carrito));
      } else {
        localStorage.removeItem('pos_carrito_actual');
      }
    } catch { /* localStorage lleno o bloqueado: no es crítico */ }
  }, [carrito]);

  // Detecta cuándo se cae o vuelve la conexión a internet.
  useEffect(() => {
    const marcarOnline = () => setEnLinea(true);
    const marcarOffline = () => setEnLinea(false);
    window.addEventListener('online', marcarOnline);
    window.addEventListener('offline', marcarOffline);
    return () => {
      window.removeEventListener('online', marcarOnline);
      window.removeEventListener('offline', marcarOffline);
    };
  }, []);

  const guardarVentasPendientesLS = (lista) => {
    setVentasPendientesSync(lista);
    try {
      localStorage.setItem('pos_ventas_pendientes_sync', JSON.stringify(lista));
    } catch { /* localStorage lleno o bloqueado: no es crítico */ }
  };

  // Registra una venta completa en UNA transacción de la base de datos
  // (registrar_venta, ver registrar_venta_atomica.sql): venta + detalle +
  // deuda del cliente (si fue a crédito) + descuento de stock, todo o nada.
  // Si la función aún no existe en Supabase, devuelve faltaFuncion = true y
  // el llamador sigue con el camino de siempre (paso a paso).
  // permitirSinStock = true solo para ventas hechas sin conexión que se
  // sincronizan (ya ocurrieron en el mostrador); el cobro en línea rechaza
  // la venta si no alcanza el stock de algún producto.
  const registrarVentaAtomica = async (payloadVenta, detalles, ajustes, credito, permitirSinStock = false) => {
    const { data, error } = await sbClient.rpc('registrar_venta', {
      p_venta: payloadVenta,
      p_detalles: detalles,
      p_ajustes: (ajustes || []).map((a) => ({ producto_id: a.productoId, delta: a.delta })),
      p_credito: credito ? { cliente_id: credito.clienteId, monto: credito.monto } : null,
      p_permitir_sin_stock: permitirSinStock
    });
    if (error) {
      const faltaFuncion = error.code === 'PGRST202' || /could not find the function/i.test(error.message || '');
      return { data: null, error, faltaFuncion };
    }
    return { data, error: null, faltaFuncion: false };
  };

  // Sube a Supabase las ventas que se hicieron sin conexión: inserta la
  // venta con su fecha_hora original, su detalle, aplica el ajuste de
  // stock (RPC) y, si era a crédito, recién ahí suma la deuda real en
  // la base de datos (en el momento offline solo se actualizó en
  // pantalla, de forma optimista).
  const sincronizarVentasPendientes = async () => {
    if (!sbClient || !bodegaId || sincronizandoVentas) return;
    const cola = ventasPendientesSync;
    if (cola.length === 0) return;

    setSincronizandoVentas(true);
    let exitosas = 0;
    let hayFallosDeStock = false;
    const restantes = [];

    for (let i = 0; i < cola.length; i++) {
      const pendiente = cola[i];
      try {
        // Camino nuevo: toda la venta en una sola transacción, y un reintento
        // de una venta ya guardada no repite nada (id_local).
        const atomica = await registrarVentaAtomica(pendiente.payloadVenta, pendiente.payloadDetalles, pendiente.ajustesStock, pendiente.credito, true);
        if (!atomica.faltaFuncion && atomica.error) throw atomica.error;
        if (atomica.faltaFuncion) {
        let vCreada;
        let yaSincronizada = false;
        const { data: vInsertada, error: vErr } = await sbClient
          .from('ventas')
          .insert([pendiente.payloadVenta])
          .select()
          .single();
        if (vErr) {
          // 23505 = ya hay una venta con este id_local: un intento anterior sí
          // llegó a guardarla aunque la respuesta se perdió. Si ya tiene su
          // detalle, está completa y no se repite nada; si no, se sigue
          // desde el detalle (el crédito y el stock van después de él).
          if (vErr.code === '23505' && pendiente.payloadVenta.id_local) {
            const { data: existente } = await sbClient
              .from('ventas')
              .select('id')
              .eq('bodega_id', bodegaId)
              .eq('id_local', pendiente.payloadVenta.id_local)
              .maybeSingle();
            if (!existente) throw vErr;
            vCreada = existente;
            const { count: cantDetalles } = await sbClient
              .from('ventas_detalle')
              .select('id', { count: 'exact', head: true })
              .eq('venta_id', existente.id);
            yaSincronizada = (cantDetalles || 0) > 0;
          } else {
            throw vErr;
          }
        } else {
          vCreada = vInsertada;
        }

        if (!yaSincronizada) {
        const detalles = pendiente.payloadDetalles.map((d) => ({ ...d, venta_id: vCreada.id }));
        const { error: detErr } = await sbClient.from('ventas_detalle').insert(detalles);
        if (detErr) console.warn('Detalle no sincronizado de una venta offline:', detErr);

        if (pendiente.credito) {
          await sbClient.rpc('ajustar_saldo_cliente', { p_cliente_id: pendiente.credito.clienteId, p_delta: pendiente.credito.monto });
        }

        // Si esto falla, NO se puede simplemente reintentar todo el
        // `pendiente` (eso volvería a insertar la venta de arriba, que ya
        // quedó guardada) -- se avisa para corregir el stock a mano en
        // vez de eso.
        const resultadosAjuste = await Promise.all(pendiente.ajustesStock.map((adj) =>
          sbClient.rpc('ajustar_stock', { p_producto_id: adj.productoId, p_delta: adj.delta })
        ));
        if (resultadosAjuste.some((r) => r.error)) {
          console.warn('Una venta offline se sincronizó pero su ajuste de stock falló:', pendiente);
          reportarFallo('ajuste de stock tras sincronizar', 'la venta se guardó pero el stock no se ajustó');
          hayFallosDeStock = true;
        }
        }
        }

        exitosas++;
      } catch (err) {
        console.warn('No se pudo sincronizar una venta offline, se reintentará:', err);
        reportarFallo('sincronizar venta sin conexión', err);
        restantes.push(pendiente);
      }
      // Se guarda el progreso después de CADA venta (no solo al final del
      // loop) -- si la app se cierra a la mitad de la sincronización, lo
      // que ya se subió con éxito no debe quedar en la cola y subirse
      // doble en el próximo intento.
      guardarVentasPendientesLS([...restantes, ...cola.slice(i + 1)]);
    }

    setSincronizandoVentas(false);

    if (exitosas > 0) {
      notificar(`Se sincronizaron ${exitosas} venta${exitosas === 1 ? '' : 's'} hecha${exitosas === 1 ? '' : 's'} sin conexión.`, 'success');
      cargarProductos(busqueda);
    }
    if (hayFallosDeStock) {
      notificar('Algunas ventas offline se sincronizaron pero su stock no se pudo ajustar. Revísalo en la búsqueda de productos.', 'error');
    }
    if (restantes.length > 0) {
      notificar(`${restantes.length} venta(s) offline no se pudieron sincronizar todavía. Se reintentará.`, 'error');
    }
  };

  // Apenas vuelve la conexión, intenta subir lo pendiente.
  useEffect(() => {
    if (enLinea && sesion && bodegaId && ventasPendientesSync.length > 0) {
      sincronizarVentasPendientes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enLinea, bodegaId]);

  // Trae las categorías globales (bodega_id NULL, visibles para todas las
  // bodegas) más las que esta bodega haya agregado por su cuenta (privadas).
  const cargarCategorias = async () => {
    if (!sbClient || !bodegaId) return;
    try {
      const { data, error } = await sbClient
        .from('categorias')
        .select('nombre, bodega_id')
        .or(`bodega_id.is.null,bodega_id.eq.${bodegaId}`)
        .order('creado_en', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        setCategoriasDB(data.map((c) => c.nombre));
      }
    } catch (err) {
      // Si la tabla "categorias" todavía no existe en Supabase, se sigue
      // usando la lista de respaldo para que la app no se rompa.
      console.warn('No se pudo cargar categorías desde Supabase:', err.message);
    }
  };

  // Agrega una categoría nueva, propia de esta bodega (solo ella la verá).
  const agregarCategoriaPersonalizada = async (asignar) => {
    const nombre = await pedirTexto({
      titulo: 'Nueva categoría',
      mensaje: 'Solo la verás en este negocio.',
      placeholder: 'Ej: Repostería',
      textoBoton: 'Crear categoría'
    });
    const limpio = (nombre || '').trim();
    if (!limpio) return;
    if (categoriasDB.some((c) => c.toLowerCase() === limpio.toLowerCase())) {
      asignar(limpio);
      return;
    }
    try {
      if (sbClient && bodegaId && !esModoDemo) {
        const { error } = await sbClient.from('categorias').insert([{ nombre: limpio, bodega_id: bodegaId }]);
        // 23505 = esa categoría ya existe (otro cajero la creó a la vez): no es un error.
        if (error && error.code !== '23505') throw error;
      }
      setCategoriasDB((prev) => [...prev, limpio]);
      asignar(limpio);
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo guardar la categoría'), 'error');
    }
  };

  // Filtrado en vivo: el buscador filtra el catálogo que ya está en memoria
  // (ver productosFiltrados). useDeferredValue deja que el campo de texto
  // responda al toque aunque el catálogo sea grande.
  const busquedaDiferida = useDeferredValue(busqueda);
  const filtroProductosRef = useRef(null);
  if (!filtroProductosRef.current) filtroProductosRef.current = crearFiltroProductos();

  // Categorías: en el filtro solo se muestran las que ya tienen al menos
  // un producto cargado (la lista completa de categoriasDB se sigue
  // usando en los formularios de Nuevo/Editar Producto).
  const categorias = useMemo(() => {
    const usadas = new Set(productos.map(p => p.categoria).filter(Boolean));
    const enOrden = categoriasDB.filter(c => usadas.has(c));
    const extra = Array.from(usadas).filter(c => !categoriasDB.includes(c));
    return ['TODOS', ...enOrden, ...extra];
  }, [productos, categoriasDB]);

  // Función estable para las tarjetas: si fuera una flecha nueva en cada render,
  // React.memo no evitaría que todas las tarjetas se redibujen con cada cambio.
  const verCombosDesdeTarjeta = useCallback(() => setCategoriaFiltro('__COMBOS__'), []);

  // La lista por categoría se memoriza aparte: así el buscador puede seguir
  // filtrando sobre su resultado anterior mientras se escribe.
  const productosPorCategoria = useMemo(
    () => (categoriaFiltro === 'TODOS' ? productos : productos.filter(p => p.categoria === categoriaFiltro)),
    [productos, categoriaFiltro]
  );
  const productosFiltrados = useMemo(
    () => filtroProductosRef.current(productosPorCategoria, busquedaDiferida),
    [productosPorCategoria, busquedaDiferida]
  );

  // La grilla dibuja los productos por tandas: con catálogos de miles de ítems,
  // montar todas las tarjetas de golpe congela el celular. Al acercarse al final
  // se dibuja la siguiente tanda. (Buscar y el lector de código trabajan sobre
  // los datos, no sobre las tarjetas, así que no se ven afectados.)
  const TANDA_GRILLA = 60;
  const [limiteGrid, setLimiteGrid] = useState(TANDA_GRILLA);
  const centinelaGridRef = useRef(null);
  useEffect(() => { setLimiteGrid(TANDA_GRILLA); }, [categoriaFiltro, busqueda]);
  const hayMasEnGrid = productosFiltrados.length > limiteGrid;
  useEffect(() => {
    const el = centinelaGridRef.current;
    if (!hayMasEnGrid || !el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setLimiteGrid(Infinity); return undefined; }
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setLimiteGrid((l) => l + TANDA_GRILLA);
    }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hayMasEnGrid, limiteGrid]);

  // Cuántos productos hay en cada categoría, para mostrarlo junto al
  // nombre en las pestañas ("Bebidas · 8 items").
  const conteoPorCategoria = useMemo(() => {
    const mapa = new Map();
    productos.forEach((p) => {
      const cat = p.categoria || 'General';
      mapa.set(cat, (mapa.get(cat) || 0) + 1);
    });
    return mapa;
  }, [productos]);

  // Cuántas unidades de cada producto hay ya en el carrito, para el
  // badge "En carrito" de la tarjeta (suma todas sus líneas -- ej. si se
  // vendió suelto y también por pack, son dos líneas del mismo producto).
  const cantidadEnCarritoPorProducto = useMemo(() => {
    const mapa = new Map();
    carrito.forEach((item) => {
      mapa.set(item.productoId, (mapa.get(item.productoId) || 0) + Number(item.cantidad || 0));
    });
    return mapa;
  }, [carrito]);

  const cantidadEnCarritoPorCombo = useMemo(() => {
    const mapa = new Map();
    carrito.forEach((item) => {
      if (!item.esCombo) return;
      mapa.set(item.comboId, (mapa.get(item.comboId) || 0) + Number(item.cantidad || 0));
    });
    return mapa;
  }, [carrito]);

  // Cuántos pedidos siguen esperando ser armados -- persiste mientras el
  // pedido siga "pendiente", sin resetearse solo por haber entrado a
  // mirar la pantalla una vez (a diferencia del viejo contador de avisos).
  const pedidosPorRetirarPendientes = useMemo(
    () => pedidosRetirar.filter((p) => p.estado === 'pendiente').length,
    [pedidosRetirar]
  );

  // Las tres colas de "Pedidos por retirar": pendiente/listo se ven más
  // viejo primero (FIFO, el cajero atiende en orden de llegada);
  // historial se ve más nuevo primero (lo último que pasó es lo más
  // relevante para revisar).
  const pedidosRetirarPorTab = useMemo(() => {
    const porFecha = (a, b) => new Date(a.creado_en) - new Date(b.creado_en);
    return {
      pendiente: pedidosRetirar.filter((p) => p.estado === 'pendiente').sort(porFecha),
      listo: pedidosRetirar.filter((p) => p.estado === 'listo' || p.estado === 'en_camino').sort(porFecha),
      historial: pedidosRetirar
        .filter((p) => p.estado === 'retirado' || p.estado === 'cancelado')
        .sort((a, b) => -porFecha(a, b)),
    };
  }, [pedidosRetirar]);

  // Listos (o en camino) que todavía no están en el carrito: ya armados,
  // falta cobrarlos. Sin esto, después de "Marcar listo" -- o de vaciar el
  // carrito con el pedido cargado -- no quedaba ningún aviso de que el
  // pedido seguía ahí esperando.
  const pedidosListosSinCargar = useMemo(
    () => pedidosRetirarPorTab.listo.filter((p) => !pedidosCargadosAlCarrito.some((c) => c.id === p.id)).length,
    [pedidosRetirarPorTab, pedidosCargadosAlCarrito]
  );

  // Abre "Pedidos por retirar" en la pestaña donde hay algo que hacer.
  const abrirPedidosRetirar = () => {
    if (pedidosPorRetirarPendientes > 0) setTabPedidosRetirar('pendiente');
    else if (pedidosListosSinCargar > 0) setTabPedidosRetirar('listo');
    setModalPedidosRetirar(true);
    cargarPedidosRetirar();
    setMostrarResumenMobile(true);
  };

  // Filtro de fecha del historial de "Pedidos por retirar" -- ordenado
  // más nuevo primero, así que "hoy" siempre queda arriba de por sí; el
  // filtro solo recorta cuánto atrás se muestra.
  const historialPedidosFiltrado = useMemo(() => {
    if (filtroFechaHistorial === 'todos') return pedidosRetirarPorTab.historial;
    const ahora = Date.now();
    let desde;
    if (filtroFechaHistorial === 'hoy') {
      const inicioHoy = new Date();
      inicioHoy.setHours(0, 0, 0, 0);
      desde = inicioHoy.getTime();
    } else {
      const dias = filtroFechaHistorial === '7dias' ? 7 : 30;
      desde = ahora - dias * 24 * 60 * 60 * 1000;
    }
    return pedidosRetirarPorTab.historial.filter((p) => new Date(p.creado_en).getTime() >= desde);
  }, [pedidosRetirarPorTab.historial, filtroFechaHistorial]);

  // Disponibilidad de cada combo según el stock de sus productos: un
  // combo queda "apagado" (no se puede vender) mientras a alguno de sus
  // productos le falte stock, esté desactivado o se haya eliminado, y
  // vuelve solo al reponer. No toca el interruptor "activo" del combo.
  // Usa el stock en vivo de `productos` (lo actualiza el realtime) y, si
  // ese producto no está en la lista cargada, el que vino con el combo.
  // `unidades` = cuántos combos completos alcanza a armar el stock.
  const estadoCombos = useMemo(() => {
    const enVivo = new Map(productos.map((pr) => [pr.id, pr]));
    const mapa = new Map();
    combos.forEach((c) => {
      const faltan = [];
      let unidades = Infinity;
      (c.combos_items || []).forEach((ci) => {
        const pr = enVivo.get(ci.producto_id) || ci.productos;
        const req = Number(ci.cantidad) || 1;
        // Barbería: un servicio (sin stock) dentro de un combo, como la
        // "Aplicación de tinte", siempre está disponible. En una bodega,
        // sin stock sigue contando como 0, igual que antes.
        const sinSeguimiento = esBarberia && pr && (pr.stock_actual === null || pr.stock_actual === undefined);
        const stock = pr && pr.activo !== false ? (sinSeguimiento ? Infinity : Number(pr.stock_actual) || 0) : 0;
        if (stock < req) faltan.push(pr?.descripcion || '(producto eliminado)');
        unidades = Math.min(unidades, Math.floor(stock / req));
      });
      mapa.set(c.id, { disponible: faltan.length === 0, faltan, unidades });
    });
    return mapa;
  }, [combos, productos, esBarberia]);

  // Combos activos (los que ve el catálogo) y cuántos se pueden armar ahora;
  // se calculan una vez en vez de filtrar la lista en cada pintada.
  const claseSegmento = (activo) => `w-full md:w-auto justify-center flex items-center gap-2 h-full px-3 md:px-4 rounded-full text-[13px] font-semibold transition ${activo ? 'bg-white text-[#5b4bd6] font-bold' : 'text-[#6b6890] hover:text-[#2d284b]'}`;
  const combosActivos = useMemo(() => combos.filter((c) => c.activo), [combos]);
  const combosDisponibles = useMemo(
    () => combosActivos.filter((c) => estadoCombos.get(c.id)?.disponible !== false).length,
    [combosActivos, estadoCombos]
  );

  // Qué productos son parte de algún combo activo -- para poder
  // avisarlo en su propia tarjeta del catálogo normal (ver ProductoCard
  // más abajo), no solo dentro de la pestaña "Combos". Así un cajero que
  // busca/agrega producto por producto igual se entera de que existe un
  // combo con ese producto.
  const productosEnCombo = useMemo(() => {
    const set = new Set();
    combos.filter((c) => c.activo && estadoCombos.get(c.id)?.disponible !== false).forEach((c) => {
      (c.combos_items || []).forEach((ci) => set.add(ci.producto_id));
    });
    return set;
  }, [combos, estadoCombos]);

  // Versión del catálogo con los campos de texto ya en minúscula, para
  // no repetir toLowerCase() sobre cada producto en cada tecla que se
  // escribe en los buscadores de "Registrar Inventario" (se recalcula
  // solo cuando cambia el catálogo, no en cada keystroke).
  const productosBusqueda = useMemo(() => productos.map((p) => ({
    producto: p,
    desc: (p.descripcion || '').toLowerCase(),
    sku: (p.sku || '').toLowerCase(),
    ean: (p.cod_ean || '').toLowerCase(),
    eanPack: (p.cod_ean_pack || '').toLowerCase()
  })), [productos]);

  // Filas visibles de "Toma de Inventario", filtradas por categoría y
  // texto -- para no tener que contar las 300
  // filas de una sola vez si la bodega es grande.
  const filasTomaInventarioVisibles = useMemo(() => {
    const t = tomaInventarioBusqueda.trim().toLowerCase();
    return filasTomaInventario
      .filter((f) => !tomaInventarioCategoria || f.categoria === tomaInventarioCategoria)
      .filter((f) => !t || (f.descripcion || '').toLowerCase().includes(t));
  }, [filasTomaInventario, tomaInventarioCategoria, tomaInventarioBusqueda]);

  // Resultados del buscador del Paso 1 (Conteo) -- solo se calculan
  // cuando hay texto escrito (evita mostrar los 300 productos de la
  // bodega de una sola vez) y ya no incluyen lo que ya se agregó al
  // conteo, para no volver a contarlo dos veces por error.
  // OJO: a propósito NO excluye los productos que ya están en el conteo
  // -- con una lista de 500 productos, ir a buscarlo de nuevo (para
  // sumarle lo que se encontró en otro lugar del local) tiene que ser
  // tan fácil como agregarlo la primera vez, no obligar a hacer scroll
  // manual hasta encontrar su fila.
  const resultadosBusquedaConteo = useMemo(() => {
    const t = conteoFisicoBusqueda.trim().toLowerCase();
    if (!t) return [];
    return productos
      .filter((p) =>
        (p.descripcion || '').toLowerCase().includes(t) ||
        (p.cod_ean || '').toLowerCase().includes(t) ||
        (p.sku || '').toLowerCase().includes(t)
      )
      .slice(0, 8);
  }, [productos, conteoFisicoBusqueda]);

  // Estado de la deuda del cliente elegido (boletas pagadas, pendientes y
  // vencidas). La regla -- los abonos cubren primero las boletas más
  // antiguas -- vive en lib/deudas.js.
  const estadoDeudorSel = useMemo(() => {
    if (!deudorSeleccionado) return null;
    return estadoDeudor({ saldo: deudorSeleccionado.saldo_actual, diasCredito: deudorSeleccionado.dias_credito }, boletasDeudor);
  }, [boletasDeudor, deudorSeleccionado]);

  const boletasDeudorConEstado = useMemo(() => (estadoDeudorSel ? estadoDeudorSel.boletas : []), [estadoDeudorSel]);

  const boletasPendientesDeuda = useMemo(
    () => boletasDeudorConEstado.filter((b) => !b.pagada),
    [boletasDeudorConEstado]
  );

  return {
    abrirModalCombos, abrirPedidosRetirar, actualizarCantidadItemCombo,
    agregarCategoriaPersonalizada, agregarProductoAFormCombo, alternarActivoCombo,
    aplicarDescuentoRapidoCombo, aplicarPrecioCombo, boletasPendientesDeuda,
    cantidadEnCarritoPorCombo, cantidadEnCarritoPorProducto, categorias, centinelaGridRef,
    cerrarEditorCombo, cerrarModalCombos, claseSegmento, combosActivos, combosDisponibles,
    conteoPorCategoria, costoNormalCombo, duplicarCombo, editarCombo, eliminarCombo,
    estadoCombos, estadoDeudorSel, filasTomaInventarioVisibles, guardarCombo,
    guardarVentasPendientesLS, hayMasEnGrid, historialPedidosFiltrado, limiteGrid, nuevoCombo,
    pedidosListosSinCargar, pedidosPorRetirarPendientes, pedidosRetirarPorTab,
    precioNormalCombo, productosBusqueda, productosEnCombo, productosFiltrados,
    quitarItemCombo, registrarVentaAtomica, resultadosBusquedaConteo,
    sincronizarVentasPendientes, snapshotCombo, verCombosDesdeTarjeta
  };
}
