// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { useRef, useEffect } from 'react';
import { mensajeError } from './utilidades.js';

export default function useCatalogo({
  bodegaId, busqueda, catalogoDemoInicial, catalogoDemoRef, esModoDemo, notificar, sbClient,
  setCargandoProductos, setProductos
}) {
  // ==========================================
  // PRODUCTOS & CATÁLOGO
  // ==========================================
  // Número de la última carga pedida: si una respuesta lenta de una búsqueda anterior
  // llega después de la más reciente, se descarta en vez de pisarla.
  const cargaProductosSeqRef = useRef(0);
  // Descarga SIEMPRE el catálogo completo de la bodega. La búsqueda se filtra en
  // memoria (productosFiltrados): es instantánea, funciona sin internet y no
  // consulta al servidor por cada búsqueda. El parámetro se ignora; queda para
  // no tocar las llamadas existentes.
  const cargarProductos = async () => {
    if (!bodegaId) return;
    const miCarga = ++cargaProductosSeqRef.current;

    // Modo Demo Local: nunca toca Supabase -- el catálogo vive en
    // catalogoDemoRef (se crea una sola vez) y conserva ahí cualquier
    // cambio hecho durante la demo en vez de reiniciarse a los datos
    // de ejemplo cada vez que algo refresca el catálogo.
    if (esModoDemo) {
      if (!catalogoDemoRef.current) catalogoDemoRef.current = catalogoDemoInicial();
      setProductos(catalogoDemoRef.current.filter((p) => p.activo !== false));
      setCargandoProductos(false);
      return;
    }

    // Primera carga de esta bodega en la sesión: se muestra
    // al instante el último catálogo guardado en este equipo mientras
    // llega el actualizado (stock y precios se corrigen solos al terminar).
    let desdeCache = false;
    const claveCache = `kz_catalogo_${bodegaId}`;
    if (catalogoCacheadoRef.current !== bodegaId) {
      catalogoCacheadoRef.current = bodegaId;
      try {
        const guardado = JSON.parse(localStorage.getItem(claveCache) || 'null');
        if (Array.isArray(guardado) && guardado.length > 0) {
          setProductos(guardado);
          desdeCache = true;
        }
      } catch (err) { /* caché ilegible: se carga normal */ }
    }
    setCargandoProductos(!desdeCache);
    if (sbClient) {
      try {
        const TAMANO_LOTE_CATALOGO = 1000;
        const construirQuery = (conFotoMaestro, desdeId = null) => {
          let q = sbClient
            .from('productos')
            .select(conFotoMaestro ? '*, catalogo_maestro(foto_url)' : '*')
            .eq('bodega_id', bodegaId)
            .order('id', { ascending: true })
            .limit(TAMANO_LOTE_CATALOGO);
          if (desdeId) q = q.gt('id', desdeId);
          return q;
        };

        // Supabase corta cada respuesta en 1.000 filas: una bodega con más
        // productos veía el catálogo incompleto sin ningún aviso. Se trae
        // por lotes con cursor sobre el id (no con OFFSET: si alguien
        // agrega un producto a mitad de la carga, no se repite ni se salta
        // ninguno) y al final se ordena por descripción, como antes.
        const traerCatalogoCompleto = async (conFotoMaestro) => {
          const filas = [];
          let desdeId = null;
          for (;;) {
            const { data: lote, error: errLote } = await construirQuery(conFotoMaestro, desdeId);
            if (errLote) return { data: null, error: errLote };
            filas.push(...(lote || []));
            if (!lote || lote.length < TAMANO_LOTE_CATALOGO) break;
            desdeId = lote[lote.length - 1].id;
          }
          filas.sort((a, b) => String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es'));
          return { data: filas, error: null };
        };

        let { data, error } = await traerCatalogoCompleto(true);
        if (error) {
          // Compatibilidad: si todavía no se corrió
          // catalogo_maestro_enlazar_foto.sql, la relación no existe en
          // el schema cache y este primer intento falla -- se reintenta
          // sin el JOIN en vez de dejar el catálogo entero sin cargar.
          ({ data, error } = await traerCatalogoCompleto(false));
        }
        if (error) throw error;
        if (miCarga !== cargaProductosSeqRef.current) return;

        // Se filtra "activo" en el cliente (no en la consulta) para que la
        // app no se rompa si todavía no corriste la migración que agrega
        // esa columna: un producto sin el campo (undefined) se sigue
        // mostrando con normalidad.
        const visibles = (data || [])
          .filter((p) => p.activo !== false)
          // Si el producto está enlazado a una ficha del catálogo
          // maestro, su foto en vivo manda sobre la que se copió al
          // importarlo -- así una foto que subas después también les
          // llega a las bodegas que ya lo tenían.
          .map((p) => (p.catalogo_maestro ? { ...p, foto_url: p.catalogo_maestro.foto_url || p.foto_url } : p));
        // Se reutilizan los objetos que no cambiaron: así, al refrescar el
        // catálogo tras una venta, las tarjetas sin cambios no se vuelven
        // a renderizar (y no hay destello).
        setProductos((prev) => {
          const previos = new Map(prev.map((x) => [x.id, x]));
          const nuevos = visibles.map((n) => {
            const o = previos.get(n.id);
            return o && JSON.stringify(o) === JSON.stringify(n) ? o : n;
          });
          const igual = nuevos.length === prev.length && nuevos.every((x, i) => x === prev[i]);
          return igual ? prev : nuevos;
        });
        {
          // En un momento libre y solo si cambió: serializar y escribir cientos de
          // productos en localStorage bloquea el hilo justo cuando se pinta la lista.
          const guardarCache = () => {
            try {
              const texto = JSON.stringify(visibles);
              if (texto.length >= 2_500_000) localStorage.removeItem(claveCache);
              else if (localStorage.getItem(claveCache) !== texto) localStorage.setItem(claveCache, texto);
            } catch (err) { /* almacenamiento lleno o bloqueado: se sigue sin caché */ }
          };
          if (typeof requestIdleCallback === 'function') requestIdleCallback(guardarCache, { timeout: 3000 });
          else setTimeout(guardarCache, 300);
        }
      } catch (err) {
        if (miCarga !== cargaProductosSeqRef.current) return;
        // Sin internet pero con catálogo guardado: se conserva lo que ya se ve.
        if (!desdeCache) setProductos([]);
        notificar(mensajeError(err, 'No se pudieron cargar tus productos'), 'error');
      } finally {
        if (miCarga === cargaProductosSeqRef.current) setCargandoProductos(false);
      }
    } else {
      setProductos([]);
      setCargandoProductos(false);
    }
  };

  // Catálogo en vivo: escucha los cambios de `productos` de la bodega
  // (stock tras una venta, precios, nombres, fotos, altas y bajas) y los
  // aplica a la grilla sin recargar. Requiere realtime_productos.sql;
  // si no está activado, el catálogo sigue refrescándose como siempre.
  // Actualiza solo algunos productos (por ejemplo, los de una venta) sin volver a
  // descargar el catálogo completo: pide únicamente esas filas y las funde en la grilla.
  const refrescarProductosPorId = async (ids) => {
    const lista = [...new Set((ids || []).filter(Boolean))];
    if (lista.length === 0) return;
    if (esModoDemo || !sbClient || !bodegaId) { cargarProductos(busquedaActualRef.current); return; }
    try {
      const { data, error } = await sbClient.from('productos').select('*').eq('bodega_id', bodegaId).in('id', lista);
      if (error) throw error;
      const nuevos = new Map((data || []).map((x) => [x.id, x]));
      setProductos((prev) => {
        let cambio = false;
        const siguiente = prev.map((o) => {
          const nuevo = nuevos.get(o.id);
          if (!nuevo) return o;
          if (nuevo.activo === false) { cambio = true; return null; }
          // La foto del catálogo maestro manda sobre la copiada al importar, y esta consulta no trae ese JOIN.
          const fusion = { ...o, ...nuevo, foto_url: o.catalogo_maestro ? o.foto_url : nuevo.foto_url, catalogo_maestro: o.catalogo_maestro };
          if (JSON.stringify(fusion) === JSON.stringify(o)) return o;
          cambio = true;
          return fusion;
        }).filter(Boolean);
        return cambio ? siguiente : prev;
      });
    } catch (err) {
      cargarProductos(busquedaActualRef.current);
    }
  };

  const busquedaActualRef = useRef('');
  busquedaActualRef.current = busqueda;
  const recargaCatalogoTimer = useRef(null);
  const catalogoCacheadoRef = useRef(null);
  useEffect(() => {
    if (esModoDemo || !sbClient || !bodegaId) return;
    const recargarSuave = () => {
      clearTimeout(recargaCatalogoTimer.current);
      recargaCatalogoTimer.current = setTimeout(() => cargarProductos(busquedaActualRef.current), 400);
    };
    const canal = sbClient
      .channel(`productos-${bodegaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'productos', filter: `bodega_id=eq.${bodegaId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = payload.old?.id;
            if (id) setProductos((prev) => (prev.some((x) => x.id === id) ? prev.filter((x) => x.id !== id) : prev));
            return;
          }
          const n = payload.new;
          if (!n?.id) return;
          if (payload.eventType === 'UPDATE') {
            setProductos((prev) => {
              const i = prev.findIndex((x) => x.id === n.id);
              // Desactivado: sale de la grilla. No está en la grilla actual
              // (por ejemplo por una búsqueda): se ignora.
              if (n.activo === false) return i === -1 ? prev : prev.filter((x) => x.id !== n.id);
              if (i === -1) return prev;
              const o = prev[i];
              // La foto del catálogo maestro manda sobre la copiada al
              // importar (ver cargarProductos), y el evento no trae el JOIN.
              const fusion = { ...o, ...n, foto_url: o.catalogo_maestro ? o.foto_url : n.foto_url, catalogo_maestro: o.catalogo_maestro };
              const copia = prev.slice();
              copia[i] = fusion;
              return copia;
            });
            return;
          }
          // INSERT: la posición y el filtro de búsqueda los resuelve una recarga.
          recargarSuave();
        }
      )
      .subscribe();
    return () => {
      clearTimeout(recargaCatalogoTimer.current);
      sbClient.removeChannel(canal);
    };
  }, [esModoDemo, bodegaId]);

  return {
    cargarProductos, refrescarProductosPorId
  };
}
