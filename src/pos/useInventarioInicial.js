// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { useState, useEffect, useCallback } from 'react';
import { comprimirImagenJPEG, generarSKU } from '../PanelAdminCompartido.jsx';
import { mensajeError, datosFormularioDesdeProducto, generarCodigoInterno, normalizarCamposPack } from './utilidades.js';
import { esMontoNoNegativo } from '../lib/validaciones.js';

export default function useInventarioInicial({
  bodegaId, cargarProductos, catalogoDemoInicial, catalogoDemoRef, catalogoMaestroDisponible,
  esBarberia, esModoDemo, filaInventarioExpandidaIdx, filaInventarioVacia, filasInventario,
  modalInventarioInicial, notificar, pasoInventario, productosBusqueda, sbClient, sesion,
  setCargandoMaestroImport, setCatalogoMaestroDisponible, setFilaInventarioExpandidaIdx,
  setFilasInventario, setGuardandoInventario, setModalInventarioInicial, setPasoInventario
}) {
  // ==========================================
  // INVENTARIO INICIAL (carga de varios productos a la vez)
  // ==========================================
  const actualizarFilaInventario = (index, campo, valor) => {
    setFilasInventario((prev) => prev.map((fila, i) => {
      if (i !== index) return fila;
      if (campo === 'descripcion') {
        // Si se vuelve a tocar la descripción a mano después de elegir
        // una sugerencia del catálogo maestro, se suelta ese enlace (y
        // su foto, que era la del maestro) -- si no, la sugerencia se
        // queda pegada en pantalla (el texto ya escrito sigue
        // "coincidiendo consigo mismo") y el enlace podría terminar
        // apuntando a un producto distinto del que finalmente se
        // escribió. Si la foto no vino de esa sugerencia sino que el
        // usuario ya la subió a mano (cámara/galería/Ctrl+V), se respeta.
        return { ...fila, descripcion: valor, catalogoMaestroId: null, foto_url: fila.catalogoMaestroId ? '' : fila.foto_url };
      }
      return { ...fila, [campo]: valor };
    }));
  };

  // Igual que subirFotoProducto, pero para una fila de "Registrar
  // Productos" que todavía no se guardó -- por eso usa el id que
  // filaInventarioVacia ya generó de antemano en vez del id de un
  // producto existente.
  const [subiendoFotoFilaIdx, setSubiendoFotoFilaIdx] = useState(null);
  const subirFotoFilaInventario = async (idx, file) => {
    const fila = filasInventario[idx];
    if (!fila || fila.productoExistenteId) return;
    if (!esModoDemo && sesion?.bodega?.permitir_subir_fotos === false) return;
    setSubiendoFotoFilaIdx(idx);
    try {
      const comprimida = await comprimirImagenJPEG(file, 20, 480);
      if (esModoDemo) {
        const urlLocal = URL.createObjectURL(comprimida);
        actualizarFilaInventario(idx, 'foto_url', urlLocal);
        return;
      }
      const ruta = `${bodegaId}/${fila.id}.jpg`;
      const { error } = await sbClient.storage
        .from('Productos')
        .upload(ruta, comprimida, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = sbClient.storage.from('Productos').getPublicUrl(ruta);
      actualizarFilaInventario(idx, 'foto_url', `${data.publicUrl}?t=${Date.now()}`);
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo subir la foto'), 'error');
    } finally {
      setSubiendoFotoFilaIdx(null);
    }
  };

  // Con el modal de "Registrar Productos" abierto, Ctrl+V sube la
  // imagen copiada a la fila que se está llenando en ese momento.
  useEffect(() => {
    if (!modalInventarioInicial) return;
    const manejarPegado = (e) => {
      if (pasoInventario !== 1) return;
      const fila = filasInventario[filaInventarioExpandidaIdx];
      if (!fila || fila.productoExistenteId) return;
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'));
      if (item) subirFotoFilaInventario(filaInventarioExpandidaIdx, item.getAsFile());
    };
    window.addEventListener('paste', manejarPegado);
    return () => window.removeEventListener('paste', manejarPegado);
  }, [modalInventarioInicial, filaInventarioExpandidaIdx, filasInventario, pasoInventario]);

  // Al abrir "Registrar Productos" se empieza siempre por el paso 1.
  useEffect(() => {
    if (modalInventarioInicial) setPasoInventario(1);
  }, [modalInventarioInicial]);

  // Busca en el catálogo ya cargado un producto por cualquiera de sus
  // identificadores exactos: EAN de la unidad, EAN del pack o SKU. Así,
  // si escaneas/escribes el código del pack (o el SKU) de un producto
  // que ya existe, lo reconoce y vincula la fila a ese mismo producto
  // en vez de crear uno duplicado.
  const buscarProductoExistente = useCallback((texto) => {
    const t = (texto || '').trim().toLowerCase();
    if (!t) return null;
    const hit = productosBusqueda.find((e) => e.ean === t || e.eanPack === t || e.sku === t);
    return hit ? hit.producto : null;
  }, [productosBusqueda]);

  const sugerenciasParaFila = useCallback((fila) => {
    const t = fila.descripcion.trim().toLowerCase();
    if (!t || t.length < 2 || fila.productoExistenteId) return [];
    return productosBusqueda
      .filter((e) => e.desc.includes(t) || e.sku.includes(t))
      .slice(0, 5)
      .map((e) => e.producto);
  }, [productosBusqueda]);

  // Sugerencias del catálogo maestro mientras se escribe la descripción:
  // a diferencia de sugerenciasParaFila (productos que la bodega YA
  // tiene, para sumarle stock), estas son productos que todavía no
  // tiene -- elegir una precarga categoría y foto, pero sigue siendo un
  // producto nuevo para esta bodega (su propio precio, su propio stock).
  const sugerenciasMaestroParaFila = useCallback((fila) => {
    const t = fila.descripcion.trim().toLowerCase();
    // Si ya se eligió una sugerencia (catalogoMaestroId puesto), no se
    // vuelve a mostrar la lista -- si no, como el texto ya escrito
    // sigue "coincidiendo consigo mismo", se quedaría pegada en pantalla.
    if (!t || t.length < 2 || fila.productoExistenteId || fila.catalogoMaestroId) return [];
    return catalogoMaestroDisponible
      .filter((p) => p.descripcion.toLowerCase().includes(t))
      .slice(0, 5);
  }, [catalogoMaestroDisponible]);

  const usarSugerenciaMaestraEnFila = (index, item) => {
    setFilasInventario((prev) =>
      prev.map((fila, i) =>
        i === index
          ? { ...fila, descripcion: item.descripcion, categoria: item.categoria || fila.categoria, foto_url: item.foto_url || '', catalogoMaestroId: item.id }
          : fila
      )
    );
  };

  // Igual que arriba pero para el campo "EAN o SKU del pack": deja
  // buscar por descripción, SKU o cualquiera de los dos códigos, para
  // poder elegir de una lista en vez de tener que escribir el código
  // exacto de memoria.
  const sugerenciasParaFilaPack = useCallback((fila) => {
    const t = (fila.cod_ean_pack || '').trim().toLowerCase();
    if (!t || t.length < 2 || fila.productoExistenteId) return [];
    return productosBusqueda
      .filter((e) => e.desc.includes(t) || e.sku.includes(t) || e.eanPack.includes(t) || e.ean.includes(t))
      .slice(0, 5)
      .map((e) => e.producto);
  }, [productosBusqueda]);

  // Vincula la fila a un producto ya existente: autocompleta sus datos y
  // cambia el campo de cantidad a "sumar al stock actual" en vez de "stock inicial".
  const vincularProductoExistenteEnFila = (index, producto) => {
    setFilasInventario((prev) =>
      prev.map((fila, i) =>
        i === index
          ? {
              ...fila,
              productoExistenteId: producto.id,
              ...datosFormularioDesdeProducto(producto),
              // Se guarda aparte para poder avisar si el operador
              // destilda el pack de un producto que sí lo tenía --
              // el campo queda editable (a propósito, para poder
              // agregarle/quitarle pack a un producto ya existente
              // desde acá), pero un clic sin querer no debería pasar
              // desapercibido.
              vendeEnPackOriginal: Number(producto.unidades_por_pack) > 1
            }
          : fila
      )
    );
  };

  const desvincularFilaInventario = (index) => {
    setFilasInventario((prev) => prev.map((fila, i) => (i === index ? filaInventarioVacia() : fila)));
  };

  // Al cambiar el EAN (tipeado o escaneado), si coincide exacto con un
  // producto ya registrado, vincula la fila automáticamente a ese producto.
  const actualizarCodigoEanFila = (index, codigo) => {
    const encontrado = buscarProductoExistente(codigo);
    if (encontrado) {
      vincularProductoExistenteEnFila(index, encontrado);
    } else {
      setFilasInventario((prev) => prev.map((fila, i) => (i === index ? { ...fila, cod_ean: codigo, productoExistenteId: null } : fila)));
    }
  };

  // Igual que arriba pero para el campo "Código EAN del pack": si ese
  // código (o el SKU que escribas ahí) ya pertenece a un producto
  // existente -- por ejemplo, uno que ya registraste solo con su EAN de
  // unidad y ahora le quieres agregar el del pack -- vincula la fila a
  // ese producto para completarlo, en vez de crear uno nuevo.
  const actualizarCodigoEanPackFila = (index, codigo, notificarCaptura = false) => {
    const encontrado = buscarProductoExistente(codigo);
    if (encontrado) {
      vincularProductoExistenteEnFila(index, encontrado);
      notificar(`Vinculado al producto existente: ${encontrado.descripcion}`, 'success');
    } else {
      setFilasInventario((prev) => prev.map((fila, i) => (i === index ? { ...fila, cod_ean_pack: codigo } : fila)));
      if (notificarCaptura) notificar(`Código de pack capturado: ${codigo}`, 'success');
    }
  };

  const agregarFilaInventario = () => {
    setFilasInventario((prev) => {
      setFilaInventarioExpandidaIdx(prev.length);
      return [...prev, filaInventarioVacia()];
    });
  };

  const eliminarFilaInventario = (index) => {
    setFilasInventario((prev) => {
      if (prev.length <= 1) return prev;
      const nuevas = prev.filter((_, i) => i !== index);
      setFilaInventarioExpandidaIdx((actual) => {
        if (actual === index) return Math.max(0, index - 1);
        return actual > index ? actual - 1 : actual;
      });
      return nuevas;
    });
  };

  // Stock con el que nace un producto nuevo. Bodega: siempre 0 (entra luego
  // por "Entrada de Mercadería"). Barbería: "servicio" = null (sin
  // seguimiento, nunca se agota) y "producto" = la cantidad que escribió.
  const stockInicialDeFila = (f) => {
    if (!esBarberia) return 0;
    if (f.tipoItem === 'producto') return Math.max(0, Number(f.stock_inicial) || 0);
    return null;
  };

  // Barbería: minutos que dura un servicio nuevo (vacío = se usan 30 en la agenda).
  const duracionInicialDeFila = (f) => {
    if (!esBarberia || f.tipoItem === 'producto') return null;
    const texto = String(f.duracion_min ?? '').trim();
    return texto === '' ? null : Number(texto);
  };

  const guardarInventarioInicial = async () => {
    const filasNuevas = filasInventario.filter((f) => !f.productoExistenteId && f.descripcion.trim() && f.precio_venta);
    const filasExistentes = filasInventario.filter((f) => f.productoExistenteId);
    const duracionInvalida = filasNuevas.some((f) => {
      const d = duracionInicialDeFila(f);
      return d !== null && !(Number.isInteger(d) && d >= 5 && d <= 480);
    });
    if (duracionInvalida) {
      notificar('La duración del servicio debe ser un número entero de minutos, entre 5 y 480.', 'error');
      return;
    }

    if (filasNuevas.length === 0 && filasExistentes.length === 0) {
      notificar('Completa al menos un producto con descripción y precio de venta, o selecciona uno existente.', 'error');
      return;
    }

    const filasAValidar = [...filasNuevas, ...filasExistentes];
    const precioInvalido = filasAValidar.some((f) => !(Number(f.precio_venta) > 0));
    const costoInvalido = filasAValidar.some((f) => !esMontoNoNegativo(f.precio_costo));
    if (precioInvalido || costoInvalido) {
      notificar(precioInvalido ? 'El precio de venta debe ser mayor que 0.' : 'El precio de costo no puede ser negativo.', 'error');
      return;
    }

    setGuardandoInventario(true);
    try {
      if (esModoDemo) {
        // Modo Demo Local: se escribe directo en el catálogo en memoria,
        // sin tocar Supabase (la bodega demo no existe de verdad ahí).
        if (!catalogoDemoRef.current) catalogoDemoRef.current = catalogoDemoInicial();
        let siguienteId = catalogoDemoRef.current.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
        if (filasNuevas.length > 0) {
          const nuevos = filasNuevas.map((f) => ({
            id: String(siguienteId++),
            bodega_id: bodegaId,
            descripcion: f.descripcion.trim(),
            cod_ean: f.cod_ean.trim() || generarCodigoInterno(),
            sku: f.sku.trim() || generarSKU(f.categoria),
            categoria: f.categoria.trim() || 'General',
            foto_url: f.foto_url || null,
            precio_costo: Number(f.precio_costo) || 0,
            precio_venta: Number(f.precio_venta) || 0,
            unidad: f.unidad === 'KG' ? 'KG' : 'UND',
            stock_actual: stockInicialDeFila(f),
            activo: true,
            ...normalizarCamposPack(f)
          }));
          catalogoDemoRef.current = [...catalogoDemoRef.current, ...nuevos];
        }
        if (filasExistentes.length > 0) {
          catalogoDemoRef.current = catalogoDemoRef.current.map((p) => {
            const f = filasExistentes.find((fe) => fe.productoExistenteId === p.id);
            if (!f) return p;
            return {
              ...p,
              precio_costo: Number(f.precio_costo) || 0,
              precio_venta: Number(f.precio_venta) || 0,
              sku: f.sku.trim() || p.sku,
              ...normalizarCamposPack(f)
            };
          });
        }
      } else if (sbClient) {
        if (filasNuevas.length > 0) {
          const payloadNuevos = filasNuevas.map((f) => ({
            id: f.id,
            bodega_id: bodegaId,
            descripcion: f.descripcion.trim(),
            cod_ean: f.cod_ean.trim() || generarCodigoInterno(),
            sku: f.sku.trim() || generarSKU(f.categoria),
            categoria: f.categoria.trim() || 'General',
            foto_url: f.foto_url || null,
            // Si la descripción/categoría/foto vinieron de una
            // sugerencia del catálogo maestro, queda enlazado a esa
            // ficha (ver el JOIN en cargarProductos).
            catalogo_maestro_id: f.catalogoMaestroId || null,
            precio_costo: Number(f.precio_costo) || 0,
            precio_venta: Number(f.precio_venta) || 0,
            unidad: f.unidad === 'KG' ? 'KG' : 'UND',
            // Este formulario ya solo crea/actualiza la ficha del producto
            // (maestro) -- el stock siempre entra después por "Entrada de
            // Mercadería", así que un producto nuevo arranca en 0. Excepción:
            // en una barbería no existe esa pantalla, así que aquí se elige
            // servicio (sin stock, null) o producto (con su cantidad inicial).
            stock_actual: stockInicialDeFila(f),
            ...(esBarberia ? { duracion_min: duracionInicialDeFila(f) } : {}),
            ...normalizarCamposPack(f)
          }));
          const { error } = await sbClient.from('productos').insert(payloadNuevos);
          if (error) throw error;
        }

        // Productos ya existentes: solo actualiza su ficha (precio,
        // categoría, sku, pack) -- este formulario ya no toca el stock,
        // eso se hace siempre desde "Entrada de Mercadería".
        // Cada fila es un producto distinto, así que se procesan todas a
        // la vez en vez de una por una -- con varias filas, esto evita
        // esperar N viajes de red seguidos antes de terminar de guardar.
        await Promise.all(filasExistentes.map(async (f) => {
          const { error: errUpd } = await sbClient
            .from('productos')
            .update({
              precio_costo: Number(f.precio_costo) || 0,
              precio_venta: Number(f.precio_venta) || 0,
              sku: f.sku.trim() || undefined,
              ...normalizarCamposPack(f)
            })
            .eq('id', f.productoExistenteId);
          if (errUpd) throw errUpd;
        }));
      }

      setModalInventarioInicial(false);
      setFilasInventario([filaInventarioVacia()]);
      setFilaInventarioExpandidaIdx(0);
      setPasoInventario(1);
      cargarProductos();
      const partes = [];
      if (filasNuevas.length > 0) partes.push(`${filasNuevas.length} nuevo(s)`);
      if (filasExistentes.length > 0) partes.push(`${filasExistentes.length} actualizado(s)`);
      notificar(`¡Listo! ${partes.join(' y ')}.`, 'success');
    } catch (err) {
      notificar(mensajeError(err, 'Error al guardar el inventario'), 'error');
    } finally {
      setGuardandoInventario(false);
    }
  };

  // ==========================================
  // IMPORTAR DEL CATÁLOGO MAESTRO
  // ==========================================
  // Lo usa "Registrar Productos" (ahí sugiere categoría + foto mientras
  // se escribe la descripción, ver sugerenciasParaFila).
  const cargarCatalogoMaestroDisponible = useCallback(() => {
    // Si la bodega tiene el Catálogo Maestro desactivado (ver panel de
    // administrador), ni se pide -- así también quedan sin efecto las
    // sugerencias automáticas en "Registrar Productos", que leen de
    // este mismo estado.
    if (esModoDemo || !sbClient || sesion?.bodega?.mostrar_catalogo_maestro === false) return;
    setCargandoMaestroImport(true);
    sbClient.from('catalogo_maestro').select('*').order('descripcion')
      .then(({ data, error }) => {
        if (error) throw error;
        setCatalogoMaestroDisponible(data || []);
      })
      .catch((err) => console.warn('No se pudo cargar el catálogo maestro:', err.message))
      .finally(() => setCargandoMaestroImport(false));
  }, [esModoDemo, sbClient, sesion?.bodega?.mostrar_catalogo_maestro]);

  // "Registrar Productos" también se apoya en el catálogo maestro para
  // sugerir categoría y foto -- se carga apenas se abre el modal, sin
  // que el bodeguero tenga que ir a buscarlo a otro lado.
  useEffect(() => {
    if (modalInventarioInicial) cargarCatalogoMaestroDisponible();
  }, [modalInventarioInicial]);

  return {
    actualizarCodigoEanFila, actualizarCodigoEanPackFila, actualizarFilaInventario,
    buscarProductoExistente, desvincularFilaInventario, eliminarFilaInventario,
    guardarInventarioInicial, subiendoFotoFilaIdx, subirFotoFilaInventario,
    sugerenciasMaestroParaFila, sugerenciasParaFila, sugerenciasParaFilaPack,
    usarSugerenciaMaestraEnFila, vincularProductoExistenteEnFila
  };
}
