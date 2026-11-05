// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { useRef, useCallback, useEffect } from 'react';
import { expandirLineaCombo } from '../lib/combos.js';

export default function useSeleccionProducto({
  carrito, combos, inputCantidad, notificar, productoSeleccionadoCantidad, productos,
  setCarrito, setInputCantidad, setModalCantidad, setProductoSeleccionadoCantidad,
  setTipoVentaSeleccionado, tipoVentaSeleccionado
}) {
  // ==========================================
  // SELECCIÓN Y CANTIDAD / BALANZA DE PRODUCTO
  // ==========================================
  // Si el código escaneado/tipeado ya identificó exactamente si es el
  // EAN de la unidad o el del pack (son distintos en el empaque real),
  // tipoVentaForzado salta la pregunta "¿suelto o pack?" y lo agrega
  // directo -- la ambigüedad solo aplica cuando se toca la tarjeta del
  // producto a mano.
  // Busca un producto por cualquiera de sus dos códigos de barras: el de
  // la unidad suelta o el del pack/caja (suelen ser distintos en el
  // empaque real). Devuelve cuál de los dos coincidió, para saber si
  // hay que vender como unidad o como pack sin tener que preguntar.
  const buscarProductoPorCodigo = (codigo) => {
    const c = (codigo || '').trim().toLowerCase();
    if (!c) return null;
    const porUnidad = productos.find((p) => (p.cod_ean || '').toLowerCase() === c);
    if (porUnidad) return { producto: porUnidad, esPack: false };
    const porPack = productos.find((p) => (p.cod_ean_pack || '').toLowerCase() === c);
    if (porPack) return { producto: porPack, esPack: true };
    return null;
  };

  const confirmarCantidadBalanza = () => {
    if (!productoSeleccionadoCantidad) return;
    const cant = parseFloat(inputCantidad) || 1;
    if (cant <= 0) {
      notificar('Ingresa una cantidad válida.', 'error');
      return;
    }
    agregarAlCarrito(productoSeleccionadoCantidad, cant, tipoVentaSeleccionado);
    setModalCantidad(false);
    setProductoSeleccionadoCantidad(null);
  };

  // tipoVenta: 'UNIDAD' (por defecto) o 'PACK' -- si el producto vende
  // también por pack (unidades_por_pack > 1), un pack se descuenta del
  // stock como varias unidades base, no como 1. Así una misma bolsa de
  // stock sirve tanto para vender el pack cerrado como para venderlo
  // suelto si se abre, sin llevar dos números de stock por separado.
  // Carrito actual para leerlo dentro de callbacks memorizados (evita usar un
  // valor viejo) al comprobar si alcanza el stock.
  const carritoRef = useRef(carrito);
  carritoRef.current = carrito;

  // Unidades de un producto que ya están en el carrito (sueltas, en pack o
  // dentro de combos), para saber si todavía alcanza el stock.
  const unidadesEnCarritoDe = (productoId) =>
    carritoRef.current
      .flatMap((item) => expandirLineaCarrito(item))
      .filter((linea) => linea.productoId === productoId)
      .reduce((acc, linea) => acc + Number(linea.unidadesStock || linea.cantidad || 0), 0);

  const agregarAlCarrito = useCallback((producto, cantidad = 1, tipoVenta = 'UNIDAD') => {
    const cantNum = parseFloat(cantidad) || 1;
    const unidadesPorPack = Number(producto.unidades_por_pack) || 1;
    const esPack = tipoVenta === 'PACK' && unidadesPorPack > 1;
    // Ojo: unidadesPorPack es la config del PRODUCTO (para precio/label del
    // pack), no lo que hay que descontar de stock -- una venta suelta
    // siempre descuenta 1 por unidad, aunque el producto tenga pack
    // configurado. Solo una venta de pack descuenta unidadesPorPack.
    const multiplicadorStock = esPack ? unidadesPorPack : 1;
    const precioUnit = esPack
      ? (Number(producto.precio_venta_pack) || Number(producto.precio_venta) * unidadesPorPack)
      : Number(producto.precio_venta) || 0;
    const precioCostoUnit = esPack
      ? (Number(producto.precio_costo) || 0) * unidadesPorPack
      : Number(producto.precio_costo) || 0;
    const descripcionMostrada = esPack ? `${producto.descripcion} (Pack x${unidadesPorPack})` : producto.descripcion;
    const claveCarrito = esPack ? `${producto.id}::pack` : producto.id;

    // No se puede vender más de lo que hay (solo productos con seguimiento de
    // stock; sin seguimiento, stock_actual es null y no se bloquea). La base de
    // datos también lo comprueba al cobrar; esto avisa antes, al agregar.
    if (producto.stock_actual !== null && producto.stock_actual !== undefined) {
      const stockDisponible = Number(producto.stock_actual) || 0;
      const yaEnCarrito = unidadesEnCarritoDe(producto.id);
      const necesarias = +(cantNum * multiplicadorStock).toFixed(3);
      if (yaEnCarrito + necesarias > stockDisponible + 1e-9) {
        notificar(
          stockDisponible <= 0
            ? `"${producto.descripcion}" está agotado.`
            : `Solo ${stockDisponible === 1 ? 'queda 1' : `quedan ${stockDisponible}`} de "${producto.descripcion}"${yaEnCarrito > 0 ? ` (ya tienes ${yaEnCarrito} en el carrito)` : ''}.`,
          'error'
        );
        return;
      }
    }

    setCarrito(prev => {
      const idx = prev.findIndex(item => (item.claveCarrito || item.productoId) === claveCarrito);
      if (idx >= 0) {
        const actual = prev[idx];
        const nuevaCant = +(actual.cantidad + cantNum).toFixed(3);
        const nuevo = [...prev];
        nuevo[idx] = {
          ...actual,
          cantidad: nuevaCant,
          subtotal: +(nuevaCant * actual.precioUnitario).toFixed(2),
          unidadesStock: +(nuevaCant * multiplicadorStock).toFixed(3)
        };
        return nuevo;
      } else {
        return [
          ...prev,
          {
            productoId: producto.id,
            claveCarrito,
            cod_ean: producto.cod_ean,
            categoria: producto.categoria,
            foto_url: producto.foto_url,
            descripcion: descripcionMostrada,
            precioUnitario: precioUnit,
            precioCosto: precioCostoUnit,
            cantidad: cantNum,
            subtotal: +(cantNum * precioUnit).toFixed(2),
            unidad: esPack ? `PACK x${unidadesPorPack}` : (producto.unidad || 'UND'),
            esPack,
            unidadesPorPack,
            unidadesStock: +(cantNum * multiplicadorStock).toFixed(3)
          }
        ];
      }
    });

    // Avisa si el stock queda bajo.
    if (producto.stock_actual !== null && producto.stock_actual !== undefined) {
      if (Number(producto.stock_actual) <= Number(producto.stock_min || 5)) {
        notificar(`Stock bajo de "${producto.descripcion}" (quedan ${producto.stock_actual}).`, 'error');
        return;
      }
    }
  }, [notificar]);

  // Agrega un combo al carrito como UNA sola línea (precio de bolsa,
  // "itemsCombo" con la receta) -- recién al cobrar (ver
  // expandirLineaCarrito) se reparte en líneas reales por producto, que
  // es lo que de verdad descuenta stock. Igual que agregarAlCarrito,
  // suma cantidad si el mismo combo ya estaba en el carrito.
  const agregarComboAlCarrito = useCallback((combo, cantidad = 1) => {
    const cantNum = parseFloat(cantidad) || 1;
    const claveCarrito = `combo::${combo.id}`;
    const itemsCombo = (combo.combos_items || combo.items || []).map((ci) => ({
      productoId: ci.producto_id,
      descripcion: ci.productos?.descripcion || ci.descripcion || '(producto eliminado)',
      cod_ean: ci.productos?.cod_ean || ci.cod_ean || '',
      precioVenta: Number(ci.productos?.precio_venta ?? ci.precio_venta) || 0,
      precioCosto: Number(ci.productos?.precio_costo ?? ci.precio_costo) || 0,
      cantidadBase: Number(ci.cantidad)
    }));
    const precioUnit = Number(combo.precio_venta) || 0;
    const costoUnit = itemsCombo.reduce((acc, it) => acc + it.precioCosto * it.cantidadBase, 0);

    setCarrito((prev) => {
      const idx = prev.findIndex((item) => (item.claveCarrito || item.productoId) === claveCarrito);
      if (idx >= 0) {
        const actual = prev[idx];
        const nuevaCant = +(actual.cantidad + cantNum).toFixed(3);
        const nuevo = [...prev];
        nuevo[idx] = { ...actual, cantidad: nuevaCant, subtotal: +(nuevaCant * actual.precioUnitario).toFixed(2) };
        return nuevo;
      }
      return [
        ...prev,
        {
          esCombo: true,
          comboId: combo.id,
          productoId: null,
          claveCarrito,
          descripcion: `Combo: ${combo.nombre}`,
          precioUnitario: precioUnit,
          precioCosto: costoUnit,
          cantidad: cantNum,
          subtotal: +(cantNum * precioUnit).toFixed(2),
          unidad: 'COMBO',
          itemsCombo
        }
      ];
    });
  }, [notificar]);

  // Combos ids que el cajero sacó a propósito del carrito (con "Quitar")
  // -- mientras sigan acá, no se los vuelve a armar solos aunque los
  // productos sueltos que los componen sigan en el carrito. Se limpia
  // cuando el carrito queda vacío (nueva venta), ver más abajo.
  const combosRechazadosRef = useRef(new Set());
  useEffect(() => {
    if (carrito.length === 0) combosRechazadosRef.current.clear();
  }, [carrito.length]);

  // Arma en automático el combo "Combo X" cuando el carrito junta, entre
  // líneas de productos sueltos, todo lo que ese combo necesita -- para
  // que escanear/seleccionar producto por producto (sin pasar por la
  // pestaña "Combos") igual aplique el precio de combo. Usa justo las
  // unidades que pide el combo y deja el resto suelto a precio normal.
  // Si ya hay una línea de este combo, le suma 1 en vez de crear otra --
  // así, si el carrito junta productos sueltos para varios combos
  // completos (de a uno, en pasadas sucesivas de este mismo efecto),
  // se van sumando todos los que alcancen, no solo el primero.
  const convertirProductosEnCombo = useCallback((combo) => {
    let aplicado = false;
    setCarrito((prev) => {
      const requeridos = combo.combos_items || [];
      if (requeridos.length === 0) return prev;

      const disponible = new Map();
      prev.forEach((item) => {
        if (item.esCombo) return;
        disponible.set(item.productoId, (disponible.get(item.productoId) || 0) + item.cantidad);
      });
      const cumple = requeridos.every((ci) => (disponible.get(ci.producto_id) || 0) >= Number(ci.cantidad));
      if (!cumple) return prev;

      // Descuenta las unidades del combo de las líneas sueltas (puede
      // haber más de una línea del mismo producto -- ej. vendido suelto
      // y por pack -- así que consume de a una hasta cubrir lo pedido).
      // La línea de este combo (si ya existe) se saca acá y se vuelve a
      // agregar al final, ya con la cantidad sumada.
      const porConsumir = new Map(requeridos.map((ci) => [ci.producto_id, Number(ci.cantidad)]));
      let comboExistente = null;
      const nuevo = [];
      prev.forEach((item) => {
        if (item.esCombo) {
          if (item.comboId === combo.id) { comboExistente = item; return; }
          nuevo.push(item);
          return;
        }
        const falta = porConsumir.get(item.productoId);
        if (!falta || falta <= 0) { nuevo.push(item); return; }
        const consumido = Math.min(falta, item.cantidad);
        porConsumir.set(item.productoId, +(falta - consumido).toFixed(3));
        const restante = +(item.cantidad - consumido).toFixed(3);
        if (restante > 0) {
          nuevo.push({ ...item, cantidad: restante, subtotal: +(restante * item.precioUnitario).toFixed(2) });
        }
      });

      const precioUnit = Number(combo.precio_venta) || 0;
      let lineaCombo;
      if (comboExistente) {
        const nuevaCant = +(comboExistente.cantidad + 1).toFixed(3);
        lineaCombo = { ...comboExistente, cantidad: nuevaCant, subtotal: +(nuevaCant * precioUnit).toFixed(2) };
      } else {
        const itemsCombo = requeridos.map((ci) => ({
          productoId: ci.producto_id,
          descripcion: ci.productos?.descripcion || '(producto eliminado)',
          cod_ean: ci.productos?.cod_ean || '',
          precioVenta: Number(ci.productos?.precio_venta) || 0,
          precioCosto: Number(ci.productos?.precio_costo) || 0,
          cantidadBase: Number(ci.cantidad)
        }));
        const costoUnit = itemsCombo.reduce((acc, it) => acc + it.precioCosto * it.cantidadBase, 0);
        lineaCombo = {
          esCombo: true,
          comboId: combo.id,
          productoId: null,
          claveCarrito: `combo::${combo.id}`,
          descripcion: `Combo: ${combo.nombre}`,
          precioUnitario: precioUnit,
          precioCosto: costoUnit,
          cantidad: 1,
          subtotal: +precioUnit.toFixed(2),
          unidad: 'COMBO',
          itemsCombo
        };
      }
      nuevo.push(lineaCombo);
      aplicado = true;
      return nuevo;
    });
    if (aplicado) notificar(`¡Se armó el Combo "${combo.nombre}"! Se aplicó su precio especial.`, 'success');
  }, [notificar]);

  useEffect(() => {
    if (!combos.some((c) => c.activo)) return;
    const disponible = new Map();
    carrito.forEach((item) => {
      if (item.esCombo) return;
      disponible.set(item.productoId, (disponible.get(item.productoId) || 0) + item.cantidad);
    });
    const comboListo = combos.find((c) => {
      if (!c.activo || combosRechazadosRef.current.has(c.id)) return false;
      const items = c.combos_items || [];
      if (items.length === 0) return false;
      return items.every((ci) => (disponible.get(ci.producto_id) || 0) >= Number(ci.cantidad));
    });
    if (comboListo) {
      convertirProductosEnCombo(comboListo);
      const normal = (comboListo.combos_items || []).reduce((acc, ci) => acc + (Number(ci.productos?.precio_venta) || 0) * Number(ci.cantidad), 0);
      const ahorro = normal - Number(comboListo.precio_venta);
      notificar(ahorro > 0.005 ? `Se aplicó el combo "${comboListo.nombre}": el cliente ahorra S/ ${ahorro.toFixed(2)}.` : `Se aplicó el combo "${comboListo.nombre}".`, 'success');
    }
  }, [carrito, combos, convertirProductosEnCombo, notificar]);

  // Convierte el carrito (donde un combo es UNA línea) en las líneas
  // "reales" que se guardan en ventas_detalle y descuentan stock -- una
  // por cada producto, incluidos los que vienen de dentro de un combo.
  // Así anularVentaHoy, el reporte de "Productos Más Vendidos" y el
  // ajuste de stock (ajustar_stock por producto) no necesitan saber que
  // los combos existen: para ellos es una venta de varios productos,
  // como cualquier otra.
  const expandirLineaCarrito = expandirLineaCombo; // lógica probada en src/lib/combos.js

  const handleClicProducto = useCallback((prod, tipoVentaForzado = null) => {
    const esKG = prod.unidad === 'KG';
    const tienePack = Number(prod.unidades_por_pack) > 1;
    if (esKG) {
      setProductoSeleccionadoCantidad(prod);
      setInputCantidad('1.000');
      setTipoVentaSeleccionado(tipoVentaForzado || 'UNIDAD');
      setModalCantidad(true);
    } else if (tipoVentaForzado) {
      agregarAlCarrito(prod, 1, tipoVentaForzado);
    } else if (tienePack) {
      setProductoSeleccionadoCantidad(prod);
      setInputCantidad('1');
      setTipoVentaSeleccionado('UNIDAD');
      setModalCantidad(true);
    } else {
      agregarAlCarrito(prod, 1);
    }
  }, [agregarAlCarrito]);

  return {
    agregarAlCarrito, agregarComboAlCarrito, buscarProductoPorCodigo, combosRechazadosRef,
    confirmarCantidadBalanza, expandirLineaCarrito, handleClicProducto, unidadesEnCarritoDe
  };
}
