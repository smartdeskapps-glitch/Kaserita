import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './index.css';

    
    const generarUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    // Carga bajo demanda de librerías pesadas que solo hace falta usar de vez
    // en cuando (Excel, PDF, lector de códigos de barras). Cada URL se
    // descarga una sola vez -- si dos partes de la app la piden casi al
    // mismo tiempo (ej. dos botones de exportar), ambas reciben la MISMA
    // promesa en vez de inyectar el <script> dos veces.
    const scriptsExternosCargados = {};
    const cargarScriptExterno = (url) => {
      if (!scriptsExternosCargados[url]) {
        scriptsExternosCargados[url] = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = url;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
          document.head.appendChild(script);
        });
      }
      return scriptsExternosCargados[url];
    };
    const asegurarXLSX = () => cargarScriptExterno('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    const asegurarJsPDF = () => cargarScriptExterno('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    const asegurarConfetti = () => cargarScriptExterno('https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js');
    const asegurarZXing = () => cargarScriptExterno('https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/iife/reader/index.min.js');

    // La tabla productos exige cod_ean (no admite vacío), aunque hay artículos
    // reales sin código de barras (a granel, hechos en casa, etc.). Cuando el
    // cajero lo deja en blanco se genera un código interno único para que el
    // producto igual se pueda registrar.
    let contadorCodigoInterno = 0;
    const generarCodigoInterno = () => {
      contadorCodigoInterno += 1;
      return `INT-${Date.now()}-${contadorCodigoInterno}`;
    };

    // SKU: código interno corto y legible para identificar el producto en
    // reportes/estantes, sin depender del código de barras (que a veces no
    // existe o es larguísimo). Prefijo por categoría + sufijo corto -- no
    // hace falta que sea secuencial, solo distinto entre productos.
    const generarSKU = (categoria) => {
      const prefijo = (categoria || 'GEN')
        .normalize('NFD').replace(/[^\x00-\x7F]/g, '')
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'GEN';
      const sufijo = Math.random().toString(36).slice(2, 6).toUpperCase();
      return `${prefijo}-${sufijo}`;
    };

    // Convierte los campos de pack de un formulario (vendeEnPack,
    // unidades_por_pack, precio_venta_pack, cod_ean_pack -- como strings,
    // que es como los guardan los inputs) a los valores que espera la
    // columna de `productos`. Centralizado porque esta misma normalización
    // se repetía en cada lugar que crea o actualiza un producto -- si
    // alguna vez cambian las reglas (ej. permitir unidades_por_pack === 1),
    // solo hay que tocarlo acá.
    // OJO: no usar `.toISOString().slice(0, 10)` para esto -- toISOString()
    // convierte a UTC, así que en Perú (UTC-5) desde ~7pm hora local ya es
    // "mañana" en UTC y "Hoy" mostraba la fecha equivocada (ventas del día
    // desaparecían del historial). Se arma la fecha con los componentes
    // locales del Date en vez de convertir a UTC.
    const fechaISOLocal = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const fechaHoyISO = () => fechaISOLocal(new Date());

    const normalizarCamposPack = (f) => ({
      unidades_por_pack: f.vendeEnPack && Number(f.unidades_por_pack) > 1 ? Number(f.unidades_por_pack) : 1,
      precio_venta_pack: f.vendeEnPack && f.precio_venta_pack ? Number(f.precio_venta_pack) : null,
      cod_ean_pack: f.vendeEnPack && (f.cod_ean_pack || '').trim() ? f.cod_ean_pack.trim() : null
    });

    // La otra dirección: de una fila de `productos` a los campos (todos en
    // string, como los maneja un <input>) que arman un formulario de
    // creación/edición. Usado tanto al vincular una fila de "Registrar
    // Productos" a un producto existente como al abrir "Editar Producto" --
    // cada llamador le agrega encima los campos propios de su formulario
    // (stock_actual, productoExistenteId, etc.).
    const datosFormularioDesdeProducto = (producto) => ({
      descripcion: producto.descripcion || '',
      cod_ean: producto.cod_ean || '',
      sku: producto.sku || '',
      categoria: producto.categoria || 'General',
      precio_costo: producto.precio_costo != null ? String(producto.precio_costo) : '',
      precio_venta: producto.precio_venta != null ? String(producto.precio_venta) : '',
      unidad: producto.unidad || 'UND',
      vendeEnPack: Number(producto.unidades_por_pack) > 1,
      unidades_por_pack: Number(producto.unidades_por_pack) > 1 ? String(producto.unidades_por_pack) : '',
      precio_venta_pack: producto.precio_venta_pack != null ? String(producto.precio_venta_pack) : '',
      cod_ean_pack: producto.cod_ean_pack || '',
      foto_url: producto.foto_url || '',
      fotos_extra: producto.fotos_extra || [],
      descripcion_larga: producto.descripcion_larga || '',
      es_destacado: !!producto.es_destacado
    });

    // Exporta un arreglo de objetos a un archivo Excel (.xlsx) real descargable,
    // generado en el propio navegador con SheetJS (sin backend).
    const exportarExcel = async (nombreArchivo, filas, nombreHoja = 'Datos') => {
      if (!filas || filas.length === 0) return;
      try {
        await asegurarXLSX();
      } catch (err) {
        console.error(err);
        alert('No se pudo cargar el generador de Excel. Revisa tu conexión e intenta de nuevo.');
        return;
      }
      const hoja = XLSX.utils.json_to_sheet(filas);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
      XLSX.writeFile(libro, nombreArchivo);
    };

    // Recomprime una imagen a JPEG en el navegador (canvas), bajando primero
    // la calidad y después también la resolución, hasta quedar bajo maxKB o
    // hasta agotar los intentos -- así una foto de cámara (varios MB) no
    // llena el Storage ni tarda en cargar en el catálogo desde un celular
    // con poco dato móvil. La usa solo el admin (catálogo maestro): las
    // bodegas ya no pueden subir fotos, ver bloquear_fotos_bodega.sql.
    const comprimirImagenJPEG = (file, maxKB = 20, dimensionInicial = 480) => {
      return new Promise((resolve, reject) => {
        const urlTemp = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          let dimension = dimensionInicial;
          let calidad = 0.8;
          let intentos = 0;
          const maxIntentos = 25;

          const intentar = () => {
            intentos += 1;
            const escala = Math.min(1, dimension / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * escala));
            const h = Math.max(1, Math.round(img.height * escala));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            canvas.toBlob((blob) => {
              if (!blob) {
                URL.revokeObjectURL(urlTemp);
                reject(new Error('No se pudo procesar la imagen.'));
                return;
              }
              const dentroDelLimite = blob.size <= maxKB * 1024;
              const sinMasMargen = intentos >= maxIntentos || (calidad <= 0.35 && dimension <= 120);
              if (dentroDelLimite || sinMasMargen) {
                URL.revokeObjectURL(urlTemp);
                resolve(blob);
                return;
              }
              if (calidad > 0.35) {
                calidad = +(calidad - 0.1).toFixed(2);
              } else {
                dimension = Math.round(dimension * 0.8);
                calidad = 0.6;
              }
              intentar();
            }, 'image/jpeg', calidad);
          };
          intentar();
        };
        img.onerror = () => {
          URL.revokeObjectURL(urlTemp);
          reject(new Error('No se pudo leer la imagen.'));
        };
        img.src = urlTemp;
      });
    };

    // Da formato legible (KB o MB) a un tamaño en bytes -- se usa en el
    // panel de administrador para mostrar cuánto consume cada bodega en
    // fotos.
    const formatearBytes = (bytes) => {
      if (!bytes) return '0 KB';
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    // ID fijo usado únicamente por "Modo Demo Local" (no corresponde a ninguna
    // bodega real). Solo en ese caso se muestra el catálogo de ejemplo; una
    // bodega real sin productos debe ver un catálogo vacío de verdad.
    const BODEGA_DEMO_ID = 'a0000000-0000-0000-0000-000000000001';

    // Base de la vitrina pública de KaseritaDelivery (repo y deploy
    // separados de este). El link final de cada bodega es esta URL + su
    // slug, ej. KASERITA_DELIVERY_URL + '/san-luis'.
    const KASERITA_DELIVERY_URL = 'https://kaserita-delivery.vercel.app';

    // El login sigue pidiendo DNI + PIN como siempre, pero por debajo se usa
    // Supabase Auth real (necesario para que RLS pueda proteger los datos de
    // cada bodega). Se deriva un correo y contraseña sintéticos a partir del
    // DNI/PIN para no tener que pedirle un email al usuario.
    const emailAuthDesdeDni = (dni) => `bodega_${(dni || '').trim()}@kaserita.app`;
    const passwordAuthDesdePin = (pin) => `kst-${(pin || '').trim()}`;

    // El PIN puede llevar letras, números y símbolos. El tope de 32 deja
    // margen bajo el límite de 72 caracteres de la contraseña de Auth
    // ("kst-" + PIN); tiene que coincidir con establecer_pin_cajero en SQL.
    const PIN_MIN = 4;
    const PIN_MAX = 32;
    // La cuenta del dueño es la única que entra por Internet con este PIN
    // (los empleados no tienen login propio), así que exige más largo.
    const PIN_MIN_DUENO = 8;
    const pinValido = (pin) => {
      const p = (pin || '').trim();
      return p.length >= PIN_MIN && p.length <= PIN_MAX;
    };

    // Aviso sonoro cuando llega un pedido nuevo de KaseritaDelivery. Se crea
    // una sola vez (no un Audio nuevo por pedido) para no repetir la descarga
    // cada vez -- currentTime se resetea para que suene entero aunque llegue
    // otro pedido mientras el anterior todavía está sonando. Los navegadores
    // no dejan reproducir sonido antes de que haya habido algún clic/
    // interacción en la página; por eso puede no sonar el primer pedido si
    // se acaba de abrir la pestaña.
    const audioAvisoPedidoNuevo = new Audio('https://cdn.pixabay.com/audio/2025/01/11/audio_5e34842448.mp3');
    audioAvisoPedidoNuevo.preload = 'auto';
    const sonarAvisoPedidoNuevo = () => {
      try {
        audioAvisoPedidoNuevo.currentTime = 0;
        audioAvisoPedidoNuevo.play().catch((err) => console.warn('No se pudo reproducir el aviso sonoro:', err.message));
      } catch (err) {
        console.warn('No se pudo reproducir el aviso sonoro:', err.message);
      }
    };

    // Catálogo semilla del Modo Demo Local -- productos reales del catálogo
    // maestro (con foto de verdad, no genéricas) para que la demo se vea
    // como una bodega ya en marcha en vez de un inventario vacío.
    const PRODUCTOS_SEMILLA = [
      { cod_ean: '7750001000001', descripcion: 'Aceite Primor 1L', precio_costo: 9.20, precio_venta: 11.50, categoria: 'Abarrotes', unidad: 'UND', stock_actual: 24, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/99ab61f2-dcb3-4878-9a02-c3737d204d70.jpg' },
      { cod_ean: '7750001000002', descripcion: 'Arroz Costeño 5kg', precio_costo: 19.00, precio_venta: 23.50, categoria: 'Abarrotes', unidad: 'UND', stock_actual: 15, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/f80070c8-36d6-46da-b968-91d16bb784ed.jpg' },
      { cod_ean: '7750001000003', descripcion: 'Azúcar Rubia Casa Grande 1kg', precio_costo: 3.80, precio_venta: 4.80, categoria: 'Abarrotes', unidad: 'UND', stock_actual: 30, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/4011d569-f566-4331-bd79-c91c887e4d6e.jpg' },
      { cod_ean: '7750001000004', descripcion: 'Fideos Don Vittorio Spaghetti 500g', precio_costo: 3.20, precio_venta: 4.20, categoria: 'Abarrotes', unidad: 'UND', stock_actual: 40, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/7237ff57-0b6d-4ace-8d86-a75da41bbcfd.jpg' },
      { cod_ean: '7750001000005', descripcion: 'Leche Gloria Evaporada 400g', precio_costo: 3.30, precio_venta: 4.20, categoria: 'Lácteos', unidad: 'UND', stock_actual: 36, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/efca5f0a-cfd5-4c4d-8d77-a23462f28024.jpg' },
      { cod_ean: '7750001000006', descripcion: 'Queso Fresco Paria 500g', precio_costo: 9.50, precio_venta: 13.00, categoria: 'Lácteos', unidad: 'UND', stock_actual: 12, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/0b26ad18-29d2-459d-9bcd-0754cc382f3f.jpg' },
      { cod_ean: '7750001000007', descripcion: 'Yogurt Gloria Fresa 1L', precio_costo: 7.80, precio_venta: 10.50, categoria: 'Lácteos', unidad: 'UND', stock_actual: 18, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/bbf0f933-327e-4a71-a7da-cfa129ea9f0c.jpg' },
      { cod_ean: '7750001000008', descripcion: 'Coca Cola 500ml', precio_costo: 2.80, precio_venta: 3.50, categoria: 'Gaseosas', unidad: 'UND', stock_actual: 48, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/76ac2d57-7f90-43aa-83c5-1e314de6728b.jpg' },
      { cod_ean: '7750001000009', descripcion: 'Inca Kola 1.5L', precio_costo: 5.80, precio_venta: 7.50, categoria: 'Gaseosas', unidad: 'UND', stock_actual: 24, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/0a2d8a9c-033b-4e31-8456-918046b7c51f.jpg' },
      { cod_ean: '7750001000010', descripcion: 'Agua San Luis 625ml', precio_costo: 1.20, precio_venta: 2.00, categoria: 'Aguas', unidad: 'UND', stock_actual: 60, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/00132cc3-2a79-4c6f-9f53-a27fcf515a92.jpg' },
      { cod_ean: '7750001000011', descripcion: 'Agua Cristalina Sin Gas 500ml', precio_costo: 1.00, precio_venta: 1.50, categoria: 'Bebidas Y Snacks', unidad: 'UND', stock_actual: 60, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/15021016-537d-4cb3-bcb9-30d2bb8b02a0.jpg' },
      { cod_ean: '7750001000012', descripcion: 'Jugo Frugos Durazno 1L', precio_costo: 5.50, precio_venta: 7.00, categoria: 'Jugos y Néctares', unidad: 'UND', stock_actual: 20, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/64096189-19b6-4ac1-af2e-689af26bfae0.jpg' },
      { cod_ean: '7750001000013', descripcion: 'Galletas Casino Menta 6 pack', precio_costo: 6.50, precio_venta: 8.50, categoria: 'Golosinas y Snacks', unidad: 'UND', stock_actual: 22, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/fabd393f-1c90-45e4-93cf-408924072768.jpg' },
      { cod_ean: '7750001000014', descripcion: 'Detergente Ariel 850g', precio_costo: 12.00, precio_venta: 15.50, categoria: 'Limpieza del Hogar', unidad: 'UND', stock_actual: 14, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/494c3c7c-52e1-4f0d-938f-4ba4fbb0a78d.jpg' },
      { cod_ean: '7750001000015', descripcion: 'Huevos San Fernando x30', precio_costo: 15.50, precio_venta: 19.00, categoria: 'Huevos y Frescos', unidad: 'UND', stock_actual: 8, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/3c79f2a7-5c73-475e-a5d3-b9985e9e33b5.jpg' },
      { cod_ean: '7750001000016', descripcion: 'Pollo Entero (kg)', precio_costo: 8.50, precio_venta: 10.90, categoria: 'Carnes y Embutidos', unidad: 'KG', stock_actual: 10, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/c9722adb-16e3-4534-bfd8-a996c1303124.jpg' },
      { cod_ean: '7750001000017', descripcion: 'Jamón Otto Kunz 200g', precio_costo: 6.80, precio_venta: 9.00, categoria: 'Carnes y Embutidos', unidad: 'UND', stock_actual: 16, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/00b15e59-2165-4805-827f-48d4761da0c2.jpg' },
      { cod_ean: '7750001000018', descripcion: 'Palta Fuerte (kg)', precio_costo: 4.50, precio_venta: 6.50, categoria: 'Verduras y Frutas', unidad: 'KG', stock_actual: 15, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/f1a3ceb1-54bd-4035-97f7-bde1542fc858.jpg' },
      { cod_ean: '7750001000019', descripcion: 'Plátano de Seda (kg)', precio_costo: 2.00, precio_venta: 3.00, categoria: 'Verduras y Frutas', unidad: 'KG', stock_actual: 20, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/d931149b-2023-4c78-b867-3daff159fc05.jpg' },
      { cod_ean: '7750001000020', descripcion: 'Pan Francés (unidad)', precio_costo: 0.25, precio_venta: 0.40, categoria: 'Panadería', unidad: 'UND', stock_actual: 80, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/8667de0b-3082-40a9-98ac-8ba03a6a2b5a.jpg' },
      { cod_ean: '7750001000021', descripcion: 'Cerveza Pilsen Callao 620ml', precio_costo: 6.50, precio_venta: 8.50, categoria: 'Cervezas', unidad: 'UND', stock_actual: 24, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/c9c6d9c1-31a2-4ab0-92ef-ab07eba8066c.jpg' },
      { cod_ean: '7750001000022', descripcion: 'Cusqueña Dorada Lata 355ml', precio_costo: 4.20, precio_venta: 5.50, categoria: 'Cervezas', unidad: 'UND', stock_actual: 24, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/d0f4a6b7-90fc-4033-bfea-50e63ad77093.jpg' },
      { cod_ean: '7750001000023', descripcion: 'Corona Botella (330ml) Pack x6', precio_costo: 28.00, precio_venta: 35.00, categoria: 'Cervezas', unidad: 'UND', stock_actual: 10, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/35dc543d-0c00-4f49-a386-79e0523d5d2d.jpg' },
      { cod_ean: '7750001000024', descripcion: 'Pisco Finca Rotondo Quebranta 750ml', precio_costo: 32.00, precio_venta: 42.00, categoria: 'Licores Y Vinos', unidad: 'UND', stock_actual: 6, foto_url: 'https://hzmrsbeamtbloudmxjrp.supabase.co/storage/v1/object/public/Productos/maestro/dc7e0b2e-034b-4a1e-bc67-c773a23e4dc2.jpg' }
    ];

    // Teclado numérico en pantalla, reutilizable para efectivo y pagos mixtos.
    function NumericKeypad({ value, onChange }) {
      const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
      const presionar = (t) => {
        if (t === '⌫') { onChange(value.slice(0, -1)); return; }
        if (t === '.' && value.includes('.')) return;
        onChange(value + t);
      };
      return (
        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
          {teclas.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => presionar(t)}
              className="py-2 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg text-sm font-bold text-stone-800 active:scale-95 transition"
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange('')}
            className="col-span-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 rounded-lg text-xs font-bold text-rose-200"
          >
            Limpiar
          </button>
        </div>
      );
    }

    // Ticket con formato de impresora térmica (80mm): invisible en pantalla
    // (clase sr-only) pero se muestra en su lugar al imprimir gracias al CSS
    // @media print de la cabecera, que oculta todo lo demás.
    // Calculadora rápida: dado el costo, sugiere el precio de venta según un
    // % de margen (precio = costo × (1 + margen/100)).
    function CalculadoraMargen({ costo, onAplicar }) {
      const [margen, setMargen] = useState('30');
      const costoNum = Number(costo) || 0;
      const sugerido = +(costoNum * (1 + (Number(margen) || 0) / 100)).toFixed(2);
      return (
        <div className="flex items-end gap-1.5 bg-stone-50/60 border border-stone-200 rounded-lg p-1.5 mt-1">
          <div className="flex-1">
            <label className="text-xs text-stone-500 block">Margen %:</label>
            <input
              type="number"
              step="1"
              value={margen}
              onChange={(e) => setMargen(e.target.value)}
              className="w-full bg-stone-100 border border-stone-300 rounded px-2 py-1 text-xs text-stone-900"
            />
          </div>
          <span className="text-xs text-stone-500 pb-1.5">→ S/ {sugerido.toFixed(2)}</span>
          <button
            type="button"
            onClick={() => onAplicar(sugerido)}
            disabled={costoNum <= 0}
            className="px-2 py-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white text-xs font-bold rounded"
          >
            Usar
          </button>
        </div>
      );
    }

    function ReciboImprimible({ bodega, boleta, fecha, cliente, medioPago, items, total, anulada, subtotal, descuento }) {
      const lineaSolida = { borderTop: '2px solid #000', margin: '6px 0' };
      return (
        <div id="recibo-imprimible" className="sr-only" style={{ fontWeight: 700, textAlign: 'center' }}>
          <div style={{ border: '2px solid #000', borderRadius: 4, padding: '5px 8px', margin: '0 auto 6px', display: 'inline-block' }}>
            <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 0.3 }}>{bodega}</div>
          </div>
          <div style={{ fontSize: 12 }}>Boleta: {boleta}</div>
          <div style={{ fontSize: 12 }}>{fecha}</div>
          <div style={{ fontSize: 12 }}>Cliente: {cliente}</div>
          {anulada && <div style={{ fontWeight: 900, fontSize: 14, marginTop: 3 }}>*** ANULADA ***</div>}

          <div style={lineaSolida}></div>
          <div style={{ textAlign: 'left' }}>
            {items.map((it, i) => (
              <div key={i} style={{ marginBottom: 5 }}>
                <div style={{ fontSize: 13 }}>{it.descripcion}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{it.cantidad} {it.unidad || 'UND'} x S/ {Number(it.precioUnitario || 0).toFixed(2)}</span>
                  <span>S/ {Number(it.subtotal).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={lineaSolida}></div>
          {descuento > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>Subtotal:</span><span>S/ {Number(subtotal).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>Descuento:</span><span>- S/ {Number(descuento).toFixed(2)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span>Medio de pago:</span><span>{medioPago}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 900, marginTop: 4 }}>
            <span>TOTAL</span><span>S/ {Number(total).toFixed(2)}</span>
          </div>
          <div style={lineaSolida}></div>

          <div style={{ fontSize: 10, lineHeight: 1.3 }}>
            Documento sin valor tributario.
            <br />No válido como comprobante de pago ante SUNAT. Solo informativo.
          </div>
          <div style={{ fontSize: 13, fontWeight: 900, marginTop: 8 }}>¡Gracias por su compra!</div>
        </div>
      );
    }

    // Muestra el QR real de Yape/Plin de la bodega (imagen subida una sola vez y
    // guardada en este navegador). No se genera un QR "falso" porque Yape/Plin
    // usan un formato propietario del banco — aquí se reutiliza la imagen
    // física/oficial del negocio.
    function QRPagoModal({ bodegaId, medioPago, monto, onClose }) {
      const storageKey = `qr_pago_${medioPago}_${bodegaId}`;
      const [qrImg, setQrImg] = useState(() => localStorage.getItem(storageKey));
      const inputRef = useRef(null);

      const guardarQRDesdeArchivo = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          localStorage.setItem(storageKey, reader.result);
          setQrImg(reader.result);
        };
        reader.readAsDataURL(file);
      };

      const handleSubirQR = (e) => guardarQRDesdeArchivo(e.target.files?.[0]);

      // Muchos dueños ya tienen el QR como una captura de pantalla en el
      // portapapeles (de Yape/Plin) -- con Ctrl+V se pega directo, sin tener
      // que guardarla como archivo primero para recién subirla.
      useEffect(() => {
        const manejarPegado = (e) => {
          const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'));
          if (item) guardarQRDesdeArchivo(item.getAsFile());
        };
        window.addEventListener('paste', manejarPegado);
        return () => window.removeEventListener('paste', manejarPegado);
      }, [storageKey]);

      return (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-stone-100 border border-stone-200 rounded-2xl max-w-xs w-full p-5 shadow-2xl text-center space-y-3">
            <h3 className="text-base font-bold text-stone-900">Pago con {medioPago}</h3>
            <p className="text-sm text-stone-700">
              Monto: <span className="font-black text-orange-600 text-lg">S/ {Number(monto).toFixed(2)}</span>
            </p>
            {qrImg ? (
              <div className="bg-white p-3 rounded-xl inline-block">
                <img src={qrImg} alt={`QR ${medioPago}`} className="w-44 h-44 object-contain" />
              </div>
            ) : (
              <div className="bg-stone-50 border border-dashed border-stone-300 rounded-xl p-5 text-xs text-stone-600">
                Aún no has guardado el QR de {medioPago} de tu bodega.
              </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" onChange={handleSubirQR} className="hidden" />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full py-2 bg-stone-200 hover:bg-stone-300 text-stone-900 text-xs font-semibold rounded-lg"
            >
              {qrImg ? 'Cambiar imagen del QR' : `Subir QR de ${medioPago}`}
            </button>
            <p className="text-[10px] text-stone-400">o copia la imagen y pégala aquí con Ctrl+V</p>
            <button onClick={onClose} className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl">
              Cerrar
            </button>
          </div>
        </div>
      );
    }

    // Ícono de la barra lateral de navegación (desktop) / barra inferior (mobile).
    // Barra de "Desde / Hasta" + atajos rápidos (Hoy / Últimos N días / Este
    // mes), usada en Historial de Cierres y en el Dashboard de Ventas -- antes
    // este bloque estaba copiado en los dos lugares, con solo el nombre de los
    // setters y el número de días distinto.
    function FiltroFechasRapido({ desde, hasta, setDesde, setHasta, onRango, diasAtras, children }) {
      const irAHoy = () => {
        const hoy = fechaHoyISO();
        setDesde(hoy); setHasta(hoy); onRango(hoy, hoy);
      };
      const irAUltimosNDias = () => {
        const hoy = fechaHoyISO();
        const desdeDate = new Date();
        desdeDate.setDate(desdeDate.getDate() - (diasAtras - 1));
        const desdeStr = fechaISOLocal(desdeDate);
        setDesde(desdeStr); setHasta(hoy); onRango(desdeStr, hoy);
      };
      const irAEsteMes = () => {
        const hoy = fechaHoyISO();
        const inicioMes = hoy.slice(0, 8) + '01';
        setDesde(inicioMes); setHasta(hoy); onRango(inicioMes, hoy);
      };
      return (
        <div className="flex flex-wrap items-end gap-2 shrink-0">
          <div>
            <label className="text-xs text-stone-600 block mb-1">Desde:</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="bg-white border border-stone-200/70 shadow-sm rounded-full px-3 py-1.5 text-xs text-stone-900"
            />
          </div>
          <div>
            <label className="text-xs text-stone-600 block mb-1">Hasta:</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="bg-white border border-stone-200/70 shadow-sm rounded-full px-3 py-1.5 text-xs text-stone-900"
            />
          </div>
          <button
            onClick={() => onRango(desde, hasta)}
            className="px-4 py-1.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white text-xs font-semibold rounded-full shadow-sm"
          >
            Buscar
          </button>
          <div className="inline-flex items-center bg-white/70 shadow-sm rounded-full p-0.5">
            <button onClick={irAHoy} className="px-3 py-1 text-stone-600 hover:bg-[#ece0fd] hover:text-[#4d04b0] text-xs font-semibold rounded-full transition">
              Hoy
            </button>
            <button onClick={irAUltimosNDias} className="px-3 py-1 text-stone-600 hover:bg-[#ece0fd] hover:text-[#4d04b0] text-xs font-semibold rounded-full transition">
              Últimos {diasAtras} días
            </button>
            <button onClick={irAEsteMes} className="px-3 py-1 text-stone-600 hover:bg-[#ece0fd] hover:text-[#4d04b0] text-xs font-semibold rounded-full transition">
              Este mes
            </button>
          </div>
          {children}
        </div>
      );
    }

    // Informativo dentro del cierre de turno: cuánto se vendió en cada medio
    // que NO es efectivo, para que el cajero lo cruce contra su POS de
    // tarjeta / apps de Yape y Plin -- no participa en el cálculo de cuánto
    // debería haber en la caja física, que sigue siendo solo efectivo.
    function DesgloseMediosPago({ desglose }) {
      if (!desglose) return null;
      const filas = [
        { label: 'Yape', valor: desglose.YAPE },
        { label: 'Plin', valor: desglose.PLIN },
        { label: 'Tarjeta', valor: desglose.TARJETA },
        { label: 'Crédito', valor: desglose.CREDITO },
        { label: 'Tarjeta/Otro (de ventas Mixtas)', valor: desglose.MIXTO_OTRO }
      ].filter((f) => f.valor > 0);
      if (filas.length === 0) return null;
      return (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-left text-xs text-stone-600 space-y-1">
          <p className="font-semibold text-stone-500">Otros medios de pago (informativo, no es efectivo):</p>
          {filas.map((f) => (
            <div key={f.label} className="flex justify-between">
              <span>{f.label}:</span><span>S/ {f.valor.toFixed(2)}</span>
            </div>
          ))}
        </div>
      );
    }

    // Montos del Dashboard con separador de miles (1,752.90) y siempre 2 decimales.
    const formatoSoles = (n) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Cifras compactas para el calendario de "Ventas por día", que no se rompe
    // con montos grandes: entero hasta 9,999; luego 12.3k / 123k / 1.2M.
    const montoCorto = (n) => {
      if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
      if (n >= 1e5) return `${Math.round(n / 1e3)}k`;
      if (n >= 1e4) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
      return Math.round(n).toLocaleString('es-PE');
    };
    // Para las tarjetas de resumen y de semana: con céntimos hasta 9,999.99, sin
    // céntimos desde 10 mil y abreviado desde un millón.
    const montoResumen = (n) => {
      if (n >= 1e6) return `S/ ${(n / 1e6).toFixed(2)}M`;
      if (n >= 1e4) return `S/ ${Math.round(n).toLocaleString('es-PE')}`;
      return `S/ ${formatoSoles(n)}`;
    };

    // Variación porcentual del Dashboard: verde si sube, rojo si baja. Sin
    // porcentaje (null) no dibuja nada -- pasa cuando el período anterior no
    // tiene ventas y comparar contra cero no significa nada.
    function VariacionPct({ pct, corto }) {
      if (pct == null) return null;
      const sube = pct >= 0;
      return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${sube ? 'text-emerald-600' : 'text-rose-600'}`}>
          <i className={`fa-solid ${sube ? 'fa-arrow-up' : 'fa-arrow-down'} text-[10px]`}></i>
          {Math.abs(pct).toFixed(0)}%
          {!corto && <span className="font-normal text-stone-400">vs. período anterior</span>}
        </span>
      );
    }

    // Cada categoría tiene su ícono de línea y un color de acento propio, para que
    // el catálogo se lea de un vistazo sin depender de fotos de producto.
    const CATEGORIA_ESTILO = {
      'Abarrotes':                { icono: 'fa-wheat-awn',      color: 'text-amber-600',   fondo: 'from-amber-500/20 to-amber-500/5' },
      'Lácteos':                  { icono: 'fa-mug-hot',        color: 'text-sky-600',     fondo: 'from-sky-500/20 to-sky-500/5' },
      'Panadería':                { icono: 'fa-bread-slice',    color: 'text-yellow-700',  fondo: 'from-yellow-500/20 to-yellow-500/5' },
      'Carnes y Embutidos':       { icono: 'fa-drumstick-bite', color: 'text-rose-600',    fondo: 'from-rose-500/20 to-rose-500/5' },
      'Verduras y Frutas':        { icono: 'fa-carrot',         color: 'text-lime-600',    fondo: 'from-lime-500/20 to-lime-500/5' },
      'Huevos y Frescos':         { icono: 'fa-egg',            color: 'text-orange-600',  fondo: 'from-orange-400/20 to-orange-400/5' },
      'Gaseosas':                 { icono: 'fa-bottle-water',   color: 'text-cyan-600',    fondo: 'from-cyan-500/20 to-cyan-500/5' },
      'Jugos y Néctares':         { icono: 'fa-glass-water',    color: 'text-amber-500',   fondo: 'from-amber-400/20 to-amber-400/5' },
      'Aguas':                    { icono: 'fa-droplet',        color: 'text-blue-600',    fondo: 'from-blue-500/20 to-blue-500/5' },
      'Energizantes e Isotónicas':{ icono: 'fa-bolt',           color: 'text-emerald-600', fondo: 'from-emerald-500/20 to-emerald-500/5' },
      'Cervezas':                 { icono: 'fa-beer-mug-empty', color: 'text-yellow-600',  fondo: 'from-yellow-400/20 to-yellow-400/5' },
      'Licores':                  { icono: 'fa-wine-bottle',    color: 'text-fuchsia-600', fondo: 'from-fuchsia-500/20 to-fuchsia-500/5' },
      'Golosinas y Snacks':       { icono: 'fa-cookie-bite',    color: 'text-pink-600',    fondo: 'from-pink-500/20 to-pink-500/5' },
      'Limpieza del Hogar':       { icono: 'fa-pump-soap',      color: 'text-violet-600',  fondo: 'from-violet-500/20 to-violet-500/5' },
      'Cuidado Personal':         { icono: 'fa-pump-medical',   color: 'text-teal-600',    fondo: 'from-teal-500/20 to-teal-500/5' },
      'Mascotas':                 { icono: 'fa-paw',            color: 'text-indigo-600',  fondo: 'from-indigo-500/20 to-indigo-500/5' },
      'Otros':                    { icono: 'fa-box',            color: 'text-stone-600',   fondo: 'from-stone-400/20 to-stone-400/5' }
    };
    // Respaldo local por si la tabla "categorias" de Supabase aún no existe o
    // falla la consulta: la lista real y editable vive en Supabase, esto solo
    // evita que la app se quede sin categorías si algo sale mal.
    const CATEGORIAS_FALLBACK = Object.keys(CATEGORIA_ESTILO);

    const normalizarCategoria = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

    const CATEGORIA_ESTILO_POR_NOMBRE_NORMALIZADO = Object.keys(CATEGORIA_ESTILO).reduce((acc, clave) => {
      acc[normalizarCategoria(clave)] = clave;
      return acc;
    }, {});

    // Cada bodega puede escribir su propio nombre de categoría (ej. "Bebidas"
    // en vez de "Gaseosas", o sin tildes: "Lacteos"). Estos alias mapean las
    // formas cortas/comunes que un bodeguero realmente escribiría hacia la
    // categoría con ícono definido más cercana, para no mostrarle una caja
    // gris genérica solo porque el texto no calzó exacto.
    const CATEGORIA_ALIAS = {
      bebida: 'Gaseosas', bebidas: 'Gaseosas', gaseosa: 'Gaseosas',
      carne: 'Carnes y Embutidos', carnes: 'Carnes y Embutidos', embutido: 'Carnes y Embutidos', embutidos: 'Carnes y Embutidos',
      verdura: 'Verduras y Frutas', verduras: 'Verduras y Frutas', fruta: 'Verduras y Frutas', frutas: 'Verduras y Frutas',
      fresco: 'Huevos y Frescos', frescos: 'Huevos y Frescos', huevo: 'Huevos y Frescos', huevos: 'Huevos y Frescos',
      limpieza: 'Limpieza del Hogar',
      golosina: 'Golosinas y Snacks', golosinas: 'Golosinas y Snacks', snack: 'Golosinas y Snacks', snacks: 'Golosinas y Snacks',
      panaderia: 'Panadería', pan: 'Panadería',
      lacteo: 'Lácteos', lacteos: 'Lácteos',
      cuidado: 'Cuidado Personal',
      mascota: 'Mascotas', mascotas: 'Mascotas',
      jugo: 'Jugos y Néctares', jugos: 'Jugos y Néctares', nectar: 'Jugos y Néctares', nectares: 'Jugos y Néctares',
      agua: 'Aguas', aguas: 'Aguas',
      cerveza: 'Cervezas', cervezas: 'Cervezas',
      licor: 'Licores', licores: 'Licores', vino: 'Licores', vinos: 'Licores',
      energizante: 'Energizantes e Isotónicas', energizantes: 'Energizantes e Isotónicas', isotonica: 'Energizantes e Isotónicas', isotonicas: 'Energizantes e Isotónicas'
    };

    const estiloCategoria = (cat) => {
      const norm = normalizarCategoria(cat);
      const clave = CATEGORIA_ESTILO_POR_NOMBRE_NORMALIZADO[norm] || CATEGORIA_ALIAS[norm];
      return CATEGORIA_ESTILO[clave] || { icono: 'fa-box', color: 'text-stone-700', fondo: 'from-stone-400/20 to-stone-400/5' };
    };

    // Convierte el texto libre de categoría que viene de un Excel externo
    // (ej. "CERVEZAS", "Bebidas") a una de las categorías con ícono que
    // reconoce Kaserita. Si no matchea ninguna (el proveedor usa su propio
    // rubro, ej. "RTD" o "Licores y Vinos"), NO se descarta a "Otros" --
    // se conserva tal cual la trajo el archivo (solo se le da formato
    // Título) para no perder una categoría real que el dueño sí quiere
    // usar; "Otros" queda solo para cuando la celda vino vacía.
    const categoriaDesdeTexto = (texto) => {
      const norm = normalizarCategoria(texto);
      if (!norm) return 'Otros';
      const clave = CATEGORIA_ESTILO_POR_NOMBRE_NORMALIZADO[norm] || CATEGORIA_ALIAS[norm];
      if (clave) return clave;
      return texto.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
    };

    // Miniatura de producto reutilizada en la tarjeta del catálogo y en el
    // carrito: si el producto tiene una foto subida se muestra esa foto,
    // si no, cae de vuelta al ícono de categoría (nunca queda un hueco vacío).
    function FotoProducto({ fotoUrl, categoria, className, iconClassName }) {
      if (fotoUrl) {
        return <img src={fotoUrl} alt="" className={`object-cover ${className}`} />;
      }
      const est = estiloCategoria(categoria);
      return (
        <div className={`flex items-center justify-center bg-gradient-to-br ${est.fondo} ${className}`}>
          <i className={`fa-solid ${est.icono} ${est.color} ${iconClassName || 'text-2xl'}`}></i>
        </div>
      );
    }

    // Iconos vectoriales de trazo fino (los mismos de la ventana de venta exitosa).
    const ICONOS_TRAZO = {
      check: <path d="M20 6 9 17l-5-5" />,
      print: <><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
      chat: <><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /><path d="M9 10c.5 2 2.5 4 5 5l1.5-1.5-2-1-1 .8c-.8-.4-1.6-1.2-2-2l.8-1-1-2z" /></>,
      bluetooth: <path d="m7 7 10 10-5 5V2l5 5L7 17" />,
      till: <><rect x="3" y="12" width="18" height="9" rx="2" /><path d="M6 12V6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" /><path d="M9 8.5h6" /><path d="M8 16.5h.01M12 16.5h.01M16 16.5h.01" /></>,
      warn: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17.5h.01" /></>,
      plus: <path d="M12 5v14M5 12h14" />,
      minus: <path d="M5 12h14" />,
      bag: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
      x: <path d="M18 6 6 18M6 6l12 12" />,
      back: <path d="m15 18-6-6 6-6" />,
      pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 12v6" /><path d="m9 15 3 3 3-3" /></>,
      hand: <><path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16" /><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" /><path d="m2 16 6 6" /><circle cx="16" cy="9" r="2.9" /><circle cx="6" cy="5" r="3" /></>,
      cloud: <><path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 5 15.5" /><path d="M12 12v9" /><path d="m8.5 15.5 3.5-3.5 3.5 3.5" /></>,
    };
    function IconoTrazo({ nombre, className = 'w-4 h-4', grosor = 2 }) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          {ICONOS_TRAZO[nombre]}
        </svg>
      );
    }

    function Interruptor({ activo, onClick, etiqueta, icono, title }) {
      return (
        <button
          type="button"
          onClick={onClick}
          title={title}
          className="flex items-center gap-1.5 text-xs font-semibold text-stone-600"
        >
          {icono && <i className={`fa-solid ${icono} text-[10px] text-stone-400`}></i>}
          <span>{etiqueta}</span>
          <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${activo ? 'bg-violet-600' : 'bg-stone-300'}`}>
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${activo ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </span>
        </button>
      );
    }

    // Tarjeta de producto de la grilla principal, memoizada: como el catálogo
    // puede tener cientos de tarjetas, sin esto cualquier cambio de estado en
    // PosApp (escribir en el buscador, tocar el carrito, un aviso, etc.)
    // volvía a renderizar TODAS las tarjetas aunque no tuvieran nada que ver.
    // Con React.memo, una tarjeta solo se vuelve a renderizar si cambian sus
    // propias props (su producto, o si cambia esAdmin/onSelect/onEdit).
    const ProductoCard = React.memo(function ProductoCard({ prod, esAdmin, enCarrito = 0, onSelect, onEdit, tieneCombo = false, onVerCombo }) {
      const stock = prod.stock_actual;
      const hayStock = stock !== null && stock !== undefined;
      const sinStock = hayStock && Number(stock) <= 0;
      const stockBajo = hayStock && !sinStock && Number(stock) <= Number(prod.stock_min || 5);
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect(prod)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelect(prod); }}
          className={`relative text-left rounded-[28px] p-2.5 flex flex-col border border-white/80 transition-all duration-500 ease-out hover:scale-[1.025] active:scale-[0.975] group cursor-pointer ${
            enCarrito > 0
              ? 'bg-gradient-to-br from-[#d9f5e5] to-[#f6fffa]'
              : 'bg-gradient-to-br from-[#f1eafd] to-[#fbfaff]'
          }`}
        >
          {/* Marco fijo: todas las fotos entran en el mismo cuadro, sin
              recortarse, sea alta como una botella o cuadrada como una bolsa. */}
          <div className="relative w-full aspect-[4/3] rounded-[20px] overflow-hidden bg-white ring-1 ring-black/5">
            {prod.foto_url ? (
              <img
                src={prod.foto_url}
                alt=""
                loading="lazy"
                className={`w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105 ${sinStock ? 'opacity-40 grayscale' : ''}`}
              />
            ) : (
              <FotoProducto
                fotoUrl=""
                categoria={prod.categoria}
                className={`w-full h-full ${sinStock ? 'opacity-40 grayscale' : ''}`}
                iconClassName="text-4xl opacity-90"
              />
            )}
            {esAdmin && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(prod); }}
                className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center bg-white/80 hover:bg-white backdrop-blur text-stone-500 hover:text-[#6105dc] rounded-full shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 transition"
                title="Editar producto"
              >
                <i className="fa-solid fa-pen text-[10px]"></i>
              </button>
            )}
            {tieneCombo && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onVerCombo?.(prod); }}
                className="absolute top-2 left-2 w-7 h-7 flex items-center justify-center text-[11px] text-white bg-[#6105dc] hover:bg-[#4d04b0] rounded-full"
                title="Este producto es parte de un combo -- toca para verlo"
              >
                <i className="fa-solid fa-gift"></i>
              </button>
            )}
            {enCarrito > 0 && (
              <span className="absolute top-2 right-2 text-[11px] font-bold text-white bg-emerald-600 pl-2 pr-2.5 py-1 rounded-full flex items-center gap-1 tabular-nums">
                <i className="fa-solid fa-check text-[10px]"></i> {enCarrito}
              </span>
            )}
          </div>

          <div className="px-1 pt-2.5 flex flex-col gap-px min-w-0">
            <p className="text-[11px] font-semibold text-black/45 truncate">{prod.categoria || 'General'}</p>
            <h3 className="text-sm font-semibold text-stone-900 line-clamp-2 leading-snug break-words">
              {prod.descripcion}
            </h3>
          </div>

          <div className="mt-auto flex items-baseline justify-between gap-2 px-1 pt-2 pb-1.5">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-[22px] font-bold text-stone-900 tabular-nums tracking-tight whitespace-nowrap">
                <small className="text-[12px] font-semibold text-stone-500 mr-0.5">S/</small>{Number(prod.precio_venta).toFixed(2)}
              </span>
              {prod.es_destacado && (
                <span className="text-[9px] text-[#6105dc]" title="Destacado en Delivery"><i className="fa-solid fa-star"></i></span>
              )}
              {prod.unidad === 'KG' && (
                <span className="text-[10px] font-bold text-stone-600 bg-white/70 px-1.5 py-0.5 rounded-full">KG</span>
              )}
              {Number(prod.unidades_por_pack) > 1 && (
                <span className="text-[10px] font-bold text-stone-600 bg-white/70 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <i className="fa-solid fa-boxes-packing"></i> x{prod.unidades_por_pack}
                </span>
              )}
            </div>
            {hayStock && (
              <span className={`text-xs flex items-center gap-1.5 shrink-0 ${sinStock ? 'text-rose-600' : stockBajo ? 'text-amber-700' : 'text-stone-600'}`}>
                <i className={`w-1.5 h-1.5 rounded-full ${sinStock ? 'bg-rose-500' : stockBajo ? 'bg-amber-500' : 'bg-emerald-500'}`}></i>
                {sinStock ? 'Sin stock' : stockBajo ? `Quedan ${stock}` : `${stock} disp.`}
              </span>
            )}
          </div>
        </div>
      );
    });

    // Panel del super-administrador: crea bodegas (el único lugar donde se
    // puede crear una, ver panel_admin.sql) y controla su vigencia. No usa
    // "sesion" (esa es la de dueño/cajero de una bodega) -- entra con su
    // propia cuenta de correo+contraseña de Supabase Auth.
    function PanelAdmin({
      adminSesion, sbClient, bodegasAdmin, setBodegasAdmin, cargandoBodegasAdmin, setCargandoBodegasAdmin,
      formNuevaBodega, setFormNuevaBodega, guardandoNuevaBodega, setGuardandoNuevaBodega, notificar, toast, onCerrarSesion
    }) {
      const cargarBodegas = useCallback(async () => {
        setCargandoBodegasAdmin(true);
        try {
          const { data: bodegas, error } = await sbClient.from('bodegas').select('*').order('nombre');
          if (error) throw error;
          const { data: duenos } = await sbClient.from('usuarios').select('id, bodega_id, nombre, dni, auth_id, telefono').eq('rol', 'dueno');
          const duenoPorBodega = new Map((duenos || []).map((d) => [d.bodega_id, d]));
          setBodegasAdmin((bodegas || []).map((b) => ({ ...b, dueno: duenoPorBodega.get(b.id) || null })));
        } catch (err) {
          notificar(`No se pudo cargar la lista de bodegas: ${err.message}`, 'error');
        } finally {
          setCargandoBodegasAdmin(false);
        }
      }, [sbClient]);

      useEffect(() => { cargarBodegas(); }, [cargarBodegas]);

      const crearBodega = async (e) => {
        e.preventDefault();
        if (!pinValido(formNuevaBodega.pin) || formNuevaBodega.pin.trim().length < PIN_MIN_DUENO) {
          notificar(`El PIN del dueño debe tener entre ${PIN_MIN_DUENO} y ${PIN_MAX} caracteres.`, 'error');
          return;
        }
        setGuardandoNuevaBodega(true);
        try {
          // admin_crear_bodega crea la bodega y la fila del dueño (sin
          // auth_id -- recién queda vinculada a una cuenta real cuando ese
          // dueño inicia sesión por primera vez con su DNI+PIN, ver
          // reclamar_cuenta_bodega) en una sola transacción: si el DNI ya
          // existe en otra bodega, no queda ninguna bodega a medio crear.
          const { error } = await sbClient.rpc('admin_crear_bodega', {
            p_nombre_bodega: formNuevaBodega.nombreBodega.trim(),
            p_nombre_dueno: formNuevaBodega.nombreDueno.trim(),
            p_dni: formNuevaBodega.dni.trim(),
            p_pin: formNuevaBodega.pin.trim(),
            p_dias: Number(formNuevaBodega.dias) || 0,
            p_telefono: formNuevaBodega.telefono.trim() || null,
            p_mostrar_catalogo_maestro: formNuevaBodega.mostrarCatalogoMaestro,
            p_permitir_subir_fotos: formNuevaBodega.permitirSubirFotos
          });
          if (error) throw error;

          notificar('Bodega creada. El dueño ya puede iniciar sesión con su DNI y PIN.', 'success');
          setFormNuevaBodega({ nombreBodega: '', nombreDueno: '', dni: '', pin: '', dias: '30', telefono: '', mostrarCatalogoMaestro: true, permitirSubirFotos: true });
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo crear la bodega: ${err.message}`, 'error');
        } finally {
          setGuardandoNuevaBodega(false);
        }
      };

      // --- Consumo de almacenamiento en fotos, por bodega ---
      // Cada bodega guarda sus fotos en su propia carpeta dentro del bucket
      // "Productos" ("{bodega_id}/{producto_id}.jpg"), así que listar esa
      // carpeta y sumar el tamaño de cada archivo alcanza para saber cuánto
      // ocupa. Se calcula bajo demanda (botón) y no solo al cargar el panel
      // porque implica una llamada a Storage por cada bodega.
      const [consumoFotos, setConsumoFotos] = useState({});
      const [cargandoConsumoFotos, setCargandoConsumoFotos] = useState(false);
      const [busquedaBodegas, setBusquedaBodegas] = useState('');

      const cargarConsumoFotos = useCallback(async () => {
        setCargandoConsumoFotos(true);
        try {
          const resultados = await Promise.all(
            bodegasAdmin.map(async (b) => {
              const { data, error } = await sbClient.storage.from('Productos').list(b.id, { limit: 1000 });
              if (error || !data) return [b.id, { archivos: 0, bytes: 0 }];
              const bytes = data.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
              return [b.id, { archivos: data.length, bytes }];
            })
          );
          setConsumoFotos(Object.fromEntries(resultados));
        } catch (err) {
          notificar(`No se pudo calcular el consumo de fotos: ${err.message}`, 'error');
        } finally {
          setCargandoConsumoFotos(false);
        }
      }, [bodegasAdmin, sbClient, notificar]);

      const bodegasFiltradas = useMemo(() => {
        const termino = busquedaBodegas.trim().toLowerCase();
        if (!termino) return bodegasAdmin;
        return bodegasAdmin.filter((b) =>
          b.nombre.toLowerCase().includes(termino) ||
          b.dueno?.nombre?.toLowerCase().includes(termino) ||
          b.dueno?.dni?.includes(termino)
        );
      }, [bodegasAdmin, busquedaBodegas]);

      const alternarCatalogoMaestroBodega = async (bodega) => {
        try {
          const { error } = await sbClient.from('bodegas').update({ mostrar_catalogo_maestro: !bodega.mostrar_catalogo_maestro }).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      // Función paga aparte del plan base -- si se le quita el permiso a una
      // bodega, también se le apaga el catálogo público (no tiene sentido
      // dejarlo "prendido" sin el permiso que lo cubre).
      const alternarDeliveryPermitidoBodega = async (bodega) => {
        try {
          const nuevoPermitido = !bodega.delivery_permitido;
          const payload = { delivery_permitido: nuevoPermitido };
          if (!nuevoPermitido) payload.delivery_habilitado = false;
          const { error } = await sbClient.from('bodegas').update(payload).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      const alternarSubirFotosBodega = async (bodega) => {
        try {
          const { error } = await sbClient.from('bodegas').update({ permitir_subir_fotos: !bodega.permitir_subir_fotos }).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      const alternarActiva = async (bodega) => {
        try {
          const { error } = await sbClient.from('bodegas').update({ activa: !bodega.activa }).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      const extenderVigencia = async (bodega, dias) => {
        try {
          const base = bodega.activa_hasta && bodega.activa_hasta > fechaHoyISO() ? new Date(`${bodega.activa_hasta}T00:00:00`) : new Date();
          const nueva = fechaISOLocal(new Date(base.getTime() + dias * 86400000));
          const { error } = await sbClient.from('bodegas').update({ activa_hasta: nueva }).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      const quitarVencimiento = async (bodega) => {
        try {
          const { error } = await sbClient.from('bodegas').update({ activa_hasta: null }).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      // ==========================================
      // BACKUP y ELIMINACIÓN DE BODEGA -- "por las dudas" antes de dar de
      // baja definitivamente a un negocio (o limpiar una de prueba).
      // ==========================================
      const [generandoBackupId, setGenerandoBackupId] = useState(null);
      const [modalEliminarBodega, setModalEliminarBodega] = useState(null);
      const [textoConfirmarEliminar, setTextoConfirmarEliminar] = useState('');
      const [eliminandoBodega, setEliminandoBodega] = useState(false);

      // Tablas que se relacionan con una bodega por una columna bodega_id
      // simple (sin sub-detalle que valga la pena anidar en el JSON).
      const TABLAS_BACKUP_SIMPLES = ['clientes', 'turnos_caja', 'mermas', 'pagos_credito', 'cajeros', 'categorias', 'tomas_inventario'];

      const descargarBackupBodega = async (bodega) => {
        setGenerandoBackupId(bodega.id);
        try {
          const resultados = await Promise.all([
            // Todas las columnas menos pin_acceso -- si la bodega
            // todavía no fue reclamada, ahí vive su PIN en texto plano
            // (necesario hasta su primer login, ver reclamar_cuenta_bodega)
            // y no tiene por qué terminar en un archivo descargable.
            sbClient.from('usuarios').select('id, bodega_id, nombre, dni, telefono, rol, activo, auth_id').eq('bodega_id', bodega.id),
            sbClient.from('productos').select('*').eq('bodega_id', bodega.id),
            sbClient.from('compras').select('*, compras_detalle(*)').eq('bodega_id', bodega.id),
            sbClient.from('ventas').select('*, ventas_detalle(*)').eq('bodega_id', bodega.id),
            sbClient.from('proveedores').select('*, pagos_proveedor(*)').eq('bodega_id', bodega.id),
            ...TABLAS_BACKUP_SIMPLES.map((t) => sbClient.from(t).select('*').eq('bodega_id', bodega.id))
          ]);
          const conError = resultados.find((r) => r.error);
          if (conError) throw conError.error;

          const [usuarios, productos, compras, ventas, proveedores, ...simples] = resultados.map((r) => r.data || []);
          const backup = { generado_en: new Date().toISOString(), bodega, usuarios, productos, compras, ventas, proveedores };
          TABLAS_BACKUP_SIMPLES.forEach((t, i) => { backup[t] = simples[i]; });

          const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const nombreArchivo = `backup_${bodega.nombre.replace(/[^a-z0-9]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
          const a = document.createElement('a');
          a.href = url;
          a.download = nombreArchivo;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          notificar('Backup descargado.', 'success');
        } catch (err) {
          notificar(`No se pudo generar el backup: ${err.message}`, 'error');
        } finally {
          setGenerandoBackupId(null);
        }
      };

      const eliminarBodegaConfirmado = async () => {
        if (!modalEliminarBodega) return;
        setEliminandoBodega(true);
        try {
          // Las fotos que la bodega hubiera subido (antes de bloquear esa
          // función) se borran acá, con la API de Storage -- Supabase no
          // permite borrar directo por SQL en storage.objects ("Direct
          // deletion from storage tables is not allowed"), así que la
          // función del servidor ya no lo intenta.
          const { data: archivos } = await sbClient.storage.from('Productos').list(modalEliminarBodega.id);
          if (archivos && archivos.length > 0) {
            await sbClient.storage.from('Productos').remove(archivos.map((f) => `${modalEliminarBodega.id}/${f.name}`));
          }

          const { error } = await sbClient.rpc('admin_eliminar_bodega', { p_bodega_id: modalEliminarBodega.id });
          if (error) throw error;
          notificar('Bodega eliminada junto con todos sus datos.', 'success');
          setModalEliminarBodega(null);
          setTextoConfirmarEliminar('');
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo eliminar: ${err.message}`, 'error');
        } finally {
          setEliminandoBodega(false);
        }
      };

      // ==========================================
      // EDITAR TELÉFONO y RESETEAR PIN -- para cuando el dueño cambia de
      // número o se olvida su PIN. El teléfono se edita directo (no toca
      // autenticación); el PIN se resetea borrando la cuenta de Auth (si
      // existe) y guardando el PIN nuevo en texto plano en pin_acceso --
      // igual que al crear la bodega, el dueño vuelve a "reclamarla" en su
      // próximo login (ver reclamar_cuenta_bodega), sin necesitar el
      // service_role key para cambiar la contraseña directamente.
      // ==========================================
      const [modalEditarBodega, setModalEditarBodega] = useState(null);
      const [telefonoEditar, setTelefonoEditar] = useState('');
      const [guardandoEditarBodega, setGuardandoEditarBodega] = useState(false);
      const [modalResetearPin, setModalResetearPin] = useState(null);
      const [nuevoPinReset, setNuevoPinReset] = useState('');
      const [reseteandoPin, setReseteandoPin] = useState(false);

      const guardarTelefonoBodega = async (e) => {
        e.preventDefault();
        if (!modalEditarBodega || !modalEditarBodega.dueno) return;
        setGuardandoEditarBodega(true);
        try {
          const { error } = await sbClient.from('usuarios')
            .update({ telefono: telefonoEditar.trim() || null })
            .eq('id', modalEditarBodega.dueno.id);
          if (error) throw error;
          notificar('Teléfono actualizado.', 'success');
          setModalEditarBodega(null);
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        } finally {
          setGuardandoEditarBodega(false);
        }
      };

      const resetearPinConfirmado = async () => {
        if (!modalResetearPin) return;
        const pin = nuevoPinReset.trim();
        if (!pinValido(pin) || pin.length < PIN_MIN_DUENO) { notificar(`El PIN del dueño debe tener entre ${PIN_MIN_DUENO} y ${PIN_MAX} caracteres.`, 'error'); return; }
        setReseteandoPin(true);
        try {
          const { error } = await sbClient.rpc('admin_resetear_pin_bodega', { p_bodega_id: modalResetearPin.id, p_pin: pin });
          if (error) throw error;
          notificar('PIN reseteado. El dueño debe iniciar sesión con su DNI y el PIN nuevo para reclamar la cuenta de nuevo.', 'success');
          setModalResetearPin(null);
          setNuevoPinReset('');
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo resetear el PIN: ${err.message}`, 'error');
        } finally {
          setReseteandoPin(false);
        }
      };

      // ==========================================
      // CATÁLOGO MAESTRO -- banco de productos (descripción + categoría +
      // foto) que administra solo el super-admin. Cada bodega lo puede
      // leer para "importar" un producto al suyo (ver PosApp), pero solo
      // acá se crea, edita o borra.
      // ==========================================
      const [vistaAdmin, setVistaAdmin] = useState('bodegas');
      const [catalogoMaestro, setCatalogoMaestro] = useState([]);
      const [cargandoMaestro, setCargandoMaestro] = useState(false);
      const [busquedaMaestro, setBusquedaMaestro] = useState('');
      const [filtroFotoMaestro, setFiltroFotoMaestro] = useState('todos');
      const [formMaestro, setFormMaestro] = useState(null);
      const [guardandoMaestro, setGuardandoMaestro] = useState(false);
      const [subiendoFotoMaestro, setSubiendoFotoMaestro] = useState(false);
      const [previewImportMaestro, setPreviewImportMaestro] = useState(null);
      const [guardandoImportMaestro, setGuardandoImportMaestro] = useState(false);

      // --- Productos de Clientes: mercadería que una bodega agregó por su
      // cuenta y todavía no tiene ficha en el catálogo maestro -- se revisan
      // acá para, si conviene, sumarlas al maestro general (ver
      // guardarProductoMaestro, que detecta _origenProductoId). ---
      const [productosSinMaestro, setProductosSinMaestro] = useState([]);
      const [cargandoProductosSinMaestro, setCargandoProductosSinMaestro] = useState(false);
      const [busquedaProductosSinMaestro, setBusquedaProductosSinMaestro] = useState('');

      const cargarProductosSinMaestro = useCallback(async () => {
        setCargandoProductosSinMaestro(true);
        try {
          let { data, error } = await sbClient
            .from('productos')
            .select('id, descripcion, categoria, foto_url, cod_ean, bodega_id, bodegas(nombre)')
            .is('catalogo_maestro_id', null)
            .order('descripcion');
          if (error) {
            // El embed a "bodegas" puede fallar si PostgREST no reconoce esa
            // relación -- se reintenta sin el nombre de la bodega en vez de
            // dejar la sección entera rota.
            ({ data, error } = await sbClient
              .from('productos')
              .select('id, descripcion, categoria, foto_url, cod_ean, bodega_id')
              .is('catalogo_maestro_id', null)
              .order('descripcion'));
            if (error) throw error;
          }
          setProductosSinMaestro(data || []);
        } catch (err) {
          notificar(`No se pudo cargar la mercadería de clientes: ${err.message}`, 'error');
        } finally {
          setCargandoProductosSinMaestro(false);
        }
      }, [sbClient]);

      useEffect(() => {
        if (vistaAdmin === 'nuevos' && productosSinMaestro.length === 0) cargarProductosSinMaestro();
      }, [vistaAdmin, cargarProductosSinMaestro]);

      const productosSinMaestroFiltrado = productosSinMaestro.filter((p) =>
        !busquedaProductosSinMaestro.trim() || p.descripcion.toLowerCase().includes(busquedaProductosSinMaestro.trim().toLowerCase())
      );

      const abrirPromoverAMaestro = (p) => {
        setFormMaestro({
          id: crypto.randomUUID(),
          descripcion: p.descripcion,
          categoria: p.categoria || 'Abarrotes',
          sku: '',
          foto_url: p.foto_url || '',
          _origenProductoId: p.id
        });
        setVistaAdmin('maestro');
      };

      const cargarCatalogoMaestro = useCallback(async () => {
        setCargandoMaestro(true);
        try {
          const { data, error } = await sbClient.from('catalogo_maestro').select('*').order('descripcion');
          if (error) throw error;
          setCatalogoMaestro(data || []);
        } catch (err) {
          notificar(`No se pudo cargar el catálogo maestro: ${err.message}`, 'error');
        } finally {
          setCargandoMaestro(false);
        }
      }, [sbClient]);

      useEffect(() => {
        if (vistaAdmin === 'maestro' && catalogoMaestro.length === 0) cargarCatalogoMaestro();
      }, [vistaAdmin, cargarCatalogoMaestro]);

      const abrirNuevoProductoMaestro = () => {
        setFormMaestro({ id: crypto.randomUUID(), descripcion: '', categoria: 'Abarrotes', sku: '', foto_url: '' });
      };

      const subirFotoMaestro = async (file) => {
        setSubiendoFotoMaestro(true);
        try {
          const comprimida = await comprimirImagenJPEG(file, 20, 480);
          const ruta = `maestro/${formMaestro.id}.jpg`;
          const { error } = await sbClient.storage
            .from('Productos')
            .upload(ruta, comprimida, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
          if (error) throw error;
          const { data } = sbClient.storage.from('Productos').getPublicUrl(ruta);
          setFormMaestro((prev) => ({ ...prev, foto_url: `${data.publicUrl}?t=${Date.now()}` }));
        } catch (err) {
          notificar(`No se pudo subir la foto: ${err.message}`, 'error');
        } finally {
          setSubiendoFotoMaestro(false);
        }
      };

      // Con el formulario de un producto del catálogo maestro abierto, Ctrl+V
      // sube directo la imagen que se tenga copiada (ej. una foto del
      // producto bajada de internet) sin tener que guardarla como archivo
      // antes.
      useEffect(() => {
        if (!formMaestro) return;
        const manejarPegado = (e) => {
          const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'));
          if (item) subirFotoMaestro(item.getAsFile());
        };
        window.addEventListener('paste', manejarPegado);
        return () => window.removeEventListener('paste', manejarPegado);
      }, [formMaestro?.id]);

      const guardarProductoMaestro = async (e) => {
        e.preventDefault();
        setGuardandoMaestro(true);
        try {
          const payload = {
            id: formMaestro.id,
            descripcion: formMaestro.descripcion.trim(),
            categoria: formMaestro.categoria,
            // El SKU es un código interno de Kaserita, no un EAN real (ese
            // varía por proveedor/empaque) -- se genera solo, una sola vez.
            sku: (formMaestro.sku || '').trim() || generarSKU(formMaestro.categoria),
            foto_url: formMaestro.foto_url || null
          };
          const { error } = await sbClient.from('catalogo_maestro').upsert([payload]);
          if (error) throw error;

          // Si este formulario se abrió desde "Productos de Clientes" (un
          // producto que una bodega agregó por su cuenta, todavía sin ficha
          // en el maestro), se vincula ese producto a la ficha recién creada
          // -- así deja de aparecer en esa lista de pendientes y, de paso, si
          // más adelante se le mejora la foto en el maestro, esa bodega la ve
          // actualizada sola.
          if (formMaestro._origenProductoId) {
            const { error: errVincular } = await sbClient.rpc('admin_vincular_producto_maestro', {
              p_producto_id: formMaestro._origenProductoId,
              p_catalogo_maestro_id: payload.id
            });
            if (errVincular) throw errVincular;
            setProductosSinMaestro((prev) => prev.filter((p) => p.id !== formMaestro._origenProductoId));
            notificar('Producto agregado al catálogo maestro y vinculado a la bodega que lo creó.', 'success');
            setFormMaestro(null);
            setVistaAdmin('nuevos');
          } else {
            notificar('Producto guardado en el catálogo maestro.', 'success');
            setFormMaestro(null);
          }
          cargarCatalogoMaestro();
        } catch (err) {
          notificar(`No se pudo guardar: ${err.message}`, 'error');
        } finally {
          setGuardandoMaestro(false);
        }
      };

      const eliminarProductoMaestro = async (item) => {
        if (!window.confirm(`¿Borrar "${item.descripcion}" del catálogo maestro? Esto no afecta los productos que ya importó alguna bodega.`)) return;
        try {
          const { error } = await sbClient.from('catalogo_maestro').delete().eq('id', item.id);
          if (error) throw error;
          cargarCatalogoMaestro();
        } catch (err) {
          notificar(`No se pudo borrar: ${err.message}`, 'error');
        }
      };

      const catalogoMaestroConFoto = catalogoMaestro.filter((p) => !!p.foto_url).length;
      const catalogoMaestroSinFoto = catalogoMaestro.length - catalogoMaestroConFoto;

      const catalogoMaestroFiltrado = catalogoMaestro.filter((p) => {
        if (filtroFotoMaestro === 'con' && !p.foto_url) return false;
        if (filtroFotoMaestro === 'sin' && p.foto_url) return false;
        return !busquedaMaestro.trim() || p.descripcion.toLowerCase().includes(busquedaMaestro.trim().toLowerCase());
      });

      // Importación masiva desde un Excel/CSV de un proveedor (ej. la lista de
      // precios de un distribuidor con columnas de código, descripción,
      // marca y categoría) -- así no hay que tipear producto por producto en
      // el formulario de arriba. Los encabezados de columna pueden variar
      // según el proveedor, por eso se buscan por varios nombres posibles en
      // vez de exigir uno exacto.
      const procesarArchivoImportMaestro = (file) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            await asegurarXLSX();
            const libro = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            const hoja = libro.Sheets[libro.SheetNames[0]];
            const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });

            const buscarCampo = (fila, candidatos) => {
              const claves = Object.keys(fila);
              for (const candidato of candidatos) {
                const clave = claves.find((k) => normalizarCategoria(k) === candidato);
                if (clave && fila[clave] !== '') return fila[clave].toString().trim();
              }
              return '';
            };

            const existentesPorSku = new Map(
              catalogoMaestro.filter((p) => p.sku).map((p) => [p.sku.trim().toLowerCase(), p])
            );

            const items = filas.map((fila) => {
              const descripcion = buscarCampo(fila, ['descripcion', 'producto', 'nombre', 'detalle', 'item']);
              if (!descripcion) return null;
              const categoriaTexto = buscarCampo(fila, ['categoria', 'rubro', 'familia']);
              const codigo = buscarCampo(fila, ['lovis', 'sku', 'codigo', 'cod']);
              const categoria = categoriaDesdeTexto(categoriaTexto);
              // Solo marca "reconocida" si matcheó una de las categorías con
              // ícono propio de Kaserita -- si se conservó tal cual vino del
              // proveedor (rubro propio, ej. "RTD"), se avisa igual aunque sí
              // se haya guardado su texto real (no se perdió en "Otros").
              const normCategoria = normalizarCategoria(categoriaTexto);
              const categoriaConIcono = !!(CATEGORIA_ESTILO_POR_NOMBRE_NORMALIZADO[normCategoria] || CATEGORIA_ALIAS[normCategoria]);
              const existente = codigo ? existentesPorSku.get(codigo.toLowerCase()) : null;
              return {
                id: existente ? existente.id : crypto.randomUUID(),
                descripcion,
                categoria,
                sku: codigo || generarSKU(categoria),
                foto_url: existente ? (existente.foto_url || null) : null,
                _categoriaReconocida: !categoriaTexto || categoriaConIcono,
                _actualiza: !!existente
              };
            }).filter(Boolean);

            if (items.length === 0) {
              notificar('No se encontró ninguna fila con descripción en el archivo.', 'error');
              return;
            }
            setPreviewImportMaestro(items);
          } catch (err) {
            notificar(`No se pudo leer el archivo: ${err.message}`, 'error');
          }
        };
        reader.readAsArrayBuffer(file);
      };

      const confirmarImportMaestro = async () => {
        if (!previewImportMaestro || previewImportMaestro.length === 0) return;
        setGuardandoImportMaestro(true);
        try {
          const payload = previewImportMaestro.map(({ _categoriaReconocida, _actualiza, ...resto }) => resto);
          const TAMANO_LOTE = 300;
          for (let i = 0; i < payload.length; i += TAMANO_LOTE) {
            const { error } = await sbClient.from('catalogo_maestro').upsert(payload.slice(i, i + TAMANO_LOTE));
            if (error) throw error;
          }
          notificar(`Se importaron ${payload.length} productos al catálogo maestro.`, 'success');
          setPreviewImportMaestro(null);
          cargarCatalogoMaestro();
        } catch (err) {
          notificar(`No se pudo importar: ${err.message}`, 'error');
        } finally {
          setGuardandoImportMaestro(false);
        }
      };

      return (
        <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">
          {toast.visible && (
            <div className={`fixed top-6 inset-x-4 md:inset-x-auto md:right-6 md:max-w-xs z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border-l-4 bg-white text-xs font-semibold ${toast.tipo === 'error' ? 'border-rose-500 text-rose-700' : 'border-emerald-500 text-emerald-700'}`}>
              <i className={`fa-solid ${toast.tipo === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-sm shrink-0`}></i>
              {toast.texto}
            </div>
          )}

          <header className="shrink-0 bg-stone-900 text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 px-2.5 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center shrink-0">
                <img src="/logo-blanco-wordmark.png" alt="Kaserita" className="h-3.5 w-auto" />
              </div>
              <div>
                <h1 className="text-sm font-black leading-tight">Panel de Administrador</h1>
                <p className="text-[11px] text-stone-400">{adminSesion.nombre || 'Administrador'}</p>
              </div>
            </div>
            <button onClick={onCerrarSesion} className="text-xs font-semibold text-stone-300 hover:text-white flex items-center gap-1.5">
              <i className="fa-solid fa-right-from-bracket"></i> Salir
            </button>
          </header>

          <div className="shrink-0 bg-white border-b border-stone-200 px-4 md:px-6 flex gap-1 pt-2">
            <button
              onClick={() => setVistaAdmin('bodegas')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition ${vistaAdmin === 'bodegas' ? 'bg-stone-100 text-stone-900 border-t border-x border-stone-200' : 'text-stone-500 hover:text-stone-800'}`}
            >
              <i className="fa-solid fa-store mr-1.5"></i> Bodegas
            </button>
            <button
              onClick={() => setVistaAdmin('maestro')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition ${vistaAdmin === 'maestro' ? 'bg-stone-100 text-stone-900 border-t border-x border-stone-200' : 'text-stone-500 hover:text-stone-800'}`}
            >
              <i className="fa-solid fa-book mr-1.5"></i> Catálogo Maestro
            </button>
            <button
              onClick={() => setVistaAdmin('nuevos')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition ${vistaAdmin === 'nuevos' ? 'bg-stone-100 text-stone-900 border-t border-x border-stone-200' : 'text-stone-500 hover:text-stone-800'}`}
            >
              <i className="fa-solid fa-boxes-packing mr-1.5"></i> Productos de Clientes
              {productosSinMaestro.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px]">{productosSinMaestro.length}</span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-stone-100">
          {vistaAdmin === 'bodegas' && (
          <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
            <form onSubmit={crearBodega} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-store text-orange-600"></i> Nueva Bodega
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Nombre de la Bodega:</label>
                  <input
                    type="text" required placeholder="Ej: Bodega Don Pepe"
                    value={formNuevaBodega.nombreBodega}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, nombreBodega: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Nombre del Dueño:</label>
                  <input
                    type="text" required placeholder="Ej: Juan Pérez"
                    value={formNuevaBodega.nombreDueno}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, nombreDueno: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Celular del Dueño (WhatsApp, opcional):</label>
                  <input
                    type="text" placeholder="Ej: 987654321"
                    value={formNuevaBodega.telefono}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, telefono: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">DNI (usuario de acceso):</label>
                  <input
                    type="text" required maxLength={8} placeholder="8 dígitos"
                    value={formNuevaBodega.dni}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, dni: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">PIN inicial:</label>
                  <input
                    type="text" required minLength={PIN_MIN_DUENO} maxLength={PIN_MAX} placeholder="8 a 32 caracteres (letras y números)"
                    value={formNuevaBodega.pin}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, pin: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Días de vigencia (0 = sin vencimiento):</label>
                  <input
                    type="number" min="0" step="1"
                    value={formNuevaBodega.dias}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, dias: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formNuevaBodega.mostrarCatalogoMaestro}
                  onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, mostrarCatalogoMaestro: e.target.checked })}
                  className="rounded border-stone-300"
                />
                Mostrar el Catálogo Maestro en esta bodega (sugerencias e importar productos)
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formNuevaBodega.permitirSubirFotos}
                  onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, permitirSubirFotos: e.target.checked })}
                  className="rounded border-stone-300"
                />
                Permitir que esta bodega suba fotos de sus productos
              </label>
              <button
                type="submit"
                disabled={guardandoNuevaBodega}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow"
              >
                {guardandoNuevaBodega ? 'Creando...' : 'Crear Bodega'}
              </button>
            </form>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-list text-orange-600"></i> Bodegas ({bodegasAdmin.length})
                </h2>
                <button
                  onClick={cargarConsumoFotos}
                  disabled={cargandoConsumoFotos || bodegasAdmin.length === 0}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-60 flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-images text-[10px]"></i>
                  {cargandoConsumoFotos ? 'Calculando...' : 'Ver consumo de fotos'}
                </button>
              </div>
              {bodegasAdmin.length > 0 && (
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                  <input
                    type="text"
                    value={busquedaBodegas}
                    onChange={(e) => setBusquedaBodegas(e.target.value)}
                    placeholder="Buscar por nombre de bodega, dueño o DNI..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              )}
              {cargandoBodegasAdmin ? (
                <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
              ) : bodegasAdmin.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-6">Todavía no creaste ninguna bodega.</p>
              ) : bodegasFiltradas.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-6">Ninguna bodega coincide con "{busquedaBodegas}".</p>
              ) : (
                bodegasFiltradas.map((b) => {
                  const hoy = fechaHoyISO();
                  const vencida = b.activa === false || (b.activa_hasta && b.activa_hasta < hoy);
                  return (
                    <div key={b.id} className="bg-white border border-stone-200 rounded-xl p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-stone-900 truncate">{b.nombre}</p>
                          <p className="text-xs text-stone-500">
                            {b.dueno ? `${b.dueno.nombre} · DNI ${b.dueno.dni}${b.dueno.auth_id ? '' : ' · sin reclamar aún'}` : 'Sin dueño registrado'}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {b.dueno && b.dueno.telefono && (
                            <button
                              onClick={() => {
                                const soloNumeros = b.dueno.telefono.replace(/\D/g, '');
                                const telConCodigo = soloNumeros.length === 9 ? `51${soloNumeros}` : soloNumeros;
                                window.open(`https://wa.me/${telConCodigo}`, '_blank');
                              }}
                              title={`Escribir a ${b.dueno.nombre} por WhatsApp`}
                              className="w-6 h-6 flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-full"
                            >
                              <i className="fa-brands fa-whatsapp text-xs"></i>
                            </button>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${vencida ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {vencida ? 'VENCIDA' : 'ACTIVA'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-stone-600">
                        Vigencia: {b.activa_hasta ? new Date(`${b.activa_hasta}T00:00:00`).toLocaleDateString('es-PE') : 'Sin vencimiento'}
                        {consumoFotos[b.id] && (
                          <span className="ml-2 text-stone-400">
                            · <i className="fa-solid fa-images text-[10px]"></i> {consumoFotos[b.id].archivos} fotos ({formatearBytes(consumoFotos[b.id].bytes)})
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => alternarActiva(b)} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${b.activa ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                          {b.activa ? 'Desactivar ahora' : 'Activar'}
                        </button>
                        <button onClick={() => extenderVigencia(b, 7)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200">+7 días</button>
                        <button onClick={() => extenderVigencia(b, 30)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200">+30 días</button>
                        {b.activa_hasta && (
                          <button onClick={() => quitarVencimiento(b)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200">Quitar vencimiento</button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2.5 border-t border-stone-100">
                        <Interruptor
                          activo={b.mostrar_catalogo_maestro}
                          onClick={() => alternarCatalogoMaestroBodega(b)}
                          title="Mostrar/ocultar el Catálogo Maestro en esta bodega"
                          icono="fa-book"
                          etiqueta="Catálogo Maestro"
                        />
                        <Interruptor
                          activo={b.permitir_subir_fotos}
                          onClick={() => alternarSubirFotosBodega(b)}
                          title="Permitir/bloquear que esta bodega suba fotos de sus productos"
                          icono="fa-camera"
                          etiqueta="Subir fotos"
                        />
                        <Interruptor
                          activo={b.delivery_permitido}
                          onClick={() => alternarDeliveryPermitidoBodega(b)}
                          title="Habilitar/deshabilitar Pedidos por WhatsApp (KaseritaDelivery) para esta bodega -- función paga aparte del plan base"
                          icono="fa-share-nodes"
                          etiqueta="Pedidos WhatsApp"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-stone-100">
                        <button
                          onClick={() => descargarBackupBodega(b)}
                          disabled={generandoBackupId === b.id}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-60 flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-download text-[10px]"></i> {generandoBackupId === b.id ? 'Generando...' : 'Backup'}
                        </button>
                        {b.dueno && (
                          <button
                            onClick={() => { setModalEditarBodega(b); setTelefonoEditar(b.dueno.telefono || ''); }}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-pen text-[10px]"></i> Editar teléfono
                          </button>
                        )}
                        {b.dueno && (
                          <button
                            onClick={() => { setModalResetearPin(b); setNuevoPinReset(''); }}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-key text-[10px]"></i> Resetear PIN
                          </button>
                        )}
                        <button
                          onClick={() => { setModalEliminarBodega(b); setTextoConfirmarEliminar(''); }}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center gap-1.5 ml-auto"
                        >
                          <i className="fa-solid fa-trash text-[10px]"></i> Eliminar tienda
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          )}

          {vistaAdmin === 'maestro' && (
          <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {formMaestro ? (
              <form onSubmit={guardarProductoMaestro} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-book text-orange-600"></i> {formMaestro._origenProductoId ? 'Agregar al Catálogo Maestro' : catalogoMaestro.some((p) => p.id === formMaestro.id) ? 'Editar Producto' : 'Nuevo Producto del Catálogo Maestro'}
                </h2>
                {formMaestro._origenProductoId && (
                  <p className="text-xs text-stone-500 -mt-2">
                    Revisa/corrige la descripción, categoría y foto antes de sumarlo al catálogo general -- esto no modifica el producto tal cual quedó en la bodega que lo creó.
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <label className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 cursor-pointer group border border-stone-200">
                    <FotoProducto
                      fotoUrl={formMaestro.foto_url}
                      categoria={formMaestro.categoria}
                      className="w-16 h-16"
                      iconClassName="text-xl"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition">
                      {subiendoFotoMaestro ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <i className="fa-solid fa-camera text-white text-sm opacity-0 group-hover:opacity-100 transition"></i>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        e.target.value = '';
                        if (file) subirFotoMaestro(file);
                      }}
                    />
                  </label>
                  <p className="text-xs text-stone-500">
                    <span className="font-semibold text-stone-700 block">Foto del producto</span>
                    Toca el cuadro para {formMaestro.foto_url ? 'cambiarla' : 'subir una'}, o copia una imagen y pégala con Ctrl+V.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Descripción:</label>
                  <input
                    type="text" required placeholder="Ej: Coca Cola 500ml"
                    value={formMaestro.descripcion}
                    onChange={(e) => setFormMaestro({ ...formMaestro, descripcion: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Categoría:</label>
                  <select
                    value={formMaestro.categoria}
                    onChange={(e) => setFormMaestro({ ...formMaestro, categoria: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  >
                    {!CATEGORIAS_FALLBACK.includes(formMaestro.categoria) && formMaestro.categoria && (
                      <option value={formMaestro.categoria}>{formMaestro.categoria} (del proveedor)</option>
                    )}
                    {CATEGORIAS_FALLBACK.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {formMaestro.sku && (
                  <p className="text-xs text-stone-500">SKU: <span className="font-mono">{formMaestro.sku}</span></p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const veniaDeNuevos = !!formMaestro._origenProductoId;
                      setFormMaestro(null);
                      if (veniaDeNuevos) setVistaAdmin('nuevos');
                    }}
                    className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardandoMaestro} className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow">
                    {guardandoMaestro ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            ) : previewImportMaestro ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-file-import text-orange-600"></i> Revisar importación ({previewImportMaestro.length} productos)
                </h2>
                <p className="text-xs text-stone-500">
                  Se detectaron {previewImportMaestro.length} filas con descripción. Las categorías en <span className="font-semibold text-amber-700">amarillo</span> se guardan tal cual venían en el archivo porque no coinciden con las categorías con ícono de Kaserita (puedes editarlas después desde la lista); las que vinieron vacías quedan como "Otros".
                </p>
                <div className="max-h-80 overflow-y-auto border border-stone-100 rounded-xl divide-y divide-stone-100">
                  {previewImportMaestro.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <span className="flex-1 min-w-0 truncate font-semibold text-stone-800">{item.descripcion}</span>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full font-semibold ${item._categoriaReconocida ? 'bg-stone-100 text-stone-600' : 'bg-amber-50 text-amber-700'}`}>
                        {item.categoria}
                      </span>
                      <span className="shrink-0 font-mono text-stone-400">{item.sku}</span>
                      {item._actualiza && <span className="shrink-0 text-[10px] font-semibold text-sky-600">Actualiza</span>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setPreviewImportMaestro(null)} className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-xl">
                    Cancelar
                  </button>
                  <button type="button" onClick={confirmarImportMaestro} disabled={guardandoImportMaestro} className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow">
                    {guardandoImportMaestro ? 'Importando...' : `Importar ${previewImportMaestro.length} productos`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                  <input
                    type="text" placeholder="Buscar producto..."
                    value={busquedaMaestro}
                    onChange={(e) => setBusquedaMaestro(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-stone-900"
                  />
                </div>
                <label className="shrink-0 px-4 py-2.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-bold text-sm rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer">
                  <i className="fa-solid fa-file-excel text-emerald-600"></i> Importar Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0];
                      e.target.value = '';
                      if (file) procesarArchivoImportMaestro(file);
                    }}
                  />
                </label>
                <button onClick={abrirNuevoProductoMaestro} className="shrink-0 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-xl shadow flex items-center gap-1.5">
                  <i className="fa-solid fa-plus"></i> Nuevo
                </button>
              </div>
            )}

            {!formMaestro && !previewImportMaestro && (
              <div className="flex items-center gap-1.5">
                {[
                  { valor: 'todos', etiqueta: `Todos (${catalogoMaestro.length})` },
                  { valor: 'sin', etiqueta: `Sin foto (${catalogoMaestroSinFoto})` },
                  { valor: 'con', etiqueta: `Con foto (${catalogoMaestroConFoto})` }
                ].map((op) => (
                  <button
                    key={op.valor}
                    type="button"
                    onClick={() => setFiltroFotoMaestro(op.valor)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${filtroFotoMaestro === op.valor ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                  >
                    {op.etiqueta}
                  </button>
                ))}
              </div>
            )}

            {!formMaestro && !previewImportMaestro && (
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-list text-orange-600"></i> Catálogo Maestro ({catalogoMaestroFiltrado.length})
                </h2>
                {cargandoMaestro ? (
                  <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
                ) : catalogoMaestroFiltrado.length === 0 ? (
                  <p className="text-xs text-stone-500 text-center py-6">
                    {catalogoMaestro.length === 0 ? 'Todavía no agregaste ningún producto al catálogo maestro.' : 'No se encontraron productos con esa búsqueda.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {catalogoMaestroFiltrado.map((p) => (
                      <div key={p.id} className="bg-white border border-stone-200 rounded-xl p-3 flex items-center gap-3">
                        <FotoProducto fotoUrl={p.foto_url} categoria={p.categoria} className="w-12 h-12 rounded-lg shrink-0" iconClassName="text-lg" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-stone-900 truncate">{p.descripcion}</p>
                          <p className="text-[11px] text-stone-500">{p.categoria || 'Sin categoría'}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => setFormMaestro({ id: p.id, descripcion: p.descripcion, categoria: p.categoria || 'Abarrotes', sku: p.sku || '', foto_url: p.foto_url || '' })} className="w-7 h-7 flex items-center justify-center bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg">
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                          <button onClick={() => eliminarProductoMaestro(p)} className="w-7 h-7 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg">
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {vistaAdmin === 'nuevos' && (
          <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
            <p className="text-xs text-stone-500">
              Mercadería que alguna bodega agregó por su cuenta y todavía no tiene ficha en el catálogo maestro. Revisa la descripción/foto y, si conviene, súmala al catálogo general para que le sirva de sugerencia a todas las demás bodegas también.
            </p>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
              <input
                type="text" placeholder="Buscar producto..."
                value={busquedaProductosSinMaestro}
                onChange={(e) => setBusquedaProductosSinMaestro(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-stone-900"
              />
            </div>
            {cargandoProductosSinMaestro ? (
              <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
            ) : productosSinMaestroFiltrado.length === 0 ? (
              <p className="text-xs text-stone-500 text-center py-6">
                {productosSinMaestro.length === 0 ? 'No hay mercadería pendiente -- todo lo que agregaron las bodegas ya está en el catálogo maestro.' : 'No se encontraron productos con esa búsqueda.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {productosSinMaestroFiltrado.map((p) => (
                  <div key={p.id} className="bg-white border border-stone-200 rounded-xl p-3 flex items-center gap-3">
                    <FotoProducto fotoUrl={p.foto_url} categoria={p.categoria} className="w-12 h-12 rounded-lg shrink-0" iconClassName="text-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-stone-900 truncate">{p.descripcion}</p>
                      <p className="text-[11px] text-stone-500 truncate">{p.categoria || 'Sin categoría'}{p.bodegas?.nombre ? ` · ${p.bodegas.nombre}` : ''}</p>
                    </div>
                    <button
                      onClick={() => abrirPromoverAMaestro(p)}
                      title="Agregar al catálogo maestro"
                      className="shrink-0 w-7 h-7 flex items-center justify-center bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg"
                    >
                      <i className="fa-solid fa-arrow-up-from-bracket text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
          </div>

          {modalEditarBodega && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <form onSubmit={guardarTelefonoBodega} className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-4">
                <h3 className="text-sm font-bold text-stone-900">Editar teléfono -- {modalEditarBodega.nombre}</h3>
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">Teléfono de {modalEditarBodega.dueno?.nombre}</label>
                  <input
                    type="text"
                    autoFocus
                    value={telefonoEditar}
                    onChange={(e) => setTelefonoEditar(e.target.value)}
                    placeholder="999888777"
                    className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModalEditarBodega(null)} className="flex-1 py-2.5 bg-white/70 hover:bg-white/70 text-stone-600 font-bold text-sm rounded-full shadow-sm">
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardandoEditarBodega} className="flex-1 py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-sm rounded-full">
                    {guardandoEditarBodega ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {modalResetearPin && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-4">
                <div className="flex items-center gap-2 text-amber-600">
                  <i className="fa-solid fa-key text-lg"></i>
                  <h3 className="text-sm font-bold">Resetear PIN -- {modalResetearPin.nombre}</h3>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Se cerrará la sesión actual de {modalResetearPin.dueno?.nombre} y deberá volver a ingresar con su DNI y el PIN nuevo la próxima vez.
                </p>
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">PIN nuevo (8 a 32 caracteres)</label>
                  <input
                    type="text"
                    autoFocus
                    maxLength={PIN_MAX}
                    value={nuevoPinReset}
                    onChange={(e) => setNuevoPinReset(e.target.value)}
                    className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setModalResetearPin(null); setNuevoPinReset(''); }}
                    className="flex-1 py-2.5 bg-white/70 hover:bg-white/70 text-stone-600 font-bold text-sm rounded-full shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={resetearPinConfirmado}
                    disabled={reseteandoPin || !pinValido(nuevoPinReset) || nuevoPinReset.trim().length < PIN_MIN_DUENO}
                    className="flex-1 py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-full"
                  >
                    {reseteandoPin ? 'Reseteando...' : 'Resetear PIN'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {modalEliminarBodega && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-4">
                <div className="flex items-center gap-2 text-rose-600">
                  <i className="fa-solid fa-triangle-exclamation text-lg"></i>
                  <h3 className="text-sm font-bold">Eliminar "{modalEliminarBodega.nombre}"</h3>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Esto borra <strong>para siempre</strong> todas las ventas, compras, productos, clientes, turnos de caja y demás datos de esta bodega, junto con su cuenta de acceso. No se puede deshacer.
                </p>
                <button
                  onClick={() => descargarBackupBodega(modalEliminarBodega)}
                  disabled={generandoBackupId === modalEliminarBodega.id}
                  className="w-full py-2 bg-sky-50 hover:bg-sky-100 disabled:opacity-60 text-sky-700 font-bold text-xs rounded-full flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-download text-[10px]"></i> {generandoBackupId === modalEliminarBodega.id ? 'Generando...' : 'Descargar backup primero'}
                </button>
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">Escribe "{modalEliminarBodega.nombre}" para confirmar</label>
                  <input
                    type="text"
                    autoFocus
                    value={textoConfirmarEliminar}
                    onChange={(e) => setTextoConfirmarEliminar(e.target.value)}
                    className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setModalEliminarBodega(null); setTextoConfirmarEliminar(''); }}
                    className="flex-1 py-2.5 bg-white/70 hover:bg-white/70 text-stone-600 font-bold text-sm rounded-full shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={eliminarBodegaConfirmado}
                    disabled={eliminandoBodega || textoConfirmarEliminar.trim() !== modalEliminarBodega.nombre}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-full"
                  >
                    {eliminandoBodega ? 'Eliminando...' : 'Eliminar definitivamente'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    function PosApp() {
      // --- Supabase Config ---
      const [supabaseUrl, setSupabaseUrl] = useState(
        localStorage.getItem('pos_sb_url') || import.meta.env.VITE_SUPABASE_URL || 'https://hzmrsbeamtbloudmxjrp.supabase.co'
      );
      const [supabaseKey, setSupabaseKey] = useState(
        localStorage.getItem('pos_sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RHAkd7pZIadDnSQClFdjMQ_lrG3p-gw'
      );

      // Reemplazo de prompt()/confirm() nativos: en muchos navegadores
      // móviles (sobre todo con la app instalada como PWA) esos diálogos
      // quedan bloqueados en silencio, sin mostrar nada. Estos dos modales
      // propios funcionan siempre.
      // modalPrompt: { titulo, mensaje, placeholder, valorInicial, textoBoton, onConfirmar }
      const [modalPrompt, setModalPrompt] = useState(null);
      const [modalPromptValor, setModalPromptValor] = useState('');
      // modalConfirmar: { titulo, mensaje, textoBoton, peligroso, onConfirmar }
      const [modalConfirmar, setModalConfirmar] = useState(null);

      // Cliente Supabase. Declarado temprano (y no junto al resto del
      // "Lector de Código de Barras" más abajo, de donde viene su comentario
      // original) porque varios hooks anteriores en este componente ya lo
      // necesitan en su dependency array.
      const sbClient = useMemo(() => {
        if (supabaseUrl && supabaseKey) {
          try {
            return createClient(supabaseUrl.trim(), supabaseKey.trim());
          } catch (e) {
            console.error('Error Supabase client:', e);
            return null;
          }
        }
        return null;
      }, [supabaseUrl, supabaseKey]);

      const pedirTexto = ({ titulo, mensaje, placeholder = '', valorInicial = '', textoBoton = 'Confirmar' }) => {
        return new Promise((resolve) => {
          setModalPromptValor(valorInicial);
          setModalPrompt({
            titulo, mensaje, placeholder, textoBoton,
            onConfirmar: (valor) => resolve(valor),
            onCancelar: () => resolve(null)
          });
        });
      };

      const pedirConfirmacion = ({ titulo, mensaje, textoBoton = 'Confirmar', peligroso = false }) => {
        return new Promise((resolve) => {
          setModalConfirmar({
            titulo, mensaje, textoBoton, peligroso,
            onConfirmar: () => resolve(true),
            onCancelar: () => resolve(false)
          });
        });
      };

      // --- Sesión (Tabla `usuarios`, respaldada por Supabase Auth) ---
      const [sesion, setSesion] = useState(null);
      const [verificandoSesion, setVerificandoSesion] = useState(true);
      const splashRafRef = useRef(null);
      // El formulario del login arranca "corrido" hacia la derecha y
      // transparente; recién se desliza a su lugar cuando el splash empieza
      // a encogerse (ver useEffect de abajo) -- si apareciera solo ya
      // asentado, el usuario nunca vería el gesto de "entra deslizando".
      const [revelarLogin, setRevelarLogin] = useState(false);
      // Desfasa el arranque de la animación de las manchas de fondo del
      // panel de marca para que queden en fase con las del splash (que
      // vienen corriendo desde antes) -- sin esto, al desaparecer el splash
      // se nota un salto en la posición de las manchas. Se calcula una sola
      // vez, al montar.
      const kgSyncDelayRef = useRef(null);
      if (kgSyncDelayRef.current === null) {
        kgSyncDelayRef.current = typeof window.__kgSplashT0 === 'number'
          ? -((performance.now() - window.__kgSplashT0) / 1000)
          : 0;
      }

      // Oculta el splash screen estático (definido en el <body>, visible desde
      // antes de que React/Babel terminen de cargar) recién cuando ya sabemos
      // qué pantalla mostrar -- así no hay parpadeo entre el splash y un
      // segundo spinner de React.
      //
      // El doble requestAnimationFrame es a propósito: React ya montó el
      // login/la app en este punto, pero Tailwind (que genera las clases
      // como CSS recién al detectar el DOM nuevo, no antes) todavía puede
      // no haber terminado -- sacar el splash un instante antes de que
      // Tailwind aplique sus estilos dejaba ver, una fracción de segundo,
      // la pantalla de login sin flexbox ni fondos (como partida a la
      // mitad). Esperar dos frames alcanza para que el navegador ya haya
      // pintado con los estilos puestos antes de retirar el splash.
      useEffect(() => {
        if (verificandoSesion || typeof window.ocultarSplashKaserita !== 'function') return;
        const id1 = requestAnimationFrame(() => {
          const id2 = requestAnimationFrame(() => {
            window.ocultarSplashKaserita();
            setRevelarLogin(true);
          });
          splashRafRef.current = id2;
        });
        splashRafRef.current = id1;
        return () => cancelAnimationFrame(splashRafRef.current);
      }, [verificandoSesion]);

      // --- Auth Form ---
      const [authTab, setAuthTab] = useState('login');
      // El ingreso con DNI + PIN solo existe para las cuentas de demostración:
      // se muestra únicamente con ?demo en la dirección (/pos?demo). Los
      // dueños entran con Google.
      const mostrarAccesoPin = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
      const [formLogin, setFormLogin] = useState({ dni: '', pin: '' });
      const [cargandoAuth, setCargandoAuth] = useState(false);
      const [mostrarPin, setMostrarPin] = useState(false);

      // --- Panel de Administrador (super-admin, separado de las bodegas) ---
      const [adminSesion, setAdminSesion] = useState(null);
      const [formAdminLogin, setFormAdminLogin] = useState({ email: '', password: '' });
      const [cargandoAdminLogin, setCargandoAdminLogin] = useState(false);
      const [bodegasAdmin, setBodegasAdmin] = useState([]);
      const [cargandoBodegasAdmin, setCargandoBodegasAdmin] = useState(false);
      const [formNuevaBodega, setFormNuevaBodega] = useState({ nombreBodega: '', nombreDueno: '', dni: '', pin: '', dias: '30', telefono: '', mostrarCatalogoMaestro: true, permitirSubirFotos: true });
      const [guardandoNuevaBodega, setGuardandoNuevaBodega] = useState(false);

      // --- Bodega & Cajeros ---
      const bodegaId = sesion?.bodega?.id || sesion?.usuario?.bodega_id;
      // "Modo Demo Local": no usa Auth real ni una bodega real en Supabase, así
      // que ningún guardado (venta, producto, turno, etc.) debe intentar
      // escribir en el servidor -- todo se simula solo en el estado local.
      const esModoDemo = bodegaId === BODEGA_DEMO_ID;
      const bodegaNombre = sesion?.bodega?.nombre || 'Mi Bodega';
      const usuarioActivo = sesion?.usuario || null;
      // Una bodega vencida (o desactivada a mano) sigue existiendo, pero
      // mi_bodega_id() en el servidor ya no la reconoce -- acá solo se usa
      // para mostrar la pantalla de aviso en vez de un catálogo vacío sin
      // explicación.
      const cuentaVencida = !esModoDemo && !!sesion?.bodega && (
        sesion.bodega.activa === false ||
        (sesion.bodega.activa_hasta && sesion.bodega.activa_hasta < fechaHoyISO())
      );
      const [listaCajeros, setListaCajeros] = useState([]);
      const [cajeroSeleccionado, setCajeroSeleccionado] = useState(null);
      // El "rol activo" es el de quien está atendiendo la caja en este momento
      // (el cajero elegido al abrir turno), no necesariamente el de quien inició
      // sesión en el dispositivo -- para dar permisos según quién opera la caja.
      const rolActivo = (cajeroSeleccionado?.rol || usuarioActivo?.rol || 'cajero').toLowerCase();
      const esAdmin = rolActivo === 'dueno' || rolActivo === 'administrador';

      // --- Productos & Búsqueda ---
      const [productos, setProductos] = useState([]);
      const [categoriaFiltro, setCategoriaFiltro] = useState('TODOS');
      // Con muchas categorías, mostrarlas todas como píldoras saturaba la
      // fila -- ahora "Todos" es un único botón que abre un desplegable con
      // la lista completa; "Combos" queda como pestaña aparte, sin tocar.
      const [menuCategoriasAbierto, setMenuCategoriasAbierto] = useState(false);
      const [busquedaCategoria, setBusquedaCategoria] = useState('');

      // --- Combos: paquetes de varios productos existentes a un precio
      // especial -- ver migration_25_combos.sql en el repo de Delivery. No
      // llevan stock propio: al venderse, descuentan el stock real de cada
      // producto que los compone (ver expandirLineaCarrito).
      const [combos, setCombos] = useState([]);
      const [cargandoCombos, setCargandoCombos] = useState(false);
      const [modalCombos, setModalCombos] = useState(false);
      const [comboEditando, setComboEditando] = useState(null);
      // precioTocado: false mientras el precio todavía sigue a la suma de
      // productos en automático (ver agregarProductoAFormCombo /
      // actualizarCantidadItemCombo / quitarItemCombo) -- se pone en true en
      // cuanto el usuario toca el campo de precio a mano o usa un botón de
      // descuento rápido, para dejar de pisarle lo que eligió.
      const comboVacio = () => ({ id: null, nombre: '', descripcion: '', precio_venta: '', activo: true, items: [], precioTocado: false });
      const [formCombo, setFormCombo] = useState(null);
      const [guardandoCombo, setGuardandoCombo] = useState(false);
      const [busquedaProductoCombo, setBusquedaProductoCombo] = useState('');

      // --- Categorías (vienen de Supabase: globales para todas las bodegas +
      // las propias que cada bodega haya agregado, visibles solo para ella) ---
      const [categoriasDB, setCategoriasDB] = useState(CATEGORIAS_FALLBACK);
      const [busqueda, setBusqueda] = useState('');
      const [cargandoProductos, setCargandoProductos] = useState(false);

      // --- Modo Offline: si se corta el internet a media venta, no se
      // pierde -- se guarda en una cola local y se sincroniza sola cuando
      // vuelve la conexión. ---
      const [enLinea, setEnLinea] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
      const [ventasPendientesSync, setVentasPendientesSync] = useState(() => {
        try {
          const p = localStorage.getItem('pos_ventas_pendientes_sync');
          return p ? JSON.parse(p) : [];
        } catch {
          return [];
        }
      });
      const [sincronizandoVentas, setSincronizandoVentas] = useState(false);
      // Cliente "Desconocido" real, cacheado la última vez que hubo
      // conexión -- se reutiliza para ventas offline (ver obtenerOCrearCliente).
      const desconocidoCacheRef = useRef(null);

      // Catálogo del Modo Demo Local: se genera una sola vez a partir de
      // PRODUCTOS_SEMILLA y desde ahí vive solo en memoria -- cualquier
      // cambio hecho durante la demo (venta, entrada de mercadería, conteo,
      // merma, producto nuevo) se aplica aquí para que no se pierda cada vez
      // que algo vuelve a pedir el catálogo.
      const catalogoDemoRef = useRef(null);
      // IDs como texto (no número): los <select> del formulario siempre
      // entregan el valor elegido como string, y comparaciones como
      // `productos.find(p => p.id === valor)` son con === estricto -- si
      // p.id fuera number, nunca calzaría con el string del <select>.
      const catalogoDemoInicial = () => PRODUCTOS_SEMILLA.map((p, i) => ({
        id: String(i + 1),
        bodega_id: BODEGA_DEMO_ID,
        stock_actual: 50,
        unidades_por_pack: 1,
        cod_ean_pack: '',
        sku: `DEMO-${i + 1}`,
        activo: true,
        ...p
      }));
      // Ventas hechas durante el Modo Demo Local (nunca se insertan en
      // Supabase): se guardan acá para que el arqueo de "Cerrar Caja" pueda
      // calcular el efectivo/desglose del turno igual que con datos reales.
      const ventasDemoRef = useRef([]);

      // --- Turno de Caja ---
      const [turnoActivo, setTurnoActivo] = useState(null);
      const [modalTurno, setModalTurno] = useState(false);
      // Lista de cajas ya abiertas por OTROS cajeros (este dispositivo no
      // tiene la suya propia) -- cada cajero puede tener su propia caja
      // abierta a la vez, así que hace falta dejar elegir: unirse a una de
      // esas, o abrir una caja nueva y separada. Se muestra una vez por
      // combinación exacta de cajas abiertas (ver claveAviso en
      // verificarTurno), no en cada recarga de la página.
      const [cajasAbiertasAviso, setCajasAbiertasAviso] = useState(null);
      const [montoApertura, setMontoApertura] = useState('100.00');
      const [modalGestionCajeros, setModalGestionCajeros] = useState(false);
      const [cajerosGestion, setCajerosGestion] = useState([]);
      const [cargandoCajerosGestion, setCargandoCajerosGestion] = useState(false);
      const [mostrarFormNuevoCajero, setMostrarFormNuevoCajero] = useState(false);
      const [formNuevoCajero, setFormNuevoCajero] = useState({ nombre: '', dni: '', rol: 'cajero', pin: '' });
      const [guardandoNuevoCajero, setGuardandoNuevoCajero] = useState(false);
      // Cambiar el PIN de un Administrador ya existente (el dueño lo hace
      // desde acá cuando ese empleado lo olvida, o al ascender a alguien).
      const [modalPinCajero, setModalPinCajero] = useState(null);
      const [nuevoPinCajero, setNuevoPinCajero] = useState('');
      const [guardandoPinCajero, setGuardandoPinCajero] = useState(false);
      // Al elegir en "Abrir Turno" a un Administrador que no es quien inició
      // sesión, se le pide su PIN antes de aplicar el cambio -- si no, ese
      // selector le daría acceso completo a cualquiera con solo tocarlo.
      const [cajeroPendientePin, setCajeroPendientePin] = useState(null);
      const [pinConfirmarCajero, setPinConfirmarCajero] = useState('');
      const [verificandoPinCajero, setVerificandoPinCajero] = useState(false);

      // --- Link de Pedidos (KaseritaDelivery) ---
      const [modalDelivery, setModalDelivery] = useState(false);
      const [slugDelivery, setSlugDelivery] = useState('');
      const [deliveryHabilitado, setDeliveryHabilitado] = useState(false);
      const [logoUrlDelivery, setLogoUrlDelivery] = useState('');
      const [subiendoLogoDelivery, setSubiendoLogoDelivery] = useState(false);
      const [telefonoDeliveryEditar, setTelefonoDeliveryEditar] = useState('');
      const [direccionDelivery, setDireccionDelivery] = useState('');
      const [mostrarQRDelivery, setMostrarQRDelivery] = useState(false);
      // Horario de atención para "Abierto ahora" / "Cerrado" en la vitrina
      // -- un objeto por día de la semana (0=domingo...6=sábado, igual que
      // Date.getDay() del lado de KaseritaDelivery). Arranca todo cerrado
      // hasta que el dueño lo configure.
      const [horarioDelivery, setHorarioDelivery] = useState(() => ({ 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }));
      const [guardandoDelivery, setGuardandoDelivery] = useState(false);

      // --- Pedidos por retirar (clientes con cuenta en KaseritaDelivery) ---
      const [modalPedidosRetirar, setModalPedidosRetirar] = useState(false);
      const [pedidosRetirar, setPedidosRetirar] = useState([]);
      const [cargandoPedidosRetirar, setCargandoPedidosRetirar] = useState(false);
      const [tabPedidosRetirar, setTabPedidosRetirar] = useState('pendiente'); // 'pendiente' | 'listo' | 'historial'
      const [filtroFechaHistorial, setFiltroFechaHistorial] = useState('todos'); // 'hoy' | '7dias' | '30dias' | 'todos'
      const [marcandoListoId, setMarcandoListoId] = useState(null);
      const [procesandoPedidoRetirarId, setProcesandoPedidoRetirarId] = useState(null);
      // Pedidos de "Pedidos por retirar" cuyos items ya están en el carrito
      // actual pero todavía no se cobraron -- se cierran de verdad (borrado
      // de pedidos_delivery + marcar_pedido_retirado) recién cuando la venta
      // se cobra con éxito (ver handleCobrar), no al tocar "Al carrito". Si
      // se vacía o se aparca el carrito sin cobrar, se desvinculan para que
      // el pedido siga disponible en su cola.
      const [pedidosCargadosAlCarrito, setPedidosCargadosAlCarrito] = useState([]);

      // --- Arqueo y Cierre de Caja ---
      const [modalCierreCaja, setModalCierreCaja] = useState(false);
      const [montoConteoEfectivo, setMontoConteoEfectivo] = useState('');
      const [resumenCierre, setResumenCierre] = useState(null);
      // Detalle de cuánto debería haber en caja, calculado al abrir el
      // modal de cierre (antes de que el cajero cuente e ingrese el monto).
      const [arqueoEsperado, setArqueoEsperado] = useState(null);
      const [modalHistorialCierres, setModalHistorialCierres] = useState(false);
      const [cierresCaja, setCierresCaja] = useState([]);
      const [cargandoCierres, setCargandoCierres] = useState(false);
      const [fechaInicioCierres, setFechaInicioCierres] = useState('');
      const [fechaFinCierres, setFechaFinCierres] = useState('');

      // --- Carrito & Ventas en Espera (Park Sales) ---
      // El carrito se guarda en localStorage en cada cambio y se recupera al
      // cargar la página -- así un refresh accidental (F5, se cae el wifi,
      // se cierra el navegador) no borra una venta que ya se estaba armando.
      const [carrito, setCarrito] = useState(() => {
        try {
          const p = localStorage.getItem('pos_carrito_actual');
          return p ? JSON.parse(p) : [];
        } catch {
          return [];
        }
      });
      const [ventasEnEspera, setVentasEnEspera] = useState(() => {
        const p = localStorage.getItem('pos_ventas_espera');
        return p ? JSON.parse(p) : [];
      });
      const [modalVentasEspera, setModalVentasEspera] = useState(false);

      // --- Modal de Cantidad / Balanza (Gramos / Unidades) ---
      const [modalCantidad, setModalCantidad] = useState(false);
      const [productoSeleccionadoCantidad, setProductoSeleccionadoCantidad] = useState(null);
      const [inputCantidad, setInputCantidad] = useState('1');
      // 'UNIDAD' o 'PACK' -- solo aplica cuando el producto tiene unidades_por_pack > 1.
      const [tipoVentaSeleccionado, setTipoVentaSeleccionado] = useState('UNIDAD');

      // --- Cliente & Créditos ---
      const [dniCliente, setDniCliente] = useState('99999999');
      const [clienteActual, setClienteActual] = useState(null);
      const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
      const [formCliente, setFormCliente] = useState({ dni: '', nombre: '', telefono: '', correo: '', limiteCredito: '300.00' });
      const [modalCobrarDeudas, setModalCobrarDeudas] = useState(false);
      const [clientesDeudores, setClientesDeudores] = useState([]);
      const [deudorSeleccionado, setDeudorSeleccionado] = useState(null);
      const [boletasDeudor, setBoletasDeudor] = useState([]);
      const [cargandoDetalleDeudor, setCargandoDetalleDeudor] = useState(false);
      const [montoAbonoDeuda, setMontoAbonoDeuda] = useState('');
      const [mostrarHistorialCompletoDeuda, setMostrarHistorialCompletoDeuda] = useState(false);

      // --- Cuentas por Pagar (deuda de la bodega con proveedores) ---
      const [modalCuentasPagar, setModalCuentasPagar] = useState(false);
      const [proveedoresLista, setProveedoresLista] = useState([]);
      const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
      const [montoMovimientoProveedor, setMontoMovimientoProveedor] = useState('');
      const [modalNuevoProveedor, setModalNuevoProveedor] = useState(false);
      const [formProveedor, setFormProveedor] = useState({ nombre: '', ruc: '', telefono: '', saldoInicial: '' });

      // --- Módulo: Gestión de Clientes (listar / editar) ---
      const [modalGestionClientes, setModalGestionClientes] = useState(false);
      const [clientesLista, setClientesLista] = useState([]);
      const [cargandoClientes, setCargandoClientes] = useState(false);
      const [busquedaClientes, setBusquedaClientes] = useState('');
      const [clienteEditando, setClienteEditando] = useState(null);
      const [formEditarCliente, setFormEditarCliente] = useState(null);
      const [guardandoEdicionCliente, setGuardandoEdicionCliente] = useState(false);

      // --- Selector de Cliente en el POS (lista para elegir, en vez de solo DNI) ---
      const [modalBuscarCliente, setModalBuscarCliente] = useState(false);
      const [busquedaClientePOS, setBusquedaClientePOS] = useState('');

      // --- Módulo: Editar / Desactivar Producto ---
      const [modalEditarProducto, setModalEditarProducto] = useState(false);
      const [productoEditando, setProductoEditando] = useState(null);
      const [formEditarProducto, setFormEditarProducto] = useState(null);
      const [guardandoEdicionProducto, setGuardandoEdicionProducto] = useState(false);
      const [subiendoFotoProducto, setSubiendoFotoProducto] = useState(false);
      const [subiendoFotoExtra, setSubiendoFotoExtra] = useState(false);

      // Sube la foto de UN producto de la bodega (a diferencia de
      // subirFotoMaestro, que es del catálogo compartido) -- se guarda en
      // "{bodega_id}/{producto_id}.jpg" dentro del mismo bucket "Productos",
      // así el RLS de storage (ver reactivar_fotos_bodega_y_flag_catalogo_maestro.sql)
      // solo deja escribir dentro de la carpeta de la propia bodega.
      const subirFotoProducto = async (file) => {
        if (!productoEditando) return;
        // Defensa extra además de ocultar el control en el modal -- si la
        // bodega tiene la subida desactivada, ni pegar con Ctrl+V debería
        // intentar nada (la política de storage lo rechazaría igual, pero
        // así se evita hasta el intento y su aviso de error).
        if (!esModoDemo && sesion?.bodega?.permitir_subir_fotos === false) return;
        setSubiendoFotoProducto(true);
        try {
          const comprimida = await comprimirImagenJPEG(file, 20, 480);
          if (esModoDemo) {
            // Modo Demo Local: no hay bodega real en Supabase -- se usa una
            // vista previa local nomás, sin subir nada.
            const urlLocal = URL.createObjectURL(comprimida);
            setFormEditarProducto((prev) => ({ ...prev, foto_url: urlLocal }));
            return;
          }
          const ruta = `${bodegaId}/${productoEditando.id}.jpg`;
          const { error } = await sbClient.storage
            .from('Productos')
            .upload(ruta, comprimida, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
          if (error) throw error;
          const { data } = sbClient.storage.from('Productos').getPublicUrl(ruta);
          setFormEditarProducto((prev) => ({ ...prev, foto_url: `${data.publicUrl}?t=${Date.now()}` }));
        } catch (err) {
          notificar(`No se pudo subir la foto: ${err.message}`, 'error');
        } finally {
          setSubiendoFotoProducto(false);
        }
      };

      // Fotos adicionales para la vitrina de Kaserita Delivery (ej. ropa:
      // varios ángulos). A diferencia de la foto principal, cada una va a
      // una ruta propia con timestamp -- no hay un slot fijo que
      // sobreescribir, son una lista que crece/se achica.
      const subirFotoExtraProducto = async (file) => {
        if (!productoEditando) return;
        if (!esModoDemo && sesion?.bodega?.permitir_subir_fotos === false) return;
        if ((formEditarProducto?.fotos_extra || []).length >= 4) return;
        setSubiendoFotoExtra(true);
        try {
          const comprimida = await comprimirImagenJPEG(file, 20, 480);
          if (esModoDemo) {
            const urlLocal = URL.createObjectURL(comprimida);
            setFormEditarProducto((prev) => ({ ...prev, fotos_extra: [...(prev.fotos_extra || []), urlLocal] }));
            return;
          }
          const ruta = `${bodegaId}/${productoEditando.id}-extra-${Date.now()}.jpg`;
          const { error } = await sbClient.storage
            .from('Productos')
            .upload(ruta, comprimida, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
          if (error) throw error;
          const { data } = sbClient.storage.from('Productos').getPublicUrl(ruta);
          setFormEditarProducto((prev) => ({ ...prev, fotos_extra: [...(prev.fotos_extra || []), `${data.publicUrl}?t=${Date.now()}`] }));
        } catch (err) {
          notificar(`No se pudo subir la foto: ${err.message}`, 'error');
        } finally {
          setSubiendoFotoExtra(false);
        }
      };

      const quitarFotoExtra = (idx) => {
        setFormEditarProducto((prev) => ({ ...prev, fotos_extra: prev.fotos_extra.filter((_, i) => i !== idx) }));
      };

      // Con el modal de "Editar Producto" abierto, Ctrl+V sube directo la
      // imagen que se tenga copiada (igual que en el catálogo maestro).
      useEffect(() => {
        if (!modalEditarProducto) return;
        const manejarPegado = (e) => {
          const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'));
          if (item) subirFotoProducto(item.getAsFile());
        };
        window.addEventListener('paste', manejarPegado);
        return () => window.removeEventListener('paste', manejarPegado);
      }, [modalEditarProducto, productoEditando]);

      // --- Módulo: Mermas (pérdidas de producto) ---
      const [modalMerma, setModalMerma] = useState(false);
      const [formMerma, setFormMerma] = useState({ productoId: '', cantidad: '', motivo: 'Vencido' });
      const [guardandoMerma, setGuardandoMerma] = useState(false);

      // --- Vista: Productos con Stock Bajo ---
      const [modalStockBajo, setModalStockBajo] = useState(false);

      // --- Vista: Ver Stock (todo el catálogo, no solo lo urgente) ---
      const [modalVerStock, setModalVerStock] = useState(false);
      const [verStockCategoria, setVerStockCategoria] = useState('');
      const [verStockBusqueda, setVerStockBusqueda] = useState('');

      // --- Módulo: Toma de Inventario (conteo físico vs. sistema) ---
      // Flujo en 2 pasos: "conteo" (se busca cada producto y se anota lo que
      // se contó, SIN ver el stock del sistema -- para que el conteo sea
      // real y no una copia del número que ya muestra la pantalla) y
      // "revision" (ahí sí se ve Sistema vs Contado y la diferencia, ya
      // completo con lo que se cargó en el paso 1, sin volver a escribirlo).
      const [modalTomaInventario, setModalTomaInventario] = useState(false);
      const [pasoTomaInventario, setPasoTomaInventario] = useState('conteo');
      const [filasTomaInventario, setFilasTomaInventario] = useState([]);
      const [tomaInventarioCategoria, setTomaInventarioCategoria] = useState('');
      const [tomaInventarioBusqueda, setTomaInventarioBusqueda] = useState('');
      const [conteoFisicoBusqueda, setConteoFisicoBusqueda] = useState('');
      const [guardandoTomaInventario, setGuardandoTomaInventario] = useState(false);
      // Foco del input "cantidad encontrada aquí" -- un mapa de refs (uno
      // por producto ya agregado al conteo, no "autoFocus" repetido) y un
      // pedido de foco de un solo uso: se dispara al agregar un producto
      // nuevo, al re-seleccionar uno que ya estaba en la lista (se
      // encontró en otro lugar del local) y al confirmar un hallazgo, para
      // poder seguir sumando el mismo producto sin tocar el mouse.
      const refsPendientesConteo = useRef({});
      const [focoPendienteConteo, setFocoPendienteConteo] = useState(null);
      // Con cientos de productos, mostrar la lista entera mientras se
      // cuenta se vuelve incómodo de scrollear. Por eso solo el producto
      // "activo" (el primero, el que se tocó más recientemente) se muestra
      // completo arriba -- el resto queda colapsado en un "Historial" que
      // se puede abrir para revisar o retomar cualquiera de ellos.
      const [historialConteoAbierto, setHistorialConteoAbierto] = useState(false);
      // "Unidades por pack" queda bloqueado (solo texto) por defecto -- un
      // toque sin querer ahí no debe poder arruinar el multiplicador del
      // conteo. Guarda el productoId del ÚNICO producto que se está
      // editando a la vez (o null si ninguno), tanto en la tarjeta activa
      // del Paso 1 como en el panel del escáner.
      const [editandoPackParaId, setEditandoPackParaId] = useState(null);
      // Declarado acá (y no junto al resto de estados del escáner más abajo)
      // porque el useEffect de foco de abajo lo necesita en su dependency
      // array antes de ese punto del componente.
      const [modalEscaner, setModalEscaner] = useState(false);
      useEffect(() => {
        // Mientras el escáner de cámara está abierto (z-index por encima),
        // el input real que ve el usuario es el del panel del propio
        // escáner, no el de esta lista (que queda tapada detrás) -- no hay
        // que robarle el foco a algo que no se ve. Al cerrar la cámara,
        // este mismo pedido de foco (todavía pendiente) se aplica solo.
        if (!focoPendienteConteo || modalEscaner) return;
        const el = refsPendientesConteo.current[focoPendienteConteo];
        if (el) el.focus();
        setFocoPendienteConteo(null);
      }, [focoPendienteConteo, filasTomaInventario, modalEscaner]);

      // Un conteo físico de cientos de productos puede tomar horas -- si se
      // recarga la página (o el celular la mata en segundo plano) a mitad de
      // camino, no puede perderse todo lo ya contado. Se guarda en dos
      // niveles: localStorage al toque (instantáneo, funciona hasta sin
      // internet) y, con un pequeño debounce, un respaldo real en Supabase
      // (tabla tomas_inventario_borrador) -- así el conteo sobrevive aunque
      // se pierda el celular, se borre la caché del navegador, o se cambie
      // de dispositivo a la mitad, no solo un refresh de la página.
      const claveConteoGuardado = () => `kaserita_conteo_inventario_${bodegaId}`;
      useEffect(() => {
        if (!bodegaId || !modalTomaInventario) return;
        try {
          if (filasTomaInventario.length > 0) {
            localStorage.setItem(claveConteoGuardado(), JSON.stringify(filasTomaInventario));
          } else {
            localStorage.removeItem(claveConteoGuardado());
          }
        } catch {}

        if (esModoDemo || !sbClient) return;
        const temporizador = setTimeout(async () => {
          try {
            if (filasTomaInventario.length > 0) {
              await sbClient.from('tomas_inventario_borrador').upsert({
                bodega_id: bodegaId,
                datos: filasTomaInventario,
                actualizado_en: new Date().toISOString()
              });
            } else {
              await sbClient.from('tomas_inventario_borrador').delete().eq('bodega_id', bodegaId);
            }
          } catch (err) {
            console.warn('No se pudo respaldar el conteo en Supabase:', err.message);
          }
        }, 1000);
        return () => clearTimeout(temporizador);
      }, [filasTomaInventario, modalTomaInventario, bodegaId, esModoDemo, sbClient]);

      // Cada toma de inventario guardada (ver guardarTomaInventario) ya
      // queda insertada en la tabla `tomas_inventario` -- lo único que
      // faltaba era una pantalla para revisar ese historial más adelante y
      // comparar, producto por producto, si un día cuadró y otro no.
      const [modalHistorialInventario, setModalHistorialInventario] = useState(false);
      const [historialInventario, setHistorialInventario] = useState([]);
      const [cargandoHistorialInventario, setCargandoHistorialInventario] = useState(false);
      const [fechaInicioHistInventario, setFechaInicioHistInventario] = useState('');
      const [fechaFinHistInventario, setFechaFinHistInventario] = useState('');
      const [historialInventarioBusqueda, setHistorialInventarioBusqueda] = useState('');
      const [historialInventarioSoloDif, setHistorialInventarioSoloDif] = useState(false);

      // --- Módulo: Inventario Inicial (carga de varios productos a la vez) ---
      // El id se genera acá (en vez de dejar que la base de datos le ponga
      // uno al guardar) para poder subir la foto a "{bodega_id}/{id}.jpg"
      // ANTES de guardar el producto -- si no, no habría ninguna carpeta
      // todavía donde subirla. Al guardar, este mismo id se manda explícito
      // en el insert (ver payloadNuevos en guardarInventarioInicial).
      const filaInventarioVacia = () => ({ id: crypto.randomUUID(), descripcion: '', cod_ean: '', sku: '', categoria: 'Abarrotes', precio_costo: '', precio_venta: '', unidad: 'UND', vendeEnPack: false, vendeEnPackOriginal: false, unidades_por_pack: '', precio_venta_pack: '', cod_ean_pack: '', productoExistenteId: null, foto_url: '', catalogoMaestroId: null });
      const [modalInventarioInicial, setModalInventarioInicial] = useState(false);
      const [filasInventario, setFilasInventario] = useState([filaInventarioVacia()]);
      const [guardandoInventario, setGuardandoInventario] = useState(false);
      // Solo una fila se muestra expandida (formulario completo) a la vez --
      // las demás quedan colapsadas como un resumen tipo "historial", para
      // que cargar varios productos seguidos no vuelva la pantalla eterna.
      const [filaInventarioExpandidaIdx, setFilaInventarioExpandidaIdx] = useState(0);

      // --- Módulo: Importar del Catálogo Maestro -- banco de productos que
      // administra Kaserita (descripción + categoría + foto); la bodega
      // busca uno y le pone su propio precio/costo/stock antes de sumarlo
      // a su inventario. No existe en Modo Demo (no hay sesión real). ---
      const [modalImportarMaestro, setModalImportarMaestro] = useState(false);
      const [catalogoMaestroDisponible, setCatalogoMaestroDisponible] = useState([]);
      const [cargandoMaestroImport, setCargandoMaestroImport] = useState(false);
      const [busquedaMaestroImport, setBusquedaMaestroImport] = useState('');
      const [productoMaestroSeleccionado, setProductoMaestroSeleccionado] = useState(null);
      const [formImportarMaestro, setFormImportarMaestro] = useState({ precio_venta: '', precio_costo: '', stock_actual: '', cod_ean: '', unidad: 'UND' });
      const [guardandoImportMaestro, setGuardandoImportMaestro] = useState(false);

      // --- Módulo: Levantamiento de Inventario -- conteo físico rápido,
      // escaneando de a un producto a la vez. El producto ya tiene que
      // estar registrado en el catálogo, esto solo declara cuánto hay. ---
      const [modalLevantamiento, setModalLevantamiento] = useState(false);
      const [levantamientoEan, setLevantamientoEan] = useState('');
      // null = todavía no se buscó nada; 'no-encontrado' = se buscó y no
      // existe; { producto, esPack } = encontrado (mismo shape que
      // buscarProductoPorCodigo, así se reutiliza tal cual).
      const [levantamientoResultado, setLevantamientoResultado] = useState(null);
      const [levantamientoPacks, setLevantamientoPacks] = useState('');
      const [levantamientoSueltas, setLevantamientoSueltas] = useState('');
      const [guardandoLevantamiento, setGuardandoLevantamiento] = useState(false);

      // --- Módulo: Entrada de Mercadería (Compras) ---
      const [modalEntradaMercaderia, setModalEntradaMercaderia] = useState(false);
      const [compraCabecera, setCompraCabecera] = useState({ proveedor: '', ruc: '', nroComprobante: '' });
      const [compraItems, setCompraItems] = useState([]);
      const [compraItemTemp, setCompraItemTemp] = useState({ productoId: '', cantidad: '', costoUnitario: '', tipo: 'UNIDAD' });
      // Ficha rápida para crear un producto sin salir de "Entrada de
      // Mercadería" -- null cuando el mini-formulario está cerrado.
      const [nuevoProductoInlineCompra, setNuevoProductoInlineCompra] = useState(null);
      const [guardandoProductoInlineCompra, setGuardandoProductoInlineCompra] = useState(false);

      // --- Módulo: Historial de Ventas (por rango de fechas) ---
      const [modalHistorial, setModalHistorial] = useState(false);
      const [ventasDelDia, setVentasDelDia] = useState([]);
      const [cargandoHistorial, setCargandoHistorial] = useState(false);
      const [fechaInicioHistorial, setFechaInicioHistorial] = useState(fechaHoyISO());
      const [fechaFinHistorial, setFechaFinHistorial] = useState(fechaHoyISO());
      const [busquedaBoletaHistorial, setBusquedaBoletaHistorial] = useState('');

      // --- Módulo: Dashboard de Ventas (solo Administrador) ---
      const [modalDashboard, setModalDashboard] = useState(false);
      const [ventasDashboard, setVentasDashboard] = useState([]);
      const [cargandoDashboard, setCargandoDashboard] = useState(false);
      const [fechaInicioDash, setFechaInicioDash] = useState(fechaHoyISO());
      const [fechaFinDash, setFechaFinDash] = useState(fechaHoyISO());
      const [clientesDeuda, setClientesDeuda] = useState([]);
      const [ventasDashboardAnterior, setVentasDashboardAnterior] = useState([]);
      const [proveedoresDeudaDash, setProveedoresDeudaDash] = useState([]);
      // Ventas del año calendario en curso, para "Ventas por Mes" -- no
      // depende del rango de fechas elegido en el filtro rápido.
      const [ventasAnioDash, setVentasAnioDash] = useState([]);
      // Tooltips de los gráficos del dashboard -- índice del punto/hora/mes bajo
      // el mouse (o foco de teclado), null cuando no hay nada resaltado.
      const [horaResaltada, setHoraResaltada] = useState(null);
      // Mes que muestra el calendario de "Ventas por día" ({ anio, mes }); null =
      // el mes de la fecha "Hasta" del filtro.
      const [mesCalendario, setMesCalendario] = useState(null);
      const [mesResaltado, setMesResaltado] = useState(null);

      // --- Cobro / Pagos ---
      // Los métodos de pago y el descuento se mantienen ocultos hasta tocar
      // "Cobrar" -- así el carrito queda limpio y solo se ve lo esencial.
      const [mostrarPago, setMostrarPago] = useState(false);
      const [medioPago, setMedioPago] = useState('EFECTIVO');
      // 'PORCENTAJE' | 'MONTO' | null (null = sin descuento en esta venta)
      const [descuentoTipo, setDescuentoTipo] = useState(null);
      const [descuentoValor, setDescuentoValor] = useState('');
      const [montoRecibido, setMontoRecibido] = useState('');
      const [montoMixtoOtro, setMontoMixtoOtro] = useState(''); // monto fijo pagado con tarjeta/otro
      const [montoMixtoRecibido, setMontoMixtoRecibido] = useState(''); // efectivo físico entregado por el cliente
      const [campoTeclado, setCampoTeclado] = useState(null); // 'recibido' | 'mixtoOtro' | 'mixtoRecibido' | null
      const [procesandoVenta, setProcesandoVenta] = useState(false);
      const [ventaCompletada, setVentaCompletada] = useState(null);
      const [medioQR, setMedioQR] = useState(null); // 'YAPE' | 'PLIN' | null
      const [reciboReimpresion, setReciboReimpresion] = useState(null);

      // --- Diagnóstico y Notificaciones ---
      const [errorDetalle, setErrorDetalle] = useState(null);
      const [toast, setToast] = useState({ visible: false, texto: '', tipo: 'info' });
      const [menuMas, setMenuMas] = useState(false);
      // Buscador y opción resaltada del menú "Más módulos" (estilo paleta de comandos).
      const [busquedaMenu, setBusquedaMenu] = useState('');
      const [indiceMenu, setIndiceMenu] = useState(0);

      // Cambio del PIN de la cuenta del dueño (es la contraseña real de
      // Supabase Auth, "kst-" + PIN). Pide el PIN actual para que un
      // empleado con el dispositivo en la mano no pueda cambiarlo.
      const [modalPinDueno, setModalPinDueno] = useState(false);
      const [formPinDueno, setFormPinDueno] = useState({ actual: '', nuevo: '', repetir: '' });
      const [cambiandoPinDueno, setCambiandoPinDueno] = useState(false);
      const [pinDuenoReforzado, setPinDuenoReforzado] = useState(true);
      // Solo las cuentas creadas con DNI+PIN tienen PIN que cambiar; quien
      // entra con Google no tiene contraseña propia en Kaserita.
      const [cuentaConPinDueno, setCuentaConPinDueno] = useState(false);
      useEffect(() => {
        if (!sbClient || esModoDemo || sesion?.usuario?.rol !== 'dueno') return;
        sbClient.auth.getUser().then(({ data }) => {
          setCuentaConPinDueno(data?.user?.app_metadata?.provider === 'email');
          setPinDuenoReforzado(!!data?.user?.user_metadata?.pin_fuerte);
        });
      }, [sbClient, esModoDemo, sesion?.usuario?.rol]);
      const cambiarPinDueno = async () => {
        const actual = formPinDueno.actual.trim();
        const nuevo = formPinDueno.nuevo.trim();
        if (nuevo.length < PIN_MIN_DUENO || nuevo.length > PIN_MAX) {
          notificar(`El PIN nuevo debe tener entre ${PIN_MIN_DUENO} y ${PIN_MAX} caracteres.`, 'error');
          return;
        }
        if (nuevo !== formPinDueno.repetir.trim()) {
          notificar('Los dos PIN nuevos no coinciden.', 'error');
          return;
        }
        if (nuevo === actual) {
          notificar('El PIN nuevo tiene que ser distinto al actual.', 'error');
          return;
        }
        setCambiandoPinDueno(true);
        try {
          const { error: errActual } = await sbClient.auth.signInWithPassword({
            email: emailAuthDesdeDni(sesion?.usuario?.dni),
            password: passwordAuthDesdePin(actual),
          });
          if (errActual) {
            notificar('El PIN actual no es correcto.', 'error');
            return;
          }
          const { error } = await sbClient.auth.updateUser({
            password: passwordAuthDesdePin(nuevo),
            data: { pin_fuerte: true },
          });
          if (error) throw error;
          setPinDuenoReforzado(true);
          setModalPinDueno(false);
          setFormPinDueno({ actual: '', nuevo: '', repetir: '' });
          notificar('PIN actualizado. Usalo la próxima vez que inicies sesión.', 'success');
        } catch (err) {
          notificar(`No se pudo cambiar el PIN: ${err.message}`, 'error');
        } finally {
          setCambiandoPinDueno(false);
        }
      };

      // Registro de actividad: lo llenan triggers de la base (ver
      // auditoria_acciones_sensibles.sql); acá solo se lee.
      const [modalAuditoria, setModalAuditoria] = useState(false);
      const [filasAuditoria, setFilasAuditoria] = useState([]);
      const [cargandoAuditoria, setCargandoAuditoria] = useState(false);
      const [errorAuditoria, setErrorAuditoria] = useState('');
      const [filtroAuditoria, setFiltroAuditoria] = useState('todo');
      const abrirAuditoria = async () => {
        setModalAuditoria(true);
        setErrorAuditoria('');
        if (esModoDemo || !sbClient) { setFilasAuditoria([]); return; }
        setCargandoAuditoria(true);
        const { data, error } = await sbClient
          .from('auditoria')
          .select('*')
          .eq('bodega_id', bodegaId)
          .order('creado_en', { ascending: false })
          .limit(300);
        if (error) setErrorAuditoria('No se pudo cargar el registro. ¿Ya se ejecutó auditoria_acciones_sensibles.sql?');
        setFilasAuditoria(data || []);
        setCargandoAuditoria(false);
      };

      const [mostrarResumenMobile, setMostrarResumenMobile] = useState(false);
      const inputBusquedaRef = useRef(null);

      // --- Lector de Código de Barras por Cámara ---
      // (modalEscaner se declaró más arriba, ver comentario junto a su declaración)
      const [errorEscaner, setErrorEscaner] = useState('');
      // 'venta': agrega el producto encontrado al carrito (uso normal en caja).
      // 'inventario': rellena el campo EAN de una fila del formulario de inventario.
      const [modoEscaner, setModoEscaner] = useState('venta');
      const [filaEscaneandoIndex, setFilaEscaneandoIndex] = useState(null);
      // 'cod_ean' o 'cod_ean_pack' -- qué campo de la fila se está escaneando.
      const [campoEscaneandoFila, setCampoEscaneandoFila] = useState('cod_ean');
      const ultimoEscaneoRef = useRef({ codigo: '', hora: 0 });
      const videoNativoRef = useRef(null);
      const streamNativoRef = useRef(null);
      const detectorLoopRef = useRef(null);
      const [usandoDetectorNativo, setUsandoDetectorNativo] = useState(false);
      const [metodoForzado, setMetodoForzado] = useState(null); // null | 'html5qr' | 'nativo'
      // Algunos celulares (sobre todo ciertos Android/WebView) no respetan
      // facingMode:'environment' y abren la cámara delantera igual. Se
      // guarda acá la lista de cámaras disponibles y cuál está activa, para
      // poder detectar la trasera por su nombre y ofrecer un botón manual
      // de "Cambiar cámara" como respaldo si la detección automática falla.
      const [camarasDisponibles, setCamarasDisponibles] = useState([]);
      const [camaraDeviceId, setCamaraDeviceId] = useState(null);
      // Para el conteo de inventario, el escáner queda abierto entre un
      // producto y otro (no se cierra al detectar uno) -- este es el
      // producto que se acaba de escanear y para el que se muestra el
      // panel de cantidad encima del visor, hasta que se confirme o se
      // escanee otro código distinto.
      const [productoEscaneadoId, setProductoEscaneadoId] = useState(null);
      useEffect(() => {
        if (!modalEscaner) setProductoEscaneadoId(null);
      }, [modalEscaner]);
      // Diagnóstico visible en pantalla (para poder revisar desde el celular
      // sin necesitar la consola del navegador).
      const [debugEscaner, setDebugEscaner] = useState({ frames: 0, tamano: '', error: '' });

      const notificar = useCallback((texto, tipo = 'info') => {
        setToast({ visible: true, texto, tipo });
        setTimeout(() => setToast({ visible: false, texto: '', tipo: 'info' }), 2200);
      }, []);

      const guardarSesion = (datos) => {
        setSesion(datos);
      };

      // El botón "Modo Demo Local" y el link /demo se sacaron de la pantalla
      // de login (ver commit correspondiente) -- para mostrar la app ahora
      // se usa una bodega real ("Bodega Demo", DNI+PIN, ver el SQL que la
      // crea) que sí soporta el ciclo completo (catálogo online, pedidos
      // por WhatsApp, etc.). El resto del código que revisa "esModoDemo"
      // queda sin usar pero no se tocó -- borrarlo es un cambio grande y
      // separado, no hace falta para esto.

      const cerrarSesion = async () => {
        if (sbClient) {
          try { await sbClient.auth.signOut(); } catch (err) { console.warn(err); }
        }
        setSesion(null);
        setCajeroSeleccionado(null);
        setCarrito([]);
        setTurnoActivo(null);
        // Limpia el estado del Modo Demo Local para que no se filtre a la
        // siguiente sesión (real o demo de nuevo) en esta misma pestaña.
        catalogoDemoRef.current = null;
        ventasDemoRef.current = [];
        setListaCajeros([]);
        setClientesLista([]);
        setProductos([]);
        notificar('Has cerrado sesión.', 'info');
      };

      // Al cargar la app, si el dispositivo ya tiene una sesión válida de
      // Supabase Auth (login anterior), se restaura sin pedir DNI/PIN de
      // nuevo. El modo Demo no pasa por aquí (no usa Auth real).
      useEffect(() => {
        if (!sbClient) { setVerificandoSesion(false); return; }
        (async () => {
          try {
            const { data: { session } } = await sbClient.auth.getSession();
            if (session?.user) {
              // maybeSingle (no single): una sesión guardada puede ser la del
              // super-admin, que no tiene fila en "usuarios" -- eso es
              // normal, no un error a mostrar en consola.
              // Trae la bodega en el mismo viaje (embed) en vez de una
              // segunda consulta secuencial después -- en cada carga de la
              // app esto le ahorra una ida y vuelta completa al servidor
              // antes de poder ocultar el splash.
              const { data: usuarioConBodega } = await sbClient.from('usuarios').select('*, bodegas(*)').eq('auth_id', session.user.id).maybeSingle();
              if (usuarioConBodega) {
                const { bodegas: bodega, ...usuario } = usuarioConBodega;
                setSesion({ usuario, bodega: bodega || { id: usuario.bodega_id, nombre: 'Mi Bodega' } });
              } else {
                // Sin fila en "usuarios" -- puede ser el super-admin (cuenta
                // aparte, sin bodega, ver más abajo) o una cuenta de Google
                // que nunca compró ninguna bodega. Si es lo segundo, no la
                // dejamos en un login que no explica nada: la mandamos a
                // activar su bodega, ya autenticada.
                const { data: esAdmin } = await sbClient.from('super_admins').select('auth_id').eq('auth_id', session.user.id).maybeSingle();
                if (!esAdmin) {
                  setVerificandoSesion(false);
                  notificar('Esta cuenta no tiene ninguna suscripción activa. Te llevamos a activar tu bodega...', 'error');
                  setTimeout(() => { window.location.href = '/registro'; }, 1800);
                  return;
                }
              }
            }
          } catch (err) {
            console.warn('No se pudo restaurar la sesión:', err.message);
          } finally {
            setVerificandoSesion(false);
          }
        })();
      }, [sbClient]);

      // Guardar ventas en espera
      const guardarVentasEnEsperaLS = (lista) => {
        setVentasEnEspera(lista);
        localStorage.setItem('pos_ventas_espera', JSON.stringify(lista));
      };

      // Cargar cajeros
      const cargarCajeros = async () => {
        // Modo Demo Local: la lista ya arranca con el "Dueño Demo" (ver botón
        // de login); no hay nada real que traer ni ninguna auto-reparación
        // que intentar, así que se deja tal cual está en memoria.
        if (!sbClient || !bodegaId || esModoDemo) return;
        try {
          // No se selecciona pin_seguridad -- esa columna no se puede leer
          // desde el cliente (ver cajeros_pin_administrador.sql), así que
          // pedirla con "*" haría fallar la consulta entera.
          let { data } = await sbClient
            .from('cajeros')
            .select('id, bodega_id, nombre, dni, rol, activo')
            .eq('bodega_id', bodegaId)
            .eq('activo', true)
            .order('nombre', { ascending: true });

          let cjs = data || [];

          // Auto-reparación: si quien inició sesión no tiene su propio registro
          // en 'cajeros' (puede pasar en bodegas antiguas, o si se perdió el
          // insert al crear la cuenta), se crea aquí mismo con su mismo rol,
          // para que nunca se quede sin su nivel de acceso real.
          if (usuarioActivo && !cjs.some((c) => c.dni === usuarioActivo.dni)) {
            const { data: propio, error: errPropio } = await sbClient
              .from('cajeros')
              .insert([{
                bodega_id: bodegaId,
                nombre: usuarioActivo.nombre,
                dni: usuarioActivo.dni,
                rol: usuarioActivo.rol || 'dueno',
                activo: true
              }])
              .select('id, bodega_id, nombre, dni, rol, activo')
              .single();
            if (!errPropio && propio) {
              cjs = [...cjs, propio].sort((a, b) => a.nombre.localeCompare(b.nombre));
            }
          }

          setListaCajeros(cjs);
          // Se devuelve el cajero resuelto (no solo se guarda en estado)
          // para que quien llama a cargarCajeros (el efecto de carga
          // inicial) pueda pasárselo de una a verificarTurno sin esperar
          // un re-render -- el estado de React no se actualiza al toque
          // dentro de la misma función.
          let resuelto = cajeroSeleccionado;
          if (cjs.length > 0 && !cajeroSeleccionado) {
            const propio = cjs.find((c) => c.dni === usuarioActivo?.dni);
            resuelto = propio || cjs[0];
            setCajeroSeleccionado(resuelto);
          }
          return resuelto;
        } catch (err) {
          console.warn(err);
        }
      };

      // ==========================================
      // LINK DE PEDIDOS (KaseritaDelivery): vitrina pública de la bodega
      // ==========================================
      const normalizarSlugDelivery = (texto) =>
        (texto || '')
          .toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

      const abrirModalDelivery = () => {
        setSlugDelivery(sesion?.bodega?.slug || normalizarSlugDelivery(sesion?.bodega?.nombre));
        setDeliveryHabilitado(!!sesion?.bodega?.delivery_habilitado);
        setLogoUrlDelivery(sesion?.bodega?.logo_url || '');
        setDireccionDelivery(sesion?.bodega?.direccion || '');
        setTelefonoDeliveryEditar(sesion?.usuario?.rol === 'dueno' ? (sesion?.usuario?.telefono || '') : '');
        setHorarioDelivery({
          0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
          ...(sesion?.bodega?.horario_atencion || {}),
        });
        setModalDelivery(true);
      };

      // Logo (cuadrado, chico) y portada (rectangular, más grande) de la
      // vitrina pública -- van en el mismo bucket "Productos" que ya se usa
      // para fotos de producto, en su propia carpeta por bodega, con
      // upsert para que "cambiar la foto" sea simplemente subir de nuevo
      // sobre el mismo archivo.
      const subirLogoDelivery = async (file) => {
        setSubiendoLogoDelivery(true);
        try {
          const comprimida = await comprimirImagenJPEG(file, 25, 320);
          // La política RLS de storage.objects exige que el primer segmento
          // de la ruta sea el bodega_id (mismo esquema que las fotos de
          // producto) -- de paso, así el borrado de bodega (que barre todo
          // "{bodega_id}/*") también se lleva estas dos imágenes.
          const ruta = `${bodegaId}/delivery-logo.jpg`;
          const { error } = await sbClient.storage
            .from('Productos')
            .upload(ruta, comprimida, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
          if (error) throw error;
          const { data } = sbClient.storage.from('Productos').getPublicUrl(ruta);
          setLogoUrlDelivery(`${data.publicUrl}?t=${Date.now()}`);
        } catch (err) {
          notificar(`No se pudo subir el logo: ${err.message}`, 'error');
        } finally {
          setSubiendoLogoDelivery(false);
        }
      };

      const guardarConfigDelivery = async () => {
        if (!esModoDemo && (!sbClient || !bodegaId)) {
          notificar('No se pudo guardar los cambios.', 'error');
          return;
        }
        const slugLimpio = normalizarSlugDelivery(slugDelivery);
        if (deliveryHabilitado && !slugLimpio) {
          notificar('Elegí un link antes de activar el catálogo público.', 'error');
          return;
        }
        setGuardandoDelivery(true);
        try {
          const telefonoLimpio = telefonoDeliveryEditar.trim();
          if (esModoDemo) {
            // Modo Demo Local: no hay bodega real en Supabase -- se aplica
            // directo en memoria, igual que el resto de la demo.
          } else {
            // El dueño no puede actualizar bodegas directo (RLS solo lo permite
            // al super-admin) -- esta función security definer es el único
            // camino, y de paso respeta si el admin le dio delivery_permitido.
            const { error: errBodega } = await sbClient.rpc('actualizar_mi_delivery', {
              p_slug: slugLimpio || null,
              p_delivery_habilitado: deliveryHabilitado,
              p_logo_url: logoUrlDelivery || null,
              p_direccion: direccionDelivery.trim() || null,
              p_horario_atencion: horarioDelivery,
            });
            if (errBodega) {
              if (errBodega.code === '23505') throw new Error('Ese link ya lo está usando otra bodega, probá con otro.');
              throw errBodega;
            }
            if (sesion?.usuario?.rol === 'dueno' && telefonoLimpio !== (sesion?.usuario?.telefono || '')) {
              const { error: errTelefono } = await sbClient
                .from('usuarios')
                .update({ telefono: telefonoLimpio || null })
                .eq('id', sesion.usuario.id);
              if (errTelefono) throw errTelefono;
            }
          }
          setSesion((s) => ({
            ...s,
            bodega: {
              ...s.bodega,
              slug: slugLimpio,
              delivery_habilitado: deliveryHabilitado,
              logo_url: logoUrlDelivery || null,
              banner_url: null,
              direccion: direccionDelivery.trim() || null,
              horario_atencion: horarioDelivery,
            },
            usuario: s.usuario?.rol === 'dueno' ? { ...s.usuario, telefono: telefonoLimpio || null } : s.usuario,
          }));
          setSlugDelivery(slugLimpio);
          notificar('Listo, tu link de pedidos quedó actualizado.', 'success');
        } catch (err) {
          notificar(err.message || 'No se pudo guardar los cambios.', 'error');
        } finally {
          setGuardandoDelivery(false);
        }
      };

      const cargarPedidosRetirar = async () => {
        if (esModoDemo || !sbClient) return;
        setCargandoPedidosRetirar(true);
        try {
          // Trae también "retirado"/"cancelado" (no solo la cola activa) para
          // poder mostrar la pestaña "Historial" con su filtro de fecha --
          // 200 alcanza de sobra para "últimos 30 días" en una bodega chica,
          // no hace falta el histórico completo acá.
          const { data, error } = await sbClient
            .from('pedidos_seguimiento')
            .select('*')
            .order('creado_en', { ascending: false })
            .limit(200);
          if (error) throw error;
          setPedidosRetirar(data || []);
        } catch (err) {
          notificar(err.message || 'No se pudieron cargar los pedidos por retirar.', 'error');
        } finally {
          setCargandoPedidosRetirar(false);
        }
      };

      const marcarPedidoListo = async (id) => {
        setMarcandoListoId(id);
        try {
          const { error } = await sbClient.rpc('marcar_pedido_listo', { p_id: id });
          if (error) throw error;
          setPedidosRetirar((prev) => prev.map((p) => (p.id === id ? { ...p, estado: 'listo' } : p)));
          notificar('Pedido marcado como listo. El cliente ya lo puede ver.', 'success');
        } catch (err) {
          notificar(err.message || 'No se pudo marcar el pedido.', 'error');
        } finally {
          setMarcandoListoId(null);
        }
      };

      // Carga directo al carrito del POS un pedido de "Pedidos por retirar",
      // sin tener que ir a buscarlo de nuevo por código en "Cargar Pedido".
      // Items ya vienen validados (los reconstruyó el trigger al crearse el
      // pedido), así que se agregan tal cual. El seguimiento NO se cierra
      // acá -- si se cerrara al cargar al carrito, un cajero que carga el
      // pedido y después no llega a cobrar (se distrae, el cliente se
      // arrepiente, se vacía el carrito) lo pierde igual, ya marcado como
      // entregado sin haberlo cobrado. Se queda "vinculado" y se cierra de
      // verdad recién cuando handleCobrar termina la venta con éxito.
      const cargarPedidoDesdeRetirar = async (pedido) => {
        if (pedidosCargadosAlCarrito.some((p) => p.id === pedido.id)) {
          notificar('Ese pedido ya está en el carrito -- cóbralo para completarlo.', 'info');
          return;
        }
        setProcesandoPedidoRetirarId(pedido.id);
        try {
          // Si ya había una venta en curso en el carrito, se aparca primero
          // (igual que el botón "Pausar") -- el pedido de delivery pasa
          // adelante en vez de mezclarse con lo que se estaba cobrando.
          if (carrito.length > 0) {
            aparcarVentaActual();
          }
          let agregados = 0;
          (pedido.items || []).forEach((it) => {
            if (it.combo_id) {
              const combo = combos.find((c) => c.id === it.combo_id);
              if (combo) {
                agregarComboAlCarrito(combo, it.cantidad);
                agregados++;
              } else {
                notificar(`"${it.descripcion}" ya no está disponible, no se agregó.`, 'error');
              }
              return;
            }
            const prod = productos.find((p) => p.id === it.id);
            if (prod) {
              agregarAlCarrito(prod, it.cantidad);
              agregados++;
            } else {
              notificar(`"${it.descripcion}" ya no está en tu inventario, no se agregó.`, 'error');
            }
          });
          if (agregados > 0) {
            setPedidosCargadosAlCarrito((prev) => [...prev, { id: pedido.id, codigoCorto: pedido.codigo_corto }]);
            notificar(`Pedido ${pedido.codigo_corto} agregado al carrito. Se cierra solo cuando cobres.`, 'success');
            // Vuelve a la vista normal del carrito para que se vea de una
            // vez lo que se acaba de cargar, en vez de dejar al cajero
            // todavía parado en la pantalla de "Pedidos por retirar".
            setModalPedidosRetirar(false);
            setMostrarResumenMobile(true);
          }
        } finally {
          setProcesandoPedidoRetirarId(null);
        }
      };

      // Para cuando el cliente ya pasó y pagó por otra vía (no por
      // "Cargar Pedido") -- solo cierra el seguimiento, no toca el carrito.
      // Cierra el pedido de una, sin poder volver a "Marcar listo" ni
      // "Al carrito" después -- por eso pide confirmación, igual que
      // eliminarPedidoRetirar, para que no se marque por error un pedido
      // que en realidad no se cobró.
      const marcarRetiradoDirecto = async (pedido) => {
        const ok = await pedirConfirmacion({
          titulo: 'Confirmar retiro',
          mensaje: `¿El pedido ${pedido.codigo_corto} ya se cobró y el cliente ya se lo llevó? Esto lo cierra sin pasar por el carrito.`,
          textoBoton: 'Sí, ya retiró',
        });
        if (!ok) return;
        setProcesandoPedidoRetirarId(pedido.id);
        try {
          const { error } = await sbClient.rpc('marcar_pedido_retirado', { p_codigo_corto: pedido.codigo_corto });
          if (error) throw error;
          setPedidosRetirar((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, estado: 'retirado' } : p)));
          notificar(`Pedido ${pedido.codigo_corto} marcado como retirado.`, 'success');
        } catch (err) {
          notificar(err.message || 'No se pudo marcar el pedido.', 'error');
        } finally {
          setProcesandoPedidoRetirarId(null);
        }
      };

      // Para pedidos viejos que quedaron colgados (el cliente nunca vino a
      // buscarlo). No se borra la fila -- queda como "cancelado" en el
      // historial -- pero desaparece de esta cola.
      const eliminarPedidoRetirar = async (pedido) => {
        const ok = await pedirConfirmacion({
          titulo: 'Eliminar pedido de la cola',
          mensaje: `¿Eliminar el pedido ${pedido.codigo_corto} de la cola? El cliente ya no lo va a ver como pendiente.`,
          textoBoton: 'Eliminar',
          peligroso: true,
        });
        if (!ok) return;
        setProcesandoPedidoRetirarId(pedido.id);
        try {
          const { error } = await sbClient.rpc('cancelar_seguimiento_pedido', { p_id: pedido.id });
          if (error) throw error;
          setPedidosRetirar((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, estado: 'cancelado' } : p)));
          notificar(`Pedido ${pedido.codigo_corto} eliminado.`, 'success');
        } catch (err) {
          notificar(err.message || 'No se pudo eliminar el pedido.', 'error');
        } finally {
          setProcesandoPedidoRetirarId(null);
        }
      };

      // Aviso en vivo: mientras haya sesión de bodega, escucha si entra un
      // pedido nuevo (Realtime de Supabase, filtrado por RLS a la propia
      // bodega igual que cualquier otra consulta) y suena + avisa, esté o
      // no abierta la pantalla de "Pedidos por retirar".
      useEffect(() => {
        if (esModoDemo || !sbClient || !sesion?.bodega?.id) return;
        const canal = sbClient
          .channel(`pedidos-seguimiento-${sesion.bodega.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'pedidos_seguimiento', filter: `bodega_id=eq.${sesion.bodega.id}` },
            (payload) => {
              sonarAvisoPedidoNuevo();
              notificar(`Nuevo pedido: ${payload.new.codigo_corto}`, 'success');
              setPedidosRetirar((prev) => (prev.some((p) => p.id === payload.new.id) ? prev : [...prev, payload.new]));
            }
          )
          .subscribe();
        return () => { sbClient.removeChannel(canal); };
      }, [esModoDemo, sesion?.bodega?.id]);

      // Carga inicial de "Pedidos por retirar" al abrir sesión -- así el
      // aviso de pendientes ya sale correcto desde el arranque, sin
      // depender de que el cajero abra esa pantalla al menos una vez.
      useEffect(() => {
        if (esModoDemo || !sbClient || !sesion?.bodega?.id) return;
        cargarPedidosRetirar();
      }, [esModoDemo, sesion?.bodega?.id]);

      // ==========================================
      // GESTIÓN DE CAJEROS (agregar empleados, activar/desactivar acceso)
      // ==========================================
      const abrirGestionCajeros = async () => {
        setModalGestionCajeros(true);
        setMostrarFormNuevoCajero(false);
        if (esModoDemo) {
          setCajerosGestion(listaCajeros);
          return;
        }
        if (!sbClient || !bodegaId) return;
        setCargandoCajerosGestion(true);
        try {
          const { data, error } = await sbClient
            .from('cajeros')
            .select('id, bodega_id, nombre, dni, rol, activo')
            .eq('bodega_id', bodegaId)
            .order('nombre', { ascending: true });
          if (error) throw error;
          setCajerosGestion(data || []);
        } catch (err) {
          notificar(`No se pudo cargar la lista de cajeros: ${err.message}`, 'error');
        } finally {
          setCargandoCajerosGestion(false);
        }
      };

      // Crea el acceso de un nuevo empleado: un registro en 'usuarios' (para
      // poder iniciar sesión con DNI+PIN) y otro en 'cajeros' (para
      // seleccionarlo al abrir turno y quedar asociado a sus ventas).
      // Los empleados (Cajero o Administrador) no tienen contraseña propia:
      // solo se agregan a la lista de turno con nombre, DNI y rol. Nadie
      // aparte del dueño puede iniciar sesión de forma independiente.
      const registrarNuevoCajeroCompleto = async () => {
        const { nombre, dni, rol, pin } = formNuevoCajero;
        if (!nombre.trim() || !dni.trim()) {
          notificar('Nombre y DNI son obligatorios.', 'error');
          return;
        }
        // Un Administrador desbloquea el panel completo al elegirlo en
        // "Abrir Turno" -- por eso necesita su propio PIN desde que se
        // crea (ver cajeros_pin_administrador.sql). Un Cajero normal no
        // desbloquea nada, así que no lo necesita.
        if (rol === 'administrador' && !pinValido(pin)) {
          notificar(`El PIN del Administrador debe tener entre ${PIN_MIN} y ${PIN_MAX} caracteres.`, 'error');
          return;
        }
        setGuardandoNuevoCajero(true);
        try {
          if (esModoDemo) {
            const nuevo = { id: generarUUID(), bodega_id: bodegaId, nombre: nombre.trim(), dni: dni.trim(), rol, activo: true, pin_seguridad: rol === 'administrador' ? pin.trim() : null };
            setListaCajeros((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            setCajerosGestion((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
          } else if (sbClient) {
            // pin_seguridad se hashea del lado del servidor (establecer_pin_cajero,
            // ver hashear_pin_cajero.sql) -- nunca se manda el texto plano en un
            // insert/update directo a la tabla.
            // "id" nada más -- pedir "*" fallaría porque pin_seguridad no
            // se puede leer desde el cliente (ver cargarCajeros más arriba).
            const { data: cajeroCreado, error: errCajero } = await sbClient
              .from('cajeros')
              .insert([{ bodega_id: bodegaId, nombre: nombre.trim(), dni: dni.trim(), rol: rol, activo: true }])
              .select('id')
              .single();
            if (errCajero) throw errCajero;
            if (rol === 'administrador') {
              const { error: errPin } = await sbClient.rpc('establecer_pin_cajero', {
                p_cajero_id: cajeroCreado.id,
                p_pin: pin.trim(),
              });
              if (errPin) throw errPin;
            }
            abrirGestionCajeros();
            cargarCajeros();
          }
          setFormNuevoCajero({ nombre: '', dni: '', rol: 'cajero', pin: '' });
          setMostrarFormNuevoCajero(false);
          notificar(`¡"${nombre}" agregado! Ya aparece en la lista para elegir al abrir turno.`, 'success');
        } catch (err) {
          notificar(`Error al registrar: ${err.message}`, 'error');
        } finally {
          setGuardandoNuevoCajero(false);
        }
      };

      // Activa/desactiva el acceso del cajero: bloquea su login (usuarios) y lo
      // saca del selector de turno (cajeros), sin borrar su historial de ventas.
      const alternarActivoCajero = async (cajero) => {
        const nuevoEstado = !cajero.activo;
        try {
          if (sbClient && !esModoDemo) {
            const { error: err1 } = await sbClient
              .from('cajeros')
              .update({ activo: nuevoEstado })
              .eq('id', cajero.id);
            if (err1) throw err1;

            const { error: err2 } = await sbClient
              .from('usuarios')
              .update({ activo: nuevoEstado })
              .eq('bodega_id', bodegaId)
              .eq('dni', cajero.dni);
            if (err2) console.warn('No se pudo actualizar el acceso de login:', err2.message);
          }
          setCajerosGestion((prev) => prev.map((c) => (c.id === cajero.id ? { ...c, activo: nuevoEstado } : c)));
          if (esModoDemo) {
            setListaCajeros((prev) => (nuevoEstado ? prev : prev.filter((c) => c.id !== cajero.id)));
          } else {
            cargarCajeros();
          }
          notificar(nuevoEstado ? `${cajero.nombre} reactivado.` : `${cajero.nombre} desactivado.`, 'info');
        } catch (err) {
          notificar(`Error: ${err.message}`, 'error');
        }
      };

      // Borra por completo el acceso de un cajero (a diferencia de
      // desactivar, que solo lo oculta del selector conservando su
      // historial). Si tiene ventas registradas a su nombre, la base de
      // datos rechaza el borrado (esas filas dependen de este id) -- en ese
      // caso conviene usar "Desactivar" en su lugar, así se avisa.
      const eliminarCajero = async (cajero) => {
        if (cajero.rol === 'dueno') return;
        if (!window.confirm(`¿Eliminar a "${cajero.nombre}" de la lista de cajeros? Esta acción no se puede deshacer.`)) return;
        try {
          if (sbClient && !esModoDemo) {
            const { error } = await sbClient.from('cajeros').delete().eq('id', cajero.id);
            if (error) throw error;
          }
          setCajerosGestion((prev) => prev.filter((c) => c.id !== cajero.id));
          setListaCajeros((prev) => prev.filter((c) => c.id !== cajero.id));
          if (cajeroSeleccionado?.id === cajero.id) setCajeroSeleccionado(null);
          notificar(`${cajero.nombre} eliminado.`, 'info');
        } catch (err) {
          if (err.code === '23503') {
            notificar(`No se puede eliminar a ${cajero.nombre}: tiene ventas registradas a su nombre. Usa "Desactivar" en su lugar.`, 'error');
          } else {
            notificar(`Error: ${err.message}`, 'error');
          }
        }
      };

      // El dueño ya probó su identidad al iniciar sesión, así que puede
      // elegirse a sí mismo sin nada más. Cualquier otra fila con rol
      // "administrador" (o "dueno", que no debería repetirse) desbloquea el
      // panel completo -- antes de aplicar ese cambio, se pide su PIN.
      const elegirCajeroTurno = (f) => {
        if (!f) return;
        const esUnoMismo = usuarioActivo?.dni && f.dni === usuarioActivo.dni;
        const esElevado = f.rol === 'administrador' || f.rol === 'dueno';
        if (esElevado && !esUnoMismo) {
          setCajeroPendientePin(f);
          setPinConfirmarCajero('');
        } else {
          setCajeroSeleccionado(f);
        }
      };

      const confirmarPinCajero = async () => {
        const f = cajeroPendientePin;
        if (!f) return;
        setVerificandoPinCajero(true);
        try {
          let ok = false;
          if (esModoDemo) {
            ok = !!f.pin_seguridad && f.pin_seguridad === pinConfirmarCajero.trim();
          } else {
            const { data, error } = await sbClient.rpc('verificar_pin_cajero', {
              p_cajero_id: f.id,
              p_pin: pinConfirmarCajero.trim()
            });
            if (error) throw error;
            ok = !!data;
          }
          if (ok) {
            setCajeroSeleccionado(f);
            setCajeroPendientePin(null);
            setPinConfirmarCajero('');
          } else {
            notificar('PIN incorrecto.', 'error');
          }
        } catch (err) {
          notificar(err.message, 'error');
        } finally {
          setVerificandoPinCajero(false);
        }
      };

      // El dueño cambia/asigna el PIN de un Administrador desde acá (por
      // ejemplo, si lo olvidó) -- solo se puede llegar a este modal desde
      // "Cajeros y Empleados", que ya está detrás de esAdmin.
      const guardarPinCajero = async () => {
        const cajero = modalPinCajero;
        if (!cajero) return;
        if (!pinValido(nuevoPinCajero)) {
          notificar(`El PIN debe tener entre ${PIN_MIN} y ${PIN_MAX} caracteres.`, 'error');
          return;
        }
        setGuardandoPinCajero(true);
        try {
          if (esModoDemo) {
            setListaCajeros((prev) => prev.map((c) => (c.id === cajero.id ? { ...c, pin_seguridad: nuevoPinCajero.trim() } : c)));
            setCajerosGestion((prev) => prev.map((c) => (c.id === cajero.id ? { ...c, pin_seguridad: nuevoPinCajero.trim() } : c)));
          } else {
            const { error } = await sbClient.rpc('establecer_pin_cajero', {
              p_cajero_id: cajero.id,
              p_pin: nuevoPinCajero.trim(),
            });
            if (error) throw error;
          }
          notificar(`PIN de ${cajero.nombre} actualizado.`, 'success');
          setModalPinCajero(null);
          setNuevoPinCajero('');
        } catch (err) {
          notificar(`Error: ${err.message}`, 'error');
        } finally {
          setGuardandoPinCajero(false);
        }
      };

      // ==========================================
      // PRODUCTOS & CATÁLOGO
      // ==========================================
      const cargarProductos = async (termino = '') => {
        if (!bodegaId) return;

        // Modo Demo Local: nunca toca Supabase -- el catálogo vive en
        // catalogoDemoRef (se crea una sola vez) y conserva ahí cualquier
        // cambio hecho durante la demo en vez de reiniciarse a los datos
        // de ejemplo cada vez que algo refresca el catálogo.
        if (esModoDemo) {
          if (!catalogoDemoRef.current) catalogoDemoRef.current = catalogoDemoInicial();
          const base = catalogoDemoRef.current.filter((p) => p.activo !== false);
          const b = termino.trim().toLowerCase();
          const visibles = b
            ? base.filter((p) => (p.cod_ean || '').toLowerCase().includes(b) || (p.descripcion || '').toLowerCase().includes(b) || (p.categoria || '').toLowerCase().includes(b))
            : base;
          setProductos(visibles);
          setCargandoProductos(false);
          return;
        }

        setCargandoProductos(true);
        if (sbClient) {
          try {
            const construirQuery = (conFotoMaestro) => {
              let q = sbClient
                .from('productos')
                .select(conFotoMaestro ? '*, catalogo_maestro(foto_url)' : '*')
                .eq('bodega_id', bodegaId)
                .order('descripcion', { ascending: true });
              if (termino.trim()) {
                const b = termino.trim();
                q = q.or(`cod_ean.ilike.%${b}%,descripcion.ilike.%${b}%,categoria.ilike.%${b}%`);
              }
              return q;
            };

            let { data, error } = await construirQuery(true);
            if (error) {
              // Compatibilidad: si todavía no se corrió
              // catalogo_maestro_enlazar_foto.sql, la relación no existe en
              // el schema cache y este primer intento falla -- se reintenta
              // sin el JOIN en vez de dejar el catálogo entero sin cargar.
              ({ data, error } = await construirQuery(false));
            }
            if (error) throw error;

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
          } catch (err) {
            setProductos([]);
            notificar(`No se pudo cargar el catálogo: ${err.message}`, 'error');
          } finally {
            setCargandoProductos(false);
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
      const busquedaActualRef = useRef('');
      busquedaActualRef.current = busqueda;
      const recargaCatalogoTimer = useRef(null);
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
            .select('*, combos_items(*, productos(descripcion, cod_ean, precio_venta, precio_costo, foto_url, categoria, stock_actual))')
            .eq('bodega_id', bodegaId)
            .order('nombre', { ascending: true });
          if (error) throw error;
          setCombos(data || []);
        } catch (err) {
          setCombos([]);
          notificar(`No se pudieron cargar los combos: ${err.message}`, 'error');
        } finally {
          setCargandoCombos(false);
        }
      };

      const abrirModalCombos = () => {
        setModalCombos(true);
        setComboEditando(null);
        setFormCombo(null);
        setBusquedaProductoCombo('');
        cargarCombos();
      };

      const nuevoCombo = () => {
        setComboEditando(null);
        setFormCombo(comboVacio());
        setBusquedaProductoCombo('');
      };

      const editarCombo = (combo) => {
        setComboEditando(combo);
        setFormCombo({
          id: combo.id,
          nombre: combo.nombre,
          descripcion: combo.descripcion || '',
          precio_venta: String(combo.precio_venta),
          activo: combo.activo,
          items: (combo.combos_items || []).map((ci) => ({
            producto_id: ci.producto_id,
            descripcion: ci.productos?.descripcion || '(producto eliminado)',
            cod_ean: ci.productos?.cod_ean || '',
            precio_venta: Number(ci.productos?.precio_venta) || 0,
            precio_costo: Number(ci.productos?.precio_costo) || 0,
            cantidad: Number(ci.cantidad)
          })),
          precioTocado: true
        });
        setBusquedaProductoCombo('');
      };

      // Suma de los precios de venta normales de cada producto del combo
      // (según su cantidad) -- referencia para que el dueño vea cuánto está
      // descontando al ponerle precio de bolsa al combo.
      const precioNormalCombo = (form) => (form?.items || []).reduce((acc, it) => acc + it.precio_venta * it.cantidad, 0);

      // Suma de los COSTOS de cada producto del combo -- referencia para
      // avisar si el precio de bolsa quedó por debajo de lo que cuesta
      // armarlo (ver aviso de "precio bajo costo" en el formulario).
      const costoNormalCombo = (form) => (form?.items || []).reduce((acc, it) => acc + it.precio_costo * it.cantidad, 0);

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
              cantidad: 1
            }];
          }
          return actualizarItemsYPrecio(prev, nuevosItems);
        });
        setBusquedaProductoCombo('');
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
          notificar(`No se pudo guardar el combo: ${err.message}`, 'error');
        } finally {
          setGuardandoCombo(false);
        }
      };

      const alternarActivoCombo = async (combo) => {
        try {
          const { error } = await sbClient.from('combos').update({ activo: !combo.activo }).eq('id', combo.id);
          if (error) throw error;
          setCombos((prev) => prev.map((c) => (c.id === combo.id ? { ...c, activo: !combo.activo } : c)));
        } catch (err) {
          notificar(`No se pudo actualizar el combo: ${err.message}`, 'error');
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
          notificar(`No se pudo eliminar el combo: ${err.message}`, 'error');
        }
      };

      const avisoCarritoRecuperadoRef = useRef(false);
      useEffect(() => {
        if (sesion && bodegaId) {
          cargarProductos(busqueda);
          cargarCategorias();
          cargarCombos();
          obtenerOCrearCliente('99999999');
          // Encadenado (no en paralelo): verificarTurno necesita saber ya
          // resuelto qué cajero es "el mío" en este dispositivo (por DNI)
          // para decidir si hay que retomar mi propia caja en silencio o
          // avisar que hay otras cajas abiertas de otros cajeros.
          (async () => {
            const cajero = await cargarCajeros();
            verificarTurno(cajero);
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
            const { data: vCreada, error: vErr } = await sbClient
              .from('ventas')
              .insert([pendiente.payloadVenta])
              .select()
              .single();
            if (vErr) throw vErr;

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
              hayFallosDeStock = true;
            }

            exitosas++;
          } catch (err) {
            console.warn('No se pudo sincronizar una venta offline, se reintentará:', err);
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
          notificar('Algunas ventas offline se sincronizaron pero su stock no se pudo ajustar. Revísalo en "Ver Stock".', 'error');
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
          mensaje: 'Solo la verás en esta bodega.',
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
            if (error) throw error;
          }
          setCategoriasDB((prev) => [...prev, limpio]);
          asignar(limpio);
        } catch (err) {
          notificar(`No se pudo guardar la categoría: ${err.message}`, 'error');
        }
      };

      // Filtrado en vivo: mientras se escribe en el buscador, se vuelve a
      // consultar el catálogo con un pequeño retraso (debounce) para no
      // disparar una consulta por cada tecla presionada.
      useEffect(() => {
        if (!sesion || !bodegaId) return;
        const t = setTimeout(() => {
          cargarProductos(busqueda);
        }, 350);
        return () => clearTimeout(t);
      }, [busqueda]);

      // Categorías: en el filtro solo se muestran las que ya tienen al menos
      // un producto cargado (la lista completa de categoriasDB se sigue
      // usando en los formularios de Nuevo/Editar Producto).
      const categorias = useMemo(() => {
        const usadas = new Set(productos.map(p => p.categoria).filter(Boolean));
        const enOrden = categoriasDB.filter(c => usadas.has(c));
        const extra = Array.from(usadas).filter(c => !categoriasDB.includes(c));
        return ['TODOS', ...enOrden, ...extra];
      }, [productos, categoriasDB]);

      const productosFiltrados = useMemo(() => {
        if (categoriaFiltro === 'TODOS') return productos;
        return productos.filter(p => p.categoria === categoriaFiltro);
      }, [productos, categoriaFiltro]);

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
          listo: pedidosRetirar.filter((p) => p.estado === 'listo').sort(porFecha),
          historial: pedidosRetirar
            .filter((p) => p.estado === 'retirado' || p.estado === 'cancelado')
            .sort((a, b) => -porFecha(a, b)),
        };
      }, [pedidosRetirar]);

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

      // Qué productos son parte de algún combo activo -- para poder
      // avisarlo en su propia tarjeta del catálogo normal (ver ProductoCard
      // más abajo), no solo dentro de la pestaña "Combos". Así un cajero que
      // busca/agrega producto por producto igual se entera de que existe un
      // combo con ese producto.
      const productosEnCombo = useMemo(() => {
        const set = new Set();
        combos.filter((c) => c.activo).forEach((c) => {
          (c.combos_items || []).forEach((ci) => set.add(ci.producto_id));
        });
        return set;
      }, [combos]);

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

      const cantidadStockBajo = useMemo(
        () => productos.filter((p) => p.stock_actual != null && Number(p.stock_actual) <= Number(p.stock_min || 5)).length,
        [productos]
      );

      // Lista de "Ver Stock": todo el catálogo, filtrable por categoría y
      // texto, ordenado de menor a mayor stock (lo más urgente primero).
      const productosVerStock = useMemo(() => {
        const t = verStockBusqueda.trim().toLowerCase();
        return productos
          .filter((p) => !verStockCategoria || p.categoria === verStockCategoria)
          .filter((p) => !t || (p.descripcion || '').toLowerCase().includes(t))
          .sort((a, b) => Number(a.stock_actual || 0) - Number(b.stock_actual || 0));
      }, [productos, verStockCategoria, verStockBusqueda]);

      // Filas visibles de "Toma de Inventario", filtradas por categoría y
      // texto igual que "Ver Stock" -- para no tener que contar las 300
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

      // Como los abonos se descuentan del saldo total del cliente (no boleta por
      // boleta), acá se marcan como "pagadas" las boletas más antiguas hasta
      // cubrir lo ya abonado, asumiendo que los pagos cubren primero la deuda
      // más vieja (FIFO). Así el detalle refleja lo que realmente se debe, no
      // el total histórico de todo lo comprado a crédito.
      const boletasDeudorConEstado = useMemo(() => {
        if (!deudorSeleccionado) return [];
        const diasCredito = Number(deudorSeleccionado.dias_credito) || 30;
        const ordenadasAsc = [...boletasDeudor].sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
        const totalHistorico = ordenadasAsc.reduce((acc, b) => acc + Number(b.total_venta), 0);
        const montoYaPagado = Math.max(0, +(totalHistorico - Number(deudorSeleccionado.saldo_actual)).toFixed(2));
        let acumulado = 0;
        const ahora = Date.now();
        const conEstado = ordenadasAsc.map((b) => {
          acumulado += Number(b.total_venta);
          const pagada = acumulado <= montoYaPagado + 0.01;
          const diasTranscurridos = Math.floor((ahora - new Date(b.fecha_hora).getTime()) / 86400000);
          const diasVencido = diasTranscurridos - diasCredito;
          return { ...b, pagada, vencida: !pagada && diasVencido > 0, diasVencido };
        });
        return conEstado.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
      }, [boletasDeudor, deudorSeleccionado]);

      const boletasPendientesDeuda = useMemo(
        () => boletasDeudorConEstado.filter((b) => !b.pagada),
        [boletasDeudorConEstado]
      );

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

        // Solo advierte si el stock está bajo o agotado; no bloquea la venta
        // (el conteo puede tener un pequeño desfase o vender algo aún no registrado).
        if (producto.stock_actual !== null && producto.stock_actual !== undefined) {
          if (Number(producto.stock_actual) <= 0) {
            notificar(`"${producto.descripcion}" figura sin stock, pero se agregó igual.`, 'error');
            return;
          } else if (Number(producto.stock_actual) <= Number(producto.stock_min || 5)) {
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
        if (comboListo) convertirProductosEnCombo(comboListo);
      }, [carrito, combos, convertirProductosEnCombo]);

      // Convierte el carrito (donde un combo es UNA línea) en las líneas
      // "reales" que se guardan en ventas_detalle y descuentan stock -- una
      // por cada producto, incluidos los que vienen de dentro de un combo.
      // Así anularVentaHoy, el reporte de "Productos Más Vendidos" y el
      // ajuste de stock (ajustar_stock por producto) no necesitan saber que
      // los combos existen: para ellos es una venta de varios productos,
      // como cualquier otra.
      const expandirLineaCarrito = (item) => {
        if (!item.esCombo) return [item];
        const pesoTotal = item.itemsCombo.reduce((acc, c) => acc + c.precioVenta * c.cantidadBase, 0);
        let subtotalAsignado = 0;
        return item.itemsCombo.map((comp, i) => {
          const cantidadComponente = +(comp.cantidadBase * item.cantidad).toFixed(3);
          const esUltimo = i === item.itemsCombo.length - 1;
          let subtotalComponente;
          if (esUltimo) {
            subtotalComponente = +(item.subtotal - subtotalAsignado).toFixed(2);
          } else {
            const fraccion = pesoTotal > 0 ? (comp.precioVenta * comp.cantidadBase) / pesoTotal : 1 / item.itemsCombo.length;
            subtotalComponente = +(item.subtotal * fraccion).toFixed(2);
            subtotalAsignado = +(subtotalAsignado + subtotalComponente).toFixed(2);
          }
          return {
            productoId: comp.productoId,
            cod_ean: comp.cod_ean,
            descripcion: `${comp.descripcion} (${item.descripcion})`,
            cantidad: cantidadComponente,
            precioUnitario: cantidadComponente > 0 ? +(subtotalComponente / cantidadComponente).toFixed(2) : 0,
            precioCosto: comp.precioCosto,
            subtotal: subtotalComponente,
            unidadesStock: cantidadComponente,
            comboId: item.comboId
          };
        });
      };

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
          notificar('Abrí un turno para poder escanear productos.', 'info');
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
          } else {
            cargarProductos(term);
          }
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

        if (modoEscaner === 'inventario') {
          if (filaEscaneandoIndex !== null) {
            if (campoEscaneandoFila === 'cod_ean_pack') {
              actualizarCodigoEanPackFila(filaEscaneandoIndex, codigoLimpio, true);
            } else {
              actualizarCodigoEanFila(filaEscaneandoIndex, codigoLimpio);
              const encontrado = buscarProductoExistente(codigoLimpio);
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
            agregarProductoAConteo(encontrado.producto);
            setProductoEscaneadoId(encontrado.producto.id);
          } else {
            setProductoEscaneadoId(null);
            notificar(`Código ${codigoLimpio} no encontrado en el catálogo.`, 'error');
          }
          return;
        }

        if (modoEscaner === 'levantamiento') {
          setLevantamientoEan(codigoLimpio);
          const encontrado = buscarProductoPorCodigo(codigoLimpio);
          setLevantamientoResultado(encontrado || 'no-encontrado');
          setLevantamientoPacks('');
          setLevantamientoSueltas('');
          if (!encontrado) notificar(`Código ${codigoLimpio} no encontrado en el catálogo.`, 'error');
          setModalEscaner(false);
          return;
        }

        const encontradoPorCodigo = buscarProductoPorCodigo(codigoLimpio);
        if (encontradoPorCodigo) {
          handleClicProducto(encontradoPorCodigo.producto, encontradoPorCodigo.esPack ? 'PACK' : 'UNIDAD');
          notificar(`Agregado: ${encontradoPorCodigo.producto.descripcion}${encontradoPorCodigo.esPack ? ' (Pack)' : ''}`, 'success');
        } else {
          setModalEscaner(false);
          notificar(`Código ${codigoLimpio} no encontrado en el catálogo.`, 'error');
        }
      };

      const abrirEscanerParaVenta = () => {
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
        setDebugEscaner({ frames: 0, tamano: '', error: '' });
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
            await asegurarZXing();
            await ZXingWASM.prepareZXingModule({
              overrides: {
                locateFile: (path) => `https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/reader/${path}`
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
            if (frames % 5 === 0) {
              setDebugEscaner({ frames, tamano: `${video.videoWidth}x${video.videoHeight}`, error: '' });
            }
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
              setDebugEscaner((prev) => ({ ...prev, error: String(e?.message || e).slice(0, 60) }));
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
          let frames = 0;

          const loop = () => {
            if (!activo) return;
            detectorLoopRef.current = requestAnimationFrame(loop);
            if (detectando || video.readyState < 2) return;
            detectando = true;
            frames++;
            if (frames % 15 === 0) {
              setDebugEscaner({ frames, tamano: `${video.videoWidth}x${video.videoHeight}`, error: '' });
            }
            detector.detect(video)
              .then((resultados) => {
                detectando = false;
                if (activo && resultados && resultados.length > 0) {
                  handleCodigoEscaneado(resultados[0].rawValue);
                }
              })
              .catch((e) => {
                detectando = false;
                setDebugEscaner((prev) => ({ ...prev, error: String(e?.message || e).slice(0, 60) }));
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
      const montoDescuento = useMemo(() => {
        if (!descuentoTipo) return 0;
        const valor = parseFloat(descuentoValor) || 0;
        if (valor <= 0) return 0;
        const monto = descuentoTipo === 'PORCENTAJE'
          ? totalVenta * (Math.min(valor, 100) / 100)
          : valor;
        return +Math.min(Math.max(monto, 0), totalVenta).toFixed(2);
      }, [descuentoTipo, descuentoValor, totalVenta]);

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
        obtenerOCrearCliente('99999999');
      };

      // ==========================================
      // VENTAS EN ESPERA (PARK SALES)
      // ==========================================
      const aparcarVentaActual = () => {
        if (carrito.length === 0) return;
        const nuevaVentaEspera = {
          id: Date.now(),
          hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
          items: [...carrito],
          total: totalVenta,
          cliente: clienteActual
        };

        const nuevaLista = [...ventasEnEspera, nuevaVentaEspera];
        guardarVentasEnEsperaLS(nuevaLista);
        setCarrito([]);
        setMostrarPago(false);
        reiniciarClienteYMedioPago();
        // Al pausar se desvincula cualquier pedido de "Pedidos por retirar"
        // que estuviera cargado -- sigue disponible en su cola por si esta
        // venta en espera nunca se retoma; si se retoma y cobra más tarde,
        // el pedido se cierra a mano con "Ya retiró".
        setPedidosCargadosAlCarrito([]);
      };

      const recuperarVentaEspera = (index) => {
        const v = ventasEnEspera[index];
        if (!v) return;
        const nuevaLista = ventasEnEspera.filter((_, i) => i !== index);
        // Si ya hay productos en el carrito, se ponen en espera antes de
        // recuperar la otra venta, para no perderlos.
        const habiaVentaActual = carrito.length > 0;
        if (habiaVentaActual) {
          nuevaLista.push({
            id: Date.now(),
            hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
            items: [...carrito],
            total: totalVenta,
            cliente: clienteActual
          });
          setPedidosCargadosAlCarrito([]);
        }
        setCarrito(v.items);
        if (v.cliente) setClienteActual(v.cliente);
        setMostrarPago(false);
        guardarVentasEnEsperaLS(nuevaLista);
        setModalVentasEspera(false);
      };

      const borrarVentaEspera = (index) => {
        const nuevaLista = ventasEnEspera.filter((_, i) => i !== index);
        guardarVentasEnEsperaLS(nuevaLista);
        notificar('Venta en espera eliminada.', 'info');
      };

      // ==========================================
      // CLIENTE & GESTIÓN DE CRÉDITOS
      // ==========================================
      const obtenerOCrearCliente = async (dni = '99999999') => {
        const dniLimpio = dni.trim() || '99999999';

        // Sin conexión: no se puede consultar/crear en Supabase. Si ya
        // teníamos el cliente "Desconocido" real (cacheado la última vez
        // que sí hubo internet), se reutiliza -- así una venta offline
        // sigue apuntando a un cliente_id válido que existe de verdad en
        // la base de datos, en vez de un id inventado que fallaría al
        // sincronizar.
        if (!enLinea && dniLimpio === '99999999' && desconocidoCacheRef.current) {
          setClienteActual(desconocidoCacheRef.current);
          return desconocidoCacheRef.current;
        }

        if (!sbClient || !bodegaId || !enLinea || esModoDemo) {
          const mock = { id: generarUUID(), bodega_id: bodegaId, dni: dniLimpio, nombre_completo: dniLimpio === '99999999' ? 'Desconocido' : `CLIENTE DNI ${dniLimpio}`, saldo_actual: 0 };
          setClienteActual(mock);
          return mock;
        }

        try {
          const { data } = await sbClient
            .from('clientes')
            .select('*')
            .eq('bodega_id', bodegaId)
            .eq('dni', dniLimpio)
            .maybeSingle();

          if (data) {
            setClienteActual(data);
            if (dniLimpio === '99999999') desconocidoCacheRef.current = data;
            return data;
          }

          const nuevo = {
            bodega_id: bodegaId,
            dni: dniLimpio,
            nombre_completo: dniLimpio === '99999999' ? 'Desconocido' : `CLIENTE DNI ${dniLimpio}`,
            saldo_actual: 0.00
          };

          const { data: creado } = await sbClient
            .from('clientes')
            .insert([nuevo])
            .select()
            .single();

          setClienteActual(creado || nuevo);
          if (dniLimpio === '99999999') desconocidoCacheRef.current = creado || nuevo;
          return creado || nuevo;
        } catch (err) {
          console.warn(err);
        }
      };

      const handleGuardarNuevoCliente = async (e) => {
        e.preventDefault();
        const { dni, nombre, telefono, correo, limiteCredito } = formCliente;
        if (!dni.trim() || !nombre.trim()) {
          notificar('DNI y Nombre son obligatorios.', 'error');
          return;
        }
        const limite = Number(limiteCredito) || 0;

        try {
          if (sbClient && !esModoDemo) {
            const { data, error } = await sbClient
              .from('clientes')
              .insert([{
                bodega_id: bodegaId,
                dni: dni.trim(),
                nombre_completo: nombre.trim(),
                telefono: telefono.trim() || null,
                correo: correo.trim() || null,
                limite_credito: limite,
                dias_credito: 30,
                saldo_actual: 0.00
              }])
              .select()
              .single();

            if (error) throw error;
            setClienteActual(data);
            setDniCliente(data.dni);
            // Si se creó desde dentro de "Clientes", que aparezca en la
            // lista al toque en vez de tener que cerrar y volver a entrar.
            if (modalGestionClientes) {
              setClientesLista((prev) => [...prev, data].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '')));
            }
          } else {
            const cLocal = { id: generarUUID(), bodega_id: bodegaId, dni: dni.trim(), nombre_completo: nombre.trim(), telefono, correo, limite_credito: limite, dias_credito: 30, saldo_actual: 0 };
            setClienteActual(cLocal);
            setDniCliente(cLocal.dni);
            // En Modo Demo Local se agrega siempre a la lista (sin importar
            // desde qué modal se creó) para que luego aparezca tanto en
            // "Clientes" como en "Cuentas por Cobrar" si queda con deuda.
            if (modalGestionClientes || esModoDemo) {
              setClientesLista((prev) => [...prev, cLocal].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '')));
            }
          }

          setModalNuevoCliente(false);
          setFormCliente({ dni: '', nombre: '', telefono: '', correo: '', limiteCredito: '300.00' });
          notificar(`¡Cliente "${nombre}" registrado con éxito!`, 'success');
        } catch (err) {
          notificar(`Error: ${err.message}`, 'error');
        }
      };

      // Cargar deudores
      const abrirModuloCobroDeudas = async () => {
        setModalCobrarDeudas(true);
        if (esModoDemo) {
          // No hay servidor real del que traer deudores -- se calculan a
          // partir de los clientes creados en esta misma demo.
          setClientesDeudores(clientesLista.filter((c) => (Number(c.saldo_actual) || 0) > 0).sort((a, b) => (Number(b.saldo_actual) || 0) - (Number(a.saldo_actual) || 0)));
          return;
        }
        if (sbClient && bodegaId) {
          try {
            const { data } = await sbClient
              .from('clientes')
              .select('*')
              .eq('bodega_id', bodegaId)
              .gt('saldo_actual', 0)
              .order('saldo_actual', { ascending: false });

            setClientesDeudores(data || []);
          } catch (err) {
            console.warn(err);
          }
        }
      };

      // ==========================================
      // CUENTAS POR PAGAR (deuda de la bodega con proveedores)
      // ==========================================
      const abrirCuentasPorPagar = async () => {
        setModalCuentasPagar(true);
        setProveedorSeleccionado(null);
        setMontoMovimientoProveedor('');
        if (sbClient && bodegaId) {
          try {
            const { data, error } = await sbClient
              .from('proveedores')
              .select('*')
              .eq('bodega_id', bodegaId)
              .order('saldo_actual', { ascending: false });
            if (error) throw error;
            setProveedoresLista(data || []);
          } catch (err) {
            console.warn(err);
            notificar(`No se pudo cargar los proveedores: ${err.message}`, 'error');
          }
        }
      };

      const handleGuardarNuevoProveedor = async (e) => {
        e.preventDefault();
        const { nombre, ruc, telefono, saldoInicial } = formProveedor;
        if (!nombre.trim()) {
          notificar('El nombre del proveedor es obligatorio.', 'error');
          return;
        }
        const saldo = Math.max(0, Number(saldoInicial) || 0);
        try {
          if (esModoDemo) {
            const local = { id: generarUUID(), bodega_id: bodegaId, nombre: nombre.trim(), ruc: ruc.trim() || null, telefono: telefono.trim() || null, saldo_actual: saldo };
            setProveedoresLista((prev) => [local, ...prev].sort((a, b) => Number(b.saldo_actual) - Number(a.saldo_actual)));
          } else if (sbClient) {
            const { data, error } = await sbClient
              .from('proveedores')
              .insert([{
                bodega_id: bodegaId,
                nombre: nombre.trim(),
                ruc: ruc.trim() || null,
                telefono: telefono.trim() || null,
                saldo_actual: saldo
              }])
              .select()
              .single();
            if (error) throw error;
            setProveedoresLista((prev) => [data, ...prev].sort((a, b) => Number(b.saldo_actual) - Number(a.saldo_actual)));
          }
          setModalNuevoProveedor(false);
          setFormProveedor({ nombre: '', ruc: '', telefono: '', saldoInicial: '' });
          notificar(`Proveedor "${nombre}" registrado.`, 'success');
        } catch (err) {
          notificar(`Error al registrar el proveedor: ${err.message}`, 'error');
        }
      };

      // tipo: 'deuda' (recibiste mercadería a crédito, sube lo que debes) o
      // 'pago' (le pagaste al proveedor, baja lo que debes).
      const registrarMovimientoProveedor = async (tipo) => {
        if (!proveedorSeleccionado) return;
        const monto = parseFloat(montoMovimientoProveedor) || 0;
        if (monto <= 0) {
          notificar('Ingresa un monto válido.', 'error');
          return;
        }
        // Ajuste atómico (RPC) en vez de leer-y-escribir: si dos personas
        // registran un movimiento al mismo proveedor casi al mismo
        // tiempo, ninguno de los dos se pierde.
        const delta = tipo === 'pago' ? -monto : monto;

        try {
          let nuevoSaldo = Math.max(0, +((Number(proveedorSeleccionado.saldo_actual) || 0) + delta).toFixed(2));
          if (sbClient && !esModoDemo) {
            const { data, error: errUpdate } = await sbClient.rpc('ajustar_saldo_proveedor', {
              p_proveedor_id: proveedorSeleccionado.id,
              p_delta: delta
            });
            if (errUpdate) throw errUpdate;
            if (data != null) nuevoSaldo = Number(data);

            if (tipo === 'pago') {
              const { error: errPago } = await sbClient
                .from('pagos_proveedor')
                .insert([{ bodega_id: bodegaId, proveedor_id: proveedorSeleccionado.id, monto }]);
              if (errPago) console.warn('No se pudo registrar el historial de pago:', errPago);
            }
          }
          setProveedoresLista((prev) => prev.map((p) => (p.id === proveedorSeleccionado.id ? { ...p, saldo_actual: nuevoSaldo } : p)));
          setProveedorSeleccionado((prev) => ({ ...prev, saldo_actual: nuevoSaldo }));
          setMontoMovimientoProveedor('');
          notificar(
            tipo === 'pago' ? `Pago de S/ ${monto.toFixed(2)} registrado.` : `Se agregó S/ ${monto.toFixed(2)} a la deuda.`,
            'success'
          );
        } catch (err) {
          notificar(`Error al registrar el movimiento: ${err.message}`, 'error');
        }
      };

      // ==========================================
      // GESTIÓN DE CLIENTES (listar / editar)
      // ==========================================
      const abrirGestionClientes = async () => {
        setModalGestionClientes(true);
        setClienteEditando(null);
        // Modo Demo Local: no hay nada que traer del servidor -- se deja la
        // lista tal cual está en memoria (los clientes creados en la demo
        // ya viven ahí) en vez de reemplazarla por un resultado vacío.
        if (esModoDemo || !sbClient || !bodegaId) return;
        setCargandoClientes(true);
        try {
          const { data, error } = await sbClient
            .from('clientes')
            .select('*')
            .eq('bodega_id', bodegaId)
            .order('nombre_completo', { ascending: true });
          if (error) throw error;
          setClientesLista(data || []);
        } catch (err) {
          notificar(`No se pudo cargar la lista de clientes: ${err.message}`, 'error');
        } finally {
          setCargandoClientes(false);
        }
      };

      const clientesFiltradosGestion = () => {
        const t = busquedaClientes.trim().toLowerCase();
        if (!t) return clientesLista;
        return clientesLista.filter(
          (c) => (c.nombre_completo || '').toLowerCase().includes(t) || (c.dni || '').includes(t)
        );
      };

      // Abre el selector de cliente del POS: muestra la lista completa para
      // elegir con un toque, en vez de pedir escribir el DNI a ciegas.
      const abrirBuscarClientePOS = async () => {
        setBusquedaClientePOS('');
        setModalBuscarCliente(true);
        if (!sbClient || !bodegaId) return;
        setCargandoClientes(true);
        try {
          const { data, error } = await sbClient
            .from('clientes')
            .select('*')
            .eq('bodega_id', bodegaId)
            .order('nombre_completo', { ascending: true });
          if (error) throw error;
          setClientesLista(data || []);
        } catch (err) {
          notificar(`No se pudo cargar la lista de clientes: ${err.message}`, 'error');
        } finally {
          setCargandoClientes(false);
        }
      };

      const clientesFiltradosPOS = () => {
        const t = busquedaClientePOS.trim().toLowerCase();
        if (!t) return clientesLista;
        return clientesLista.filter(
          (c) => (c.nombre_completo || '').toLowerCase().includes(t) || (c.dni || '').includes(t)
        );
      };

      const seleccionarClientePOS = async (c) => {
        setDniCliente(c.dni);
        setModalBuscarCliente(false);
        if (c.id) {
          // Cliente real, ya viene de la base de datos.
          setClienteActual(c);
        } else {
          // "Cliente Varios / Desconocido": es un objeto local sin id todavía
          // (nunca se guardó en la BD). Se busca/crea su fila real, igual
          // que al escribir el DNI a mano, para que la venta pueda
          // registrarse (ventas.cliente_id no admite NULL).
          await obtenerOCrearCliente(c.dni);
        }
      };

      const exportarClientesExcel = () => {
        const filas = clientesLista.map((c) => ({
          DNI: c.dni,
          Nombre: c.nombre_completo,
          Telefono: c.telefono || '',
          Correo: c.correo || '',
          'Limite de Credito': Number(c.limite_credito || 0),
          'Saldo Actual (Deuda)': Number(c.saldo_actual || 0)
        }));
        exportarExcel(`Clientes_${bodegaNombre}.xlsx`, filas, 'Clientes');
      };

      const abrirEdicionCliente = (cliente) => {
        setClienteEditando(cliente);
        setFormEditarCliente({
          nombre_completo: cliente.nombre_completo || '',
          telefono: cliente.telefono || '',
          correo: cliente.correo || '',
          limite_credito: cliente.limite_credito != null ? String(cliente.limite_credito) : '0',
          dias_credito: cliente.dias_credito != null ? String(cliente.dias_credito) : '30'
        });
      };

      const guardarEdicionCliente = async () => {
        if (!clienteEditando || !formEditarCliente) return;
        if (!formEditarCliente.nombre_completo.trim()) {
          notificar('El nombre es obligatorio.', 'error');
          return;
        }
        setGuardandoEdicionCliente(true);
        try {
          const payload = {
            nombre_completo: formEditarCliente.nombre_completo.trim(),
            telefono: formEditarCliente.telefono.trim() || null,
            correo: formEditarCliente.correo.trim() || null,
            limite_credito: Number(formEditarCliente.limite_credito) || 0,
            dias_credito: Number(formEditarCliente.dias_credito) || 30
          };
          if (sbClient && !esModoDemo) {
            const { error } = await sbClient.from('clientes').update(payload).eq('id', clienteEditando.id);
            if (error) throw error;
          }
          setClientesLista((prev) => prev.map((c) => (c.id === clienteEditando.id ? { ...c, ...payload } : c)));
          setClienteEditando(null);
          notificar('Cliente actualizado.', 'success');
        } catch (err) {
          notificar(`Error al guardar: ${err.message}`, 'error');
        } finally {
          setGuardandoEdicionCliente(false);
        }
      };

      // Al elegir un deudor, cargar el detalle de sus boletas a crédito pendientes
      const seleccionarDeudor = async (cliente) => {
        setDeudorSeleccionado(cliente);
        setMontoAbonoDeuda(String(cliente.saldo_actual));
        setBoletasDeudor([]);
        setMostrarHistorialCompletoDeuda(false);
        if (!sbClient) return;
        setCargandoDetalleDeudor(true);
        try {
          const { data, error } = await sbClient
            .from('ventas')
            .select('*, ventas_detalle(*, productos(descripcion, unidad))')
            .eq('cliente_id', cliente.id)
            .eq('medio_pago', 'CREDITO')
            .eq('anulada', false)
            .order('fecha_hora', { ascending: false });
          if (error) throw error;
          setBoletasDeudor(data || []);
        } catch (err) {
          console.warn('Error al cargar boletas del deudor:', err.message);
        } finally {
          setCargandoDetalleDeudor(false);
        }
      };

      // Genera el PDF de estado de cuenta en el propio navegador (sin backend).
      // Formato formal: membrete, resumen de la cuenta, antigüedad del saldo
      // por tramos y detalle de boletas, todo en Helvetica y un solo color.
      const generarPDFEstadoCuenta = async (cliente, boletas) => {
        await asegurarJsPDF();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const M = 15;
        const R = 195;
        const OSCURO = [43, 10, 99];
        const MORADO = [97, 5, 220];
        const GRIS = [110, 110, 120];
        const LINEA = [221, 221, 221];
        const FONDO = [243, 240, 248];
        const RIESGO = [180, 35, 24];
        const colorTexto = (c) => doc.setTextColor(c[0], c[1], c[2]);
        const colorLinea = (c) => doc.setDrawColor(c[0], c[1], c[2]);
        const colorRelleno = (c) => doc.setFillColor(c[0], c[1], c[2]);

        const hoy = new Date();
        const ordenadas = [...boletas].sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
        const filas = ordenadas.map((b) => {
          const fecha = new Date(b.fecha_hora);
          const items = (b.ventas_detalle || []).map((d) => `${d.cantidad} x ${d.productos?.descripcion || 'Producto'}`);
          return {
            nro: b.nro_boleta,
            fecha: fecha.toLocaleDateString('es-PE'),
            dias: Math.max(0, Math.floor((hoy - fecha) / 86400000)),
            items: items.length ? items : ['Sin detalle disponible'],
            total: Number(b.total_venta) || 0,
          };
        });
        const sumaBoletas = filas.reduce((a, f) => a + f.total, 0);
        const saldo = Number(cliente.saldo_actual) || 0;
        const limite = Number(cliente.limite_credito) || 0;
        // Si el cliente ya hizo pagos a cuenta, el saldo es menor que la suma
        // de las boletas: se muestra la diferencia como línea aparte.
        const pagosACuenta = sumaBoletas - saldo;
        const hayPagos = pagosACuenta > 0.005;

        // ---- Membrete ----
        colorTexto(OSCURO);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.text(String(bodegaNombre || '').toUpperCase(), M, 20);
        colorTexto(GRIS);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text('KASERITA · ESTADO DE CUENTA DE CLIENTES', M, 25);
        colorTexto([34, 34, 34]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('ESTADO DE CUENTA', R, 20, { align: 'right' });
        colorTexto(GRIS);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Emitido el ${hoy.toLocaleDateString('es-PE')}, ${hoy.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`, R, 25, { align: 'right' });
        colorLinea(OSCURO);
        doc.setLineWidth(0.9);
        doc.line(M, 29, R, 29);

        const titulo = (txt, x, y, ancho) => {
          colorTexto(MORADO);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.text(txt.toUpperCase(), x, y);
          colorLinea(LINEA);
          doc.setLineWidth(0.25);
          doc.line(x, y + 1.6, x + ancho, y + 1.6);
        };

        // ---- Cliente y resumen ----
        let y = 39;
        titulo('Cliente', M, y, 88);
        titulo('Resumen de la cuenta', 111, y, R - 111);
        colorTexto([34, 34, 34]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(String(cliente.nombre_completo || ''), M, y + 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        colorTexto([70, 70, 70]);
        doc.text(`DNI ${cliente.dni || '-'}`, M, y + 14);
        if (cliente.telefono) doc.text(`Teléfono ${cliente.telefono}`, M, y + 19);

        const resumen = [];
        if (limite > 0) resumen.push(['Límite de crédito', `S/ ${formatoSoles(limite)}`]);
        resumen.push(['Boletas pendientes', String(filas.length)]);
        if (filas.length) resumen.push(['Boleta más antigua', filas[0].fecha]);
        resumen.push(['Saldo pendiente', `S/ ${formatoSoles(saldo)}`, true]);
        if (limite > 0) resumen.push(['Crédito disponible', `S/ ${formatoSoles(Math.max(0, limite - saldo))}`]);
        let ry = y + 8;
        resumen.forEach(([k, v, fuerte]) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          colorTexto(GRIS);
          doc.text(k, 111, ry);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(fuerte ? 10.5 : 9);
          colorTexto(fuerte ? OSCURO : [34, 34, 34]);
          doc.text(v, R, ry, { align: 'right' });
          ry += 5.6;
        });
        y = Math.max(y + 24, ry) + 6;

        // ---- Antigüedad del saldo (tramos según los días de cada boleta) ----
        titulo('Antigüedad de las boletas', M, y, R - M);
        y += 6;
        const tramos = [
          { t: '0 - 7', min: 0, max: 7 },
          { t: '8 - 15', min: 8, max: 15 },
          { t: '16 - 30', min: 16, max: 30 },
          { t: 'Más de 30', min: 31, max: Infinity },
        ].map((tr) => ({ ...tr, monto: filas.filter((f) => f.dias >= tr.min && f.dias <= tr.max).reduce((a, f) => a + f.total, 0) }));
        const anchoCol = (R - M - 34) / 5;
        colorRelleno(FONDO);
        doc.rect(M, y, R - M, 7, 'F');
        colorTexto([68, 68, 68]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('DÍAS TRANSCURRIDOS', M + 2, y + 4.7);
        tramos.forEach((tr, i) => doc.text(tr.t.toUpperCase(), M + 34 + anchoCol * (i + 1) - 2, y + 4.7, { align: 'right' }));
        doc.text('TOTAL', R - 2, y + 4.7, { align: 'right' });
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        colorTexto([34, 34, 34]);
        doc.text('Importe (S/)', M + 2, y + 5.5);
        tramos.forEach((tr, i) => {
          const atrasado = tr.min >= 16 && tr.monto > 0;
          doc.setFont('helvetica', atrasado ? 'bold' : 'normal');
          colorTexto(atrasado ? RIESGO : tr.monto === 0 ? [170, 170, 170] : [34, 34, 34]);
          doc.text(formatoSoles(tr.monto), M + 34 + anchoCol * (i + 1) - 2, y + 5.5, { align: 'right' });
        });
        doc.setFont('helvetica', 'bold');
        colorTexto([34, 34, 34]);
        doc.text(formatoSoles(sumaBoletas), R - 2, y + 5.5, { align: 'right' });
        colorLinea(LINEA);
        doc.line(M, y + 8, R, y + 8);
        y += 16;

        // ---- Detalle de boletas ----
        titulo('Detalle de boletas pendientes', M, y, R - M);
        y += 6;
        const cabeceraDetalle = () => {
          colorRelleno(FONDO);
          doc.rect(M, y, R - M, 7, 'F');
          colorTexto([68, 68, 68]);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.text('FECHA', M + 2, y + 4.7);
          doc.text('N.º DE BOLETA', M + 26, y + 4.7);
          doc.text('DESCRIPCIÓN', M + 62, y + 4.7);
          doc.text('DÍAS', R - 32, y + 4.7, { align: 'right' });
          doc.text('IMPORTE (S/)', R - 2, y + 4.7, { align: 'right' });
          y += 7;
        };
        cabeceraDetalle();

        if (filas.length === 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          colorTexto(GRIS);
          doc.text('Sin boletas a crédito registradas.', M + 2, y + 6);
          y += 10;
        }

        filas.forEach((f) => {
          const lineas = doc.splitTextToSize(f.items.join('\n'), 70).flat();
          const alto = Math.max(7.5, lineas.length * 4.2 + 3.5);
          if (y + alto > 262) {
            doc.addPage();
            y = 20;
            cabeceraDetalle();
          }
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          colorTexto([85, 85, 85]);
          doc.text(f.fecha, M + 2, y + 5);
          doc.setFont('helvetica', 'bold');
          colorTexto([34, 34, 34]);
          doc.text(String(f.nro), M + 26, y + 5);
          doc.setFont('helvetica', 'normal');
          colorTexto([85, 85, 85]);
          doc.text(lineas, M + 62, y + 5);
          doc.text(String(f.dias), R - 32, y + 5, { align: 'right' });
          doc.setFont('helvetica', 'bold');
          colorTexto([34, 34, 34]);
          doc.text(formatoSoles(f.total), R - 2, y + 5, { align: 'right' });
          colorLinea(LINEA);
          doc.setLineWidth(0.2);
          doc.line(M, y + alto, R, y + alto);
          y += alto;
        });

        // ---- Totales ----
        if (y > 246) { doc.addPage(); y = 20; }
        if (hayPagos) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          colorTexto(GRIS);
          doc.text('Pagos a cuenta', M + 62, y + 6);
          colorTexto([34, 34, 34]);
          doc.text(`- ${formatoSoles(pagosACuenta)}`, R - 2, y + 6, { align: 'right' });
          y += 8;
        }
        colorLinea(OSCURO);
        doc.setLineWidth(0.7);
        doc.line(M, y + 1, R, y + 1);
        doc.setLineWidth(0.25);
        doc.line(M, y + 12, R, y + 12);
        doc.line(M, y + 13, R, y + 13);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        colorTexto(OSCURO);
        doc.text('Total adeudado', M + 2, y + 8);
        doc.text(formatoSoles(saldo), R - 2, y + 8, { align: 'right' });
        y += 24;

        // ---- Nota y saldo a pagar ----
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        colorTexto(GRIS);
        const nota = doc.splitTextToSize('Este documento resume las boletas a crédito pendientes de pago a la fecha de emisión. Si ya realizó un pago que no figura aquí, comuníquese con la bodega para actualizar su cuenta.', 105);
        doc.text(nota, M, y + 4);
        colorLinea(OSCURO);
        doc.setLineWidth(0.5);
        doc.rect(R - 62, y - 2, 62, 17);
        colorTexto(MORADO);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.text('SALDO TOTAL A PAGAR', R - 4, y + 3.5, { align: 'right' });
        colorTexto(OSCURO);
        doc.setFontSize(15);
        doc.text(`S/ ${formatoSoles(saldo)}`, R - 4, y + 11.5, { align: 'right' });

        // ---- Pie de página en cada hoja ----
        const paginas = doc.getNumberOfPages();
        for (let i = 1; i <= paginas; i++) {
          doc.setPage(i);
          colorLinea(LINEA);
          doc.setLineWidth(0.25);
          doc.line(M, 281, R, 281);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          colorTexto([136, 136, 136]);
          doc.text(`${bodegaNombre} · Documento informativo, no tiene valor tributario`, M, 286);
          doc.text(`Página ${i} de ${paginas}`, R, 286, { align: 'right' });
        }

        return doc;
      };

      const descargarEstadoCuenta = async () => {
        if (!deudorSeleccionado) return;
        const doc = await generarPDFEstadoCuenta(deudorSeleccionado, boletasPendientesDeuda);
        doc.save(`Estado_Cuenta_${deudorSeleccionado.dni}.pdf`);
      };

      // Comparte el PDF directo a WhatsApp vía el share nativo del celular (sin API);
      // en desktop, donde no se puede adjuntar archivos así, descarga el PDF y abre
      // WhatsApp Web con el chat listo para adjuntarlo manualmente.
      const enviarEstadoCuentaWhatsApp = async (cliente) => {
        const doc = await generarPDFEstadoCuenta(cliente, boletasPendientesDeuda);
        const nombreArchivo = `Estado_Cuenta_${cliente.dni}.pdf`;
        const blob = doc.output('blob');

        try {
          const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' });
          if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
            await navigator.share({
              files: [archivo],
              title: 'Estado de Cuenta',
              text: `Estado de cuenta de ${cliente.nombre_completo} - ${bodegaNombre}`
            });
            return;
          }
        } catch (err) {
          if (err?.name === 'AbortError') return; // el cajero canceló el share
          console.warn('No se pudo compartir directamente, usando alternativa:', err.message);
        }

        doc.save(nombreArchivo);
        const soloNumeros = (cliente.telefono || '').replace(/\D/g, '');
        const telConCodigo = soloNumeros.length === 9 ? `51${soloNumeros}` : soloNumeros;
        const mensaje = encodeURIComponent(
          `Hola ${cliente.nombre_completo}, te comparto tu estado de cuenta de ${bodegaNombre}. Adjunta el PDF que se acaba de descargar. Total adeudado: S/ ${Number(cliente.saldo_actual).toFixed(2)}`
        );
        const urlWhatsapp = telConCodigo ? `https://wa.me/${telConCodigo}?text=${mensaje}` : `https://wa.me/?text=${mensaje}`;
        window.open(urlWhatsapp, '_blank');
        notificar('Se descargó el PDF. Adjúntalo manualmente en el chat de WhatsApp que se abrió.', 'info');
      };

      const procesarPagoDeudaCliente = async () => {
        if (!deudorSeleccionado) return;
        const abono = parseFloat(montoAbonoDeuda) || 0;
        if (abono <= 0) {
          notificar('Ingresa un monto de abono mayor a 0.', 'error');
          return;
        }

        const saldoAnterior = Number(deudorSeleccionado.saldo_actual) || 0;
        let nuevoSaldo = Math.max(0, +(saldoAnterior - abono).toFixed(2));

        if (sbClient && !esModoDemo) {
          try {
            // Ajuste atómico (RPC): si otro dispositivo también le está
            // cobrando/vendiendo a este mismo cliente en este instante, los
            // dos cambios se aplican uno tras otro sin pisarse.
            const { data: saldoRpc, error: errSaldo } = await sbClient.rpc('ajustar_saldo_cliente', {
              p_cliente_id: deudorSeleccionado.id,
              p_delta: -abono
            });

            if (errSaldo) {
              console.warn('Error al actualizar el saldo del cliente:', errSaldo);
              notificar(`No se pudo registrar el pago en el servidor (${errSaldo.message}). Avisa al soporte.`, 'error');
              return;
            }
            if (saldoRpc != null) nuevoSaldo = Number(saldoRpc);

            const { error: errPago } = await sbClient.from('pagos_credito').insert([{
              bodega_id: bodegaId,
              cliente_id: deudorSeleccionado.id,
              cajero_id: cajeroSeleccionado?.id || null,
              monto_pagado: abono,
              boletas_canceladas: `Saldo anterior: S/ ${saldoAnterior.toFixed(2)} → Saldo restante: S/ ${nuevoSaldo.toFixed(2)}`,
              fecha: new Date().toISOString()
            }]);
            if (errPago) console.warn('No se pudo registrar el historial de pago:', errPago.message);
          } catch (err) {
            console.error(err);
            notificar(`No se pudo registrar el pago: ${err.message}`, 'error');
            return;
          }
        }

        // Lanzar Confeti -- puramente decorativo, así que no se espera a que
        // cargue (no debe demorar el resto del flujo) y si falla se ignora.
        asegurarConfetti().then(() => confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })).catch(() => {});

        if (esModoDemo) {
          setClientesLista((prev) => prev.map((c) => (c.id === deudorSeleccionado.id ? { ...c, saldo_actual: nuevoSaldo } : c)));
          if (clienteActual?.id === deudorSeleccionado.id) {
            setClienteActual((prev) => (prev ? { ...prev, saldo_actual: nuevoSaldo } : prev));
          }
        }

        notificar(`¡Pago de S/ ${abono.toFixed(2)} registrado! Saldo restante: S/ ${nuevoSaldo.toFixed(2)}`, 'success');
        setMontoAbonoDeuda('');
        setBoletasDeudor([]);
        setDeudorSeleccionado(null);
        abrirModuloCobroDeudas();
      };

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
          notificar(`No se pudo subir la foto: ${err.message}`, 'error');
        } finally {
          setSubiendoFotoFilaIdx(null);
        }
      };

      // Con el modal de "Registrar Productos" abierto, Ctrl+V sube la
      // imagen copiada a la fila que se está llenando en ese momento.
      useEffect(() => {
        if (!modalInventarioInicial) return;
        const manejarPegado = (e) => {
          const fila = filasInventario[filaInventarioExpandidaIdx];
          if (!fila || fila.productoExistenteId) return;
          const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'));
          if (item) subirFotoFilaInventario(filaInventarioExpandidaIdx, item.getAsFile());
        };
        window.addEventListener('paste', manejarPegado);
        return () => window.removeEventListener('paste', manejarPegado);
      }, [modalInventarioInicial, filaInventarioExpandidaIdx, filasInventario]);

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

      const guardarInventarioInicial = async () => {
        const filasNuevas = filasInventario.filter((f) => !f.productoExistenteId && f.descripcion.trim() && f.precio_venta);
        const filasExistentes = filasInventario.filter((f) => f.productoExistenteId);

        if (filasNuevas.length === 0 && filasExistentes.length === 0) {
          notificar('Completa al menos un producto con descripción y precio de venta, o selecciona uno existente.', 'error');
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
                stock_actual: 0,
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
                // Mercadería", así que un producto nuevo arranca en 0.
                stock_actual: 0,
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
          cargarProductos();
          const partes = [];
          if (filasNuevas.length > 0) partes.push(`${filasNuevas.length} nuevo(s)`);
          if (filasExistentes.length > 0) partes.push(`${filasExistentes.length} actualizado(s)`);
          notificar(`¡Listo! ${partes.join(' y ')}.`, 'success');
        } catch (err) {
          notificar(`Error al guardar el inventario: ${err.message}`, 'error');
        } finally {
          setGuardandoInventario(false);
        }
      };

      // ==========================================
      // LEVANTAMIENTO DE INVENTARIO (conteo físico, escaneando de a uno)
      // ==========================================
      const buscarLevantamientoPorEan = () => {
        const codigo = levantamientoEan.trim();
        if (!codigo) return;
        const encontrado = buscarProductoPorCodigo(codigo);
        setLevantamientoResultado(encontrado || 'no-encontrado');
        setLevantamientoPacks('');
        setLevantamientoSueltas('');
      };

      // Busca automáticamente mientras se escribe/escanea, sin esperar Enter
      // ni el botón "Buscar" -- así el escáner de mano (que dispara Enter al
      // terminar) y la escritura manual funcionan igual de rápido.
      useEffect(() => {
        const codigo = levantamientoEan.trim();
        if (!codigo) { setLevantamientoResultado(null); return; }
        const timer = setTimeout(() => {
          const encontrado = buscarProductoPorCodigo(codigo);
          setLevantamientoResultado(encontrado || 'no-encontrado');
          setLevantamientoPacks('');
          setLevantamientoSueltas('');
        }, 200);
        return () => clearTimeout(timer);
      }, [levantamientoEan]);

      const cerrarResultadoLevantamiento = () => {
        setLevantamientoEan('');
        setLevantamientoResultado(null);
        setLevantamientoPacks('');
        setLevantamientoSueltas('');
      };

      const confirmarConteoLevantamiento = async () => {
        if (!levantamientoResultado || levantamientoResultado === 'no-encontrado') return;
        const { producto } = levantamientoResultado;
        const unidadesPorPack = Number(producto.unidades_por_pack) > 1 ? Number(producto.unidades_por_pack) : 1;
        const totalContado = (Number(levantamientoPacks) || 0) * unidadesPorPack + (Number(levantamientoSueltas) || 0);

        setGuardandoLevantamiento(true);
        try {
          let stockSistema = Number(producto.stock_actual) || 0;
          if (esModoDemo) {
            const diferencia = totalContado - stockSistema;
            if (catalogoDemoRef.current) {
              catalogoDemoRef.current = catalogoDemoRef.current.map((p) => (p.id === producto.id ? { ...p, stock_actual: totalContado } : p));
            }
          } else if (sbClient) {
            // Relee el stock justo antes de calcular la diferencia (igual que
            // en Toma de Inventario) -- por si hubo una venta o ajuste
            // mientras se estaba contando este producto.
            const { data: fresco, error: errFresco } = await sbClient
              .from('productos').select('stock_actual').eq('id', producto.id).maybeSingle();
            if (errFresco) throw errFresco;
            if (fresco) stockSistema = Number(fresco.stock_actual) || 0;

            const diferencia = totalContado - stockSistema;
            const { error: errInsert } = await sbClient.from('tomas_inventario').insert([{
              bodega_id: bodegaId,
              producto_id: producto.id,
              cajero_id: cajeroSeleccionado?.id || null,
              fecha: new Date().toISOString(),
              stock_sistema: stockSistema,
              stock_contado: totalContado,
              diferencia
            }]);
            if (errInsert) throw errInsert;

            if (diferencia !== 0) {
              const { error: errAjuste } = await sbClient.rpc('ajustar_stock', { p_producto_id: producto.id, p_delta: diferencia });
              if (errAjuste) {
                notificar(`Se guardó el conteo, pero no se pudo ajustar el stock (${errAjuste.message}).`, 'error');
                setGuardandoLevantamiento(false);
                return;
              }
            }
          }
          cargarProductos();
          notificar(`${producto.descripcion}: ${totalContado} unidades registradas.`, 'success');
          cerrarResultadoLevantamiento();
        } catch (err) {
          notificar(`Error al guardar el conteo: ${err.message}`, 'error');
        } finally {
          setGuardandoLevantamiento(false);
        }
      };

      // ==========================================
      // IMPORTAR DEL CATÁLOGO MAESTRO
      // ==========================================
      // Se reutiliza tanto al abrir "Importar del Catálogo Maestro" como al
      // abrir "Registrar Productos" (ahí sugiere categoría + foto mientras
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

      const abrirImportarMaestro = useCallback(() => {
        setModalImportarMaestro(true);
        setProductoMaestroSeleccionado(null);
        setBusquedaMaestroImport('');
        cargarCatalogoMaestroDisponible();
      }, [cargarCatalogoMaestroDisponible]);

      // "Registrar Productos" también se apoya en el catálogo maestro para
      // sugerir categoría y foto -- se carga apenas se abre el modal, sin
      // que el bodeguero tenga que ir a buscarlo a otro lado.
      useEffect(() => {
        if (modalInventarioInicial) cargarCatalogoMaestroDisponible();
      }, [modalInventarioInicial]);

      const seleccionarProductoMaestro = (item) => {
        setProductoMaestroSeleccionado(item);
        // El catálogo maestro ya no trae EAN (varía por proveedor/empaque);
        // si la bodega tiene el código real de este producto, lo escribe acá.
        setFormImportarMaestro({ precio_venta: '', precio_costo: '', stock_actual: '', cod_ean: '', unidad: 'UND' });
      };

      const importarProductoMaestro = async (e) => {
        e.preventDefault();
        if (!formImportarMaestro.precio_venta) {
          notificar('Ponle un precio de venta.', 'error');
          return;
        }
        setGuardandoImportMaestro(true);
        try {
          const payload = {
            bodega_id: bodegaId,
            descripcion: productoMaestroSeleccionado.descripcion,
            categoria: productoMaestroSeleccionado.categoria || 'General',
            foto_url: productoMaestroSeleccionado.foto_url || null,
            // Enlaza el producto a su ficha del catálogo maestro: si más
            // adelante se le agrega o cambia la foto ahí, se actualiza sola
            // acá también (ver el JOIN en cargarProductos).
            catalogo_maestro_id: productoMaestroSeleccionado.id,
            cod_ean: formImportarMaestro.cod_ean.trim() || generarCodigoInterno(),
            sku: generarSKU(productoMaestroSeleccionado.categoria),
            precio_costo: Number(formImportarMaestro.precio_costo) || 0,
            precio_venta: Number(formImportarMaestro.precio_venta) || 0,
            unidad: formImportarMaestro.unidad === 'KG' ? 'KG' : 'UND',
            stock_actual: formImportarMaestro.stock_actual === '' ? null : Number(formImportarMaestro.stock_actual),
            activo: true
          };
          if (esModoDemo) {
            if (!catalogoDemoRef.current) catalogoDemoRef.current = catalogoDemoInicial();
            const siguienteId = catalogoDemoRef.current.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
            catalogoDemoRef.current = [...catalogoDemoRef.current, { ...payload, id: String(siguienteId) }];
          } else if (sbClient) {
            const { error } = await sbClient.from('productos').insert([payload]);
            if (error) throw error;
          }
          notificar(`"${productoMaestroSeleccionado.descripcion}" agregado a tu inventario.`, 'success');
          cargarProductos(busqueda);
          setProductoMaestroSeleccionado(null);
        } catch (err) {
          notificar(`No se pudo importar: ${err.message}`, 'error');
        } finally {
          setGuardandoImportMaestro(false);
        }
      };

      const catalogoMaestroDisponibleFiltrado = catalogoMaestroDisponible.filter((p) =>
        !busquedaMaestroImport.trim() || p.descripcion.toLowerCase().includes(busquedaMaestroImport.trim().toLowerCase())
      );

      // ==========================================
      // EDITAR / DESACTIVAR PRODUCTO
      // ==========================================
      const abrirEdicionProducto = useCallback((prod) => {
        setProductoEditando(prod);
        setFormEditarProducto({
          ...datosFormularioDesdeProducto(prod),
          stock_actual: prod.stock_actual != null ? String(prod.stock_actual) : ''
        });
        setModalEditarProducto(true);
      }, []);

      const guardarEdicionProducto = async () => {
        if (!productoEditando || !formEditarProducto) return;
        if (!formEditarProducto.descripcion.trim() || !formEditarProducto.precio_venta) {
          notificar('Descripción y Precio de Venta son obligatorios.', 'error');
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
          notificar(`Error al guardar: ${err.message}`, 'error');
        } finally {
          setGuardandoEdicionProducto(false);
        }
      };

      const desactivarProducto = async () => {
        if (!productoEditando) return;
        const ok = await pedirConfirmacion({
          titulo: 'Quitar producto del catálogo',
          mensaje: `¿Quitar "${productoEditando.descripcion}" del catálogo? No se borra tu historial de ventas, solo deja de aparecer para vender.`,
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
          notificar('Producto quitado del catálogo.', 'info');
        } catch (err) {
          notificar(`Error al quitar el producto: ${err.message}`, 'error');
        }
      };

      // ==========================================
      // MERMAS (pérdidas de producto: vencido, roto, robado, etc.)
      // ==========================================
      const registrarMermaProducto = async () => {
        const prod = productos.find((p) => p.id === formMerma.productoId);
        const cant = Number(formMerma.cantidad) || 0;
        if (!prod || cant <= 0) {
          notificar('Selecciona un producto y una cantidad válida.', 'error');
          return;
        }
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
              motivo: formMerma.motivo,
              total_costo: totalCosto
            }]);
            if (error) throw error;

            // Descuenta la merma del stock, igual que una venta (ajuste atómico)
            const { error: errAjuste } = await sbClient.rpc('ajustar_stock', { p_producto_id: prod.id, p_delta: -cant });
            if (errAjuste) console.warn('Error al ajustar stock por merma:', errAjuste);
            errorAjusteStock = errAjuste;
          }
          setModalMerma(false);
          setFormMerma({ productoId: '', cantidad: '', motivo: 'Vencido' });
          cargarProductos(busqueda);
          if (errorAjusteStock) {
            notificar(`Merma registrada, pero el stock no se pudo ajustar (${errorAjusteStock.message}). Revísalo en "Ver Stock".`, 'error');
          } else {
            notificar(`Merma registrada: ${cant} x ${prod.descripcion} (S/ ${totalCosto.toFixed(2)}).`, 'info');
          }
        } catch (err) {
          notificar(`Error al registrar la merma: ${err.message}`, 'error');
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
              notificar(`Se guardó el conteo, pero ${fallosAjuste.length} producto(s) no se pudieron ajustar. Revísalos en "Ver Stock".`, 'error');
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
          notificar(`Error al guardar la toma de inventario: ${err.message}`, 'error');
        } finally {
          setGuardandoTomaInventario(false);
        }
      };

      // ==========================================
      // HISTORIAL DE TOMAS DE INVENTARIO (comparar cuadres a lo largo del tiempo)
      // ==========================================
      const cargarHistorialInventarioPorRango = async (desde, hasta) => {
        if (!sbClient || !bodegaId) return;
        setCargandoHistorialInventario(true);
        try {
          const inicio = new Date(`${desde}T00:00:00`);
          const fin = new Date(`${hasta}T23:59:59.999`);
          const { data, error } = await sbClient
            .from('tomas_inventario')
            .select('*, productos(descripcion, categoria)')
            .eq('bodega_id', bodegaId)
            .gte('fecha', inicio.toISOString())
            .lte('fecha', fin.toISOString())
            .order('fecha', { ascending: false })
            .limit(500);
          if (error) throw error;
          setHistorialInventario(data || []);
        } catch (err) {
          notificar(`No se pudo cargar el historial: ${err.message}`, 'error');
        } finally {
          setCargandoHistorialInventario(false);
        }
      };

      const abrirHistorialInventario = () => {
        const hoy = fechaHoyISO();
        const hace30dias = new Date();
        hace30dias.setDate(hace30dias.getDate() - 29);
        const desde = fechaISOLocal(hace30dias);
        setFechaInicioHistInventario(desde);
        setFechaFinHistInventario(hoy);
        setHistorialInventarioBusqueda('');
        setHistorialInventarioSoloDif(false);
        setModalHistorialInventario(true);
        cargarHistorialInventarioPorRango(desde, hoy);
      };

      // Agrupado por día (más nuevo primero) para poder leer el historial
      // como una comparación día a día: "el 12 cuadró, el 13 no, el 14 se
      // mantuvo" -- en vez de una lista plana sin contexto de fecha.
      const historialInventarioAgrupado = useMemo(() => {
        const t = historialInventarioBusqueda.trim().toLowerCase();
        const filtrado = historialInventario
          .filter((h) => !t || (h.productos?.descripcion || '').toLowerCase().includes(t))
          .filter((h) => !historialInventarioSoloDif || Number(h.diferencia) !== 0);
        const grupos = [];
        let grupoActual = null;
        filtrado.forEach((h) => {
          const dia = h.fecha.slice(0, 10);
          if (!grupoActual || grupoActual.dia !== dia) {
            grupoActual = { dia, items: [] };
            grupos.push(grupoActual);
          }
          grupoActual.items.push(h);
        });
        return grupos;
      }, [historialInventario, historialInventarioBusqueda, historialInventarioSoloDif]);

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
            setCompraItemTemp((prev) => ({ ...prev, productoId: nuevoProd.id }));
          }
          setNuevoProductoInlineCompra(null);
          notificar(`Producto "${payload.descripcion}" creado. Ya lo puedes agregar a la entrada.`, 'success');
        } catch (err) {
          notificar(`Error al crear el producto: ${err.message}`, 'error');
        } finally {
          setGuardandoProductoInlineCompra(false);
        }
      };

      const agregarItemEntradaMercaderia = () => {
        const prod = productos.find(p => p.id === compraItemTemp.productoId);
        const cant = Number(compraItemTemp.cantidad) || 0;
        if (!prod || !compraItemTemp.costoUnitario || cant <= 0) {
          notificar('Selecciona producto, cantidad y costo unitario.', 'error');
          return;
        }
        const unidadesPorPack = Number(prod.unidades_por_pack) || 1;
        const esPack = compraItemTemp.tipo === 'PACK' && unidadesPorPack > 1;
        const costo = Number(compraItemTemp.costoUnitario) || 0;
        // El proveedor a veces entrega en packs cerrados (ej: 10 packs de 6)
        // pero el stock siempre se guarda en unidades sueltas -- por eso se
        // convierte aquí, así el usuario solo escribe "10 packs" y no tiene
        // que calcular a mano que son 60 unidades.
        const cantidadStock = esPack ? cant * unidadesPorPack : cant;
        const costoPorUnidad = esPack ? costo / unidadesPorPack : costo;
        const sub = +(cant * costo).toFixed(2);

        setCompraItems(prev => [
          ...prev,
          {
            productoId: prod.id,
            descripcion: prod.descripcion,
            cantidad: cant,
            cantidadStock,
            esPack,
            unidadesPorPack,
            costoUnitario: costoPorUnidad,
            subtotal: sub
          }
        ]);
        setCompraItemTemp({ productoId: '', cantidad: '', costoUnitario: '', tipo: 'UNIDAD' });
      };

      const quitarItemEntradaMercaderia = (idx) => {
        setCompraItems(prev => prev.filter((_, i) => i !== idx));
      };

      // Cierra el modal descartando lo que no se haya confirmado -- si no se
      // limpia este estado, reabrir el modal muestra el proveedor y los
      // productos ya agregados de la vez anterior, y se pueden duplicar.
      const cerrarModalEntradaMercaderia = () => {
        setModalEntradaMercaderia(false);
        setCompraItems([]);
        setCompraCabecera({ proveedor: '', ruc: '', nroComprobante: '' });
        setCompraItemTemp({ productoId: '', cantidad: '', costoUnitario: '', tipo: 'UNIDAD' });
        setNuevoProductoInlineCompra(null);
      };

      const guardarEntradaMercaderia = async () => {
        if (compraItems.length === 0) {
          notificar('Agrega productos a la compra.', 'error');
          return;
        }
        const totalCompra = compraItems.reduce((acc, i) => acc + i.subtotal, 0);

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
              const { data: nuevoStock } = await sbClient.rpc('ajustar_stock', { p_producto_id: it.productoId, p_delta: unidadesStock });
              if (nuevoStock === null) {
                await sbClient.from('productos').update({ stock_actual: unidadesStock }).eq('id', it.productoId);
              }
              await sbClient.from('productos').update({ precio_costo: it.costoUnitario }).eq('id', it.productoId);
            }));
          }

          cerrarModalEntradaMercaderia();
          cargarProductos();
          notificar(`¡Entrada de mercadería por S/ ${totalCompra.toFixed(2)} registrada!`, 'success');
        } catch (err) {
          notificar(`Error al registrar la entrada: ${err.message}`, 'error');
        }
      };

      // ==========================================
      // HISTORIAL DE VENTAS DEL DÍA & ANULACIÓN
      // ==========================================
      const cargarHistorialPorRango = async (desde, hasta) => {
        setCargandoHistorial(true);
        const inicio = new Date(`${desde}T00:00:00`);
        const fin = new Date(`${hasta}T23:59:59.999`);

        if (esModoDemo) {
          // El catálogo/ventas del Modo Demo solo viven en memoria (ver
          // ventasDemoRef): filtrar y ordenar acá en vez de ir a Supabase.
          const enRango = ventasDemoRef.current
            .filter((v) => {
              const f = new Date(v.fecha_hora);
              return f >= inicio && f <= fin;
            })
            .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
          setVentasDelDia(enRango);
          setCargandoHistorial(false);
          return;
        }

        if (sbClient && bodegaId) {
          try {
            const { data, error } = await sbClient
              .from('ventas')
              .select('*, clientes(nombre_completo), ventas_detalle(*, productos(descripcion, unidad))')
              .eq('bodega_id', bodegaId)
              .gte('fecha_hora', inicio.toISOString())
              .lte('fecha_hora', fin.toISOString())
              .order('fecha_hora', { ascending: false });

            if (error) throw error;
            setVentasDelDia(data || []);
          } catch (err) {
            console.warn(err);
            notificar(`No se pudo cargar el historial: ${err.message}`, 'error');
          } finally {
            setCargandoHistorial(false);
          }
        } else {
          setCargandoHistorial(false);
        }
      };

      const abrirHistorialDelDia = () => {
        setModalHistorial(true);
        const hoy = fechaHoyISO();
        setFechaInicioHistorial(hoy);
        setFechaFinHistorial(hoy);
        setBusquedaBoletaHistorial('');
        cargarHistorialPorRango(hoy, hoy);
      };

      // ==========================================
      // DASHBOARD DE VENTAS (detallado, solo Administrador)
      // ==========================================
      const cargarDashboard = async (desde, hasta) => {
        setCargandoDashboard(true);
        setMesCalendario(null);
        const inicio = new Date(`${desde}T00:00:00`);
        const fin = new Date(`${hasta}T23:59:59.999`);

        if (esModoDemo) {
          // Mismo cálculo, pero leyendo del catálogo/ventas en memoria del
          // Modo Demo en vez de Supabase (ver ventasDemoRef).
          const enRango = ventasDemoRef.current.filter((v) => {
            const f = new Date(v.fecha_hora);
            return f >= inicio && f <= fin;
          });
          setVentasDashboard(enRango);

          const duracionMs = fin.getTime() - inicio.getTime();
          const finAnterior = new Date(inicio.getTime() - 1);
          const inicioAnterior = new Date(finAnterior.getTime() - duracionMs);
          const anterior = ventasDemoRef.current.filter((v) => {
            const f = new Date(v.fecha_hora);
            return f >= inicioAnterior && f <= finAnterior;
          });
          setVentasDashboardAnterior(anterior);

          setClientesDeuda(clientesLista.filter((c) => (Number(c.saldo_actual) || 0) > 0).sort((a, b) => (Number(b.saldo_actual) || 0) - (Number(a.saldo_actual) || 0)));
          setProveedoresDeudaDash([]);

          const anioActual = new Date().getFullYear();
          const inicioAnio = new Date(anioActual, 0, 1);
          const finAnio = new Date(anioActual, 11, 31, 23, 59, 59, 999);
          setVentasAnioDash(ventasDemoRef.current.filter((v) => {
            const f = new Date(v.fecha_hora);
            return f >= inicioAnio && f <= finAnio;
          }));

          setCargandoDashboard(false);
          return;
        }

        if (sbClient && bodegaId) {
          try {
            const { data, error } = await sbClient
              .from('ventas')
              .select('*, ventas_detalle(*)')
              .eq('bodega_id', bodegaId)
              .gte('fecha_hora', inicio.toISOString())
              .lte('fecha_hora', fin.toISOString())
              .order('fecha_hora', { ascending: true });
            if (error) throw error;
            setVentasDashboard(data || []);

            // Período anterior de igual duración, para comparar tendencia
            // (ej: "últimos 7 días" vs los 7 días previos a esos).
            const duracionMs = fin.getTime() - inicio.getTime();
            const finAnterior = new Date(inicio.getTime() - 1);
            const inicioAnterior = new Date(finAnterior.getTime() - duracionMs);
            const { data: dataAnterior, error: errAnterior } = await sbClient
              .from('ventas')
              .select('total_venta, utilidad_total, anulada')
              .eq('bodega_id', bodegaId)
              .gte('fecha_hora', inicioAnterior.toISOString())
              .lte('fecha_hora', finAnterior.toISOString());
            if (errAnterior) throw errAnterior;
            setVentasDashboardAnterior(dataAnterior || []);

            // Deuda de clientes (crédito): es un saldo vigente, no depende del
            // rango de fechas elegido -- se muestra el estado actual siempre.
            const { data: deudores, error: errDeudores } = await sbClient
              .from('clientes')
              .select('nombre_completo, dni, saldo_actual')
              .eq('bodega_id', bodegaId)
              .gt('saldo_actual', 0)
              .order('saldo_actual', { ascending: false });
            if (errDeudores) throw errDeudores;
            setClientesDeuda(deudores || []);

            // Deuda de la bodega con proveedores: también es un saldo
            // vigente, independiente del rango de fechas.
            const { data: proveedoresConDeuda, error: errProveedores } = await sbClient
              .from('proveedores')
              .select('nombre, saldo_actual')
              .eq('bodega_id', bodegaId)
              .gt('saldo_actual', 0)
              .order('saldo_actual', { ascending: false });
            if (errProveedores) console.warn(errProveedores);
            setProveedoresDeudaDash(proveedoresConDeuda || []);

            // Ventas del año calendario en curso, para "Ventas por Mes" --
            // independiente del rango de fechas elegido en el filtro rápido.
            const anioActual = new Date().getFullYear();
            const inicioAnio = new Date(anioActual, 0, 1).toISOString();
            const finAnio = new Date(anioActual, 11, 31, 23, 59, 59, 999).toISOString();
            const { data: ventasAnio, error: errAnio } = await sbClient
              .from('ventas')
              .select('fecha_hora, total_venta, anulada')
              .eq('bodega_id', bodegaId)
              .gte('fecha_hora', inicioAnio)
              .lte('fecha_hora', finAnio);
            if (errAnio) console.warn(errAnio);
            setVentasAnioDash(ventasAnio || []);
          } catch (err) {
            console.warn(err);
            notificar(`No se pudo cargar el dashboard: ${err.message}`, 'error');
          } finally {
            setCargandoDashboard(false);
          }
        } else {
          setCargandoDashboard(false);
        }
      };

      const abrirDashboard = () => {
        const hoy = fechaHoyISO();
        const hace6dias = new Date();
        hace6dias.setDate(hace6dias.getDate() - 6);
        const desde = fechaISOLocal(hace6dias);
        setFechaInicioDash(desde);
        setFechaFinDash(hoy);
        setModalDashboard(true);
        cargarDashboard(desde, hoy);
      };

      // Colores consistentes por medio de pago, usados en la dona y la leyenda.
      // Tonos del morado de la marca para los medios digitales y grises para el
      // resto, en vez de un color distinto por medio.
      const COLOR_MEDIO_PAGO = {
        EFECTIVO: '#3b0f8c',
        YAPE: '#6105dc',
        PLIN: '#a26df0',
        TARJETA: '#57534e',
        CREDITO: '#a8a29e',
        MIXTO: '#78716c',
        OTRO: '#d6d3d1'
      };

      const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

      const dashStats = useMemo(() => {
        const validas = ventasDashboard.filter(v => !v.anulada);
        const totalVenta = validas.reduce((a, c) => a + Number(c.total_venta), 0);
        const totalUtilidad = validas.reduce((a, c) => a + Number(c.utilidad_total || 0), 0);
        // utilidad_total ya es total_venta - costo, así que el costo sale despejando.
        const totalCosto = totalVenta - totalUtilidad;
        const numVentas = validas.length;
        const ticketPromedio = numVentas ? totalVenta / numVentas : 0;
        const margenPct = totalVenta ? (totalUtilidad / totalVenta) * 100 : 0;

        const porHora = Array.from({ length: 24 }, (_, h) => ({ hora: h, total: 0, cantidad: 0 }));
        validas.forEach(v => {
          const h = new Date(v.fecha_hora).getHours();
          porHora[h].total += Number(v.total_venta);
          porHora[h].cantidad += 1;
        });
        const maxHora = Math.max(1, ...porHora.map(h => h.total));
        const horaPico = porHora.reduce((mejor, h) => (h.total > mejor.total ? h : mejor), porHora[0]);

        const porDiaMap = {};
        validas.forEach(v => {
          // fecha_hora es un timestamp UTC (como lo devuelve Supabase) --
          // recortar los primeros 10 caracteres agrupa por el día en UTC, no
          // en el día local, mismo tipo de bug que fechaHoyISO() (ver arriba).
          const dia = fechaISOLocal(new Date(v.fecha_hora));
          porDiaMap[dia] = (porDiaMap[dia] || 0) + Number(v.total_venta);
        });
        const porDia = Object.entries(porDiaMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([fecha, total]) => ({ fecha, total }));
        const maxDia = Math.max(1, ...porDia.map(d => d.total));

        const porMedioMap = {};
        validas.forEach(v => {
          const medio = v.medio_pago || 'OTRO';
          porMedioMap[medio] = (porMedioMap[medio] || 0) + Number(v.total_venta);
        });
        const porMedio = Object.entries(porMedioMap)
          .map(([medio, total]) => ({ medio, total, pct: totalVenta ? (total / totalVenta) * 100 : 0 }))
          .sort((a, b) => b.total - a.total);

        const prodMap = {};
        validas.forEach(v => {
          (v.ventas_detalle || []).forEach(d => {
            const key = d.descripcion || 'Producto';
            if (!prodMap[key]) prodMap[key] = { descripcion: key, cantidad: 0, monto: 0, utilidad: 0 };
            prodMap[key].cantidad += Number(d.cantidad);
            prodMap[key].monto += Number(d.subtotal);
            prodMap[key].utilidad += Number(d.utilidad || 0);
          });
        });
        const topProductos = Object.values(prodMap).sort((a, b) => b.monto - a.monto).slice(0, 8);
        const maxProducto = Math.max(1, ...topProductos.map(p => p.monto));

        const numDeudores = clientesDeuda.length;
        const totalDeuda = clientesDeuda.reduce((a, c) => a + Number(c.saldo_actual || 0), 0);
        const maxDeuda = Math.max(1, ...clientesDeuda.map(c => Number(c.saldo_actual || 0)));

        const numProveedoresDeuda = proveedoresDeudaDash.length;
        const totalPorPagar = proveedoresDeudaDash.reduce((a, c) => a + Number(c.saldo_actual || 0), 0);
        const maxPorPagar = Math.max(1, ...proveedoresDeudaDash.map(c => Number(c.saldo_actual || 0)));

        // Comparación contra el período inmediatamente anterior de igual
        // duración (ej. "últimos 7 días" vs los 7 días previos a esos).
        const validasAnterior = ventasDashboardAnterior.filter(v => !v.anulada);
        const totalVentaAnterior = validasAnterior.reduce((a, c) => a + Number(c.total_venta), 0);
        const totalUtilidadAnterior = validasAnterior.reduce((a, c) => a + Number(c.utilidad_total || 0), 0);
        const calcularCambioPct = (actual, anterior) => {
          if (anterior === 0) return actual > 0 ? 100 : 0;
          return ((actual - anterior) / anterior) * 100;
        };
        const cambioVentaPct = calcularCambioPct(totalVenta, totalVentaAnterior);
        const cambioUtilidadPct = calcularCambioPct(totalUtilidad, totalUtilidadAnterior);

        // Ventas por mes del año en curso -- para la sección "Ventas por Mes",
        // independiente del rango de fechas del filtro rápido.
        const anioActual = new Date().getFullYear();
        const porMes = Array.from({ length: 12 }, (_, m) => ({ mes: m, total: 0, cantidad: 0 }));
        ventasAnioDash.filter(v => !v.anulada).forEach(v => {
          const m = new Date(v.fecha_hora).getMonth();
          porMes[m].total += Number(v.total_venta);
          porMes[m].cantidad += 1;
        });
        const maxMes = Math.max(1, ...porMes.map(m => m.total));
        const mesPico = porMes.reduce((mejor, m) => (m.total > mejor.total ? m : mejor), porMes[0]);
        const mesActualIdx = new Date().getMonth();
        // Promedio sobre los meses ya transcurridos del año (incluye el actual),
        // no sobre los 12 -- si no, diluiría el promedio con meses futuros vacíos.
        const mesesTranscurridos = porMes.slice(0, mesActualIdx + 1);
        const totalAnio = mesesTranscurridos.reduce((a, m) => a + m.total, 0);
        const promedioMensual = mesesTranscurridos.length ? totalAnio / mesesTranscurridos.length : 0;
        const mesAnteriorIdx = mesActualIdx - 1;
        const totalMesAnterior = mesAnteriorIdx >= 0 ? porMes[mesAnteriorIdx].total : 0;
        const cambioMesPct = calcularCambioPct(porMes[mesActualIdx].total, totalMesAnterior);

        return {
          totalVenta, totalUtilidad, totalCosto, numVentas, ticketPromedio, margenPct,
          porHora, maxHora, horaPico, porDia, maxDia, porMedio, topProductos, maxProducto,
          numDeudores, totalDeuda, maxDeuda,
          numProveedoresDeuda, totalPorPagar, maxPorPagar,
          cambioVentaPct, cambioUtilidadPct,
          // Sin ventas en el período anterior no hay base de comparación: el
          // porcentaje (que calcularCambioPct deja en 100) se oculta en pantalla.
          hayBaseVentaAnterior: totalVentaAnterior > 0,
          hayBaseUtilidadAnterior: totalUtilidadAnterior > 0,
          hayBaseMesAnterior: totalMesAnterior > 0,
          anioActual, porMes, maxMes, mesPico, mesActualIdx, totalAnio, promedioMensual, cambioMesPct
        };
      }, [ventasDashboard, clientesDeuda, ventasDashboardAnterior, proveedoresDeudaDash, ventasAnioDash]);

      // Exporta todo el Dashboard a un Excel real (.xlsx, varias hojas),
      // no un CSV -- cada sección del dashboard es su propia hoja.
      const exportarDashboardExcel = async () => {
        await asegurarXLSX();
        const libro = XLSX.utils.book_new();

        const hojaResumen = XLSX.utils.json_to_sheet([{
          'Desde': fechaInicioDash,
          'Hasta': fechaFinDash,
          'Venta Total': dashStats.totalVenta,
          'Utilidad': dashStats.totalUtilidad,
          'Costo': dashStats.totalCosto,
          'Margen %': +dashStats.margenPct.toFixed(1),
          'Ticket Promedio': +dashStats.ticketPromedio.toFixed(2),
          'N° de Ventas': dashStats.numVentas,
          'Cambio Venta vs Período Anterior %': +dashStats.cambioVentaPct.toFixed(1),
          'Cambio Utilidad vs Período Anterior %': +dashStats.cambioUtilidadPct.toFixed(1)
        }]);
        XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');

        const hojaHoras = XLSX.utils.json_to_sheet(
          dashStats.porHora.map((h) => ({ Hora: `${String(h.hora).padStart(2, '0')}:00`, 'N° Ventas': h.cantidad, Total: h.total }))
        );
        XLSX.utils.book_append_sheet(libro, hojaHoras, 'Ventas por Hora');

        const hojaDias = XLSX.utils.json_to_sheet(
          dashStats.porDia.map((d) => ({ Fecha: d.fecha, Total: d.total }))
        );
        XLSX.utils.book_append_sheet(libro, hojaDias, 'Ventas por Dia');

        const hojaMedios = XLSX.utils.json_to_sheet(
          dashStats.porMedio.map((m) => ({ 'Medio de Pago': m.medio, 'Porcentaje': +m.pct.toFixed(1), Total: m.total }))
        );
        XLSX.utils.book_append_sheet(libro, hojaMedios, 'Metodos de Pago');

        const hojaProductos = XLSX.utils.json_to_sheet(
          dashStats.topProductos.map((p) => ({ Producto: p.descripcion, Cantidad: p.cantidad, Monto: p.monto, Utilidad: p.utilidad }))
        );
        XLSX.utils.book_append_sheet(libro, hojaProductos, 'Top Productos');

        const hojaCobrar = XLSX.utils.json_to_sheet(
          clientesDeuda.length > 0
            ? clientesDeuda.map((c) => ({ Cliente: c.nombre_completo || c.dni, DNI: c.dni, 'Deuda': Number(c.saldo_actual) }))
            : [{ Cliente: 'Sin clientes con deuda pendiente', DNI: '', Deuda: 0 }]
        );
        XLSX.utils.book_append_sheet(libro, hojaCobrar, 'Cuentas por Cobrar');

        const hojaPagar = XLSX.utils.json_to_sheet(
          proveedoresDeudaDash.length > 0
            ? proveedoresDeudaDash.map((p) => ({ Proveedor: p.nombre, 'Por Pagar': Number(p.saldo_actual) }))
            : [{ Proveedor: 'Sin deuda con proveedores', 'Por Pagar': 0 }]
        );
        XLSX.utils.book_append_sheet(libro, hojaPagar, 'Cuentas por Pagar');

        // Detalle de cada venta del período: una fila POR PRODUCTO vendido
        // (no por boleta), para que Subtotal/Unidades sean del producto de
        // esa fila y no de la venta completa.
        const filasDetalle = [];
        ventasDashboard.forEach((v) => {
          const detalles = v.ventas_detalle || [];
          const base = {
            Boleta: v.nro_boleta,
            'Fecha y Hora': new Date(v.fecha_hora).toLocaleString('es-PE'),
            'Medio de Pago': v.medio_pago,
            Estado: v.anulada ? 'Anulada' : 'Válida'
          };
          if (detalles.length === 0) {
            filasDetalle.push({ ...base, Producto: '', Unidades: 0, 'Precio Unitario': 0, Subtotal: Number(v.total_venta), Utilidad: Number(v.utilidad_total || 0) });
            return;
          }
          detalles.forEach((d) => {
            filasDetalle.push({
              ...base,
              Producto: d.descripcion,
              Unidades: Number(d.cantidad),
              'Precio Unitario': Number(d.precio_unitario),
              Subtotal: Number(d.subtotal),
              Utilidad: Number(d.utilidad || 0)
            });
          });
        });
        const hojaDetalle = XLSX.utils.json_to_sheet(filasDetalle);
        XLSX.utils.book_append_sheet(libro, hojaDetalle, 'Detalle de Ventas');

        XLSX.writeFile(libro, `Dashboard_${fechaInicioDash}_a_${fechaFinDash}.xlsx`);
      };

      const exportarVentasExcel = () => {
        const filas = ventasDelDia.map((v) => ({
          Boleta: v.nro_boleta,
          Fecha: new Date(v.fecha_hora).toLocaleString('es-PE'),
          Cliente: v.clientes?.nombre_completo || 'Desconocido',
          'Medio de Pago': v.medio_pago,
          Total: Number(v.total_venta),
          Utilidad: Number(v.utilidad_total || 0),
          Estado: v.anulada ? 'Anulada' : 'Válida'
        }));
        exportarExcel(`Ventas_${fechaInicioHistorial}_a_${fechaFinHistorial}.xlsx`, filas, 'Ventas');
      };

      const anularVentaHoy = async (venta) => {
        if (venta.anulada) return;
        const ok = await pedirConfirmacion({
          titulo: 'Anular boleta',
          mensaje: `¿Estás seguro de ANULAR la boleta ${venta.nro_boleta}? Esta acción no se puede deshacer.`,
          textoBoton: 'Sí, anular',
          peligroso: true
        });
        if (!ok) return;

        const motivoIngresado = await pedirTexto({
          titulo: 'Motivo de la anulación',
          mensaje: 'Opcional.',
          placeholder: 'Ej: Cliente se arrepintió',
          textoBoton: 'Anular boleta'
        });
        const motivo = (motivoIngresado || '').trim() || 'Sin motivo especificado';

        try {
          if (esModoDemo) {
            // Todo en memoria, igual que el resto del Modo Demo: nada de esto
            // debe tocar Supabase de verdad.
            if (venta.medio_pago === 'CREDITO' && venta.cliente_id) {
              setClientesLista((prev) => prev.map((c) => (c.id === venta.cliente_id
                ? { ...c, saldo_actual: Math.max(0, (Number(c.saldo_actual) || 0) - Number(venta.total_venta)) }
                : c)));
              if (clienteActual?.id === venta.cliente_id) {
                setClienteActual((prev) => (prev ? { ...prev, saldo_actual: Math.max(0, (Number(prev.saldo_actual) || 0) - Number(venta.total_venta)) } : prev));
              }
            }
            if (catalogoDemoRef.current) {
              const repuestoPorId = new Map((venta.ventas_detalle || [])
                .filter((d) => d.producto_id)
                .map((d) => [d.producto_id, Number(d.unidades_stock ?? d.cantidad)]));
              catalogoDemoRef.current = catalogoDemoRef.current.map((p) => (repuestoPorId.has(p.id)
                ? { ...p, stock_actual: (Number(p.stock_actual) || 0) + repuestoPorId.get(p.id) }
                : p));
            }
            ventasDemoRef.current = ventasDemoRef.current.map((v) => (v.id === venta.id ? { ...v, anulada: true, motivo_anulacion: motivo } : v));
          } else if (sbClient) {
            // Si la venta era a crédito, revertir la deuda del cliente antes de anular
            // (ajuste atómico: no se pisa con otra venta/pago simultáneo al mismo cliente).
            if (venta.medio_pago === 'CREDITO' && venta.cliente_id) {
              const { error: errSaldo } = await sbClient.rpc('ajustar_saldo_cliente', {
                p_cliente_id: venta.cliente_id,
                p_delta: -Number(venta.total_venta)
              });
              if (errSaldo) throw new Error(`No se pudo revertir la deuda del cliente: ${errSaldo.message}`);
            }

            // Soft-delete: se marca como anulada en vez de borrarla, para conservar el historial
            const { error: errAnular } = await sbClient
              .from('ventas')
              .update({ anulada: true, motivo_anulacion: motivo })
              .eq('id', venta.id);
            if (errAnular) throw errAnular;

            // Reponer el stock de los productos de esta venta (ajuste atómico).
            // Usa unidades_stock (lo que de verdad se descontó, en unidades
            // base) en vez de "cantidad" -- si la línea era un pack, cantidad
            // son packs, no unidades. Si es una venta vieja sin esa columna
            // (previa a esta función), cae de vuelta a cantidad.
            await Promise.all((venta.ventas_detalle || [])
              .filter((d) => d.producto_id)
              .map((d) => sbClient.rpc('ajustar_stock', { p_producto_id: d.producto_id, p_delta: Number(d.unidades_stock ?? d.cantidad) }))
            );
          }
          setVentasDelDia(prev => prev.map(v => v.id === venta.id ? { ...v, anulada: true, motivo_anulacion: motivo } : v));
          cargarProductos(busqueda); // refresca el stock repuesto en el catálogo
          notificar(`Boleta ${venta.nro_boleta} anulada correctamente.`, 'info');
        } catch (err) {
          notificar(`Error al anular: ${err.message}`, 'error');
        }
      };

      // ==========================================
      // ARQUEO Y CIERRE DE CAJA
      // ==========================================
      // Efectivo que entró en el turno: ventas 100% en efectivo + la parte
      // en efectivo de las ventas Mixtas (ese dinero también entra
      // físicamente a la caja). Se reutiliza al abrir el modal (para
      // mostrar cuánto debería haber antes de contar) y al confirmar el
      // cierre (para el cálculo final, con los datos más frescos).
      const calcularVentasEfectivoTurno = async () => {
        if (!turnoActivo) return 0;
        const vts = esModoDemo
          ? ventasDemoRef.current.filter((v) => v.turno_caja_id === turnoActivo.id && ['EFECTIVO', 'MIXTO'].includes(v.medio_pago))
          : (sbClient ? (await sbClient
              .from('ventas')
              .select('total_venta, medio_pago, monto_efectivo')
              .eq('turno_caja_id', turnoActivo.id)
              .in('medio_pago', ['EFECTIVO', 'MIXTO'])).data : null);

        return (vts || []).reduce((acc, v) => {
          const efectivo = v.medio_pago === 'EFECTIVO' ? Number(v.total_venta) : Number(v.monto_efectivo) || 0;
          return acc + efectivo;
        }, 0);
      };

      // Solo informativo para el arqueo: cuánto se vendió en cada medio que
      // NO es efectivo, para que el cajero pueda cruzarlo contra su POS de
      // tarjeta, Yape, etc. -- no afecta el cálculo de "cuánto debería haber
      // en la caja física", que sigue siendo solo efectivo.
      const calcularDesgloseMedioPagoTurno = async () => {
        if (!turnoActivo) return null;
        const vts = esModoDemo
          ? ventasDemoRef.current.filter((v) => v.turno_caja_id === turnoActivo.id)
          : (sbClient ? (await sbClient
              .from('ventas')
              .select('total_venta, medio_pago, monto_otro')
              .eq('turno_caja_id', turnoActivo.id)).data : null);

        const desglose = { YAPE: 0, PLIN: 0, TARJETA: 0, CREDITO: 0, MIXTO_OTRO: 0 };
        (vts || []).forEach((v) => {
          if (v.medio_pago === 'MIXTO') {
            desglose.MIXTO_OTRO += Number(v.monto_otro) || 0;
          } else if (Object.prototype.hasOwnProperty.call(desglose, v.medio_pago)) {
            desglose[v.medio_pago] += Number(v.total_venta) || 0;
          }
        });
        return desglose;
      };

      // Abre el modal de cierre ya mostrando cuánto debería haber en caja,
      // para que el cajero sepa qué buscar antes de contar el efectivo.
      const abrirCierreCaja = async () => {
        setModalCierreCaja(true);
        setMontoConteoEfectivo('');
        setArqueoEsperado(null);
        if (!turnoActivo) return;
        const montoIni = Number(turnoActivo.monto_inicial) || 0;
        const [ventasEfectivo, desglose] = await Promise.all([
          calcularVentasEfectivoTurno(),
          calcularDesgloseMedioPagoTurno()
        ]);
        setArqueoEsperado({ inicio: montoIni, ventas: ventasEfectivo, esperado: +(montoIni + ventasEfectivo).toFixed(2), desglose });
      };

      const handleCierreConArqueo = async () => {
        if (!turnoActivo) return;
        const montoReal = parseFloat(montoConteoEfectivo) || 0;
        const montoIni = Number(turnoActivo.monto_inicial) || 0;
        const [ventasEfectivo, desglose] = await Promise.all([
          calcularVentasEfectivoTurno(),
          calcularDesgloseMedioPagoTurno()
        ]);
        const esperado = +(montoIni + ventasEfectivo).toFixed(2);
        const dif = +(montoReal - esperado).toFixed(2);

        if (sbClient && !esModoDemo) {
          try {
            const { error } = await sbClient
              .from('turnos_caja')
              .update({
                fecha_cierre: new Date().toISOString(),
                monto_final_real: montoReal,
                ventas_sistema: ventasEfectivo,
                diferencia: dif,
                estado: 'CERRADA'
              })
              .eq('id', turnoActivo.id);
            if (error) {
              console.warn('Error al cerrar el turno en la base de datos:', error);
              notificar(`El cierre se calculó bien, pero no se guardó en el servidor (${error.message}). Avisa al soporte.`, 'error');
            }
          } catch (err) {
            console.error(err);
          }
        }

        setResumenCierre({
          inicio: montoIni,
          ventas: ventasEfectivo,
          esperado,
          real: montoReal,
          diferencia: dif,
          desglose
        });

        setModalCierreCaja(false);
        setTurnoActivo(null);
        setMontoConteoEfectivo('');
      };

      // Historial de turnos ya cerrados (arqueos pasados).
      const cargarHistorialCierresPorRango = async (desde, hasta) => {
        if (!sbClient || !bodegaId) return;
        setCargandoCierres(true);
        try {
          const inicio = new Date(`${desde}T00:00:00`);
          const fin = new Date(`${hasta}T23:59:59.999`);
          const { data, error } = await sbClient
            .from('turnos_caja')
            .select('*, cajeros(nombre)')
            .eq('bodega_id', bodegaId)
            .not('fecha_cierre', 'is', null)
            .gte('fecha_cierre', inicio.toISOString())
            .lte('fecha_cierre', fin.toISOString())
            .order('fecha_cierre', { ascending: false })
            .limit(200);
          if (error) throw error;
          setCierresCaja(data || []);
        } catch (err) {
          notificar(`No se pudo cargar el historial de cierres: ${err.message}`, 'error');
        } finally {
          setCargandoCierres(false);
        }
      };

      const abrirHistorialCierres = () => {
        const hoy = fechaHoyISO();
        const hace30dias = new Date();
        hace30dias.setDate(hace30dias.getDate() - 29);
        const desde = fechaISOLocal(hace30dias);
        setFechaInicioCierres(desde);
        setFechaFinCierres(hoy);
        setModalHistorialCierres(true);
        cargarHistorialCierresPorRango(desde, hoy);
      };

      // Turno activo check -- cada cajero puede tener su propia caja
      // abierta (varias registradoras a la vez en la misma bodega). Como
      // todos los dispositivos entran con el mismo usuario/login (el
      // dueño), el cajero que se autoselecciona por DNI no necesariamente
      // es quien de verdad va a operar ESTE dispositivo -- así que, apenas
      // hay alguna caja abierta (sea "la mía" u otra), se muestra siempre
      // la misma lista para elegir con cuál trabajar, en vez de engancharse
      // en silencio a una de ellas.
      const verificarTurno = async (cajeroActual) => {
        if (!sbClient || !bodegaId || esModoDemo) return;
        try {
          const { data: abiertas } = await sbClient
            .from('turnos_caja')
            .select('*, cajeros(id, bodega_id, nombre, dni, rol, activo)')
            .eq('bodega_id', bodegaId)
            .is('fecha_cierre', null)
            .order('fecha_apertura', { ascending: false });

          if (abiertas && abiertas.length > 0) {
            // Se avisa una vez por combinación exacta de cajas abiertas
            // (guardado en sessionStorage) -- no en cada recarga de la
            // página, pero si la lista cambia (se abrió o cerró alguna)
            // se vuelve a avisar.
            const claveAviso = `pos_cajas_avisadas_${abiertas.map((t) => t.id).sort().join('-')}`;
            let yaAvisado = false;
            try { yaAvisado = sessionStorage.getItem(claveAviso) === '1'; } catch (e) { /* ignorar */ }
            if (!yaAvisado) {
              try { sessionStorage.setItem(claveAviso, '1'); } catch (e) { /* ignorar */ }
              // Se marca cuál es "la mía" (según el cajero autoseleccionado
              // por DNI) solo para destacarla en la lista -- no cambia qué
              // se puede hacer con ella, sigue siendo una opción más.
              setCajasAbiertasAviso(abiertas.map((t) => ({ ...t, es_propia: t.cajero_id === cajeroActual?.id })));
            }
          }
        } catch (err) {
          console.warn(err);
        }
      };

      // Este dispositivo se suma a una caja que ya abrió otro cajero: pasa
      // a operar con ese mismo cajero (no tiene sentido vender bajo otra
      // identidad en una caja que no es la suya).
      const unirseACaja = (turno) => {
        setTurnoActivo(turno);
        if (turno.cajeros) setCajeroSeleccionado(turno.cajeros);
        setCajasAbiertasAviso(null);
      };

      // En vez de sumarse a una caja existente, este dispositivo abre la
      // suya propia -- reutiliza el modal normal de "Abrir Turno" (ahí se
      // elige o se agrega el cajero).
      const abrirCajaNueva = () => {
        setCajasAbiertasAviso(null);
        setModalTurno(true);
      };

      // Abrir turno
      const handleAbrirTurno = async () => {
        const monto = parseFloat(montoApertura) || 0;
        const cajeroFinal = cajeroSeleccionado || listaCajeros[0];

        if (!cajeroFinal || !cajeroFinal.id) {
          notificar('Selecciona un cajero.', 'error');
          return;
        }

        // Modo Demo Local: la bodega no existe de verdad en Supabase, así
        // que ni siquiera se intenta la red -- se abre el turno directo en
        // memoria, igual que cualquier otro cambio de la demo.
        if (esModoDemo) {
          setTurnoActivo({ id: generarUUID(), bodega_id: bodegaId, cajero_id: cajeroFinal.id, monto_inicial: monto, estado: 'ABIERTA', fecha_apertura: new Date().toISOString() });
          setModalTurno(false);
          notificar(`Turno abierto con: ${cajeroFinal.nombre}`, 'success');
          return;
        }

        if (sbClient) {
          try {
            // Revisa primero si este MISMO cajero ya tiene una caja abierta
            // (ej. otro dispositivo suyo hace un instante) -- el índice
            // único en la base de datos (por bodega + cajero) es la
            // garantía real por si igual se cruzan. Esto ya no bloquea que
            // OTROS cajeros tengan su propia caja abierta en paralelo.
            const { data: yaAbierto } = await sbClient
              .from('turnos_caja')
              .select('*')
              .eq('bodega_id', bodegaId)
              .eq('cajero_id', cajeroFinal.id)
              .is('fecha_cierre', null)
              .maybeSingle();
            if (yaAbierto) {
              setTurnoActivo(yaAbierto);
              setModalTurno(false);
              notificar('Este cajero ya tenía una caja abierta (la abrió otro dispositivo); se usa esa.', 'info');
              return;
            }

            let { data, error } = await sbClient
              .from('turnos_caja')
              .insert([{
                bodega_id: bodegaId,
                cajero_id: cajeroFinal.id,
                monto_inicial: monto,
                fecha_apertura: new Date().toISOString(),
                ventas_sistema: 0.00,
                estado: 'ABIERTA'
              }])
              .select()
              .single();

            if (data) {
              setTurnoActivo(data);
              setModalTurno(false);
              notificar(`Turno abierto con: ${cajeroFinal.nombre}`, 'success');
              return;
            }

            // Código 23505 = violación del índice único "una sola caja
            // abierta a la vez por cajero": otro dispositivo la abrió para
            // este mismo cajero en el mismo instante. Se adopta esa caja
            // en vez de fallar.
            if (error?.code === '23505') {
              const { data: turnoDeOtro } = await sbClient
                .from('turnos_caja')
                .select('*')
                .eq('bodega_id', bodegaId)
                .eq('cajero_id', cajeroFinal.id)
                .is('fecha_cierre', null)
                .maybeSingle();
              if (turnoDeOtro) {
                setTurnoActivo(turnoDeOtro);
                setModalTurno(false);
                notificar('Este cajero ya tenía una caja abierta (la abrió otro dispositivo); se usa esa.', 'info');
                return;
              }
            }

            // Si falló por una razón real estando en línea (no por estar
            // offline), NO se sigue con un turno fantasma que solo existe en
            // este dispositivo -- las ventas de ese turno quedarían
            // referenciando un turno_caja_id que no existe en la base. Se
            // corta acá y se deja reintentar.
            if (error && enLinea) {
              console.warn('Error al abrir turno en la base de datos:', error);
              notificar(`No se pudo abrir el turno en el servidor (${error.message}). Intenta de nuevo.`, 'error');
              return;
            }
            if (error) {
              notificar('Sin conexión: el turno se abrió localmente y se sincroniza cuando vuelva el internet.', 'info');
            } else {
              notificar('Turno abierto.', 'info');
            }
          } catch (err) {
            console.warn(err);
            if (enLinea) {
              notificar('No se pudo abrir el turno (error de conexión con el servidor). Intenta de nuevo.', 'error');
              return;
            }
          }
        }

        setTurnoActivo({ id: generarUUID(), bodega_id: bodegaId, cajero_id: cajeroFinal.id, monto_inicial: monto, estado: 'ABIERTA', fecha_apertura: new Date().toISOString() });
        setModalTurno(false);
      };

      // Cobrar venta
      const handleCobrar = async () => {
        if (carrito.length === 0) {
          notificar('El carrito está vacío.', 'error');
          return;
        }
        if (medioPago === 'EFECTIVO' && montoRecibido && parseFloat(montoRecibido) < totalConDescuento) {
          notificar('Monto recibido insuficiente.', 'error');
          return;
        }

        // Validación de crédito: Saldo actual + Venta <= Límite
        if (medioPago === 'CREDITO') {
          if (!clienteActual || clienteActual.dni === '99999999') {
            notificar('Para vender a crédito debes seleccionar un cliente registrado.', 'error');
            setModalNuevoCliente(true);
            return;
          }
          const limiteCred = Number(clienteActual.limite_credito) || 0;
          // `clienteActual.saldo_actual` puede estar desactualizado si otro
          // dispositivo/cajero le vendió a este mismo cliente hace un
          // momento -- se vuelve a leer justo antes de cobrar para no
          // aprobar una venta contra un saldo viejo.
          let saldoAct = Number(clienteActual.saldo_actual) || 0;
          if (sbClient && !esModoDemo) {
            const { data: clienteFresco, error: errClienteFresco } = await sbClient
              .from('clientes')
              .select('saldo_actual')
              .eq('id', clienteActual.id)
              .maybeSingle();
            if (!errClienteFresco && clienteFresco) {
              saldoAct = Number(clienteFresco.saldo_actual) || 0;
            }
          }
          const nuevoSaldoProyectado = +(saldoAct + totalConDescuento).toFixed(2);
          if (nuevoSaldoProyectado > limiteCred) {
            const disponible = Math.max(0, +(limiteCred - saldoAct).toFixed(2));
            notificar(`Límite de crédito excedido. Disponible: S/ ${disponible.toFixed(2)} de S/ ${limiteCred.toFixed(2)}.`, 'error');
            return;
          }
        }

        // Validación de pago mixto: el efectivo entregado debe alcanzar para cubrir
        // lo que no se pagó con tarjeta/otro (el vuelto se calcula, no se exige exacto).
        let montoEfectivoMixto = 0;
        let montoOtroMixto = 0;
        if (medioPago === 'MIXTO') {
          montoOtroMixto = Math.min(parseFloat(montoMixtoOtro) || 0, totalConDescuento);
          montoEfectivoMixto = efectivoRequeridoMixto;
          const recibidoMixto = parseFloat(montoMixtoRecibido) || 0;
          if (montoEfectivoMixto > 0 && recibidoMixto < montoEfectivoMixto) {
            notificar(`Falta efectivo: debes recibir al menos S/ ${montoEfectivoMixto.toFixed(2)} en efectivo.`, 'error');
            return;
          }
        }

        setProcesandoVenta(true);
        const correlativo = `B001-${String(Date.now()).slice(-8)}`;

        let seVendioOffline = false;

        try {
          if (sbClient) {
            const idTurnoReal = turnoActivo?.id;
            const cajeroFinal = cajeroSeleccionado || listaCajeros[0];

            let idClienteReal = clienteActual?.id;
            const utilidadBruta = carrito.reduce((acc, item) => {
              const costoTotal = (Number(item.precioCosto) || 0) * Number(item.cantidad);
              return acc + (Number(item.subtotal) - costoTotal);
            }, 0);
            // El descuento sale directo de la ganancia: la utilidad real de la
            // venta es la bruta menos lo que se rebajó.
            const utilidadTotal = utilidadBruta - montoDescuento;
            const payloadVenta = {
              bodega_id: bodegaId,
              turno_caja_id: idTurnoReal || null,
              cajero_id: cajeroFinal?.id,
              cliente_id: idClienteReal || null,
              nro_boleta: correlativo,
              medio_pago: medioPago,
              total_venta: totalConDescuento,
              descuento_monto: montoDescuento,
              utilidad_total: +utilidadTotal.toFixed(2),
              monto_efectivo: medioPago === 'MIXTO' ? montoEfectivoMixto : 0,
              monto_otro: medioPago === 'MIXTO' ? montoOtroMixto : 0
            };

            // Un combo es UNA línea en el carrito pero se cobra/descuenta como
            // varias -- lineasCheckout ya viene "aplanada" a líneas reales
            // por producto (ver expandirLineaCarrito), así que todo lo de
            // abajo (detalle de venta, ajuste de stock) no necesita saber
            // que los combos existen.
            const lineasCheckout = carrito.flatMap(expandirLineaCarrito);

            const payloadDetallesSinVentaId = lineasCheckout.map(item => {
              const costoTotal = (Number(item.precioCosto) || 0) * Number(item.cantidad);
              return {
                bodega_id: bodegaId,
                producto_id: typeof item.productoId === 'string' && item.productoId.length > 10 ? item.productoId : null,
                combo_id: item.comboId || null,
                cod_ean: item.cod_ean || '',
                descripcion: item.descripcion || '',
                cantidad: Number(item.cantidad),
                precio_unitario: Number(item.precioUnitario),
                precio_costo: Number(item.precioCosto) || 0,
                subtotal: Number(item.subtotal),
                utilidad: +(Number(item.subtotal) - costoTotal).toFixed(2),
                // Unidades base descontadas de stock por esta línea (si se
                // vendió por pack, son más que "cantidad"). Se guarda tal
                // cual para poder revertirlo bien al anular, aunque después
                // cambie la configuración de pack del producto.
                unidades_stock: Number(item.unidadesStock || item.cantidad)
              };
            });

            const ajustesStock = lineasCheckout
              .filter(item => typeof item.productoId === 'string' && item.productoId.length > 10)
              .map(item => ({ productoId: item.productoId, delta: -Number(item.unidadesStock || item.cantidad) }));

            if (esModoDemo) {
              // ------------------------------------------------------------
              // MODO DEMO LOCAL: la bodega no existe de verdad en Supabase,
              // así que no se intenta la red -- se aplica todo en memoria
              // (catálogo demo, cliente, y el registro de la venta para que
              // el arqueo de "Cerrar Caja" la pueda contar).
              // ------------------------------------------------------------
              ventasDemoRef.current = [...ventasDemoRef.current, {
                id: `demo-${Date.now()}`,
                fecha_hora: new Date().toISOString(),
                nro_boleta: correlativo,
                turno_caja_id: idTurnoReal || null,
                cliente_id: idClienteReal || null,
                clientes: clienteActual ? { nombre_completo: clienteActual.nombre_completo } : null,
                medio_pago: medioPago,
                total_venta: totalConDescuento,
                descuento_monto: montoDescuento,
                utilidad_total: +utilidadTotal.toFixed(2),
                anulada: false,
                monto_efectivo: payloadVenta.monto_efectivo,
                monto_otro: payloadVenta.monto_otro,
                // A diferencia de payloadDetallesSinVentaId (que solo manda a
                // Supabase producto_id cuando es un uuid real, de más de 10
                // caracteres), acá se conserva el id del catálogo demo tal
                // cual -- si no, anular la boleta después no podría ubicar
                // qué producto reponer en catalogoDemoRef.
                ventas_detalle: lineasCheckout.map((item) => ({
                  producto_id: item.productoId,
                  descripcion: item.descripcion || '',
                  cantidad: Number(item.cantidad),
                  precio_costo: Number(item.precioCosto) || 0,
                  subtotal: Number(item.subtotal),
                  utilidad: +(Number(item.subtotal) - (Number(item.precioCosto) || 0) * Number(item.cantidad)).toFixed(2),
                  unidades_stock: Number(item.unidadesStock || item.cantidad),
                  productos: { descripcion: item.descripcion, unidad: null }
                }))
              }];

              if (catalogoDemoRef.current) {
                // Acumula por producto en vez de un Map 1:1 -- una misma línea
                // aplanada puede repetir productoId si, por ejemplo, un
                // producto está suelto en el carrito Y dentro de un combo.
                const cantidadesPorId = new Map();
                ajustesStock.forEach((a) => cantidadesPorId.set(a.productoId, (cantidadesPorId.get(a.productoId) || 0) + (-a.delta)));
                catalogoDemoRef.current = catalogoDemoRef.current.map((p) => (cantidadesPorId.has(p.id)
                  ? { ...p, stock_actual: Math.max(0, (Number(p.stock_actual) || 0) - cantidadesPorId.get(p.id)) }
                  : p));
              }

              if (medioPago === 'CREDITO' && idClienteReal) {
                const saldoActDemo = Number(clienteActual.saldo_actual) || 0;
                const nuevoSaldo = +(saldoActDemo + totalConDescuento).toFixed(2);
                setClienteActual(prev => (prev ? { ...prev, saldo_actual: nuevoSaldo } : prev));
                setClientesLista(prev => prev.map(c => (c.id === idClienteReal ? { ...c, saldo_actual: nuevoSaldo } : c)));
              }
            } else if (!enLinea) {
              // ------------------------------------------------------------
              // MODO OFFLINE: no se puede hablar con Supabase ahora mismo.
              // Se guarda la venta en una cola local (con su hora real) y se
              // aplican sus efectos de inmediato en pantalla (stock, deuda
              // del cliente); todo se sube solo apenas vuelva la conexión.
              // ------------------------------------------------------------
              seVendioOffline = true;
              payloadVenta.fecha_hora = new Date().toISOString();

              const pendiente = {
                idLocal: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                payloadVenta,
                payloadDetalles: payloadDetallesSinVentaId,
                credito: medioPago === 'CREDITO' && idClienteReal ? { clienteId: idClienteReal, monto: totalConDescuento } : null,
                ajustesStock
              };
              guardarVentasPendientesLS([...ventasPendientesSync, pendiente]);

              // Refleja el descuento de stock en el catálogo ya mismo (la
              // cifra real de la base de datos se corrige sola al sincronizar).
              // Usa ajustesStock (ya aplanado por producto, combos incluidos)
              // en vez de buscar en carrito directo -- ahí una línea de combo
              // no tiene productoId propio.
              setProductos(prev => prev.map(p => {
                const adj = ajustesStock.find(a => a.productoId === p.id);
                if (!adj || p.stock_actual === null || p.stock_actual === undefined) return p;
                return { ...p, stock_actual: Math.max(0, Number(p.stock_actual) + adj.delta) };
              }));

              if (medioPago === 'CREDITO' && idClienteReal) {
                const saldoAct = Number(clienteActual.saldo_actual) || 0;
                setClienteActual(prev => (prev ? { ...prev, saldo_actual: +(saldoAct + totalConDescuento).toFixed(2) } : prev));
              }
            } else {
              const { data: vCreada, error: vErr } = await sbClient
                .from('ventas')
                .insert([payloadVenta])
                .select()
                .single();

              if (vErr) throw vErr;

              const payloadDetalles = payloadDetallesSinVentaId.map(d => ({ ...d, venta_id: vCreada.id }));
              const { error: detErr } = await sbClient.from('ventas_detalle').insert(payloadDetalles);
              if (detErr) {
                console.error('Error al guardar el detalle de la venta:', detErr);
                notificar(`Venta registrada, pero el detalle de productos no se guardó: ${detErr.message}`, 'error');
              }

              // Si es crédito, actualizar saldo (ajuste atómico: no se pisa
              // con otra venta/pago simultáneo al mismo cliente).
              if (medioPago === 'CREDITO' && idClienteReal) {
                const { error: errSaldoCredito } = await sbClient.rpc('ajustar_saldo_cliente', {
                  p_cliente_id: idClienteReal,
                  p_delta: totalConDescuento
                });
                if (errSaldoCredito) {
                  console.warn('Error al actualizar la deuda del cliente:', errSaldoCredito);
                  notificar(`Venta registrada, pero no se pudo actualizar la deuda del cliente (${errSaldoCredito.message}). Avisa al soporte.`, 'error');
                }
              }

              // Descontar el stock vendido de cada producto real (no de catálogo de demo).
              // Se usa la función ajustar_stock (ajuste atómico en la base de
              // datos) en vez de leer y luego escribir desde aquí, para que
              // dos cajeros vendiendo el mismo producto a la vez no se pisen.
              // La venta ya se cobró y no tiene vuelta atrás en este punto,
              // así que un error acá no debe bloquear la boleta -- pero
              // tampoco debe pasar callado: si algo falla, se avisa para que
              // el stock se pueda corregir a mano.
              const resultadosAjusteStock = await Promise.all(ajustesStock.map((adj) =>
                sbClient.rpc('ajustar_stock', { p_producto_id: adj.productoId, p_delta: adj.delta })
              ));
              const fallosAjusteStock = resultadosAjusteStock.filter((r) => r.error);
              if (fallosAjusteStock.length > 0) {
                console.warn('Error al ajustar stock de la venta:', fallosAjusteStock);
                notificar(`Venta registrada, pero el stock de ${fallosAjusteStock.length} producto(s) no se pudo actualizar. Revísalo en "Ver Stock".`, 'error');
              }
            }
          }

          // Recién acá se cierran de verdad los pedidos de "Pedidos por
          // retirar" que se habían cargado a este carrito (ver
          // cargarPedidoDesdeRetirar): la venta ya se cobró y no tiene
          // vuelta atrás, así que ahora sí corresponde borrar el pedido de
          // pedidos_delivery y marcar su seguimiento como retirado. Es
          // best-effort -- si falla, no debe tumbar la boleta ya cobrada.
          if (sbClient && !esModoDemo && pedidosCargadosAlCarrito.length > 0) {
            const vinculados = pedidosCargadosAlCarrito;
            Promise.all(vinculados.map(async (p) => {
              try {
                await sbClient.from('pedidos_delivery').delete().eq('codigo_corto', p.codigoCorto);
                await sbClient.rpc('marcar_pedido_retirado', { p_codigo_corto: p.codigoCorto });
              } catch (err) {
                console.warn('No se pudo cerrar el seguimiento del pedido', p.codigoCorto, err);
              }
            })).then(() => {
              setPedidosRetirar((prev) =>
                prev.map((x) => (vinculados.some((v) => v.id === x.id) ? { ...x, estado: 'retirado' } : x))
              );
            });
            setPedidosCargadosAlCarrito([]);
          }

          const resultado = {
            nro_boleta: correlativo,
            medio_pago: medioPago,
            total_venta: totalConDescuento,
            subtotal: totalVenta,
            descuento: montoDescuento,
            items: [...carrito],
            cliente: clienteActual?.nombre_completo || 'Desconocido',
            telefono: clienteActual?.telefono || '',
            cajero: cajeroSeleccionado?.nombre || usuarioActivo?.nombre || 'Cajero',
            fecha: new Date().toLocaleTimeString(),
            offline: seVendioOffline
          };

          setVentaCompletada(resultado);
          setCarrito([]);
          setDescuentoTipo(null);
          setDescuentoValor('');
          setMontoRecibido('');
          setMontoMixtoOtro('');
          setMontoMixtoRecibido('');
          setCampoTeclado(null);
          setMostrarPago(false);
          reiniciarClienteYMedioPago();
          // Cierra la hoja del carrito (mobile): que la venta exitosa vuelva
          // al catálogo en vez de dejar ver el carrito ya vacío detrás.
          setMostrarResumenMobile(false);
          if (enLinea || esModoDemo) cargarProductos(busqueda); // refresca el stock mostrado en el catálogo
          // No se usa notificar() aquí: el modal de "¡Venta Exitosa!" ya
          // muestra la boleta y el detalle, un toast encima sería redundante.
        } catch (err) {
          notificar(`Error al registrar venta: ${err.message}`, 'error');
        } finally {
          setProcesandoVenta(false);
        }
      };

      // Genera la boleta como PDF con formato de ticket angosto (80mm),
      // igual al que se usaría en una impresora térmica.
      const generarPDFBoleta = async (venta) => {
        await asegurarJsPDF();
        const { jsPDF } = window.jspdf;
        const items = venta.items || [];
        const alturaEstimada = 58 + items.length * 9 + (venta.descuento > 0 ? 10 : 0);
        const doc = new jsPDF({ unit: 'mm', format: [80, Math.max(100, alturaEstimada)] });
        let y = 8;

        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text(bodegaNombre, 40, y, { align: 'center' });
        y += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        doc.text(`Boleta: ${venta.nro_boleta}`, 40, y, { align: 'center' }); y += 4;
        doc.text(venta.fecha || new Date().toLocaleString('es-PE'), 40, y, { align: 'center' }); y += 4;
        doc.text(`Cliente: ${venta.cliente}`, 40, y, { align: 'center' }); y += 5;
        doc.line(4, y, 76, y); y += 5;

        items.forEach((it) => {
          doc.setFontSize(8);
          const lineas = doc.splitTextToSize(it.descripcion, 72);
          doc.text(lineas, 4, y);
          y += lineas.length * 3.6 + 1;
          doc.text(`${it.cantidad} ${it.unidad || 'UND'} x S/ ${Number(it.precioUnitario || 0).toFixed(2)}`, 4, y);
          doc.text(`S/ ${Number(it.subtotal).toFixed(2)}`, 76, y, { align: 'right' });
          y += 5;
        });

        doc.line(4, y, 76, y); y += 5;

        if (venta.descuento > 0) {
          doc.text('Subtotal:', 4, y); doc.text(`S/ ${venta.subtotal.toFixed(2)}`, 76, y, { align: 'right' }); y += 4;
          doc.text('Descuento:', 4, y); doc.text(`-S/ ${venta.descuento.toFixed(2)}`, 76, y, { align: 'right' }); y += 5;
        }

        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text('TOTAL:', 4, y);
        doc.text(`S/ ${venta.total_venta.toFixed(2)}`, 76, y, { align: 'right' });
        y += 6;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        doc.text(`Pago: ${venta.medio_pago}`, 4, y);
        y += 6;
        doc.line(4, y, 76, y); y += 5;

        doc.setFontSize(7);
        const disclaimer = doc.splitTextToSize(
          'Documento sin valor tributario. No válido como comprobante de pago ante SUNAT. Solo informativo.',
          72
        );
        doc.text(disclaimer, 40, y, { align: 'center' });
        y += disclaimer.length * 3.2 + 4;

        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);
        doc.text('¡Gracias por su compra!', 40, y, { align: 'center' });

        return doc;
      };

      // Comparte la boleta en PDF por WhatsApp vía el share nativo del
      // celular (adjunta el archivo directo); en desktop, donde no se puede
      // adjuntar así, descarga el PDF y abre WhatsApp Web con el chat listo
      // para adjuntarlo manualmente.
      const enviarBoletaWhatsApp = async (venta) => {
        const doc = await generarPDFBoleta(venta);
        const nombreArchivo = `Boleta_${venta.nro_boleta}.pdf`;
        const blob = doc.output('blob');

        try {
          const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' });
          if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
            await navigator.share({
              files: [archivo],
              title: 'Boleta de venta',
              text: `Boleta ${venta.nro_boleta} - ${bodegaNombre}`
            });
            return;
          }
        } catch (err) {
          if (err?.name === 'AbortError') return; // el cajero canceló el share
          console.warn('No se pudo compartir directamente, usando alternativa:', err.message);
        }

        doc.save(nombreArchivo);
        const soloNumeros = (venta.telefono || '').replace(/\D/g, '');
        const telConCodigo = soloNumeros.length === 9 ? `51${soloNumeros}` : soloNumeros;
        const mensaje = encodeURIComponent(
          `Boleta ${venta.nro_boleta} - ${bodegaNombre}. Total: S/ ${venta.total_venta.toFixed(2)}. Adjunta el PDF que se acaba de descargar. ¡Gracias por tu compra!`
        );
        const url = telConCodigo ? `https://wa.me/${telConCodigo}?text=${mensaje}` : `https://wa.me/?text=${mensaje}`;
        window.open(url, '_blank');
        notificar('Se descargó el PDF de la boleta. Adjúntalo manualmente en el chat de WhatsApp que se abrió.', 'info');
      };

      // ==========================================
      // IMPRESIÓN DIRECTA POR BLUETOOTH (ticketera térmica)
      // ==========================================
      // Servicios GATT que usan la mayoría de ticketeras térmicas Bluetooth
      // BLE "genéricas" (las comunes de 58/80mm que se compran sueltas, no
      // de marca). Si la impresora usa un chip distinto puede que no
      // aparezca un canal de escritura -- es un protocolo no estandarizado.
      const SERVICIOS_IMPRESORA_BLUETOOTH = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'
      ];

      // Quita tildes/ñ: la mayoría de estas impresoras solo entienden la
      // página de código básica (ASCII/CP437) y muestran símbolos raros
      // con acentos si se les manda UTF-8 tal cual.
      const aTextoImprimible = (s) => (s || '').normalize('NFD').replace(/[^\x00-\x7F]/g, '');

      // Arma el ticket en comandos ESC/POS crudos (texto + alineación +
      // negrita), igual de angosto que el PDF/ticket impreso.
      const construirTicketEscPos = (venta) => {
        const bytes = [];
        const cmd = (...arr) => bytes.push(...arr);
        const texto = (s) => { for (const ch of aTextoImprimible(s)) bytes.push(ch.charCodeAt(0) & 0xFF); };
        const salto = (n = 1) => { for (let i = 0; i < n; i++) bytes.push(0x0A); };
        const ANCHO = 32; // caracteres por línea en una ticketera de 58mm

        cmd(0x1B, 0x40); // inicializar
        cmd(0x1B, 0x61, 0x01); // centrado
        cmd(0x1B, 0x45, 0x01); // negrita on
        texto(bodegaNombre); salto();
        cmd(0x1B, 0x45, 0x00); // negrita off
        texto(`Boleta: ${venta.nro_boleta}`); salto();
        texto(venta.fecha || new Date().toLocaleString('es-PE')); salto();
        texto(`Cliente: ${venta.cliente}`); salto();
        cmd(0x1B, 0x61, 0x00); // izquierda
        texto('-'.repeat(ANCHO)); salto();

        (venta.items || []).forEach((it) => {
          texto(it.descripcion); salto();
          const izq = `${it.cantidad} ${it.unidad || 'UND'} x ${Number(it.precioUnitario || 0).toFixed(2)}`;
          const der = `S/ ${Number(it.subtotal).toFixed(2)}`;
          const espacios = Math.max(1, ANCHO - izq.length - der.length);
          texto(izq + ' '.repeat(espacios) + der); salto();
        });

        texto('-'.repeat(ANCHO)); salto();
        if (venta.descuento > 0) {
          texto(`Subtotal:${' '.repeat(Math.max(1, ANCHO - 9 - 12))}S/ ${venta.subtotal.toFixed(2)}`); salto();
          texto(`Descuento:${' '.repeat(Math.max(1, ANCHO - 10 - 12))}-S/ ${venta.descuento.toFixed(2)}`); salto();
        }
        cmd(0x1B, 0x45, 0x01);
        texto(`TOTAL: S/ ${venta.total_venta.toFixed(2)}`); salto();
        cmd(0x1B, 0x45, 0x00);
        texto(`Pago: ${venta.medio_pago}`); salto(2);

        cmd(0x1B, 0x61, 0x01);
        texto('Documento sin valor tributario.'); salto();
        texto('Solo informativo.'); salto();
        texto('Gracias por su compra!'); salto(4);

        return new Uint8Array(bytes);
      };

      const imprimirBoletaBluetooth = async (venta) => {
        if (!navigator.bluetooth) {
          notificar('Este navegador no soporta impresión Bluetooth. Usa Chrome en Android o en una PC con Bluetooth.', 'error');
          return;
        }
        try {
          const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: SERVICIOS_IMPRESORA_BLUETOOTH
          });
          const server = await device.gatt.connect();
          const servicios = await server.getPrimaryServices();

          let caracteristica = null;
          for (const servicio of servicios) {
            const chars = await servicio.getCharacteristics();
            caracteristica = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse) || caracteristica;
            if (caracteristica) break;
          }
          if (!caracteristica) {
            notificar('No se encontró un canal de impresión en ese dispositivo. Puede que no sea compatible.', 'error');
            return;
          }

          const datos = construirTicketEscPos(venta);
          const TAMANO_BLOQUE = 20; // BLE suele limitar el tamaño por escritura
          for (let i = 0; i < datos.length; i += TAMANO_BLOQUE) {
            const bloque = datos.slice(i, i + TAMANO_BLOQUE);
            if (caracteristica.properties.writeWithoutResponse) {
              await caracteristica.writeValueWithoutResponse(bloque);
            } else {
              await caracteristica.writeValue(bloque);
            }
            await new Promise((r) => setTimeout(r, 30));
          }
          notificar('Boleta enviada a la impresora Bluetooth.', 'success');
        } catch (err) {
          if (err?.name === 'NotFoundError') return; // el cajero canceló la selección
          console.warn(err);
          notificar(`No se pudo imprimir por Bluetooth: ${err.message}`, 'error');
        }
      };

      // Nota: /registro (alta pública de bodega vía pago) ya no vive acá --
      // es su propio archivo liviano (registro.html) para no obligar a
      // cargar y compilar los 500KB+ de este POS solo para mostrar el
      // formulario de alta. Ver vercel.json.

      // =========================================================================
      // VISTA 1: AUTH (LOGIN / REGISTRO)
      // =========================================================================
      if (verificandoSesion) {
        return (
          <div className="flex items-center justify-center min-h-screen bg-stone-50">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
      }

      // =========================================================================
      // VISTA: PANEL DE ADMINISTRADOR (super-admin, no depende de "sesion")
      // =========================================================================
      if (adminSesion) {
        return <PanelAdmin
          adminSesion={adminSesion}
          sbClient={sbClient}
          bodegasAdmin={bodegasAdmin}
          setBodegasAdmin={setBodegasAdmin}
          cargandoBodegasAdmin={cargandoBodegasAdmin}
          setCargandoBodegasAdmin={setCargandoBodegasAdmin}
          formNuevaBodega={formNuevaBodega}
          setFormNuevaBodega={setFormNuevaBodega}
          guardandoNuevaBodega={guardandoNuevaBodega}
          setGuardandoNuevaBodega={setGuardandoNuevaBodega}
          notificar={notificar}
          toast={toast}
          onCerrarSesion={async () => {
            try { await sbClient.auth.signOut(); } catch (err) { console.warn(err); }
            setAdminSesion(null);
            setBodegasAdmin([]);
          }}
        />;
      }

      if (!sesion) {
        return (
          <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row select-none">
            {toast.visible && (
              <div className={`fixed top-6 inset-x-4 md:inset-x-auto md:right-6 md:max-w-xs z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border-l-4 bg-white text-xs font-semibold ${toast.tipo === 'error' ? 'border-rose-500 text-rose-700' : 'border-emerald-500 text-emerald-700'}`}>
                <i className={`fa-solid ${toast.tipo === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-sm shrink-0`}></i>
                {toast.texto}
              </div>
            )}

            {/* Panel de marca */}
            <div
              className="login-brand-mesh relative overflow-hidden md:w-1/2 md:min-h-screen flex flex-col items-center justify-center px-6 pt-14 pb-10 md:py-16 shrink-0"
              style={{ animationDelay: `${kgSyncDelayRef.current}s, ${kgSyncDelayRef.current}s` }}
            >

              <img
                src="/logo-blanco.png"
                alt="Kaserita"
                className="relative w-52 md:w-64 h-auto mb-6"
                style={{ animation: 'auth-panel-in 0.5s ease' }}
              />

            </div>

            {/* Tarjeta de formulario */}
            <div className="relative flex-1 md:w-1/2 flex md:items-center justify-center md:px-5">
              <div
                className={`w-full md:max-w-md flex-1 md:flex-none bg-white rounded-t-[2.5rem] md:rounded-3xl shadow-2xl px-7 pt-9 pb-10 md:p-10 space-y-6 transition-all duration-700 ease-out ${revelarLogin ? 'opacity-100 translate-x-0' : 'opacity-0 md:translate-x-10'}`}
              >
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-black text-stone-900">{authTab === 'admin' ? 'Panel de Administrador' : '¡Bienvenido de nuevo!'}</h2>
                  <p className="text-xs text-stone-500">{authTab === 'admin' ? 'Ingresa con tu cuenta de administrador' : (mostrarAccesoPin ? 'Ingresa tus datos para continuar' : 'Ingresa con tu cuenta de Google para continuar')}</p>
                </div>

                {authTab === 'login' && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setCargandoAuth(true);
                  let esCuentaRecienReclamada = false;
                  try {
                    const dni = formLogin.dni.trim();
                    const pin = formLogin.pin.trim();
                    const email = emailAuthDesdeDni(dni);
                    const password = passwordAuthDesdePin(pin);

                    const { error: errSignIn } = await sbClient.auth.signInWithPassword({ email, password });

                    if (errSignIn) {
                      console.warn('[login] signIn falló:', errSignIn.status, errSignIn.message);
                      // Puede ser una cuenta que todavía no se migró al nuevo
                      // sistema de acceso (bodega creada antes de este cambio):
                      // se crea su cuenta real y, si el DNI+PIN coincide con lo
                      // que ya tenía guardado, se vincula automáticamente.
                      //
                      // Antes de crear esa cuenta, se valida que el DNI+PIN de
                      // verdad corresponda a una bodega sin reclamar -- si no,
                      // un PIN mal tecleado dejaría creada una cuenta de Auth
                      // "huérfana" con una contraseña equivocada, y como el
                      // correo (derivado del DNI) queda ocupado, ningún intento
                      // futuro -- ni con el PIN correcto -- podría volver a
                      // crearla ni iniciar sesión con ella nunca más.
                      const { data: puedeReclamar, error: errPuedeReclamar } = await sbClient.rpc('puede_reclamar_bodega', { p_dni: dni, p_pin: pin });
                      // Si la función todavía no existe (falta correr el SQL
                      // de esta mejora), no se bloquea el login: se sigue el
                      // flujo anterior en vez de dejar a todas las bodegas
                      // nuevas sin poder entrar mientras tanto.
                      const faltaFuncion = errPuedeReclamar && errPuedeReclamar.code === 'PGRST202';
                      if (errPuedeReclamar && !faltaFuncion) {
                        console.warn('[login] puede_reclamar_bodega:', errPuedeReclamar.message);
                        throw new Error('DNI o PIN incorrecto.');
                      }
                      if (!faltaFuncion && !puedeReclamar) {
                        console.warn('[login] puede_reclamar_bodega: DNI/PIN no coincide con ninguna bodega sin reclamar.');
                        throw new Error('DNI o PIN incorrecto.');
                      }

                      const { error: errSignUp } = await sbClient.auth.signUp({ email, password });
                      if (errSignUp) {
                        console.warn('[login] signUp falló:', errSignUp.status, errSignUp.message);
                        throw new Error('DNI o PIN incorrecto.');
                      }

                      const { data: bodegaReclamada, error: errReclamo } = await sbClient.rpc('reclamar_cuenta_bodega', { p_dni: dni, p_pin: pin });
                      if (errReclamo || !bodegaReclamada) {
                        console.warn('[login] reclamo falló:', errReclamo?.message, 'bodegaReclamada:', bodegaReclamada);
                        await sbClient.auth.signOut();
                        throw new Error('DNI o PIN incorrecto.');
                      }
                      esCuentaRecienReclamada = true;
                    }

                    const { data: { user } } = await sbClient.auth.getUser();
                    // Trae la bodega en el mismo viaje (embed) en vez de una
                    // segunda consulta secuencial después.
                    const { data: usuarioConBodega, error: errUsuario } = await sbClient.from('usuarios').select('*, bodegas(*)').eq('auth_id', user.id).single();
                    if (errUsuario || !usuarioConBodega) throw new Error('No se pudo cargar tu cuenta. Intenta de nuevo.');
                    const { bodegas: bodega, ...usuario } = usuarioConBodega;

                    // Primer login de verdad de una bodega creada por el admin
                    // (o de una cuenta vieja migrándose): recién ahora
                    // mi_bodega_id() resuelve para este usuario, así que se
                    // pueden crear su fila de cajero propio y su cliente
                    // "Desconocido" por defecto -- antes el admin no podía
                    // hacerlo (esas tablas están scoped a mi_bodega_id(), que
                    // para el admin da null porque no pertenece a la bodega).
                    if (esCuentaRecienReclamada) {
                      try {
                        await sbClient.from('cajeros').insert([{ bodega_id: usuario.bodega_id, nombre: usuario.nombre, dni: usuario.dni, rol: usuario.rol, activo: true }]);
                        await sbClient.from('clientes').insert([{ bodega_id: usuario.bodega_id, dni: '99999999', nombre_completo: 'Desconocido', saldo_actual: 0 }]);
                      } catch (errSetup) {
                        console.warn('No se pudo terminar de preparar la bodega:', errSetup.message);
                      }
                    }

                    guardarSesion({ usuario, bodega: bodega || { id: usuario.bodega_id, nombre: 'Mi Bodega' } });
                    notificar(`¡Bienvenido ${usuario.nombre}!`, 'success');
                  } catch (err) {
                    notificar(err.message, 'error');
                  } finally {
                    setCargandoAuth(false);
                  }
                }} className="space-y-5">
                  {mostrarAccesoPin && (<>
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">DNI del Usuario</label>
                    <div className="relative mt-1">
                      <i className="fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm"></i>
                      <input
                        type="text"
                        required
                        maxLength={8}
                        placeholder="Ingresa los 8 dígitos"
                        value={formLogin.dni}
                        onChange={(e) => setFormLogin({ ...formLogin, dni: e.target.value })}
                        className="w-full bg-stone-100 border border-stone-200 focus:border-orange-500 outline-none rounded-xl pl-9 pr-3 py-2.5 text-sm text-stone-900 transition"
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-1">Ej: 45678901 (Cajero / Administrador)</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">PIN de Acceso</label>
                      <button
                        type="button"
                        onClick={() => notificar('Pídele a la persona a cargo (dueño/administrador) que te genere un PIN nuevo.', 'info')}
                        className="text-[10px] font-semibold text-orange-600 hover:text-orange-700"
                      >
                        ¿Olvidaste tu PIN?
                      </button>
                    </div>
                    <div className="relative mt-1">
                      <i className="fa-solid fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm"></i>
                      <input
                        type={mostrarPin ? 'text' : 'password'}
                        required
                        maxLength={PIN_MAX}
                        placeholder="••••"
                        value={formLogin.pin}
                        onChange={(e) => setFormLogin({ ...formLogin, pin: e.target.value })}
                        className="w-full bg-stone-100 border border-stone-200 focus:border-orange-500 outline-none rounded-xl pl-9 pr-9 py-2.5 text-sm text-stone-900 tracking-widest transition"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPin((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                        title={mostrarPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                      >
                        <i className={`fa-solid ${mostrarPin ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={cargandoAuth}
                    className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-black text-sm uppercase rounded-full transition shadow-lg shadow-stone-900/30 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {cargandoAuth ? 'Verificando...' : (<>Ingresar al Sistema <i className="fa-solid fa-arrow-right"></i></>)}
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-stone-200"></div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase">o</span>
                    <div className="flex-1 h-px bg-stone-200"></div>
                  </div>
                  </>)}
                  <button
                    type="button"
                    onClick={() => sbClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/pos' } })}
                    className="w-full py-3 border-2 border-stone-200 hover:border-stone-300 text-stone-700 font-bold text-sm rounded-full transition flex items-center justify-center gap-2.5"
                  >
                    <svg viewBox="0 0 48 48" style={{ width: 16, height: 16 }}>
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.8 4.2-17 10.3l-.7.4z"/>
                      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.6 35.3 27 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.9 39.5 16.4 44 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.5l6.6 5.4C41.6 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z"/>
                    </svg>
                    Continuar con Google
                  </button>
                </form>
              )}

              {authTab === 'admin' && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setCargandoAdminLogin(true);
                  try {
                    const email = formAdminLogin.email.trim();
                    const password = formAdminLogin.password;
                    const { error: errSignIn } = await sbClient.auth.signInWithPassword({ email, password });
                    if (errSignIn) throw new Error('Correo o contraseña incorrectos.');
                    const { data: { user } } = await sbClient.auth.getUser();
                    const { data: admin, error: errAdmin } = await sbClient.from('super_admins').select('*').eq('auth_id', user.id).maybeSingle();
                    if (errAdmin || !admin) {
                      await sbClient.auth.signOut();
                      throw new Error('Esta cuenta no tiene acceso de administrador.');
                    }
                    setAdminSesion(admin);
                    notificar(`Bienvenido, ${admin.nombre || 'Administrador'}.`, 'success');
                  } catch (err) {
                    notificar(err.message, 'error');
                  } finally {
                    setCargandoAdminLogin(false);
                  }
                }} className="space-y-5">
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">Correo</label>
                    <div className="relative mt-1">
                      <i className="fa-solid fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm"></i>
                      <input
                        type="email"
                        required
                        placeholder="tu@correo.com"
                        value={formAdminLogin.email}
                        onChange={(e) => setFormAdminLogin({ ...formAdminLogin, email: e.target.value })}
                        className="w-full bg-stone-100 border border-stone-200 focus:border-orange-500 outline-none rounded-xl pl-9 pr-3 py-2.5 text-sm text-stone-900 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">Contraseña</label>
                    <div className="relative mt-1">
                      <i className="fa-solid fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm"></i>
                      <input
                        type="password"
                        required
                        value={formAdminLogin.password}
                        onChange={(e) => setFormAdminLogin({ ...formAdminLogin, password: e.target.value })}
                        className="w-full bg-stone-100 border border-stone-200 focus:border-orange-500 outline-none rounded-xl pl-9 pr-3 py-2.5 text-sm text-stone-900 transition"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={cargandoAdminLogin}
                    className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-black text-sm uppercase rounded-full transition shadow-lg shadow-stone-900/30 disabled:opacity-50"
                  >
                    {cargandoAdminLogin ? 'Verificando...' : 'Ingresar'}
                  </button>
                </form>
              )}

              <div className="pt-2 border-t border-stone-100 flex items-center justify-center gap-2.5 text-xs">
                {authTab === 'login' ? (
                  <button type="button" onClick={() => setAuthTab('admin')} className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 font-semibold transition">
                    <i className="fa-solid fa-shield-halved mr-1"></i> Panel Administrador
                  </button>
                ) : (
                  <button type="button" onClick={() => setAuthTab('login')} className="text-stone-500 hover:text-orange-600 font-semibold">
                    <i className="fa-solid fa-arrow-left mr-1"></i> Volver
                  </button>
                )}
              </div>
              </div>
            </div>
          </div>
        );
      }

      // =========================================================================
      // VISTA: CUENTA VENCIDA -- la bodega existe y el login funcionó, pero
      // el administrador la desactivó o se venció su plazo. mi_bodega_id()
      // ya bloquea cualquier consulta real del lado del servidor; esto es
      // solo para que el dueño entienda por qué, en vez de ver un catálogo
      // vacío sin explicación.
      // =========================================================================
      if (cuentaVencida) {
        return (
          <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
            {toast.visible && (
              <div className={`fixed top-6 inset-x-4 md:inset-x-auto md:right-6 md:max-w-xs z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border-l-4 bg-white text-xs font-semibold ${toast.tipo === 'error' ? 'border-rose-500 text-rose-700' : 'border-emerald-500 text-emerald-700'}`}>
                <i className={`fa-solid ${toast.tipo === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-sm shrink-0`}></i>
                {toast.texto}
              </div>
            )}
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-rose-100 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-lock text-2xl text-rose-600"></i>
              </div>
              <div>
                <h2 className="text-lg font-black text-stone-900">Cuenta Vencida</h2>
                <p className="text-xs text-stone-500 mt-1">
                  El acceso de <strong>{bodegaNombre}</strong> está desactivado
                  {sesion.bodega.activa === false
                    ? ''
                    : sesion.bodega.activa_hasta
                    ? ` desde el ${new Date(`${sesion.bodega.activa_hasta}T00:00:00`).toLocaleDateString('es-PE')}`
                    : ''}.
                  Contacta al administrador para renovarlo.
                </p>
              </div>
              <button onClick={cerrarSesion} className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-xl">
                Cerrar Sesión
              </button>
            </div>
          </div>
        );
      }

      // =========================================================================
      // VISTA 2: POS INTERFACE COMPLETO
      // =========================================================================
      return (
        <div
          className={`flex h-screen text-stone-900 font-sans select-none overflow-hidden ${(!enLinea || ventasPendientesSync.length > 0) ? 'pt-7' : ''}`}
          style={{ background: 'radial-gradient(circle at 12% 8%, #F3E9FC 0%, transparent 42%), radial-gradient(circle at 48% 6%, #EEEAF9 0%, transparent 45%), radial-gradient(circle at 88% 10%, #F6E9FA 0%, transparent 45%), #F7F5FA' }}
        >
          {/* Toast */}
          {toast.visible && (
            <div className={`fixed top-[4.75rem] inset-x-4 md:top-4 md:inset-x-auto md:right-4 md:max-w-xs z-[100] pointer-events-none flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border-l-4 bg-white text-xs font-semibold ${toast.tipo === 'error' ? 'border-rose-500 text-rose-700' : 'border-emerald-500 text-emerald-700'}`}>
              <i className={`fa-solid ${toast.tipo === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-sm shrink-0`}></i>
              {toast.texto}
            </div>
          )}

          {/* Aviso de modo offline / sincronización pendiente */}
          {(!enLinea || ventasPendientesSync.length > 0) && (
            <div className={`fixed top-0 inset-x-0 z-[90] text-center text-xs font-semibold py-1.5 px-3 flex items-center justify-center gap-2 ${!enLinea ? 'bg-stone-900 text-white' : 'bg-amber-500 text-white'}`}>
              {!enLinea ? (
                <><i className="fa-solid fa-wifi-slash"></i> Sin conexión — las ventas se guardan y se suben solas al volver el internet{ventasPendientesSync.length > 0 ? ` (${ventasPendientesSync.length} pendiente${ventasPendientesSync.length === 1 ? '' : 's'})` : ''}.</>
              ) : sincronizandoVentas ? (
                <><i className="fa-solid fa-arrows-rotate fa-spin"></i> Sincronizando {ventasPendientesSync.length} venta{ventasPendientesSync.length === 1 ? '' : 's'} pendiente{ventasPendientesSync.length === 1 ? '' : 's'}...</>
              ) : (
                <>
                  <i className="fa-solid fa-triangle-exclamation"></i> {ventasPendientesSync.length} venta{ventasPendientesSync.length === 1 ? '' : 's'} sin sincronizar.
                  <button onClick={sincronizarVentasPendientes} className="underline font-bold">Reintentar ahora</button>
                </>
              )}
            </div>
          )}


          {/* Columna Central: Catálogo (Order Line) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="flex items-center justify-between mx-3 mt-3 px-2 md:px-3 py-2 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 px-2.5 bg-gradient-to-br from-[#7c1fe0] to-[#4d04b0] rounded-lg flex items-center justify-center shadow-lg shadow-[#4d04b0]/25 shrink-0">
                  <span className="text-white font-extrabold text-sm tracking-tight">Kaserita</span>
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm md:text-base font-bold text-stone-900 leading-tight truncate">{bodegaNombre}</h1>
                  <p className="text-xs text-stone-500 truncate flex items-center gap-1.5">
                    <i className="fa-solid fa-user text-xs"></i>
                    {cajeroSeleccionado?.nombre || usuarioActivo?.nombre}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {turnoActivo ? (
                  <button
                    onClick={abrirCierreCaja}
                    className="btn-noise hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-green-600 transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Turno Abierto
                  </button>
                ) : (
                  <button
                    onClick={() => setModalTurno(true)}
                    className="btn-noise hidden sm:inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-stone-800 transition"
                  >
                    Abrir Turno <span aria-hidden="true">→</span>
                  </button>
                )}
                <button
                  onClick={() => { setBusquedaMenu(''); setIndiceMenu(0); setMenuMas(true); }}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-stone-200 rounded-xl text-stone-700 hover:text-stone-900 shadow-sm transition"
                  title="Más opciones"
                >
                  <i className="fa-solid fa-bars"></i>
                </button>
              </div>
            </header>

            <div className="flex-1 flex flex-col overflow-hidden p-3 md:p-4">
              {/* Categorías: "Todos" es un único botón que abre un
                  desplegable con la lista completa (antes cada categoría era
                  su propia píldora y con 15 saturaba la fila); "Combos"
                  queda como pestaña aparte, tal cual estaba. La que
                  corresponde según el filtro activo se funde sin costura
                  con el panel de abajo (folder-tab-active, ver index.css). */}
              <div className="flex items-end gap-1.5 text-xs shrink-0 relative z-20">
                <div className="relative shrink-0">
                  <button
                    onClick={() => { setBusquedaCategoria(''); setMenuCategoriasAbierto((v) => !v); }}
                    className={`flex items-center gap-2 px-5 py-2.5 transition ${categoriaFiltro !== '__COMBOS__' ? 'folder-tab-active text-stone-900' : 'mb-2 rounded-full bg-white/50 text-stone-600 hover:bg-white/80 border border-stone-200'}`}
                  >
                    <span className="font-bold whitespace-nowrap">
                      {categoriaFiltro === '__COMBOS__' ? 'Todos' : categoriaFiltro}
                    </span>
                    <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${menuCategoriasAbierto ? 'rotate-180' : ''}`}></i>
                  </button>
                  {menuCategoriasAbierto && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setMenuCategoriasAbierto(false)}></div>
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white/80 backdrop-blur-2xl border border-white/90 rounded-3xl shadow-[0_24px_60px_-24px_rgba(60,20,120,0.28)] ring-1 ring-[#6105dc]/5 p-2 z-30">
                        <div className="relative mb-2">
                          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] text-stone-400"></i>
                          <input
                            type="text"
                            value={busquedaCategoria}
                            onChange={(e) => setBusquedaCategoria(e.target.value)}
                            placeholder="Buscar categoría"
                            className="w-full bg-white rounded-full pl-9 pr-3 py-2 text-[13px] text-stone-900 placeholder-stone-400 ring-1 ring-[#6105dc]/10 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                          />
                        </div>
                        <div
                          className="max-h-[340px] overflow-y-auto hide-scrollbar pb-5"
                          style={{ WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)', maskImage: 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)' }}
                        >
                          {(() => {
                            const q = busquedaCategoria.trim().toLowerCase();
                            const lista = q ? categorias.filter(cat => cat !== 'TODOS' && String(cat).toLowerCase().includes(q)) : categorias;
                            if (lista.length === 0) {
                              return <p className="text-xs text-stone-400 text-center py-4">Sin resultados</p>;
                            }
                            return lista.map(cat => {
                              const cantidad = cat === 'TODOS' ? productos.length : (conteoPorCategoria.get(cat) || 0);
                              const activo = categoriaFiltro === cat;
                              return (
                                <React.Fragment key={cat}>
                                  <button
                                    onClick={() => { setCategoriaFiltro(cat); setMenuCategoriasAbierto(false); }}
                                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-full text-left text-sm transition ${activo ? 'bg-[#ece0fd] text-[#4d04b0] font-bold' : 'text-stone-800 font-medium hover:bg-[#6105dc]/5'}`}
                                  >
                                    <span className="truncate">{cat}</span>
                                    <span className={`text-xs shrink-0 tabular-nums ${activo ? 'bg-white text-[#6105dc] font-semibold px-2 py-0.5 rounded-full' : 'text-stone-400'}`}>{cantidad}</span>
                                  </button>
                                  {cat === 'TODOS' && !q && <div className="h-px bg-[#6105dc]/10 mx-3.5 my-1.5"></div>}
                                </React.Fragment>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {combos.some(c => c.activo) && (
                  <button
                    onClick={() => setCategoriaFiltro('__COMBOS__')}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 transition ${categoriaFiltro === '__COMBOS__' ? 'folder-tab-active text-[#6105dc]' : 'mb-2 rounded-full bg-white/50 text-[#6105dc] hover:bg-white/80 border border-[#d6bdfa]'}`}
                  >
                    <i className="fa-solid fa-gift text-xs"></i>
                    <span className="font-bold whitespace-nowrap">Combos</span>
                    <span className="text-xs font-semibold text-[#6105dc]/70">
                      {combos.filter(c => c.activo).length}
                    </span>
                  </button>
                )}
              </div>

              {/* Panel blanco del catálogo: contador + buscador + grilla,
                  como el "catalogue-container" de la referencia -- conectado
                  sin costura a la pestaña activa de arriba. */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-b-2xl rounded-tr-2xl p-3 md:p-4 gap-3 -mt-px relative z-10">
                {/* Contador + Buscador */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden lg:flex items-baseline gap-1.5 shrink-0">
                    <span className="text-2xl font-black text-stone-900 tabular-nums">{productosFiltrados.length}</span>
                    <span className="text-xs font-semibold text-stone-400">Productos</span>
                  </div>
                  <div className="flex gap-2 flex-1 min-w-0">
                    <div className="relative flex-1">
                      <button
                        onClick={abrirEscanerParaVenta}
                        title="Escanear código de barras con la cámara"
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-stone-500 hover:text-[#6105dc] hover:bg-[#f4eefe] rounded-full transition"
                      >
                        <i className="fa-solid fa-barcode text-sm"></i>
                      </button>
                      <input
                        ref={inputBusquedaRef}
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        onKeyDown={handleKeyDownBusqueda}
                        placeholder="Escanear código o buscar producto..."
                        className="w-full bg-white border border-[#d6bdfa]/60 text-stone-900 placeholder-stone-500 text-sm rounded-full pl-12 pr-10 py-2.5 focus:outline-none focus:border-[#6105dc] focus:ring-4 focus:ring-[#6105dc]/10 transition"
                        autoFocus
                      />
                      {busqueda && (
                        <button
                          onClick={() => {
                            setBusqueda('');
                            cargarProductos('');
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-stone-500 hover:text-stone-800 rounded-full transition"
                        ><i className="fa-solid fa-xmark"></i></button>
                      )}
                    </div>
                    <button
                      onClick={() => cargarProductos(busqueda)}
                      className="hidden md:flex items-center justify-center w-10 h-10 shrink-0 bg-white hover:bg-[#f4eefe] text-stone-700 text-xs font-semibold rounded-full border border-[#d6bdfa]/60 transition"
                    >
                      <i className="fa-solid fa-magnifying-glass"></i>
                    </button>
                    <button
                      onClick={() => { setModalPedidosRetirar(true); cargarPedidosRetirar(); setMostrarResumenMobile(true); }}
                      title="Pedidos por retirar (clientes con cuenta)"
                      className="relative flex items-center justify-center w-10 h-10 shrink-0 bg-white hover:bg-[#f4eefe] text-stone-700 text-xs font-semibold rounded-full border border-[#d6bdfa]/60 transition"
                    >
                      <i className="fa-solid fa-bell-concierge"></i>
                      {pedidosPorRetirarPendientes > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center bg-rose-600 text-white text-[9px] font-bold rounded-full animate-pulse">
                          {pedidosPorRetirarPendientes > 9 ? '9+' : pedidosPorRetirarPendientes}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

              {/* Grilla de Productos */}
              {/* pb-24 en mobile: dejar espacio para que la última fila no
                  quede tapada por la barra flotante del carrito (fixed
                  bottom-3) ni pegada contra el borde de la pantalla. */}
              {/* pt-1.5 pl-1: margen para que el hover (sube 2px + sombra + anillo)
                  no se corte contra el borde del contenedor con scroll. */}
              <div className="flex-1 overflow-y-auto pt-1.5 pl-1 pr-1 pb-24 md:pb-6 hide-scrollbar">
                {categoriaFiltro === '__COMBOS__' ? (
                  combos.filter(c => c.activo).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-stone-500 text-center">
                      <p className="text-base font-semibold">No hay combos activos</p>
                      <p className="text-xs text-stone-400 mt-1">Créalos desde "Entradas → Combos".</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {combos.filter(c => c.activo).map((combo) => (
                        <button
                          key={combo.id}
                          onClick={() => agregarComboAlCarrito(combo)}
                          className={`text-left bg-white border rounded-2xl overflow-hidden shadow-sm hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 active:scale-[0.98] relative p-3 flex flex-col gap-1.5 ${
                            (cantidadEnCarritoPorCombo.get(combo.id) || 0) > 0 ? 'border-[#6105dc] ring-2 ring-[#6105dc]/40' : 'border-[#d6bdfa] hover:border-[#7c1fe0]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-9 h-9 rounded-xl bg-[#f4eefe] text-[#6105dc] flex items-center justify-center shrink-0">
                              <i className="fa-solid fa-gift"></i>
                            </span>
                            <h3 className="text-[13px] font-bold text-stone-900 line-clamp-2 leading-snug flex-1">{combo.nombre}</h3>
                          </div>
                          <p className="text-[10px] text-stone-500 line-clamp-2">
                            Incluye: {(combo.combos_items || []).map((ci) => `${ci.productos?.descripcion || '?'} x${ci.cantidad}`).join(', ')}
                          </p>
                          <div className="flex items-center justify-between mt-auto pt-1">
                            <span className="text-base font-black text-[#4d04b0] tabular-nums">S/ {Number(combo.precio_venta).toFixed(2)}</span>
                            {(cantidadEnCarritoPorCombo.get(combo.id) || 0) > 0 && (
                              <span className="text-[10px] font-bold text-white bg-[#6105dc] px-2 py-0.5 rounded-full">x{cantidadEnCarritoPorCombo.get(combo.id)}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                ) : cargandoProductos && productos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-stone-600 gap-2">
                    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs">Cargando productos...</p>
                  </div>
                ) : productos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-3">
                      <i className="fa-solid fa-boxes-stacked text-2xl text-amber-600"></i>
                    </div>
                    <p className="text-base font-bold text-stone-900">Aún no tienes productos registrados</p>
                    <p className="text-xs text-stone-500 mt-1 max-w-xs">
                      Antes de vender, registra el inventario de tu negocio: qué productos tienes, sus precios y si se venden por unidad o por peso.
                    </p>
                    <button
                      onClick={() => setModalInventarioInicial(true)}
                      className="mt-4 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-bold rounded-xl shadow-lg shadow-stone-900/25 flex items-center gap-2"
                    >
                      <i className="fa-solid fa-boxes-stacked"></i> Registrar Productos
                    </button>
                  </div>
                ) : productosFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-stone-500 text-center">
                    <p className="text-base font-semibold">No se encontraron productos</p>
                    <p className="text-xs text-stone-400 mt-1">Prueba con otra búsqueda o categoría.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {productosFiltrados.map((prod) => (
                      <ProductoCard
                        key={prod.id}
                        prod={prod}
                        esAdmin={esAdmin}
                        enCarrito={cantidadEnCarritoPorProducto.get(prod.id) || 0}
                        onSelect={handleClicProducto}
                        onEdit={abrirEdicionProducto}
                        tieneCombo={productosEnCombo.has(prod.id)}
                        onVerCombo={() => setCategoriaFiltro('__COMBOS__')}
                      />
                    ))}
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>

          {/* Barra flotante del carrito (solo mobile, cuando hay productos y el panel está cerrado) */}
          {carrito.length > 0 && !mostrarResumenMobile && (
            <>
              <div className="md:hidden fixed inset-x-0 bottom-0 h-24 z-30 pointer-events-none bg-gradient-to-t from-[#f9f8fb]/95 via-[#f9f8fb]/60 to-transparent"></div>
              <button
                onClick={() => setMostrarResumenMobile(true)}
                className="md:hidden fixed left-3 right-3 bottom-3 z-40 h-[58px] flex items-center justify-between gap-3 bg-[#6105dc] hover:bg-[#4d04b0] text-white rounded-full pl-2 pr-2 active:scale-[0.98] transition-transform"
              >
                <span className="flex items-center gap-2.5 font-semibold text-[15px]">
                  <span className="flex items-center justify-center min-w-[42px] h-[42px] rounded-full bg-white/20 text-[15px] font-bold tabular-nums">
                    {carrito.reduce((acc, item) => acc + Number(item.cantidad || 0), 0)}
                  </span>
                  Ver carrito
                </span>
                <span className="flex items-center gap-2.5 font-bold text-base tabular-nums pr-0.5">
                  <span><small className="text-xs font-semibold opacity-80 mr-0.5">S/</small>{formatoSoles(totalConDescuento)}</span>
                  <span className="flex items-center justify-center w-[42px] h-[42px] rounded-full bg-white text-[#6105dc] shrink-0">
                    <IconoTrazo nombre="bag" className="w-5 h-5" />
                  </span>
                </span>
              </button>
            </>
          )}

          {/* Panel Derecho: Resumen de Venta y Cobro (overlay en mobile, fijo en desktop) */}
          {/* Fondo semitransparente detrás de la hoja del carrito (solo mobile) */}
          {mostrarResumenMobile && (
            <div
              className="md:hidden fixed inset-0 bg-stone-900/40 z-40"
              onClick={() => setMostrarResumenMobile(false)}
            ></div>
          )}

          <div className="flex flex-col md:mt-3 md:mb-3 md:mr-3 md:w-[400px] lg:w-[440px] min-h-0">
            {/* Pestaña "Carrito" + pill "En espera" (solo desktop), igual a
                "Order Detail" + "Order Saved" de la referencia: ambas en la
                misma fila, alineadas abajo, la pestaña fundida sin costura
                con el panel y el pill de en-espera siempre visible (con 0
                cuando no hay ninguna) en vez de aparecer/desaparecer. */}
            <div className="hidden md:flex items-end justify-between relative z-10">
              <div className="folder-tab-active px-6 py-3 text-sm font-bold text-stone-900 flex items-center gap-2">
                {modalPedidosRetirar && (
                  <button
                    onClick={() => setModalPedidosRetirar(false)}
                    className="text-stone-500 hover:text-stone-800 -ml-1"
                    title="Volver al carrito"
                  >
                    <i className="fa-solid fa-chevron-left text-xs"></i>
                  </button>
                )}
                {modalPedidosRetirar ? 'Pedidos por retirar' : 'Carrito'}
              </div>
              <button
                onClick={() => { setModalPedidosRetirar(false); setModalVentasEspera((v) => !v); }}
                className={`mb-2 flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full border text-xs font-semibold transition ${modalVentasEspera ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-200 bg-white/70 hover:bg-white text-amber-700'}`}
              >
                En espera
                <span className={`w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center ${modalVentasEspera ? 'bg-white text-amber-700' : 'bg-amber-500 text-white'}`}>
                  {ventasEnEspera.length}
                </span>
              </button>
            </div>
            <section
              className={`${mostrarResumenMobile ? 'flex' : 'hidden'} md:flex flex-col w-full md:flex-1 bg-white border border-stone-200 md:border-none fixed inset-x-0 bottom-0 top-auto md:static md:inset-auto rounded-t-2xl md:rounded-tl-none md:rounded-tr-2xl md:rounded-bl-2xl md:rounded-br-2xl max-h-[88vh] md:max-h-none md:min-h-0 md:-mt-px shadow-2xl md:shadow-none overflow-hidden z-50 md:z-auto`}
            >
            {/* Manija de arrastre (solo mobile) */}
            <div className="md:hidden w-10 h-1.5 bg-stone-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>

            {modalPedidosRetirar ? (
            <>
            {/* Encabezado Pedidos por retirar (solo mobile trae botón de volver) */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 md:hidden shrink-0">
              <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-bell-concierge text-orange-600"></i> Pedidos por retirar
              </h2>
              <button onClick={() => setModalPedidosRetirar(false)} className="text-stone-600 hover:text-stone-900 text-lg"><i className="fa-solid fa-xmark"></i></button>
            </div>

            {/* Pestañas: pendiente -> listo -> historial, el mismo recorrido
                de un pedido de principio a fin. */}
            <div className="px-4 pt-3 shrink-0">
              <div className="flex p-1 bg-stone-100 rounded-xl text-[11px] font-medium text-stone-500">
                {[
                  { key: 'pendiente', label: 'Pendientes', count: pedidosRetirarPorTab.pendiente.length },
                  { key: 'listo', label: 'Listos para entrega', count: pedidosRetirarPorTab.listo.length },
                  { key: 'historial', label: 'Historial', count: 0 },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setTabPedidosRetirar(tab.key)}
                    className={`flex-1 py-1.5 rounded-lg transition ${
                      tabPedidosRetirar === tab.key ? 'bg-white text-stone-900 shadow-sm font-semibold' : 'hover:text-stone-800'
                    }`}
                  >
                    {tab.label}{tab.count > 0 && ` (${tab.count})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro de fecha, solo en Historial -- pendientes/listos son
                siempre "lo de ahora", no hace falta filtrarlos por fecha. */}
            {tabPedidosRetirar === 'historial' && (
              <div className="px-4 pt-2 shrink-0 flex gap-1.5 overflow-x-auto hide-scrollbar">
                {[
                  { key: 'hoy', label: 'Hoy' },
                  { key: '7dias', label: '7 días' },
                  { key: '30dias', label: '30 días' },
                  { key: 'todos', label: 'Todos' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFiltroFechaHistorial(f.key)}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                      filtroFechaHistorial === f.key
                        ? 'bg-stone-900 border-stone-900 text-white'
                        : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 hide-scrollbar">
              {cargandoPedidosRetirar ? (
                <p className="text-center text-stone-400 text-sm py-6">Cargando...</p>
              ) : (tabPedidosRetirar === 'historial' ? historialPedidosFiltrado : pedidosRetirarPorTab[tabPedidosRetirar]).length === 0 ? (
                <p className="text-center text-stone-400 text-sm py-6">
                  {tabPedidosRetirar === 'pendiente' && 'No hay pedidos pendientes de armar.'}
                  {tabPedidosRetirar === 'listo' && 'No hay pedidos listos esperando que los retiren.'}
                  {tabPedidosRetirar === 'historial' && 'No hay pedidos entregados o cancelados en este rango.'}
                </p>
              ) : (
                (tabPedidosRetirar === 'historial' ? historialPedidosFiltrado : pedidosRetirarPorTab[tabPedidosRetirar]).map((p, idx, lista) => {
                  const esHoyPedido = (() => {
                    const d = new Date(p.creado_en);
                    const hoy = new Date();
                    return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();
                  })();
                  const grupoAnterior = idx > 0 ? (() => {
                    const d = new Date(lista[idx - 1].creado_en);
                    const hoy = new Date();
                    return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();
                  })() : null;
                  const mostrarEncabezadoGrupo = tabPedidosRetirar === 'historial' && (idx === 0 || esHoyPedido !== grupoAnterior);
                  const minutos = Math.max(0, Math.floor((Date.now() - new Date(p.creado_en).getTime()) / 60000));
                  const tiempoTexto = minutos < 60 ? `hace ${minutos} min` : `hace ${Math.floor(minutos / 60)} h`;
                  const colgado = p.estado === 'pendiente' && minutos >= 120; // más de 2 horas: probablemente el cliente ya no viene.
                  const procesando = procesandoPedidoRetirarId === p.id;
                  const nombreCliente = p.cliente_nombre || p.codigo_corto;
                  const totalPedido = (p.items || []).reduce(
                    (acc, it) => acc + Number(it.cantidad || 0) * Number(it.precio_venta || 0),
                    0
                  );
                  const esHistorial = p.estado === 'retirado' || p.estado === 'cancelado';
                  const yaEnCarrito = pedidosCargadosAlCarrito.some((c) => c.id === p.id);
                  const estadoInfo = {
                    pendiente: { texto: 'Pendiente', color: 'text-amber-600', dot: 'bg-amber-500' },
                    listo: { texto: 'Listo', color: 'text-emerald-600', dot: 'bg-emerald-500' },
                    retirado: { texto: 'Entregado', color: 'text-stone-400', dot: 'bg-stone-300' },
                    cancelado: { texto: 'Cancelado', color: 'text-rose-400', dot: 'bg-rose-300' },
                  }[p.estado];
                  return (
                    <React.Fragment key={p.id}>
                    {mostrarEncabezadoGrupo && (
                      <p className={`text-[11px] font-semibold uppercase tracking-wide px-1 ${idx === 0 ? '' : 'pt-2'} ${esHoyPedido ? 'text-stone-600' : 'text-stone-400'}`}>
                        {esHoyPedido ? 'Hoy' : 'Anteriores'}
                      </p>
                    )}
                    <div
                      className={`bg-white border border-stone-200 rounded-xl p-4 space-y-3 ${esHistorial ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${estadoInfo.dot}`}></span>
                            <p className="text-[13.5px] font-semibold text-stone-900 truncate">{nombreCliente}</p>
                          </div>
                          <p className="text-[11px] text-stone-400 mt-0.5 pl-3">
                            <span className="font-mono">{p.codigo_corto}</span> · {tiempoTexto}
                            {colgado && <span className="text-rose-500"> · sin retirar</span>}
                          </p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide pt-0.5 ${estadoInfo.color}`}>
                          {estadoInfo.texto}
                        </span>
                      </div>

                      <div className="divide-y divide-stone-100 border-y border-stone-100">
                        {(p.items || []).map((it, i) => (
                          <div key={i} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
                            <span className="text-stone-500 truncate">
                              <span className="text-stone-400">{it.cantidad} ×</span> {it.descripcion}
                            </span>
                            <span className="text-stone-500 tabular-nums shrink-0">
                              {(Number(it.cantidad || 0) * Number(it.precio_venta || 0)).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] text-stone-400">Total</span>
                        <span className="text-sm font-semibold text-stone-900 tabular-nums">S/ {totalPedido.toFixed(2)}</span>
                      </div>

                      {/* "Ya retiró" ya no es un atajo disponible desde el
                          arranque -- confundía con "Marcar listo"/"Al
                          carrito" y cerraba el pedido sin pasar por el
                          carrito. Ahora solo existe (como "Confirmar
                          retiro") una vez que el pedido ya está cargado en
                          el carrito y pendiente de cobro: en ese punto ya
                          no tiene sentido ofrecer "Marcar listo" ni volver a
                          "Cargar al carrito", así que el botón principal
                          cambia de rol. */}
                      {yaEnCarrito ? (
                        <button
                          onClick={() => marcarRetiradoDirecto(p)}
                          disabled={procesando}
                          title="Confirmar que el cliente ya se llevó lo que está en el carrito"
                          className="w-full py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold disabled:opacity-50 transition"
                        >
                          Confirmar retiro
                        </button>
                      ) : (
                        <>
                          {p.estado === 'pendiente' && (
                            <button
                              onClick={() => marcarPedidoListo(p.id)}
                              disabled={marcandoListoId === p.id || procesando}
                              className="w-full py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold disabled:opacity-50 transition"
                            >
                              {marcandoListoId === p.id ? 'Un momento...' : 'Marcar listo'}
                            </button>
                          )}
                          {p.estado === 'listo' && (
                            <button
                              onClick={() => cargarPedidoDesdeRetirar(p)}
                              disabled={procesando}
                              title="Agregar los productos al carrito"
                              className="w-full py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold disabled:opacity-50 transition"
                            >
                              {procesando ? 'Un momento...' : 'Cargar al carrito'}
                            </button>
                          )}
                          {!esHistorial && (
                            <div className="flex items-center gap-3 pt-0.5">
                              {p.estado === 'pendiente' && (
                                <>
                                  <button
                                    onClick={() => cargarPedidoDesdeRetirar(p)}
                                    disabled={procesando}
                                    title="Agregar los productos al carrito"
                                    className="text-[11px] font-medium text-stone-600 hover:text-stone-900 transition"
                                  >
                                    Al carrito
                                  </button>
                                  <span className="text-stone-200">·</span>
                                </>
                              )}
                              <button
                                onClick={() => eliminarPedidoRetirar(p)}
                                disabled={procesando}
                                title="Eliminar de la cola"
                                className="ml-auto text-[11px] font-medium text-stone-400 hover:text-rose-500 transition"
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>
            </>
            ) : modalVentasEspera ? (
            <>
            {/* Ventas en espera, dentro del carrito (antes era una ventana emergente) */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-stone-100 shrink-0">
              <span className="text-sm font-extrabold text-stone-900">Ventas en espera</span>
              <button
                onClick={() => setModalVentasEspera(false)}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 transition"
              >
                <i className="fa-solid fa-arrow-left text-[10px]"></i> Volver al carrito
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 hide-scrollbar">
              {ventasEnEspera.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-stone-500 text-center p-4">
                  <i className="fa-solid fa-pause text-3xl mb-2 text-stone-300"></i>
                  <p className="text-xs font-semibold">No hay ventas en espera</p>
                  <p className="text-xs text-stone-500 mt-0.5">Usa "Pausar" en el carrito para dejar una venta aparte.</p>
                </div>
              ) : ventasEnEspera.map((v, i) => {
                const nombres = v.items.map((it) => it.descripcion).filter(Boolean);
                const resumen = nombres.length > 2 ? `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más` : nombres.join(', ');
                const unidades = v.items.reduce((a, it) => a + (Number(it.cantidad) || 0), 0);
                return (
                  <div key={v.id} className="rounded-[22px] border border-[#f0e9fc] bg-gradient-to-br from-[#f7f2ff] to-white p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-stone-400 flex items-center gap-1.5">
                        <i className="w-1.5 h-1.5 rounded-full bg-amber-500"></i> {v.hora}
                      </span>
                      <span className="text-[22px] font-bold text-stone-900 tabular-nums tracking-tight whitespace-nowrap">
                        <small className="text-xs font-semibold text-stone-500 mr-0.5">S/</small>{Number(v.total).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[13px] text-stone-500 mt-1.5 mb-3 leading-snug line-clamp-2">
                      <b className="font-semibold text-stone-900">{unidades} {unidades === 1 ? 'ítem' : 'ítems'}</b>{resumen ? ` · ${resumen}` : ''}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => recuperarVentaEspera(i)}
                        className="flex-1 py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white text-[13px] font-semibold rounded-full transition"
                      >
                        Recuperar
                      </button>
                      <button
                        onClick={() => borrarVentaEspera(i)}
                        title="Descartar"
                        className="w-10 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs transition"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
            ) : (
            <>
            {/* Encabezado del carrito: una sola fila de título (con el cierre en
                mobile) y debajo las acciones rápidas. En desktop todo va en una fila. */}
            <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-y-2.5 px-4 pt-2 pb-3 md:py-3 bg-white border-b border-stone-100 shrink-0">
              <h2 className="text-[19px] md:text-sm font-bold md:font-extrabold tracking-tight text-stone-900">
                <span className="md:hidden">Carrito</span>
                <span className="ml-1.5 md:ml-0 text-[13px] md:text-sm text-stone-400 font-semibold">{carrito.reduce((a, c) => a + c.cantidad, 0)} ítems</span>
              </h2>
              <button
                onClick={() => setMostrarResumenMobile(false)}
                className="md:hidden w-9 h-9 rounded-full bg-[#f4eefe] hover:bg-[#ece0fd] text-stone-500 flex items-center justify-center transition"
                aria-label="Cerrar"
              >
                <IconoTrazo nombre="x" className="w-[15px] h-[15px]" />
              </button>
              <div className="flex items-center gap-1.5 w-full md:w-auto">
                <button
                  onClick={() => { setModalPedidosRetirar(false); setModalVentasEspera(true); }}
                  className="md:hidden flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full ring-1 ring-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-700 transition"
                >
                  En espera
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                    {ventasEnEspera.length}
                  </span>
                </button>
                {carrito.length > 0 && (
                  <button
                    onClick={aparcarVentaActual}
                    className="px-3.5 py-1.5 rounded-full bg-[#f4eefe] hover:bg-[#ece0fd] text-xs text-[#4d04b0] font-semibold transition"
                  >
                    Pausar
                  </button>
                )}
                {carrito.length > 0 && (
                  <button
                    onClick={() => { setCarrito([]); setDescuentoTipo(null); setDescuentoValor(''); setMostrarPago(false); reiniciarClienteYMedioPago(); setPedidosCargadosAlCarrito([]); }}
                    className="px-3.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-xs text-rose-700 font-semibold transition"
                  >
                    Vaciar
                  </button>
                )}
              </div>
            </div>

            {/* Recordatorio fijo de pedidos por retirar -- vive pegado arriba
                de la lista de ítems, no solo como badge en un botón, para que
                no se pierda de vista mientras el cajero sigue atendiendo el
                carrito normal. */}
            {pedidosPorRetirarPendientes > 0 && (
              <button
                onClick={() => { setModalPedidosRetirar(true); cargarPedidosRetirar(); setMostrarResumenMobile(true); }}
                className="shrink-0 mx-3 mt-2.5 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition text-left"
              >
                <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white shrink-0">
                  <i className="fa-solid fa-bell-concierge text-xs"></i>
                  <span className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-60"></span>
                </span>
                <span className="flex-1 text-xs font-bold text-amber-800">
                  {pedidosPorRetirarPendientes === 1
                    ? '1 pedido esperando que lo armes'
                    : `${pedidosPorRetirarPendientes} pedidos esperando que los armes`}
                </span>
                <i className="fa-solid fa-chevron-right text-xs text-amber-600"></i>
              </button>
            )}

            {/* Lista Ítems */}
            <div className="flex-1 overflow-y-auto p-2.5 pb-16 space-y-1.5 hide-scrollbar">
              {carrito.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-stone-500 text-center p-4">
                  <i className="fa-solid fa-basket-shopping text-3xl mb-2 text-stone-300"></i>
                  <p className="text-xs font-semibold">Carrito vacío</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Toca un producto o escanea su código de barras.
                  </p>
                </div>
              ) : (
                carrito.map((item) => (
                  <div
                    key={item.claveCarrito || item.productoId}
                    className="flex items-center gap-2.5 p-2 bg-[#faf8fe] rounded-[20px]"
                  >
                    <FotoProducto
                      fotoUrl={item.foto_url}
                      categoria={item.categoria}
                      className="w-11 h-11 rounded-[14px] shrink-0 ring-1 ring-black/5 bg-white"
                      iconClassName="text-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-stone-900 truncate">
                        {item.descripcion}
                      </p>
                      <p className="text-[11.5px] text-stone-400 tabular-nums">
                        S/ {item.precioUnitario.toFixed(2)} / {item.unidad || 'UND'}
                      </p>
                    </div>

                    <div className="flex items-center bg-white rounded-full ring-1 ring-[#6105dc]/10 shrink-0">
                      <button
                        onClick={() => cambiarCantidadCarrito(item.claveCarrito || item.productoId, -1)}
                        className="w-8 h-8 flex items-center justify-center text-[#6105dc] hover:bg-[#f4eefe] rounded-full transition"
                        aria-label="Quitar uno"
                      >
                        <IconoTrazo nombre="minus" className="w-3.5 h-3.5" />
                      </button>
                      <span className="min-w-[18px] text-center text-[13px] font-bold text-stone-900 tabular-nums">
                        {item.cantidad}
                      </span>
                      <button
                        onClick={() => cambiarCantidadCarrito(item.claveCarrito || item.productoId, 1)}
                        className="w-8 h-8 flex items-center justify-center text-[#6105dc] hover:bg-[#f4eefe] rounded-full transition"
                        aria-label="Agregar uno"
                      >
                        <IconoTrazo nombre="plus" className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="w-[58px] text-right text-[13px] font-bold text-stone-900 tabular-nums shrink-0">
                      S/ {item.subtotal.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Panel Cobro */}
            {/* El panel es vidrio esmerilado y se monta 40px sobre el final de la lista:
                los items pasan por debajo, borrosos, y el borde superior se desvanece. */}
            <div
              className="relative z-10 -mt-10 p-4 pt-14 space-y-3 backdrop-blur-xl bg-gradient-to-b from-white/60 to-white/90"
              style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 44px)', maskImage: 'linear-gradient(to bottom, transparent 0, black 44px)' }}
            >
              {!mostrarPago ? (
                <>
                  <div className="bg-[#f4eefe] border border-[#efe6fc] rounded-[22px] px-4 py-3 space-y-1.5">
                    <div className="flex items-baseline justify-between text-[12.5px] text-stone-500">
                      <span>Subtotal</span>
                      <span className="tabular-nums">S/ {formatoSoles(totalVenta)}</span>
                    </div>
                    {montoDescuento > 0 && (
                      <div className="flex items-center justify-between text-xs text-rose-600 font-semibold">
                        <span>Descuento</span>
                        <span className="tabular-nums">- S/ {montoDescuento.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-[#6105dc]/10">
                      <span className="text-xs font-semibold text-[#4d04b0]">
                        Total
                      </span>
                      <span className="text-[28px] font-bold tracking-tight text-stone-900 tabular-nums">
                        <small className="text-sm font-semibold text-stone-500 mr-1">S/</small>{formatoSoles(totalConDescuento)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setMostrarPago(true)}
                    disabled={carrito.length === 0 || !turnoActivo}
                    className={`w-full py-3.5 rounded-full font-semibold text-[15px] transition-all flex items-center justify-center gap-2 ${
                      !turnoActivo || carrito.length === 0
                        ? 'bg-[#ebe8f1] text-[#8b869a] cursor-not-allowed'
                        : 'bg-[#6105dc] hover:bg-[#4d04b0] text-white active:scale-[0.98]'
                    }`}
                  >
                    {!turnoActivo ? (
                      <><IconoTrazo nombre="warn" className="w-[18px] h-[18px]" /> Abre un turno para cobrar</>
                    ) : (
                      <><IconoTrazo nombre="till" className="w-[18px] h-[18px]" /> Cobrar</>
                    )}
                  </button>
                </>
              ) : (
              <>
              <button
                type="button"
                onClick={() => { setMostrarPago(false); reiniciarClienteYMedioPago(); }}
                className="text-xs text-stone-500 hover:text-stone-800 font-semibold flex items-center gap-1"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i> Volver
              </button>

              <div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'EFECTIVO', icono: 'fa-money-bill-wave', texto: 'Efectivo' },
                    { id: 'YAPE', icono: 'fa-mobile-screen', texto: 'Yape' },
                    { id: 'PLIN', icono: 'fa-mobile-screen', texto: 'Plin' },
                    { id: 'TARJETA', icono: 'fa-credit-card', texto: 'Tarjeta' },
                    { id: 'CREDITO', icono: 'fa-file-invoice-dollar', texto: 'Crédito' },
                    { id: 'MIXTO', icono: 'fa-layer-group', texto: 'Mixto' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setMedioPago(m.id);
                        setCampoTeclado(null);
                        if (m.id === 'CREDITO' && (!clienteActual || clienteActual.dni === '99999999')) {
                          abrirBuscarClientePOS();
                        }
                      }}
                      className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold rounded-2xl border transition ${
                        medioPago === m.id
                          ? 'bg-stone-900 border-stone-900 text-white shadow-lg shadow-stone-900/20'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-800 shadow-sm'
                      }`}
                    >
                      <i className={`fa-solid ${m.icono} text-sm`}></i>
                      {m.texto}
                    </button>
                  ))}
                </div>
              </div>

              {medioPago === 'EFECTIVO' && (
                <div className="bg-stone-200/60 p-3 rounded-xl border border-stone-200 space-y-2.5">
                  <div>
                    <label className="text-xs text-stone-600 block mb-1">Paga con (S/):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-2xl font-black text-stone-900 tabular-nums focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setCampoTeclado(campoTeclado === 'recibido' ? null : 'recibido')}
                        title="Teclado numérico"
                        className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-lg transition ${campoTeclado === 'recibido' ? 'bg-stone-900 text-white' : 'bg-stone-300 hover:bg-stone-400 text-stone-700'}`}
                      >
                        <i className="fa-solid fa-calculator"></i>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">Vuelto</span>
                    <span className={`text-2xl font-black tabular-nums ${vuelto < 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                      S/ {vuelto > 0 ? vuelto.toFixed(2) : '0.00'}
                    </span>
                  </div>
                  {campoTeclado === 'recibido' && <NumericKeypad value={montoRecibido} onChange={asignarDesdeTeclado} />}
                </div>
              )}

              {(medioPago === 'YAPE' || medioPago === 'PLIN') && (
                <div className="bg-stone-200/60 p-2 rounded-lg border border-stone-200 text-center">
                  <button
                    type="button"
                    onClick={() => setMedioQR(medioPago)}
                    className="w-full py-2 bg-stone-300 hover:bg-stone-400 text-stone-900 text-xs font-bold rounded-lg"
                  >
                    <i className="fa-solid fa-qrcode"></i> Mostrar QR de {medioPago}
                  </button>
                </div>
              )}

              {medioPago === 'CREDITO' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs bg-stone-200/60 border border-stone-200 rounded-lg p-2">
                    <span className="font-semibold text-stone-800 truncate flex items-center gap-1.5">
                      <i className="fa-solid fa-user text-stone-500"></i>
                      {(!clienteActual || clienteActual.dni === '99999999') ? 'Sin cliente asignado' : clienteActual.nombre_completo}
                    </span>
                    <button type="button" onClick={abrirBuscarClientePOS} className="text-amber-700 font-semibold hover:underline shrink-0 ml-2">
                      Cambiar
                    </button>
                  </div>
                  <div className={`p-2 rounded-lg border text-xs ${
                    (!clienteActual || clienteActual.dni === '99999999')
                      ? 'bg-rose-950/40 border-rose-800/50 text-rose-600'
                      : 'bg-amber-950/30 border-amber-800/50 text-amber-700'
                  }`}>
                    {(!clienteActual || clienteActual.dni === '99999999') ? (
                      'Asigna un cliente registrado para vender a crédito.'
                    ) : (
                      <>Disponible: S/ {Math.max(0, (Number(clienteActual.limite_credito) || 0) - (Number(clienteActual.saldo_actual) || 0)).toFixed(2)} de S/ {(Number(clienteActual.limite_credito) || 0).toFixed(2)}</>
                    )}
                  </div>
                </div>
              )}

              {medioPago === 'MIXTO' && (
                <div className="bg-stone-200/60 p-2 rounded-lg border border-stone-200 space-y-1.5">
                  <div>
                    <label className="text-xs text-stone-600 block mb-1">Monto en Tarjeta/Otro (S/):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={montoMixtoOtro}
                        onChange={(e) => setMontoMixtoOtro(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-stone-100 border border-stone-300 rounded px-2 py-1 text-sm font-bold text-stone-900 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setCampoTeclado(campoTeclado === 'mixtoOtro' ? null : 'mixtoOtro')}
                        title="Teclado numérico"
                        className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition ${campoTeclado === 'mixtoOtro' ? 'bg-stone-900 text-white' : 'bg-stone-300 hover:bg-stone-400 text-stone-700'}`}
                      >
                        <i className="fa-solid fa-calculator text-xs"></i>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200">
                    <div>
                      <label className="text-xs text-stone-600 block">Falta en efectivo:</label>
                      <span className="text-sm font-black text-amber-600">S/ {efectivoRequeridoMixto.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <label className="text-xs text-stone-600 block">Vuelto:</label>
                      <span className={`text-sm font-black ${vueltoMixto < 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                        S/ {vueltoMixto > 0 ? vueltoMixto.toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>

                  {efectivoRequeridoMixto > 0 && (
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Recibe en efectivo (S/):</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={montoMixtoRecibido}
                          onChange={(e) => setMontoMixtoRecibido(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-stone-100 border border-stone-300 rounded px-2 py-1 text-sm font-bold text-stone-900 focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setCampoTeclado(campoTeclado === 'mixtoRecibido' ? null : 'mixtoRecibido')}
                          title="Teclado numérico"
                          className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition ${campoTeclado === 'mixtoRecibido' ? 'bg-stone-900 text-white' : 'bg-stone-300 hover:bg-stone-400 text-stone-700'}`}
                        >
                          <i className="fa-solid fa-calculator text-xs"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {(campoTeclado === 'mixtoOtro' || campoTeclado === 'mixtoRecibido') && (
                    <NumericKeypad value={valorTeclado} onChange={asignarDesdeTeclado} />
                  )}
                </div>
              )}

              <div className="border-t border-stone-200 pt-2">
                {!descuentoTipo ? (
                  carrito.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setDescuentoTipo('PORCENTAJE'); setDescuentoValor(''); }}
                      className="text-xs text-amber-700 hover:underline font-semibold"
                    >
                      <i className="fa-solid fa-tag text-xs"></i> Aplicar descuento
                    </button>
                  )
                ) : (
                  <div className="bg-stone-200/60 p-2.5 rounded-lg border border-stone-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">Descuento</span>
                      <button
                        type="button"
                        onClick={() => { setDescuentoTipo(null); setDescuentoValor(''); }}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-stone-100 border border-stone-300 rounded-lg overflow-hidden shrink-0">
                        <button
                          type="button"
                          onClick={() => setDescuentoTipo('PORCENTAJE')}
                          className={`px-2.5 py-1.5 text-xs font-bold ${descuentoTipo === 'PORCENTAJE' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setDescuentoTipo('MONTO')}
                          className={`px-2.5 py-1.5 text-xs font-bold ${descuentoTipo === 'MONTO' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}
                        >
                          S/
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        value={descuentoValor}
                        onChange={(e) => setDescuentoValor(e.target.value)}
                        placeholder={descuentoTipo === 'PORCENTAJE' ? '0-100' : '0.00'}
                        className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-sm font-bold text-stone-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {montoDescuento > 0 && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs text-stone-600">
                    <span>Subtotal</span>
                    <span className="tabular-nums">S/ {totalVenta.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-rose-600 font-semibold">
                    <span>Descuento</span>
                    <span className="tabular-nums">- S/ {montoDescuento.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 pb-0.5 border-t border-stone-200">
                <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider pt-2">
                  Total a Cobrar
                </span>
                <span className="text-2xl font-extrabold text-stone-900 tabular-nums pt-2">
                  S/ {totalConDescuento.toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleCobrar}
                disabled={procesandoVenta || carrito.length === 0 || !turnoActivo}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  !turnoActivo || procesandoVenta || carrito.length === 0
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    : 'bg-stone-900 hover:bg-stone-800 text-white shadow-lg shadow-stone-900/25 active:scale-[0.98]'
                }`}
              >
                {!turnoActivo ? (
                  <><i className="fa-solid fa-triangle-exclamation"></i> Abre un Turno para Cobrar</>
                ) : procesandoVenta ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Registrando Venta...</>
                ) : medioPago === 'CREDITO' ? (
                  <><i className="fa-solid fa-file-invoice-dollar"></i> Registrar Venta a Crédito</>
                ) : (
                  <><i className="fa-solid fa-receipt"></i> Cobrar e Imprimir Boleta</>
                )}
              </button>
              </>
              )}
            </div>
            </>
            )}
          </section>
          </div>

          {/* Menú "Más módulos" estilo paleta de comandos: buscador arriba,
              opciones agrupadas y navegación con teclado (↑ ↓ Enter Esc).
              Es el único punto de entrada a estas funciones en cualquier
              tamaño de pantalla -- en mobile sigue siendo una hoja que sube
              desde abajo, en desktop es un panel centrado cerca del borde
              superior. Las opciones son datos (no botones sueltos) para que
              el buscador y el teclado funcionen sobre la misma lista. */}
          {menuMas && (() => {
            const opciones = [
              turnoActivo
                ? { grupo: '', etiqueta: 'Cerrar Caja', icono: 'fa-lock', tono: 'rose', accion: abrirCierreCaja }
                : { grupo: '', etiqueta: 'Abrir Turno', icono: 'fa-bolt', tono: 'primario', soloMovil: true, accion: () => setModalTurno(true) },
              { grupo: 'Ventas y caja', etiqueta: 'Cuentas por Cobrar', icono: 'fa-hand-holding-dollar', accion: abrirModuloCobroDeudas },
              { grupo: 'Ventas y caja', etiqueta: 'Historial de Ventas Hoy', icono: 'fa-receipt', accion: abrirHistorialDelDia },
              !esAdmin && { grupo: 'Ventas y caja', etiqueta: 'Registrar Cliente', icono: 'fa-user-plus', accion: () => setModalNuevoCliente(true) },
              { grupo: 'Inventario', etiqueta: 'Stock Bajo', icono: 'fa-triangle-exclamation', tono: 'amber', insignia: cantidadStockBajo > 0 ? String(cantidadStockBajo) : '', accion: () => setModalStockBajo(true) },
              { grupo: 'Inventario', etiqueta: 'Ver Stock', icono: 'fa-table-list', accion: () => setModalVerStock(true) },
              { grupo: 'Inventario', etiqueta: 'Toma de Inventario', icono: 'fa-clipboard-check', accion: abrirTomaInventario },
              { grupo: 'Inventario', etiqueta: 'Historial de Inventario', icono: 'fa-scale-balanced', accion: abrirHistorialInventario },
              { grupo: 'Inventario', etiqueta: 'Registrar Merma', icono: 'fa-box', accion: () => setModalMerma(true) },
              ...(esAdmin ? [
                { grupo: 'Administración', etiqueta: 'Dashboard de Ventas', icono: 'fa-chart-pie', accion: abrirDashboard },
                { grupo: 'Administración', etiqueta: 'Cuentas por Pagar', icono: 'fa-file-invoice', accion: abrirCuentasPorPagar },
                { grupo: 'Administración', etiqueta: 'Historial de Cierres de Caja', icono: 'fa-cash-register', accion: abrirHistorialCierres },
                { grupo: 'Administración', etiqueta: 'Clientes (editar)', icono: 'fa-users', accion: abrirGestionClientes },
                { grupo: 'Administración', etiqueta: 'Cajeros y Empleados', icono: 'fa-user-group', accion: abrirGestionCajeros },
                { grupo: 'Administración', etiqueta: 'Registro de actividad', icono: 'fa-clipboard-check', accion: abrirAuditoria },
                { grupo: 'Administración', etiqueta: 'Mi Link de Pedidos', icono: 'fa-share-nodes', accion: abrirModalDelivery },
                { grupo: 'Entradas', etiqueta: 'Registrar Productos', icono: 'fa-boxes-stacked', accion: () => setModalInventarioInicial(true) },
                { grupo: 'Entradas', etiqueta: 'Entrada de Mercadería', icono: 'fa-truck-ramp-box', accion: () => setModalEntradaMercaderia(true) },
                { grupo: 'Entradas', etiqueta: 'Levantamiento de Inventario', icono: 'fa-clipboard-list', accion: () => setModalLevantamiento(true) },
                { grupo: 'Entradas', etiqueta: 'Combos', icono: 'fa-gift', accion: abrirModalCombos },
                { grupo: 'Entradas', etiqueta: 'Importar del Catálogo Maestro', icono: 'fa-book', accion: abrirImportarMaestro },
              ] : []),
              (sesion?.usuario?.rol === 'dueno' && esAdmin && !esModoDemo && cuentaConPinDueno) && {
                grupo: 'Cuenta', etiqueta: 'Cambiar mi PIN', icono: 'fa-key',
                insignia: !pinDuenoReforzado ? 'Recomendado' : '', tono: 'amber',
                accion: () => { setFormPinDueno({ actual: '', nuevo: '', repetir: '' }); setModalPinDueno(true); }
              },
              { grupo: 'Cuenta', etiqueta: 'Cerrar Sesión', icono: 'fa-right-from-bracket', tono: 'rose', accion: cerrarSesion },
            ].filter(Boolean);
            // El botón "Abrir Turno" del encabezado ya está visible desde sm (640px);
            // en pantallas más chicas se oculta y solo queda este ítem del menú.
            const esEscritorio = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
            const opcionesMenu = esEscritorio ? opciones.filter((o) => !o.soloMovil) : opciones;

            // Sin tildes ni mayúsculas para que "inventario" encuentre "Mercadería", etc.
            const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            const q = normalizar(busquedaMenu).trim();
            const visibles = q ? opcionesMenu.filter((o) => normalizar(`${o.etiqueta} ${o.grupo}`).includes(q)) : opcionesMenu;
            const activo = Math.min(indiceMenu, Math.max(visibles.length - 1, 0));
            const cerrarMenu = () => setMenuMas(false);
            const ejecutar = (o) => { if (!o) return; o.accion(); cerrarMenu(); };
            const tonos = {
              primario: 'bg-[#6105dc] text-white',
              rose: 'bg-rose-100 text-rose-600',
              amber: 'bg-amber-50 text-amber-600',
            };

            const alTeclear = (e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceMenu(Math.min(activo + 1, visibles.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceMenu(Math.max(activo - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); ejecutar(visibles[activo]); }
              else if (e.key === 'Escape') { e.preventDefault(); cerrarMenu(); }
            };

            return (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end md:items-start md:justify-center md:pt-[10vh]" onClick={cerrarMenu}>
                <div
                  className="w-full md:max-w-xl max-h-[85vh] md:max-h-[72vh] flex flex-col bg-white border-t border-stone-200 md:border md:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={alTeclear}
                >
                  <div className="md:hidden w-10 h-1 bg-stone-300 rounded-full mx-auto mt-2.5"></div>
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-200">
                    <i className="fa-solid fa-magnifying-glass text-stone-400 text-sm"></i>
                    <input
                      type="text"
                      value={busquedaMenu}
                      onChange={(e) => { setBusquedaMenu(e.target.value); setIndiceMenu(0); }}
                      placeholder="Buscar una opción..."
                      autoFocus={typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches}
                      className="flex-1 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
                    />
                    <kbd className="hidden md:inline text-[10px] font-semibold text-stone-500 bg-stone-100 border border-stone-200 rounded px-1.5 py-0.5">Esc</kbd>
                  </div>

                  <div className="flex-1 overflow-y-auto hide-scrollbar p-2 pb-4 md:pb-2">
                    {visibles.length === 0 && (
                      <p className="text-center text-sm text-stone-500 py-10">Sin resultados para "{busquedaMenu}"</p>
                    )}
                    {visibles.map((o, i) => (
                      <React.Fragment key={`${o.grupo}-${o.etiqueta}`}>
                        {o.grupo && o.grupo !== visibles[i - 1]?.grupo && (
                          <p className="px-3 pt-3 pb-1 text-[10px] font-bold text-stone-400 uppercase tracking-wide">{o.grupo}</p>
                        )}
                        <button
                          ref={(el) => { if (el && i === activo) el.scrollIntoView({ block: 'nearest' }); }}
                          onClick={() => ejecutar(o)}
                          onMouseEnter={() => setIndiceMenu(i)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 text-sm ${
                            i === activo ? 'bg-[#f4eefe]' : ''
                          } ${o.tono === 'rose' ? 'text-rose-600 font-semibold' : o.tono === 'primario' ? 'text-[#4d04b0] font-bold' : 'text-stone-800 font-medium'}`}
                        >
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tonos[o.tono] || 'bg-[#f4eefe] text-[#6105dc]'}`}>
                            <i className={`fa-solid ${o.icono} text-xs`}></i>
                          </span>
                          <span className="flex-1 min-w-0 truncate">{o.etiqueta}</span>
                          {o.insignia && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{o.insignia}</span>}
                          {i === activo && <kbd className="hidden md:inline text-[10px] font-semibold text-stone-500 bg-white border border-stone-200 rounded px-1.5 py-0.5">↵</kbd>}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="hidden md:flex items-center gap-4 px-4 py-2.5 border-t border-stone-200 bg-stone-50 text-[11px] text-stone-500">
                    <span className="flex items-center gap-1.5"><kbd className="bg-white border border-stone-200 rounded px-1.5 py-0.5 font-semibold">↑↓</kbd> Navegar</span>
                    <span className="flex items-center gap-1.5"><kbd className="bg-white border border-stone-200 rounded px-1.5 py-0.5 font-semibold">↵</kbd> Abrir</span>
                    <span className="flex items-center gap-1.5"><kbd className="bg-white border border-stone-200 rounded px-1.5 py-0.5 font-semibold">Esc</kbd> Cerrar</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* MODALES ADICIONALES */}
          {/* ========================================================================= */}

          {/* Modal: Cantidad / Balanza para Peso KG */}
          {modalCantidad && productoSeleccionadoCantidad && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-xs w-full p-5 shadow-2xl space-y-4 text-center">
                <h3 className="text-sm font-bold text-stone-900 leading-tight">{productoSeleccionadoCantidad.descripcion}</h3>

                {productoSeleccionadoCantidad.unidad === 'KG' ? (
                  <>
                    <p className="text-xs text-stone-600">Ingresa la cantidad o peso en KG:</p>
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="number"
                        step="0.005"
                        min="0.001"
                        value={inputCantidad}
                        onChange={(e) => setInputCantidad(e.target.value)}
                        className="w-32 bg-stone-50 border border-stone-200 text-center font-mono font-bold text-xl text-orange-600 p-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                        autoFocus
                      />
                      <span className="text-sm font-bold text-stone-700">KG</span>
                    </div>
                  </>
                ) : (
                  <>
                    {Number(productoSeleccionadoCantidad.unidades_por_pack) > 1 && (
                      <div className="flex bg-stone-200/60 p-1 rounded-xl border border-stone-200">
                        <button
                          type="button"
                          onClick={() => setTipoVentaSeleccionado('UNIDAD')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${tipoVentaSeleccionado === 'UNIDAD' ? 'bg-stone-900 text-white shadow' : 'text-stone-600'}`}
                        >
                          Suelto · S/ {Number(productoSeleccionadoCantidad.precio_venta).toFixed(2)}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTipoVentaSeleccionado('PACK')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${tipoVentaSeleccionado === 'PACK' ? 'bg-stone-900 text-white shadow' : 'text-stone-600'}`}
                        >
                          Pack x{productoSeleccionadoCantidad.unidades_por_pack} · S/ {(Number(productoSeleccionadoCantidad.precio_venta_pack) || Number(productoSeleccionadoCantidad.precio_venta) * Number(productoSeleccionadoCantidad.unidades_por_pack)).toFixed(2)}
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-stone-600">
                      {tipoVentaSeleccionado === 'PACK' ? `¿Cuántos packs de ${productoSeleccionadoCantidad.unidades_por_pack}?` : '¿Cuántas unidades sueltas?'}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={inputCantidad}
                        onChange={(e) => setInputCantidad(e.target.value)}
                        className="w-32 bg-stone-50 border border-stone-200 text-center font-mono font-bold text-xl text-orange-600 p-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                        autoFocus
                      />
                      <span className="text-sm font-bold text-stone-700">{tipoVentaSeleccionado === 'PACK' ? 'pack(s)' : 'und'}</span>
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setModalCantidad(false)} className="flex-1 py-2 bg-white/70 rounded-full text-xs font-semibold shadow-sm">Cancelar</button>
                  <button onClick={confirmarCantidadBalanza} className="flex-1 py-2 bg-[#6105dc] hover:bg-[#4d04b0] text-white rounded-full text-xs font-bold shadow">Aceptar</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Lector de Código de Barras por Cámara */}
          {modalEscaner && (
            <div className="fixed inset-0 bg-black z-[70] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 bg-stone-50/90">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-camera text-orange-600"></i> {modoEscaner === 'toma-inventario' ? 'Escanear para el Conteo' : 'Escanear Código de Barras'}
                </h3>
                <div className="flex items-center gap-2">
                  {camarasDisponibles.length > 1 && (
                    <button
                      onClick={cambiarCamara}
                      title="Cambiar de cámara"
                      className="w-9 h-9 flex items-center justify-center bg-stone-200 rounded-xl text-stone-700 hover:text-stone-900"
                    >
                      <i className="fa-solid fa-camera-rotate"></i>
                    </button>
                  )}
                  <button
                    onClick={() => setModalEscaner(false)}
                    className="w-9 h-9 flex items-center justify-center bg-stone-200 rounded-xl text-stone-700 hover:text-stone-900"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>

              <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                <div className="relative w-full h-full flex items-center justify-center">
                  <video ref={videoNativoRef} className="w-full h-full object-cover" playsInline muted autoPlay></video>
                  <div className="absolute w-[85%] max-w-sm aspect-[2/1] border-2 border-orange-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none"></div>
                </div>

                {errorEscaner && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-stone-50">
                    <i className="fa-solid fa-video-slash text-3xl text-rose-600 mb-3"></i>
                    <p className="text-sm font-semibold text-stone-900">{errorEscaner}</p>
                    <p className="text-xs text-stone-500 mt-1">Verifica que le diste permiso de cámara a esta página en tu navegador.</p>
                  </div>
                )}
              </div>

              {modoEscaner === 'toma-inventario' ? (
                <div className="bg-stone-50 rounded-t-2xl shadow-2xl">
                  {productoEscaneadoId && (() => {
                    const f = filasTomaInventario.find((x) => x.productoId === productoEscaneadoId);
                    if (!f) return null;
                    const porPack = Number(f.pendienteUnidadesPorPack) || 1;
                    const totalPendiente = (Number(f.pendientePacks) || 0) * porPack + (Number(f.pendienteSueltas) || 0);
                    return (
                      <div className="p-4 border-b border-stone-200 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-box text-lg"></i>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-stone-900 truncate">{f.descripcion}</p>
                            <p className="text-xs text-stone-500">
                              {f.stockContado === '' ? 'Aún sin contar' : `Ya llevas ${f.stockContado} und`}
                            </p>
                          </div>
                        </div>

                        {f.historial.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {f.historial.map((h) => (
                              <span key={h.id} className="inline-flex items-center gap-1 bg-stone-200 rounded-full pl-2 pr-1 py-0.5 text-[11px] text-stone-700">
                                +{h.cantidad}
                                <button onClick={() => quitarHallazgo(f.productoId, h.id)} className="w-3.5 h-3.5 flex items-center justify-center text-stone-500 hover:text-rose-600">
                                  <i className="fa-solid fa-xmark text-[9px]"></i>
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="flex flex-col items-center">
                            <input
                              type="number"
                              autoFocus
                              placeholder="0"
                              value={f.pendientePacks}
                              onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendientePacks', e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') agregarHallazgo(f.productoId); }}
                              className="w-14 bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm text-stone-900 text-center"
                            />
                            <span className="text-[9px] text-stone-500">packs</span>
                          </div>
                          <span className="text-xs text-stone-400">de</span>
                          <div className="flex flex-col items-center">
                            {editandoPackParaId === f.productoId ? (
                              <input
                                type="number"
                                autoFocus
                                placeholder="1"
                                value={f.pendienteUnidadesPorPack}
                                onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendienteUnidadesPorPack', e.target.value)}
                                onBlur={() => setEditandoPackParaId(null)}
                                onKeyDown={(e) => { if (e.key === 'Enter') setEditandoPackParaId(null); }}
                                className="w-14 bg-white border border-orange-400 rounded-lg px-2 py-2 text-sm text-stone-900 text-center"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditandoPackParaId(f.productoId)}
                                title="Tocar para cambiar las unidades por pack"
                                className="w-14 h-[38px] bg-stone-100 border border-stone-200 rounded-lg text-sm font-bold text-stone-700"
                              >
                                x{f.pendienteUnidadesPorPack || 1}
                              </button>
                            )}
                            <span className="text-[9px] text-stone-500 flex items-center gap-0.5">
                              {editandoPackParaId !== f.productoId && <i className="fa-solid fa-lock text-[7px]"></i>} und c/u
                            </span>
                          </div>
                          <span className="text-xs text-stone-400">+</span>
                          <div className="flex flex-col items-center">
                            <input
                              type="number"
                              placeholder="0"
                              value={f.pendienteSueltas}
                              onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendienteSueltas', e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') agregarHallazgo(f.productoId); }}
                              className="w-14 bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm text-stone-900 text-center"
                            />
                            <span className="text-[9px] text-stone-500">sueltas</span>
                          </div>
                          <span className="text-xs font-bold text-orange-600 ml-auto shrink-0">= {totalPendiente} und</span>
                        </div>
                        <button onClick={() => agregarHallazgo(f.productoId)} className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold">
                          <i className="fa-solid fa-plus"></i> Agregar
                        </button>
                      </div>
                    );
                  })()}
                  <div className="px-4 py-3 text-center space-y-1">
                    <p className="text-xs text-stone-600">
                      {productoEscaneadoId ? 'Confirma y sigue escaneando el siguiente.' : 'Apunta la cámara al código de barras del producto.'}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      <i className="fa-solid fa-clipboard-check mr-1"></i>
                      {filasTomaInventario.length} producto{filasTomaInventario.length === 1 ? '' : 's'} en el conteo
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-stone-50/90 text-center space-y-1.5">
                  <p className="text-xs text-stone-600">Apunta la cámara al código de barras del producto.</p>
                  <button
                    type="button"
                    onClick={() => setMetodoForzado(usandoDetectorNativo ? 'wasm' : 'nativo')}
                    className="text-xs text-orange-600 underline"
                  >
                    ¿No detecta? Probar con el otro método ({usandoDetectorNativo ? 'clásico' : 'nativo'})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Modal: Inventario Inicial (carga de varios productos a la vez) */}
          {modalInventarioInicial && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-2xl w-full shadow-2xl max-h-[95vh] flex flex-col overflow-hidden">
                <div className="bg-white border-b border-stone-100 px-4 sm:px-5 pt-4 pb-3.5 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-xs shrink-0">
                        <i className="fa-solid fa-boxes-stacked text-sm"></i>
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-stone-900 tracking-tight">Registrar Productos</h3>
                        <span className="inline-block text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                          Producto {filaInventarioExpandidaIdx + 1}{filasInventario.length > 1 ? ` de ${filasInventario.length}` : ''}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setModalInventarioInicial(false)} aria-label="Cerrar" className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors shrink-0"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  <p className="mt-2 text-xs text-stone-500 leading-snug">Crea o actualiza la ficha de tus productos (precio, categoría, EAN/SKU). La cantidad se carga después desde "Entrada de Mercadería".</p>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 p-4 sm:p-5">
                  {/* El producto activo (el que se está llenando) siempre va
                      primero, para no tener que bajar entre el historial
                      colapsado cada vez que se agrega uno nuevo. */}
                  {[
                    filaInventarioExpandidaIdx,
                    ...filasInventario.map((_, i) => i).filter((i) => i !== filaInventarioExpandidaIdx)
                  ].map((idx) => {
                    const fila = filasInventario[idx];
                    if (!fila) return null;
                    const esExistente = !!fila.productoExistenteId;
                    const sugerenciasPack = sugerenciasParaFilaPack(fila);
                    const sugerencias = sugerenciasParaFila(fila);
                    const sugerenciasMaestro = sugerenciasMaestroParaFila(fila);
                    const claseCampoVinculado = 'bg-stone-100/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs text-stone-500 cursor-not-allowed';
                    const claseCampoNormal = 'bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#d6bdfa] focus:bg-white focus:ring-2 focus:ring-orange-500/20 transition-all';

                    // Fila ya completada y no es la que se está editando ahora --
                    // se muestra colapsada como un renglón de "historial" en vez
                    // del formulario completo, para que cargar varios productos
                    // seguidos no vuelva la pantalla eterna.
                    if (idx !== filaInventarioExpandidaIdx) {
                      return (
                        <div key={idx} className="p-2.5 rounded-2xl border bg-white border-stone-200/80 shadow-sm flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setFilaInventarioExpandidaIdx(idx)}
                            className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                          >
                            <FotoProducto fotoUrl={fila.foto_url} categoria={fila.categoria} className="w-9 h-9 rounded-lg shrink-0 border border-stone-200" iconClassName="text-xs" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-stone-800 truncate">
                                {fila.descripcion || `(sin nombre todavía)`}
                              </span>
                              <span className="block text-[10px] text-stone-500 truncate">
                                {fila.categoria || '—'} · S/ {Number(fila.precio_venta || 0).toFixed(2)}
                                {fila.vendeEnPack && Number(fila.unidades_por_pack) > 1 ? ` · Pack x${fila.unidades_por_pack}` : ''}
                                {esExistente ? ' · Existente' : ''}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilaInventarioExpandidaIdx(idx)}
                            className="shrink-0 w-7 h-7 flex items-center justify-center text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                            title="Editar este producto"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                          {filasInventario.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarFilaInventario(idx)}
                              className="shrink-0 w-7 h-7 flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Quitar producto"
                            >
                              <i className="fa-solid fa-xmark text-xs"></i>
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                    <div key={idx} className={`rounded-2xl relative border shadow-sm ${esExistente ? 'bg-orange-50/60 border-orange-200' : 'bg-white border-stone-200/80'}`}>
                      {filasInventario.length > 1 && (
                        <button
                          onClick={() => eliminarFilaInventario(idx)}
                          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-stone-100 rounded-full transition z-10"
                          title="Quitar producto"
                        >
                          <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                      )}

                      {esExistente && (
                        <div className="flex items-center justify-between gap-2 px-4 pt-3 text-xs">
                          <span className="font-semibold text-orange-700">
                            <i className="fa-solid fa-check-circle mr-1"></i> Existente — se sumará al stock
                          </span>
                          <button type="button" onClick={() => desvincularFilaInventario(idx)} className="underline text-stone-500 hover:text-stone-700 shrink-0">
                            Quitar vínculo
                          </button>
                        </div>
                      )}

                      {/* --- Sección 1: identificación del producto --- */}
                      <div className="p-4 space-y-3.5">
                        <div className="flex items-center justify-between pb-1 border-b border-stone-100 pr-6">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">Identificación</h4>
                          </div>
                          <span className="text-[11px] text-stone-400 font-medium">Básico</span>
                        </div>

                        {/* Escanear y escribir van en el mismo campo -- si el
                            código ya existe, la fila se autocompleta sola. */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-stone-700">Código EAN / Código de barras <span className="text-stone-400 font-normal">(opcional)</span></label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Escanea o escribe el código..."
                              value={fila.cod_ean}
                              disabled={esExistente}
                              onChange={(e) => actualizarCodigoEanFila(idx, e.target.value)}
                              className={`w-full pr-24 ${esExistente ? claseCampoVinculado : claseCampoNormal}`}
                            />
                            <button
                              type="button"
                              onClick={() => abrirEscanerParaFilaInventario(idx)}
                              disabled={esExistente}
                              className="absolute inset-y-1 right-1 px-2.5 bg-orange-50 hover:bg-orange-100 text-orange-700 disabled:opacity-40 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-orange-200/70 transition-all active:scale-95"
                              title="Escanear código de barras"
                            >
                              <i className="fa-solid fa-camera text-xs"></i> Escanear
                            </button>
                          </div>
                        </div>

                        {!esExistente && (
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-stone-700">Foto del producto <span className="text-stone-400 font-normal">(opcional)</span></label>
                            {sesion?.bodega?.permitir_subir_fotos === false ? (
                              <div className="flex items-center gap-2.5">
                                <FotoProducto fotoUrl={fila.foto_url} categoria={fila.categoria} className="w-16 h-16 rounded-xl shrink-0 border border-stone-200" iconClassName="text-xl" />
                                <p className="text-[10.5px] text-stone-500">La subida de fotos está desactivada para tu bodega.</p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <FotoProducto fotoUrl={fila.foto_url} categoria={fila.categoria} className="w-16 h-16 rounded-xl shrink-0 border-2 border-dashed border-stone-200" iconClassName="text-xl" />
                                <div className="flex-1 flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <label className="flex-1 cursor-pointer py-1.5 px-2.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition">
                                      {subiendoFotoFilaIdx === idx ? (
                                        <i className="fa-solid fa-spinner fa-spin text-stone-500 text-xs"></i>
                                      ) : (
                                        <i className="fa-solid fa-camera text-stone-500 text-xs"></i>
                                      )}
                                      <span>Cámara</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files && e.target.files[0];
                                          e.target.value = '';
                                          if (file) subirFotoFilaInventario(idx, file);
                                        }}
                                      />
                                    </label>
                                    <label className="flex-1 cursor-pointer py-1.5 px-2.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition">
                                      <i className="fa-solid fa-image text-stone-500 text-xs"></i>
                                      <span>Galería</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files && e.target.files[0];
                                          e.target.value = '';
                                          if (file) subirFotoFilaInventario(idx, file);
                                        }}
                                      />
                                    </label>
                                  </div>
                                  <p className="text-[10.5px] text-stone-400 leading-none">O pega una imagen directamente desde el portapapeles</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      <div className="space-y-1.5 relative">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-stone-700">Descripción del producto <span className="text-rose-500 font-bold">*</span></label>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600">
                            <i className="fa-solid fa-wand-magic-sparkles text-orange-500"></i> Catálogo sugerido
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder="Ej: Leche Gloria Entera 400g..."
                          value={fila.descripcion}
                          disabled={esExistente}
                          onChange={(e) => actualizarFilaInventario(idx, 'descripcion', e.target.value)}
                          className={`w-full ${esExistente ? claseCampoVinculado : claseCampoNormal}`}
                        />
                        {(sugerencias.length > 0 || sugerenciasMaestro.length > 0) && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-stone-200 border border-stone-300 rounded-lg shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                            {sugerencias.map((s) => (
                              <button
                                type="button"
                                key={`propio-${s.id}`}
                                onClick={() => vincularProductoExistenteEnFila(idx, s)}
                                className="w-full text-left px-3 py-2 text-xs text-stone-800 hover:bg-stone-300 flex items-center justify-between gap-2"
                              >
                                <span className="truncate">{s.descripcion}</span>
                                <span className="text-stone-500 shrink-0">S/ {Number(s.precio_venta).toFixed(2)}</span>
                              </button>
                            ))}
                            {sugerenciasMaestro.length > 0 && (
                              <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-bold text-stone-500 uppercase tracking-wide bg-stone-100/60">
                                Del catálogo maestro
                              </div>
                            )}
                            {sugerenciasMaestro.map((s) => (
                              <button
                                type="button"
                                key={`maestro-${s.id}`}
                                onClick={() => usarSugerenciaMaestraEnFila(idx, s)}
                                className="w-full text-left px-3 py-2 text-xs text-stone-800 hover:bg-stone-300 flex items-center gap-2"
                              >
                                <FotoProducto fotoUrl={s.foto_url} categoria={s.categoria} className="w-7 h-7 rounded-md shrink-0" iconClassName="text-[10px]" />
                                <span className="truncate flex-1">{s.descripcion}</span>
                                <span className="text-stone-500 shrink-0 text-[10px]">{s.categoria}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-stone-700">Categoría</label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 min-w-0">
                            <i className={`fa-solid ${estiloCategoria(fila.categoria).icono} ${estiloCategoria(fila.categoria).color} absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none`}></i>
                            <select
                              value={fila.categoria}
                              disabled={esExistente}
                              onChange={(e) => actualizarFilaInventario(idx, 'categoria', e.target.value)}
                              className={`w-full pl-8 ${esExistente ? claseCampoVinculado : claseCampoNormal}`}
                            >
                              {!categoriasDB.includes(fila.categoria) && fila.categoria && (
                                <option value={fila.categoria}>{fila.categoria}</option>
                              )}
                              {categoriasDB.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          {!esExistente && (
                            <button
                              type="button"
                              onClick={() => agregarCategoriaPersonalizada((v) => actualizarFilaInventario(idx, 'categoria', v))}
                              title="Agregar categoría nueva"
                              className="shrink-0 self-end w-8 h-8 flex items-center justify-center bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg"
                            >
                              <i className="fa-solid fa-plus text-xs"></i>
                            </button>
                          )}
                        </div>
                        {!esExistente && categoriasDB.length > 0 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar text-[11px]">
                            {categoriasDB.slice(0, 6).map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => actualizarFilaInventario(idx, 'categoria', c)}
                                className={`px-2.5 py-1 rounded-full font-semibold shrink-0 border transition ${fila.categoria === c ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-stone-100 hover:bg-stone-200 text-stone-600 border-transparent'}`}
                              >
                                <i className={`fa-solid ${estiloCategoria(c).icono} mr-1`}></i>{c}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      </div>

                      {/* --- Sección 2: precio y forma de venta --- */}
                      <div className="p-4 border-t border-stone-100 space-y-3.5">
                        <div className="flex items-center justify-between pb-1 border-b border-stone-100">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">Precio y Forma de Venta</h4>
                          </div>
                          <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">S/ (PEN)</span>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-stone-700">Precio de venta POR UNIDAD <span className="text-rose-500 font-bold">*</span></label>
                          <div className="relative rounded-2xl bg-stone-50 border-2 border-stone-200 focus-within:border-orange-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-500/10 transition-all p-3 flex items-baseline">
                            <span className="text-lg font-bold text-stone-400 mr-2 select-none">S/</span>
                            <input
                              type="number"
                              step="0.10"
                              placeholder="0.00"
                              value={fila.precio_venta}
                              onChange={(e) => actualizarFilaInventario(idx, 'precio_venta', e.target.value)}
                              className="w-full bg-transparent border-0 p-0 text-2xl font-black text-stone-900 placeholder:text-stone-300 focus:ring-0 focus:outline-none"
                            />
                            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">PEN</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold text-stone-700">Precio costo POR UNIDAD <span className="text-stone-400 font-normal">(opcional)</span></label>
                            {Number(fila.precio_costo) > 0 && Number(fila.precio_venta) > 0 && (
                              <span className="text-[11px] font-semibold text-emerald-600">
                                Margen: {(((Number(fila.precio_venta) - Number(fila.precio_costo)) / Number(fila.precio_venta)) * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-400 pointer-events-none select-none">S/</span>
                            <input
                              type="number"
                              step="0.10"
                              placeholder="0.00"
                              value={fila.precio_costo}
                              onChange={(e) => actualizarFilaInventario(idx, 'precio_costo', e.target.value)}
                              className={`w-full pl-8 ${claseCampoNormal}`}
                            />
                          </div>
                          {Number(fila.precio_costo) > 0 && (
                            <CalculadoraMargen
                              costo={fila.precio_costo}
                              onAplicar={(precio) => actualizarFilaInventario(idx, 'precio_venta', String(precio))}
                            />
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-stone-700">Se vende por</label>
                          <select
                            value={fila.unidad}
                            disabled={esExistente}
                            onChange={(e) => actualizarFilaInventario(idx, 'unidad', e.target.value)}
                            className={`w-full ${esExistente ? claseCampoVinculado : claseCampoNormal}`}
                          >
                            <option value="UND">Unidad (UND)</option>
                            <option value="KG">Peso (KG) — balanza</option>
                          </select>
                        </div>

                      {/* Venta por pack: la misma bolsa de stock sirve para vender el
                          pack cerrado o unidades sueltas si se abre -- se descuenta en
                          unidades base sin llevar dos contadores separados. */}
                      {fila.unidad !== 'KG' && (
                        <div>
                          <label className={`flex items-start gap-3 p-3 rounded-xl border border-dashed cursor-pointer transition ${fila.vendeEnPack ? 'bg-orange-50/70 border-orange-300' : 'bg-stone-50/70 hover:bg-stone-50 border-stone-300'}`}>
                            <div className="flex items-center h-5 mt-0.5">
                              <input
                                type="checkbox"
                                checked={fila.vendeEnPack}
                                onChange={(e) => actualizarFilaInventario(idx, 'vendeEnPack', e.target.checked)}
                                className="w-4 h-4 rounded text-orange-600 border-stone-300 focus:ring-orange-500"
                              />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${fila.vendeEnPack ? 'bg-orange-500 text-white' : 'bg-stone-200 text-stone-600'}`}>
                                  <i className="fa-solid fa-box"></i>
                                </span>
                                <span className="text-xs font-bold text-stone-800">Vender también en pack o caja cerrada</span>
                              </div>
                              <p className="text-[11px] text-stone-500 mt-1 leading-normal">Ideal para six-packs de cerveza, displays x12 o cajas cerradas x24 con precio especial.</p>
                            </div>
                          </label>
                          {esExistente && fila.vendeEnPackOriginal && !fila.vendeEnPack && (
                            <p className="text-[11px] text-rose-600 font-semibold mt-1">
                              <i className="fa-solid fa-triangle-exclamation mr-1"></i> Este producto ya vendía por pack -- al guardar se le va a quitar esa configuración.
                            </p>
                          )}
                          {fila.vendeEnPack && (
                            <div className="mt-1.5 p-2 bg-white border border-stone-200 rounded-lg space-y-1.5">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-semibold text-stone-500 block mb-0.5">¿De cuántas unidades es el pack?</label>
                                  <input
                                    type="number"
                                    step="1"
                                    min="2"
                                    placeholder="Ej: 6"
                                    value={fila.unidades_por_pack}
                                    onChange={(e) => actualizarFilaInventario(idx, 'unidades_por_pack', e.target.value)}
                                    className={`w-full ${claseCampoNormal}`}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-stone-500 block mb-0.5">Precio del pack completo (S/)</label>
                                  <input
                                    type="number"
                                    step="0.10"
                                    placeholder="Ej: 27.00"
                                    value={fila.precio_venta_pack}
                                    onChange={(e) => actualizarFilaInventario(idx, 'precio_venta_pack', e.target.value)}
                                    className={`w-full ${claseCampoNormal}`}
                                  />
                                </div>
                              </div>
                              {Number(fila.unidades_por_pack) > 1 && Number(fila.precio_venta_pack) > 0 && (
                                <p className="text-[10px] text-stone-500">
                                  = S/ {(Number(fila.precio_venta_pack) / Number(fila.unidades_por_pack)).toFixed(2)} por unidad dentro del pack (vs. S/ {Number(fila.precio_venta || 0).toFixed(2)} por unidad suelta)
                                </p>
                              )}
                              <div>
                                <label className="text-[10px] font-semibold text-stone-500 block mb-0.5">Código EAN del pack (opcional)</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Si ya existe, se vincula solo"
                                  value={fila.cod_ean_pack}
                                  onChange={(e) => actualizarCodigoEanPackFila(idx, e.target.value)}
                                  className={`w-full pr-9 ${claseCampoNormal}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => abrirEscanerParaFilaInventario(idx, 'cod_ean_pack')}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-stone-600 hover:text-orange-600 transition"
                                  title="Escanear código de barras del pack"
                                >
                                  <i className="fa-solid fa-camera text-xs"></i>
                                </button>
                                {sugerenciasPack.length > 0 && (
                                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-stone-200 border border-stone-300 rounded-lg shadow-xl overflow-hidden">
                                    {sugerenciasPack.map((s) => (
                                      <button
                                        type="button"
                                        key={s.id}
                                        onClick={() => vincularProductoExistenteEnFila(idx, s)}
                                        className="w-full text-left px-3 py-2 text-xs text-stone-800 hover:bg-stone-300 flex items-center justify-between gap-2"
                                      >
                                        <span className="truncate">{s.descripcion}{s.sku ? ` · ${s.sku}` : ''}</span>
                                        <span className="text-stone-500 shrink-0">S/ {Number(s.precio_venta).toFixed(2)}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      </div>

                      {/* --- Sección 3: dato interno opcional --- */}
                      <div className="p-4 border-t border-stone-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                            <label className="text-xs font-semibold text-stone-700">SKU <span className="text-stone-400 font-normal">(código interno, opcional)</span></label>
                          </div>
                          <span className="text-[10px] text-orange-600 bg-orange-50 font-medium px-2 py-0.5 rounded-md border border-orange-100">Auto-generado</span>
                        </div>
                        <input
                          type="text"
                          placeholder="Se genera solo si lo dejas vacío"
                          value={fila.sku}
                          onChange={(e) => actualizarFilaInventario(idx, 'sku', e.target.value)}
                          className={`w-full ${claseCampoNormal}`}
                        />
                      </div>
                    </div>
                    );
                  })}
                </div>

                <div className="shrink-0 bg-white border-t border-stone-200 p-4 space-y-2.5 shadow-[0_-4px_18px_rgba(15,23,42,0.06)]">
                  <button
                    onClick={agregarFilaInventario}
                    className="w-full py-2.5 px-4 rounded-full border border-stone-200 bg-white/70/80 hover:bg-white/70/70 text-stone-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.99] shadow-sm"
                  >
                    <span className="text-base font-medium leading-none">+</span> Agregar otro producto
                  </button>
                  <button
                    onClick={guardarInventarioInicial}
                    disabled={guardandoInventario}
                    className="w-full py-3.5 px-4 rounded-xl bg-stone-900 hover:bg-black active:scale-[0.99] disabled:opacity-60 text-white font-bold text-xs tracking-wide shadow-md flex items-center justify-center gap-2 transition"
                  >
                    {guardandoInventario ? (
                      <><i className="fa-solid fa-spinner fa-spin"></i> Guardando...</>
                    ) : (
                      <><i className="fa-solid fa-check text-emerald-400"></i> Guardar Inventario</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Combos */}
          {modalCombos && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-lg w-full p-5 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-start shrink-0">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-[9px] bg-[#f4eefe] flex items-center justify-center shrink-0"><i className="fa-solid fa-gift text-sm text-[#6105dc]"></i></span> Combos
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">Paquetes de varios productos a un precio especial. Al venderse, descuentan el stock real de cada producto que los compone.</p>
                  </div>
                  <button onClick={() => { setModalCombos(false); setFormCombo(null); }} className="text-stone-600 hover:text-stone-900 shrink-0"><i className="fa-solid fa-xmark"></i></button>
                </div>

                {!formCombo ? (
                  <>
                    <button
                      onClick={nuevoCombo}
                      className="w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white text-sm font-bold rounded-full shadow flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <i className="fa-solid fa-plus"></i> Nuevo Combo
                    </button>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {cargandoCombos ? (
                        <p className="text-xs text-center py-8 text-stone-500">Cargando combos...</p>
                      ) : combos.length === 0 ? (
                        <p className="text-xs text-center py-8 text-stone-500">Todavía no tienes combos. Crea el primero arriba.</p>
                      ) : (
                        combos.map((combo) => (
                          <div key={combo.id} className={`p-3 rounded-xl border ${combo.activo ? 'bg-white border-stone-200' : 'bg-stone-100 border-stone-200 opacity-70'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-stone-900 truncate">{combo.nombre}</p>
                                <p className="text-[11px] text-stone-500 truncate">
                                  {(combo.combos_items || []).length} producto{(combo.combos_items || []).length === 1 ? '' : 's'} · S/ {Number(combo.precio_venta).toFixed(2)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Interruptor activo={combo.activo} onClick={() => alternarActivoCombo(combo)} etiqueta="" title={combo.activo ? 'Activo (visible para vender)' : 'Inactivo'} />
                                <button onClick={() => editarCombo(combo)} className="w-7 h-7 flex items-center justify-center text-stone-500 hover:text-orange-600" title="Editar">
                                  <i className="fa-solid fa-pen text-xs"></i>
                                </button>
                                <button onClick={() => eliminarCombo(combo)} className="w-7 h-7 flex items-center justify-center text-stone-500 hover:text-rose-600" title="Eliminar">
                                  <i className="fa-solid fa-trash-can text-xs"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    <div>
                      <label className="text-xs font-semibold text-stone-600 block mb-1">Nombre del combo *</label>
                      <input
                        type="text"
                        placeholder="Ej: Combo Desayuno"
                        value={formCombo.nombre}
                        onChange={(e) => setFormCombo({ ...formCombo, nombre: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-sm text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-stone-600 block mb-1">Descripción (opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej: Pan, leche y huevos para empezar el día"
                        value={formCombo.descripcion}
                        onChange={(e) => setFormCombo({ ...formCombo, descripcion: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-sm text-stone-900"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-600 block mb-1">Productos del combo *</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Buscar producto para agregar..."
                          value={busquedaProductoCombo}
                          onChange={(e) => setBusquedaProductoCombo(e.target.value)}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-sm text-stone-900"
                        />
                        {busquedaProductoCombo.trim() && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-stone-300 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                            {productos
                              .filter((p) => p.descripcion.toLowerCase().includes(busquedaProductoCombo.trim().toLowerCase()) || (p.cod_ean || '').includes(busquedaProductoCombo.trim()))
                              .slice(0, 8)
                              .map((p) => (
                                <button
                                  type="button"
                                  key={p.id}
                                  onClick={() => agregarProductoAFormCombo(p)}
                                  className="w-full text-left px-3 py-2 text-xs text-stone-800 hover:bg-stone-100 flex items-center justify-between gap-2"
                                >
                                  <span className="truncate">{p.descripcion}</span>
                                  <span className="text-stone-500 shrink-0">S/ {Number(p.precio_venta).toFixed(2)}</span>
                                </button>
                              ))}
                            {productos.filter((p) => p.descripcion.toLowerCase().includes(busquedaProductoCombo.trim().toLowerCase())).length === 0 && (
                              <p className="px-3 py-2 text-xs text-stone-400">Sin resultados.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {formCombo.items.length > 0 && (
                      <div className="bg-white border border-stone-200 rounded-xl p-1.5 divide-y divide-stone-100">
                        {formCombo.items.map((it) => (
                          <div key={it.producto_id} className="flex items-center gap-2.5 py-2 px-1">
                            <span className="w-7 h-7 rounded-full bg-[#f4eefe] flex items-center justify-center shrink-0">
                              <i className="fa-solid fa-box text-xs text-[#6105dc]"></i>
                            </span>
                            <span className="flex-1 min-w-0 text-xs font-medium text-stone-800 truncate">{it.descripcion}</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={it.cantidad}
                              onChange={(e) => actualizarCantidadItemCombo(it.producto_id, e.target.value)}
                              className="w-14 bg-stone-100 border border-stone-200 rounded px-2 py-1 text-xs text-stone-900 text-center"
                            />
                            <span className="text-[11px] font-semibold text-stone-600 w-16 shrink-0 text-right">S/ {(it.precio_venta * it.cantidad).toFixed(2)}</span>
                            <button onClick={() => quitarItemCombo(it.producto_id)} className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-rose-600 shrink-0">
                              <i className="fa-solid fa-xmark text-xs"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-stone-600 block mb-1">Precio del combo (S/) *</label>
                        <input
                          type="number"
                          step="0.10"
                          placeholder="0.00"
                          value={formCombo.precio_venta}
                          onChange={(e) => setFormCombo({ ...formCombo, precioTocado: true, precio_venta: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-3 py-1.5 text-sm font-bold text-stone-900"
                        />
                      </div>
                      <div className={`flex flex-col justify-center rounded-lg px-3 py-1.5 ${precioNormalCombo(formCombo) > 0 && Number(formCombo.precio_venta) > 0 ? 'bg-emerald-50' : 'bg-stone-100'}`}>
                        <span className="text-[11px] text-stone-500">Precio sumado: S/ {precioNormalCombo(formCombo).toFixed(2)}</span>
                        {precioNormalCombo(formCombo) > 0 && Number(formCombo.precio_venta) > 0 && (
                          <span className="text-sm font-bold text-emerald-700">
                            Ahorro: {(100 - (Number(formCombo.precio_venta) / precioNormalCombo(formCombo)) * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {precioNormalCombo(formCombo) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-stone-500 shrink-0">Descuento rápido:</span>
                        {[5, 10, 15].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => aplicarDescuentoRapidoCombo(pct)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-stone-200 hover:bg-[#f4eefe] hover:text-[#6105dc] text-stone-700 rounded-lg transition"
                          >
                            -{pct}%
                          </button>
                        ))}
                      </div>
                    )}

                    {costoNormalCombo(formCombo) > 0 && Number(formCombo.precio_venta) > 0 && Number(formCombo.precio_venta) < costoNormalCombo(formCombo) && (
                      <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        El precio (S/ {Number(formCombo.precio_venta).toFixed(2)}) es menor al costo de estos productos (S/ {costoNormalCombo(formCombo).toFixed(2)}) -- estarías vendiendo a pérdida.
                      </p>
                    )}

                    <Interruptor activo={formCombo.activo} onClick={() => setFormCombo({ ...formCombo, activo: !formCombo.activo })} etiqueta="Combo activo (visible para vender)" />

                    <div className="flex gap-2 pt-1 shrink-0">
                      <button onClick={() => setFormCombo(null)} className="flex-1 py-2.5 bg-white/70 hover:bg-[#ece0fd] text-stone-600 text-sm font-semibold rounded-full shadow-sm">
                        Cancelar
                      </button>
                      <button
                        onClick={guardarCombo}
                        disabled={guardandoCombo}
                        className="flex-1 py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-sm rounded-full shadow"
                      >
                        {guardandoCombo ? 'Guardando...' : 'Guardar Combo'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal: Registrar Merma */}
          {modalMerma && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-amber-600"></i> Registrar Merma
                  </h3>
                  <button onClick={() => setModalMerma(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <p className="text-xs text-stone-600">Para productos vencidos, rotos, robados o perdidos. Se descuenta del stock automáticamente.</p>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Producto:</label>
                  <select
                    value={formMerma.productoId}
                    onChange={(e) => setFormMerma({ ...formMerma, productoId: e.target.value })}
                    className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                  >
                    <option value="">-- Seleccionar producto --</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>{p.descripcion}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-stone-600 block mb-1">Cantidad:</label>
                    <input
                      type="number"
                      step="0.10"
                      value={formMerma.cantidad}
                      onChange={(e) => setFormMerma({ ...formMerma, cantidad: e.target.value })}
                      className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-600 block mb-1">Motivo:</label>
                    <select
                      value={formMerma.motivo}
                      onChange={(e) => setFormMerma({ ...formMerma, motivo: e.target.value })}
                      className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                    >
                      <option value="Vencido">Vencido</option>
                      <option value="Roto/Dañado">Roto/Dañado</option>
                      <option value="Robo/Pérdida">Robo/Pérdida</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={registrarMermaProducto}
                  disabled={guardandoMerma}
                  className="w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow"
                >
                  {guardandoMerma ? 'Guardando...' : 'Registrar Merma'}
                </button>
              </div>
            </div>
          )}

          {/* Modal: Productos con Stock Bajo */}
          {modalStockBajo && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full p-5 shadow-2xl space-y-3 max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-amber-600"></i> Stock Bajo / Por Agotarse
                  </h3>
                  <button onClick={() => setModalStockBajo(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {productos.filter((p) => p.stock_actual != null && Number(p.stock_actual) <= Number(p.stock_min || 5)).length === 0 ? (
                    <p className="text-xs text-emerald-600 text-center py-8"><i className="fa-solid fa-circle-check mr-1"></i> Todo tu stock está en buen nivel.</p>
                  ) : (
                    productos
                      .filter((p) => p.stock_actual != null && Number(p.stock_actual) <= Number(p.stock_min || 5))
                      .sort((a, b) => Number(a.stock_actual) - Number(b.stock_actual))
                      .map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 bg-stone-50 border border-stone-200 rounded-xl">
                          <div>
                            <p className="text-xs font-semibold text-stone-800">{p.descripcion}</p>
                            <p className="text-xs text-stone-500">Mínimo: {p.stock_min || 5}</p>
                          </div>
                          <span className={`text-sm font-black ${Number(p.stock_actual) <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                            {Number(p.stock_actual) <= 0 ? 'Sin stock' : `${p.stock_actual}`}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal: Ver Stock (todo el catálogo) */}
          {modalVerStock && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-2xl w-full p-5 shadow-2xl space-y-3 max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-table-list text-orange-600"></i> Ver Stock
                  </h3>
                  <button onClick={() => setModalVerStock(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="flex gap-2 shrink-0">
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={verStockBusqueda}
                    onChange={(e) => setVerStockBusqueda(e.target.value)}
                    className="flex-1 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                  />
                  <select
                    value={verStockCategoria}
                    onChange={(e) => setVerStockCategoria(e.target.value)}
                    className="bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                  >
                    <option value="">Todas las categorías</option>
                    {categoriasDB.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {productosVerStock.length === 0 ? (
                    <p className="text-xs text-stone-500 text-center py-8">No hay productos que coincidan.</p>
                  ) : (
                    productosVerStock.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-stone-50 border border-stone-200 rounded-xl">
                        <div>
                          <p className="text-xs font-semibold text-stone-800">{p.descripcion}</p>
                          <p className="text-xs text-stone-500">{p.categoria || 'General'} · Mínimo: {p.stock_min || 5}</p>
                        </div>
                        <span className={`text-sm font-black ${
                          Number(p.stock_actual) <= 0 ? 'text-rose-600' : Number(p.stock_actual) <= Number(p.stock_min || 5) ? 'text-amber-600' : 'text-stone-700'
                        }`}>
                          {Number(p.stock_actual) <= 0 ? 'Sin stock' : `${p.stock_actual}`}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal: Toma de Inventario (conteo físico vs. sistema) -- 2 pasos:
              "conteo" (se busca y anota lo contado, sin ver el stock del
              sistema) y "revision" (recién ahí se compara y se guarda, lo
              que ajusta el stock automáticamente si hay diferencia). */}
          {modalTomaInventario && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-2xl w-full p-5 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-start shrink-0">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                      <i className="fa-solid fa-clipboard-check text-orange-600"></i> Toma de Inventario
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                        Paso {pasoTomaInventario === 'conteo' ? '1' : '2'} de 2
                      </span>
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {pasoTomaInventario === 'conteo'
                        ? 'Busca cada producto y ve sumando lo que encuentres en cada lugar del local.'
                        : 'Revisa lo contado contra el sistema y guarda para ajustar el stock.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {filasTomaInventario.length > 0 && (
                      <button onClick={vaciarConteoInventario} className="text-[11px] font-semibold text-rose-600 hover:text-rose-700">
                        Vaciar
                      </button>
                    )}
                    <button onClick={() => setModalTomaInventario(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                </div>

                {pasoTomaInventario === 'conteo' ? (
                  <>
                    <div className="flex gap-1.5 shrink-0">
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Buscar o escanear producto..."
                          value={conteoFisicoBusqueda}
                          onChange={(e) => setConteoFisicoBusqueda(e.target.value)}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-2 text-xs text-stone-900"
                        />
                        {resultadosBusquedaConteo.length > 0 && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                            {resultadosBusquedaConteo.map((p) => {
                              const yaContado = filasTomaInventario.find((f) => f.productoId === p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => agregarProductoAConteo(p)}
                                  className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-xs text-stone-800 hover:bg-orange-50 border-b border-stone-100 last:border-0"
                                >
                                  <span className="truncate">{p.descripcion}</span>
                                  {yaContado && (
                                    <span className="shrink-0 text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                                      {yaContado.stockContado === '' ? 'sumar más' : `${yaContado.stockContado} und · sumar más`}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setModoEscaner('toma-inventario'); setMetodoForzado(null); setModalEscaner(true); }}
                        title="Escanear con la cámara"
                        className="shrink-0 w-10 flex items-center justify-center bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg"
                      >
                        <i className="fa-solid fa-camera"></i>
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {filasTomaInventario.length === 0 ? (
                        <p className="text-xs text-stone-500 text-center py-8">Aún no agregas ningún producto al conteo.</p>
                      ) : (
                        <>
                          {(() => {
                            const f = filasTomaInventario[0];
                            const porPack = Number(f.pendienteUnidadesPorPack) || 1;
                            const totalPendiente = (Number(f.pendientePacks) || 0) * porPack + (Number(f.pendienteSueltas) || 0);
                            return (
                              <div className="p-2.5 bg-stone-50 border border-orange-300 rounded-xl space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <p className="flex-1 min-w-0 text-xs font-semibold text-stone-800 truncate">{f.descripcion}</p>
                                  <span className="text-xs font-bold text-orange-600 shrink-0">
                                    {f.stockContado === '' ? 'Sin contar' : `${f.stockContado} und`}
                                  </span>
                                  <button onClick={() => quitarProductoDeConteo(f.productoId)} className="text-stone-400 hover:text-rose-600 shrink-0">
                                    <i className="fa-solid fa-trash-can"></i>
                                  </button>
                                </div>

                                {f.historial.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {f.historial.map((h) => (
                                      <span key={h.id} className="inline-flex items-center gap-1 bg-stone-200 rounded-full pl-2 pr-1 py-0.5 text-[11px] text-stone-700">
                                        +{h.cantidad}
                                        <button onClick={() => quitarHallazgo(f.productoId, h.id)} className="w-3.5 h-3.5 flex items-center justify-center text-stone-500 hover:text-rose-600">
                                          <i className="fa-solid fa-xmark text-[9px]"></i>
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center gap-1.5">
                                  <div className="flex flex-col items-center">
                                    <input
                                      type="number"
                                      ref={(el) => { refsPendientesConteo.current[f.productoId] = el; }}
                                      placeholder="0"
                                      value={f.pendientePacks}
                                      onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendientePacks', e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') agregarHallazgo(f.productoId); }}
                                      className="w-14 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2 py-1.5 text-xs text-stone-900 text-center"
                                    />
                                    <span className="text-[9px] text-stone-500">packs</span>
                                  </div>
                                  <span className="text-[10px] text-stone-400">de</span>
                                  <div className="flex flex-col items-center">
                                    {editandoPackParaId === f.productoId ? (
                                      <input
                                        type="number"
                                        autoFocus
                                        placeholder="1"
                                        value={f.pendienteUnidadesPorPack}
                                        onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendienteUnidadesPorPack', e.target.value)}
                                        onBlur={() => setEditandoPackParaId(null)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') setEditandoPackParaId(null); }}
                                        className="w-14 bg-white border border-orange-400 rounded-lg px-2 py-1.5 text-xs text-stone-900 text-center"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setEditandoPackParaId(f.productoId)}
                                        title="Tocar para cambiar las unidades por pack"
                                        className="w-14 h-[30px] bg-stone-200 border border-stone-300 rounded-lg text-xs font-bold text-stone-700"
                                      >
                                        x{f.pendienteUnidadesPorPack || 1}
                                      </button>
                                    )}
                                    <span className="text-[9px] text-stone-500 flex items-center gap-0.5">
                                      {editandoPackParaId !== f.productoId && <i className="fa-solid fa-lock text-[7px]"></i>} und c/u
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-stone-400">+</span>
                                  <div className="flex flex-col items-center">
                                    <input
                                      type="number"
                                      placeholder="0"
                                      value={f.pendienteSueltas}
                                      onChange={(e) => actualizarPendienteConteo(f.productoId, 'pendienteSueltas', e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') agregarHallazgo(f.productoId); }}
                                      className="w-14 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2 py-1.5 text-xs text-stone-900 text-center"
                                    />
                                    <span className="text-[9px] text-stone-500">sueltas</span>
                                  </div>
                                  <span className="text-xs font-bold text-orange-600 ml-auto shrink-0">= {totalPendiente} und</span>
                                </div>
                                <button onClick={() => agregarHallazgo(f.productoId)} className="w-full py-1.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white rounded-full text-[11px] font-bold">
                                  <i className="fa-solid fa-plus"></i> Agregar
                                </button>
                              </div>
                            );
                          })()}

                          {filasTomaInventario.length > 1 && (
                            <div className="border border-stone-200 rounded-xl overflow-hidden shrink-0">
                              <button
                                onClick={() => setHistorialConteoAbierto((v) => !v)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-stone-200/60 hover:bg-stone-200 text-xs font-bold text-stone-700"
                              >
                                <span><i className="fa-solid fa-clock-rotate-left mr-1.5"></i>Historial ({filasTomaInventario.length - 1})</span>
                                <i className={`fa-solid fa-chevron-${historialConteoAbierto ? 'up' : 'down'}`}></i>
                              </button>
                              {historialConteoAbierto && (
                                <div className="divide-y divide-stone-200 max-h-40 overflow-y-auto">
                                  {filasTomaInventario.slice(1).map((f) => (
                                    <div key={f.productoId} className="flex items-center gap-2 px-3 py-2 bg-white text-xs">
                                      <span className="flex-1 min-w-0 truncate text-stone-700">{f.descripcion}</span>
                                      <span className="font-bold text-orange-600 shrink-0">
                                        {f.stockContado === '' ? 'Sin contar' : `${f.stockContado} und`}
                                      </span>
                                      <button
                                        onClick={() => promoverAActivoConteo(f.productoId)}
                                        className="shrink-0 text-[10px] font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-md"
                                      >
                                        Sumar más
                                      </button>
                                      <button onClick={() => quitarProductoDeConteo(f.productoId)} className="shrink-0 text-stone-400 hover:text-rose-600">
                                        <i className="fa-solid fa-trash-can"></i>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      onClick={continuarARevisionInventario}
                      disabled={filasTomaInventario.length === 0}
                      className="w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-50 text-white font-bold text-xs rounded-full shadow shrink-0"
                    >
                      {filasTomaInventario.length === 0 ? 'Agrega al menos un producto' : `Continuar a Revisión (${filasTomaInventario.length})`}
                      {filasTomaInventario.length > 0 && <i className="fa-solid fa-arrow-right ml-1.5"></i>}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2 shrink-0">
                      <input
                        type="text"
                        placeholder="Buscar en lo contado..."
                        value={tomaInventarioBusqueda}
                        onChange={(e) => setTomaInventarioBusqueda(e.target.value)}
                        className="flex-1 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                      />
                      <select
                        value={tomaInventarioCategoria}
                        onChange={(e) => setTomaInventarioCategoria(e.target.value)}
                        className="bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                      >
                        <option value="">Todas las categorías</option>
                        {categoriasDB.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1.5">
                      {filasTomaInventarioVisibles.length === 0 ? (
                        <p className="text-xs text-stone-500 text-center py-8">No hay productos que coincidan.</p>
                      ) : (
                        filasTomaInventarioVisibles.map((f) => {
                          const diferencia = f.stockContado === '' ? null : (Number(f.stockContado) || 0) - f.stockSistema;
                          return (
                            <div key={f.productoId} className="flex items-center gap-2 p-2.5 bg-stone-50 border border-stone-200 rounded-xl">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-stone-800 truncate">{f.descripcion}</p>
                                <p className="text-xs text-stone-500">Sistema: {f.stockSistema}</p>
                              </div>
                              <input
                                type="number"
                                step="0.10"
                                placeholder="Contado"
                                value={f.stockContado}
                                onChange={(e) => actualizarStockContado(f.productoId, e.target.value)}
                                className="w-20 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2 py-1.5 text-xs text-stone-900 text-right"
                              />
                              <span className={`w-14 text-right text-xs font-bold ${
                                diferencia === null || diferencia === 0 ? 'text-stone-400' : diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                {diferencia === null ? '—' : diferencia > 0 ? `+${diferencia}` : diferencia}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 text-center shrink-0">
                      <i className="fa-solid fa-circle-info mr-1"></i>
                      Al guardar, el stock del sistema se ajusta solo para que quede igual al contado.
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setPasoTomaInventario('conteo')}
                        className="py-2.5 px-4 bg-white/70 hover:bg-[#ece0fd] text-stone-600 font-bold text-xs rounded-full shrink-0 shadow-sm"
                      >
                        <i className="fa-solid fa-arrow-left mr-1.5"></i> Seguir contando
                      </button>
                      <button
                        onClick={guardarTomaInventario}
                        disabled={guardandoTomaInventario}
                        className="flex-1 py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-50 text-white font-bold text-xs rounded-full shadow"
                      >
                        {guardandoTomaInventario ? 'Guardando...' : 'Guardar y Ajustar Stock'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Modal: Editar / Desactivar Producto */}
          {modalEditarProducto && formEditarProducto && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full p-5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-pen text-orange-600"></i> Editar Producto
                  </h3>
                  <button onClick={() => setModalEditarProducto(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="flex items-center gap-3">
                  {sesion?.bodega?.permitir_subir_fotos === false ? (
                    <>
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-stone-200">
                        <FotoProducto
                          fotoUrl={formEditarProducto.foto_url}
                          categoria={formEditarProducto.categoria}
                          className="w-16 h-16"
                          iconClassName="text-xl"
                        />
                      </div>
                      <p className="text-xs text-stone-500">
                        <span className="font-semibold text-stone-700 block">Foto del producto</span>
                        La subida de fotos está desactivada para tu bodega. Contacta a Kaserita si la necesitas.
                      </p>
                    </>
                  ) : (
                    <>
                      <label className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 cursor-pointer group border border-stone-200">
                        <FotoProducto
                          fotoUrl={formEditarProducto.foto_url}
                          categoria={formEditarProducto.categoria}
                          className="w-16 h-16"
                          iconClassName="text-xl"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition">
                          {subiendoFotoProducto ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <i className="fa-solid fa-camera text-white text-sm opacity-0 group-hover:opacity-100 transition"></i>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files && e.target.files[0];
                            e.target.value = '';
                            if (file) subirFotoProducto(file);
                          }}
                        />
                      </label>
                      <p className="text-xs text-stone-500">
                        <span className="font-semibold text-stone-700 block">Foto del producto</span>
                        Toca el cuadro para {formEditarProducto.foto_url ? 'cambiarla' : 'subir una'}, o copia una imagen y pégala con Ctrl+V.
                      </p>
                    </>
                  )}
                </div>
                <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${formEditarProducto.es_destacado ? 'bg-[#f4eefe] border-[#d6bdfa]' : 'bg-white border-stone-200'}`}>
                  <input
                    type="checkbox"
                    checked={formEditarProducto.es_destacado}
                    onChange={(e) => setFormEditarProducto({ ...formEditarProducto, es_destacado: e.target.checked })}
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                  />
                  <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${formEditarProducto.es_destacado ? 'bg-[#6105dc] text-white' : 'bg-stone-100 text-stone-500'}`}>
                    <i className="fa-solid fa-star text-xs"></i>
                  </span>
                  <span>
                    <span className="block text-xs font-bold text-stone-800">Destacar en Kaserita Delivery</span>
                    <span className="block text-[10px] text-stone-500">Aparece en el carrusel de destacados de tu tienda online. Podés marcar varios productos.</span>
                  </span>
                </label>
                <div className="space-y-2.5">
                  <div>
                    <label className="text-xs text-stone-600 block mb-1">Descripción / Nombre:</label>
                    <input
                      type="text"
                      value={formEditarProducto.descripcion}
                      onChange={(e) => setFormEditarProducto({ ...formEditarProducto, descripcion: e.target.value })}
                      className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Precio Venta POR UNIDAD (S/):</label>
                      <input
                        type="number"
                        step="0.10"
                        value={formEditarProducto.precio_venta}
                        onChange={(e) => setFormEditarProducto({ ...formEditarProducto, precio_venta: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Precio Costo (S/):</label>
                      <input
                        type="number"
                        step="0.10"
                        value={formEditarProducto.precio_costo}
                        onChange={(e) => setFormEditarProducto({ ...formEditarProducto, precio_costo: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                      />
                      {Number(formEditarProducto.precio_costo) > 0 && (
                        <CalculadoraMargen
                          costo={formEditarProducto.precio_costo}
                          onAplicar={(precio) => setFormEditarProducto({ ...formEditarProducto, precio_venta: String(precio) })}
                        />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Código EAN:</label>
                      <input
                        type="text"
                        value={formEditarProducto.cod_ean}
                        onChange={(e) => setFormEditarProducto({ ...formEditarProducto, cod_ean: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Categoría:</label>
                      <div className="flex gap-1.5">
                        <select
                          value={formEditarProducto.categoria}
                          onChange={(e) => setFormEditarProducto({ ...formEditarProducto, categoria: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                        >
                          {!categoriasDB.includes(formEditarProducto.categoria) && formEditarProducto.categoria && (
                            <option value={formEditarProducto.categoria}>{formEditarProducto.categoria}</option>
                          )}
                          {categoriasDB.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => agregarCategoriaPersonalizada((v) => setFormEditarProducto((prev) => ({ ...prev, categoria: v })))}
                          title="Agregar categoría nueva"
                          className="shrink-0 w-8 h-8 flex items-center justify-center bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Unidad:</label>
                      <select
                        value={formEditarProducto.unidad}
                        onChange={(e) => setFormEditarProducto({ ...formEditarProducto, unidad: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                      >
                        <option value="UND">Unidad (UND)</option>
                        <option value="KG">Kilogramo (KG)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Stock actual:</label>
                      <input
                        type="number"
                        step="0.10"
                        value={formEditarProducto.stock_actual}
                        onChange={(e) => setFormEditarProducto({ ...formEditarProducto, stock_actual: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                      />
                    </div>
                  </div>
                  {formEditarProducto.unidad !== 'KG' && (
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formEditarProducto.vendeEnPack}
                          onChange={(e) => setFormEditarProducto({ ...formEditarProducto, vendeEnPack: e.target.checked })}
                          className="w-3.5 h-3.5"
                        />
                        <i className="fa-solid fa-box mr-1"></i> También se vende en pack/caja cerrada (ej: six-pack, caja x12)
                      </label>
                      {formEditarProducto.vendeEnPack && (
                        <div className="mt-1.5 p-2 bg-white border border-stone-200 rounded-lg space-y-1.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-stone-500 block mb-0.5">¿De cuántas unidades es el pack?</label>
                              <input
                                type="number"
                                step="1"
                                min="2"
                                placeholder="Ej: 6"
                                value={formEditarProducto.unidades_por_pack}
                                onChange={(e) => setFormEditarProducto({ ...formEditarProducto, unidades_por_pack: e.target.value })}
                                className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-stone-500 block mb-0.5">Precio del pack completo (S/)</label>
                              <input
                                type="number"
                                step="0.10"
                                placeholder="Ej: 27.00"
                                value={formEditarProducto.precio_venta_pack}
                                onChange={(e) => setFormEditarProducto({ ...formEditarProducto, precio_venta_pack: e.target.value })}
                                className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                              />
                            </div>
                          </div>
                          {Number(formEditarProducto.unidades_por_pack) > 1 && Number(formEditarProducto.precio_venta_pack) > 0 && (
                            <p className="text-[10px] text-stone-500">
                              = S/ {(Number(formEditarProducto.precio_venta_pack) / Number(formEditarProducto.unidades_por_pack)).toFixed(2)} por unidad dentro del pack (vs. S/ {Number(formEditarProducto.precio_venta || 0).toFixed(2)} por unidad suelta)
                            </p>
                          )}
                          <div>
                            <label className="text-[10px] font-semibold text-stone-500 block mb-0.5">Código EAN del pack (opcional, si es distinto al de la unidad)</label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Si ya existe, se vincula solo"
                              value={formEditarProducto.cod_ean_pack}
                              onChange={(e) => setFormEditarProducto({ ...formEditarProducto, cod_ean_pack: e.target.value })}
                              className="w-full pr-9 bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                            />
                            <button
                              type="button"
                              onClick={() => { setModoEscaner('editar-pack-ean'); setMetodoForzado(null); setModalEscaner(true); }}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-stone-600 hover:text-orange-600 transition"
                              title="Escanear código de barras del pack"
                            >
                              <i className="fa-solid fa-camera text-xs"></i>
                            </button>
                          </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-stone-600 block mb-1">SKU (código interno):</label>
                    <input
                      type="text"
                      value={formEditarProducto.sku}
                      onChange={(e) => setFormEditarProducto({ ...formEditarProducto, sku: e.target.value })}
                      className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                    />
                  </div>
                  {!(sesion?.bodega?.permitir_subir_fotos === false) && (
                    <div className="pt-1.5 border-t border-stone-200 space-y-1.5">
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Descripción para la vitrina (Kaserita Delivery, opcional):</label>
                        <textarea
                          value={formEditarProducto.descripcion_larga}
                          onChange={(e) => setFormEditarProducto({ ...formEditarProducto, descripcion_larga: e.target.value })}
                          rows={2}
                          placeholder="Ej: tela, talla, colores disponibles..."
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Fotos adicionales para la vitrina (hasta 4):</label>
                        <div className="flex flex-wrap gap-2">
                          {formEditarProducto.fotos_extra.map((url, idx) => (
                            <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-stone-200 shrink-0">
                              <img src={url} className="w-full h-full object-cover" alt="" />
                              <button
                                type="button"
                                onClick={() => quitarFotoExtra(idx)}
                                className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center bg-black/60 text-white text-[10px] rounded-bl"
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          ))}
                          {formEditarProducto.fotos_extra.length < 4 && (
                            <label className="relative w-14 h-14 rounded-lg border border-dashed border-stone-300 flex items-center justify-center cursor-pointer text-stone-400 hover:text-stone-600 hover:border-stone-400 shrink-0">
                              {subiendoFotoExtra ? (
                                <div className="w-3.5 h-3.5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <i className="fa-solid fa-plus text-sm"></i>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files && e.target.files[0];
                                  e.target.value = '';
                                  if (file) subirFotoExtraProducto(file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={desactivarProducto}
                    title="Eliminar producto"
                    className="px-4 py-2.5 bg-rose-950/60 hover:bg-rose-900 text-rose-600 text-xs font-semibold rounded-full border border-rose-800"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                  <button
                    onClick={guardarEdicionProducto}
                    disabled={guardandoEdicionProducto}
                    className="flex-1 py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow"
                  >
                    {guardandoEdicionProducto ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Importar del Catálogo Maestro */}
          {modalImportarMaestro && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-lg w-full p-5 shadow-2xl space-y-3 max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-book text-orange-600"></i> Importar del Catálogo Maestro
                  </h3>
                  <button onClick={() => setModalImportarMaestro(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>

                {productoMaestroSeleccionado ? (
                  <form onSubmit={importarProductoMaestro} className="space-y-2.5 overflow-y-auto">
                    <button type="button" onClick={() => setProductoMaestroSeleccionado(null)} className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-1">
                      <i className="fa-solid fa-arrow-left"></i> Volver a la búsqueda
                    </button>
                    <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl p-3">
                      <FotoProducto fotoUrl={productoMaestroSeleccionado.foto_url} categoria={productoMaestroSeleccionado.categoria} className="w-14 h-14 rounded-lg shrink-0" iconClassName="text-xl" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-stone-900 truncate">{productoMaestroSeleccionado.descripcion}</p>
                        <p className="text-xs text-stone-500">{productoMaestroSeleccionado.categoria || 'Sin categoría'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Precio Venta (S/):</label>
                        <input
                          type="number" step="0.10" required
                          value={formImportarMaestro.precio_venta}
                          onChange={(e) => setFormImportarMaestro({ ...formImportarMaestro, precio_venta: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Precio Costo (S/):</label>
                        <input
                          type="number" step="0.10"
                          value={formImportarMaestro.precio_costo}
                          onChange={(e) => setFormImportarMaestro({ ...formImportarMaestro, precio_costo: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Stock inicial:</label>
                        <input
                          type="number" step="1"
                          value={formImportarMaestro.stock_actual}
                          onChange={(e) => setFormImportarMaestro({ ...formImportarMaestro, stock_actual: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Unidad:</label>
                        <select
                          value={formImportarMaestro.unidad}
                          onChange={(e) => setFormImportarMaestro({ ...formImportarMaestro, unidad: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                        >
                          <option value="UND">Unidad (UND)</option>
                          <option value="KG">Peso (KG)</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-stone-600 block mb-1">Código EAN (opcional):</label>
                        <input
                          type="text"
                          value={formImportarMaestro.cod_ean}
                          onChange={(e) => setFormImportarMaestro({ ...formImportarMaestro, cod_ean: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={guardandoImportMaestro} className="w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow">
                      {guardandoImportMaestro ? 'Agregando...' : 'Agregar a mi Inventario'}
                    </button>
                  </form>
                ) : (
                  <>
                    <input
                      type="text" placeholder="Buscar producto..."
                      value={busquedaMaestroImport}
                      onChange={(e) => setBusquedaMaestroImport(e.target.value)}
                      className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-xs text-stone-900 shrink-0"
                    />
                    <div className="flex-1 overflow-y-auto space-y-1.5">
                      {cargandoMaestroImport ? (
                        <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
                      ) : catalogoMaestroDisponibleFiltrado.length === 0 ? (
                        <p className="text-xs text-stone-500 text-center py-6">
                          {esModoDemo
                            ? 'El catálogo maestro no está disponible en el Modo Demo.'
                            : catalogoMaestroDisponible.length === 0
                            ? 'El administrador todavía no cargó productos al catálogo maestro.'
                            : 'No se encontraron productos con esa búsqueda.'}
                        </p>
                      ) : (
                        catalogoMaestroDisponibleFiltrado.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => seleccionarProductoMaestro(p)}
                            className="w-full flex items-center gap-3 bg-white border border-stone-200 hover:border-orange-500/50 rounded-xl p-2.5 text-left transition"
                          >
                            <FotoProducto fotoUrl={p.foto_url} categoria={p.categoria} className="w-11 h-11 rounded-lg shrink-0" iconClassName="text-base" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-stone-900 truncate">{p.descripcion}</p>
                              <p className="text-[11px] text-stone-500">{p.categoria || 'Sin categoría'}</p>
                            </div>
                            <i className="fa-solid fa-chevron-right text-stone-400 text-xs shrink-0"></i>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Modal: Levantamiento de Inventario (conteo físico, escaneando de a uno) */}
          {modalLevantamiento && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full p-5 shadow-2xl space-y-4">
                <div className="flex justify-between items-start shrink-0">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                      <i className="fa-solid fa-clipboard-list text-orange-600"></i> Levantamiento de Inventario
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">Escanea o busca el producto, cuenta lo que tienes físicamente y listo.</p>
                  </div>
                  <button onClick={() => { setModalLevantamiento(false); cerrarResultadoLevantamiento(); }} className="text-stone-600 hover:text-stone-900 shrink-0"><i className="fa-solid fa-xmark"></i></button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">Escanear producto</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Escanea o escribe el EAN..."
                      value={levantamientoEan}
                      onChange={(e) => setLevantamientoEan(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') buscarLevantamientoPorEan(); }}
                      className="flex-1 min-w-0 bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                    />
                    <button
                      onClick={buscarLevantamientoPorEan}
                      className="px-4 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg"
                    >
                      Buscar
                    </button>
                    <button
                      onClick={() => { setModoEscaner('levantamiento'); setMetodoForzado(null); setModalEscaner(true); }}
                      title="Escanear con la cámara"
                      className="shrink-0 w-10 flex items-center justify-center bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg"
                    >
                      <i className="fa-solid fa-camera"></i>
                    </button>
                  </div>
                  {cargandoProductos && (
                    <p className="text-[11px] text-stone-500">Cargando catálogo de productos...</p>
                  )}
                </div>

                {levantamientoResultado === 'no-encontrado' && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-rose-700">Producto no encontrado</p>
                      <p className="text-xs text-rose-600 mt-0.5">Regístralo primero en "Registrar Productos" y vuelve a intentarlo.</p>
                    </div>
                    <button onClick={cerrarResultadoLevantamiento} className="text-rose-400 hover:text-rose-600 shrink-0"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                )}

                {levantamientoResultado && levantamientoResultado !== 'no-encontrado' && (() => {
                  const producto = levantamientoResultado.producto;
                  const unidadesPorPack = Number(producto.unidades_por_pack) > 1 ? Number(producto.unidades_por_pack) : 1;
                  const totalContado = (Number(levantamientoPacks) || 0) * unidadesPorPack + (Number(levantamientoSueltas) || 0);
                  return (
                    <>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Producto encontrado</p>
                          <p className="text-sm font-bold text-stone-900 truncate">{producto.descripcion}</p>
                          <p className="text-[11px] text-stone-500 mt-0.5">SKU: {producto.sku || '—'} · 1 pack = {unidadesPorPack} und.</p>
                        </div>
                        <button onClick={cerrarResultadoLevantamiento} className="text-emerald-500 hover:text-emerald-700 shrink-0"><i className="fa-solid fa-xmark"></i></button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">Cantidades</label>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[11px] text-stone-600 block mb-1">Packs contados <span className="text-rose-600">*</span></label>
                            <input
                              type="number"
                              placeholder="0"
                              value={levantamientoPacks}
                              onChange={(e) => setLevantamientoPacks(e.target.value)}
                              className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-2.5 py-2 text-center text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-stone-600 block mb-1">Unidades sueltas</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={levantamientoSueltas}
                              onChange={(e) => setLevantamientoSueltas(e.target.value)}
                              className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-2.5 py-2 text-center text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-stone-600 block mb-1">Unidades totales</label>
                            <div className="w-full bg-stone-200 rounded-lg px-2.5 py-2 text-center text-sm font-black text-stone-900">
                              {totalContado} <span className="text-[10px] font-normal text-stone-600">und.</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={confirmarConteoLevantamiento}
                        disabled={guardandoLevantamiento || levantamientoPacks === ''}
                        className="w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow flex items-center justify-center gap-1.5"
                      >
                        {guardandoLevantamiento ? (
                          <><i className="fa-solid fa-spinner fa-spin"></i> Guardando...</>
                        ) : (
                          <><i className="fa-solid fa-check"></i> Guardar y escanear siguiente</>
                        )}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Modal: Entrada de Mercadería (Compras) */}
          {modalEntradaMercaderia && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-lg w-full p-5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-stone-900"><i className="fa-solid fa-truck-ramp-box mr-1.5"></i> Entrada de Mercadería (Compras)</h3>
                  <button onClick={cerrarModalEntradaMercaderia} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Proveedor / Distribuidor"
                    value={compraCabecera.proveedor}
                    onChange={(e) => setCompraCabecera({ ...compraCabecera, proveedor: e.target.value })}
                    className="bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                  />
                  <input
                    type="text"
                    placeholder="N° Factura / Guía"
                    value={compraCabecera.nroComprobante}
                    onChange={(e) => setCompraCabecera({ ...compraCabecera, nroComprobante: e.target.value })}
                    className="bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                  />
                </div>

                {/* Agregar Ítem */}
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <span className="text-xs font-bold text-amber-600 block">Agregar Producto a la Entrada:</span>
                  {(() => {
                    const prodSel = productos.find(p => p.id === compraItemTemp.productoId);
                    const unidadesPorPack = Number(prodSel?.unidades_por_pack) || 1;
                    const tieneP = unidadesPorPack > 1;
                    const esPack = tieneP && compraItemTemp.tipo === 'PACK';
                    return (
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={compraItemTemp.productoId}
                        onChange={(e) => {
                          if (e.target.value === '__nuevo__') {
                            setNuevoProductoInlineCompra({ descripcion: '', categoria: 'Abarrotes', precio_costo: '', precio_venta: '', unidad: 'UND' });
                            return;
                          }
                          setCompraItemTemp({ ...compraItemTemp, productoId: e.target.value, tipo: 'UNIDAD' });
                        }}
                        className="col-span-3 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                      >
                        <option value="">-- Seleccionar Producto --</option>
                        {productos.map(p => (
                          <option key={p.id} value={p.id}>{p.descripcion}</option>
                        ))}
                        <option value="__nuevo__">+ Nuevo producto...</option>
                      </select>
                      {nuevoProductoInlineCompra && (
                        <div className="col-span-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                          <span className="text-xs font-bold text-amber-700 block">Crear producto rápido:</span>
                          <input
                            type="text"
                            placeholder="Descripción *"
                            value={nuevoProductoInlineCompra.descripcion}
                            onChange={(e) => setNuevoProductoInlineCompra({ ...nuevoProductoInlineCompra, descripcion: e.target.value })}
                            className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={nuevoProductoInlineCompra.categoria}
                              onChange={(e) => setNuevoProductoInlineCompra({ ...nuevoProductoInlineCompra, categoria: e.target.value })}
                              className="bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                            >
                              {categoriasDB.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select
                              value={nuevoProductoInlineCompra.unidad}
                              onChange={(e) => setNuevoProductoInlineCompra({ ...nuevoProductoInlineCompra, unidad: e.target.value })}
                              className="bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                            >
                              <option value="UND">Se vende por Unidad (UND)</option>
                              <option value="KG">Se vende por Peso (KG) — balanza</option>
                            </select>
                            <input
                              type="number"
                              step="0.10"
                              placeholder="Precio costo (S/)"
                              value={nuevoProductoInlineCompra.precio_costo}
                              onChange={(e) => setNuevoProductoInlineCompra({ ...nuevoProductoInlineCompra, precio_costo: e.target.value })}
                              className="bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                            />
                            <input
                              type="number"
                              step="0.10"
                              placeholder="Precio venta (S/) *"
                              value={nuevoProductoInlineCompra.precio_venta}
                              onChange={(e) => setNuevoProductoInlineCompra({ ...nuevoProductoInlineCompra, precio_venta: e.target.value })}
                              className="bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setNuevoProductoInlineCompra(null)}
                              className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs rounded-lg py-1.5"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={crearProductoInlineCompra}
                              disabled={guardandoProductoInlineCompra}
                              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg py-1.5"
                            >
                              {guardandoProductoInlineCompra ? 'Creando...' : 'Crear y usar'}
                            </button>
                          </div>
                        </div>
                      )}
                      {tieneP && (
                        <select
                          value={compraItemTemp.tipo}
                          onChange={(e) => setCompraItemTemp({ ...compraItemTemp, tipo: e.target.value })}
                          className="col-span-3 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                        >
                          <option value="UNIDAD">Llega por unidad suelta</option>
                          <option value="PACK">Llega por pack/caja (x{unidadesPorPack})</option>
                        </select>
                      )}
                      <input
                        type="number"
                        placeholder={esPack ? 'Cantidad de packs' : 'Cantidad'}
                        value={compraItemTemp.cantidad}
                        onChange={(e) => setCompraItemTemp({ ...compraItemTemp, cantidad: e.target.value })}
                        className="bg-white border border-stone-200/70 shadow-sm rounded-xl px-2 py-1 text-xs text-stone-900"
                      />
                      <input
                        type="number"
                        step="0.10"
                        placeholder={esPack ? 'Costo por pack' : 'Costo Unit.'}
                        value={compraItemTemp.costoUnitario}
                        onChange={(e) => setCompraItemTemp({ ...compraItemTemp, costoUnitario: e.target.value })}
                        className="bg-white border border-stone-200/70 shadow-sm rounded-xl px-2 py-1 text-xs text-stone-900"
                      />
                      <button
                        type="button"
                        onClick={agregarItemEntradaMercaderia}
                        className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-lg py-1"
                      >
                        + Añadir
                      </button>
                      {esPack && compraItemTemp.cantidad && (
                        <span className="col-span-3 text-[11px] text-stone-500">
                          = {(Number(compraItemTemp.cantidad) || 0) * unidadesPorPack} unidades en stock
                        </span>
                      )}
                    </div>
                    );
                  })()}
                </div>

                {/* Lista de Ítems Comprados */}
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {compraItems.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-stone-50 p-2 rounded-lg border border-stone-100">
                      <span>
                        {it.cantidad}{it.esPack ? ` pack${it.cantidad > 1 ? 's' : ''} x${it.unidadesPorPack}` : 'x'} {it.descripcion}
                        {it.esPack && <span className="text-stone-500"> (={it.cantidadStock} und)</span>}
                        {' '}(S/ {it.costoUnitario.toFixed(2)}/und)
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-orange-600">S/ {it.subtotal.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => quitarItemEntradaMercaderia(idx)}
                          className="text-stone-400 hover:text-rose-600 transition"
                          title="Quitar esta línea"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-stone-200">
                  <span className="font-bold text-sm">Total Compra:</span>
                  <span className="font-black text-lg text-orange-600">
                    S/ {compraItems.reduce((a, c) => a + c.subtotal, 0).toFixed(2)}
                  </span>
                </div>

                <button onClick={guardarEntradaMercaderia} className="w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white font-bold text-xs rounded-full shadow">
                  Confirmar Entrada de Mercadería
                </button>
              </div>
            </div>
          )}

          {/* Modal: Cobrar Deudas / Créditos */}
          {modalCobrarDeudas && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full p-5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto hide-scrollbar">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-[#ece0fd] text-[#6105dc] flex items-center justify-center"><IconoTrazo nombre="hand" className="w-4 h-4" /></span>
                    Cuentas por cobrar
                  </h3>
                  <button onClick={() => setModalCobrarDeudas(false)} className="w-8 h-8 rounded-full bg-white/75 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm flex items-center justify-center"><IconoTrazo nombre="x" className="w-3.5 h-3.5" /></button>
                </div>

                {deudorSeleccionado ? (() => {
                  const iniciales = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                  const saldoDeudor = Number(deudorSeleccionado.saldo_actual) || 0;
                  const abono = parseFloat(montoAbonoDeuda) || 0;
                  const restante = saldoDeudor - abono;
                  const lista = mostrarHistorialCompletoDeuda ? boletasDeudorConEstado : boletasPendientesDeuda;
                  return (
                  <div className="space-y-3">
                    <button onClick={() => { setDeudorSeleccionado(null); setBoletasDeudor([]); }} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6105dc] hover:text-[#4d04b0] transition">
                      <IconoTrazo nombre="back" className="w-3.5 h-3.5" /> Todos los clientes
                    </button>

                    <div className="bg-white/65 border border-white/90 rounded-[22px] px-4 py-3.5 flex items-center gap-3">
                      <span className="w-11 h-11 rounded-full bg-[#ece0fd] text-[#6105dc] font-bold text-[15px] flex items-center justify-center shrink-0">{iniciales(deudorSeleccionado.nombre_completo)}</span>
                      <div className="min-w-0">
                        <p className="text-base font-bold text-stone-900 tracking-tight truncate">{deudorSeleccionado.nombre_completo}</p>
                        <p className="text-xs text-stone-400">DNI {deudorSeleccionado.dni}</p>
                      </div>
                      <div className="ml-auto text-right shrink-0">
                        <p className="text-[11px] font-semibold text-stone-400">Deuda actual</p>
                        <p className="text-2xl font-bold tracking-tight text-rose-600 tabular-nums leading-tight">
                          <small className="text-xs font-semibold mr-0.5">S/</small>{formatoSoles(saldoDeudor)}
                        </p>
                      </div>
                    </div>

                    {/* Detalle de boletas: por defecto solo lo que aún se debe */}
                    <div className="bg-white/65 border border-white/90 rounded-[22px] px-4 py-3.5">
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                          {mostrarHistorialCompletoDeuda ? 'Historial completo de compras' : 'Boletas pendientes'}
                        </p>
                        {boletasDeudorConEstado.some((b) => b.pagada) && (
                          <button
                            type="button"
                            onClick={() => setMostrarHistorialCompletoDeuda((v) => !v)}
                            className="text-xs font-semibold text-[#6105dc] hover:text-[#4d04b0] shrink-0"
                          >
                            {mostrarHistorialCompletoDeuda ? 'Ver solo pendientes' : `Ver historial completo (${boletasDeudorConEstado.length})`}
                          </button>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto hide-scrollbar">
                        {cargandoDetalleDeudor ? (
                          <p className="text-xs text-stone-500 text-center py-4">Cargando...</p>
                        ) : boletasDeudorConEstado.length === 0 ? (
                          <p className="text-xs text-stone-500 text-center py-4">Sin boletas a crédito registradas.</p>
                        ) : lista.length === 0 ? (
                          <p className="text-xs text-emerald-600 text-center py-4">No hay boletas pendientes.</p>
                        ) : (
                          lista.map((b) => (
                            <div key={b.id} className={`py-2.5 border-b border-[#6105dc]/10 last:border-0 ${b.pagada ? 'opacity-50' : ''}`}>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-[12.5px] font-bold text-stone-900 tabular-nums">
                                  {b.nro_boleta}
                                  {b.pagada && <span className="ml-1.5 text-[10.5px] font-bold text-emerald-600">Pagada</span>}
                                  {b.vencida && <span className="ml-1.5 text-[10.5px] font-bold text-rose-700 bg-rose-50 rounded-full px-2 py-0.5">Vencida hace {b.diasVencido} d</span>}
                                </span>
                                <span className="text-[13.5px] font-bold text-[#6105dc] tabular-nums whitespace-nowrap">S/ {formatoSoles(b.total_venta)}</span>
                              </div>
                              <p className="text-xs text-stone-400 mt-0.5 leading-snug">
                                {new Date(b.fecha_hora).toLocaleDateString('es-PE')} ·{' '}
                                {(b.ventas_detalle || []).map(d => `${d.productos?.descripcion || 'Producto'} x${d.cantidad}`).join(', ') || 'Sin detalle'}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Estado de cuenta: PDF y WhatsApp */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={descargarEstadoCuenta}
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-[#f4eefe] text-stone-800 text-[12.5px] font-semibold rounded-full ring-1 ring-[#6105dc]/10 hover:ring-[#d6bdfa] transition whitespace-nowrap"
                      >
                        <IconoTrazo nombre="pdf" className="w-[15px] h-[15px] text-[#6105dc]" /> Descargar PDF
                      </button>
                      <button
                        onClick={() => enviarEstadoCuentaWhatsApp(deudorSeleccionado)}
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-[#f4eefe] text-stone-800 text-[12.5px] font-semibold rounded-full ring-1 ring-[#6105dc]/10 hover:ring-[#d6bdfa] transition whitespace-nowrap"
                      >
                        <IconoTrazo nombre="chat" className="w-[15px] h-[15px] text-[#6105dc]" /> Enviar por WhatsApp
                      </button>
                    </div>

                    <div className="bg-white/65 border border-white/90 rounded-[22px] px-4 py-3.5">
                      <label htmlFor="monto-abono-deuda" className="text-xs font-semibold text-stone-500 block mb-2">Monto a abonar</label>
                      <div className="flex items-center gap-2 bg-white rounded-full pl-4 pr-2 py-1.5 ring-1 ring-[#6105dc]/10 focus-within:ring-2 focus-within:ring-[#d6bdfa]">
                        <span className="text-sm font-semibold text-stone-400">S/</span>
                        <input
                          id="monto-abono-deuda"
                          type="number"
                          inputMode="decimal"
                          step="0.10"
                          placeholder="0.00"
                          value={montoAbonoDeuda}
                          onChange={(e) => setMontoAbonoDeuda(e.target.value)}
                          className="flex-1 min-w-0 bg-transparent text-[22px] font-bold tracking-tight text-stone-900 tabular-nums focus:outline-none"
                        />
                        <div className="flex gap-1.5 shrink-0">
                          <button type="button" onClick={() => setMontoAbonoDeuda(saldoDeudor.toFixed(2))} className="text-[11.5px] font-semibold text-[#4d04b0] bg-[#f4eefe] hover:bg-[#ece0fd] rounded-full px-3 py-1.5 transition whitespace-nowrap">Pagar todo</button>
                          <button type="button" onClick={() => setMontoAbonoDeuda((saldoDeudor / 2).toFixed(2))} className="text-[11.5px] font-semibold text-[#4d04b0] bg-[#f4eefe] hover:bg-[#ece0fd] rounded-full px-3 py-1.5 transition">Mitad</button>
                        </div>
                      </div>
                      <div className="flex justify-between text-[12.5px] text-stone-400 mt-2 px-1">
                        <span>Saldo después del pago</span>
                        <b className={`tabular-nums ${restante < 0 ? 'text-rose-600' : restante === 0 && abono > 0 ? 'text-emerald-600' : 'text-stone-900'}`}>
                          {restante < 0 ? 'Excede la deuda' : `S/ ${formatoSoles(restante)}`}
                        </b>
                      </div>
                    </div>

                    <button onClick={procesarPagoDeudaCliente} className="w-full py-3 bg-[#6105dc] hover:bg-[#4d04b0] active:scale-[0.98] text-white font-semibold text-[14.5px] rounded-full flex items-center justify-center gap-2 transition">
                      <IconoTrazo nombre="check" className="w-4 h-4" grosor={2.4} /> Registrar pago de deuda
                    </button>
                  </div>
                  );
                })() : (
                  <div className="space-y-3">
                    {clientesDeudores.length === 0 ? (
                      <p className="text-xs text-emerald-600 text-center py-6">No hay clientes con deuda pendiente.</p>
                    ) : (
                      <>
                        <div className="bg-white/65 border border-white/90 rounded-[22px] px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-stone-400">Total por cobrar</p>
                            <p className="text-2xl font-bold tracking-tight text-rose-600 tabular-nums">
                              <small className="text-[13px] font-semibold mr-0.5">S/</small>{formatoSoles(clientesDeudores.reduce((a, c) => a + (Number(c.saldo_actual) || 0), 0))}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-[#4d04b0] bg-[#ece0fd] rounded-full px-3 py-1.5">
                            {clientesDeudores.length} {clientesDeudores.length === 1 ? 'cliente' : 'clientes'}
                          </span>
                        </div>
                        <div className="max-h-72 overflow-y-auto hide-scrollbar space-y-2">
                          {clientesDeudores.map(cl => (
                            <button
                              key={cl.id}
                              type="button"
                              onClick={() => seleccionarDeudor(cl)}
                              className="w-full flex items-center gap-3 px-3.5 py-3 bg-white/65 hover:bg-[#f4eefe] border border-white/90 rounded-[20px] text-left transition"
                            >
                              <span className="w-[38px] h-[38px] rounded-full bg-[#ece0fd] text-[#6105dc] font-bold text-[13px] flex items-center justify-center shrink-0">
                                {String(cl.nombre_completo || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-semibold text-stone-900 truncate">{cl.nombre_completo}</span>
                                <span className="block text-xs text-stone-400">DNI {cl.dni}</span>
                              </span>
                              <span className="text-[13px] font-bold text-rose-600 bg-rose-50 rounded-full px-3 py-1 tabular-nums whitespace-nowrap">S/ {formatoSoles(cl.saldo_actual)}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal: Cuentas por Pagar (proveedores) */}
          {modalCuentasPagar && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full p-5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-file-invoice text-orange-600"></i> Cuentas por Pagar
                  </h3>
                  <button onClick={() => setModalCuentasPagar(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>

                {proveedorSeleccionado ? (
                  <div className="p-3 bg-stone-50 rounded-xl border border-amber-500/40 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                        <i className="fa-solid fa-truck-field text-orange-600"></i> {proveedorSeleccionado.nombre}
                      </span>
                      <button onClick={() => setProveedorSeleccionado(null)} className="text-xs text-stone-600 underline">Cambiar</button>
                    </div>
                    <div className="text-xs">
                      {proveedorSeleccionado.ruc && <p className="text-stone-600">RUC: {proveedorSeleccionado.ruc}</p>}
                      {proveedorSeleccionado.telefono && <p className="text-stone-600">Tel: {proveedorSeleccionado.telefono}</p>}
                      <p className="text-rose-600 font-bold mt-1 text-sm">Le debemos: S/ {Number(proveedorSeleccionado.saldo_actual).toFixed(2)}</p>
                    </div>

                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Monto (S/):</label>
                      <input
                        type="number"
                        step="1.00"
                        placeholder="0.00"
                        value={montoMovimientoProveedor}
                        onChange={(e) => setMontoMovimientoProveedor(e.target.value)}
                        className="w-full bg-stone-100 border border-stone-200 rounded-lg p-2 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => registrarMovimientoProveedor('deuda')}
                        className="py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl border border-stone-300 flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-plus"></i> Agregar Deuda
                      </button>
                      <button
                        onClick={() => registrarMovimientoProveedor('pago')}
                        className="py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-check"></i> Registrar Pago
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-1.5">
                    {proveedoresLista.length === 0 ? (
                      <p className="text-xs text-stone-600 text-center py-6">Aún no registras proveedores.</p>
                    ) : (
                      proveedoresLista.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => { setProveedorSeleccionado(p); setMontoMovimientoProveedor(''); }}
                          className="flex justify-between items-center p-2.5 bg-stone-50 hover:bg-stone-200 border border-stone-200 rounded-xl cursor-pointer transition"
                        >
                          <div>
                            <p className="text-xs font-bold text-stone-800">{p.nombre}</p>
                            {p.ruc && <p className="text-xs text-stone-600">RUC: {p.ruc}</p>}
                          </div>
                          <span className={`text-sm font-black ${Number(p.saldo_actual) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            S/ {Number(p.saldo_actual).toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {!proveedorSeleccionado && (
                  <button
                    onClick={() => setModalNuevoProveedor(true)}
                    className="w-full py-2 bg-white/70 hover:bg-[#ece0fd] text-stone-600 font-bold text-xs rounded-full border border-stone-300 border-dashed flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <i className="fa-solid fa-plus"></i> Nuevo Proveedor
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Modal: Nuevo Proveedor */}
          {modalNuevoProveedor && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-stone-900"><i className="fa-solid fa-truck mr-1.5"></i> Nuevo Proveedor</h3>
                  <button onClick={() => setModalNuevoProveedor(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <form onSubmit={handleGuardarNuevoProveedor} className="space-y-2.5">
                  <div>
                    <label className="text-xs text-stone-600 block mb-1">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={formProveedor.nombre}
                      onChange={(e) => setFormProveedor({ ...formProveedor, nombre: e.target.value })}
                      className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">RUC</label>
                      <input
                        type="text"
                        value={formProveedor.ruc}
                        onChange={(e) => setFormProveedor({ ...formProveedor, ruc: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={formProveedor.telefono}
                        onChange={(e) => setFormProveedor({ ...formProveedor, telefono: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-stone-600 block mb-1">Deuda inicial (S/, opcional)</label>
                    <input
                      type="number"
                      step="1.00"
                      placeholder="0.00"
                      value={formProveedor.saldoInicial}
                      onChange={(e) => setFormProveedor({ ...formProveedor, saldoInicial: e.target.value })}
                      className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white font-bold text-xs rounded-full shadow"
                  >
                    Guardar Proveedor
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Historial de Cierres de Caja */}
          {modalHistorialCierres && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] rounded-[28px] max-w-lg w-full p-5 shadow-2xl border border-white/80 space-y-3 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-[#ece0fd] text-[#6105dc] flex items-center justify-center text-sm"><i className="fa-solid fa-cash-register"></i></span>
                    Historial de cierres de caja
                  </h3>
                  <button onClick={() => setModalHistorialCierres(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>

                <FiltroFechasRapido
                  desde={fechaInicioCierres}
                  hasta={fechaFinCierres}
                  setDesde={setFechaInicioCierres}
                  setHasta={setFechaFinCierres}
                  onRango={cargarHistorialCierresPorRango}
                  diasAtras={30}
                />

                <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2">
                  {cargandoCierres ? (
                    <p className="text-xs text-center py-8 text-stone-500">Cargando...</p>
                  ) : cierresCaja.length === 0 ? (
                    <p className="text-xs text-center py-8 text-stone-500">No hay cierres de caja en ese rango.</p>
                  ) : (
                    cierresCaja.map((t) => {
                      const dif = Number(t.diferencia);
                      const fmt = (f) => new Date(f).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={t.id} className="p-4 bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_10px_40px_-14px_rgba(97,5,220,0.18)] text-xs">
                          <div className="flex justify-between items-center gap-2 mb-3">
                            <span className="font-bold text-stone-900 flex items-center gap-2 min-w-0">
                              <span className="w-7 h-7 rounded-full bg-[#ece0fd] text-[#6105dc] flex items-center justify-center text-[11px] shrink-0"><i className="fa-solid fa-user"></i></span>
                              <span className="truncate">{t.cajeros?.nombre || 'Cajero'}</span>
                            </span>
                            <span className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${dif === 0 ? 'bg-emerald-50 text-emerald-600' : Math.abs(dif) < 1 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                              {dif === 0 ? (<><i className="fa-solid fa-circle-check mr-1"></i>Cuadre perfecto</>) : `${dif > 0 ? '+' : ''}S/ ${formatoSoles(dif)}`}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white/70 rounded-2xl px-3 py-2">
                              <span className="text-[11px] text-stone-500 block">Apertura</span>
                              <span className="font-semibold text-stone-800">{fmt(t.fecha_apertura)}</span>
                            </div>
                            <div className="bg-white/70 rounded-2xl px-3 py-2">
                              <span className="text-[11px] text-stone-500 block">Cierre</span>
                              <span className="font-semibold text-stone-800">{fmt(t.fecha_cierre)}</span>
                            </div>
                            <div className="bg-white/70 rounded-2xl px-3 py-2">
                              <span className="text-[11px] text-stone-500 block">Fondo inicial</span>
                              <span className="font-semibold text-stone-800 whitespace-nowrap">S/ {formatoSoles(Number(t.monto_inicial))}</span>
                            </div>
                            <div className="bg-white/70 rounded-2xl px-3 py-2">
                              <span className="text-[11px] text-stone-500 block">Ventas efectivo</span>
                              <span className="font-semibold text-stone-800 whitespace-nowrap">S/ {formatoSoles(Number(t.ventas_sistema || 0))}</span>
                            </div>
                            <div className="col-span-2 bg-[#f4eefe] border border-[#d6bdfa] rounded-2xl px-3 py-2 flex justify-between items-center">
                              <span className="text-[11px] text-[#6105dc]">Contado</span>
                              <span className="font-bold text-sm text-[#4d04b0] whitespace-nowrap">S/ {formatoSoles(Number(t.monto_final_real || 0))}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal: Historial de Toma de Inventario -- comparar, producto por
              producto, si un día cuadró contra el sistema y otro no. */}
          {modalHistorialInventario && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-lg w-full p-5 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-scale-balanced text-orange-600"></i> Historial de Inventario
                  </h3>
                  <button onClick={() => setModalHistorialInventario(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>

                <FiltroFechasRapido
                  desde={fechaInicioHistInventario}
                  hasta={fechaFinHistInventario}
                  setDesde={setFechaInicioHistInventario}
                  setHasta={setFechaFinHistInventario}
                  onRango={cargarHistorialInventarioPorRango}
                  diasAtras={30}
                />

                <div className="flex gap-2 shrink-0">
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={historialInventarioBusqueda}
                    onChange={(e) => setHistorialInventarioBusqueda(e.target.value)}
                    className="flex-1 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                  />
                  <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 font-semibold cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={historialInventarioSoloDif}
                      onChange={(e) => setHistorialInventarioSoloDif(e.target.checked)}
                    />
                    Solo con diferencia
                  </label>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
                  {cargandoHistorialInventario ? (
                    <p className="text-xs text-center py-8 text-stone-600">Cargando...</p>
                  ) : historialInventarioAgrupado.length === 0 ? (
                    <p className="text-xs text-center py-8 text-stone-500">No hay conteos registrados en ese rango.</p>
                  ) : (
                    historialInventarioAgrupado.map((grupo) => (
                      <div key={grupo.dia}>
                        <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wide mb-1.5">
                          {new Date(`${grupo.dia}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long' })}
                        </p>
                        <div className="space-y-1.5">
                          {grupo.items.map((h) => {
                            const dif = Number(h.diferencia);
                            const cajero = listaCajeros.find((c) => c.id === h.cajero_id);
                            return (
                              <div key={h.id} className="p-2.5 bg-white rounded-xl border border-stone-200 text-xs">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-stone-800 truncate">{h.productos?.descripcion || 'Producto eliminado'}</p>
                                    <p className="text-[10px] text-stone-500">
                                      {new Date(h.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                                      {cajero ? ` · ${cajero.nombre}` : ''}
                                    </p>
                                  </div>
                                  <span className={`shrink-0 font-black ${dif === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {dif === 0 ? (<><i className="fa-solid fa-circle-check mr-1"></i>Cuadró</>) : (dif > 0 ? `+${dif}` : dif)}
                                  </span>
                                </div>
                                <div className="flex gap-3 mt-1 text-[11px] text-stone-600">
                                  <span>Sistema: <b className="text-stone-800">{Number(h.stock_sistema)}</b></span>
                                  <span>Contado: <b className="text-stone-800">{Number(h.stock_contado)}</b></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal: Gestión de Cajeros */}
          {modalGestionCajeros && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full p-5 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-user-group text-orange-600"></i> Cajeros y Empleados
                  </h3>
                  <button onClick={() => setModalGestionCajeros(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>

                {mostrarFormNuevoCajero ? (
                  <div className="p-3 bg-stone-50 rounded-xl border border-orange-700/40 space-y-2.5">
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Nombre:</label>
                      <input
                        type="text"
                        value={formNuevoCajero.nombre}
                        onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, nombre: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">DNI:</label>
                      <input
                        type="text"
                        maxLength={8}
                        value={formNuevoCajero.dni}
                        onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, dni: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Rol:</label>
                      <select
                        value={formNuevoCajero.rol}
                        onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, rol: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                      >
                        <option value="cajero">Cajero (solo vender y cobrar)</option>
                        <option value="administrador">Administrador (acceso completo)</option>
                      </select>
                    </div>
                    {formNuevoCajero.rol === 'administrador' && (
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">PIN de seguridad (4 a 32 caracteres, con letras, números o símbolos):</label>
                        <input
                          type="text"
                          maxLength={PIN_MAX}
                          autoComplete="off"
                          value={formNuevoCajero.pin}
                          onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, pin: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                        />
                        <p className="text-[10px] text-stone-500 mt-1">Se le va a pedir cada vez que alguien más lo elija al abrir turno.</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setMostrarFormNuevoCajero(false)} className="flex-1 py-2 bg-white/70 text-stone-600 text-xs font-semibold rounded-full shadow-sm">
                        Cancelar
                      </button>
                      <button
                        onClick={registrarNuevoCajeroCompleto}
                        disabled={guardandoNuevoCajero}
                        className="flex-1 py-2 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow"
                      >
                        {guardandoNuevoCajero ? 'Guardando...' : 'Agregar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setMostrarFormNuevoCajero(true)}
                      className="w-full py-2.5 bg-white/70 hover:bg-[#ece0fd] text-stone-600 text-xs font-semibold rounded-full border border-stone-300 border-dashed flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
                    >
                      <i className="fa-solid fa-user-plus"></i> Agregar Nuevo Cajero
                    </button>
                    <div className="flex-1 overflow-y-auto space-y-1.5">
                      {cargandoCajerosGestion ? (
                        <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
                      ) : cajerosGestion.length === 0 ? (
                        <p className="text-xs text-stone-500 text-center py-6">Sin cajeros registrados.</p>
                      ) : (
                        cajerosGestion.map((c) => (
                          <div key={c.id} className={`flex items-center justify-between p-2.5 bg-stone-50 border border-stone-200 rounded-xl ${!c.activo ? 'opacity-50' : ''}`}>
                            <div>
                              <p className="text-xs font-semibold text-stone-800">
                                {c.nombre} {!c.activo && <span className="text-rose-600 font-sans">(Inactivo)</span>}
                              </p>
                              <p className="text-xs text-stone-500 capitalize">DNI: {c.dni} · {c.rol}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {c.rol === 'administrador' && (
                                <button
                                  onClick={() => { setModalPinCajero(c); setNuevoPinCajero(''); }}
                                  title="Cambiar su PIN de seguridad"
                                  className="w-7 h-7 flex items-center justify-center bg-stone-200 hover:bg-orange-100 text-stone-500 hover:text-orange-600 rounded-lg"
                                >
                                  <i className="fa-solid fa-key text-xs"></i>
                                </button>
                              )}
                              {c.rol !== 'dueno' && (
                                <button
                                  onClick={() => alternarActivoCajero(c)}
                                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                                    c.activo ? 'bg-rose-950/60 text-rose-600 hover:bg-rose-900' : 'bg-emerald-950/60 text-emerald-600 hover:bg-emerald-900'
                                  }`}
                                >
                                  {c.activo ? 'Desactivar' : 'Reactivar'}
                                </button>
                              )}
                              {c.rol !== 'dueno' && (
                                <button
                                  onClick={() => eliminarCajero(c)}
                                  title="Eliminar de la lista de cajeros"
                                  className="w-7 h-7 flex items-center justify-center bg-stone-200 hover:bg-rose-100 text-stone-500 hover:text-rose-600 rounded-lg"
                                >
                                  <i className="fa-solid fa-trash text-xs"></i>
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Modal: Mi Link de Pedidos (vitrina pública de KaseritaDelivery) */}
          {modalDelivery && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full p-5 shadow-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-share-nodes text-orange-600"></i> Mi Link de Pedidos
                  </h3>
                  <button onClick={() => { setModalDelivery(false); setMostrarQRDelivery(false); }} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>

                {!sesion?.bodega?.delivery_permitido ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
                    <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                      <i className="fa-solid fa-lock text-xs"></i> Función no habilitada
                    </p>
                    <p className="text-xs text-amber-700">
                      Los Pedidos por WhatsApp son una función paga aparte de tu plan.
                      Contactá al administrador para habilitarla en tu bodega.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-stone-500">
                      Tus clientes entran a este link, arman su pedido y te lo mandan por WhatsApp
                      con un código -- vos lo cargás acá en caja para cobrar sin escribir nada a mano.
                    </p>

                    <Interruptor
                      activo={deliveryHabilitado}
                      onClick={() => setDeliveryHabilitado((v) => !v)}
                      etiqueta="Aparecer en el catálogo público"
                      icono="fa-store"
                    />

                    <div className="space-y-2">
                      <label className="text-xs text-stone-600 block">Logo de tu vitrina:</label>
                      <div className="flex items-center gap-3">
                        <label className="relative w-16 h-16 rounded-full overflow-hidden cursor-pointer group border border-stone-200 bg-stone-100 shrink-0">
                          {logoUrlDelivery ? (
                            <img src={logoUrlDelivery} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-400">
                              <i className="fa-solid fa-store text-lg"></i>
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition">
                            {subiendoLogoDelivery ? (
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <i className="fa-solid fa-camera text-white text-xs opacity-0 group-hover:opacity-100 transition"></i>
                            )}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files && e.target.files[0];
                              e.target.value = '';
                              if (file) subirLogoDelivery(file);
                            }}
                          />
                        </label>
                        <p className="text-[10px] text-stone-500 flex-1">Toca el círculo para subir/cambiar el logo que ven tus clientes.</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Tu link:</label>
                      <div className="flex items-center gap-1 bg-stone-200/60 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs text-stone-400 shrink-0">{KASERITA_DELIVERY_URL}/</span>
                        <input
                          type="text"
                          value={slugDelivery}
                          onChange={(e) => setSlugDelivery(e.target.value)}
                          onBlur={() => setSlugDelivery((v) => normalizarSlugDelivery(v))}
                          placeholder="mi-bodega"
                          className="flex-1 min-w-0 bg-transparent text-xs text-stone-900 font-semibold outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Dirección de tu bodega:</label>
                      <input
                        type="text"
                        value={direccionDelivery}
                        onChange={(e) => setDireccionDelivery(e.target.value)}
                        placeholder="Ej. Av. Larco 450, Miraflores"
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                      />
                      <p className="text-[10px] text-stone-500 mt-1">Así tus clientes saben de dónde les vas a mandar el pedido.</p>
                    </div>

                    <div>
                      <label className="text-xs text-stone-600 block mb-1.5">Horario de atención:</label>
                      <div className="flex items-center gap-1.5">
                        {[[1, 'Lu'], [2, 'Ma'], [3, 'Mi'], [4, 'Ju'], [5, 'Vi'], [6, 'Sá'], [0, 'Do']].map(([dia, letra]) => {
                          const abierto = !!horarioDelivery[dia]?.abierto;
                          return (
                            <button
                              key={dia}
                              type="button"
                              onClick={() => setHorarioDelivery((h) => {
                                if (abierto) return { ...h, [dia]: { ...h[dia], abierto: false } };
                                // Toma el horario que ya tengan los otros días abiertos, para
                                // que todos los días activos compartan el mismo rango -- si
                                // ninguno está abierto todavía, cae al horario típico de bodega.
                                const otroAbierto = Object.values(h).find((v) => v?.abierto);
                                return {
                                  ...h,
                                  [dia]: { abierto: true, desde: otroAbierto?.desde || '08:00', hasta: otroAbierto?.hasta || '21:00' },
                                };
                              })}
                              className={`flex-1 h-8 shrink-0 rounded-full text-[11px] font-bold flex items-center justify-center transition ${
                                abierto ? 'bg-[#6105dc] text-white' : 'bg-stone-100 text-stone-400'
                              }`}
                            >
                              {letra}
                            </button>
                          );
                        })}
                      </div>
                      {Object.values(horarioDelivery).some((v) => v?.abierto) ? (
                        <div className="flex items-center gap-1.5 mt-2">
                          <input
                            type="time"
                            value={Object.values(horarioDelivery).find((v) => v?.abierto)?.desde || '08:00'}
                            onChange={(e) => setHorarioDelivery((h) => {
                              const nuevo = { ...h };
                              Object.keys(nuevo).forEach((d) => { if (nuevo[d]?.abierto) nuevo[d] = { ...nuevo[d], desde: e.target.value }; });
                              return nuevo;
                            })}
                            className="flex-1 min-w-0 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2 py-1.5 text-xs text-stone-900"
                          />
                          <span className="text-stone-400 text-xs shrink-0">a</span>
                          <input
                            type="time"
                            value={Object.values(horarioDelivery).find((v) => v?.abierto)?.hasta || '21:00'}
                            onChange={(e) => setHorarioDelivery((h) => {
                              const nuevo = { ...h };
                              Object.keys(nuevo).forEach((d) => { if (nuevo[d]?.abierto) nuevo[d] = { ...nuevo[d], hasta: e.target.value }; });
                              return nuevo;
                            })}
                            className="flex-1 min-w-0 bg-white border border-stone-200/70 shadow-sm rounded-xl px-2 py-1.5 text-xs text-stone-900"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 mt-1.5">Marcá los días en que atendés.</p>
                      )}
                      <p className="text-[10px] text-stone-500 mt-1.5">
                        Así la vitrina muestra "Abierto" o "Cerrado" en tiempo real. Si no lo configurás, no se muestra ningún aviso.
                      </p>
                    </div>

                    {sesion?.usuario?.rol === 'dueno' && (
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Tu WhatsApp (ahí te van a llegar los pedidos):</label>
                        <input
                          type="text"
                          value={telefonoDeliveryEditar}
                          onChange={(e) => setTelefonoDeliveryEditar(e.target.value)}
                          placeholder="Ej. 51987654321"
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                        />
                        <p className="text-[10px] text-stone-500 mt-1">Sin espacios ni guiones, con el código de país adelante.</p>
                      </div>
                    )}

                    {deliveryHabilitado && sesion?.bodega?.slug && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-2">
                          <i className="fa-solid fa-circle-check text-emerald-600 text-xs shrink-0"></i>
                          <span className="text-[11px] text-emerald-700 font-medium truncate flex-1">{`${KASERITA_DELIVERY_URL}/${sesion.bodega.slug}`}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`${KASERITA_DELIVERY_URL}/${sesion.bodega.slug}`);
                              notificar('Link copiado.', 'success');
                            }}
                            className="text-emerald-700 hover:text-emerald-900 shrink-0"
                          >
                            <i className="fa-solid fa-copy text-xs"></i>
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setMostrarQRDelivery(true)}
                            className="flex-1 py-2 bg-white/70 hover:bg-[#ece0fd] text-stone-600 text-xs font-bold rounded-full flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <i className="fa-solid fa-qrcode"></i> Ver QR
                          </button>
                          {typeof navigator !== 'undefined' && navigator.share && (
                            <button
                              type="button"
                              onClick={async () => {
                                const url = `${KASERITA_DELIVERY_URL}/${sesion.bodega.slug}`;
                                try {
                                  await navigator.share({ title: 'Mi Link de Pedidos', text: 'Hacé tu pedido acá:', url });
                                } catch (err) {
                                  if (err?.name !== 'AbortError') notificar('No se pudo abrir el menú de compartir.', 'error');
                                }
                              }}
                              className="flex-1 py-2 bg-[#6105dc] hover:bg-[#4d04b0] text-white text-xs font-bold rounded-full flex items-center justify-center gap-1.5"
                            >
                              <i className="fa-solid fa-share-nodes"></i> Compartir
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={guardarConfigDelivery}
                      disabled={guardandoDelivery}
                      className="w-full py-2.5 rounded-full bg-[#6105dc] hover:bg-[#4d04b0] text-white font-bold text-sm disabled:opacity-50"
                    >
                      {guardandoDelivery ? 'Guardando...' : 'Guardar'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Modal: QR del link de pedidos en grande, para que el cliente lo escanee desde lejos */}
          {mostrarQRDelivery && sesion?.bodega?.slug && (
            <div
              className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4"
              onClick={() => setMostrarQRDelivery(false)}
            >
              <div
                className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col items-center gap-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-sm font-bold text-stone-900">Escaneá para pedir</h3>
                  <button onClick={() => setMostrarQRDelivery(false)} className="text-stone-500 hover:text-stone-900">
                    <i className="fa-solid fa-xmark text-lg"></i>
                  </button>
                </div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${KASERITA_DELIVERY_URL}/${sesion.bodega.slug}`)}`}
                  alt="QR del link de pedidos"
                  width={320}
                  height={320}
                  className="rounded-lg w-full max-w-[320px] h-auto"
                />
                <p className="text-xs text-stone-500 text-center">
                  Tus clientes escanean este código con la cámara de su celular para entrar directo a tu vitrina.
                </p>
              </div>
            </div>
          )}

          {/* Modal: registro de actividad (cambios de precio, anulaciones, turnos, empleados, mermas) */}
          {modalAuditoria && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setModalAuditoria(false)}>
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-clipboard-check text-orange-600"></i> Registro de actividad
                  </h3>
                  <button onClick={() => setModalAuditoria(false)} className="text-stone-500 hover:text-stone-800"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="px-4 pt-3 flex gap-1.5 flex-wrap">
                  {[['todo', 'Todo'], ['productos', 'Precios y productos'], ['ventas', 'Ventas'], ['turnos_caja', 'Turnos'], ['cajeros', 'Empleados'], ['mermas', 'Mermas']].map(([valor, etiqueta]) => (
                    <button
                      key={valor}
                      onClick={() => setFiltroAuditoria(valor)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${filtroAuditoria === valor ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'}`}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>
                <div className="p-4 overflow-y-auto space-y-2">
                  {esModoDemo && <p className="text-xs text-stone-500">El registro de actividad no está disponible en el modo demostración local.</p>}
                  {errorAuditoria && <p className="text-xs text-rose-600">{errorAuditoria}</p>}
                  {cargandoAuditoria && <p className="text-xs text-stone-500">Cargando...</p>}
                  {!cargandoAuditoria && !errorAuditoria && !esModoDemo && filasAuditoria.filter((f) => filtroAuditoria === 'todo' || f.tabla === filtroAuditoria).length === 0 && (
                    <p className="text-xs text-stone-500">Todavía no hay actividad registrada en esta categoría.</p>
                  )}
                  {filasAuditoria.filter((f) => filtroAuditoria === 'todo' || f.tabla === filtroAuditoria).map((f) => (
                    <div key={f.id} className="bg-white border border-stone-200 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-stone-800 break-words">{f.resumen}</p>
                      <p className="text-[10px] text-stone-500 mt-0.5">
                        {new Date(f.creado_en).toLocaleString('es-PE')}
                        {f.turnos_abiertos && f.turnos_abiertos.length > 0 ? ` · Turno abierto de: ${f.turnos_abiertos.join(', ')}` : ' · Sin turnos abiertos'}
                      </p>
                    </div>
                  ))}
                  {!cargandoAuditoria && filasAuditoria.length >= 300 && <p className="text-[10px] text-stone-400 text-center">Se muestran los últimos 300 movimientos.</p>}
                </div>
              </div>
            </div>
          )}

          {/* Modal: cambiar el PIN de acceso de la cuenta del dueño */}
          {modalPinDueno && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-xs w-full p-5 shadow-2xl space-y-3">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-key text-orange-600"></i> Cambiar mi PIN de acceso
                </h3>
                <p className="text-xs text-stone-600">
                  Es el PIN con el que entrás a Kaserita. Usá {PIN_MIN_DUENO} caracteres o más, mezclando letras y números.
                </p>
                {[['actual', 'PIN actual'], ['nuevo', 'PIN nuevo'], ['repetir', 'Repetí el PIN nuevo']].map(([campo, etiqueta]) => (
                  <input
                    key={campo}
                    type="password"
                    maxLength={PIN_MAX}
                    autoComplete="off"
                    value={formPinDueno[campo]}
                    onChange={(e) => setFormPinDueno((f) => ({ ...f, [campo]: e.target.value }))}
                    placeholder={etiqueta}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                  />
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setModalPinDueno(false); setFormPinDueno({ actual: '', nuevo: '', repetir: '' }); }}
                    className="flex-1 py-2 bg-white/70 text-stone-600 text-xs font-semibold rounded-full shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={cambiarPinDueno}
                    disabled={cambiandoPinDueno || !formPinDueno.actual.trim() || !formPinDueno.nuevo.trim()}
                    className="flex-1 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-xs font-bold rounded-full"
                  >
                    {cambiandoPinDueno ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: cambiar el PIN de seguridad de un Administrador */}
          {modalPinCajero && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-xs w-full p-5 shadow-2xl space-y-3">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-key text-orange-600"></i> PIN de {modalPinCajero.nombre}
                </h3>
                <p className="text-xs text-stone-600">Se le va a pedir a cualquiera que elija a "{modalPinCajero.nombre}" al abrir turno.</p>
                <input
                  type="text"
                  maxLength={PIN_MAX}
                  autoComplete="off"
                  autoFocus
                  value={nuevoPinCajero}
                  onChange={(e) => setNuevoPinCajero(e.target.value)}
                  placeholder="4 a 32 caracteres"
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-center text-lg tracking-widest text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setModalPinCajero(null); setNuevoPinCajero(''); }}
                    className="flex-1 py-2 bg-white/70 text-stone-600 text-xs font-semibold rounded-full shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarPinCajero}
                    disabled={guardandoPinCajero}
                    className="flex-1 py-2 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow"
                  >
                    {guardandoPinCajero ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Gestión de Clientes (listar / editar) */}
          {modalGestionClientes && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-lg w-full p-5 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-[#ece0fd] text-[#6105dc] flex items-center justify-center text-sm"><i className="fa-solid fa-users"></i></span> Clientes
                  </h3>
                  <button onClick={() => { setModalGestionClientes(false); setClienteEditando(null); }} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>

                {!clienteEditando && (
                  <button
                    type="button"
                    onClick={() => setModalNuevoCliente(true)}
                    className="shrink-0 w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white text-xs font-bold rounded-full shadow-sm flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-user-plus"></i> Agregar Cliente
                  </button>
                )}

                {clienteEditando ? (
                  <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_10px_40px_-14px_rgba(97,5,220,0.18)] space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-stone-900">DNI: {clienteEditando.dni}</span>
                      <button onClick={() => setClienteEditando(null)} className="text-xs text-stone-600 underline">Volver a la lista</button>
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Nombre Completo:</label>
                      <input
                        type="text"
                        value={formEditarCliente.nombre_completo}
                        onChange={(e) => setFormEditarCliente({ ...formEditarCliente, nombre_completo: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-3.5 py-2 text-xs text-stone-900"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Teléfono:</label>
                        <input
                          type="text"
                          value={formEditarCliente.telefono}
                          onChange={(e) => setFormEditarCliente({ ...formEditarCliente, telefono: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-3.5 py-2 text-xs text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Correo:</label>
                        <input
                          type="text"
                          value={formEditarCliente.correo}
                          onChange={(e) => setFormEditarCliente({ ...formEditarCliente, correo: e.target.value })}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-3.5 py-2 text-xs text-stone-900"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Límite de Crédito (S/):</label>
                      <input
                        type="number"
                        step="10"
                        value={formEditarCliente.limite_credito}
                        onChange={(e) => setFormEditarCliente({ ...formEditarCliente, limite_credito: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-3.5 py-2 text-sm font-bold text-orange-600"
                      />
                      <p className="text-xs text-stone-500 mt-1">Deuda actual: S/ {Number(clienteEditando.saldo_actual || 0).toFixed(2)} (no editable aquí)</p>
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Días de Crédito (plazo para pagar):</label>
                      <input
                        type="number"
                        step="1"
                        value={formEditarCliente.dias_credito}
                        onChange={(e) => setFormEditarCliente({ ...formEditarCliente, dias_credito: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-3.5 py-2 text-sm font-bold text-stone-900"
                      />
                    </div>
                    <button
                      onClick={guardarEdicionCliente}
                      disabled={guardandoEdicionCliente}
                      className="w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow-sm"
                    >
                      {guardandoEdicionCliente ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 shrink-0">
                      <input
                        type="text"
                        placeholder="Buscar por nombre o DNI..."
                        value={busquedaClientes}
                        onChange={(e) => setBusquedaClientes(e.target.value)}
                        className="flex-1 min-w-0 bg-white border border-stone-200/70 shadow-sm rounded-full px-4 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                      />
                      {clientesLista.length > 0 && (
                        <button
                          onClick={exportarClientesExcel}
                          className="px-3.5 py-2 bg-white/70 hover:bg-[#ece0fd] text-stone-600 hover:text-[#4d04b0] text-xs font-semibold rounded-full shadow-sm flex items-center gap-1.5 transition"
                          title="Exportar a Excel"
                        >
                          <i className="fa-solid fa-file-excel"></i>
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2">
                      {cargandoClientes ? (
                        <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
                      ) : clientesFiltradosGestion().length === 0 ? (
                        <p className="text-xs text-stone-500 text-center py-6">Sin clientes registrados.</p>
                      ) : (
                        clientesFiltradosGestion().map((c) => (
                          <button
                            key={c.id}
                            onClick={() => abrirEdicionCliente(c)}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white/60 hover:bg-[#f4eefe] backdrop-blur-xl border border-white/80 rounded-2xl shadow-sm transition text-left"
                          >
                            <div>
                              <p className="text-sm font-semibold text-stone-900">{c.nombre_completo}</p>
                              <p className="text-xs text-stone-500">DNI: {c.dni} {c.telefono && `· ${c.telefono}`}</p>
                            </div>
                            <div className="text-right shrink-0">
                              {Number(c.saldo_actual) > 0 && (
                                <span className="inline-block px-2 py-0.5 mb-1 rounded-full bg-rose-50 text-xs font-bold text-rose-600 whitespace-nowrap">Debe S/ {formatoSoles(Number(c.saldo_actual))}</span>
                              )}
                              <span className="text-xs text-stone-500 block whitespace-nowrap">Límite S/ {formatoSoles(Number(c.limite_credito || 0))}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Modal: Nuevo Cliente con Límite de Crédito */}
          {/* Modal: Buscar/Seleccionar Cliente (POS) */}
          {modalBuscarCliente && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3 max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2"><span className="w-8 h-8 rounded-xl bg-[#ece0fd] text-[#6105dc] flex items-center justify-center text-sm"><i className="fa-solid fa-user"></i></span> Seleccionar cliente</h3>
                  <button onClick={() => setModalBuscarCliente(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={busquedaClientePOS}
                  onChange={(e) => setBusquedaClientePOS(e.target.value)}
                  placeholder="Buscar por nombre o DNI..."
                  className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-4 py-2 text-sm text-stone-900 shrink-0 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                />
                <div className="flex-1 overflow-y-auto hide-scrollbar -mx-1 px-1 space-y-2">
                  <button
                    onClick={() => seleccionarClientePOS({ dni: '99999999', nombre_completo: 'Cliente Varios / Desconocido', saldo_actual: 0 })}
                    className="w-full text-left px-4 py-3 bg-white/60 hover:bg-[#f4eefe] backdrop-blur-xl border border-white/80 rounded-2xl shadow-sm transition"
                  >
                    <p className="text-sm font-semibold text-stone-900">Cliente Varios / Desconocido</p>
                    <p className="text-xs text-stone-500">Sin DNI registrado</p>
                  </button>
                  {cargandoClientes ? (
                    <p className="text-xs text-stone-500 text-center py-4">Cargando clientes...</p>
                  ) : clientesFiltradosPOS().length === 0 ? (
                    <p className="text-xs text-stone-500 text-center py-4">No se encontraron clientes.</p>
                  ) : (
                    clientesFiltradosPOS().map((c) => (
                      <button
                        key={c.id}
                        onClick={() => seleccionarClientePOS(c)}
                        className="w-full text-left px-4 py-3 bg-white/60 hover:bg-[#f4eefe] backdrop-blur-xl border border-white/80 rounded-2xl shadow-sm transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-stone-900 truncate">{c.nombre_completo}</p>
                          {Number(c.saldo_actual) > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-xs font-bold text-rose-600 shrink-0 whitespace-nowrap">S/ {formatoSoles(Number(c.saldo_actual))}</span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500">DNI/RUC: {c.dni}</p>
                      </button>
                    ))
                  )}
                </div>
                <button
                  onClick={() => { setModalBuscarCliente(false); setModalNuevoCliente(true); }}
                  className="shrink-0 w-full py-2 text-xs font-semibold text-[#6105dc] hover:underline"
                >
                  + Registrar cliente nuevo
                </button>
              </div>
            </div>
          )}

          {modalNuevoCliente && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-stone-900"><i className="fa-solid fa-user-plus mr-1.5"></i> Registrar Nuevo Cliente</h3>
                  <button onClick={() => setModalNuevoCliente(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <form onSubmit={handleGuardarNuevoCliente} className="space-y-2.5">
                  <div>
                    <label className="text-xs text-stone-600 block mb-1">DNI *</label>
                    <input
                      type="text"
                      required
                      value={formCliente.dni}
                      onChange={(e) => setFormCliente({ ...formCliente, dni: e.target.value })}
                      className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-600 block mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      value={formCliente.nombre}
                      onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })}
                      className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={formCliente.telefono}
                        onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Correo</label>
                      <input
                        type="text"
                        value={formCliente.correo}
                        onChange={(e) => setFormCliente({ ...formCliente, correo: e.target.value })}
                        className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-stone-600 block mb-1">Límite de Crédito (S/) *</label>
                    <input
                      type="number"
                      step="10"
                      required
                      value={formCliente.limiteCredito}
                      onChange={(e) => setFormCliente({ ...formCliente, limiteCredito: e.target.value })}
                      className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-3 py-1.5 text-sm font-bold text-orange-600"
                    />
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white font-bold text-xs rounded-full shadow mt-2">
                    Guardar Cliente
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Dashboard de Ventas (detallado). Estilo "cristal suave": fondo
              lavanda con degradado, tarjetas blancas translúcidas de esquinas
              muy redondeadas, cifras grandes y ligeras, el morado de la marca
              como único acento (la barra más alta se resalta con degradado) y
              verde/rojo solo para variaciones y deudas. El encabezado con los
              filtros queda fijo y solo el contenido hace scroll. */}
          {modalDashboard && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-6xl w-full max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
                <div className="shrink-0 px-5 md:px-7 pt-6 pb-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-2xl md:text-3xl font-medium text-stone-900 tracking-tight">Dashboard de <span className="text-[#6105dc]">ventas</span></h3>
                      <p className="text-xs text-stone-500 mt-1.5 flex items-center gap-1.5">
                        <i className="fa-regular fa-circle-question text-stone-400"></i>
                        Del {String(fechaInicioDash).split('-').reverse().join('/')} al {String(fechaFinDash).split('-').reverse().join('/')}
                        {dashStats.numVentas > 0 && <> · <span className="text-[#6105dc] font-semibold">{dashStats.numVentas} venta{dashStats.numVentas === 1 ? '' : 's'}</span></>}
                      </p>
                    </div>
                    <button onClick={() => setModalDashboard(false)} className="w-10 h-10 rounded-full bg-white/80 hover:bg-white text-stone-600 hover:text-stone-900 shadow-sm flex items-center justify-center shrink-0" aria-label="Cerrar">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                  <FiltroFechasRapido
                    desde={fechaInicioDash}
                    hasta={fechaFinDash}
                    setDesde={setFechaInicioDash}
                    setHasta={setFechaFinDash}
                    onRango={cargarDashboard}
                    diasAtras={7}
                  >
                    {dashStats.numVentas > 0 && (
                      <button
                        onClick={exportarDashboardExcel}
                        className="px-4 py-1.5 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-full shadow-sm flex items-center gap-1.5 ml-auto"
                        title="Exportar a Excel"
                      >
                        <i className="fa-solid fa-file-excel text-[#6105dc]"></i> Excel
                      </button>
                    )}
                  </FiltroFechasRapido>
                </div>

                <div className="flex-1 overflow-y-auto hide-scrollbar px-5 md:px-7 pb-7 pt-1 space-y-4">
                {cargandoDashboard ? (
                  <p className="text-xs text-center py-10 text-stone-600">Calculando estadísticas...</p>
                ) : dashStats.numVentas === 0 ? (
                  <p className="text-xs text-center py-10 text-stone-500">No hay ventas registradas en ese rango.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Métricas: 4 mosaicos con el ícono en un círculo */}
                      <section className="lg:col-span-5 bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_10px_40px_-14px_rgba(97,5,220,0.18)] p-5">
                        <h4 className="text-sm font-semibold text-stone-800">Métricas del período</h4>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          {[
                            { etiqueta: 'Utilidad', valor: `S/ ${formatoSoles(dashStats.totalUtilidad)}`, icono: 'fa-arrow-trend-up', pct: dashStats.hayBaseUtilidadAnterior ? dashStats.cambioUtilidadPct : null },
                            { etiqueta: 'Costo', valor: `S/ ${formatoSoles(dashStats.totalCosto)}`, icono: 'fa-coins' },
                            { etiqueta: 'Margen', valor: `${dashStats.margenPct.toFixed(1)}%`, icono: 'fa-percent' },
                            { etiqueta: 'Ticket promedio', valor: `S/ ${formatoSoles(dashStats.ticketPromedio)}`, icono: 'fa-receipt' },
                          ].map((d) => (
                            <div key={d.etiqueta} className="bg-white/80 rounded-2xl p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xl xl:text-2xl font-medium text-stone-900 tracking-tight tabular-nums leading-tight whitespace-nowrap">{d.valor}</p>
                                <span className="w-8 h-8 rounded-full bg-[#f4eefe] text-[#6105dc] flex items-center justify-center shrink-0">
                                  <i className={`fa-solid ${d.icono} text-xs`}></i>
                                </span>
                              </div>
                              <p className="text-xs text-stone-500 mt-2">{d.etiqueta}</p>
                              {d.pct != null && <div className="mt-1"><VariacionPct pct={d.pct} corto /></div>}
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* Venta total + ventas por hora: la hora pico se resalta */}
                      <section className="lg:col-span-7 bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_10px_40px_-14px_rgba(97,5,220,0.18)] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-stone-800">Venta total</h4>
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-2">
                              <span className="text-4xl md:text-5xl font-medium text-stone-900 tracking-tight tabular-nums">S/ {formatoSoles(dashStats.totalVenta)}</span>
                              <VariacionPct pct={dashStats.hayBaseVentaAnterior ? dashStats.cambioVentaPct : null} />
                            </div>
                          </div>
                          {dashStats.horaPico.total > 0 && (
                            <p className="text-xs text-stone-500 sm:text-right">
                              Hora pico <span className="font-semibold text-[#6105dc]">{String(dashStats.horaPico.hora).padStart(2, '0')}:00</span><br />
                              {((dashStats.horaPico.total / dashStats.totalVenta) * 100).toFixed(0)}% de las ventas
                            </p>
                          )}
                        </div>

                        <div className="flex items-end gap-[3px] h-40 mt-6" onMouseLeave={() => setHoraResaltada(null)}>
                          {dashStats.porHora.map((h, i) => {
                            const esPico = dashStats.horaPico.total > 0 && h.hora === dashStats.horaPico.hora;
                            const activa = horaResaltada === i;
                            return (
                              <div key={h.hora} className="relative flex-1 h-full flex items-end" onMouseEnter={() => setHoraResaltada(i)}>
                                {activa && h.total > 0 && (
                                  <div className={`absolute bottom-full mb-1.5 bg-stone-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap pointer-events-none z-20 shadow-lg ${i < 3 ? 'left-0' : i > 20 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                                    <div className="font-bold">{String(h.hora).padStart(2, '0')}:00 · S/ {formatoSoles(h.total)}</div>
                                    <div className="text-stone-300">{h.cantidad} venta{h.cantidad === 1 ? '' : 's'}</div>
                                  </div>
                                )}
                                <div
                                  className={`w-full rounded-t-xl rounded-b-md transition-colors duration-200 ${esPico ? 'bg-gradient-to-t from-[#6105dc] to-[#b98cf5] shadow-[0_10px_24px_-8px_rgba(97,5,220,0.55)]' : activa ? 'bg-[#d6bdfa]' : 'bg-white'}`}
                                  style={{ height: `${Math.max(4, (h.total / dashStats.maxHora) * 100)}%` }}
                                ></div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-[3px] mt-2 text-[10px] text-stone-400">
                          {dashStats.porHora.map((h) => (
                            <span key={h.hora} className={`flex-1 text-center whitespace-nowrap ${dashStats.horaPico.total > 0 && h.hora === dashStats.horaPico.hora ? 'font-bold text-[#6105dc]' : ''}`}>{h.hora % 3 === 0 ? `${h.hora}h` : ''}</span>
                          ))}
                        </div>
                      </section>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Métodos de pago */}
                      <section className="lg:col-span-5 bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_10px_40px_-14px_rgba(97,5,220,0.18)] p-5">
                        <h4 className="text-sm font-semibold text-stone-800">Métodos de pago</h4>
                        <p className="text-xs text-stone-500 mt-0.5">Cómo pagaron tus clientes</p>
                        <div className="flex h-3 rounded-full overflow-hidden bg-white/80 mt-5">
                          {dashStats.porMedio.map(m => (
                            <div key={m.medio} title={`${m.medio}: ${m.pct.toFixed(0)}%`} style={{ width: `${m.pct}%`, background: COLOR_MEDIO_PAGO[m.medio] || '#d6d3d1' }}></div>
                          ))}
                        </div>
                        <ul className="mt-5 space-y-2">
                          {dashStats.porMedio.map(m => (
                            <li key={m.medio} className="flex items-center gap-3 bg-white/80 rounded-2xl px-3.5 py-2.5 text-sm shadow-sm">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR_MEDIO_PAGO[m.medio] || '#d6d3d1' }}></span>
                              <span className="flex-1 min-w-0 truncate font-medium text-stone-800 capitalize">{m.medio.toLowerCase()}</span>
                              <span className="font-semibold text-stone-900 tabular-nums">S/ {formatoSoles(m.total)}</span>
                              <span className="w-10 text-right text-xs text-stone-500 tabular-nums">{m.pct.toFixed(0)}%</span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      {/* Top productos */}
                      <section className="lg:col-span-7 bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_10px_40px_-14px_rgba(97,5,220,0.18)] p-5">
                        <h4 className="text-sm font-semibold text-stone-800">Productos más vendidos</h4>
                        <p className="text-xs text-stone-500 mt-0.5">Por monto vendido en el período</p>
                        <ol className="mt-4 space-y-2">
                          {dashStats.topProductos.map((p, i) => (
                            <li key={p.descripcion + i} className="flex items-center gap-3 bg-white/80 rounded-2xl px-3.5 py-2.5 shadow-sm">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${i === 0 ? 'bg-[#6105dc] text-white' : 'bg-[#f4eefe] text-[#6105dc]'}`}>{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline gap-3">
                                  <span className="text-sm font-medium text-stone-900 truncate">{p.descripcion}</span>
                                  <span className="text-sm font-semibold text-stone-900 tabular-nums shrink-0">S/ {formatoSoles(p.monto)}</span>
                                </div>
                                <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden mt-1.5">
                                  <div className="h-full bg-gradient-to-r from-[#a26df0] to-[#6105dc] rounded-full" style={{ width: `${(p.monto / dashStats.maxProducto) * 100}%` }}></div>
                                </div>
                                <p className="text-[11px] text-stone-500 mt-1">
                                  {p.cantidad} und · utilidad <span className="text-emerald-600 font-semibold tabular-nums">S/ {formatoSoles(p.utilidad)}</span>
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </section>
                    </div>

                    {/* Ventas por día: calendario del mes completo. Los datos salen de
                        las ventas del año (ventasAnioDash), no del rango del filtro, y
                        el rango elegido queda marcado con un borde. El promedio cuenta
                        los días transcurridos del mes; el "día de menor venta" ignora
                        los días sin ventas (esos se cuentan aparte), si no siempre
                        ganaría un día en cero. */}
                    {(() => {
                      const [aHoy, mHoy, dHoy] = fechaHoyISO().split('-').map(Number);
                      const ver = mesCalendario || { anio: Number(fechaFinDash.slice(0, 4)) || aHoy, mes: (Number(fechaFinDash.slice(5, 7)) || mHoy) - 1 };
                      const fuente = ver.anio === aHoy ? ventasAnioDash : ventasDashboard;
                      const totalPorFecha = new Map();
                      fuente.forEach((v) => {
                        if (v.anulada) return;
                        const f = fechaISOLocal(new Date(v.fecha_hora));
                        totalPorFecha.set(f, (totalPorFecha.get(f) || 0) + Number(v.total_venta));
                      });
                      const diasMes = new Date(ver.anio, ver.mes + 1, 0).getDate();
                      const desfase = (new Date(ver.anio, ver.mes, 1).getDay() + 6) % 7; // semana desde el lunes
                      const prefijo = `${ver.anio}-${String(ver.mes + 1).padStart(2, '0')}-`;
                      const cmpMes = ver.anio * 12 + ver.mes - (aHoy * 12 + (mHoy - 1));
                      const hastaDia = cmpMes > 0 ? 0 : cmpMes === 0 ? dHoy : diasMes;
                      const clave = (d) => prefijo + String(d).padStart(2, '0');
                      const totalDe = (d) => totalPorFecha.get(clave(d)) || 0;
                      const transcurridos = Array.from({ length: hastaDia }, (_, k) => k + 1);
                      const conVentas = transcurridos.filter((d) => totalDe(d) > 0);
                      const totalMes = transcurridos.reduce((a, d) => a + totalDe(d), 0);
                      const promedio = hastaDia ? totalMes / hastaDia : 0;
                      const diaMax = conVentas.reduce((m, d) => (totalDe(d) > totalDe(m) ? d : m), conVentas[0]);
                      const diaMin = conVentas.reduce((m, d) => (totalDe(d) < totalDe(m) ? d : m), conVentas[0]);
                      const maxDia = conVentas.length ? totalDe(diaMax) : 1;
                      const sinVentas = hastaDia - conVentas.length;
                      const nombreDia = (d) => new Date(ver.anio, ver.mes, d).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: '2-digit' }).replace(',', '');
                      const nombreMes = (() => {
                        const t = new Date(ver.anio, ver.mes, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
                        return t.charAt(0).toUpperCase() + t.slice(1);
                      })();
                      const celdas = [...Array(desfase).fill(null), ...Array.from({ length: diasMes }, (_, k) => k + 1)];
                      while (celdas.length % 7) celdas.push(null);
                      const semanas = [];
                      for (let i = 0; i < celdas.length; i += 7) {
                        const dias = celdas.slice(i, i + 7).filter((d) => d !== null && d <= hastaDia);
                        semanas.push({ n: dias.length, total: dias.reduce((a, d) => a + totalDe(d), 0) });
                      }
                      const semanasVisibles = semanas.map((s, i) => ({ ...s, i })).filter((s) => s.n > 0);
                      const maxSemana = Math.max(1, ...semanasVisibles.map((s) => s.total));
                      const puedeAnterior = ver.anio === aHoy && ver.mes > 0;
                      const puedeSiguiente = ver.anio === aHoy && ver.mes < mHoy - 1;
                      const tarjeta = 'rounded-2xl shadow-sm p-4 min-w-0';
                      return (
                        <section className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_10px_40px_-14px_rgba(97,5,220,0.18)] p-5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-semibold text-stone-800">Ventas por día</h4>
                              <p className="text-xs text-stone-500 mt-0.5">Pasá el mouse sobre un día para ver el monto exacto</p>
                            </div>
                            <p className="text-xs text-stone-500 sm:text-right">Total del mes<br /><span className="text-sm font-semibold text-stone-900 tabular-nums">S/ {formatoSoles(totalMes)}</span></p>
                          </div>

                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                            <div className={`${tarjeta} bg-white/80`}>
                              <p className="text-[11px] text-stone-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-stone-400"></span>Promedio diario</p>
                              <p className="text-lg font-semibold text-stone-900 mt-1 tabular-nums whitespace-nowrap truncate">{conVentas.length ? montoResumen(promedio) : '—'}</p>
                              <p className="text-[11px] text-stone-500">en {hastaDia} día{hastaDia === 1 ? '' : 's'} transcurrido{hastaDia === 1 ? '' : 's'}</p>
                            </div>
                            <div className={`${tarjeta} bg-[#f4eefe] border border-[#d6bdfa]`}>
                              <p className="text-[11px] text-stone-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#6105dc]"></span>Día de mayor venta</p>
                              <p className="text-lg font-semibold text-stone-900 mt-1 tabular-nums whitespace-nowrap truncate">{conVentas.length ? montoResumen(totalDe(diaMax)) : '—'}</p>
                              <p className="text-[11px] text-stone-500 truncate">{conVentas.length ? `${nombreDia(diaMax)} · ${(totalDe(diaMax) / promedio).toFixed(1).replace('.', ',')}× el promedio` : 'Sin ventas'}</p>
                            </div>
                            <div className={`${tarjeta} bg-white/80`}>
                              <p className="text-[11px] text-stone-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Día de menor venta</p>
                              <p className="text-lg font-semibold text-rose-600 mt-1 tabular-nums whitespace-nowrap truncate">{conVentas.length ? montoResumen(totalDe(diaMin)) : '—'}</p>
                              <p className="text-[11px] text-stone-500 truncate">{conVentas.length ? `${nombreDia(diaMin)} · ${Math.round((totalDe(diaMin) / promedio) * 100)}% del promedio` : 'Sin ventas'}</p>
                            </div>
                            <div className={`${tarjeta} bg-white/80`}>
                              <p className="text-[11px] text-stone-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-stone-300"></span>Días sin ventas</p>
                              <p className="text-lg font-semibold text-stone-900 mt-1 tabular-nums">{sinVentas}</p>
                              <p className="text-[11px] text-stone-500 truncate">{sinVentas ? 'Revisá si el local abrió' : hastaDia ? 'Vendiste todos los días' : '—'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-5">
                            <button
                              onClick={() => setMesCalendario({ anio: ver.anio, mes: ver.mes - 1 })}
                              disabled={!puedeAnterior}
                              className="w-7 h-7 rounded-full border border-stone-200 bg-white text-stone-500 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                              aria-label="Mes anterior"
                            ><i className="fa-solid fa-chevron-left text-[10px]"></i></button>
                            <span className="text-[15px] font-semibold text-stone-900 min-w-[8.5rem] text-center">{nombreMes}</span>
                            <button
                              onClick={() => setMesCalendario({ anio: ver.anio, mes: ver.mes + 1 })}
                              disabled={!puedeSiguiente}
                              className="w-7 h-7 rounded-full border border-stone-200 bg-white text-stone-500 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                              aria-label="Mes siguiente"
                            ><i className="fa-solid fa-chevron-right text-[10px]"></i></button>
                          </div>

                          <div className="grid grid-cols-7 gap-2 sm:gap-2.5 mt-4">
                            {['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => (
                              <div key={d} className="text-[10px] uppercase tracking-wider text-stone-400 text-center pb-0.5">{d}</div>
                            ))}
                            {celdas.map((d, i) => {
                              if (d === null) return <div key={`v${i}`}></div>;
                              const futuro = d > hastaDia;
                              if (futuro) {
                                return (
                                  <div key={d} className="rounded-2xl min-h-[60px] sm:min-h-[100px] sm:aspect-[5/4] p-2 sm:p-3 flex flex-col justify-between border border-dashed border-stone-200 text-stone-300">
                                    <span className="text-xs sm:text-sm font-semibold">{d}</span>
                                    <span className="text-base text-right">—</span>
                                  </div>
                                );
                              }
                              const v = totalDe(d);
                              const t = maxDia ? v / maxDia : 0;
                              const esMax = conVentas.length > 0 && d === diaMax;
                              const esMin = conVentas.length > 1 && d === diaMin;
                              const oscuro = esMax || t > 0.55;
                              const enRango = clave(d) >= fechaInicioDash && clave(d) <= fechaFinDash;
                              const esHoy = cmpMes === 0 && d === dHoy;
                              return (
                                <div
                                  key={d}
                                  title={`${nombreDia(d)}: S/ ${formatoSoles(v)}`}
                                  className={`relative rounded-2xl min-h-[60px] sm:min-h-[100px] sm:aspect-[5/4] p-2 sm:p-3 flex flex-col justify-between overflow-hidden ${enRango ? 'ring-2 ring-inset ring-[#6105dc]' : ''} ${esMax ? 'shadow-[0_10px_22px_-8px_rgba(97,5,220,0.55)]' : ''} ${oscuro ? 'text-white' : 'text-stone-800'}`}
                                  style={{ background: esMax ? 'linear-gradient(160deg,#b98cf5,#6105dc)' : v > 0 ? `rgba(97,5,220,${(0.06 + t * 0.5).toFixed(2)})` : '#f0edf5' }}
                                >
                                  <span className="text-xs sm:text-sm font-semibold opacity-80">
                                    {d}
                                    {esMax && <span className="text-[9px] ml-1">▲</span>}
                                    {esMin && <span className={`text-[9px] ml-1 ${oscuro ? 'text-rose-200' : 'text-rose-600'}`}>▼</span>}
                                  </span>
                                  <span className="text-[10px] sm:text-base font-semibold text-right tabular-nums whitespace-nowrap">{v > 0 ? `S/ ${montoCorto(v)}` : '—'}</span>
                                  {esHoy && <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${esMax ? 'bg-white' : 'bg-[#6105dc]'}`}></span>}
                                </div>
                              );
                            })}
                          </div>

                          {semanasVisibles.length > 0 && (
                            <>
                              <div className="flex items-baseline justify-between mt-6 pt-5 border-t border-stone-200/70 mb-2.5">
                                <h5 className="text-[13px] font-semibold text-stone-800">Total por semana</h5>
                                <span className="text-[11px] text-stone-500 hidden sm:inline">La barra compara cada semana con la mejor del mes</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                                {semanasVisibles.map((s) => (
                                  <div key={s.i} title={`Semana ${s.i + 1}: S/ ${formatoSoles(s.total)}`} className={`rounded-2xl p-4 flex flex-col gap-2 min-w-0 border ${s.total === maxSemana ? 'bg-[#f5eefe] border-[#d9c6f8]' : 'bg-white/70 border-stone-200/70'}`}>
                                    <div className="flex justify-between items-baseline gap-1.5 text-[11px] text-stone-500">
                                      <span>Semana {s.i + 1}</span><span className="text-[10px]">{s.n} d.</span>
                                    </div>
                                    <p className="text-lg font-semibold text-stone-900 tabular-nums whitespace-nowrap">{montoResumen(s.total)}</p>
                                    <div className="h-2 rounded-full bg-stone-200/70 overflow-hidden">
                                      <div className="h-full rounded-full bg-gradient-to-r from-[#b98cf5] to-[#6105dc]" style={{ width: `${(s.total / maxSemana) * 100}%` }}></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-[11px] text-stone-500">
                            <span className="inline-flex items-center gap-1.5"><i className="inline-block w-7 h-2 rounded-full bg-gradient-to-r from-[#f1e9fd] to-[#6105dc]"></i>Menos → más ventas</span>
                            <span>▲ Mejor día</span>
                            <span className="text-rose-600">▼ Día más flojo</span>
                            <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3.5 h-3.5 rounded-[5px] ring-2 ring-inset ring-[#6105dc]"></i>Rango elegido</span>
                            <span>● Hoy</span>
                          </div>
                        </section>
                      );
                    })()}

                    {/* Ventas por Mes */}
                    {dashStats.totalAnio > 0 && (
                      <section className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_10px_40px_-14px_rgba(97,5,220,0.18)] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-stone-800">Ventas por mes · {dashStats.anioActual}</h4>
                            <p className="text-xs text-stone-500 mt-0.5">Acumulado del año <span className="font-semibold text-stone-800 tabular-nums">S/ {formatoSoles(dashStats.totalAnio)}</span></p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="bg-[#ece0fd] text-[#4d04b0] text-[11px] font-semibold px-3 py-1 rounded-full">Mejor mes: {MESES_CORTOS[dashStats.mesPico.mes]} · S/ {formatoSoles(dashStats.mesPico.total)}</span>
                            <span className="bg-white/80 text-stone-600 text-[11px] font-semibold px-3 py-1 rounded-full shadow-sm">Promedio: S/ {formatoSoles(dashStats.promedioMensual)}</span>
                            {dashStats.hayBaseMesAnterior && (
                              <span className="bg-white/80 text-[11px] px-3 py-1 rounded-full shadow-sm inline-flex items-center gap-1.5 text-stone-500">
                                vs mes anterior <VariacionPct pct={dashStats.cambioMesPct} corto />
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-12 gap-1.5 sm:gap-2.5 items-end h-48 pt-6 mt-4">
                          {dashStats.porMes.map((m, i) => {
                            const esPico = m.total > 0 && m.mes === dashStats.mesPico.mes;
                            const esActual = m.mes === dashStats.mesActualIdx;
                            return (
                              <div
                                key={m.mes}
                                className="flex flex-col items-center h-full justify-end group"
                                onMouseEnter={() => setMesResaltado(i)}
                                onMouseLeave={() => setMesResaltado((cur) => (cur === i ? null : cur))}
                                onFocus={() => setMesResaltado(i)}
                                onBlur={() => setMesResaltado((cur) => (cur === i ? null : cur))}
                                tabIndex={m.total > 0 ? 0 : -1}
                              >
                                <span className={`text-[9px] sm:text-[10px] font-semibold mb-1 tabular-nums transition-opacity ${mesResaltado === i || esPico ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${esPico ? 'text-[#6105dc]' : 'text-stone-500'}`}>
                                  {m.total >= 1000 ? `${(m.total / 1000).toFixed(1)}k` : m.total.toFixed(0)}
                                </span>
                                <div
                                  className={`w-full max-w-[34px] rounded-t-xl rounded-b-md transition-colors duration-200 ${esPico ? 'bg-gradient-to-t from-[#6105dc] to-[#b98cf5] shadow-[0_10px_24px_-8px_rgba(97,5,220,0.55)]' : mesResaltado === i ? 'bg-[#d6bdfa]' : 'bg-white group-hover:bg-[#ece0fd]'}`}
                                  style={{ height: `${Math.max(3, (m.total / dashStats.maxMes) * 100)}%` }}
                                ></div>
                                <span className={`text-[10px] sm:text-[11px] mt-2 ${esPico ? 'font-bold text-[#6105dc]' : esActual ? 'font-bold text-stone-800' : 'font-medium text-stone-500'}`}>{MESES_CORTOS[m.mes]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* Deudas: no dependen del rango de fechas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <section className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_10px_40px_-14px_rgba(97,5,220,0.18)] p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-stone-800">Cuentas por cobrar</h4>
                            <p className={`text-2xl font-medium tracking-tight tabular-nums mt-1.5 ${dashStats.totalDeuda > 0 ? 'text-rose-600' : 'text-stone-900'}`}>S/ {formatoSoles(dashStats.totalDeuda)}</p>
                          </div>
                          <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${dashStats.numDeudores > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {dashStats.numDeudores > 0 ? `${dashStats.numDeudores} cliente${dashStats.numDeudores === 1 ? '' : 's'}` : 'Al día'}
                          </span>
                        </div>
                        {dashStats.numDeudores === 0 ? (
                          <p className="text-xs text-stone-500 mt-3">Ningún cliente tiene deuda pendiente.</p>
                        ) : (
                          <ul className="space-y-2 mt-4 max-h-48 overflow-y-auto hide-scrollbar">
                            {clientesDeuda.map((c, i) => (
                              <li key={c.dni + i} className="bg-white/80 rounded-2xl px-3.5 py-2.5 shadow-sm">
                                <div className="flex justify-between items-baseline gap-3 text-sm">
                                  <span className="text-stone-800 truncate">{c.nombre_completo || c.dni}</span>
                                  <span className="font-semibold text-stone-900 tabular-nums shrink-0">S/ {formatoSoles(c.saldo_actual)}</span>
                                </div>
                                <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden mt-1.5">
                                  <div className="h-full bg-rose-400 rounded-full" style={{ width: `${(Number(c.saldo_actual) / dashStats.maxDeuda) * 100}%` }}></div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>

                      <section className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_10px_40px_-14px_rgba(97,5,220,0.18)] p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-stone-800">Cuentas por pagar</h4>
                            <p className="text-2xl font-medium tracking-tight tabular-nums mt-1.5 text-stone-900">S/ {formatoSoles(dashStats.totalPorPagar)}</p>
                          </div>
                          <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${dashStats.numProveedoresDeuda > 0 ? 'bg-[#ece0fd] text-[#4d04b0]' : 'bg-emerald-50 text-emerald-600'}`}>
                            {dashStats.numProveedoresDeuda > 0 ? `${dashStats.numProveedoresDeuda} proveedor${dashStats.numProveedoresDeuda === 1 ? '' : 'es'}` : 'Al día'}
                          </span>
                        </div>
                        {dashStats.numProveedoresDeuda === 0 ? (
                          <p className="text-xs text-stone-500 mt-3">No le debes a ningún proveedor.</p>
                        ) : (
                          <ul className="space-y-2 mt-4 max-h-48 overflow-y-auto hide-scrollbar">
                            {proveedoresDeudaDash.map((p, i) => (
                              <li key={p.nombre + i} className="bg-white/80 rounded-2xl px-3.5 py-2.5 shadow-sm">
                                <div className="flex justify-between items-baseline gap-3 text-sm">
                                  <span className="text-stone-800 truncate">{p.nombre}</span>
                                  <span className="font-semibold text-stone-900 tabular-nums shrink-0">S/ {formatoSoles(p.saldo_actual)}</span>
                                </div>
                                <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden mt-1.5">
                                  <div className="h-full bg-gradient-to-r from-[#a26df0] to-[#6105dc] rounded-full" style={{ width: `${(Number(p.saldo_actual) / dashStats.maxPorPagar) * 100}%` }}></div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    </div>
                  </>
                )}
                </div>
              </div>
            </div>
          )}

          {/* Modal: Historial de Ventas (mismo estilo que el Dashboard) */}
          {modalHistorial && (() => {
            const activas = ventasDelDia.filter(v => !v.anulada);
            const totalGeneral = activas.reduce((a, c) => a + Number(c.total_venta), 0);
            const totalEfectivo = activas.filter(v => v.medio_pago === 'EFECTIVO').reduce((a, c) => a + Number(c.total_venta), 0);
            const totalGanancia = activas.reduce((a, c) => a + Number(c.utilidad_total || 0), 0);
            const filtradas = ventasDelDia.filter(v => v.nro_boleta.toLowerCase().includes(busquedaBoletaHistorial.trim().toLowerCase()));
            const tile = 'bg-white/70 border border-white/80 rounded-2xl shadow-sm px-3 py-2.5 min-w-0';
            return (
              <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] rounded-[28px] max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-white/80">
                  <div className="p-5 pb-3 shrink-0 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-[#ece0fd] text-[#6105dc] flex items-center justify-center text-sm"><i className="fa-solid fa-receipt"></i></span>
                        Historial de ventas
                      </h3>
                      <button onClick={() => setModalHistorial(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Desde:</label>
                        <input
                          type="date"
                          value={fechaInicioHistorial}
                          onChange={(e) => setFechaInicioHistorial(e.target.value)}
                          className="bg-white border border-stone-200/70 shadow-sm rounded-full px-3 py-1.5 text-xs text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Hasta:</label>
                        <input
                          type="date"
                          value={fechaFinHistorial}
                          onChange={(e) => setFechaFinHistorial(e.target.value)}
                          className="bg-white border border-stone-200/70 shadow-sm rounded-full px-3 py-1.5 text-xs text-stone-900"
                        />
                      </div>
                      <button
                        onClick={() => cargarHistorialPorRango(fechaInicioHistorial, fechaFinHistorial)}
                        className="px-4 py-1.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white text-xs font-semibold rounded-full shadow-sm"
                      >
                        Buscar
                      </button>
                      <button
                        onClick={abrirHistorialDelDia}
                        className="px-4 py-1.5 bg-white/70 hover:bg-[#ece0fd] text-stone-600 hover:text-[#4d04b0] text-xs font-semibold rounded-full shadow-sm transition"
                      >
                        Hoy
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                        <input
                          type="text"
                          placeholder="Buscar N° de boleta..."
                          value={busquedaBoletaHistorial}
                          onChange={(e) => setBusquedaBoletaHistorial(e.target.value)}
                          className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full pl-9 pr-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                        />
                      </div>
                      {esAdmin && ventasDelDia.length > 0 && (
                        <button
                          onClick={exportarVentasExcel}
                          className="px-4 py-2 bg-white/70 hover:bg-[#ece0fd] text-stone-600 hover:text-[#4d04b0] text-xs font-semibold rounded-full shadow-sm flex items-center gap-1.5 transition shrink-0"
                          title="Exportar a Excel"
                        >
                          <i className="fa-solid fa-file-excel"></i> Excel
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="px-5 pb-5 overflow-y-auto hide-scrollbar space-y-3">
                    <div className={`grid grid-cols-2 ${esAdmin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-2`}>
                      <div className={tile}>
                        <span className="text-[11px] text-stone-500 block">Ventas</span>
                        <span className="text-xl font-bold text-stone-900 whitespace-nowrap">{activas.length}</span>
                      </div>
                      <div className={tile}>
                        <span className="text-[11px] text-stone-500 block">Efectivo</span>
                        <span className="text-xl font-bold text-stone-900 whitespace-nowrap">S/ {formatoSoles(totalEfectivo)}</span>
                      </div>
                      {esAdmin && (
                        <div className={tile}>
                          <span className="text-[11px] text-stone-500 block">Ganancia</span>
                          <span className="text-xl font-bold text-emerald-600 whitespace-nowrap">S/ {formatoSoles(totalGanancia)}</span>
                        </div>
                      )}
                      <div className="bg-[#f4eefe] border border-[#d6bdfa] rounded-2xl shadow-sm px-3 py-2.5 min-w-0">
                        <span className="text-[11px] text-[#6105dc] block">Total general</span>
                        <span className="text-xl font-bold text-[#4d04b0] whitespace-nowrap">S/ {formatoSoles(totalGeneral)}</span>
                      </div>
                    </div>

                    <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_10px_40px_-14px_rgba(97,5,220,0.18)] p-2 max-h-72 overflow-y-auto hide-scrollbar space-y-1">
                      {cargandoHistorial ? (
                        <p className="text-xs text-center py-8 text-stone-500">Cargando ventas...</p>
                      ) : filtradas.length === 0 ? (
                        <p className="text-xs text-center py-8 text-stone-500">No hay ventas en ese rango.</p>
                      ) : (
                        filtradas.map(v => (
                          <div key={v.id} className={`flex justify-between items-center gap-3 px-3 py-2.5 rounded-2xl text-xs hover:bg-[#f4eefe] transition ${v.anulada ? 'opacity-50' : ''}`}>
                            <div className="min-w-0">
                              <p className="font-bold text-stone-900 font-mono truncate">
                                {v.nro_boleta} <span className="ml-1 px-2 py-0.5 rounded-full bg-[#ece0fd] text-[#4d04b0] font-sans font-semibold text-[10px]">{v.medio_pago}</span>
                                {v.anulada && <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 font-sans font-semibold text-[10px]">ANULADA</span>}
                              </p>
                              <p className="text-[11px] text-stone-500 mt-0.5">{new Date(v.fecha_hora).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {v.clientes?.nombre_completo || 'Cliente'}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`font-bold text-sm text-stone-900 whitespace-nowrap ${v.anulada ? 'line-through' : ''}`}>S/ {formatoSoles(Number(v.total_venta))}</span>
                              <button
                                onClick={() => setReciboReimpresion(v)}
                                className="w-8 h-8 rounded-full bg-white hover:bg-[#ece0fd] text-stone-600 hover:text-[#4d04b0] shadow-sm transition"
                                title="Reimprimir boleta"
                              >
                                <i className="fa-solid fa-print"></i>
                              </button>
                              {!v.anulada && esAdmin && (
                                <button
                                  onClick={() => anularVentaHoy(v)}
                                  className="px-3 h-8 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold shadow-sm transition"
                                  title="Anular venta"
                                >
                                  Anular
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Modal: Cierre de Caja con Arqueo */}
          {modalCierreCaja && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3 text-center">
                <h3 className="text-lg font-bold text-stone-900"><i className="fa-solid fa-lock mr-1.5"></i> Cierre de Turno y Arqueo de Caja</h3>

                {!arqueoEsperado ? (
                  <p className="text-xs text-stone-500 py-2">Calculando cuánto debería haber en caja...</p>
                ) : (
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-left text-xs text-stone-700 space-y-1">
                    <div className="flex justify-between"><span>Fondo Inicial:</span><span>S/ {arqueoEsperado.inicio.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>+ Ventas en Efectivo:</span><span>S/ {arqueoEsperado.ventas.toFixed(2)}</span></div>
                    <div className="border-t border-stone-200 pt-1 flex justify-between font-bold text-stone-900">
                      <span>= Deberías tener:</span><span className="text-orange-600">S/ {arqueoEsperado.esperado.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <DesgloseMediosPago desglose={arqueoEsperado?.desglose} />

                <p className="text-xs text-stone-700">Cuenta todo el dinero en efectivo que tienes físicamente en la caja e ingrésalo:</p>
                <input
                  type="number"
                  step="0.50"
                  placeholder="0.00"
                  value={montoConteoEfectivo}
                  onChange={(e) => setMontoConteoEfectivo(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-center text-xl font-black text-orange-600 focus:outline-none"
                  autoFocus
                />
                {arqueoEsperado && montoConteoEfectivo !== '' && (
                  <p className={`text-xs font-bold ${+(parseFloat(montoConteoEfectivo) - arqueoEsperado.esperado).toFixed(2) === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {(() => {
                      const dif = +((parseFloat(montoConteoEfectivo) || 0) - arqueoEsperado.esperado).toFixed(2);
                      return dif === 0 ? (<><i className="fa-solid fa-circle-check mr-1"></i>Cuadra perfecto</>) : dif > 0 ? `Sobran S/ ${dif.toFixed(2)}` : `Faltan S/ ${Math.abs(dif).toFixed(2)}`;
                    })()}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setModalCierreCaja(false)} className="flex-1 py-2 bg-white/70 text-xs font-semibold rounded-full shadow-sm">Cancelar</button>
                  <button onClick={handleCierreConArqueo} className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-full shadow">Confirmar Cierre</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Resumen de Arqueo */}
          {resumenCierre && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3 text-center">
                <h3 className="text-lg font-bold text-stone-900"><i className="fa-solid fa-chart-simple mr-1.5"></i> Resumen del Turno</h3>
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 text-xs space-y-1.5 text-left font-mono">
                  <div className="flex justify-between"><span>Fondo Inicial:</span><span>S/ {resumenCierre.inicio.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>+ Efectivo recibido:</span><span>S/ {resumenCierre.ventas.toFixed(2)}</span></div>
                  <div className="border-t border-stone-100 pt-1 flex justify-between font-bold"><span>= Debería haber:</span><span>S/ {resumenCierre.esperado.toFixed(2)}</span></div>
                  <div className="flex justify-between text-orange-600 font-bold"><span>Tú contaste:</span><span>S/ {resumenCierre.real.toFixed(2)}</span></div>
                  <div className={`border-t border-stone-100 pt-1 flex justify-between font-black text-sm ${resumenCierre.diferencia === 0 ? 'text-orange-600' : resumenCierre.diferencia > 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                    <span>Diferencia:</span><span>{resumenCierre.diferencia === 0 ? (<><i className="fa-solid fa-circle-check mr-1"></i>Cuadre Perfecto</>) : `S/ ${resumenCierre.diferencia.toFixed(2)}`}</span>
                  </div>
                </div>
                <DesgloseMediosPago desglose={resumenCierre.desglose} />
                <button onClick={() => setResumenCierre(null)} className="w-full py-2.5 bg-stone-900 text-white font-bold text-xs rounded-full">Entendido</button>
              </div>
            </div>
          )}

          {/* Modal: Apertura Turno */}
          {modalTurno && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full p-6 shadow-2xl space-y-4">
                <h2 className="text-base font-bold text-stone-900"><i className="fa-solid fa-cash-register mr-1.5"></i> Apertura de Turno de Caja</h2>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Cajero:</label>
                  <select
                    value={cajeroSeleccionado?.id || ''}
                    onChange={(e) => elegirCajeroTurno(listaCajeros.find(c => c.id === e.target.value))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900"
                  >
                    {listaCajeros.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.rol || 'Cajero'})</option>
                    ))}
                  </select>
                  {esAdmin && (
                    <button
                      type="button"
                      onClick={() => { setModalTurno(false); abrirGestionCajeros(); setMostrarFormNuevoCajero(true); }}
                      className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 mt-1"
                    >
                      + No está en la lista, agregarlo
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Monto Inicial (S/):</label>
                  <input
                    type="number"
                    step="1.00"
                    value={montoApertura}
                    onChange={(e) => setMontoApertura(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-lg font-bold text-stone-900"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModalTurno(false)} className="flex-1 py-2 bg-white/70 text-xs font-semibold rounded-full shadow-sm">Cancelar</button>
                  <button onClick={handleAbrirTurno} className="flex-1 py-2 bg-stone-900 text-white text-xs font-bold rounded-full shadow">Confirmar y Abrir</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: confirmar PIN antes de operar como un Administrador que
              no es quien inició sesión -- sin esto, elegir ese nombre en el
              selector de arriba desbloquearía el panel completo sin pedir
              nada. */}
          {cajeroPendientePin && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-xs w-full p-5 shadow-2xl space-y-3">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-lock text-orange-600"></i> PIN de {cajeroPendientePin.nombre}
                </h3>
                <p className="text-xs text-stone-600">Esta cuenta tiene acceso de Administrador -- ingresa su PIN para continuar.</p>
                <input
                  type="password"
                  maxLength={PIN_MAX}
                  autoFocus
                  value={pinConfirmarCajero}
                  onChange={(e) => setPinConfirmarCajero(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmarPinCajero(); }}
                  placeholder="••••"
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-center text-lg tracking-widest text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCajeroPendientePin(null); setPinConfirmarCajero(''); }}
                    className="flex-1 py-2 bg-white/70 text-stone-600 text-xs font-semibold rounded-full shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarPinCajero}
                    disabled={verificandoPinCajero || !pinConfirmarCajero.trim()}
                    className="flex-1 py-2 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow"
                  >
                    {verificandoPinCajero ? 'Verificando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Aviso unificado: hay al menos una caja abierta en la bodega
              (puede incluir la propia, marcada como "(tú)") -- siempre deja
              elegir con cuál trabajar en este dispositivo, o abrir una
              nueva y separada. Nunca se une en silencio a ninguna, porque
              todos los dispositivos entran con el mismo usuario y el
              cajero autoseleccionado por DNI no necesariamente es quien de
              verdad está frente a este dispositivo. */}
          {cajasAbiertasAviso && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
                    <i className="fa-solid fa-cash-register text-orange-600 text-xl"></i>
                  </div>
                  <h2 className="text-base font-bold text-stone-900 mt-3">
                    {cajasAbiertasAviso.length === 1 ? 'Ya hay una caja abierta' : `Ya hay ${cajasAbiertasAviso.length} cajas abiertas`}
                  </h2>
                  <p className="text-xs text-stone-500 mt-1">
                    Elige con cuál vas a trabajar en este dispositivo, o abre una caja nueva y separada.
                  </p>
                </div>

                <div className="space-y-2">
                  {cajasAbiertasAviso.map((t) => (
                    <div key={t.id} className="bg-white border border-stone-200 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-stone-800 truncate">
                          {t.cajeros?.nombre || 'Cajero'}{t.es_propia && <span className="text-orange-600"> (tú)</span>}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          Desde el {new Date(t.fecha_apertura).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          {' '}· S/ {Number(t.monto_inicial || 0).toFixed(2)} inicial
                        </p>
                      </div>
                      <button onClick={() => unirseACaja(t)} className="shrink-0 px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg">
                        Usar esta caja
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={abrirCajaNueva}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold rounded-full shadow flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-plus"></i> Abrir otra caja
                </button>
              </div>
            </div>
          )}

          {/* Modal: Boleta Emitida */}
          {ventaCompletada && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 pt-6 shadow-2xl text-center">
                <div className="w-[60px] h-[60px] mx-auto rounded-full bg-[#6105dc] text-white flex items-center justify-center ring-8 ring-[#6105dc]/10">
                  <IconoTrazo nombre="check" className="w-7 h-7" grosor={2.6} />
                </div>
                <h3 className="text-[22px] font-bold tracking-tight text-stone-900 mt-4">¡Venta exitosa!</h3>
                <span className="inline-block mt-1.5 text-xs font-semibold text-[#6105dc] bg-[#ece0fd] px-3 py-1 rounded-full tabular-nums">
                  Boleta {ventaCompletada.nro_boleta}
                </span>
                {ventaCompletada.offline && (
                  <div className="mt-2.5 text-xs text-amber-700 bg-amber-50 rounded-2xl px-3 py-2 flex items-start gap-2 text-left leading-snug">
                    <IconoTrazo nombre="cloud" className="w-4 h-4 shrink-0 mt-px" />
                    <span>Guardada sin conexión. Se sincronizará sola cuando vuelva el internet.</span>
                  </div>
                )}
                <div className="bg-white rounded-[20px] px-3.5 py-1.5 text-left mt-4 text-[13.5px]">
                  <div className="flex justify-between items-baseline gap-3 py-2.5 border-b border-stone-100">
                    <span className="text-stone-400">Pago</span>
                    <b className="font-semibold text-stone-900">{String(ventaCompletada.medio_pago || '').charAt(0) + String(ventaCompletada.medio_pago || '').slice(1).toLowerCase()}</b>
                  </div>
                  <div className="flex justify-between items-baseline gap-3 py-2.5 border-b border-stone-100">
                    <span className="text-stone-400">Cliente</span>
                    <b className="font-semibold text-stone-900 text-right">{ventaCompletada.cliente}</b>
                  </div>
                  {ventaCompletada.descuento > 0 && (
                    <>
                      <div className="flex justify-between items-baseline gap-3 py-2.5 border-b border-stone-100">
                        <span className="text-stone-400">Subtotal</span>
                        <b className="font-semibold text-stone-900 tabular-nums">S/ {formatoSoles(ventaCompletada.subtotal)}</b>
                      </div>
                      <div className="flex justify-between items-baseline gap-3 py-2.5 border-b border-stone-100">
                        <span className="text-stone-400">Descuento</span>
                        <b className="font-semibold text-rose-600 tabular-nums">− S/ {formatoSoles(ventaCompletada.descuento)}</b>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-baseline pt-3 pb-2">
                    <span className="text-[13px] font-semibold text-stone-400">Total</span>
                    <b className="text-[30px] font-bold tracking-tight text-stone-900 tabular-nums">
                      <small className="text-sm font-semibold text-stone-500 mr-1">S/</small>{formatoSoles(ventaCompletada.total_venta)}
                    </b>
                  </div>
                </div>
                <button onClick={() => setVentaCompletada(null)} className="w-full mt-3.5 py-3.5 bg-[#6105dc] hover:bg-[#4d04b0] active:scale-[0.98] text-white font-semibold text-[15px] rounded-full transition">
                  Nueva venta
                </button>
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-[#f4eefe] text-stone-800 font-semibold text-[12.5px] rounded-full ring-1 ring-[#6105dc]/10 hover:ring-[#d6bdfa] transition whitespace-nowrap">
                    <IconoTrazo nombre="print" className="w-[15px] h-[15px] text-[#6105dc]" /> Imprimir
                  </button>
                  <button onClick={() => enviarBoletaWhatsApp(ventaCompletada)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-[#f4eefe] text-stone-800 font-semibold text-[12.5px] rounded-full ring-1 ring-[#6105dc]/10 hover:ring-[#d6bdfa] transition whitespace-nowrap">
                    <IconoTrazo nombre="chat" className="w-[15px] h-[15px] text-[#6105dc]" /> WhatsApp
                  </button>
                </div>
                {typeof navigator !== 'undefined' && navigator.bluetooth && (
                  <button
                    onClick={() => imprimirBoletaBluetooth(ventaCompletada)}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-[#f4eefe] text-stone-800 font-semibold text-[12.5px] rounded-full ring-1 ring-[#6105dc]/10 hover:ring-[#d6bdfa] transition"
                  >
                    <IconoTrazo nombre="bluetooth" className="w-[15px] h-[15px] text-[#6105dc]" /> Ticketera Bluetooth
                  </button>
                )}
              </div>
              <ReciboImprimible
                bodega={bodegaNombre}
                boleta={ventaCompletada.nro_boleta}
                fecha={new Date().toLocaleString('es-PE')}
                cliente={ventaCompletada.cliente}
                medioPago={ventaCompletada.medio_pago}
                items={ventaCompletada.items || []}
                total={ventaCompletada.total_venta}
                subtotal={ventaCompletada.subtotal}
                descuento={ventaCompletada.descuento}
              />
            </div>
          )}

          {/* Modal: QR de Pago (Yape/Plin) */}
          {medioQR && (
            <QRPagoModal
              bodegaId={bodegaId}
              medioPago={medioQR}
              monto={totalConDescuento}
              onClose={() => setMedioQR(null)}
            />
          )}

          {/* Modal: Reimpresión de Boleta desde el Historial */}
          {reciboReimpresion && (
            <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
              <div className="bg-stone-100 border border-stone-200 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center space-y-3">
                <div className="w-12 h-12 bg-stone-200 text-stone-800 rounded-full flex items-center justify-center mx-auto text-xl"><i className="fa-solid fa-print"></i></div>
                <h3 className="text-lg font-black text-stone-900">Reimpresión de Boleta</h3>
                <p className="text-xs text-stone-700 font-mono">Boleta: <span className="text-orange-600 font-bold">{reciboReimpresion.nro_boleta}</span></p>
                {reciboReimpresion.anulada && (
                  <p className="text-xs font-bold text-rose-600"><i className="fa-solid fa-triangle-exclamation mr-1"></i> Esta venta está ANULADA</p>
                )}
                <div className="bg-stone-50 p-3 rounded-lg text-left text-xs font-mono space-y-1 text-stone-700 border border-stone-100 max-h-56 overflow-y-auto">
                  <p><strong>Pago:</strong> {reciboReimpresion.medio_pago}</p>
                  <p><strong>Cliente:</strong> {reciboReimpresion.clientes?.nombre_completo || 'Cliente'}</p>
                  {(reciboReimpresion.ventas_detalle || []).length > 0 ? (
                    <div className="border-t border-stone-200 pt-1 mt-1 space-y-0.5">
                      {reciboReimpresion.ventas_detalle.map((d, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{d.productos?.descripcion || 'Producto'} x{d.cantidad}</span>
                          <span>S/ {Number(d.subtotal).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-stone-500 border-t border-stone-200 pt-1 mt-1">Sin detalle de productos disponible.</p>
                  )}
                  <div className="border-t border-stone-200 pt-1 mt-1 flex justify-between font-bold text-sm text-orange-600">
                    <span>TOTAL:</span><span>S/ {Number(reciboReimpresion.total_venta).toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.print()} className="flex-1 py-2 bg-stone-200 text-stone-900 font-bold text-xs rounded-xl"><i className="fa-solid fa-print mr-1"></i> Imprimir</button>
                  <button onClick={() => setReciboReimpresion(null)} className="flex-1 py-2 bg-stone-900 text-white font-bold text-xs rounded-xl shadow">Cerrar</button>
                </div>
              </div>
              <ReciboImprimible
                bodega={bodegaNombre}
                boleta={reciboReimpresion.nro_boleta}
                fecha={new Date(reciboReimpresion.fecha_hora).toLocaleString('es-PE')}
                cliente={reciboReimpresion.clientes?.nombre_completo || 'Cliente'}
                medioPago={reciboReimpresion.medio_pago}
                items={(reciboReimpresion.ventas_detalle || []).map(d => ({
                  descripcion: d.productos?.descripcion || d.descripcion || 'Producto',
                  cantidad: d.cantidad,
                  precioUnitario: d.precio_unitario,
                  unidad: d.productos?.unidad || 'UND',
                  subtotal: d.subtotal
                }))}
                total={reciboReimpresion.total_venta}
                subtotal={Number(reciboReimpresion.total_venta) + Number(reciboReimpresion.descuento_monto || 0)}
                descuento={reciboReimpresion.descuento_monto || 0}
                anulada={reciboReimpresion.anulada}
              />
            </div>
          )}

          {/* Modal genérico: reemplazo de prompt() nativo */}
          {modalPrompt && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3">
                <h3 className="text-lg font-bold text-stone-900">{modalPrompt.titulo}</h3>
                {modalPrompt.mensaje && <p className="text-xs text-stone-600">{modalPrompt.mensaje}</p>}
                <input
                  type="text"
                  autoFocus
                  value={modalPromptValor}
                  onChange={(e) => setModalPromptValor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { modalPrompt.onConfirmar(modalPromptValor); setModalPrompt(null); }
                  }}
                  placeholder={modalPrompt.placeholder}
                  className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d6bdfa]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { modalPrompt.onCancelar(); setModalPrompt(null); }}
                    className="flex-1 py-2.5 bg-white/70 hover:bg-[#ece0fd] text-stone-600 font-semibold text-xs rounded-full shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { modalPrompt.onConfirmar(modalPromptValor); setModalPrompt(null); }}
                    className="flex-1 py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] text-white font-bold text-xs rounded-full shadow"
                  >
                    {modalPrompt.textoBoton}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal genérico: reemplazo de confirm() nativo */}
          {modalConfirmar && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3">
                <h3 className="text-lg font-bold text-stone-900">{modalConfirmar.titulo}</h3>
                <p className="text-xs text-stone-600">{modalConfirmar.mensaje}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { modalConfirmar.onCancelar(); setModalConfirmar(null); }}
                    className="flex-1 py-2.5 bg-white/70 hover:bg-[#ece0fd] text-stone-600 font-semibold text-xs rounded-full shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { modalConfirmar.onConfirmar(); setModalConfirmar(null); }}
                    className={`flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow ${modalConfirmar.peligroso ? 'bg-rose-600 hover:bg-rose-500' : 'bg-stone-900 hover:bg-stone-800'}`}
                  >
                    {modalConfirmar.textoBoton}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<PosApp />);
  