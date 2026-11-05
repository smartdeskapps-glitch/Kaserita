// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
// "tarde": valores que el POS declara después de este hook; se leen solo dentro de
// funciones y efectos (cuando ya están completos).
import { useRef, useEffect, useMemo } from 'react';
import { asegurarZXing } from './utilidades.js';
import { calcularDescuento } from '../lib/descuentos.js';

export default function useLectores({
  bodegaId, buscarProductoPorCodigo, busqueda, camaraDeviceId, camarasDisponibles,
  campoEscaneandoFila, campoTeclado, carrito, combosRechazadosRef, cuentaVencida,
  descuentoTipo, descuentoValor, detectorLoopRef, esModoDemo, filaEscaneandoIndex,
  handleClicProducto, medioPago, metodoForzado, modalEscaner, modoEscaner, montoMixtoOtro,
  montoMixtoRecibido, montoRecibido, notificar, productos, sbClient, sesion, setBusqueda,
  setCamaraDeviceId, setCamarasDisponibles, setCampoEscaneandoFila, setCarrito,
  setDestelloEscaner, setDniCliente, setErrorEscaner, setFilaEscaneandoIndex,
  setFormEditarProducto, setListaEscaneada, setMedioPago, setMetodoForzado, setModalEscaner,
  setModoEscaner, setMontoMixtoOtro, setMontoMixtoRecibido, setMontoRecibido,
  setProductoEscaneadoId, setUsandoDetectorNativo, streamNativoRef, turnoActivo,
  ultimoEscaneoRef, unidadesEnCarritoDe, videoNativoRef, tarde
}) {
  // ==========================================
  // LECTOR BLUETOOTH / USB (se comporta como un teclado)
  // ==========================================
  // Estos lectores "escriben" el código a toda velocidad y cierran con
  // Enter. Si el cursor está en el buscador, ya funciona con
  // handleKeyDownBusqueda; esto cubre el resto: se escucha el teclado en
  // toda la pantalla y, cuando llega una ráfaga rápida de teclas
  // (imposible de tipear a mano) y no hay ningún campo de texto ni
  // ventana abierta, se toma como un escaneo y se agrega el producto.
  const escanearCodigoRef = useRef(null);
  const pitidoCtxRef = useRef(null);
  const pitido = (ok) => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = pitidoCtxRef.current || (pitidoCtxRef.current = new AC());
      const osc = ctx.createOscillator();
      const ganancia = ctx.createGain();
      osc.frequency.value = ok ? 1200 : 300;
      ganancia.gain.value = 0.08;
      osc.connect(ganancia);
      ganancia.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
    } catch {
      // sin sonido, no pasa nada
    }
  };
  escanearCodigoRef.current = async (codigo) => {
    if (!sesion || cuentaVencida) return;
    if (!turnoActivo) {
      notificar('Abre un turno para poder escanear productos.', 'info');
      return;
    }
    let hallado = buscarProductoPorCodigo(codigo);
    // La lista en pantalla puede estar filtrada por una búsqueda: si no
    // está ahí, se busca el código exacto en toda la bodega.
    if (!hallado && sbClient && !esModoDemo && /^[A-Za-z0-9_-]+$/.test(codigo)) {
      try {
        const { data } = await sbClient
          .from('productos')
          .select('*')
          .eq('bodega_id', bodegaId)
          .or(`cod_ean.eq.${codigo},cod_ean_pack.eq.${codigo}`)
          .limit(1);
        const p = (data || []).find((x) => x.activo !== false);
        if (p) {
          const esPack = (p.cod_ean_pack || '').toLowerCase() === codigo.toLowerCase()
            && (p.cod_ean || '').toLowerCase() !== codigo.toLowerCase();
          hallado = { producto: p, esPack };
        }
      } catch {
        // se cae al aviso de "no registrado"
      }
    }
    if (hallado) {
      pitido(true);
      handleClicProducto(hallado.producto, hallado.esPack ? 'PACK' : 'UNIDAD');
    } else {
      pitido(false);
      notificar(`El código ${codigo} no está registrado.`, 'error');
    }
  };
  useEffect(() => {
    const MAX_PAUSA_MS = 50;
    let buffer = '';
    let ultima = 0;
    let temporizador = null;
    const limpiar = () => { buffer = ''; if (temporizador) { clearTimeout(temporizador); temporizador = null; } };
    const esCampoEditable = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    const hayVentanaAbierta = () => !!document.querySelector('.fixed.inset-0');
    const disparar = (codigo) => {
      if (hayVentanaAbierta()) return;
      escanearCodigoRef.current?.(codigo);
    };
    const alPresionar = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (esCampoEditable(e.target)) { limpiar(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (buffer.length >= 4) {
          // El Enter del lector no debe activar el botón que haya quedado enfocado.
          e.preventDefault();
          e.stopPropagation();
          const codigo = buffer;
          limpiar();
          disparar(codigo);
        } else {
          limpiar();
        }
        return;
      }
      if (e.key.length !== 1) return;
      const ahora = performance.now();
      if (ahora - ultima > MAX_PAUSA_MS) buffer = '';
      ultima = ahora;
      buffer += e.key;
      if (buffer.length > 1) e.preventDefault();
      // Lectores configurados sin Enter al final: se cierra solo tras una pausa.
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        const codigo = buffer;
        limpiar();
        if (codigo.length >= 8) disparar(codigo);
      }, 120);
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => { window.removeEventListener('keydown', alPresionar, true); limpiar(); };
  }, []);

  // ==========================================
  // LECTOR DE CÓDIGO DE BARRAS / BUSCADOR
  // ==========================================
  const handleKeyDownBusqueda = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = busqueda.trim().toLowerCase();
      if (!term) return;

      const encontradoPorCodigo = buscarProductoPorCodigo(term);
      if (encontradoPorCodigo) {
        handleClicProducto(encontradoPorCodigo.producto, encontradoPorCodigo.esPack ? 'PACK' : 'UNIDAD');
        setBusqueda('');
        return;
      }

      const coincidencias = productos.filter(
        p => (p.descripcion || '').toLowerCase().includes(term) || (p.cod_ean || '').includes(term)
      );
      if (coincidencias.length === 1) {
        handleClicProducto(coincidencias[0]);
        setBusqueda('');
      }
      // Si hay varias o ninguna, la grilla ya muestra el resultado del filtro en memoria.
    }
  };

  // ==========================================
  // LECTOR DE CÓDIGO DE BARRAS POR CÁMARA
  // ==========================================
  const handleCodigoEscaneado = (codigo) => {
    const codigoLimpio = (codigo || '').trim();
    if (!codigoLimpio) return;

    // Evita procesar el mismo código varias veces mientras la cámara
    // sigue enfocando el mismo código de barras.
    const ahora = Date.now();
    if (ultimoEscaneoRef.current.codigo === codigoLimpio && ahora - ultimoEscaneoRef.current.hora < 2500) {
      return;
    }
    ultimoEscaneoRef.current = { codigo: codigoLimpio, hora: ahora };
    if (navigator.vibrate) navigator.vibrate(60);
    setDestelloEscaner(true);
    setTimeout(() => setDestelloEscaner(false), 800);

    if (modoEscaner === 'inventario') {
      if (filaEscaneandoIndex !== null) {
        if (campoEscaneandoFila === 'cod_ean_pack') {
          tarde.actualizarCodigoEanPackFila(filaEscaneandoIndex, codigoLimpio, true);
        } else {
          tarde.actualizarCodigoEanFila(filaEscaneandoIndex, codigoLimpio);
          const encontrado = tarde.buscarProductoExistente(codigoLimpio);
          notificar(
            encontrado
              ? `Producto existente encontrado: ${encontrado.descripcion}`
              : `Código capturado: ${codigoLimpio} (producto nuevo)`,
            'success'
          );
        }
      }
      setModalEscaner(false);
      return;
    }

    if (modoEscaner === 'entrada-mercaderia') {
      const encontrado = buscarProductoPorCodigo(codigoLimpio);
      if (encontrado) {
        tarde.elegirProductoEntrada(encontrado.producto, encontrado.esPack);
        notificar(`Producto encontrado: ${encontrado.producto.descripcion}`, 'success');
      } else {
        notificar(`Código ${codigoLimpio} no encontrado en tus productos.`, 'error');
      }
      setModalEscaner(false);
      return;
    }

    if (modoEscaner === 'merma') {
      const encontrado = buscarProductoPorCodigo(codigoLimpio);
      if (encontrado) {
        tarde.elegirProductoMerma(encontrado.producto);
      } else {
        notificar(`Código ${codigoLimpio} no encontrado en tus productos.`, 'error');
      }
      setModalEscaner(false);
      return;
    }

    if (modoEscaner === 'editar-pack-ean') {
      setFormEditarProducto((prev) => ({ ...prev, cod_ean_pack: codigoLimpio }));
      notificar(`Código de pack capturado: ${codigoLimpio}`, 'success');
      setModalEscaner(false);
      return;
    }

    if (modoEscaner === 'toma-inventario') {
      // A diferencia de los demás modos, acá la cámara NO se cierra al
      // detectar un código -- se queda abierta y arriba del visor
      // aparece un panel para anotar la cantidad de ese producto (ver
      // el modal del escáner), para poder seguir escaneando uno tras
      // otro sin soltar el celular ni perder de vista la cámara.
      const encontrado = buscarProductoPorCodigo(codigoLimpio);
      if (encontrado) {
        tarde.agregarProductoAConteo(encontrado.producto);
        setProductoEscaneadoId(encontrado.producto.id);
      } else {
        setProductoEscaneadoId(null);
        notificar(`Código ${codigoLimpio} no encontrado en tus productos.`, 'error');
      }
      return;
    }

    const encontradoPorCodigo = buscarProductoPorCodigo(codigoLimpio);
    if (encontradoPorCodigo) {
      handleClicProducto(encontradoPorCodigo.producto, encontradoPorCodigo.esPack ? 'PACK' : 'UNIDAD');
      const claveEsc = encontradoPorCodigo.esPack ? `${encontradoPorCodigo.producto.id}::pack` : encontradoPorCodigo.producto.id;
      setListaEscaneada((prev) => [claveEsc, ...prev.filter((c) => c !== claveEsc)].slice(0, 6));
    } else {
      setModalEscaner(false);
      notificar(`Código ${codigoLimpio} no encontrado en tus productos.`, 'error');
    }
  };

  const abrirEscanerParaVenta = () => {
    setListaEscaneada([]);
    setModoEscaner('venta');
    setFilaEscaneandoIndex(null);
    setMetodoForzado(null);
    setModalEscaner(true);
  };

  const abrirEscanerParaFilaInventario = (idx, campo = 'cod_ean') => {
    setModoEscaner('inventario');
    setFilaEscaneandoIndex(idx);
    setCampoEscaneandoFila(campo);
    setMetodoForzado(null);
    setModalEscaner(true);
  };

  // Inicia/detiene la cámara cuando se abre o cierra el modal del escáner.
  // Se pide la cámara UNA sola vez y se comparte entre los dos métodos:
  //  - Nativo (BarcodeDetector): analiza el <video> en vivo directamente,
  //    sin canvas intermedio -- el más rápido cuando el navegador lo trae
  //    (Chrome/Android).
  //  - Respaldo (zxing-wasm): el motor real de ZXing (C++) compilado a
  //    WebAssembly, mucho más preciso que cualquier decodificador 100% JS
  //    -- funciona en cualquier navegador (Safari, Firefox, PC, Android
  //    viejo) sin depender de que exista BarcodeDetector.
  useEffect(() => {
    if (!modalEscaner) return;
    setErrorEscaner('');
    let activo = true;

    const detenerTodo = () => {
      if (detectorLoopRef.current) {
        cancelAnimationFrame(detectorLoopRef.current);
        clearTimeout(detectorLoopRef.current);
        detectorLoopRef.current = null;
      }
      if (streamNativoRef.current) {
        streamNativoRef.current.getTracks().forEach((t) => t.stop());
        streamNativoRef.current = null;
      }
    };

    // Respaldo: zxing-wasm. Como decodificar en WASM es más pesado que el
    // detector nativo del navegador, no se corre en cada requestAnimationFrame
    // (saturaría el celular) sino cada ~200ms, y solo se agenda el
    // siguiente intento cuando el anterior ya terminó.
    const correrFallback = async (video) => {
      try {
        const urlWasm = await asegurarZXing();
        await ZXingWASM.prepareZXingModule({
          overrides: {
            locateFile: (path) => (path.endsWith('.wasm') ? urlWasm : path)
          }
        });
      } catch (err) {
        if (!activo) return;
        setErrorEscaner('No se pudo cargar el lector de códigos. Revisa tu conexión a internet.');
        console.warn('[escaner] Error al preparar zxing-wasm:', err);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let frames = 0;
      let procesando = false;

      const intentar = async () => {
        if (!activo) return;
        if (procesando || video.readyState < 2 || video.videoWidth === 0) {
          detectorLoopRef.current = setTimeout(intentar, 150);
          return;
        }
        procesando = true;
        frames++;
        try {
          // Decodificar a resolución completa (hasta 1920x1080) es
          // innecesario para leer un código de barras y en celulares sin
          // detector nativo mantenía la CPU/batería trabajando fuerte
          // mientras el escáner estaba abierto. Se achica la imagen a un
          // ancho máximo antes de decodificar -- mucho más liviano y
          // sigue siendo más que suficiente resolución para el código.
          const ANCHO_MAX_DECODIFICAR = 640;
          const escala = Math.min(1, ANCHO_MAX_DECODIFICAR / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * escala);
          canvas.height = Math.round(video.videoHeight * escala);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          // "tryHarder" es el modo más lento y minucioso del decodificador.
          // Se usa solo cada 4 intentos (~800ms) en vez de siempre -- la
          // mayoría de las veces un código se lee al toque con el modo
          // rápido, y el modo a fondo sigue entrando periódicamente por si
          // el código está borroso, girado o con poca luz.
          const usarTryHarder = frames % 4 === 0;
          const resultados = await ZXingWASM.readBarcodesFromImageData(imgData, {
            tryHarder: usarTryHarder,
            formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128', 'Code39', 'QRCode']
          });
          if (activo && resultados && resultados.length > 0 && resultados[0].text) {
            handleCodigoEscaneado(resultados[0].text);
          }
        } catch (e) {
          console.warn('[escaner] error en zxing-wasm:', e);
        }
        procesando = false;
        if (activo) detectorLoopRef.current = setTimeout(intentar, 200);
      };

      intentar();
    };

    // Principal: detector nativo del navegador, directo sobre el <video>.
    const correrNativo = async (video) => {
      let formatos = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];
      try {
        const soportados = await window.BarcodeDetector.getSupportedFormats();
        const filtrados = formatos.filter((f) => soportados.includes(f));
        if (filtrados.length > 0) formatos = filtrados;
      } catch (e) { /* si falla, se intenta con la lista por defecto */ }

      const detector = new window.BarcodeDetector({ formats: formatos });
      let detectando = false;
      let ultimaLectura = 0;

      const loop = () => {
        if (!activo) return;
        detectorLoopRef.current = requestAnimationFrame(loop);
        // Un código se lee igual de rápido con ~10 intentos por segundo que con 60,
        // y se ahorra batería. Tampoco se analiza con la pantalla en segundo plano.
        const ahora = performance.now();
        if (detectando || video.readyState < 2 || document.hidden || ahora - ultimaLectura < 100) return;
        ultimaLectura = ahora;
        detectando = true;
        detector.detect(video)
          .then((resultados) => {
            detectando = false;
            if (activo && resultados && resultados.length > 0) {
              handleCodigoEscaneado(resultados[0].rawValue);
            }
          })
          .catch((e) => {
            detectando = false;
            console.warn('[escaner] error del detector nativo:', e);
          });
      };

      if (video.readyState >= 2) {
        loop();
      } else {
        video.addEventListener('canplay', () => { if (activo) loop(); }, { once: true });
        setTimeout(() => { if (activo && !detectorLoopRef.current) loop(); }, 1500);
      }
    };

    const iniciar = async () => {
      try {
        const pedirConDeviceId = (deviceId) => navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          }
        });
        const pedirPorFacingMode = () => navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          }
        });

        let stream = camaraDeviceId ? await pedirConDeviceId(camaraDeviceId) : await pedirPorFacingMode();

        // Algunos celulares (sobre todo ciertos Android/WebView) no
        // respetan facingMode:'environment' y abren la delantera igual
        // -- recién con permiso ya concedido (el getUserMedia de arriba)
        // el navegador entrega los nombres reales de cámara, así que se
        // revisa si hay una que suene a "trasera" y, si la que se abrió
        // no es esa, se cambia sola sin que el usuario tenga que hacer
        // nada. El botón "Cambiar cámara" queda como respaldo manual
        // por si ni así detecta bien en algún equipo.
        if (!camaraDeviceId) {
          try {
            const dispositivos = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
            setCamarasDisponibles(dispositivos);
            const idActual = stream.getVideoTracks()[0]?.getSettings().deviceId;
            const trasera = dispositivos.find((d) => /back|rear|trasera|environment/i.test(d.label));
            if (trasera && trasera.deviceId !== idActual) {
              try {
                const streamTrasera = await pedirConDeviceId(trasera.deviceId);
                stream.getTracks().forEach((t) => t.stop());
                stream = streamTrasera;
              } catch (e) {
                console.warn('[escaner] no se pudo cambiar a la cámara trasera detectada:', e);
              }
            }
          } catch (e) {
            console.warn('[escaner] no se pudo listar las cámaras disponibles:', e);
          }
        }

        if (!activo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamNativoRef.current = stream;
        if (!videoNativoRef.current) return;
        const video = videoNativoRef.current;
        video.srcObject = stream;
        await video.play();

        const usarNativo = metodoForzado === 'wasm' ? false : ('BarcodeDetector' in window);
        setUsandoDetectorNativo(usarNativo);

        if (usarNativo) {
          correrNativo(video);
        } else {
          correrFallback(video);
        }
      } catch (err) {
        if (!activo) return;
        setErrorEscaner('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
        console.warn('[escaner] Error al iniciar la cámara:', err);
      }
    };

    iniciar();

    return () => {
      activo = false;
      detenerTodo();
    };
  }, [modalEscaner, metodoForzado, camaraDeviceId]);

  // Botón "Cambiar cámara": pasa a la siguiente cámara disponible del
  // celular (ideal cuando la detección automática de la trasera no
  // acertó, ej. celulares con 2-3 lentes traseras y nombres raros).
  const cambiarCamara = () => {
    if (camarasDisponibles.length < 2) {
      notificar('Este dispositivo no tiene otra cámara para cambiar.', 'info');
      return;
    }
    const idActual = streamNativoRef.current?.getVideoTracks()[0]?.getSettings().deviceId || camaraDeviceId;
    const indiceActual = camarasDisponibles.findIndex((d) => d.deviceId === idActual);
    const siguiente = camarasDisponibles[(indiceActual + 1) % camarasDisponibles.length];
    setCamaraDeviceId(siguiente.deviceId);
  };

  const cambiarCantidadCarrito = (claveCarrito, delta) => {
    // Al subir la cantidad, comprueba que alcance el stock del catálogo (si el
    // producto está cargado y tiene seguimiento de stock).
    if (delta > 0) {
      const linea = carrito.find((item) => (item.claveCarrito || item.productoId) === claveCarrito);
      const prod = linea && !linea.esCombo ? productos.find((p) => p.id === linea.productoId) : null;
      if (prod && prod.stock_actual !== null && prod.stock_actual !== undefined) {
        const paso = linea.unidad === 'KG' ? 0.250 : 1;
        const extra = delta * paso * (linea.esPack ? (linea.unidadesPorPack || 1) : 1);
        if (unidadesEnCarritoDe(prod.id) + extra > (Number(prod.stock_actual) || 0) + 1e-9) {
          notificar(`Solo ${Number(prod.stock_actual) === 1 ? 'queda 1' : `quedan ${Number(prod.stock_actual)}`} de "${prod.descripcion}".`, 'error');
          return;
        }
      }
    }
    setCarrito(prev =>
      prev.map(item => {
        if ((item.claveCarrito || item.productoId) === claveCarrito) {
          const step = item.unidad === 'KG' ? 0.250 : 1;
          const nCant = +(item.cantidad + (delta * step)).toFixed(3);
          if (nCant <= 0) {
            if (item.esCombo) combosRechazadosRef.current.add(item.comboId);
            return null;
          }
          // El multiplicador de stock depende de si esta línea es pack o
          // suelta -- sin esto, subir/bajar la cantidad de una línea en
          // pack dejaba unidadesStock desactualizado y el checkout
          // descontaba mal el stock.
          const multiplicadorStock = item.esPack ? (item.unidadesPorPack || 1) : 1;
          return {
            ...item,
            cantidad: nCant,
            subtotal: +(nCant * item.precioUnitario).toFixed(2),
            unidadesStock: +(nCant * multiplicadorStock).toFixed(3)
          };
        }
        return item;
      }).filter(Boolean)
    );
  };

  const eliminarItemCarrito = (claveCarrito) => {
    setCarrito(prev => {
      const item = prev.find((it) => (it.claveCarrito || it.productoId) === claveCarrito);
      if (item?.esCombo) combosRechazadosRef.current.add(item.comboId);
      return prev.filter(it => (it.claveCarrito || it.productoId) !== claveCarrito);
    });
  };

  const totalVenta = useMemo(() => {
    return +carrito.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2);
  }, [carrito]);

  // Descuento sobre el total de la venta (% o monto fijo), nunca negativo
  // ni mayor al propio total.
  const montoDescuento = useMemo(
    () => calcularDescuento({ tipo: descuentoTipo, valor: descuentoValor, total: totalVenta }),
    [descuentoTipo, descuentoValor, totalVenta]
  );

  // Total que realmente se le cobra al cliente, después del descuento.
  const totalConDescuento = useMemo(() => {
    return +(totalVenta - montoDescuento).toFixed(2);
  }, [totalVenta, montoDescuento]);

  const vuelto = useMemo(() => {
    if (medioPago !== 'EFECTIVO' || !montoRecibido) return 0;
    const recibido = parseFloat(montoRecibido) || 0;
    return +(recibido - totalConDescuento).toFixed(2);
  }, [montoRecibido, totalConDescuento, medioPago]);

  // Monto que debe cubrirse en efectivo dentro de un pago mixto: el total
  // menos lo que ya se cubrió con tarjeta/otro (nunca negativo, ni mayor al total).
  const efectivoRequeridoMixto = useMemo(() => {
    const otro = Math.min(parseFloat(montoMixtoOtro) || 0, totalConDescuento);
    return +Math.max(0, totalConDescuento - otro).toFixed(2);
  }, [montoMixtoOtro, totalConDescuento]);

  // Vuelto del pago mixto: lo que el cliente entregó en efectivo físico
  // menos lo que realmente debía cubrir en efectivo.
  const vueltoMixto = useMemo(() => {
    if (!montoMixtoRecibido) return 0;
    const recibido = parseFloat(montoMixtoRecibido) || 0;
    return +(recibido - efectivoRequeridoMixto).toFixed(2);
  }, [montoMixtoRecibido, efectivoRequeridoMixto]);

  const asignarDesdeTeclado = (texto) => {
    if (campoTeclado === 'recibido') setMontoRecibido(texto);
    if (campoTeclado === 'mixtoOtro') setMontoMixtoOtro(texto);
    if (campoTeclado === 'mixtoRecibido') setMontoMixtoRecibido(texto);
  };

  const valorTeclado = campoTeclado === 'recibido' ? montoRecibido
    : campoTeclado === 'mixtoOtro' ? montoMixtoOtro
    : campoTeclado === 'mixtoRecibido' ? montoMixtoRecibido
    : '';

  // El medio de pago y el cliente elegidos son parte de la venta en curso,
  // no un ajuste de la sesión -- si no se limpian al terminar esa venta
  // (se pausa, se vacía el carrito, o se cancela el cobro), quedan
  // "pegados" y la siguiente venta puede terminar cobrada a crédito o a
  // nombre de un cliente que nadie eligió para ella.
  const reiniciarClienteYMedioPago = () => {
    setMedioPago('EFECTIVO');
    setDniCliente('99999999');
    tarde.obtenerOCrearCliente('99999999');
  };

  return {
    abrirEscanerParaFilaInventario, abrirEscanerParaVenta, asignarDesdeTeclado, cambiarCamara,
    cambiarCantidadCarrito, efectivoRequeridoMixto, handleKeyDownBusqueda, montoDescuento,
    reiniciarClienteYMedioPago, totalConDescuento, totalVenta, valorTeclado, vuelto,
    vueltoMixto
  };
}
