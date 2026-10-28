import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './index.css';
import {
  cargarScriptExterno, asegurarXLSX, generarSKU, fechaISOLocal, fechaHoyISO,
  comprimirImagenJPEG, formatearBytes, PIN_MIN, PIN_MAX, PIN_MIN_DUENO, pinValido,
  CATEGORIA_ESTILO, CATEGORIAS_FALLBACK, normalizarCategoria,
  CATEGORIA_ESTILO_POR_NOMBRE_NORMALIZADO, CATEGORIA_ALIAS,
  estiloCategoria, categoriaDesdeTexto, FotoProducto, MiniInterruptor,
} from './PanelAdminCompartido.jsx';
import { esDniValido, esDocumentoValido, esRucValido, esMontoNoNegativo } from './lib/validaciones.js';
import { efectivoEntrante, desgloseMediosPago, diferenciaArqueo, totalConteo, DENOMINACIONES } from './lib/arqueo.js';
import { calcularDescuento } from './lib/descuentos.js';
import { resumirVentasPeriodo, agruparVentasPorDia, calcularCambioPct } from './lib/dashboard.js';
import { valorAuditoria, describirAuditoria } from './lib/auditoria.js';
import { antiguedadTurno } from './lib/turnos.js';
import { iniciarMonitoreo, reportarError, reportarFallo } from './monitoreo.js';
import { evitarZoomEnCampos } from './lib/movil.js';
import { claveAuthSupabase, puedeUsarSesionGuardada, debeReintentar, PAUSAS_REINTENTO_SESION } from './lib/sesion.js';
import { estadoDeudor, coberturaPago, restoPrimeraBoleta } from './lib/deudas.js';
import { precioNormalCombo as sumaPreciosCombo, costoNormalCombo as sumaCostosCombo, margenCombo, expandirLineaCombo, detalleComboTicket } from './lib/combos.js';


    const generarUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
    const asegurarJsPDF = () => cargarScriptExterno('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk');
    const asegurarConfetti = () => cargarScriptExterno('https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js', 'sha384-HAH79XdRvHr6axVGh4xQWVCp14kcd32bNk4Xu0sHDHtFQ42n6BAM8ykvB47dGz6D');
    const asegurarZXing = () => cargarScriptExterno('https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/iife/reader/index.min.js', 'sha384-O/6uuumgOqcsO9GVD2Hjpf/o2fd6DPoIP81jBYJkCaRTdS/dFV6i9kW3tQ2PP0FZ');

    // La tabla productos exige cod_ean (no admite vacío), aunque hay artículos
    // reales sin código de barras (a granel, hechos en casa, etc.). Cuando el
    // cajero lo deja en blanco se genera un código interno único para que el
    // producto igual se pueda registrar.
    let contadorCodigoInterno = 0;
    const generarCodigoInterno = () => {
      contadorCodigoInterno += 1;
      return `INT-${Date.now()}-${contadorCodigoInterno}`;
    };


    // Convierte los campos de pack de un formulario (vendeEnPack,
    // unidades_por_pack, precio_venta_pack, cod_ean_pack -- como strings,
    // que es como los guardan los inputs) a los valores que espera la
    // columna de `productos`. Centralizado porque esta misma normalización
    // se repetía en cada lugar que crea o actualiza un producto -- si
    // alguna vez cambian las reglas (ej. permitir unidades_por_pack === 1),
    // solo hay que tocarlo acá.

    // Zona horaria del celular: el dia y la hora de las ventas se agrupan en la
    // base con esta zona para que coincidan con lo que ve el usuario.
    const zonaLocal = () => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima'; } catch (e) { return 'America/Lima'; }
    };

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


    // ID fijo usado únicamente por "Modo Demo Local" (no corresponde a ninguna
    // bodega real). Solo en ese caso se muestra el catálogo de ejemplo; una
    // bodega real sin productos debe ver un catálogo vacío de verdad.
    const BODEGA_DEMO_ID = 'a0000000-0000-0000-0000-000000000001';

    // Base de la vitrina pública de KaseritaDelivery (repo y deploy
    // separados de este). El link final de cada bodega es esta URL + su
    // slug, ej. KASERITA_DELIVERY_URL + '/san-luis'.
    const KASERITA_DELIVERY_URL = 'https://delivery.smartdeskapps.com';

    // El login sigue pidiendo DNI + PIN como siempre, pero por debajo se usa
    // Supabase Auth real (necesario para que RLS pueda proteger los datos de
    // cada bodega). Se deriva un correo y contraseña sintéticos a partir del
    // DNI/PIN para no tener que pedirle un email al usuario.
    const emailAuthDesdeDni = (dni) => `bodega_${(dni || '').trim()}@kaserita.app`;
    const passwordAuthDesdePin = (pin) => `kst-${(pin || '').trim()}`;


    // Aviso sonoro cuando llega un pedido nuevo de KaseritaDelivery. Se crea
    // una sola vez (no un Audio nuevo por pedido) para no repetir la descarga
    // cada vez -- currentTime se resetea para que suene entero aunque llegue
    // otro pedido mientras el anterior todavía está sonando. Los navegadores
    // no dejan reproducir sonido antes de que haya habido algún clic/
    // interacción en la página; por eso puede no sonar el primer pedido si
    // se acaba de abrir la pestaña.
    // Se crea recién al primer aviso: así no se descarga el mp3 en cada arranque.
    let audioAvisoPedidoNuevo = null;
    const sonarAvisoPedidoNuevo = () => {
      try {
        if (!audioAvisoPedidoNuevo) audioAvisoPedidoNuevo = new Audio('https://cdn.pixabay.com/audio/2025/01/11/audio_5e34842448.mp3');
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

    // Selector de pestañas en pastilla para las ventanas que agrupan dos vistas
    // (Toma/Historial de inventario, Ventas/Cierres). La pestaña activa no lleva
    // onClick; la otra abre la ventana hermana.
    function PestanasModal({ pestanas }) {
      return (
        <div className="flex gap-0.5 p-1 rounded-full bg-[#6105dc]/[0.08] shrink-0">
          {pestanas.map((t) => (
            <button
              key={t.texto}
              type="button"
              onClick={t.onClick}
              className={`flex-1 h-9 rounded-full text-[13px] font-semibold transition ${
                t.activa ? 'bg-white text-[#4d04b0] shadow-[0_1px_3px_rgba(40,20,80,0.15)]' : 'text-[#6a6386] hover:text-[#4d04b0]'
              }`}
            >
              {t.texto}
            </button>
          ))}
        </div>
      );
    }

    // Teclado numérico en pantalla, reutilizable para efectivo y pagos mixtos.
    function NumericKeypad({ value, onChange }) {
      const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'BORRAR'];
      const presionar = (t) => {
        if (t === 'BORRAR') { onChange(value.slice(0, -1)); return; }
        if (t === '.' && value.includes('.')) return;
        onChange(value + t);
      };
      return (
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {teclas.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => presionar(t)}
              className="h-11 bg-white hover:bg-[#faf8fe] ring-1 ring-[#6105dc]/10 rounded-[14px] text-lg font-semibold text-stone-800 flex items-center justify-center active:scale-95 transition"
            >
              {t === 'BORRAR' ? <IconoTrazo nombre="borrar" className="w-[22px] h-[22px] text-[#6105dc]" /> : t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange('')}
            className="col-span-3 h-9 bg-rose-50 hover:bg-rose-100 rounded-full text-xs font-semibold text-rose-700 transition"
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

    // "25 oct 2026 · 11:22" -- fecha y hora de la boleta (para la pantalla de venta
    // exitosa, la boleta impresa y la ticketera).
    function formatoFechaHoraBoleta(iso) {
      const d = iso ? new Date(iso) : new Date();
      const fecha = d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
      const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${fecha} · ${hora}`;
    }

    // Confeti que salta del visto al emitir la boleta: [color, x, y, tamaño].
    const CONFETI_BOLETA = [
      ['#ffc81a', -46, -30, 8], ['#8a3df2', 46, -34, 7], ['#ff7aa2', -58, 6, 6],
      ['#34d399', 56, 10, 7], ['#6105dc', -30, -52, 6], ['#f59e0b', 30, -54, 6],
    ];
    const ICONO_MEDIO_PAGO = { EFECTIVO: 'efectivo', YAPE: 'movil', PLIN: 'movil', TARJETA: 'tarjeta', CREDITO: 'credito', MIXTO: 'mixto' };

    // Línea de corte del ticket impreso: punteada, con las dos muescas redondas de
    // los lados (hechas con bordes, que sí salen en cualquier ticketera).
    function CorteTicket() {
      const muesca = { position: 'absolute', top: -7, width: 7, height: 14, border: '2px solid #000', background: '#fff' };
      return (
        <div style={{ position: 'relative', margin: '10px 0', borderTop: '2px dashed #000' }}>
          <span style={{ ...muesca, left: -6, borderLeft: 'none', borderRadius: '0 14px 14px 0' }}></span>
          <span style={{ ...muesca, right: -6, borderRight: 'none', borderRadius: '14px 0 0 14px' }}></span>
        </div>
      );
    }

    // Imprime la boleta en una ventana propia y del tamaño justo: 80 mm de ancho y el
    // largo exacto de la boleta. Así la ticketera no gasta papel de más (antes salía
    // una hoja larga con la boleta chica arriba) ni achica el texto para que quepa.
    function imprimirBoletaTermica() {
      const origen = document.getElementById('recibo-imprimible');
      if (!origen) { window.print(); return; }
      const marco = document.createElement('iframe');
      marco.setAttribute('aria-hidden', 'true');
      marco.style.cssText = 'position:fixed;left:-9999px;top:0;width:80mm;height:10px;border:0;opacity:0;pointer-events:none;';
      document.body.appendChild(marco);
      const doc = marco.contentDocument;
      doc.open();
      doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Boleta</title><style>'
        + '*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}'
        + 'body{width:80mm;padding:2mm 4mm 8mm;font-family:"Courier New",monospace;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
        + '#recibo-imprimible{width:100%;font-weight:700;text-align:center}'
        + '</style></head><body></body></html>');
      doc.close();
      const copia = doc.importNode(origen, true);
      copia.removeAttribute('class');
      copia.removeAttribute('style');
      copia.style.cssText = 'font-weight:700;text-align:center;width:100%';
      doc.body.appendChild(copia);
      const altoMm = Math.ceil((doc.documentElement.scrollHeight * 25.4) / 96) + 2;
      const estilo = doc.createElement('style');
      estilo.textContent = `@page{size:80mm ${altoMm}mm;margin:0}`;
      doc.head.appendChild(estilo);
      const quitar = () => { try { marco.remove(); } catch (e) { /* ya no está */ } };
      marco.contentWindow.onafterprint = quitar;
      marco.contentWindow.focus();
      marco.contentWindow.print();
      setTimeout(quitar, 60000);
    }

    // Mensajes de error para la persona: si el sistema devolvió un texto claro en español
    // se muestra; si es un texto técnico (en inglés o de la base de datos) se cambia por
    // un aviso corto, y el detalle queda solo en la consola.
    const TEXTO_TECNICO = /(violates|constraint|duplicate key|jwt|relation |column |function |permission denied|row-level|null value|syntax|fetch|network|timeout|failed|exception|undefined|\bpg|pgrst|supabase|postgres|schema|cannot|could not|invalid|already exists|\bnull\b)/i;
    function mensajeError(err, base) {
      const generico = 'No se pudo completar la acción';
      const limpio = String(base || generico).replace(/[\s.:]+$/, '');
      const m = String(err && err.message ? err.message : '').trim();
      const claro = m.length > 8 && /^[¡¿A-ZÁÉÍÓÚ]/.test(m) && /[áéíóúñ¿¡]|\b(no|el|la|los|las|tu|tus|ya|de|que|para|se|elige|ingresa)\b/i.test(m) && !TEXTO_TECNICO.test(m);
      if (claro) return limpio === generico ? m : `${limpio}: ${m}`;
      if (err) { console.warn(limpio, err); reportarFallo(limpio, err); }
      return `${limpio}. Revisa tu conexión e inténtalo de nuevo.`;
    }

    // Boleta impresa (térmica 58/80 mm): en blanco y negro, con el mismo orden de la
    // pantalla de venta exitosa. Las líneas que no tienen dato (dirección, teléfono,
    // cajero, recibido/vuelto) simplemente no se imprimen.
    function ReciboImprimible({ bodega, direccion, telefono, boleta, fecha, cliente, cajero, medioPago, recibido, items, total, anulada, subtotal, descuento }) {
      const etiqueta = { fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' };
      const fila = { display: 'flex', justifyContent: 'space-between', gap: 6 };
      const tabla = { display: 'grid', gridTemplateColumns: '26px 1fr 62px', gap: 4 };
      const medio = String(medioPago || '');
      const medioLindo = medio.charAt(0).toUpperCase() + medio.slice(1).toLowerCase();
      const unidades = items.reduce((a, it) => a + (Number(it.cantidad) || 0), 0);
      const vuelto = Number(recibido) >= Number(total) ? Number(recibido) - Number(total) : 0;
      return (
        <div id="recibo-imprimible" className="sr-only" style={{ fontWeight: 700, textAlign: 'center' }}>
          <div style={{ border: '2px solid #000', borderRadius: 4, padding: '5px 8px', margin: '0 auto 4px', display: 'inline-block' }}>
            <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 0.3 }}>{bodega}</div>
          </div>
          {(direccion || telefono) && (
            <div style={{ fontSize: 11, lineHeight: 1.3 }}>
              {direccion && <div>{direccion}</div>}
              {telefono && <div>Tel. {telefono}</div>}
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 900, marginTop: 6 }}>¡Gracias por su compra!</div>
          <div style={{ fontSize: 11 }}>Tu boleta se emitió correctamente</div>
          {anulada && <div style={{ fontWeight: 900, fontSize: 14, marginTop: 3 }}>*** ANULADA ***</div>}

          <CorteTicket />
          <div style={{ ...fila, textAlign: 'left' }}>
            <div>
              <div style={etiqueta}>Boleta</div>
              <div style={{ fontSize: 15 }}>{boleta}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={etiqueta}>Fecha y hora</div>
              <div style={{ fontSize: 12 }}>{fecha}</div>
            </div>
          </div>
          <div style={{ textAlign: 'left', fontSize: 11, marginTop: 6 }}>
            <div>Cliente: {cliente}</div>
            {cajero && <div>Atendido por: {cajero}</div>}
          </div>

          <CorteTicket />
          <div style={{ textAlign: 'left', fontSize: 12 }}>
            <div style={{ ...tabla, ...etiqueta, borderBottom: '2px solid #000', paddingBottom: 3, marginBottom: 4 }}>
              <span>Cant</span><span>Producto</span><span style={{ textAlign: 'right' }}>Importe</span>
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ ...tabla, marginBottom: 5 }}>
                <span>{it.cantidad}</span>
                <span>
                  {it.descripcion}
                  <span style={{ display: 'block', fontSize: 10 }}>{Number(it.precioUnitario || 0).toFixed(2)} c/u{it.unidad && it.unidad !== 'UND' ? ` (${it.unidad})` : ''}</span>
                  {detalleComboTicket(it).map((l, k) => (
                    <span key={k} style={{ display: 'block', fontSize: 10, paddingLeft: 2 }}>· {l}</span>
                  ))}
                </span>
                <span style={{ textAlign: 'right' }}>{Number(it.subtotal).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '2px dashed #000', margin: '6px 0' }}></div>
          <div style={{ ...etiqueta, textAlign: 'left' }}>{unidades} {unidades === 1 ? 'artículo' : 'artículos'}</div>
          {descuento > 0 && (
            <>
              <div style={{ ...fila, fontSize: 12 }}>
                <span>Subtotal</span><span>S/ {Number(subtotal).toFixed(2)}</span>
              </div>
              <div style={{ ...fila, fontSize: 12 }}>
                <span>Descuento</span><span>- S/ {Number(descuento).toFixed(2)}</span>
              </div>
            </>
          )}
          <div style={{ ...fila, alignItems: 'baseline', marginTop: 4, textAlign: 'left' }}>
            <span style={etiqueta}>Monto</span>
            <span style={{ fontSize: 24, fontWeight: 900 }}>S/ {Number(total).toFixed(2)}</span>
          </div>
          <div style={{ border: '2px solid #000', borderRadius: 8, padding: '4px 8px', marginTop: 6, textAlign: 'left', fontSize: 12 }}>
            <div style={fila}><span>Pago</span><span>{medioLindo}</span></div>
            {Number(recibido) > 0 && (
              <>
                <div style={fila}><span>Recibido</span><span>S/ {Number(recibido).toFixed(2)}</span></div>
                <div style={fila}><span>Vuelto</span><span>S/ {vuelto.toFixed(2)}</span></div>
              </>
            )}
          </div>

          <CorteTicket />
          <div style={{ fontSize: 10, lineHeight: 1.3 }}>
            Documento sin valor tributario.
            <br />No válido como comprobante de pago ante SUNAT. Solo informativo.
          </div>
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
        { label: 'Yape', valor: desglose.YAPE, color: '#7c3aed' },
        { label: 'Plin', valor: desglose.PLIN, color: '#06b6d4' },
        { label: 'Tarjeta', valor: desglose.TARJETA, color: '#f59e0b' },
        { label: 'Crédito', valor: desglose.CREDITO, color: '#64748b' },
        { label: 'Tarjeta/Otro (de ventas Mixtas)', valor: desglose.MIXTO_OTRO, color: '#94a3b8' }
      ].filter((f) => f.valor > 0);
      if (filas.length === 0) return null;
      return (
        <div className="mt-3.5 bg-[#fcfaff] border border-stone-100 rounded-[18px] px-3.5 py-1 text-left text-xs text-stone-600">
          <p className="font-semibold text-stone-500 py-2 leading-snug">Otros medios de pago: no es efectivo. Cruza estos montos con tu app de Yape o tu POS de tarjeta.</p>
          {filas.map((f) => (
            <div key={f.label} className="flex justify-between items-center py-1.5 border-t border-dashed border-[#e4d6fb]">
              <span className="flex items-center"><i className="w-[9px] h-[9px] rounded-[3px] inline-block mr-2" style={{ background: f.color }}></i>{f.label}</span>
              <b className="text-stone-800">S/ {f.valor.toFixed(2)}</b>
            </div>
          ))}
        </div>
      );
    }

    // Fecha corta para mostrar cuándo pasó algo: "hoy 08:02", "ayer 21:30" o "17/10 18:40".
    const etiquetaCuandoTurno = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      const hoy = new Date();
      const ayer = new Date();
      ayer.setDate(hoy.getDate() - 1);
      const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      if (d.toDateString() === hoy.toDateString()) return `hoy ${hora}`;
      if (d.toDateString() === ayer.toDateString()) return `ayer ${hora}`;
      return `${d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })} ${hora}`;
    };

    // Calculadora de billetes y monedas para abrir/cerrar caja: solo ayuda a
    // sumar -- lo que se guarda sigue siendo el total que queda en el campo
    // de monto. Es un componente aparte (no dentro de PosApp) para que no se
    // vuelva a crear en cada render y los campos no pierdan el foco.
    const COLOR_BILLETE = { 200: '#b45309', 100: '#2563eb', 50: '#a21caf', 20: '#d97706', 10: '#059669' };
    function ContadorEfectivo({ conteo, onChange }) {
      const cambiar = (d, n) => onChange({ ...conteo, [d]: Math.max(0, Math.floor(n) || 0) });
      const fila = (d) => {
        const n = Math.max(0, Math.floor(Number(conteo[d])) || 0);
        const esBillete = d >= 10;
        return (
          <div key={d} className="flex items-center gap-2.5 py-[7px] border-b border-dashed border-[#e4d6fb] last:border-b-0">
            <span className="flex items-center gap-2 text-[13px] font-bold min-w-[88px]">
              {esBillete
                ? <span className="w-[34px] h-5 rounded-[5px] grid place-items-center text-[9px] font-extrabold text-white shrink-0" style={{ background: COLOR_BILLETE[d] }}>S/</span>
                : <span className="w-[22px] h-[22px] mx-1.5 rounded-full grid place-items-center text-[9px] font-extrabold bg-[#e4d6fb] text-[#4d04b0] shrink-0">¢</span>}
              {d >= 1 ? `S/ ${d}` : d.toFixed(2)}
            </span>
            <span className="ml-auto flex items-center bg-[#f1eef9] rounded-[11px]">
              <button type="button" aria-label={`Menos ${d}`} onClick={() => cambiar(d, n - 1)} className="w-[30px] h-[30px] rounded-[11px] text-[#4d04b0] hover:bg-[#e6def7] grid place-items-center"><i className="fa-solid fa-minus text-[11px]"></i></button>
              <input type="number" min="0" inputMode="numeric" value={n || ''} placeholder="0" aria-label={`Cantidad de ${d}`} onChange={(e) => cambiar(d, Number(e.target.value))} className="w-[38px] h-[30px] bg-transparent border-0 text-center font-extrabold text-sm outline-none p-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <button type="button" aria-label={`Más ${d}`} onClick={() => cambiar(d, n + 1)} className="w-[30px] h-[30px] rounded-[11px] text-[#4d04b0] hover:bg-[#e6def7] grid place-items-center"><i className="fa-solid fa-plus text-[11px]"></i></button>
            </span>
            <span className={`min-w-[70px] text-right text-[12.5px] font-bold ${n ? 'text-stone-900' : 'text-stone-400'}`}>S/ {(n * d).toFixed(2)}</span>
          </div>
        );
      };
      const etiqueta = 'text-[11px] font-bold text-stone-500 tracking-[0.06em] uppercase';
      return (
        <div className="mt-1.5 border border-stone-100 rounded-[18px] bg-[#fcfaff] px-3.5 py-1.5">
          <p className={`${etiqueta} pt-2 pb-0.5`}>Billetes</p>
          {DENOMINACIONES.filter((d) => d >= 10).map(fila)}
          <p className={`${etiqueta} pt-2.5 pb-0.5`}>Monedas</p>
          {DENOMINACIONES.filter((d) => d < 10).map(fila)}
          <div className="flex justify-between items-center pt-2.5 pb-1.5 mt-1 border-t border-[#e4d6fb] text-[12.5px] font-bold">
            <span>Total contado en caja <b className="text-base font-extrabold ml-1.5">S/ {totalConteo(conteo).toFixed(2)}</b></span>
            <button type="button" onClick={() => onChange({})} className="text-xs font-bold text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg px-1.5 py-1">Limpiar</button>
          </div>
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
      efectivo: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
      movil: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></>,
      tarjeta: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>,
      credito: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
      mixto: <><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 12 10 5 10-5M2 17l10 5 10-5" /></>,
      calc: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" /></>,
      qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v.01M14 21h.01M17 21h4v-4" /></>,
      etiqueta: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1" /></>,
      borrar: <><path d="M21 5H9l-6 7 6 7h12z" /><path d="m17 9-4 6M13 9l4 6" /></>,
      recibo: <><path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z" /><path d="M8 8h8M8 12h8" /></>,
      caja: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
      buscar: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
      abajo: <path d="m6 9 6 6 6-6" />,
      tienda: <><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>,
      ubicacion: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
      campana: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
      moto: <><circle cx="5.5" cy="17" r="3" /><circle cx="18.5" cy="17" r="3" /><path d="M8.5 17h5l-2.5-8H8" /><path d="M11 9h4l3.5 8" /></>,
      compartir: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
      copiar: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
      barras: <><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" /><path d="M8 8v8M11 8v8M14 8v5M17 8v8" /></>,
      camaraGira: <><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></>,
      camaraOff: <><path d="M23 7l-7 5 7 5z" /><rect x="1" y="5" width="15" height="14" rx="2" /><path d="M4 2l16 20" /></>,
      cambio: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
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


    // Tono del panel de la tarjeta según la categoría: las categorías las pone
    // cada negocio, así que el tono sale de un hash estable del nombre (la misma
    // categoría siempre queda del mismo color). Sin categoría: lila de marca.
    const TONOS_TARJETA = [
      { t: '#ece0fd', td: '#6a3fc4' },
      { t: '#dfeafd', td: '#3b66b8' },
      { t: '#fde8d6', td: '#c0662a' },
      { t: '#fff1c7', td: '#a97c10' },
      { t: '#dcf3e6', td: '#238458' },
      { t: '#fde3ea', td: '#c0405f' },
    ];
    function tonoCategoria(categoria) {
      if (!categoria) return TONOS_TARJETA[0];
      let h = 0;
      for (const ch of String(categoria).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      return TONOS_TARJETA[h % TONOS_TARJETA.length];
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
      const tono = tonoCategoria(prod.categoria);
      // Franja inferior del panel: un solo lugar para el aviso que importa.
      const aviso = sinStock
        ? { texto: 'Sin stock', clase: 'kc-banda-bad', icono: 'fa-triangle-exclamation' }
        : stockBajo
          ? { texto: `Quedan ${stock}`, clase: 'kc-banda-warn', icono: 'fa-triangle-exclamation' }
          : prod.es_destacado
            ? { texto: 'Destacado en Delivery', clase: '', icono: 'fa-star' }
            : null;
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect(prod)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelect(prod); }}
          className={`kc kc-pos group ${enCarrito > 0 ? 'kc-en' : ''}`}
          style={{ '--t': tono.t, '--td': tono.td }}
        >
          <div className="kc-fw">
            {/* Marco fijo: todas las fotos entran en el mismo cuadro, sin
                recortarse, sea alta como una botella o cuadrada como una bolsa. */}
            <div className="kc-panel">
              {prod.foto_url ? (
                <div className={`kc-foto ${sinStock ? 'kc-foto-sin' : ''}`}>
                  <img src={prod.foto_url} alt="" loading="lazy" />
                </div>
              ) : (
                <FotoProducto
                  fotoUrl=""
                  categoria={prod.categoria}
                  className={`w-full h-full ${sinStock ? 'opacity-40 grayscale' : ''}`}
                  iconClassName="text-4xl opacity-90"
                />
              )}
              {aviso && (
                <div className={`kc-banda ${aviso.clase}`}>
                  <i className={`fa-solid ${aviso.icono}`}></i>
                  {aviso.texto}
                </div>
              )}
              {esAdmin && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit(prod); }}
                  className="kc-edit"
                  title="Editar producto"
                >
                  <i className="fa-solid fa-pen"></i>
                </button>
              )}
            </div>
            <div className="kc-precio"><small>S/</small>{Number(prod.precio_venta).toFixed(2)}</div>
            <div className="kc-top">
              {enCarrito > 0 && (
                <span className="kc-enc"><i className="fa-solid fa-check"></i> {enCarrito}</span>
              )}
              {tieneCombo && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onVerCombo?.(prod); }}
                  className="kc-circ kc-circ-combo"
                  title="Este producto es parte de un combo -- toca para verlo"
                >
                  <i className="fa-solid fa-gift"></i>
                </button>
              )}
            </div>
          </div>

          <div className="kc-body">
            <h3>{prod.descripcion}</h3>
            <div className="kc-chips">
              <span className="kc-chip">{prod.categoria || 'General'}</span>
              {prod.unidad === 'KG' && <span className="kc-chip">Por KG</span>}
              {Number(prod.unidades_por_pack) > 1 && (
                <span className="kc-chip"><i className="fa-solid fa-boxes-packing"></i> x{prod.unidades_por_pack}</span>
              )}
              {hayStock && (
                <span className={`kc-chip kc-chip-stock ${sinStock ? 'kc-sin' : stockBajo ? 'kc-bajo' : ''}`}>
                  <i className="kc-dot"></i>
                  {sinStock ? 'Sin stock' : stockBajo ? `Quedan ${stock}` : `${stock} disp.`}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    });

    // Panel del super-administrador: crea bodegas (el único lugar donde se
    // puede crear una, ver panel_admin.sql) y controla su vigencia. No usa
    // "sesion" (esa es la de dueño/cajero de una bodega) -- entra con su
    // propia cuenta de correo+contraseña de Supabase Auth.
    const PanelAdmin = React.lazy(() => import('./PanelAdmin.jsx'));
    const DashboardVentas = React.lazy(() => import('./DashboardVentas.jsx'));
    const CierreCaja = React.lazy(() => import('./CierreCaja.jsx'));
    const InventarioInicial = React.lazy(() => import('./InventarioInicial.jsx'));
    const CombosModal = React.lazy(() => import('./CombosModal.jsx'));
    const MermaModal = React.lazy(() => import('./MermaModal.jsx'));
    const TomaInventario = React.lazy(() => import('./TomaInventario.jsx'));
    const EditarProducto = React.lazy(() => import('./EditarProducto.jsx'));
    const EntradaMercaderia = React.lazy(() => import('./EntradaMercaderia.jsx'));
    const HistorialCierres = React.lazy(() => import('./HistorialCierres.jsx'));
    const GestionClientes = React.lazy(() => import('./GestionClientes.jsx'));
    const EscanerCamara = React.lazy(() => import('./EscanerCamara.jsx'));
    const FiadosModal = React.lazy(() => import('./FiadosModal.jsx'));
    const CuentasPagar = React.lazy(() => import('./CuentasPagar.jsx'));
    const NuevoProveedor = React.lazy(() => import('./NuevoProveedor.jsx'));
    const HistorialInventario = React.lazy(() => import('./HistorialInventario.jsx'));
    const GestionCajeros = React.lazy(() => import('./GestionCajeros.jsx'));
    const ComisionesBarberos = React.lazy(() => import('./ComisionesBarberos.jsx'));
    const HorarioBarbero = React.lazy(() => import('./HorarioBarbero.jsx'));
    const AgendaCitas = React.lazy(() => import('./AgendaCitas.jsx'));
    const DeliveryModal = React.lazy(() => import('./DeliveryModal.jsx'));
    const RegistroActividad = React.lazy(() => import('./RegistroActividad.jsx'));
    const PinDueno = React.lazy(() => import('./PinDueno.jsx'));
    const PinCajero = React.lazy(() => import('./PinCajero.jsx'));
    const NuevoCliente = React.lazy(() => import('./NuevoCliente.jsx'));
    const HistorialVentas = React.lazy(() => import('./HistorialVentas.jsx'));

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

      // Errores no controlados -> tabla errores_app (se ven en el panel de superadmin).
      useEffect(() => iniciarMonitoreo(sbClient), [sbClient]);
      useEffect(() => evitarZoomEnCampos(), []);

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
        if (verificandoSesion) return;
        // Vía normal: la función de public/splash-pos.js. Respaldo: si ese archivo
        // no la trae (versión vieja o dañada en la caché del navegador), se retira
        // el splash directamente para que la app nunca quede detrás de él.
        const ocultarSplash = typeof window.ocultarSplashKaserita === 'function'
          ? window.ocultarSplashKaserita
          : () => {
              const el = document.getElementById('splash-kaserita');
              if (!el) return;
              el.classList.add('splash-oculto');
              setTimeout(() => el.remove(), 350);
            };
        const id1 = requestAnimationFrame(() => {
          const id2 = requestAnimationFrame(() => {
            ocultarSplash();
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
      const [formNuevaBodega, setFormNuevaBodega] = useState({ correo: '', nombreBodega: '', nombreDueno: '', dias: '30', telefono: '', planId: '', monto: '', medio: 'yape', mostrarCatalogoMaestro: true, permitirSubirFotos: true, rubro: 'bodega' });
      const [guardandoNuevaBodega, setGuardandoNuevaBodega] = useState(false);

      // --- Bodega & Cajeros ---
      const bodegaId = sesion?.bodega?.id || sesion?.usuario?.bodega_id;
      // "Modo Demo Local": no usa Auth real ni una bodega real en Supabase, así
      // que ningún guardado (venta, producto, turno, etc.) debe intentar
      // escribir en el servidor -- todo se simula solo en el estado local.
      const esModoDemo = bodegaId === BODEGA_DEMO_ID;

      // Con la sesión ya abierta y el navegador libre, se descargan por adelantado las
      // ventanas que más se usan, para que abran al instante en vez de esperar a la red.
      // Se omite con "ahorro de datos" activado.
      useEffect(() => {
        if (!sesion || esModoDemo) return undefined;
        if (navigator.connection && navigator.connection.saveData) return undefined;
        const precargar = () => {
          import('./FiadosModal.jsx');
          import('./HistorialVentas.jsx');
          import('./CierreCaja.jsx');
          import('./DashboardVentas.jsx');
          import('./EntradaMercaderia.jsx');
        };
        if (typeof requestIdleCallback === 'function') {
          const id = requestIdleCallback(precargar, { timeout: 8000 });
          return () => cancelIdleCallback(id);
        }
        const id = setTimeout(precargar, 4000);
        return () => clearTimeout(id);
      }, [!!sesion]);
      const bodegaNombre = sesion?.bodega?.nombre || 'Mi Bodega';
      const bodegaDireccion = sesion?.bodega?.direccion || '';
      const bodegaTelefono = sesion?.bodega?.telefono || '';
      const usuarioActivo = sesion?.usuario || null;
      // Identifica "esta es mi propia fila en cajeros": lo normal es
      // comparar por DNI, pero un dueño creado por correo (sin DNI, entra con
      // Google) no tiene ninguno -- para ese caso se lo reconoce por ser la
      // única fila con rol "dueno" de la bodega (nunca debería haber dos).
      // Sin esto, un dueño sin DNI queda sin forma de identificarse: se le
      // crea un cajero duplicado en cada carga y, peor, nunca puede elegirse
      // a sí mismo al abrir turno (le pediría un PIN que no tiene).
      const esCajeroDelUsuarioActivo = (c) =>
        usuarioActivo && (usuarioActivo.dni ? c.dni === usuarioActivo.dni : c.rol === (usuarioActivo.rol || 'dueno'));
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
      // Cuenta de barbería (bodegas.tipo_negocio, ver tipo_negocio_barberia.sql):
      // mismos módulos de caja, pero sin los de mercadería y con "Barberos" en
      // vez de "Cajeros y Empleados". Cualquier otro valor (o la columna aún
      // inexistente) se comporta como bodega, igual que antes.
      const esBarberia = sesion?.bodega?.tipo_negocio === 'barberia';

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
      // Lista de combos: filtro por estado y buscador; editor: foto del
      // formulario al abrirlo (para saber si hay cambios) y fila resaltada
      // del buscador de productos.
      const [filtroCombos, setFiltroCombos] = useState('todos');
      const [busquedaCombos, setBusquedaCombos] = useState('');
      const [formComboOriginal, setFormComboOriginal] = useState('');
      const [resaltadoProductoCombo, setResaltadoProductoCombo] = useState(0);

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
      // Caja de este mismo cajero que quedó abierta de un día anterior: se avisa
      // en vez de retomarla en silencio (el cierre sumaría las ventas de varios días).
      const [avisoTurnoViejo, setAvisoTurnoViejo] = useState(null);
      const [cierreAlRetomar, setCierreAlRetomar] = useState(false);
      const [montoApertura, setMontoApertura] = useState('100.00');
      const [modalGestionCajeros, setModalGestionCajeros] = useState(false);
      const [cajerosGestion, setCajerosGestion] = useState([]);
      // Barbería: reporte de comisiones por barbero (ver abrirComisiones).
      const [modalComisiones, setModalComisiones] = useState(false);
      const [periodoComisiones, setPeriodoComisiones] = useState('hoy');
      const [filasComisiones, setFilasComisiones] = useState([]);
      const [cargandoComisiones, setCargandoComisiones] = useState(false);
      // Barbería con agenda: horario semanal de cada barbero y citas por día.
      const [barberosConHorario, setBarberosConHorario] = useState(() => new Set());
      const [modalHorario, setModalHorario] = useState(null); // { barbero, dias: [...] }
      const [guardandoHorario, setGuardandoHorario] = useState(false);
      const [modalAgenda, setModalAgenda] = useState(false);
      const [fechaAgenda, setFechaAgenda] = useState('');
      const [citasAgenda, setCitasAgenda] = useState([]);
      const [cargandoAgenda, setCargandoAgenda] = useState(false);
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
      const [linkDeliveryCopiado, setLinkDeliveryCopiado] = useState(false);
      // Horario de atención para "Abierto ahora" / "Cerrado" en la vitrina
      // -- un objeto por día de la semana (0=domingo...6=sábado, igual que
      // Date.getDay() del lado de KaseritaDelivery). Arranca todo cerrado
      // hasta que el dueño lo configure.
      const [horarioDelivery, setHorarioDelivery] = useState(() => ({ 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }));
      const [guardandoDelivery, setGuardandoDelivery] = useState(false);
      const [seccionesDelivery, setSeccionesDelivery] = useState({}); // secciones abiertas de "Mi link de pedidos"
      // Entrega a domicilio: el local reparte con su propio repartidor.
      const [domicilioHabilitado, setDomicilioHabilitado] = useState(false);
      const [costoEnvioDelivery, setCostoEnvioDelivery] = useState('');
      const [pedidoMinimoDelivery, setPedidoMinimoDelivery] = useState('');
      const [zonaRepartoDelivery, setZonaRepartoDelivery] = useState('');
      const [whatsappRepartidor, setWhatsappRepartidor] = useState('');
      // Avisar a los clientes que siguen / visitaron la tienda (push desde Delivery).
      const [resumenAvisos, setResumenAvisos] = useState(null); // { audiencia, proximo } o null si no disponible
      const [enviandoAviso, setEnviandoAviso] = useState(false);

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
      // Calculadora de billetes y monedas (apertura y cierre de caja), y el
      // monto con el que se cerró la última caja (atajo al abrir una nueva).
      const [conteoEfectivo, setConteoEfectivo] = useState({});
      const [conteoAbierto, setConteoAbierto] = useState(false);
      const [ultimoCierre, setUltimoCierre] = useState(null);
      // Detalle de cuánto debería haber en caja, calculado al abrir el
      // modal de cierre (antes de que el cajero cuente e ingrese el monto).
      const [arqueoEsperado, setArqueoEsperado] = useState(null);
      const [modalHistorialCierres, setModalHistorialCierres] = useState(false);
      const [cierresCaja, setCierresCaja] = useState([]);
      const [cargandoCierres, setCargandoCierres] = useState(false);
      const [fechaInicioCierres, setFechaInicioCierres] = useState('');
      const [atajoCierres, setAtajoCierres] = useState('30dias'); // hoy | 7dias | 30dias | fechas
      const [soloConDiferenciaCierres, setSoloConDiferenciaCierres] = useState(false);
      const [cierreDetalle, setCierreDetalle] = useState(null); // turno cuyo detalle se ve
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
      const [hojaPagoDeudor, setHojaPagoDeudor] = useState(false); // hoja "Registrar pago" del celular
      const [confirmandoPagoDeudor, setConfirmandoPagoDeudor] = useState(false); // paso "¿Confirmas el pago?" antes de cobrar
      const [mostrarHistorialCompletoDeuda, setMostrarHistorialCompletoDeuda] = useState(false);
      // Lista de deudores: buscador, filtro ('todos' | 'venc' | 'lim'), orden
      // ('deuda' | 'antigua'), boletas a crédito de todos los deudores (para
      // saber quién tiene deuda vencida; null si no se pudieron cargar
      // completas), pagos recientes del cliente elegido y la pantalla
      // "Pago registrado".
      const [busquedaDeudores, setBusquedaDeudores] = useState('');
      const [filtroDeudores, setFiltroDeudores] = useState('todos');
      const [ordenDeudores, setOrdenDeudores] = useState('deuda');
      const [boletasDeudores, setBoletasDeudores] = useState(null);
      const [cargandoDeudores, setCargandoDeudores] = useState(false);
      const [pagosRecientes, setPagosRecientes] = useState([]);
      const [pagoRegistrado, setPagoRegistrado] = useState(null);

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
      const [filtroClientes, setFiltroClientes] = useState('todos'); // 'todos' | 'deuda' | 'aldia'
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
      // Copia del formulario al abrir: sirve para mostrar "cambios sin guardar" y deshacerlos.
      const [formEditarOriginal, setFormEditarOriginal] = useState(null);
      const [tabEditarProducto, setTabEditarProducto] = useState('general');
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
          notificar(mensajeError(err, 'No se pudo subir la foto'), 'error');
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
          notificar(mensajeError(err, 'No se pudo subir la foto'), 'error');
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
      const [formMerma, setFormMerma] = useState({ productoId: '', cantidad: '', motivo: 'Vencido', motivoOtro: '' });
      const [busquedaMerma, setBusquedaMerma] = useState('');
      const [guardandoMerma, setGuardandoMerma] = useState(false);


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
      // Paso del stepper de "Registrar Productos" (1 producto, 2 precio, 3 revisar).
      const [pasoInventario, setPasoInventario] = useState(1);

      // --- Catálogo maestro de Kaserita (descripción + categoría + foto): "Registrar
      // Productos" lo usa para sugerir categoría y foto mientras se escribe. ---
      const [catalogoMaestroDisponible, setCatalogoMaestroDisponible] = useState([]);
      const [cargandoMaestroImport, setCargandoMaestroImport] = useState(false);

      // --- Módulo: Entrada de Mercadería (Compras) ---
      const [modalEntradaMercaderia, setModalEntradaMercaderia] = useState(false);
      const [compraCabecera, setCompraCabecera] = useState({ proveedor: '', ruc: '', nroComprobante: '' });
      const [compraItems, setCompraItems] = useState([]);
      const [compraItemTemp, setCompraItemTemp] = useState({ productoId: '', cantidad: '', costoUnitario: '', tipo: 'UNIDAD' });
      // Ficha rápida para crear un producto sin salir de "Entrada de
      // Mercadería" -- null cuando el mini-formulario está cerrado.
      const [nuevoProductoInlineCompra, setNuevoProductoInlineCompra] = useState(null);
      const [guardandoProductoInlineCompra, setGuardandoProductoInlineCompra] = useState(false);
      // Buscador de la entrada: texto, filtro ('todos' | 'bajo'), fila resaltada
      // con el teclado, productos creados en esta misma entrada (su costo no
      // se compara con uno anterior) y la pantalla final tras confirmar.
      const [busquedaCompra, setBusquedaCompra] = useState('');
      const [filtroCompra, setFiltroCompra] = useState('todos');
      const [resaltadoCompra, setResaltadoCompra] = useState(0);
      const [idsNuevosCompra, setIdsNuevosCompra] = useState([]);
      const [guardandoEntrada, setGuardandoEntrada] = useState(false);
      const [entradaRegistrada, setEntradaRegistrada] = useState(null);

      // --- Módulo: Historial de Ventas (por rango de fechas) ---
      const [modalHistorial, setModalHistorial] = useState(false);
      const [ventasDelDia, setVentasDelDia] = useState([]);
      const [cargandoHistorial, setCargandoHistorial] = useState(false);
      const [fechaInicioHistorial, setFechaInicioHistorial] = useState(fechaHoyISO());
      const [fechaFinHistorial, setFechaFinHistorial] = useState(fechaHoyISO());
      const [busquedaBoletaHistorial, setBusquedaBoletaHistorial] = useState('');
      const [atajoHistorial, setAtajoHistorial] = useState('hoy'); // hoy | ayer | 7dias | mes | fechas
      const [ventaDetalleHistorial, setVentaDetalleHistorial] = useState(null); // venta cuyo detalle se ve
      const [menuVentaHistorial, setMenuVentaHistorial] = useState(null); // venta con el menu de tres puntos abierto
      const [limiteHistorial, setLimiteHistorial] = useState(40); // cuantas ventas se muestran antes de "Ver mas"

      // --- Módulo: Dashboard de Ventas (solo Administrador) ---
      const [modalDashboard, setModalDashboard] = useState(false);
      // Intento de cobro en curso: { huella, idLocal } -- ver el cobro en línea.
      const intentoVentaRef = useRef(null);
      // Resumen del rango elegido (venta total, hora pico, medios de pago,
      // top productos, periodo anterior): viene sumado desde la base
      // (dashboard_resumen_periodo.sql) para no chocar con el tope de 1.000 filas.
      const [resumenPeriodo, setResumenPeriodo] = useState(null);
      const [combosVendidos, setCombosVendidos] = useState([]);
      // Dias del anio del rango cuando no es el anio en curso (calendario).
      const [diasAnioRango, setDiasAnioRango] = useState([]);
      const [cargandoDashboard, setCargandoDashboard] = useState(false);
      const [fechaInicioDash, setFechaInicioDash] = useState(fechaHoyISO());
      const [fechaFinDash, setFechaFinDash] = useState(fechaHoyISO());
      const [clientesDeuda, setClientesDeuda] = useState([]);
      const [proveedoresDeudaDash, setProveedoresDeudaDash] = useState([]);
      // Ventas del año calendario en curso agrupadas por día (calendario y
      // "Ventas por Mes") -- no dependen del rango de fechas del filtro rápido.
      // Vienen sumadas desde la base (dashboard_ventas_por_dia.sql) para no
      // chocar con el tope de 1.000 filas por consulta.
      const [diasAnioDash, setDiasAnioDash] = useState([]);
      // Tooltips de los gráficos del dashboard -- índice del punto/hora/mes bajo
      // el mouse (o foco de teclado), null cuando no hay nada resaltado.
      const [horaResaltada, setHoraResaltada] = useState(null);
      // Mes que muestra el calendario de "Ventas por día" ({ anio, mes }); null =
      // el mes de la fecha "Hasta" del filtro.
      const [mesCalendario, setMesCalendario] = useState(null);
      // Día del calendario abierto en la hoja de detalle (fecha ISO) y su pestaña.
      const [diaCalendarioSel, setDiaCalendarioSel] = useState(null);
      const [pestanaDiaCal, setPestanaDiaCal] = useState('pagos');
      useEffect(() => { if (!modalDashboard) setDiaCalendarioSel(null); }, [modalDashboard]);
      const [mesResaltado, setMesResaltado] = useState(null);

      // --- Cobro / Pagos ---
      // Los métodos de pago y el descuento se mantienen ocultos hasta tocar
      // "Cobrar" -- así el carrito queda limpio y solo se ve lo esencial.
      const [mostrarPago, setMostrarPago] = useState(false);
      const [medioPago, setMedioPago] = useState('EFECTIVO');
      // Celular: al pasar al cobro en efectivo, la hoja baja sola hasta "Paga con"
      // y sus atajos (antes quedaban tapados por el total y había que desplazar).
      useEffect(() => {
        if (!mostrarPago || medioPago !== 'EFECTIVO' || window.innerWidth >= 768) return undefined;
        const espera = setTimeout(() => {
          document.querySelector('[data-campo-pago]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 120);
        return () => clearTimeout(espera);
      }, [mostrarPago, medioPago]);
      // Barbería: quién atendió la venta que se está armando (cajeros.id).
      const [barberoVentaId, setBarberoVentaId] = useState(null);
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
          notificar(mensajeError(err, 'No se pudo cambiar el PIN'), 'error');
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

      // Escape cierra la ventana (modal) que esté arriba de todo. Casi todas
      // se cierran al tocar el fondo oscuro, así que se hace exactamente eso:
      // se busca la capa de fondo más alta y se le hace clic. Las que no se
      // cierran con el fondo (p. ej. las que piden un PIN) tampoco se cierran
      // con Escape salvo que tengan botón de cerrar. Va en fase de captura para correr antes que el menú de
      // búsqueda, que maneja su propio Escape.
      useEffect(() => {
        const alPresionar = (e) => {
          if (e.key !== 'Escape' || e.defaultPrevented) return;
          const capas = [...document.querySelectorAll('div.fixed.inset-0')]
            .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
          if (capas.length === 0) return;
          const zDe = (el) => parseInt(getComputedStyle(el).zIndex, 10) || 0;
          const arriba = capas.reduce((mejor, el) => (zDe(el) >= zDe(mejor) ? el : mejor), capas[0]);
          // La pantalla de carga inicial no es una ventana: no se toca.
          if (arriba.querySelector('img[alt="Kaserita"]') && !arriba.querySelector('button')) return;
          arriba.click();
          // Si no se cerró con el fondo (hay ventanas que solo se cierran con su
          // botón de cerrar), se pulsa ese botón.
          setTimeout(() => {
            if (!document.body.contains(arriba)) return;
            const cerrar = arriba.querySelector('button[aria-label="Cerrar"]') || arriba.querySelector('button:has(i.fa-xmark)');
            if (cerrar) cerrar.click();
          }, 60);
        };
        window.addEventListener('keydown', alPresionar, true);
        return () => window.removeEventListener('keydown', alPresionar, true);
      }, []);

      const [mostrarResumenMobile, setMostrarResumenMobile] = useState(false);
      const inputBusquedaRef = useRef(null);

      // --- Lector de Código de Barras por Cámara ---
      // (modalEscaner se declaró más arriba, ver comentario junto a su declaración)
      const [errorEscaner, setErrorEscaner] = useState('');
      // 'venta': agrega el producto encontrado al carrito (uso normal en caja).
      // 'inventario': rellena el campo EAN de una fila del formulario de inventario.
      const [modoEscaner, setModoEscaner] = useState('venta');
      const [destelloEscaner, setDestelloEscaner] = useState(false);
      // Claves (las mismas del carrito) de lo escaneado en esta sesión del lector,
      // el último primero. Los datos y cantidades salen del carrito, así los
      // botones − y + del lector siempre coinciden con la venta.
      const [listaEscaneada, setListaEscaneada] = useState([]);
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

      const notificar = useCallback((texto, tipo = 'info') => {
        setToast({ visible: true, texto, tipo });
        setTimeout(() => setToast({ visible: false, texto: '', tipo: 'info' }), 2200);
      }, []);

      const guardarSesion = (datos) => {
        setSesion(datos);
      };

      // Aviso de versión nueva: el POS se queda abierto horas (o días) sin
      // recargar. Se compara el archivo pos-xxxx.js de esta pestaña con el que
      // publica /pos ahora; si cambió, se ofrece actualizar (nunca a la fuerza,
      // por si hay una venta a medias).
      const [versionNueva, setVersionNueva] = useState(false);
      const [avisoVersionOculto, setAvisoVersionOculto] = useState(false);
      useEffect(() => {
        const actual = (document.querySelector('script[src*="/assets/pos-"]')?.getAttribute('src') || '').match(/pos-[\w-]+\.js/)?.[0];
        if (!actual) return undefined; // en desarrollo no hay archivos con huella
        let ultima = Date.now();
        const revisar = async () => {
          ultima = Date.now();
          try {
            const res = await fetch(`/pos?v=${ultima}`, { cache: 'no-store' });
            const html = await res.text();
            const publicado = html.match(/\/assets\/(pos-[\w-]+\.js)/)?.[1];
            if (publicado && publicado !== actual) setVersionNueva(true);
          } catch (err) { /* sin conexión: se revisa la próxima vez */ }
        };
        const alVolver = () => {
          if (document.visibilityState === 'visible' && Date.now() - ultima > 5 * 60000) revisar();
        };
        document.addEventListener('visibilitychange', alVolver);
        const reloj = setInterval(() => { if (document.visibilityState === 'visible') revisar(); }, 15 * 60000);
        return () => {
          document.removeEventListener('visibilitychange', alVolver);
          clearInterval(reloj);
        };
      }, []);

      // El botón "Modo Demo Local" y el link /demo se sacaron de la pantalla
      // de login (ver commit correspondiente) -- para mostrar la app ahora
      // se usa una bodega real ("Bodega Demo", DNI+PIN, ver el SQL que la
      // crea) que sí soporta el ciclo completo (catálogo online, pedidos
      // por WhatsApp, etc.). El resto del código que revisa "esModoDemo"
      // queda sin usar pero no se tocó -- borrarlo es un cambio grande y
      // separado, no hace falta para esto.

      // Si la sesión venció (no la cerró la persona), el aviso lo explica.
      // Copia de la sesión (usuario y bodega) para poder abrir la app si al
      // arrancar no se puede comprobar con internet. Se borra al cerrar sesión.
      const CLAVE_SESION_COPIA = 'kz_sesion_ultima';
      useEffect(() => {
        if (!sesion || esModoDemo) return;
        try { localStorage.setItem(CLAVE_SESION_COPIA, JSON.stringify({ usuario: sesion.usuario, bodega: sesion.bodega })); } catch (err) { /* sin almacenamiento: se sigue igual */ }
      }, [sesion]);
      const motivoCierreRef = useRef(null);
      const cerrandoSesionRef = useRef(false);
      const sesionRef = useRef(null);
      sesionRef.current = sesion;

      const cerrarSesion = async () => {
        cerrandoSesionRef.current = true;
        if (sbClient) {
          try { await sbClient.auth.signOut({ scope: 'local' }); } catch (err) { console.warn(err); }
        }
        setSesion(null);
        setCajeroSeleccionado(null);
        setCarrito([]);
        setTurnoActivo(null);
        // El catálogo guardado para abrir rápido incluye costos: no se deja
        // en el equipo al salir.
        try {
          Object.keys(localStorage).filter((k) => k.startsWith('kz_catalogo_')).forEach((k) => localStorage.removeItem(k)); localStorage.removeItem(CLAVE_SESION_COPIA);
        } catch (err) { /* sin almacenamiento disponible: nada que limpiar */ }
        // Limpia el estado del Modo Demo Local para que no se filtre a la
        // siguiente sesión (real o demo de nuevo) en esta misma pestaña.
        catalogoDemoRef.current = null;
        ventasDemoRef.current = [];
        setListaCajeros([]);
        setClientesLista([]);
        setProductos([]);
        const motivo = motivoCierreRef.current;
        motivoCierreRef.current = null;
        cerrandoSesionRef.current = false;
        notificar(motivo || 'Has cerrado sesión.', motivo ? 'error' : 'info');
      };

      // Pregunta al servidor si la sesión sigue viva. Solo la da por vencida si
      // el servidor la rechaza (401/403): sin internet no se saca a nadie.
      const verificarSesionVigente = async () => {
        if (!sbClient || !sesionRef.current || cerrandoSesionRef.current) return true;
        try {
          const { error } = await sbClient.auth.getUser();
          const rechazada = error && (error.status === 401 || error.status === 403);
          if (rechazada) {
            motivoCierreRef.current = 'Tu sesión venció. Vuelve a entrar para seguir vendiendo.';
            await cerrarSesion();
            return false;
          }
        } catch (err) { /* sin conexión: se deja seguir */ }
        return true;
      };

      useEffect(() => {
        if (!sbClient) return undefined;
        // Si Supabase cierra la sesión por su cuenta (no pudo renovar el token).
        const { data: { subscription } } = sbClient.auth.onAuthStateChange((evento) => {
          if (evento === 'SIGNED_OUT' && sesionRef.current && !cerrandoSesionRef.current) {
            motivoCierreRef.current = 'Tu sesión venció. Vuelve a entrar para seguir vendiendo.';
            cerrarSesion();
          }
        });
        // Al volver a la pestaña después de un rato, se revisa una vez por minuto.
        let ultimaRevision = 0;
        const alVolver = () => {
          if (document.visibilityState !== 'visible' || Date.now() - ultimaRevision < 60000) return;
          ultimaRevision = Date.now();
          verificarSesionVigente();
        };
        document.addEventListener('visibilitychange', alVolver);
        return () => {
          subscription.unsubscribe();
          document.removeEventListener('visibilitychange', alVolver);
        };
      }, [sbClient]);

      // Al cargar la app, si el dispositivo ya tiene una sesión válida de
      // Supabase Auth (login anterior), se restaura sin pedir DNI/PIN de
      // nuevo. El modo Demo no pasa por aquí (no usa Auth real).
      //
      // Un fallo momentáneo (la red del celular aún no despierta al reabrir la
      // app, conexión lenta, otra pestaña sujetando el bloqueo de Supabase) NO
      // es "no hay sesión": se reintenta unas veces y, si sigue sin poder
      // comprobarse, se abre con la última sesión guardada en este equipo (el
      // POS ya funciona sin conexión) en vez de mandar a iniciar sesión otra vez.
      useEffect(() => {
        if (!sbClient) { setVerificandoSesion(false); return undefined; }
        let cancelado = false;
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        const claveAuth = claveAuthSupabase(supabaseUrl);
        const leerJSON = (clave) => {
          try { return clave ? JSON.parse(localStorage.getItem(clave) || 'null') : null; } catch (e) { return null; }
        };

        // Un intento. Devuelve { estado }:
        //  'ok' (con sesion) | 'sin-sesion' | 'admin' | 'sin-suscripcion' | 'error'
        // 'error' = no se pudo comprobar; es lo único que se reintenta.
        const intentarRestaurar = async () => {
          const { data: { session }, error: errSesion } = await sbClient.auth.getSession();
          if (!session?.user) {
            // Hay sesión guardada pero no se pudo renovar: no es "sin sesión".
            const guardada = leerJSON(claveAuth);
            return errSesion && guardada && guardada.refresh_token ? { estado: 'error' } : { estado: 'sin-sesion' };
          }
          // maybeSingle (no single): una sesión guardada puede ser la del
          // super-admin, que no tiene fila en "usuarios" -- eso es
          // normal, no un error a mostrar en consola.
          // Trae la bodega en el mismo viaje (embed) en vez de una
          // segunda consulta secuencial después -- en cada carga de la
          // app esto le ahorra una ida y vuelta completa al servidor
          // antes de poder ocultar el splash.
          let { data: usuarioConBodega, error: errUsuario } = await sbClient.from('usuarios').select('*, bodegas(*)').eq('auth_id', session.user.id).maybeSingle();
          if (errUsuario) return { estado: 'error' };
          if (!usuarioConBodega) {
            // Bodega creada por el admin con el correo del dueño: en su
            // primer ingreso con Google se vincula la cuenta a esa bodega
            // (reclamar_cuenta_por_correo.sql). Si la función aún no existe
            // o el correo no tiene bodega, sigue el camino de siempre.
            const { data: bodegaReclamada } = await sbClient.rpc('reclamar_cuenta_por_correo');
            if (bodegaReclamada) {
              ({ data: usuarioConBodega, error: errUsuario } = await sbClient.from('usuarios').select('*, bodegas(*)').eq('auth_id', session.user.id).maybeSingle());
              if (errUsuario) return { estado: 'error' };
            }
          }
          if (usuarioConBodega) {
            const { bodegas: bodega, ...usuario } = usuarioConBodega;
            return { estado: 'ok', sesion: { usuario, bodega: bodega || { id: usuario.bodega_id, nombre: 'Mi Bodega' } } };
          }
          // Sin fila en "usuarios" -- puede ser el super-admin (cuenta
          // aparte, sin bodega, ver más abajo) o una cuenta de Google
          // que nunca compró ninguna bodega.
          const { data: esAdmin, error: errAdmin } = await sbClient.from('super_admins').select('auth_id').eq('auth_id', session.user.id).maybeSingle();
          if (errAdmin) return { estado: 'error' };
          return { estado: esAdmin ? 'admin' : 'sin-suscripcion' };
        };

        (async () => {
          let r = { estado: 'error' };
          for (const pausa of PAUSAS_REINTENTO_SESION) {
            if (pausa) await esperar(pausa);
            if (cancelado) return;
            try {
              r = await intentarRestaurar();
            } catch (err) {
              console.warn('No se pudo restaurar la sesión:', err && err.message);
              r = { estado: 'error' };
            }
            if (!debeReintentar(r.estado, navigator.onLine)) break;
          }
          if (cancelado) return;
          if (r.estado === 'ok') {
            setSesion(r.sesion);
          } else if (r.estado === 'sin-suscripcion') {
            // Cuenta de Google que nunca compró ninguna bodega: no la dejamos en
            // un login que no explica nada: la mandamos a activar su bodega,
            // ya autenticada.
            setVerificandoSesion(false);
            notificar('Esta cuenta no tiene ninguna suscripción activa. Te llevamos a activar tu negocio...', 'error');
            setTimeout(() => { window.location.href = '/registro'; }, 1800);
            return;
          } else if (r.estado === 'error') {
            const copia = leerJSON(CLAVE_SESION_COPIA);
            if (puedeUsarSesionGuardada(leerJSON(claveAuth), copia)) {
              setSesion({ usuario: copia.usuario, bodega: copia.bodega });
              notificar('Sin buena conexión: abrimos con tu última sesión guardada.', 'info');
            }
          }
          setVerificandoSesion(false);
        })();
        return () => { cancelado = true; };
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
          if (usuarioActivo && !cjs.some(esCajeroDelUsuarioActivo)) {
            const { data: propio, error: errPropio } = await sbClient
              .from('cajeros')
              .insert([{
                bodega_id: bodegaId,
                nombre: usuarioActivo.nombre,
                dni: usuarioActivo.dni || null,
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
            const propio = cjs.find(esCajeroDelUsuarioActivo);
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

      const cargarResumenAvisos = async () => {
        if (esModoDemo || !sbClient) { setResumenAvisos(null); return; }
        try {
          const { data, error } = await sbClient.rpc('resumen_avisos_clientes');
          if (error) throw error;
          const fila = Array.isArray(data) ? data[0] : data;
          setResumenAvisos(fila ? { audiencia: Number(fila.audiencia) || 0, proximo: fila.proximo_envio || null } : null);
        } catch (err) {
          // Todavía no se corrió migration_34 (o no hay permiso): la tarjeta simplemente no se muestra.
          setResumenAvisos(null);
        }
      };

      const avisarAMisClientes = async () => {
        const n = resumenAvisos?.audiencia || 0;
        const ok = await pedirConfirmacion({
          titulo: 'Avisar a tus clientes',
          mensaje: `Se enviará una notificación a ${n} cliente${n === 1 ? '' : 's'}: "¡${sesion?.bodega?.nombre || 'Tu negocio'} ya recibe pedidos!". Solo puedes hacerlo una vez por semana. ¿Enviar ahora?`,
          textoBoton: 'Sí, avisar',
        });
        if (!ok) return;
        setEnviandoAviso(true);
        try {
          const { data, error } = await sbClient.rpc('avisar_a_mis_clientes');
          if (error) throw error;
          notificar(`Aviso en camino a ${data} cliente${data === 1 ? '' : 's'}.`, 'success');
          await cargarResumenAvisos();
        } catch (err) {
          notificar(mensajeError(err, 'No se pudo enviar el aviso.'), 'error');
        } finally {
          setEnviandoAviso(false);
        }
      };

      // --- Pantalla "Mi link de pedidos": estado en vivo, resúmenes y cambios sin guardar ---
      const DIAS_DELIVERY = [[1, 'Lu'], [2, 'Ma'], [3, 'Mi'], [4, 'Ju'], [5, 'Vi'], [6, 'Sá'], [0, 'Do']];
      const aNumeroDelivery = (t) => Math.max(0, parseFloat(String(t ?? '').replace(',', '.')) || 0);
      const rangoHorarioDelivery = (h) => Object.values(h || {}).find((v) => v?.abierto) || null;
      const estadoHorarioDelivery = (h) => {
        if (!rangoHorarioDelivery(h)) return null;
        const hoy = h?.[new Date().getDay()];
        const ahora = new Date().toTimeString().slice(0, 5);
        let abierto = false;
        if (hoy?.abierto && hoy.desde && hoy.hasta) {
          abierto = hoy.hasta > hoy.desde ? ahora >= hoy.desde && ahora < hoy.hasta : ahora >= hoy.desde || ahora < hoy.hasta;
        }
        return abierto ? { abierto: true, texto: `Abierta ahora · hasta ${hoy.hasta}` } : { abierto: false, texto: 'Cerrada ahora' };
      };
      const resumenHorarioDelivery = (h) => {
        const rango = rangoHorarioDelivery(h);
        if (!rango) return 'Sin horario';
        const dias = DIAS_DELIVERY.filter(([d]) => h[d]?.abierto).map(([, l]) => l);
        return `${dias.length === 7 ? 'Todos los días' : dias.join(' ')} · ${rango.desde} a ${rango.hasta}`;
      };
      const huellaHorarioDelivery = (h) => DIAS_DELIVERY.map(([d]) => (h?.[d]?.abierto ? [h[d].desde, h[d].hasta] : null));
      // Compara lo que hay en pantalla con lo ya guardado en la bodega, para avisar de cambios sin guardar.
      const hayCambiosDelivery = (() => {
        if (!modalDelivery) return false;
        const b0 = sesion?.bodega || {};
        const esDueno = sesion?.usuario?.rol === 'dueno';
        const actual = [
          deliveryHabilitado, logoUrlDelivery || '', direccionDelivery.trim(), domicilioHabilitado,
          aNumeroDelivery(costoEnvioDelivery), aNumeroDelivery(pedidoMinimoDelivery), zonaRepartoDelivery.trim(),
          whatsappRepartidor.replace(/\D/g, ''), esDueno ? telefonoDeliveryEditar.trim() : '', huellaHorarioDelivery(horarioDelivery),
        ];
        const guardado = [
          !!b0.delivery_habilitado, b0.logo_url || '', (b0.direccion || '').trim(), !!b0.delivery_domicilio,
          aNumeroDelivery(b0.costo_envio), aNumeroDelivery(b0.pedido_minimo), (b0.zona_reparto || '').trim(),
          (b0.whatsapp_repartidor || '').replace(/\D/g, ''), esDueno ? (sesion?.usuario?.telefono || '').trim() : '', huellaHorarioDelivery(b0.horario_atencion),
        ];
        return JSON.stringify(actual) !== JSON.stringify(guardado);
      })();
      const estadoHorarioActualDelivery = modalDelivery ? estadoHorarioDelivery(horarioDelivery) : null;
      const resumenEntregaDelivery = domicilioHabilitado
        ? `Activa · ${aNumeroDelivery(costoEnvioDelivery) > 0 ? `S/ ${aNumeroDelivery(costoEnvioDelivery).toFixed(2)}` : 'Envío gratis'}${aNumeroDelivery(pedidoMinimoDelivery) > 0 ? ` · mín. S/ ${aNumeroDelivery(pedidoMinimoDelivery)}` : ''}${zonaRepartoDelivery.trim() ? ` · ${zonaRepartoDelivery.trim()}` : ''}`
        : 'Desactivada';
      // Una sección que se abre y se cierra, con un resumen visible cuando está cerrada.
      const seccionDelivery = (id, icono, titulo, resumen, hijos) => {
        const abierta = !!seccionesDelivery[id];
        return (
          <div className="bg-white rounded-3xl ring-1 ring-[#6105dc]/5 mb-2.5 overflow-hidden">
            <button
              type="button"
              aria-expanded={abierta}
              onClick={() => setSeccionesDelivery((s) => ({ ...s, [id]: !s[id] }))}
              className="w-full flex items-center gap-3 p-3.5 text-left"
            >
              <span className="w-10 h-10 rounded-[14px] bg-[#f4eefe] text-[#6105dc] flex items-center justify-center shrink-0">
                <IconoTrazo nombre={icono} className="w-[18px] h-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-stone-900 leading-tight">{titulo}</span>
                <span className="block text-xs text-stone-500 mt-0.5 truncate">{resumen}</span>
              </span>
              <i className={`fa-solid fa-chevron-down text-xs text-stone-400 transition-transform ${abierta ? 'rotate-180' : ''}`}></i>
            </button>
            {abierta && <div className="px-3.5 pb-4 space-y-3.5">{hijos}</div>}
          </div>
        );
      };

      const abrirModalDelivery = () => {
        cargarResumenAvisos();
        setSlugDelivery(sesion?.bodega?.slug || normalizarSlugDelivery(sesion?.bodega?.nombre));
        setDeliveryHabilitado(!!sesion?.bodega?.delivery_habilitado);
        setLogoUrlDelivery(sesion?.bodega?.logo_url || '');
        setDireccionDelivery(sesion?.bodega?.direccion || '');
        setDomicilioHabilitado(!!sesion?.bodega?.delivery_domicilio);
        setCostoEnvioDelivery(sesion?.bodega?.costo_envio != null ? String(Number(sesion.bodega.costo_envio)) : '');
        setPedidoMinimoDelivery(sesion?.bodega?.pedido_minimo != null ? String(Number(sesion.bodega.pedido_minimo)) : '');
        setZonaRepartoDelivery(sesion?.bodega?.zona_reparto || '');
        setWhatsappRepartidor(sesion?.bodega?.whatsapp_repartidor || '');
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
          notificar(mensajeError(err, 'No se pudo subir el logo'), 'error');
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
          notificar('Elige un link antes de mostrar tu tienda al público.', 'error');
          return;
        }
        const aNumero = (t) => Math.max(0, parseFloat(String(t).replace(',', '.')) || 0);
        const costoEnvioNum = aNumero(costoEnvioDelivery);
        const pedidoMinimoNum = aNumero(pedidoMinimoDelivery);
        const whatsappRepartidorLimpio = whatsappRepartidor.replace(/\D/g, '');
        if (whatsappRepartidorLimpio && (whatsappRepartidorLimpio.length < 7 || whatsappRepartidorLimpio.length > 15)) {
          notificar('El WhatsApp del repartidor no es válido.', 'error');
          return;
        }
        setGuardandoDelivery(true);
        try {
          const telefonoLimpio = telefonoDeliveryEditar.trim();
          if (esModoDemo) {
            // Modo Demo Local: no hay bodega real en Supabase -- se aplica
            // directo en memoria, igual que el resto de la demo.
          } else {
            // Primero la entrega a domicilio y después el catálogo: si se activan las dos
            // a la vez, sale un solo aviso a los clientes ("ya recibe pedidos") que ya
            // menciona el delivery. Solo se llama si algo de la entrega cambió -- así
            // guardar el resto del link no depende de esta función.
            const b0 = sesion?.bodega || {};
            const cambioDomicilio =
              domicilioHabilitado !== !!b0.delivery_domicilio ||
              costoEnvioNum !== Number(b0.costo_envio || 0) ||
              pedidoMinimoNum !== Number(b0.pedido_minimo || 0) ||
              zonaRepartoDelivery.trim() !== (b0.zona_reparto || '') ||
              whatsappRepartidorLimpio !== (b0.whatsapp_repartidor || '');
            if (cambioDomicilio) {
              const { error: errDomicilio } = await sbClient.rpc('actualizar_mi_entrega_domicilio', {
                p_habilitado: domicilioHabilitado,
                p_costo_envio: costoEnvioNum,
                p_pedido_minimo: pedidoMinimoNum,
                p_zona: zonaRepartoDelivery.trim() || null,
                p_whatsapp_repartidor: whatsappRepartidorLimpio || null,
              });
              if (errDomicilio) throw errDomicilio;
            }
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
              if (errBodega.code === '23505') throw new Error('Ese link ya lo usa otra tienda. Escribe a soporte de Kaserita para que te asignen otro.');
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
              delivery_domicilio: domicilioHabilitado,
              costo_envio: costoEnvioNum,
              pedido_minimo: pedidoMinimoNum,
              zona_reparto: zonaRepartoDelivery.trim() || null,
              whatsapp_repartidor: whatsappRepartidorLimpio || null,
            },
            usuario: s.usuario?.rol === 'dueno' ? { ...s.usuario, telefono: telefonoLimpio || null } : s.usuario,
          }));
          setSlugDelivery(slugLimpio);
          notificar('Listo, tu link de pedidos quedó actualizado.', 'success');
        } catch (err) {
          notificar(mensajeError(err, 'No se pudo guardar los cambios.'), 'error');
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
            // Solo los de esta bodega: si el dueño también compra como cliente
            // con la misma cuenta, sus pedidos de otras tiendas no deben verse acá.
            .eq('bodega_id', sesion.bodega.id)
            .order('creado_en', { ascending: false })
            .limit(200);
          if (error) throw error;
          setPedidosRetirar(data || []);
        } catch (err) {
          notificar(mensajeError(err, 'No se pudieron cargar los pedidos por retirar.'), 'error');
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
          notificar(mensajeError(err, 'No se pudo marcar el pedido.'), 'error');
        } finally {
          setMarcandoListoId(null);
        }
      };

      // Pedido a domicilio: pasa a "en camino" (el cliente lo ve en su celular).
      const marcarPedidoEnCamino = async (id) => {
        setProcesandoPedidoRetirarId(id);
        try {
          const { error } = await sbClient.rpc('marcar_pedido_en_camino', { p_id: id });
          if (error) throw error;
          setPedidosRetirar((prev) => prev.map((p) => (p.id === id ? { ...p, estado: 'en_camino' } : p)));
          notificar('Pedido en camino. El cliente ya lo ve así.', 'success');
        } catch (err) {
          notificar(mensajeError(err, 'No se pudo marcar el pedido.'), 'error');
        } finally {
          setProcesandoPedidoRetirarId(null);
        }
      };

      // Productos que forman un combo de un pedido de delivery, con la
      // cantidad total a preparar (por combo × combos pedidos). Los pedidos
      // nuevos traen el desglose guardado (migration_40); los anteriores lo
      // toman del combo tal como está ahora.
      const desgloseComboPedido = (it) => {
        if (!it?.combo_id) return [];
        const base = Array.isArray(it.componentes)
          ? it.componentes
          : (combos.find((c) => c.id === it.combo_id)?.combos_items || []).map((ci) => ({
              descripcion: ci.productos?.descripcion,
              cantidad: ci.cantidad,
            }));
        return base
          .filter((c) => c.descripcion)
          .map((c) => ({ descripcion: c.descripcion, cantidad: Number(c.cantidad || 0) * Number(it.cantidad || 0) }));
      };

      // Abre WhatsApp con el pedido ya armado (referencia, teléfono, monto a
      // cobrar y el enlace de la ubicación) para mandárselo al repartidor. Si
      // el negocio guardó el número de su repartidor va directo a ese chat;
      // si no, WhatsApp deja elegir el contacto.
      const enviarPedidoAlRepartidor = (p) => {
        const envio = Number(p.costo_envio || 0);
        const subtotal = (p.items || []).reduce((acc, it) => acc + Number(it.cantidad || 0) * Number(it.precio_venta || 0), 0);
        const total = subtotal + envio;
        const medio = { efectivo: 'efectivo', yape_plin: 'Yape / Plin', tarjeta: 'tarjeta' }[p.medio_pago] || p.medio_pago || '';
        const pagaCon = Number(p.paga_con || 0);
        const lineas = (p.items || []).flatMap((it) => [
          `${it.cantidad}x ${it.descripcion}`,
          ...desgloseComboPedido(it).map((c) => `   - ${c.cantidad}x ${c.descripcion}`),
        ]);
        const mensaje = [
          `Pedido a domicilio · ${p.codigo_corto}`,
          `Cliente: ${p.cliente_nombre || '-'} · ${p.telefono_contacto || '-'}`,
          `Referencia: ${p.entrega_referencia || '-'}`,
          '',
          ...lineas,
          '',
          `Cobrar S/ ${total.toFixed(2)}${medio ? ` en ${medio}` : ''}${p.medio_pago === 'efectivo' && pagaCon > 0 ? ` (paga con S/ ${pagaCon.toFixed(2)}, vuelto S/ ${Math.max(0, pagaCon - total).toFixed(2)})` : ''}`,
          '',
          `Ubicación: https://www.google.com/maps?q=${p.entrega_lat},${p.entrega_lng}`,
        ].join('\n');
        const tel = (sesion?.bodega?.whatsapp_repartidor || '').replace(/\D/g, '');
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener,noreferrer');
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
          notificar('Ese pedido ya está en el carrito: cóbralo para completarlo.', 'info');
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
            const envioPedido = Number(pedido.costo_envio || 0);
            notificar(
              pedido.tipo_entrega === 'domicilio' && envioPedido > 0
                ? `Pedido ${pedido.codigo_corto} agregado al carrito. Recuerda cobrar aparte S/ ${envioPedido.toFixed(2)} de envío (no está en el carrito).`
                : `Pedido ${pedido.codigo_corto} agregado al carrito. Se cierra solo cuando cobres.`,
              'success'
            );
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
          // Los productos de este pedido ya se cobraron y entregaron: si seguían
          // en el carrito, un cobro por descuido los vendería dos veces. Solo se
          // vacía cuando el carrito es exactamente este pedido (si hay otro
          // pedido cargado, sus productos están mezclados y no se separan).
          const soloEste = pedidosCargadosAlCarrito.length === 1 && pedidosCargadosAlCarrito[0].id === pedido.id;
          if (soloEste) {
            setPedidosCargadosAlCarrito([]);
            setCarrito([]);
            setDescuentoTipo(null);
            setDescuentoValor('');
            setMostrarPago(false);
            reiniciarClienteYMedioPago();
          } else if (pedidosCargadosAlCarrito.some((c) => c.id === pedido.id)) {
            setPedidosCargadosAlCarrito((prev) => prev.filter((c) => c.id !== pedido.id));
            notificar('Quita del carrito los productos de este pedido: ya se entregaron.', 'info');
          }
          notificar(`Pedido ${pedido.codigo_corto} marcado como retirado.`, 'success');
        } catch (err) {
          notificar(mensajeError(err, 'No se pudo marcar el pedido.'), 'error');
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
        // Para que el aviso en vivo (más abajo) no lo anuncie como
        // "el cliente canceló" si el evento llega antes que esta respuesta.
        canceladosDesdeAquiRef.current.add(pedido.id);
        try {
          const { error } = await sbClient.rpc('cancelar_seguimiento_pedido', { p_id: pedido.id });
          if (error) throw error;
          setPedidosRetirar((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, estado: 'cancelado' } : p)));
          notificar(`Pedido ${pedido.codigo_corto} eliminado.`, 'success');
        } catch (err) {
          notificar(mensajeError(err, 'No se pudo eliminar el pedido.'), 'error');
        } finally {
          setProcesandoPedidoRetirarId(null);
        }
      };

      // Aviso en vivo: mientras haya sesión de bodega, escucha si entra un
      // pedido nuevo (Realtime de Supabase, filtrado por RLS a la propia
      // bodega igual que cualquier otra consulta) y suena + avisa, esté o
      // no abierta la pantalla de "Pedidos por retirar". También escucha
      // los cambios de estado: si el cliente cancela desde la tienda, el
      // pedido sale de la cola y del contador de pendientes sin recargar.
      const pedidosRetirarRef = useRef(pedidosRetirar);
      pedidosRetirarRef.current = pedidosRetirar;
      const pedidosCargadosRef = useRef(pedidosCargadosAlCarrito);
      pedidosCargadosRef.current = pedidosCargadosAlCarrito;
      const canceladosDesdeAquiRef = useRef(new Set());
      useEffect(() => {
        if (esModoDemo || !sbClient || !sesion?.bodega?.id) return;
        const canal = sbClient
          .channel(`pedidos-seguimiento-${sesion.bodega.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'pedidos_seguimiento', filter: `bodega_id=eq.${sesion.bodega.id}` },
            (payload) => {
              sonarAvisoPedidoNuevo();
              notificar(`Nuevo pedido${payload.new.tipo_entrega === 'domicilio' ? ' a domicilio' : ''}: ${payload.new.codigo_corto}`, 'success');
              setPedidosRetirar((prev) => (prev.some((p) => p.id === payload.new.id) ? prev : [...prev, payload.new]));
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'pedidos_seguimiento', filter: `bodega_id=eq.${sesion.bodega.id}` },
            (payload) => {
              const n = payload.new;
              if (!n?.id) return;
              const antes = pedidosRetirarRef.current.find((p) => p.id === n.id);
              setPedidosRetirar((prev) => prev.map((p) => (p.id === n.id ? { ...p, ...n } : p)));
              if (n.estado !== 'cancelado' || !antes || antes.estado === 'cancelado') return;
              if (canceladosDesdeAquiRef.current.delete(n.id)) return;
              if (pedidosCargadosRef.current.some((c) => c.id === n.id)) {
                // Ya no se cierra al cobrar: el pedido no existe más.
                setPedidosCargadosAlCarrito((prev) => prev.filter((c) => c.id !== n.id));
                notificar(`El cliente canceló el pedido ${n.codigo_corto}, que está en el carrito. Quita esos productos antes de cobrar.`, 'error');
              } else {
                notificar(`El cliente canceló el pedido ${n.codigo_corto}.`, 'info');
              }
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
            .select(esBarberia ? 'id, bodega_id, nombre, dni, rol, activo, comision_pct, comision_productos_pct' :'id, bodega_id, nombre, dni, rol, activo')
            .eq('bodega_id', bodegaId)
            .order('nombre', { ascending: true });
          if (error) throw error;
          setCajerosGestion(data || []);
          if (esBarberia) {
            const { data: horarios } = await sbClient.from('barbero_horarios').select('barbero_id').eq('bodega_id', bodegaId);
            setBarberosConHorario(new Set((horarios || []).map((h) => h.barbero_id)));
          }
        } catch (err) {
          notificar(mensajeError(err, 'No se pudo cargar la lista de cajeros'), 'error');
        } finally {
          setCargandoCajerosGestion(false);
        }
      };

      // Barbería: guarda un % de comisión de un barbero (0 a 100). `campo` es
      // comision_pct (cortes y servicios) o comision_productos_pct (productos).
      const guardarComisionBarbero = async (barbero, texto, campo = 'comision_pct') => {
        if (campo !== 'comision_pct' && campo !== 'comision_productos_pct') return;
        const pct = Number(texto);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
          notificar('La comisión debe estar entre 0 y 100.', 'error');
          return;
        }
        if (Number(barbero[campo]) === pct) return;
        if (!sbClient || esModoDemo) return;
        const { error } = await sbClient.from('cajeros').update({ [campo]: pct }).eq('id', barbero.id);
        if (error) {
          notificar(mensajeError(error, 'No se pudo guardar la comisión'), 'error');
          return;
        }
        setCajerosGestion((prev) => prev.map((c) => (c.id === barbero.id ? { ...c, [campo]: pct } : c)));
        notificar(`Comisión de ${barbero.nombre} por ${campo === 'comision_pct' ? 'servicios' : 'productos'}: ${pct}%.`, 'success');
      };

      // Barbería: lo vendido por cada barbero en el período. La comisión se
      // calcula solo sobre los SERVICIOS (ítems sin stock, como el corte); lo que
      // vende de productos (pomada, shampoo) se muestra aparte y no comisiona.
      const cargarComisiones = async (periodo) => {
        if (!sbClient || !bodegaId || esModoDemo) { setFilasComisiones([]); return; }
        setCargandoComisiones(true);
        try {
          const hoy = new Date();
          const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
          if (periodo === 'semana') desde.setDate(desde.getDate() - ((desde.getDay() + 6) % 7));
          if (periodo === 'mes') desde.setDate(1);
          const [resVentas, resBarberos] = await Promise.all([
            sbClient
              .from('ventas')
              .select('id, barbero_id, ventas_detalle(subtotal, combo_id, productos(stock_actual))')
              .eq('bodega_id', bodegaId)
              .eq('anulada', false)
              .not('barbero_id', 'is', null)
              .gte('fecha_hora', desde.toISOString()),
            sbClient.from('cajeros').select('id, nombre, rol, comision_pct, comision_productos_pct').eq('bodega_id', bodegaId).order('nombre', { ascending: true })
          ]);
          if (resVentas.error) throw resVentas.error;
          if (resBarberos.error) throw resBarberos.error;
          const porBarbero = new Map((resBarberos.data || []).map((b) => [b.id, {
            // El dueño no cobra comisión (es el dueño del negocio), aunque atienda.
            id: b.id, nombre: b.nombre, esDueno: b.rol === 'dueno', pct: b.rol === 'dueno' ? 0 : (Number(b.comision_pct) || 0), pctProductos: b.rol === 'dueno' ? 0 : (Number(b.comision_productos_pct) || 0), atenciones: 0, servicios: 0, cantServicios: 0, productos: 0, insumosCombo: 0
          }]));
          (resVentas.data || []).forEach((v) => {
            const fila = porBarbero.get(v.barbero_id);
            if (!fila) return;
            fila.atenciones += 1;
            (v.ventas_detalle || []).forEach((d) => {
              const esServicio = d.productos && (d.productos.stock_actual === null || d.productos.stock_actual === undefined);
              if (esServicio) { fila.servicios += Number(d.subtotal) || 0; fila.cantServicios += 1; }
              // Dentro de un combo (ej. tinte + aplicación) solo comisiona la
              // parte de servicio: el producto/insumo del combo no comisiona.
              else if (d.combo_id) fila.insumosCombo += Number(d.subtotal) || 0;
              else fila.productos += Number(d.subtotal) || 0;
            });
          });
          setFilasComisiones([...porBarbero.values()].map((f) => ({
            ...f,
            comisionServicios: +(f.servicios * f.pct / 100).toFixed(2),
            comisionProductos: +(f.productos * f.pctProductos / 100).toFixed(2),
            comision: +((f.servicios * f.pct / 100) + (f.productos * f.pctProductos / 100)).toFixed(2)
          })));
        } catch (err) {
          notificar(mensajeError(err, 'No se pudo cargar las comisiones'), 'error');
          setFilasComisiones([]);
        } finally {
          setCargandoComisiones(false);
        }
      };

      const abrirComisiones = () => {
        setModalComisiones(true);
        cargarComisiones(periodoComisiones);
      };

      // Barbería con agenda: horario semanal de un barbero. En pantalla cada día
      // tiene una hora de inicio, una de fin y un descanso opcional; en la base
      // se guarda como bloques (un descanso parte el día en dos bloques).
      const DIAS_AGENDA = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];

      const abrirHorarioBarbero = async (barbero) => {
        if (!sbClient || esModoDemo) return;
        const { data, error } = await sbClient
          .from('barbero_horarios')
          .select('dia, desde, hasta')
          .eq('barbero_id', barbero.id)
          .order('desde', { ascending: true });
        if (error) {
          notificar(mensajeError(error, 'No se pudo cargar el horario'), 'error');
          return;
        }
        const hhmm = (t) => String(t).slice(0, 5);
        const sinHorario = (data || []).length === 0;
        const dias = DIAS_AGENDA.map(([dia, nombre]) => {
          const bloques = (data || []).filter((b) => b.dia === dia);
          if (bloques.length === 0) {
            // Sin horario cargado se propone lunes a sábado de 9 a 20 para editar.
            return { dia, nombre, activo: sinHorario && dia !== 0, desde: '09:00', hasta: '20:00', descansoDesde: '', descansoHasta: '' };
          }
          return {
            dia, nombre, activo: true,
            desde: hhmm(bloques[0].desde),
            hasta: hhmm(bloques[bloques.length - 1].hasta),
            descansoDesde: bloques.length > 1 ? hhmm(bloques[0].hasta) : '',
            descansoHasta: bloques.length > 1 ? hhmm(bloques[1].desde) : ''
          };
        });
        setModalHorario({ barbero, dias });
      };

      const cambiarDiaHorario = (dia, cambios) => {
        setModalHorario((prev) => prev && { ...prev, dias: prev.dias.map((d) => (d.dia === dia ? { ...d, ...cambios } : d)) });
      };

      // Copia el horario del primer día activo a todos los demás días activos.
      const copiarHorarioADias = () => {
        setModalHorario((prev) => {
          if (!prev) return prev;
          const base = prev.dias.find((d) => d.activo);
          if (!base) return prev;
          return { ...prev, dias: prev.dias.map((d) => (d.activo ? { ...d, desde: base.desde, hasta: base.hasta, descansoDesde: base.descansoDesde, descansoHasta: base.descansoHasta } : d)) };
        });
      };

      const guardarHorarioBarbero = async () => {
        if (!modalHorario || !sbClient || esModoDemo) return;
        const bloques = [];
        for (const d of modalHorario.dias.filter((x) => x.activo)) {
          if (!d.desde || !d.hasta || d.hasta <= d.desde) {
            notificar(`${d.nombre}: la hora de fin debe ser después de la de inicio.`, 'error');
            return;
          }
          if (d.descansoDesde || d.descansoHasta) {
            if (!(d.descansoDesde && d.descansoHasta && d.descansoDesde > d.desde && d.descansoHasta > d.descansoDesde && d.descansoHasta < d.hasta)) {
              notificar(`${d.nombre}: el descanso debe tener inicio y fin, dentro del horario.`, 'error');
              return;
            }
            bloques.push({ dia: d.dia, desde: d.desde, hasta: d.descansoDesde }, { dia: d.dia, desde: d.descansoHasta, hasta: d.hasta });
          } else {
            bloques.push({ dia: d.dia, desde: d.desde, hasta: d.hasta });
          }
        }
        setGuardandoHorario(true);
        try {
          const { error } = await sbClient.rpc('guardar_horario_barbero', { p_barbero: modalHorario.barbero.id, p_bloques: bloques });
          if (error) throw error;
          setBarberosConHorario((prev) => {
            const sig = new Set(prev);
            if (bloques.length > 0) sig.add(modalHorario.barbero.id); else sig.delete(modalHorario.barbero.id);
            return sig;
          });
          notificar(`Horario de ${modalHorario.barbero.nombre} guardado.`, 'success');
          setModalHorario(null);
        } catch (err) {
          notificar(mensajeError(err, 'No se pudo guardar el horario'), 'error');
        } finally {
          setGuardandoHorario(false);
        }
      };

      // Agenda de citas de un día, por barbero.
      const cargarAgenda = async (fecha) => {
        if (!sbClient || !bodegaId || esModoDemo || !fecha) { setCitasAgenda([]); return; }
        setCargandoAgenda(true);
        try {
          const [a, m, d] = fecha.split('-').map(Number);
          const desde = new Date(a, m - 1, d);
          const hasta = new Date(a, m - 1, d + 1);
          const [resCitas, resBarberos] = await Promise.all([
            sbClient
              .from('citas')
              .select('id, barbero_id, inicio, fin, pedidos_seguimiento(codigo_corto, cliente_nombre, items, estado)')
              .eq('bodega_id', bodegaId)
              .gte('inicio', desde.toISOString())
              .lt('inicio', hasta.toISOString())
              .order('inicio', { ascending: true }),
            sbClient.from('cajeros').select('id, nombre').eq('bodega_id', bodegaId).order('nombre', { ascending: true })
          ]);
          if (resCitas.error) throw resCitas.error;
          if (resBarberos.error) throw resBarberos.error;
          const nombres = new Map((resBarberos.data || []).map((b) => [b.id, b.nombre]));
          setCitasAgenda((resCitas.data || []).map((c) => ({ ...c, barbero: nombres.get(c.barbero_id) || 'Barbero' })));
        } catch (err) {
          notificar(mensajeError(err, 'No se pudo cargar la agenda'), 'error');
          setCitasAgenda([]);
        } finally {
          setCargandoAgenda(false);
        }
      };

      // Alarga o acorta una cita ya reservada (ej. un tinte que toma más tiempo).
      // El servidor revisa que no choque con la siguiente cita del barbero.
      const ajustarDuracionCita = async (cita, texto) => {
        const minutos = Number(texto);
        const actual = Math.round((new Date(cita.fin) - new Date(cita.inicio)) / 60000);
        if (!Number.isInteger(minutos) || minutos < 5 || minutos > 480 || minutos % 5 !== 0) {
          notificar('La duración debe ser de 5 a 480 minutos, de 5 en 5.', 'error');
          cargarAgenda(fechaAgenda);
          return;
        }
        if (minutos === actual || !sbClient || esModoDemo) return;
        const { error } = await sbClient.rpc('ajustar_duracion_cita', { p_cita: cita.id, p_minutos: minutos });
        if (error) {
          notificar(mensajeError(error, 'No se pudo ajustar la cita.'), 'error');
        } else {
          notificar(`Cita ajustada a ${minutos} minutos.`, 'success');
        }
        cargarAgenda(fechaAgenda);
      };

      const abrirAgenda = () => {
        const hoy = new Date();
        const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        setFechaAgenda(iso);
        setModalAgenda(true);
        cargarAgenda(iso);
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
        if (!esDocumentoValido(dni) || esRucValido(dni)) {
          notificar('Revisa el DNI: debe tener 8 dígitos (o carné/pasaporte de 9 a 12 letras o números).', 'error');
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
          notificar(mensajeError(err, 'Error al registrar'), 'error');
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
          notificar(mensajeError(err, 'No se pudo completar la acción'), 'error');
        }
      };

      // Borra por completo el acceso de un cajero (a diferencia de
      // desactivar, que solo lo oculta del selector conservando su
      // historial). Si tiene ventas registradas a su nombre, la base de
      // datos rechaza el borrado (esas filas dependen de este id) -- en ese
      // caso conviene usar "Desactivar" en su lugar, así se avisa.
      const eliminarCajero = async (cajero) => {
        if (cajero.rol === 'dueno') return;
        const confirmado = await pedirConfirmacion({
          titulo: 'Eliminar cajero',
          mensaje: `¿Eliminar a "${cajero.nombre}" de la lista de cajeros? Esta acción no se puede deshacer.`,
          textoBoton: 'Sí, eliminar',
          peligroso: true
        });
        if (!confirmado) return;
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
            notificar(mensajeError(err, 'No se pudo completar la acción'), 'error');
          }
        }
      };

      // El dueño ya probó su identidad al iniciar sesión, así que puede
      // elegirse a sí mismo sin nada más. Cualquier otra fila con rol
      // "administrador" (o "dueno", que no debería repetirse) desbloquea el
      // panel completo -- antes de aplicar ese cambio, se pide su PIN.
      const elegirCajeroTurno = (f) => {
        if (!f) return;
        const esUnoMismo = esCajeroDelUsuarioActivo(f);
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
          notificar(mensajeError(err), 'error');
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
          notificar(mensajeError(err, 'No se pudo completar la acción'), 'error');
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

        // Primera carga de esta bodega en la sesión, sin búsqueda: se muestra
        // al instante el último catálogo guardado en este equipo mientras
        // llega el actualizado (stock y precios se corrigen solos al terminar).
        let desdeCache = false;
        const claveCache = `kz_catalogo_${bodegaId}`;
        if (!termino.trim() && catalogoCacheadoRef.current !== bodegaId) {
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
              if (termino.trim()) {
                const b = termino.trim();
                q = q.or(`cod_ean.ilike.%${b}%,descripcion.ilike.%${b}%,categoria.ilike.%${b}%`);
              }
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
            if (!termino.trim()) {
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
            // Sin internet pero con catálogo guardado: se conserva lo que ya se ve.
            if (!desdeCache) setProductos([]);
            notificar(mensajeError(err, 'No se pudieron cargar tus productos'), 'error');
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
          obtenerOCrearCliente('99999999');
          // Encadenado (no en paralelo): verificarTurno necesita saber ya
          // resuelto qué cajero es "el mío" en este dispositivo (por DNI)
          // para decidir si hay que retomar mi propia caja en silencio o
          // avisar que hay otras cajas abiertas de otros cajeros.
          // La consulta de turnos sale ya, junto con las demás; solo la decisión espera al cajero.
          const turnosEnCurso = esModoDemo || !sbClient ? null : consultarTurnosAbiertos();
          (async () => {
            const cajero = await cargarCajeros();
            verificarTurno(cajero, turnosEnCurso);
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

      // Función estable para las tarjetas: si fuera una flecha nueva en cada render,
      // React.memo no evitaría que todas las tarjetas se redibujen con cada cambio.
      const verCombosDesdeTarjeta = useCallback(() => setCategoriaFiltro('__COMBOS__'), []);

      const productosFiltrados = useMemo(() => {
        if (categoriaFiltro === 'TODOS') return productos;
        return productos.filter(p => p.categoria === categoriaFiltro);
      }, [productos, categoriaFiltro]);

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
        setDestelloEscaner(true);
        setTimeout(() => setDestelloEscaner(false), 800);

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

        if (modoEscaner === 'entrada-mercaderia') {
          const encontrado = buscarProductoPorCodigo(codigoLimpio);
          if (encontrado) {
            elegirProductoEntrada(encontrado.producto, encontrado.esPack);
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
            elegirProductoMerma(encontrado.producto);
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
            agregarProductoAConteo(encontrado.producto);
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
        obtenerOCrearCliente('99999999');
      };

      // ==========================================
      // VENTAS EN ESPERA (PARK SALES)
      // ==========================================
      // Al vaciar o pausar el carrito con un pedido de delivery cargado, el
      // pedido no se borra: vuelve a su cola. Se avisa para que no parezca
      // perdido.
      const avisarPedidosDevueltos = () => {
        if (pedidosCargadosAlCarrito.length === 0) return;
        const codigos = pedidosCargadosAlCarrito.map((p) => p.codigoCorto).join(', ');
        notificar(
          pedidosCargadosAlCarrito.length === 1
            ? `El pedido ${codigos} no se perdió: sigue en «Pedidos por retirar» para volver a cargarlo.`
            : `Los pedidos ${codigos} no se perdieron: siguen en «Pedidos por retirar» para volver a cargarlos.`,
          'info'
        );
      };

      const aparcarVentaActual = () => {
        if (carrito.length === 0) return;
        avisarPedidosDevueltos();
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
        // el pedido se cierra a mano: "Cargar al carrito" y "Confirmar retiro".
        setPedidosCargadosAlCarrito([]);
      };

      // Si el carrito queda vacío por otro camino (quitando los productos uno
      // por uno), el pedido también se desvincula: si no, su tarjeta seguía
      // diciendo "en el carrito" y ya no ofrecía "Cargar al carrito".
      useEffect(() => {
        if (carrito.length === 0 && pedidosCargadosAlCarrito.length > 0) {
          avisarPedidosDevueltos();
          setPedidosCargadosAlCarrito([]);
        }
      }, [carrito.length, pedidosCargadosAlCarrito.length]);

      // En pantallas bajas la barra fija de "Total a cobrar" tapa los campos de
      // monto (Paga con / Monto en tarjeta) y había que adivinar que se podía
      // desplazar. Al elegir Efectivo o Mixto se sube solo ese panel; se mueve
      // el contenedor con scroll y no la página (scrollIntoView podía correrla).
      useEffect(() => {
        if (!mostrarPago || (medioPago !== 'EFECTIVO' && medioPago !== 'MIXTO')) return undefined;
        const t = setTimeout(() => {
          const el = document.querySelector('[data-campo-pago]');
          if (!el) return;
          let cont = el.parentElement;
          while (cont && !(cont.scrollHeight > cont.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(cont).overflowY))) {
            cont = cont.parentElement;
          }
          if (!cont) return;
          const top = el.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop - 8;
          cont.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }, 80);
        return () => clearTimeout(t);
      }, [medioPago, mostrarPago]);

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
        if (!esDocumentoValido(dni)) {
          notificar('Revisa el documento: DNI de 8 dígitos, RUC de 11 o carné/pasaporte de 9 a 12 letras o números.', 'error');
          return;
        }
        if (!esMontoNoNegativo(limiteCredito)) {
          notificar('El límite de crédito no puede ser negativo.', 'error');
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
            // "Clientes" como en "Fiados" si queda con deuda.
            if (modalGestionClientes || esModoDemo) {
              setClientesLista((prev) => [...prev, cLocal].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '')));
            }
          }

          setModalNuevoCliente(false);
          setFormCliente({ dni: '', nombre: '', telefono: '', correo: '', limiteCredito: '300.00' });
          notificar(`¡Cliente "${nombre}" registrado con éxito!`, 'success');
        } catch (err) {
          notificar(mensajeError(err, 'No se pudo completar la acción'), 'error');
        }
      };

      // Cargar deudores
      // Trae los clientes con deuda y, aparte, sus boletas a crédito para
      // saber cuáles tienen deuda vencida. Si las boletas llegan cortadas por
      // el tope de filas del servidor, no se usan (mejor no mostrar el
      // vencimiento que mostrarlo mal).
      const recargarDeudores = async () => {
        if (esModoDemo) {
          // No hay servidor real del que traer deudores -- se calculan a
          // partir de los clientes creados en esta misma demo.
          setClientesDeudores(clientesLista.filter((c) => (Number(c.saldo_actual) || 0) > 0).sort((a, b) => (Number(b.saldo_actual) || 0) - (Number(a.saldo_actual) || 0)));
          setBoletasDeudores(null);
          return;
        }
        if (sbClient && bodegaId) {
          setCargandoDeudores(true);
          try {
            const { data } = await sbClient
              .from('clientes')
              .select('*')
              .eq('bodega_id', bodegaId)
              .gt('saldo_actual', 0)
              .order('saldo_actual', { ascending: false });

            const lista = data || [];
            setClientesDeudores(lista);

            let porCliente = {};
            let completo = lista.length > 0;
            for (let i = 0; i < lista.length && completo; i += 40) {
              const { data: boletas, error } = await sbClient
                .from('ventas')
                .select('id, cliente_id, total_venta, fecha_hora')
                .in('cliente_id', lista.slice(i, i + 40).map((c) => c.id))
                .eq('medio_pago', 'CREDITO')
                .eq('anulada', false)
                .limit(1000);
              if (error || !boletas || boletas.length >= 1000) { completo = false; break; }
              boletas.forEach((b) => { (porCliente[b.cliente_id] = porCliente[b.cliente_id] || []).push(b); });
            }
            setBoletasDeudores(completo ? porCliente : null);
          } catch (err) {
            console.warn(err);
          } finally {
            setCargandoDeudores(false);
          }
        }
      };

      const abrirModuloCobroDeudas = async () => {
        setModalCobrarDeudas(true);
        setDeudorSeleccionado(null);
        setPagoRegistrado(null);
        setBoletasDeudor([]);
        setBusquedaDeudores('');
        setFiltroDeudores('todos');
        setOrdenDeudores('deuda');
        await recargarDeudores();
      };

      // Últimos pagos que hizo el cliente (los que ya se guardan en
      // pagos_credito al registrar un abono).
      const cargarPagosRecientes = async (cliente) => {
        try {
          const { data } = await sbClient
            .from('pagos_credito')
            .select('monto_pagado, fecha, cajero_id')
            .eq('cliente_id', cliente.id)
            .order('fecha', { ascending: false })
            .limit(3);
          setPagosRecientes(data || []);
        } catch (err) {
          console.warn(err);
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
            notificar(mensajeError(err, 'No se pudo cargar los proveedores'), 'error');
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
        if (ruc.trim() && !esRucValido(ruc)) {
          notificar('El RUC debe tener 11 dígitos.', 'error');
          return;
        }
        if (!esMontoNoNegativo(saldoInicial)) {
          notificar('La deuda inicial no puede ser negativa.', 'error');
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
          notificar(mensajeError(err, 'Error al registrar el proveedor'), 'error');
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
          notificar(mensajeError(err, 'Error al registrar el movimiento'), 'error');
        }
      };

      // ==========================================
      // GESTIÓN DE CLIENTES (listar / editar)
      // ==========================================
      const abrirGestionClientes = async () => {
        setModalGestionClientes(true);
        setClienteEditando(null);
        setFiltroClientes('todos');
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
          notificar(mensajeError(err, 'No se pudo cargar la lista de clientes'), 'error');
        } finally {
          setCargandoClientes(false);
        }
      };

      const clientesFiltradosGestion = () => {
        const t = busquedaClientes.trim().toLowerCase();
        return clientesLista.filter((c) => {
          const debe = (Number(c.saldo_actual) || 0) > 0;
          if (filtroClientes === 'deuda' && !debe) return false;
          if (filtroClientes === 'aldia' && debe) return false;
          if (!t) return true;
          return (c.nombre_completo || '').toLowerCase().includes(t) || (c.dni || '').includes(t);
        });
      };

      // Iniciales para el avatar de cada cliente ("Rosa Chávez Mendoza" -> "RC").
      const inicialesCliente = (nombre) => {
        const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
        if (partes.length === 0) return '?';
        return (partes[0][0] + (partes.length > 1 ? partes[1][0] : '')).toUpperCase();
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
          notificar(mensajeError(err, 'No se pudo cargar la lista de clientes'), 'error');
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
          // "Cliente sin registrar": es un objeto local sin id todavía
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
          'Teléfono': c.telefono || '',
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
          notificar(mensajeError(err, 'Error al guardar'), 'error');
        } finally {
          setGuardandoEdicionCliente(false);
        }
      };

      // Al elegir un deudor, cargar el detalle de sus boletas a crédito pendientes
      const seleccionarDeudor = async (cliente) => {
        setPagoRegistrado(null);
        setDeudorSeleccionado(cliente);
        setMontoAbonoDeuda(Number(cliente.saldo_actual).toFixed(2));
        setConfirmandoPagoDeudor(false);
        setBoletasDeudor([]);
        setMostrarHistorialCompletoDeuda(false);
        setPagosRecientes([]);
        if (!sbClient) return;
        cargarPagosRecientes(cliente);
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
        const nota = doc.splitTextToSize('Este documento resume las boletas a crédito pendientes de pago a la fecha de emisión. Si ya realizó un pago que no figura aquí, comuníquese con el negocio para actualizar su cuenta.', 105);
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
        if (abono > saldoAnterior + 0.004) {
          notificar('El monto es mayor que la deuda. Ajústalo al saldo del cliente.', 'error');
          return;
        }
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
              notificar(`No se pudo registrar el pago en el servidor. Avisa al soporte.`, 'error');
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
            notificar(mensajeError(err, 'No se pudo registrar el pago'), 'error');
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
        // Se muestra "Pago registrado" con el cliente aún elegido; la lista
        // se actualiza al toque y, con servidor, se vuelve a leer de fondo.
        setPagoRegistrado({ id: deudorSeleccionado.id, nombre: deudorSeleccionado.nombre_completo, abono, antes: saldoAnterior, despues: nuevoSaldo });
        setClientesDeudores((prev) => prev
          .map((c) => (c.id === deudorSeleccionado.id ? { ...c, saldo_actual: nuevoSaldo } : c))
          .filter((c) => (Number(c.saldo_actual) || 0) > 0.004));
        if (!esModoDemo) recargarDeudores();
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
          notificar(mensajeError(err, 'No se pudo cargar el historial'), 'error');
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

          vaciarEntradaMercaderia();
          setEntradaRegistrada(resumen);
          cargarProductos();
        } catch (err) {
          notificar(mensajeError(err, 'Error al registrar la entrada'), 'error');
        } finally {
          setGuardandoEntrada(false);
        }
      };

      // ==========================================
      // HISTORIAL DE VENTAS DEL DÍA & ANULACIÓN
      // ==========================================
      const cargarHistorialPorRango = async (desde, hasta) => {
        setCargandoHistorial(true);
        setLimiteHistorial(40);
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
            notificar(mensajeError(err, 'No se pudo cargar el historial'), 'error');
          } finally {
            setCargandoHistorial(false);
          }
        } else {
          setCargandoHistorial(false);
        }
      };

      // Nombre del cliente en el historial: la cuenta "Desconocido" es la venta sin cliente.
      const nombreClienteHistorial = (v) => {
        const nombre = v.clientes?.nombre_completo;
        return nombre && nombre !== 'Desconocido' ? nombre : 'Cliente sin registrar';
      };
      const etiquetaDiaHistorial = (iso) => {
        const d = new Date(iso);
        const hoy = new Date();
        const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
        const dif = Math.round((dia(hoy) - dia(d)) / 86400000);
        if (dif <= 0) return 'Hoy';
        if (dif === 1) return 'Ayer';
        return d.toLocaleDateString('es-PE', d.getFullYear() !== hoy.getFullYear() ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' });
      };
      // Atajos de fecha del historial: Hoy, Ayer, 7 días, Este mes o fechas a elección.
      const elegirAtajoHistorial = (id) => {
        setAtajoHistorial(id);
        setVentaDetalleHistorial(null);
        setMenuVentaHistorial(null);
        if (id === 'fechas') return;
        const hoy = new Date();
        let desde = fechaISOLocal(hoy);
        let hasta = desde;
        if (id === 'ayer') {
          const ayer = new Date(hoy);
          ayer.setDate(ayer.getDate() - 1);
          desde = fechaISOLocal(ayer);
          hasta = desde;
        } else if (id === '7dias') {
          const hace6 = new Date(hoy);
          hace6.setDate(hace6.getDate() - 6);
          desde = fechaISOLocal(hace6);
        } else if (id === 'mes') {
          desde = fechaISOLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
        }
        setFechaInicioHistorial(desde);
        setFechaFinHistorial(hasta);
        setBusquedaBoletaHistorial('');
        cargarHistorialPorRango(desde, hasta);
      };

      const abrirHistorialDelDia = () => {
        setModalHistorial(true);
        setAtajoHistorial('hoy');
        setVentaDetalleHistorial(null);
        setMenuVentaHistorial(null);
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
          const duracionMs = fin.getTime() - inicio.getTime();
          const finAnterior = new Date(inicio.getTime() - 1);
          const inicioAnterior = new Date(finAnterior.getTime() - duracionMs);
          const anterior = ventasDemoRef.current.filter((v) => {
            const f = new Date(v.fecha_hora);
            return f >= inicioAnterior && f <= finAnterior;
          });
          setResumenPeriodo(resumirVentasPeriodo(enRango, anterior));

          setClientesDeuda(clientesLista.filter((c) => (Number(c.saldo_actual) || 0) > 0).sort((a, b) => (Number(b.saldo_actual) || 0) - (Number(a.saldo_actual) || 0)));
          setProveedoresDeudaDash([]);

          const anioActual = new Date().getFullYear();
          const inicioAnio = new Date(anioActual, 0, 1);
          const finAnio = new Date(anioActual, 11, 31, 23, 59, 59, 999);
          setDiasAnioDash(agruparVentasPorDia(ventasDemoRef.current.filter((v) => {
            const f = new Date(v.fecha_hora);
            return f >= inicioAnio && f <= finAnio;
          })));
          const anioRangoDemo = Number(hasta.slice(0, 4));
          setDiasAnioRango(anioRangoDemo === anioActual ? [] : agruparVentasPorDia(ventasDemoRef.current.filter((v) => new Date(v.fecha_hora).getFullYear() === anioRangoDemo)));

          setCargandoDashboard(false);
          return;
        }

        if (sbClient && bodegaId) {
          try {
            // Combos vendidos en el período: el resumen por producto reparte cada
            // combo entre sus componentes, así que se consulta aparte por combo_id.
            // Una venta anulada no cuenta. Si falla, simplemente no se muestra.
            try {
              const { data: filasCombo } = await sbClient
                .from('ventas_detalle')
                .select('combo_id, producto_id, cantidad, subtotal, utilidad, ventas!inner(fecha_hora, anulada, bodega_id)')
                .not('combo_id', 'is', null)
                .eq('ventas.bodega_id', bodegaId)
                .eq('ventas.anulada', false)
                .gte('ventas.fecha_hora', inicio.toISOString())
                .lte('ventas.fecha_hora', fin.toISOString())
                .limit(5000);
              const porCombo = new Map();
              (filasCombo || []).forEach((d) => {
                const g = porCombo.get(d.combo_id) || { monto: 0, utilidad: 0, porProducto: new Map() };
                g.monto += Number(d.subtotal) || 0;
                g.utilidad += Number(d.utilidad) || 0;
                g.porProducto.set(d.producto_id, (g.porProducto.get(d.producto_id) || 0) + (Number(d.cantidad) || 0));
                porCombo.set(d.combo_id, g);
              });
              setCombosVendidos([...porCombo.entries()].map(([id, g]) => {
                const combo = combos.find((c) => c.id === id);
                const base = combo && (combo.combos_items || [])[0];
                const unidades = base && Number(base.cantidad) > 0 ? (g.porProducto.get(base.producto_id) || 0) / Number(base.cantidad) : 0;
                return { id, nombre: combo ? combo.nombre : 'Combo eliminado', unidades: Math.round(unidades * 100) / 100, monto: g.monto, utilidad: g.utilidad };
              }).sort((a, b) => b.monto - a.monto));
            } catch (errCombos) {
              console.warn('No se pudo cargar el resumen de combos', errCombos);
              setCombosVendidos([]);
            }

            const { data: resumen, error: errResumen } = await sbClient.rpc('dashboard_resumen_periodo', {
              p_bodega_id: bodegaId,
              p_desde: desde,
              p_hasta: hasta,
              p_zona: zonaLocal()
            });
            if (!errResumen && resumen && typeof resumen === 'object') {
              setResumenPeriodo(resumen);
            } else {
              // Plan B si la funcion SQL aun no existe: las consultas de
              // siempre (Supabase las corta en 1.000 filas, por eso se prefiere
              // la funcion).
              console.warn('dashboard_resumen_periodo no disponible, se usa la consulta directa', errResumen);
              const { data, error } = await sbClient
                .from('ventas')
                .select('*, ventas_detalle(*)')
                .eq('bodega_id', bodegaId)
                .gte('fecha_hora', inicio.toISOString())
                .lte('fecha_hora', fin.toISOString())
                .order('fecha_hora', { ascending: true });
              if (error) throw error;

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
              setResumenPeriodo(resumirVentasPeriodo(data || [], dataAnterior || []));
            }

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
            const zona = zonaLocal();
            const { data: diasAnio, error: errAnio } = await sbClient.rpc('dashboard_ventas_por_dia', {
              p_bodega_id: bodegaId,
              p_desde: `${anioActual}-01-01`,
              p_hasta: `${anioActual}-12-31`,
              p_zona: zona
            });
            if (!errAnio && Array.isArray(diasAnio)) {
              setDiasAnioDash(diasAnio);
            } else {
              // Plan B si la funcion SQL aun no existe: el SELECT de siempre
              // (Supabase lo corta en 1.000 filas, por eso se prefiere la funcion).
              console.warn('dashboard_ventas_por_dia no disponible, se usa la consulta directa', errAnio);
              const inicioAnio = new Date(anioActual, 0, 1).toISOString();
              const finAnio = new Date(anioActual, 11, 31, 23, 59, 59, 999).toISOString();
              const { data: ventasAnio, error: errAnio2 } = await sbClient
                .from('ventas')
                .select('fecha_hora, total_venta, anulada, medio_pago, monto_efectivo, monto_otro')
                .eq('bodega_id', bodegaId)
                .gte('fecha_hora', inicioAnio)
                .lte('fecha_hora', finAnio);
              if (errAnio2) console.warn(errAnio2);
              setDiasAnioDash(agruparVentasPorDia(ventasAnio || []));
            }

            // Si el rango termina en otro anio, el calendario muestra ese anio.
            const anioRango = Number(hasta.slice(0, 4));
            if (anioRango && anioRango !== anioActual) {
              const { data: diasOtro } = await sbClient.rpc('dashboard_ventas_por_dia', {
                p_bodega_id: bodegaId,
                p_desde: `${anioRango}-01-01`,
                p_hasta: `${anioRango}-12-31`,
                p_zona: zona
              });
              setDiasAnioRango(Array.isArray(diasOtro) ? diasOtro : []);
            } else {
              setDiasAnioRango([]);
            }
          } catch (err) {
            console.warn(err);
            notificar(mensajeError(err, 'No se pudo cargar el dashboard'), 'error');
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


      const dashStats = useMemo(() => {
        const R = resumenPeriodo || resumirVentasPeriodo([], []);
        const totalVenta = Number(R.total) || 0;
        const totalUtilidad = Number(R.utilidad) || 0;
        // utilidad_total ya es total_venta - costo, así que el costo sale despejando.
        const totalCosto = totalVenta - totalUtilidad;
        const numVentas = Number(R.n) || 0;
        const ticketPromedio = numVentas ? totalVenta / numVentas : 0;
        const margenPct = totalVenta ? (totalUtilidad / totalVenta) * 100 : 0;

        const porHora = Array.from({ length: 24 }, (_, h) => ({
          hora: h,
          total: Number(R.por_hora?.[h]?.total) || 0,
          cantidad: Number(R.por_hora?.[h]?.n) || 0
        }));
        const maxHora = Math.max(1, ...porHora.map(h => h.total));
        const horaPico = porHora.reduce((mejor, h) => (h.total > mejor.total ? h : mejor), porHora[0]);

        const porDia = (R.por_dia || []).map(d => ({ fecha: d.fecha, total: Number(d.total) || 0 }));
        const maxDia = Math.max(1, ...porDia.map(d => d.total));

        const porMedio = Object.entries(R.por_medio || {})
          .map(([medio, total]) => ({ medio, total: Number(total) || 0, pct: totalVenta ? ((Number(total) || 0) / totalVenta) * 100 : 0 }))
          .sort((a, b) => b.total - a.total);

        // Las líneas de combo llegan como "Producto (Combo: Nombre)": se suman al
        // producto base para que cada uno salga una sola vez (el detalle de los
        // combos va en su propia sección "Combos vendidos").
        const productosUnidos = new Map();
        (R.top_productos || []).forEach((p) => {
          const descripcion = String(p.descripcion || '').replace(/\s*\(Combo:[^)]*\)\s*$/, '');
          const previo = productosUnidos.get(descripcion) || { descripcion, cantidad: 0, monto: 0, utilidad: 0 };
          previo.cantidad += Number(p.cantidad) || 0;
          previo.monto += Number(p.monto) || 0;
          previo.utilidad += Number(p.utilidad) || 0;
          productosUnidos.set(descripcion, previo);
        });
        const topProductos = [...productosUnidos.values()]
          .map((p) => ({ ...p, monto: +p.monto.toFixed(2), utilidad: +p.utilidad.toFixed(2) }))
          .sort((a, b) => b.monto - a.monto);
        const maxProducto = Math.max(1, ...topProductos.map(p => p.monto));

        const numDeudores = clientesDeuda.length;
        const totalDeuda = clientesDeuda.reduce((a, c) => a + Number(c.saldo_actual || 0), 0);
        const maxDeuda = Math.max(1, ...clientesDeuda.map(c => Number(c.saldo_actual || 0)));

        const numProveedoresDeuda = proveedoresDeudaDash.length;
        const totalPorPagar = proveedoresDeudaDash.reduce((a, c) => a + Number(c.saldo_actual || 0), 0);
        const maxPorPagar = Math.max(1, ...proveedoresDeudaDash.map(c => Number(c.saldo_actual || 0)));

        // Comparación contra el período inmediatamente anterior de igual
        // duración (ej. "últimos 7 días" vs los 7 días previos a esos).
        const totalVentaAnterior = Number(R.anterior?.total) || 0;
        const totalUtilidadAnterior = Number(R.anterior?.utilidad) || 0;
        const cambioVentaPct = calcularCambioPct(totalVenta, totalVentaAnterior);
        const cambioUtilidadPct = calcularCambioPct(totalUtilidad, totalUtilidadAnterior);

        // Ventas por mes del año en curso -- para la sección "Ventas por Mes",
        // independiente del rango de fechas del filtro rápido.
        const anioActual = new Date().getFullYear();
        const porMes = Array.from({ length: 12 }, (_, m) => ({ mes: m, total: 0, cantidad: 0 }));
        diasAnioDash.forEach(d => {
          const m = Number(String(d.fecha).slice(5, 7)) - 1;
          if (!porMes[m]) return;
          porMes[m].total += Number(d.total);
          porMes[m].cantidad += Number(d.n);
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
      }, [resumenPeriodo, clientesDeuda, proveedoresDeudaDash, diasAnioDash]);

      // Exporta todo el Dashboard a un Excel real (.xlsx, varias hojas),
      // no un CSV -- cada sección del dashboard es su propia hoja.
      const exportarDashboardExcel = async () => {
        await asegurarXLSX();
        // El detalle de cada venta del período se pide completo y por tandas de
        // 1.000 (Supabase corta cada consulta en 1.000 filas), solo al exportar.
        notificar('Preparando el Excel...', 'info');
        let ventasDashboard = [];
        try {
          if (esModoDemo) {
            const ini = new Date(`${fechaInicioDash}T00:00:00`);
            const fin = new Date(`${fechaFinDash}T23:59:59.999`);
            ventasDashboard = ventasDemoRef.current.filter((v) => { const f = new Date(v.fecha_hora); return f >= ini && f <= fin; });
          } else {
            const TAM = 1000;
            for (let desdeFila = 0; ; desdeFila += TAM) {
              const { data, error } = await sbClient
                .from('ventas')
                .select('*, ventas_detalle(*)')
                .eq('bodega_id', bodegaId)
                .gte('fecha_hora', new Date(`${fechaInicioDash}T00:00:00`).toISOString())
                .lte('fecha_hora', new Date(`${fechaFinDash}T23:59:59.999`).toISOString())
                .order('fecha_hora', { ascending: true })
                .order('id', { ascending: true })
                .range(desdeFila, desdeFila + TAM - 1);
              if (error) throw error;
              ventasDashboard.push(...(data || []));
              if (!data || data.length < TAM) break;
            }
          }
        } catch (err) {
          notificar(mensajeError(err, 'No se pudo preparar el Excel'), 'error');
          return;
        }
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
          dashStats.porMedio.map((m) => ({ 'Medio de pago': m.medio, 'Porcentaje': +m.pct.toFixed(1), Total: m.total }))
        );
        XLSX.utils.book_append_sheet(libro, hojaMedios, 'Métodos de pago');

        const hojaProductos = XLSX.utils.json_to_sheet(
          dashStats.topProductos.map((p) => ({ Producto: p.descripcion, Cantidad: p.cantidad, Monto: p.monto, Utilidad: p.utilidad }))
        );
        XLSX.utils.book_append_sheet(libro, hojaProductos, 'Top Productos');

        const hojaCobrar = XLSX.utils.json_to_sheet(
          clientesDeuda.length > 0
            ? clientesDeuda.map((c) => ({ Cliente: c.nombre_completo || c.dni, DNI: c.dni, 'Deuda': Number(c.saldo_actual) }))
            : [{ Cliente: 'Sin clientes con deuda pendiente', DNI: '', Deuda: 0 }]
        );
        XLSX.utils.book_append_sheet(libro, hojaCobrar, 'Fiados');

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
            'Medio de pago': v.medio_pago,
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
          'Medio de pago': v.medio_pago,
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
            // Camino nuevo: boleta + deuda + stock en UNA transacción
            // (anular_venta, ver anular_venta_atomica.sql). Si la función aún no
            // existe en Supabase, sigue el camino de siempre (paso a paso).
            const { data: anulada, error: errAnulada } = await sbClient.rpc('anular_venta', {
              p_venta_id: String(venta.id),
              p_motivo: motivo
            });
            const faltaAnular = !!errAnulada && (errAnulada.code === 'PGRST202' || /could not find the function/i.test(errAnulada.message || ''));
            if (errAnulada && !faltaAnular) throw errAnulada;
            if (!errAnulada && anulada?.ya_anulada) {
              notificar(`La boleta ${venta.nro_boleta} ya estaba anulada.`, 'info');
            }
            if (faltaAnular) {
            // Si la venta era a crédito, revertir la deuda del cliente antes de anular
            // (ajuste atómico: no se pisa con otra venta/pago simultáneo al mismo cliente).
            if (venta.medio_pago === 'CREDITO' && venta.cliente_id) {
              const { error: errSaldo } = await sbClient.rpc('ajustar_saldo_cliente', {
                p_cliente_id: venta.cliente_id,
                p_delta: -Number(venta.total_venta)
              });
              if (errSaldo) throw new Error('No se pudo revertir la deuda del cliente.');
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
          }
          setVentasDelDia(prev => prev.map(v => v.id === venta.id ? { ...v, anulada: true, motivo_anulacion: motivo } : v));
          cargarProductos(busqueda); // refresca el stock repuesto en el catálogo
          notificar(`Boleta ${venta.nro_boleta} anulada correctamente.`, 'info');
        } catch (err) {
          notificar(mensajeError(err, 'Error al anular'), 'error');
        }
      };

      // ==========================================
      // ARQUEO Y CIERRE DE CAJA
      // ==========================================
      // Las ventas anuladas no cuentan: ese dinero no entró (o se devolvió).
      // Efectivo que entró en el turno: ventas 100% en efectivo + la parte
      // en efectivo de las ventas Mixtas (ese dinero también entra
      // físicamente a la caja). Se reutiliza al abrir el modal (para
      // mostrar cuánto debería haber antes de contar) y al confirmar el
      // cierre (para el cálculo final, con los datos más frescos).
      const calcularVentasEfectivoTurno = async () => {
        if (!turnoActivo) return 0;
        const vts = esModoDemo
          ? ventasDemoRef.current.filter((v) => v.turno_caja_id === turnoActivo.id && !v.anulada && ['EFECTIVO', 'MIXTO'].includes(v.medio_pago))
          : (sbClient ? (await sbClient
              .from('ventas')
              .select('total_venta, medio_pago, monto_efectivo')
              .eq('turno_caja_id', turnoActivo.id)
              .eq('anulada', false)
              .in('medio_pago', ['EFECTIVO', 'MIXTO'])).data : null);

        return efectivoEntrante(vts);
      };

      // Solo informativo para el arqueo: cuánto se vendió en cada medio que
      // NO es efectivo, para que el cajero pueda cruzarlo contra su POS de
      // tarjeta, Yape, etc. -- no afecta el cálculo de "cuánto debería haber
      // en la caja física", que sigue siendo solo efectivo.
      const calcularDesgloseMedioPagoTurno = async () => {
        if (!turnoActivo) return null;
        const vts = esModoDemo
          ? ventasDemoRef.current.filter((v) => v.turno_caja_id === turnoActivo.id && !v.anulada)
          : (sbClient ? (await sbClient
              .from('ventas')
              .select('total_venta, medio_pago, monto_otro')
              .eq('turno_caja_id', turnoActivo.id)
              .eq('anulada', false)).data : null);

        return desgloseMediosPago(vts);
      };

      // Cambia el conteo de billetes y monedas y deja el total en el campo de
      // monto (el de apertura o el del cierre, según `setMonto`).
      const cambiarConteo = (nuevo, setMonto) => {
        setConteoEfectivo(nuevo);
        const total = totalConteo(nuevo);
        setMonto(total > 0 ? String(total) : '');
      };

      // Cuántas ventas lleva el turno y cuánto se vendió en total (todos los
      // medios de pago) -- solo para mostrar en el cierre.
      const calcularResumenVentasTurno = async () => {
        if (!turnoActivo) return { n: 0, total: 0 };
        const vts = esModoDemo
          ? ventasDemoRef.current.filter((v) => v.turno_caja_id === turnoActivo.id && !v.anulada)
          : (sbClient ? (await sbClient
              .from('ventas')
              .select('total_venta')
              .eq('turno_caja_id', turnoActivo.id)
              .eq('anulada', false)).data : null);
        const lista = Array.isArray(vts) ? vts : [];
        return { n: lista.length, total: lista.reduce((acc, v) => acc + (Number(v.total_venta) || 0), 0) };
      };

      // Abre el modal de cierre ya mostrando cuánto debería haber en caja,
      // para que el cajero sepa qué buscar antes de contar el efectivo.
      const abrirCierreCaja = async () => {
        setModalCierreCaja(true);
        setMontoConteoEfectivo('');
        setConteoEfectivo({});
        setConteoAbierto(false);
        setArqueoEsperado(null);
        if (!turnoActivo) return;
        const montoIni = Number(turnoActivo.monto_inicial) || 0;
        const [ventasEfectivo, desglose, resumenVentas] = await Promise.all([
          calcularVentasEfectivoTurno(),
          calcularDesgloseMedioPagoTurno(),
          calcularResumenVentasTurno()
        ]);
        setArqueoEsperado({
          inicio: montoIni,
          ventas: ventasEfectivo,
          esperado: +(montoIni + ventasEfectivo).toFixed(2),
          desglose,
          cantidadVentas: resumenVentas.n,
          totalVendido: resumenVentas.total
        });
      };

      // Al abrir el modal de apertura: conteo en blanco y, si hay, el monto
      // con el que se cerró la última caja (atajo "lo que quedó al cerrar").
      useEffect(() => {
        if (!modalTurno) return undefined;
        setConteoEfectivo({});
        setConteoAbierto(false);
        if (esModoDemo || !sbClient || !bodegaId) { setUltimoCierre(null); return undefined; }
        let vigente = true;
        (async () => {
          try {
            const { data } = await sbClient
              .from('turnos_caja')
              .select('monto_final_real, fecha_cierre')
              .eq('bodega_id', bodegaId)
              .not('fecha_cierre', 'is', null)
              .order('fecha_cierre', { ascending: false })
              .limit(1);
            const t = data && data[0];
            if (vigente) setUltimoCierre(t && t.monto_final_real !== null && t.monto_final_real !== undefined ? { monto: Number(t.monto_final_real), fecha: t.fecha_cierre } : null);
          } catch (err) {
            if (vigente) setUltimoCierre(null);
          }
        })();
        return () => { vigente = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [modalTurno]);

      useEffect(() => {
        if (cierreAlRetomar && turnoActivo) {
          setCierreAlRetomar(false);
          abrirCierreCaja();
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [cierreAlRetomar, turnoActivo]);

      // Si lo contado no coincide con lo esperado, pide confirmar antes de
      // cerrar (la diferencia queda registrada en el historial de cierres).
      const confirmarCierreConArqueo = async () => {
        if (arqueoEsperado) {
          const dif = diferenciaArqueo(montoConteoEfectivo, arqueoEsperado.esperado);
          if (dif !== 0) {
            const ok = await pedirConfirmacion({
              titulo: `${dif > 0 ? 'Sobran' : 'Faltan'} S/ ${Math.abs(dif).toFixed(2)}: ¿cerrar igual?`,
              mensaje: `Debería haber S/ ${arqueoEsperado.esperado.toFixed(2)} y contaste S/ ${(parseFloat(montoConteoEfectivo) || 0).toFixed(2)}. Al cerrar, la diferencia queda registrada en el historial de cierres.`,
              textoBoton: 'Cerrar de todos modos',
              peligroso: true
            });
            if (!ok) return;
          }
        }
        handleCierreConArqueo();
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
        const dif = diferenciaArqueo(montoReal, esperado);

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
              notificar(`El cierre se calculó bien, pero no se guardó en el servidor. Avisa al soporte.`, 'error');
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
          desglose,
          cajero: turnoActivo.cajeros?.nombre || cajeroSeleccionado?.nombre || '',
          cerradoEn: new Date().toISOString()
        });

        setModalCierreCaja(false);
        setTurnoActivo(null);
        setMontoConteoEfectivo('');
        setConteoEfectivo({});
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
          notificar(mensajeError(err, 'No se pudo cargar el historial de cierres'), 'error');
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
        setAtajoCierres('30dias');
        setSoloConDiferenciaCierres(false);
        setCierreDetalle(null);
        setModalHistorialCierres(true);
        cargarHistorialCierresPorRango(desde, hoy);
      };

      // Atajos de fecha del historial de cierres: Hoy, 7 días, 30 días o fechas a elección.
      const elegirAtajoCierres = (id) => {
        setAtajoCierres(id);
        setCierreDetalle(null);
        if (id === 'fechas') return;
        const hoy = new Date();
        const hasta = fechaISOLocal(hoy);
        const atras = new Date(hoy);
        atras.setDate(atras.getDate() - (id === 'hoy' ? 0 : id === '7dias' ? 6 : 29));
        const desde = fechaISOLocal(atras);
        setFechaInicioCierres(desde);
        setFechaFinCierres(hasta);
        cargarHistorialCierresPorRango(desde, hasta);
      };

      // Turno activo check -- cada cajero puede tener su propia caja
      // abierta (varias registradoras a la vez en la misma bodega). Como
      // todos los dispositivos entran con el mismo usuario/login (el
      // dueño), el cajero que se autoselecciona por DNI no necesariamente
      // es quien de verdad va a operar ESTE dispositivo -- así que, apenas
      // hay alguna caja abierta (sea "la mía" u otra), se muestra siempre
      // la misma lista para elegir con cuál trabajar, en vez de engancharse
      // en silencio a una de ellas.
      // Consulta de turnos abiertos de la bodega. Se puede lanzar antes de saber quién es el
      // cajero (en el arranque va en paralelo con los demás datos) y pasarla a verificarTurno.
      const consultarTurnosAbiertos = () => Promise.resolve(
        sbClient
          .from('turnos_caja')
          .select('*, cajeros(id, bodega_id, nombre, dni, rol, activo)')
          .eq('bodega_id', bodegaId)
          .is('fecha_cierre', null)
          .order('fecha_apertura', { ascending: false })
      );

      const verificarTurno = async (cajeroActual, consultaPrevia = null) => {
        if (!sbClient || !bodegaId || esModoDemo) return;
        try {
          const { data: abiertas } = await (consultaPrevia || consultarTurnosAbiertos());

          // Mi propia caja (del cajero de este dispositivo), si es de hoy y es
          // la única mía: se retoma sola. Sin esto, tras recargar la página
          // el botón decía "Abrir Turno" aunque la caja seguía abierta.
          const propias = (abiertas || []).filter((t) => cajeroActual?.id && t.cajero_id === cajeroActual.id);
          if (propias.length === 1 && !antiguedadTurno(propias[0].fecha_apertura).antiguo) {
            const mia = propias[0];
            setTurnoActivo((previo) => previo || mia);
            if (mia.cajeros) setCajeroSeleccionado((previo) => previo || mia.cajeros);
            if (abiertas.length === 1) return;
          }

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

      // Caja antigua: retomarla (y cerrarla de una vez si se pide) o seguir con ella.
      const retomarTurnoViejo = (cerrar) => {
        const t = avisoTurnoViejo;
        if (!t) return;
        setTurnoActivo(t);
        if (t.cajeros) setCajeroSeleccionado(t.cajeros);
        setAvisoTurnoViejo(null);
        if (cerrar) setCierreAlRetomar(true);
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
              setModalTurno(false);
              const edad = antiguedadTurno(yaAbierto.fecha_apertura);
              if (edad.antiguo) {
                setAvisoTurnoViejo(yaAbierto);
                return;
              }
              setTurnoActivo(yaAbierto);
              notificar(`Ya tenías una caja abierta ${edad.etiqueta}: se retomó esa en vez de abrir otra.`, 'info');
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
              reportarFallo('abrir turno', error);
              // Un rechazo por permisos casi siempre es una sesión vencida: se
              // revisa y, si es eso, se manda a ingresar de nuevo.
              if (error.code === '42501' && !(await verificarSesionVigente())) return;
              notificar(`No se pudo abrir el turno en el servidor. Intenta de nuevo.`, 'error');
              return;
            }
            if (error) {
              notificar('Sin conexión: el turno se abrió localmente y se sincroniza cuando vuelva el internet.', 'info');
            } else {
              notificar('Turno abierto.', 'info');
            }
          } catch (err) {
            console.warn(err);
            reportarFallo('abrir turno', err);
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
        // Barbería: cada cobro lleva el barbero que atendió (de él sale la comisión).
        if (esBarberia && !esModoDemo && !barberoVentaId) {
          notificar('Elige el barbero que atendió antes de cobrar.', 'error');
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
        // Número de boleta correlativo por bodega (siguiente_correlativo, ver
        // concurrencia_ronda2.sql): no se repite aunque dos cajeros cobren a
        // la vez. Si no hay conexión, la función no existe todavía o tarda más
        // de 3 segundos, se usa el número por hora de siempre.
        // La serie es propia de cada bodega (ver serie_boleta_por_bodega.sql)
        // para que dos bodegas distintas no emitan boletas que se vean
        // idénticas -- "B001" queda solo como respaldo si la bodega todavía
        // no tiene serie_boleta cargada (sesión vieja en caché, por ejemplo).
        const serieBoleta = (sesion?.bodega?.serie_boleta || 'B001').toUpperCase();
        let correlativo = `${serieBoleta}-${String(Date.now()).slice(-8)}`;
        if (sbClient && !esModoDemo && enLinea) {
          try {
            const respuestaCorrelativo = await Promise.race([
              sbClient.rpc('siguiente_correlativo', { p_serie: serieBoleta }),
              new Promise((resolver) => setTimeout(() => resolver(null), 3000)),
            ]);
            if (respuestaCorrelativo && !respuestaCorrelativo.error && respuestaCorrelativo.data) {
              correlativo = respuestaCorrelativo.data;
            }
          } catch {
            // se queda con el número por hora
          }
        }

        let seVendioOffline = false;
        // Boleta con la que quedó guardada la venta (si la venta ya existía por un
        // reintento, es la de la primera vez).
        let boletaFinal = correlativo;

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
              monto_otro: medioPago === 'MIXTO' ? montoOtroMixto : 0,
              // Solo barbería (ventas.barbero_id, ver barbero_en_ventas.sql).
              ...(esBarberia && barberoVentaId ? { barbero_id: barberoVentaId } : {})
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

              // id_local: llave única de esta venta offline -- si al sincronizar se
              // pierde la respuesta y se reintenta, la base de datos la reconoce
              // y no la guarda dos veces.
              const idLocal = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              payloadVenta.id_local = idLocal;
              const pendiente = {
                idLocal,
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
              // La misma venta reintentada (por ejemplo, si se cortó internet y no
              // se supo si llegó a guardarse) lleva el mismo id_local, así la base
              // de datos no la duplica. Si el carrito cambió, se genera uno nuevo.
              const huellaVenta = JSON.stringify([
                bodegaId, idTurnoReal || null, medioPago, totalConDescuento, idClienteReal || null,
                payloadDetallesSinVentaId.map((d) => [d.producto_id, d.combo_id, d.cantidad, d.subtotal])
              ]);
              if (!intentoVentaRef.current || intentoVentaRef.current.huella !== huellaVenta) {
                intentoVentaRef.current = { huella: huellaVenta, idLocal: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
              }
              payloadVenta.id_local = intentoVentaRef.current.idLocal;

              const atomica = await registrarVentaAtomica(
                payloadVenta,
                payloadDetallesSinVentaId,
                ajustesStock,
                medioPago === 'CREDITO' && idClienteReal ? { clienteId: idClienteReal, monto: totalConDescuento } : null
              );
              if (!atomica.faltaFuncion) {
                if (atomica.error) throw atomica.error;
                if (atomica.data?.nro_boleta) boletaFinal = atomica.data.nro_boleta;
                intentoVentaRef.current = null;
              } else {
              // Camino de siempre (paso a paso), mientras registrar_venta no exista.
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
                notificar(`Venta registrada, pero el detalle de productos no se guardó. Avisa a soporte.`, 'error');
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
                  notificar(`Venta registrada, pero no se pudo actualizar la deuda del cliente. Avisa al soporte.`, 'error');
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
                notificar(`Venta registrada, pero el stock de ${fallosAjusteStock.length} producto(s) no se pudo actualizar. Revísalo en la búsqueda de productos.`, 'error');
              }
              intentoVentaRef.current = null;
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
            nro_boleta: boletaFinal,
            medio_pago: medioPago,
            total_venta: totalConDescuento,
            subtotal: totalVenta,
            descuento: montoDescuento,
            items: [...carrito],
            cliente: clienteActual?.nombre_completo || 'Desconocido',
            telefono: clienteActual?.telefono || '',
            cajero: cajeroSeleccionado?.nombre || usuarioActivo?.nombre || 'Cajero',
            fecha: new Date().toLocaleTimeString(),
            fecha_hora: new Date().toISOString(),
            recibido: medioPago === 'EFECTIVO' && parseFloat(montoRecibido) > 0 ? parseFloat(montoRecibido) : 0,
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
          setBarberoVentaId(null);
          // Cierra la hoja del carrito (mobile): que la venta exitosa vuelva
          // al catálogo en vez de dejar ver el carrito ya vacío detrás.
          setMostrarResumenMobile(false);
          // Refresca el stock mostrado: solo los productos vendidos, no el catálogo entero.
          if (esModoDemo) cargarProductos(busqueda);
          else if (enLinea) refrescarProductosPorId(carrito.flatMap(expandirLineaCarrito).map((l) => l.productoId));
          // No se usa notificar() aquí: el modal de "¡Venta Exitosa!" ya
          // muestra la boleta y el detalle, un toast encima sería redundante.
        } catch (err) {
          if (/^Stock insuficiente/.test(err.message || '')) {
            // La base rechazó la venta completa (no se guardó nada): se muestra
            // cuánto queda y se refresca el catálogo con el stock real.
            notificar(mensajeError(err), 'error');
            cargarProductos(busqueda);
          } else {
            notificar(mensajeError(err, 'Error al registrar venta'), 'error');
          }
        } finally {
          setProcesandoVenta(false);
        }
      };

      // Genera la boleta como PDF con formato de ticket angosto (80mm),
      // igual al que se usaría en una impresora térmica. Mismo orden que la boleta
      // impresa: negocio, boleta y fecha, tabla de productos, monto y pago.
      const generarPDFBoleta = async (venta) => {
        await asegurarJsPDF();
        const { jsPDF } = window.jspdf;
        const items = venta.items || [];
        const recibido = Number(venta.recibido) || 0;
        const vuelto = recibido >= Number(venta.total_venta) ? recibido - Number(venta.total_venta) : 0;
        const unidades = items.reduce((a, it) => a + (Number(it.cantidad) || 0), 0);
        const alturaEstimada = 78 + items.length * 11 + items.reduce((a, it) => a + detalleComboTicket(it).length * 3.4, 0)
          + (venta.descuento > 0 ? 10 : 0) + (recibido > 0 ? 8 : 0) + (bodegaDireccion ? 4 : 0) + (bodegaTelefono ? 4 : 0) + (venta.cajero ? 4 : 0);
        const doc = new jsPDF({ unit: 'mm', format: [80, Math.max(110, alturaEstimada)] });
        let y = 8;

        const punteada = (x1, x2) => {
          if (doc.setLineDashPattern) doc.setLineDashPattern([1.2, 1.2], 0);
          doc.line(x1, y, x2, y);
          if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
        };
        // Línea de corte: punteada, con una muesca redonda en cada borde del papel.
        const corte = () => {
          punteada(5, 75);
          doc.setFillColor(255, 255, 255);
          doc.circle(0, y, 2.4, 'FD');
          doc.circle(80, y, 2.4, 'FD');
          y += 5;
        };
        const rotulo = (txt, x, yy, opciones) => {
          doc.setFont(undefined, 'bold');
          doc.setFontSize(6);
          doc.text(txt.toUpperCase(), x, yy, opciones);
        };

        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text(bodegaNombre, 40, y, { align: 'center' });
        y += 5;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(7);
        if (bodegaDireccion) { doc.text(doc.splitTextToSize(bodegaDireccion, 70)[0], 40, y, { align: 'center' }); y += 3.6; }
        if (bodegaTelefono) { doc.text(`Tel. ${bodegaTelefono}`, 40, y, { align: 'center' }); y += 3.6; }
        y += 1.4;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);
        doc.text('¡Gracias por su compra!', 40, y, { align: 'center' });
        y += 4.5;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(7.5);
        doc.text('Tu boleta se emitió correctamente', 40, y, { align: 'center' });
        y += 5;

        corte();
        rotulo('Boleta', 4, y);
        rotulo('Fecha y hora', 76, y, { align: 'right' });
        y += 4;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);
        doc.text(String(venta.nro_boleta), 4, y);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        doc.text(formatoFechaHoraBoleta(venta.fecha_hora), 76, y, { align: 'right' });
        y += 5;
        doc.setFontSize(7.5);
        doc.text(`Cliente: ${doc.splitTextToSize(String(venta.cliente), 62)[0]}`, 4, y);
        y += 3.8;
        if (venta.cajero) { doc.text(`Atendido por: ${doc.splitTextToSize(String(venta.cajero), 54)[0]}`, 4, y); y += 3.8; }
        y += 1.5;

        corte();

        // Tabla: Cant | Producto | Importe
        rotulo('Cant', 4, y);
        rotulo('Producto', 12, y);
        rotulo('Importe', 76, y, { align: 'right' });
        y += 1.8;
        doc.line(4, y, 76, y);
        y += 4;
        items.forEach((it) => {
          doc.setFont(undefined, 'normal');
          doc.setFontSize(8);
          doc.text(String(it.cantidad), 4, y);
          const lineas = doc.splitTextToSize(it.descripcion, 48);
          doc.text(lineas, 12, y);
          doc.text(Number(it.subtotal).toFixed(2), 76, y, { align: 'right' });
          y += lineas.length * 3.6;
          doc.setFontSize(6.5);
          doc.text(`${Number(it.precioUnitario || 0).toFixed(2)} c/u${it.unidad && it.unidad !== 'UND' ? ` (${it.unidad})` : ''}`, 12, y);
          y += 3.2;
          detalleComboTicket(it).forEach((l) => {
            const sub = doc.splitTextToSize(`· ${l}`, 46);
            doc.text(sub, 13, y);
            y += sub.length * 3;
          });
          y += 2;
        });

        punteada(4, 76);
        y += 4;
        rotulo(`${unidades} ${unidades === 1 ? 'artículo' : 'artículos'}`, 4, y);
        y += 4;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        if (venta.descuento > 0) {
          doc.text('Subtotal', 4, y); doc.text(`S/ ${venta.subtotal.toFixed(2)}`, 76, y, { align: 'right' }); y += 4;
          doc.text('Descuento', 4, y); doc.text(`-S/ ${venta.descuento.toFixed(2)}`, 76, y, { align: 'right' }); y += 5;
        }

        rotulo('Monto', 4, y);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(14);
        doc.text(`S/ ${venta.total_venta.toFixed(2)}`, 76, y, { align: 'right' });
        y += 5;

        // Recuadro del pago (y recibido / vuelto si fue en efectivo)
        const filasPago = recibido > 0 ? 3 : 1;
        doc.roundedRect(4, y, 72, filasPago * 4 + 3, 2, 2, 'S');
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        const medioPagoTxt = String(venta.medio_pago || '');
        let yy = y + 4.2;
        doc.text('Pago', 7, yy); doc.text(medioPagoTxt.charAt(0).toUpperCase() + medioPagoTxt.slice(1).toLowerCase(), 73, yy, { align: 'right' });
        if (recibido > 0) {
          yy += 4; doc.text('Recibido', 7, yy); doc.text(`S/ ${recibido.toFixed(2)}`, 73, yy, { align: 'right' });
          yy += 4; doc.text('Vuelto', 7, yy); doc.text(`S/ ${vuelto.toFixed(2)}`, 73, yy, { align: 'right' });
        }
        y += filasPago * 4 + 8;

        corte();

        doc.setFont(undefined, 'normal');
        doc.setFontSize(7);
        const disclaimer = doc.splitTextToSize(
          'Documento sin valor tributario. No válido como comprobante de pago ante SUNAT. Solo informativo.',
          72
        );
        doc.text(disclaimer, 40, y, { align: 'center' });

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
      // negrita), igual de angosto que el PDF/ticket impreso y con el mismo orden.
      const construirTicketEscPos = (venta) => {
        const bytes = [];
        const cmd = (...arr) => bytes.push(...arr);
        const texto = (s) => { for (const ch of aTextoImprimible(s)) bytes.push(ch.charCodeAt(0) & 0xFF); };
        const salto = (n = 1) => { for (let i = 0; i < n; i++) bytes.push(0x0A); };
        const ANCHO = 32; // caracteres por línea en una ticketera de 58mm
        const lineaPunteada = () => { texto('- '.repeat(ANCHO / 2)); salto(); };
        // Dos columnas: texto a la izquierda y valor pegado a la derecha.
        const dosColumnas = (izq, der) => {
          const i = aTextoImprimible(izq), d = aTextoImprimible(der);
          texto(i + ' '.repeat(Math.max(1, ANCHO - i.length - d.length)) + d); salto();
        };
        const recibido = Number(venta.recibido) || 0;
        const unidades = (venta.items || []).reduce((a, it) => a + (Number(it.cantidad) || 0), 0);

        cmd(0x1B, 0x40); // inicializar
        cmd(0x1B, 0x61, 0x01); // centrado
        cmd(0x1B, 0x45, 0x01); // negrita on
        texto(bodegaNombre); salto();
        cmd(0x1B, 0x45, 0x00); // negrita off
        if (bodegaDireccion) { texto(bodegaDireccion.slice(0, ANCHO)); salto(); }
        if (bodegaTelefono) { texto(`Tel. ${bodegaTelefono}`); salto(); }
        cmd(0x1B, 0x45, 0x01);
        texto('Gracias por su compra!'); salto();
        cmd(0x1B, 0x45, 0x00);
        texto('Tu boleta se emitio correctamente'); salto();
        cmd(0x1B, 0x61, 0x00); // izquierda
        lineaPunteada();
        dosColumnas('BOLETA', String(venta.nro_boleta));
        dosColumnas('FECHA Y HORA', formatoFechaHoraBoleta(venta.fecha_hora));
        texto(`Cliente: ${venta.cliente}`.slice(0, ANCHO)); salto();
        if (venta.cajero) { texto(`Atendido por: ${venta.cajero}`.slice(0, ANCHO)); salto(); }
        lineaPunteada();

        // Tabla: CANT PRODUCTO ... IMPORTE
        dosColumnas('CANT PRODUCTO', 'IMPORTE');
        (venta.items || []).forEach((it) => {
          const importe = Number(it.subtotal).toFixed(2);
          const nombre = aTextoImprimible(it.descripcion).slice(0, ANCHO - 4 - importe.length - 1);
          dosColumnas(`${String(it.cantidad).padEnd(3)} ${nombre}`, importe);
          texto(`    ${Number(it.precioUnitario || 0).toFixed(2)} c/u`); salto();
          detalleComboTicket(it).forEach((l) => { texto('    - ' + l.slice(0, ANCHO - 6)); salto(); });
        });

        lineaPunteada();
        texto(`${unidades} ${unidades === 1 ? 'articulo' : 'articulos'}`); salto();
        if (venta.descuento > 0) {
          dosColumnas('Subtotal', `S/ ${venta.subtotal.toFixed(2)}`);
          dosColumnas('Descuento', `-S/ ${venta.descuento.toFixed(2)}`);
        }
        cmd(0x1B, 0x45, 0x01);
        dosColumnas('MONTO', `S/ ${venta.total_venta.toFixed(2)}`);
        cmd(0x1B, 0x45, 0x00);
        dosColumnas('Pago', String(venta.medio_pago || ''));
        if (recibido > 0) {
          dosColumnas('Recibido', `S/ ${recibido.toFixed(2)}`);
          dosColumnas('Vuelto', `S/ ${(recibido >= Number(venta.total_venta) ? recibido - Number(venta.total_venta) : 0).toFixed(2)}`);
        }
        lineaPunteada();

        cmd(0x1B, 0x61, 0x01);
        texto('Documento sin valor tributario.'); salto();
        texto('Solo informativo.'); salto(4);

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
          notificar(mensajeError(err, 'No se pudo imprimir por Bluetooth'), 'error');
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
        return <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-400 text-sm">
            Cargando panel de administrador...
          </div>
        }>
          <PanelAdmin
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
            try { await sbClient.auth.signOut({ scope: 'local' }); } catch (err) { console.warn(err); }
            setAdminSesion(null);
            setBodegasAdmin([]);
          }}
          />
        </Suspense>;
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
                src="/logo-horizontal-sobre-morado.svg"
                width="2068"
                height="642"
                alt="Kaserita"
                className="relative w-60 md:w-80 h-auto mb-5"
                style={{ animation: 'auth-panel-in 0.5s ease' }}
              />
              <p className="lema-kaserita relative" style={{ animation: 'auth-panel-in 0.5s ease' }}>Tu negocio <b>bajo</b> control</p>

            </div>

            {/* Tarjeta de formulario */}
            <div className="relative flex-1 md:w-1/2 flex md:items-center justify-center md:px-5">
              <div
                className={`w-full md:max-w-md flex-1 md:flex-none bg-white rounded-t-[2.5rem] md:rounded-3xl shadow-2xl px-7 pt-9 pb-10 md:p-10 space-y-6 transition-all duration-300 ease-out ${revelarLogin ? 'opacity-100 translate-x-0' : 'opacity-0 md:translate-x-10'}`}
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
                    notificar(mensajeError(err), 'error');
                  } finally {
                    setCargandoAuth(false);
                  }
                }} className="space-y-5">
                  {mostrarAccesoPin && (<>
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">Tu DNI</label>
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
                      <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">PIN de acceso</label>
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
                    {cargandoAuth ? 'Verificando...' : (<>Entrar <i className="fa-solid fa-arrow-right"></i></>)}
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-stone-200"></div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase">o</span>
                    <div className="flex-1 h-px bg-stone-200"></div>
                  </div>
                  </>)}
                  <button
                    type="button"
                    onClick={() => sbClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/pos', queryParams: { prompt: 'select_account' } } })}
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
                    notificar(mensajeError(err), 'error');
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
                <h2 className="text-lg font-black text-stone-900">Tu cuenta venció</h2>
                <p className="text-xs text-stone-500 mt-1">
                  El acceso de <strong>{bodegaNombre}</strong> está desactivado
                  {sesion.bodega.activa === false
                    ? ''
                    : sesion.bodega.activa_hasta
                    ? ` desde el ${new Date(`${sesion.bodega.activa_hasta}T00:00:00`).toLocaleDateString('es-PE')}`
                    : ''}.
                  Escribe a soporte de Kaserita para renovarlo.
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
          className={`relative fondo-pos-grano flex h-screen text-stone-900 font-sans select-none overflow-hidden ${(!enLinea || ventasPendientesSync.length > 0) ? 'pt-7' : ''}`}
          style={{ background: '#F8F6FD' }}
        >
          {/* Fondo "aurora violeta": tres masas de color muy difuminadas (fijas,
              sin animación) + una cuadrícula técnica sutil que se desvanece
              hacia el centro. El grano de siempre (.fondo-pos-grano::after) va
              encima de todo esto. Decorativo -- aria-hidden y sin clics. */}
          <div className="aurora-pos" aria-hidden="true">
            <div className="aurora-mancha aurora-mancha-1"></div>
            <div className="aurora-mancha aurora-mancha-2"></div>
            <div className="aurora-mancha aurora-mancha-3"></div>
          </div>
          <div className="aurora-grid" aria-hidden="true"></div>

          {/* Toast */}
          {toast.visible && (
            <div className={`fixed top-[4.75rem] inset-x-4 md:top-4 md:inset-x-auto md:right-4 md:max-w-xs z-[100] pointer-events-none flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border-l-4 bg-white text-xs font-semibold ${toast.tipo === 'error' ? 'border-rose-500 text-rose-700' : 'border-emerald-500 text-emerald-700'}`}>
              <i className={`fa-solid ${toast.tipo === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-sm shrink-0`}></i>
              {toast.texto}
            </div>
          )}

          {versionNueva && !avisoVersionOculto && (
            <div role="status" className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:max-w-sm z-[95] flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-[#e9e6f0] shadow-2xl">
              <i className="fa-solid fa-rotate text-[#6105dc] shrink-0"></i>
              <p className="text-[13px] text-stone-700 leading-snug flex-1">Hay una versión nueva de Kaserita. Actualiza cuando termines esta venta.</p>
              <button type="button" onClick={() => window.location.reload()} className="kz-pri h-9 px-4 text-[13px] font-semibold shrink-0">Actualizar</button>
              <button type="button" aria-label="Ocultar aviso" onClick={() => setAvisoVersionOculto(true)} className="w-7 h-7 rounded-full text-stone-400 hover:text-stone-700 shrink-0"><i className="fa-solid fa-xmark"></i></button>
            </div>
          )}

          {/* Caja abierta de un día anterior: el cierre mezclaría las ventas de varios días */}
          {turnoActivo && !modalCierreCaja && antiguedadTurno(turnoActivo.fecha_apertura).antiguo && (
            <div className="fixed top-0 inset-x-0 z-[85] bg-amber-500 text-white text-xs font-semibold py-1.5 px-3 flex items-center justify-center gap-2 flex-wrap text-center" role="alert">
              <i className="fa-solid fa-triangle-exclamation"></i>
              Tu caja lleva abierta {antiguedadTurno(turnoActivo.fecha_apertura).etiqueta.replace('hace ', '')}: el cierre sumará las ventas de todos esos días.
              <button onClick={abrirCierreCaja} className="underline font-bold">Cerrar caja ahora</button>
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
              <div className="flex items-center gap-3 min-w-0 max-w-full pl-1">
                <img src="/logo-horizontal-color.svg" width="2068" height="642" alt="Kaserita" className="h-7 md:h-8 w-auto shrink-0" />
                <span className="w-px h-[30px] bg-[#6105dc]/20 shrink-0"></span>
                <div className="min-w-0">
                  <h1 className="text-sm md:text-[15px] font-bold text-[#1c1830] leading-tight tracking-tight truncate">{bodegaNombre}</h1>
                  <p className="text-xs text-[#78729a] truncate leading-tight mt-px">
                    {cajeroSeleccionado?.nombre || usuarioActivo?.nombre}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {turnoActivo ? (
                  <button
                    onClick={abrirCierreCaja}
                    className="btn-noise btn-noise-verde hidden sm:inline-flex text-xs font-medium text-green-700"
                  >
                    <span className="btn-noise-in">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Turno Abierto
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => setModalTurno(true)}
                    className="btn-noise hidden sm:inline-flex text-xs font-medium text-[#1c1830]"
                  >
                    <span className="btn-noise-in">
                      Abrir Turno
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="btn-noise-flecha w-3.5 h-3.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </span>
                  </button>
                )}
                {/* Celular: el botón "Turno Abierto / Abrir Turno" no cabe, así que queda un ícono de caja con un punto de estado */}
                <button
                  onClick={turnoActivo ? abrirCierreCaja : () => setModalTurno(true)}
                  className="sm:hidden relative w-10 h-10 flex items-center justify-center bg-white border border-stone-200 rounded-xl text-stone-700 shadow-sm transition"
                  aria-label={turnoActivo ? 'Turno abierto. Toca para cerrar la caja' : 'Turno cerrado. Toca para abrir turno'}
                >
                  <i className="fa-solid fa-cash-register text-[15px]"></i>
                  <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${turnoActivo ? 'bg-green-500' : 'bg-amber-400'}`}></span>
                </button>
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
                      {combos.filter(c => c.activo && estadoCombos.get(c.id)?.disponible !== false).length}
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
                  <div className="flex gap-2.5 flex-1 min-w-0 items-center">
                    {/* Una sola pastilla: lupa, campo, resultados, limpiar y cámara.
                        El borde violeta se enciende cuando el campo tiene el foco. */}
                    <div className="flex-1 min-w-0 flex items-center gap-2.5 h-[46px] md:h-[50px] pl-4 md:pl-[18px] pr-1.5 md:pr-2 bg-white border border-[#e4dff0] rounded-full shadow-[0_1px_2px_rgba(40,10,100,0.04),0_8px_22px_-14px_rgba(60,4,150,0.28)] transition focus-within:border-[#6105dc] focus-within:ring-4 focus-within:ring-[#6105dc]/10 focus-within:shadow-[0_10px_26px_-12px_rgba(97,5,220,0.4)] group/bus">
                      <i className="fa-solid fa-magnifying-glass text-[15px] text-[#8f89a8] group-focus-within/bus:text-[#6105dc] transition shrink-0"></i>
                      <input
                        ref={inputBusquedaRef}
                        type="text"
                        value={busqueda}
                        onChange={(e) => {
                          setBusqueda(e.target.value);
                          // En la pestaña Combos la búsqueda daba "0 resultados" para cualquier producto: se pasa a Todos.
                          if (e.target.value && categoriaFiltro === '__COMBOS__') setCategoriaFiltro('TODOS');
                        }}
                        onKeyDown={handleKeyDownBusqueda}
                        placeholder="Busca por nombre o escanea un código"
                        className="flex-1 min-w-0 bg-transparent text-[14px] md:text-[15px] font-medium text-stone-900 placeholder:text-[#9a94b3] placeholder:font-normal focus:outline-none"
                      />
                      {busqueda && (
                        <>
                          <span className="hidden sm:inline-flex shrink-0 text-xs font-bold text-[#4d04b0] bg-[#f1e9fe] rounded-full px-2.5 py-1.5 tabular-nums">
                            {productosFiltrados.length} {productosFiltrados.length === 1 ? 'resultado' : 'resultados'}
                          </span>
                          <button aria-label="Limpiar búsqueda"
                            onClick={() => {
                              setBusqueda('');
                              cargarProductos('');
                              inputBusquedaRef.current?.blur();
                            }}
                            className="shrink-0 w-[30px] h-[30px] flex items-center justify-center bg-[#f3f1f8] hover:bg-[#e9e5f3] text-[#6b6585] rounded-full transition"
                          ><i className="fa-solid fa-xmark text-xs"></i></button>
                        </>
                      )}
                      <button
                        onClick={abrirEscanerParaVenta}
                        title="Escanear código de barras con la cámara"
                        aria-label="Escanear código de barras con la cámara"
                        className="kz-pri shrink-0 flex items-center justify-center w-10 h-10 rounded-full"
                      >
                        <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
                      </button>
                    </div>
                    <button
                      onClick={abrirPedidosRetirar}
                      title="Pedidos por retirar (clientes con cuenta)"
                      aria-label="Pedidos por retirar"
                      className="relative flex items-center justify-center w-[46px] h-[46px] md:w-[50px] md:h-[50px] shrink-0 bg-white hover:bg-[#f4eefe] text-[#4b4565] rounded-full border border-[#e4dff0] shadow-[0_1px_2px_rgba(40,10,100,0.04),0_8px_22px_-14px_rgba(60,4,150,0.28)] transition"
                    >
                      <i className="fa-solid fa-bell-concierge text-[17px]"></i>
                      {pedidosPorRetirarPendientes > 0 ? (
                        <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 flex items-center justify-center bg-rose-600 text-white text-[10px] font-bold rounded-full border-2 border-white animate-pulse">
                          {pedidosPorRetirarPendientes > 9 ? '9+' : pedidosPorRetirarPendientes}
                        </span>
                      ) : pedidosListosSinCargar > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 flex items-center justify-center bg-emerald-600 text-white text-[10px] font-bold rounded-full border-2 border-white">
                          {pedidosListosSinCargar > 9 ? '9+' : pedidosListosSinCargar}
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
                      {combos.filter(c => c.activo).map((combo) => {
                        const est = estadoCombos.get(combo.id) || { disponible: true, faltan: [], unidades: Infinity };
                        return (
                        <button
                          key={combo.id}
                          disabled={!est.disponible}
                          onClick={() => {
                            if ((cantidadEnCarritoPorCombo.get(combo.id) || 0) + 1 > est.unidades) {
                              notificar(`No hay stock para más de ${est.unidades} de este combo.`, 'error');
                              return;
                            }
                            agregarComboAlCarrito(combo);
                          }}
                          className={`text-left bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 relative p-3 flex flex-col gap-1.5 ${
                            !est.disponible
                              ? 'border-stone-200 opacity-60 grayscale cursor-not-allowed'
                              : (cantidadEnCarritoPorCombo.get(combo.id) || 0) > 0
                                ? 'border-[#6105dc] ring-2 ring-[#6105dc]/40 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]'
                                : 'border-[#d6bdfa] hover:border-[#7c1fe0] hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]'
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
                          {!est.disponible && (
                            <p className="text-[10px] font-bold text-rose-600 line-clamp-2">Sin stock: {est.faltan.join(', ')}</p>
                          )}
                          <div className="flex items-center justify-between mt-auto pt-1">
                            <span className="text-base font-black text-[#4d04b0] tabular-nums">S/ {Number(combo.precio_venta).toFixed(2)}</span>
                            {(cantidadEnCarritoPorCombo.get(combo.id) || 0) > 0 && (
                              <span className="text-[10px] font-bold text-white bg-[#6105dc] px-2 py-0.5 rounded-full">x{cantidadEnCarritoPorCombo.get(combo.id)}</span>
                            )}
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  )
                ) : cargandoProductos && productos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-stone-600 gap-2">
                    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs">Cargando productos...</p>
                  </div>
                ) : productos.length === 0 && !busqueda.trim() ? (
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
                    {(hayMasEnGrid ? productosFiltrados.slice(0, limiteGrid) : productosFiltrados).map((prod) => (
                      <ProductoCard
                        key={prod.id}
                        prod={prod}
                        esAdmin={esAdmin}
                        enCarrito={cantidadEnCarritoPorProducto.get(prod.id) || 0}
                        onSelect={handleClicProducto}
                        onEdit={abrirEdicionProducto}
                        tieneCombo={productosEnCombo.has(prod.id)}
                        onVerCombo={verCombosDesdeTarjeta}
                      />
                    ))}
                    {hayMasEnGrid && <div ref={centinelaGridRef} className="col-span-full h-10" aria-hidden="true"></div>}
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>

          {/* Barra flotante del carrito (solo mobile, cuando hay productos y el panel está cerrado) */}
          {carrito.length > 0 && !mostrarResumenMobile && (() => {
            const unidades = carrito.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
            const unidadesTexto = Number.isInteger(unidades) ? String(unidades) : String(+unidades.toFixed(2));
            const ultimos = carrito.slice(-2);
            return (
              <>
                <div className="md:hidden fixed inset-x-0 bottom-0 h-28 z-30 pointer-events-none bg-gradient-to-t from-[#f9f8fb] via-[#f9f8fb]/70 to-transparent"></div>
                <button
                  onClick={() => setMostrarResumenMobile(true)}
                  aria-label={`Ver carrito: ${unidadesTexto} ${unidades === 1 ? 'producto' : 'productos'}, total S/ ${formatoSoles(totalConDescuento)}`}
                  className="kz-pri kz-barra-carrito md:hidden !fixed left-3 right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 h-[66px] flex items-center justify-between gap-3 pl-3 pr-2.5"
                >
                  <span className="flex items-center min-w-0">
                    {/* Fotos de lo último que se agregó, apiladas */}
                    <span className="flex items-center shrink-0 pr-1">
                      {ultimos.map((item, i) => (
                        <FotoProducto
                          key={item.claveCarrito || item.productoId}
                          fotoUrl={item.foto_url}
                          categoria={item.categoria}
                          className={`w-9 h-9 rounded-full ring-2 ring-white/90 bg-white shrink-0 ${i > 0 ? '-ml-3' : ''}`}
                          iconClassName="text-xs"
                        />
                      ))}
                      {carrito.length > 2 && (
                        <span className="-ml-3 w-9 h-9 rounded-full ring-2 ring-white/90 bg-[#3a1b94] text-white text-[11px] font-bold tabular-nums flex items-center justify-center shrink-0">+{carrito.length - 2}</span>
                      )}
                    </span>
                    <span className="ml-2.5 text-left leading-tight min-w-0 whitespace-nowrap">
                      <span className="block font-bold text-[15px] tracking-tight">Ver carrito</span>
                      <span key={unidadesTexto} className="kz-barra-pop block text-[12px] text-stone-500 font-medium tabular-nums">{unidadesTexto} {unidades === 1 ? 'producto' : 'productos'}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2.5 shrink-0">
                    <span className="text-right leading-tight">
                      <span className="block text-[11px] text-stone-500 font-medium">Total</span>
                      <span className="block font-bold text-[19px] tracking-tight tabular-nums"><small className="text-xs font-semibold opacity-80 mr-0.5">S/</small>{formatoSoles(totalConDescuento)}</span>
                    </span>
                    <span className="flex items-center justify-center w-11 h-11 rounded-full bg-[#6105dc] text-white shrink-0 shadow-[0_4px_10px_-4px_rgba(60,5,170,0.6)]">
                      <IconoTrazo nombre="bag" className="w-5 h-5 !text-white" />
                    </span>
                  </span>
                </button>
              </>
            );
          })()}

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
              <button aria-label="Cerrar" onClick={() => setModalPedidosRetirar(false)} className="text-stone-600 hover:text-stone-900 text-lg"><i className="fa-solid fa-xmark"></i></button>
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
                  const esDomicilioPedido = p.tipo_entrega === 'domicilio';
                  const envioPedido = esDomicilioPedido ? Number(p.costo_envio || 0) : 0;
                  const totalPedido = (p.items || []).reduce(
                    (acc, it) => acc + Number(it.cantidad || 0) * Number(it.precio_venta || 0),
                    0
                  ) + envioPedido;
                  const esHistorial = p.estado === 'retirado' || p.estado === 'cancelado';
                  const yaEnCarrito = pedidosCargadosAlCarrito.some((c) => c.id === p.id);
                  const estadoInfo = {
                    pendiente: { texto: 'Pendiente', color: 'text-amber-600', dot: 'bg-amber-500' },
                    listo: { texto: 'Listo', color: 'text-emerald-600', dot: 'bg-emerald-500' },
                    en_camino: { texto: 'En camino', color: 'text-[#6105dc]', dot: 'bg-[#6105dc]' },
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
                        {(p.items || []).map((it, i) => {
                          const desglose = desgloseComboPedido(it);
                          return (
                            <div key={i} className="py-1.5 text-xs">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="text-stone-500 truncate">
                                  <span className="text-stone-400">{it.cantidad} ×</span> {it.descripcion}
                                </span>
                                <span className="text-stone-500 tabular-nums shrink-0">
                                  {(Number(it.cantidad || 0) * Number(it.precio_venta || 0)).toFixed(2)}
                                </span>
                              </div>
                              {desglose.length > 0 && (
                                <ul className="mt-1 ml-1 pl-2.5 border-l-2 border-stone-100 space-y-0.5">
                                  {desglose.map((c, j) => (
                                    <li key={j} className="text-[11px] text-stone-400 truncate">
                                      <span className="tabular-nums">{c.cantidad} ×</span> {c.descripcion}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {p.cita_fecha && (
                        <div className="rounded-lg bg-[#f4eefe] px-3 py-2 text-xs">
                          <p className="font-semibold text-[#4d04b0]">
                            Cita: {(() => {
                              const [a, m, d] = String(p.cita_fecha).split('-').map(Number);
                              const t = new Date(a, m - 1, d).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
                              return t.charAt(0).toUpperCase() + t.slice(1);
                            })()} · {p.cita_hora}
                          </p>
                          <p className="text-stone-500">Barbero: {p.cita_barbero || 'Cualquiera'}</p>
                        </div>
                      )}

                      {esDomicilioPedido && (
                        <div className="rounded-lg bg-[#f4eefe] px-3 py-2 space-y-1 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 font-semibold text-[#4d04b0]">
                              <IconoTrazo nombre="moto" className="w-3.5 h-3.5" /> A domicilio
                            </span>
                            <span className="text-stone-500 tabular-nums">Envío S/ {envioPedido.toFixed(2)}</span>
                          </div>
                          <p className="text-stone-800">{p.entrega_referencia}</p>
                          <p className="text-stone-500">
                            Tel. {p.telefono_contacto}
                            {p.medio_pago && (
                              <>
                                {' · Paga al recibir: '}
                                {{ efectivo: 'efectivo', yape_plin: 'Yape / Plin', tarjeta: 'tarjeta' }[p.medio_pago] || p.medio_pago}
                                {p.medio_pago === 'efectivo' && Number(p.paga_con) > 0 && ` (con S/ ${Number(p.paga_con).toFixed(2)}, vuelto S/ ${Math.max(0, Number(p.paga_con) - totalPedido).toFixed(2)})`}
                              </>
                            )}
                          </p>
                        </div>
                      )}

                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] text-stone-400">{esDomicilioPedido ? 'Total a cobrar (con envío)' : 'Total'}</span>
                        <span className="text-sm font-semibold text-stone-900 tabular-nums">S/ {totalPedido.toFixed(2)}</span>
                      </div>

                      {esDomicilioPedido && !esHistorial && p.entrega_lat != null && p.entrega_lng != null && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => enviarPedidoAlRepartidor(p)}
                            className="flex-1 py-2 rounded-lg bg-[#6105dc] hover:bg-[#4d04b0] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                          >
                            <IconoTrazo nombre="chat" className="w-3.5 h-3.5" /> Enviar al repartidor
                          </button>
                          <a
                            href={`https://www.google.com/maps?q=${p.entrega_lat},${p.entrega_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 rounded-lg bg-[#f4eefe] hover:bg-[#ece0fd] text-[#4d04b0] text-xs font-semibold flex items-center gap-1.5 transition"
                          >
                            <IconoTrazo nombre="ubicacion" className="w-3.5 h-3.5" /> Ver mapa
                          </a>
                        </div>
                      )}
                      {esDomicilioPedido && (p.estado === 'pendiente' || p.estado === 'listo') && (
                        <button
                          onClick={() => marcarPedidoEnCamino(p.id)}
                          disabled={procesando}
                          className="w-full py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold disabled:opacity-50 transition"
                        >
                          Marcar en camino
                        </button>
                      )}

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
                          {esDomicilioPedido ? 'Confirmar entrega' : 'Confirmar retiro'}
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
                          {(p.estado === 'listo' || p.estado === 'en_camino') && (
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
                  className="md:hidden flex items-center gap-1.5 pl-3 pr-2 py-2.5 rounded-full ring-1 ring-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-700 transition"
                >
                  En espera
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                    {ventasEnEspera.length}
                  </span>
                </button>
                {carrito.length > 0 && (
                  <button
                    onClick={aparcarVentaActual}
                    className="px-3.5 py-2.5 md:py-1.5 rounded-full bg-[#f4eefe] hover:bg-[#ece0fd] text-xs text-[#4d04b0] font-semibold transition"
                  >
                    Pausar
                  </button>
                )}
                {carrito.length > 0 && (
                  <button
                    onClick={async () => {
                      // Con varias líneas se pregunta antes: un toque sin querer borraría toda la venta.
                      if (carrito.length > 1) {
                        const ok = await pedirConfirmacion({ titulo: 'Vaciar el carrito', mensaje: `Se quitarán los ${carrito.length} productos de esta venta.`, textoBoton: 'Sí, vaciar', peligroso: true });
                        if (!ok) return;
                      }
                      avisarPedidosDevueltos(); setCarrito([]); setDescuentoTipo(null); setDescuentoValor(''); setMostrarPago(false); reiniciarClienteYMedioPago(); setPedidosCargadosAlCarrito([]);
                    }}
                    className="px-3.5 py-2.5 md:py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-xs text-rose-700 font-semibold transition"
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
            {pedidosPorRetirarPendientes === 0 && pedidosListosSinCargar > 0 && (
              <button
                onClick={abrirPedidosRetirar}
                className="shrink-0 mx-3 mt-2.5 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition text-left"
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white shrink-0">
                  <i className="fa-solid fa-bell-concierge text-xs"></i>
                </span>
                <span className="flex-1 text-xs font-bold text-emerald-800">
                  {pedidosListosSinCargar === 1
                    ? '1 pedido listo, falta entregarlo y cobrarlo'
                    : `${pedidosListosSinCargar} pedidos listos, falta entregarlos y cobrarlos`}
                </span>
                <i className="fa-solid fa-chevron-right text-xs text-emerald-600"></i>
              </button>
            )}
            {pedidosPorRetirarPendientes > 0 && (
              <button
                onClick={abrirPedidosRetirar}
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

            {/* Solo barbería: quién atendió. Se elige antes de cobrar y se limpia
                después de cada venta. */}
            {esBarberia && (
              <div className="shrink-0 mx-3 mt-2.5">
                <p className="text-[11px] font-semibold text-stone-500 mb-1">Barbero que atendió</p>
                <div className="flex flex-wrap gap-1.5">
                  {listaCajeros.filter((c) => c.activo !== false).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setBarberoVentaId(barberoVentaId === c.id ? null : c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${barberoVentaId === c.id ? 'bg-[#6105dc] text-white' : 'bg-[#f4eefe] text-[#4d04b0] hover:bg-[#ece0fd]'}`}
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lista Ítems */}
            {/* Celular al cobrar: la lista se achica (unas 2 filas) para dejar espacio a los medios de pago */}
            <div className={`overflow-y-auto p-2.5 space-y-1.5 hide-scrollbar ${mostrarPago ? 'max-h-[22vh] pb-2.5 md:max-h-none md:flex-1 md:pb-16' : 'flex-1 pb-16'}`}>
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
                        className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-[#6105dc] hover:bg-[#f4eefe] rounded-full transition"
                        aria-label="Quitar uno"
                      >
                        <IconoTrazo nombre="minus" className="w-3.5 h-3.5" />
                      </button>
                      <span className="min-w-[18px] text-center text-[13px] font-bold text-stone-900 tabular-nums">
                        {item.cantidad}
                      </span>
                      <button
                        onClick={() => cambiarCantidadCarrito(item.claveCarrito || item.productoId, 1)}
                        className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-[#6105dc] hover:bg-[#f4eefe] rounded-full transition"
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
              className={`relative z-10 p-4 space-y-3 min-h-0 overflow-y-auto overscroll-contain ${mostrarPago
                ? 'pt-4 scroll-pb-44 bg-white border-t border-[#efe6fc] shadow-[0_-14px_26px_-20px_rgba(40,20,100,0.4)]'
                : '-mt-10 pt-14 backdrop-blur-xl bg-gradient-to-b from-white/60 to-white/90'}`}
              style={mostrarPago ? undefined : { WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 44px)', maskImage: 'linear-gradient(to bottom, transparent 0, black 44px)' }}
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
                        : 'kz-pri'
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
                className="self-start flex items-center gap-1 pl-2 pr-3 py-1.5 rounded-full bg-[#f4eefe] hover:bg-[#ece0fd] text-[13px] font-semibold text-[#4d04b0] transition"
              >
                <IconoTrazo nombre="back" className="w-[15px] h-[15px]" /> Volver
              </button>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'EFECTIVO', icono: 'efectivo', texto: 'Efectivo' },
                  { id: 'YAPE', icono: 'movil', texto: 'Yape' },
                  { id: 'PLIN', icono: 'movil', texto: 'Plin' },
                  { id: 'TARJETA', icono: 'tarjeta', texto: 'Tarjeta' },
                  { id: 'CREDITO', icono: 'credito', texto: 'Crédito' },
                  { id: 'MIXTO', icono: 'mixto', texto: 'Mixto' }
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
                    className={`flex flex-col items-center gap-1.5 pt-3 pb-2.5 text-[12.5px] font-semibold rounded-[20px] transition ${
                      medioPago === m.id
                        ? 'bg-[#6105dc] text-white'
                        : 'bg-[#f4eefe] hover:bg-[#ece0fd] text-stone-600'
                    }`}
                  >
                    <IconoTrazo nombre={m.icono} className={`w-5 h-5 ${medioPago === m.id ? 'text-white' : 'text-[#6105dc]'}`} />
                    {m.texto}
                  </button>
                ))}
              </div>

              {medioPago === 'EFECTIVO' && (
                <div data-campo-pago className="bg-[#f4eefe] border border-[#efe6fc] rounded-[22px] p-3.5">
                  <label className="text-xs font-semibold text-[#4d04b0] block mb-2">Paga con</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-14 flex items-center gap-1.5 px-4 rounded-[18px] bg-white ring-1 ring-[#6105dc]/10 focus-within:ring-2 focus-within:ring-[#6105dc]/40">
                      <span className="text-[15px] font-semibold text-stone-400">S/</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        placeholder="0.00"
                        className="w-full min-w-0 bg-transparent text-[28px] font-bold tracking-tight text-stone-900 tabular-nums placeholder:text-[#c4bfd0] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCampoTeclado(campoTeclado === 'recibido' ? null : 'recibido')}
                      title="Teclado numérico"
                      className={`shrink-0 w-14 h-14 flex items-center justify-center rounded-[18px] ring-1 ring-[#6105dc]/10 transition ${campoTeclado === 'recibido' ? 'bg-[#6105dc] text-white' : 'bg-white text-[#6105dc] hover:bg-[#faf8fe]'}`}
                    >
                      <IconoTrazo nombre="calc" className="w-[22px] h-[22px]" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {[
                      { t: 'Exacto', v: totalConDescuento },
                      ...[50, 100, 200].filter((n) => n >= totalConDescuento).map((n) => ({ t: `S/ ${n}`, v: n }))
                    ].map((c) => (
                      <button
                        key={c.t}
                        type="button"
                        onClick={() => setMontoRecibido(String(+Number(c.v).toFixed(2)))}
                        className="px-3.5 py-1.5 rounded-full bg-white ring-1 ring-[#6105dc]/10 hover:bg-[#faf8fe] text-[12.5px] font-semibold text-[#4d04b0] transition"
                      >
                        {c.t}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#6105dc]/10">
                    <span className="text-xs font-semibold text-[#4d04b0]">Vuelto</span>
                    <span className={`text-[26px] font-bold tracking-tight tabular-nums ${vuelto < 0 ? 'text-rose-600' : 'text-green-700'}`}>
                      S/ {vuelto > 0 ? vuelto.toFixed(2) : '0.00'}
                    </span>
                  </div>
                  {campoTeclado === 'recibido' && <NumericKeypad value={montoRecibido} onChange={asignarDesdeTeclado} />}
                </div>
              )}

              {(medioPago === 'YAPE' || medioPago === 'PLIN') && (
                <button
                  type="button"
                  onClick={() => setMedioQR(medioPago)}
                  className="w-full h-[50px] flex items-center justify-center gap-2 rounded-full bg-white ring-1 ring-[#6105dc]/15 hover:bg-[#faf8fe] text-sm font-semibold text-[#4d04b0] transition"
                >
                  <IconoTrazo nombre="qr" className="w-[18px] h-[18px]" /> Mostrar QR de {medioPago === 'YAPE' ? 'Yape' : 'Plin'}
                </button>
              )}

              {medioPago === 'TARJETA' && (
                <div className="bg-[#f4eefe] border border-[#efe6fc] rounded-[22px] p-3.5 text-center text-[13px] font-semibold text-[#4d04b0]">
                  Cobro exacto con tarjeta: S/ {totalConDescuento.toFixed(2)}
                </div>
              )}

              {medioPago === 'CREDITO' && (
                <div className="bg-[#f4eefe] border border-[#efe6fc] rounded-[22px] p-3.5">
                  <div className="flex items-center gap-2.5 bg-white rounded-[18px] ring-1 ring-[#6105dc]/10 px-3 py-2.5">
                    <span className="w-[34px] h-[34px] rounded-full bg-[#ece0fd] text-[#4d04b0] text-xs font-bold flex items-center justify-center shrink-0">
                      {(!clienteActual || clienteActual.dni === '99999999')
                        ? '?'
                        : (clienteActual.nombre_completo || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0 text-[13.5px] font-semibold text-stone-900">
                      <p className="truncate">
                        {(!clienteActual || clienteActual.dni === '99999999') ? 'Sin cliente asignado' : clienteActual.nombre_completo}
                      </p>
                      <p className={`text-xs font-medium truncate ${(!clienteActual || clienteActual.dni === '99999999') ? 'text-rose-600' : 'text-stone-500'}`}>
                        {(!clienteActual || clienteActual.dni === '99999999')
                          ? 'Asigna un cliente registrado para vender a crédito.'
                          : `Disponible S/ ${Math.max(0, (Number(clienteActual.limite_credito) || 0) - (Number(clienteActual.saldo_actual) || 0)).toFixed(2)} de S/ ${(Number(clienteActual.limite_credito) || 0).toFixed(2)}`}
                      </p>
                    </div>
                    <button type="button" onClick={abrirBuscarClientePOS} className="shrink-0 px-3 py-1.5 rounded-full bg-[#f4eefe] hover:bg-[#ece0fd] text-[12.5px] font-semibold text-[#6105dc] transition">
                      Cambiar
                    </button>
                  </div>
                  {clienteActual && clienteActual.dni !== '99999999' && Number(clienteActual.limite_credito) > 0 && (
                    <div className="h-2 rounded-full bg-[#e2d4fb] mt-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#6105dc]"
                        style={{ width: `${Math.min(100, Math.max(0, ((Number(clienteActual.saldo_actual) || 0) / Number(clienteActual.limite_credito)) * 100))}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}

              {medioPago === 'MIXTO' && (
                <div data-campo-pago className="bg-[#f4eefe] border border-[#efe6fc] rounded-[22px] p-3.5">
                  <label className="text-xs font-semibold text-[#4d04b0] block mb-2">Monto en tarjeta / otro</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[50px] flex items-center gap-1.5 px-4 rounded-[18px] bg-white ring-1 ring-[#6105dc]/10 focus-within:ring-2 focus-within:ring-[#6105dc]/40">
                      <span className="text-sm font-semibold text-stone-400">S/</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={montoMixtoOtro}
                        onChange={(e) => setMontoMixtoOtro(e.target.value)}
                        placeholder="0.00"
                        className="w-full min-w-0 bg-transparent text-[22px] font-bold tracking-tight text-stone-900 tabular-nums placeholder:text-[#c4bfd0] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCampoTeclado(campoTeclado === 'mixtoOtro' ? null : 'mixtoOtro')}
                      title="Teclado numérico"
                      className={`shrink-0 w-[50px] h-[50px] flex items-center justify-center rounded-[18px] ring-1 ring-[#6105dc]/10 transition ${campoTeclado === 'mixtoOtro' ? 'bg-[#6105dc] text-white' : 'bg-white text-[#6105dc] hover:bg-[#faf8fe]'}`}
                    >
                      <IconoTrazo nombre="calc" className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#6105dc]/10">
                    <span className="text-xs font-semibold text-[#4d04b0]">Falta en efectivo</span>
                    <span className="text-[22px] font-bold tracking-tight tabular-nums text-stone-900">S/ {efectivoRequeridoMixto.toFixed(2)}</span>
                  </div>

                  {efectivoRequeridoMixto > 0 && (
                    <>
                      <label className="text-xs font-semibold text-[#4d04b0] block mt-3 mb-2">Recibe en efectivo</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-[50px] flex items-center gap-1.5 px-4 rounded-[18px] bg-white ring-1 ring-[#6105dc]/10 focus-within:ring-2 focus-within:ring-[#6105dc]/40">
                          <span className="text-sm font-semibold text-stone-400">S/</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={montoMixtoRecibido}
                            onChange={(e) => setMontoMixtoRecibido(e.target.value)}
                            placeholder="0.00"
                            className="w-full min-w-0 bg-transparent text-[22px] font-bold tracking-tight text-stone-900 tabular-nums placeholder:text-[#c4bfd0] focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setCampoTeclado(campoTeclado === 'mixtoRecibido' ? null : 'mixtoRecibido')}
                          title="Teclado numérico"
                          className={`shrink-0 w-[50px] h-[50px] flex items-center justify-center rounded-[18px] ring-1 ring-[#6105dc]/10 transition ${campoTeclado === 'mixtoRecibido' ? 'bg-[#6105dc] text-white' : 'bg-white text-[#6105dc] hover:bg-[#faf8fe]'}`}
                        >
                          <IconoTrazo nombre="calc" className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#6105dc]/10">
                    <span className="text-xs font-semibold text-[#4d04b0]">Vuelto</span>
                    <span className={`text-[22px] font-bold tracking-tight tabular-nums ${vueltoMixto < 0 ? 'text-rose-600' : 'text-green-700'}`}>
                      S/ {vueltoMixto > 0 ? vueltoMixto.toFixed(2) : '0.00'}
                    </span>
                  </div>

                  {(campoTeclado === 'mixtoOtro' || campoTeclado === 'mixtoRecibido') && (
                    <NumericKeypad value={valorTeclado} onChange={asignarDesdeTeclado} />
                  )}
                </div>
              )}

              <div>
                {!descuentoTipo ? (
                  carrito.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setDescuentoTipo('PORCENTAJE'); setDescuentoValor(''); }}
                      className="flex items-center gap-1.5 text-[13px] text-[#6105dc] hover:text-[#4d04b0] font-semibold transition"
                    >
                      <IconoTrazo nombre="etiqueta" className="w-[15px] h-[15px]" /> Aplicar descuento
                    </button>
                  )
                ) : (
                  <div className="bg-[#f4eefe] border border-[#efe6fc] rounded-[22px] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#4d04b0]">Descuento</span>
                      <button
                        type="button"
                        onClick={() => { setDescuentoTipo(null); setDescuentoValor(''); }}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-white rounded-full ring-1 ring-[#6105dc]/10 p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDescuentoTipo('PORCENTAJE')}
                          className={`w-10 h-9 rounded-full text-xs font-bold transition ${descuentoTipo === 'PORCENTAJE' ? 'bg-[#6105dc] text-white' : 'text-stone-500'}`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setDescuentoTipo('MONTO')}
                          className={`w-10 h-9 rounded-full text-xs font-bold transition ${descuentoTipo === 'MONTO' ? 'bg-[#6105dc] text-white' : 'text-stone-500'}`}
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
                        className="w-full h-[44px] bg-white ring-1 ring-[#6105dc]/10 rounded-[16px] px-4 text-base font-bold text-stone-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#6105dc]/40"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Total y botón de cobro siempre a la vista: si las opciones de pago no
                  caben en pantallas bajas, lo de arriba hace scroll y esto se queda abajo. */}
              <div className="sticky bottom-0 -mx-4 -mb-4 px-4 pb-4 pt-3 space-y-3 bg-white shadow-[0_-12px_18px_-14px_rgba(40,20,100,0.28)]">
              <div className="bg-[#f4eefe] border border-[#efe6fc] rounded-[22px] px-4 py-3 space-y-1.5">
                {montoDescuento > 0 && (
                  <>
                    <div className="flex items-center justify-between text-[12.5px] text-stone-500">
                      <span>Subtotal</span>
                      <span className="tabular-nums">S/ {totalVenta.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12.5px] text-rose-600 font-semibold">
                      <span>Descuento</span>
                      <span className="tabular-nums">- S/ {montoDescuento.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className={`flex items-baseline justify-between ${montoDescuento > 0 ? 'pt-2 border-t border-[#6105dc]/10' : ''}`}>
                  <span className="text-xs font-semibold text-[#4d04b0]">Total a cobrar</span>
                  <span className="text-[28px] font-bold tracking-tight text-stone-900 tabular-nums">
                    <small className="text-sm text-stone-500 font-semibold mr-1">S/</small>{formatoSoles(totalConDescuento)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCobrar}
                disabled={procesandoVenta || carrito.length === 0 || !turnoActivo}
                className={`w-full h-[54px] rounded-full font-semibold text-base transition-all flex items-center justify-center gap-2 ${
                  !turnoActivo || procesandoVenta || carrito.length === 0
                    ? 'bg-[#ebe8f1] text-[#8b869a] cursor-not-allowed'
                    : 'kz-pri'
                }`}
              >
                {!turnoActivo ? (
                  <><IconoTrazo nombre="warn" className="w-[18px] h-[18px]" /> Abre un turno para cobrar</>
                ) : procesandoVenta ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Registrando venta...</>
                ) : medioPago === 'CREDITO' ? (
                  <><IconoTrazo nombre="credito" className="w-[19px] h-[19px]" /> Registrar venta a crédito</>
                ) : (
                  <><IconoTrazo nombre="recibo" className="w-[19px] h-[19px]" /> Cobrar e imprimir boleta</>
                )}
              </button>
              </div>
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
              { grupo: 'Ventas y caja', etiqueta: 'Fiados', buscar: 'cuentas por cobrar deudas credito', icono: 'fa-hand-holding-dollar', accion: abrirModuloCobroDeudas },
              { grupo: 'Ventas y caja', etiqueta: 'Historial', icono: 'fa-receipt', accion: abrirHistorialDelDia },
              { grupo: 'Ventas y caja', etiqueta: 'Clientes', icono: 'fa-users', accion: abrirGestionClientes },
              !esBarberia && { grupo: 'Inventario', etiqueta: 'Toma de Inventario', icono: 'fa-clipboard-check', accion: abrirTomaInventario },
              { grupo: 'Inventario', etiqueta: 'Registrar pérdida', buscar: 'merma perdida vencido roto robo', icono: 'fa-box', accion: () => setModalMerma(true) },
              ...(esAdmin ? [
                { grupo: 'Administración', etiqueta: 'Dashboard de Ventas', icono: 'fa-chart-pie', accion: abrirDashboard },
                !esBarberia && { grupo: 'Administración', etiqueta: 'Cuentas por Pagar', icono: 'fa-file-invoice', accion: abrirCuentasPorPagar },
                { grupo: 'Administración', etiqueta: esBarberia ? 'Barberos' : 'Cajeros y Empleados', icono: 'fa-user-group', accion: abrirGestionCajeros },
                esBarberia && { grupo: 'Administración', etiqueta: 'Comisiones de barberos', icono: 'fa-percent', accion: abrirComisiones },
                esBarberia && { grupo: 'Administración', etiqueta: 'Agenda de citas', icono: 'fa-calendar-days', accion: abrirAgenda },
                { grupo: 'Administración', etiqueta: 'Registro de actividad', icono: 'fa-clipboard-check', accion: abrirAuditoria },
                { grupo: 'Administración', etiqueta: 'Mi Link de Pedidos', icono: 'fa-share-nodes', accion: abrirModalDelivery },
                { grupo: 'Entradas', etiqueta: esBarberia ? 'Registrar Servicios y Productos' : 'Registrar Productos', icono: 'fa-boxes-stacked', accion: () => setModalInventarioInicial(true) },
                !esBarberia && { grupo: 'Entradas', etiqueta: 'Entrada de Mercadería', icono: 'fa-truck-ramp-box', accion: abrirEntradaMercaderia },
                { grupo: 'Catálogo', etiqueta: 'Combos', icono: 'fa-gift', accion: abrirModalCombos },
              ] : []),
              // El manual solo lo sirve /api/manual a quien tiene sesión: antes de abrirlo se
              // renueva el token por si venció, y la pestaña se abre primero para que el
              // navegador no la bloquee como ventana emergente.
              !esModoDemo && {
                grupo: 'Cuenta', etiqueta: 'Manual de uso', icono: 'fa-circle-question',
                accion: () => {
                  const pestana = window.open('', '_blank');
                  Promise.resolve(sbClient?.auth.getSession()).catch(() => {}).finally(() => {
                    if (pestana) pestana.location.href = '/manual';
                    else window.open('/manual', '_blank');
                  });
                }
              },
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
            const visibles = q ? opcionesMenu.filter((o) => normalizar(`${o.etiqueta} ${o.grupo} ${o.buscar || ''}`).includes(q)) : opcionesMenu;
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

          {modalEscaner && (
            <Suspense fallback={null}>
              <EscanerCamara
                IconoTrazo={IconoTrazo}
                actualizarPendienteConteo={actualizarPendienteConteo}
                agregarHallazgo={agregarHallazgo}
                camarasDisponibles={camarasDisponibles}
                cambiarCamara={cambiarCamara}
                cambiarCantidadCarrito={cambiarCantidadCarrito}
                carrito={carrito}
                destelloEscaner={destelloEscaner}
                editandoPackParaId={editandoPackParaId}
                errorEscaner={errorEscaner}
                filasTomaInventario={filasTomaInventario}
                formatoSoles={formatoSoles}
                inputBusquedaRef={inputBusquedaRef}
                listaEscaneada={listaEscaneada}
                modalEscaner={modalEscaner}
                modoEscaner={modoEscaner}
                productoEscaneadoId={productoEscaneadoId}
                productos={productos}
                quitarHallazgo={quitarHallazgo}
                setEditandoPackParaId={setEditandoPackParaId}
                setModalEscaner={setModalEscaner}
                setMostrarResumenMobile={setMostrarResumenMobile}
                totalConDescuento={totalConDescuento}
                videoNativoRef={videoNativoRef}
              />
            </Suspense>
          )}

          {modalInventarioInicial && (
            <Suspense fallback={null}>
              <InventarioInicial
                abrirEscanerParaFilaInventario={abrirEscanerParaFilaInventario}
                actualizarCodigoEanFila={actualizarCodigoEanFila}
                actualizarCodigoEanPackFila={actualizarCodigoEanPackFila}
                actualizarFilaInventario={actualizarFilaInventario}
                agregarCategoriaPersonalizada={agregarCategoriaPersonalizada}
                categoriasDB={categoriasDB}
                desvincularFilaInventario={desvincularFilaInventario}
                eliminarFilaInventario={eliminarFilaInventario}
                esBarberia={esBarberia}
                filaInventarioExpandidaIdx={filaInventarioExpandidaIdx}
                filasInventario={filasInventario}
                guardandoInventario={guardandoInventario}
                guardarInventarioInicial={guardarInventarioInicial}
                modalInventarioInicial={modalInventarioInicial}
                notificar={notificar}
                pasoInventario={pasoInventario}
                productos={productos}
                sesion={sesion}
                setFilaInventarioExpandidaIdx={setFilaInventarioExpandidaIdx}
                setFilasInventario={setFilasInventario}
                setModalInventarioInicial={setModalInventarioInicial}
                setPasoInventario={setPasoInventario}
                subiendoFotoFilaIdx={subiendoFotoFilaIdx}
                subirFotoFilaInventario={subirFotoFilaInventario}
                sugerenciasMaestroParaFila={sugerenciasMaestroParaFila}
                sugerenciasParaFila={sugerenciasParaFila}
                sugerenciasParaFilaPack={sugerenciasParaFilaPack}
                usarSugerenciaMaestraEnFila={usarSugerenciaMaestraEnFila}
                vincularProductoExistenteEnFila={vincularProductoExistenteEnFila}
              />
            </Suspense>
          )}

          {modalCombos && (
            <Suspense fallback={null}>
              <CombosModal
                actualizarCantidadItemCombo={actualizarCantidadItemCombo}
                agregarProductoAFormCombo={agregarProductoAFormCombo}
                alternarActivoCombo={alternarActivoCombo}
                aplicarDescuentoRapidoCombo={aplicarDescuentoRapidoCombo}
                aplicarPrecioCombo={aplicarPrecioCombo}
                buscarProductoPorCodigo={buscarProductoPorCodigo}
                busquedaCombos={busquedaCombos}
                busquedaProductoCombo={busquedaProductoCombo}
                cargandoCombos={cargandoCombos}
                carrito={carrito}
                cerrarEditorCombo={cerrarEditorCombo}
                cerrarModalCombos={cerrarModalCombos}
                combos={combos}
                costoNormalCombo={costoNormalCombo}
                duplicarCombo={duplicarCombo}
                editarCombo={editarCombo}
                eliminarCombo={eliminarCombo}
                esBarberia={esBarberia}
                estadoCombos={estadoCombos}
                filtroCombos={filtroCombos}
                formCombo={formCombo}
                formComboOriginal={formComboOriginal}
                guardandoCombo={guardandoCombo}
                guardarCombo={guardarCombo}
                modalCombos={modalCombos}
                notificar={notificar}
                nuevoCombo={nuevoCombo}
                precioNormalCombo={precioNormalCombo}
                productos={productos}
                quitarItemCombo={quitarItemCombo}
                resaltadoProductoCombo={resaltadoProductoCombo}
                setBusquedaCombos={setBusquedaCombos}
                setBusquedaProductoCombo={setBusquedaProductoCombo}
                setFiltroCombos={setFiltroCombos}
                setFormCombo={setFormCombo}
                setResaltadoProductoCombo={setResaltadoProductoCombo}
                snapshotCombo={snapshotCombo}
              />
            </Suspense>
          )}

          {modalMerma && (
            <Suspense fallback={null}>
              <MermaModal
                IconoTrazo={IconoTrazo}
                abrirEscanerParaMerma={abrirEscanerParaMerma}
                buscarProductoPorCodigo={buscarProductoPorCodigo}
                busquedaMerma={busquedaMerma}
                cerrarModalMerma={cerrarModalMerma}
                elegirProductoMerma={elegirProductoMerma}
                formMerma={formMerma}
                guardandoMerma={guardandoMerma}
                modalMerma={modalMerma}
                productos={productos}
                registrarMermaProducto={registrarMermaProducto}
                setBusquedaMerma={setBusquedaMerma}
                setFormMerma={setFormMerma}
                formatoSoles={formatoSoles}
              />
            </Suspense>
          )}

          {/* Modal: Toma de Inventario (conteo físico vs. sistema) -- 2 pasos:
              "conteo" (se busca y anota lo contado, sin ver el stock del
              sistema) y "revision" (recién ahí se compara y se guarda, lo
              que ajusta el stock automáticamente si hay diferencia). */}
          {modalTomaInventario && (
            <Suspense fallback={null}>
              <TomaInventario
                PestanasModal={PestanasModal}
                abrirHistorialInventario={abrirHistorialInventario}
                actualizarPendienteConteo={actualizarPendienteConteo}
                actualizarStockContado={actualizarStockContado}
                agregarHallazgo={agregarHallazgo}
                agregarProductoAConteo={agregarProductoAConteo}
                categoriasDB={categoriasDB}
                conteoFisicoBusqueda={conteoFisicoBusqueda}
                continuarARevisionInventario={continuarARevisionInventario}
                editandoPackParaId={editandoPackParaId}
                filasTomaInventario={filasTomaInventario}
                filasTomaInventarioVisibles={filasTomaInventarioVisibles}
                guardandoTomaInventario={guardandoTomaInventario}
                guardarTomaInventario={guardarTomaInventario}
                historialConteoAbierto={historialConteoAbierto}
                modalTomaInventario={modalTomaInventario}
                pasoTomaInventario={pasoTomaInventario}
                productos={productos}
                promoverAActivoConteo={promoverAActivoConteo}
                quitarHallazgo={quitarHallazgo}
                quitarProductoDeConteo={quitarProductoDeConteo}
                refsPendientesConteo={refsPendientesConteo}
                resultadosBusquedaConteo={resultadosBusquedaConteo}
                setConteoFisicoBusqueda={setConteoFisicoBusqueda}
                setEditandoPackParaId={setEditandoPackParaId}
                setHistorialConteoAbierto={setHistorialConteoAbierto}
                setMetodoForzado={setMetodoForzado}
                setModalEscaner={setModalEscaner}
                setModalTomaInventario={setModalTomaInventario}
                setModoEscaner={setModoEscaner}
                setPasoTomaInventario={setPasoTomaInventario}
                setTomaInventarioBusqueda={setTomaInventarioBusqueda}
                setTomaInventarioCategoria={setTomaInventarioCategoria}
                tomaInventarioBusqueda={tomaInventarioBusqueda}
                tomaInventarioCategoria={tomaInventarioCategoria}
                vaciarConteoInventario={vaciarConteoInventario}
              />
            </Suspense>
          )}

          {modalEditarProducto && formEditarProducto && (
            <Suspense fallback={null}>
              <EditarProducto
                agregarCategoriaPersonalizada={agregarCategoriaPersonalizada}
                categoriasDB={categoriasDB}
                combos={combos}
                desactivarProducto={desactivarProducto}
                esBarberia={esBarberia}
                formEditarOriginal={formEditarOriginal}
                formEditarProducto={formEditarProducto}
                guardandoEdicionProducto={guardandoEdicionProducto}
                guardarEdicionProducto={guardarEdicionProducto}
                modalEditarProducto={modalEditarProducto}
                pedirConfirmacion={pedirConfirmacion}
                productos={productos}
                quitarFotoExtra={quitarFotoExtra}
                sesion={sesion}
                setFormEditarProducto={setFormEditarProducto}
                setMetodoForzado={setMetodoForzado}
                setModalEditarProducto={setModalEditarProducto}
                setModalEscaner={setModalEscaner}
                setModoEscaner={setModoEscaner}
                setTabEditarProducto={setTabEditarProducto}
                subiendoFotoExtra={subiendoFotoExtra}
                subiendoFotoProducto={subiendoFotoProducto}
                subirFotoExtraProducto={subirFotoExtraProducto}
                subirFotoProducto={subirFotoProducto}
                tabEditarProducto={tabEditarProducto}
              />
            </Suspense>
          )}

          {modalEntradaMercaderia && (
            <Suspense fallback={null}>
              <EntradaMercaderia
                abrirProductoNuevoEntrada={abrirProductoNuevoEntrada}
                agregarItemEntradaMercaderia={agregarItemEntradaMercaderia}
                buscarProductoPorCodigo={buscarProductoPorCodigo}
                busquedaCompra={busquedaCompra}
                cambiarTipoEntrada={cambiarTipoEntrada}
                categoriasDB={categoriasDB}
                cerrarModalEntradaMercaderia={cerrarModalEntradaMercaderia}
                compraCabecera={compraCabecera}
                compraItemTemp={compraItemTemp}
                compraItems={compraItems}
                crearProductoInlineCompra={crearProductoInlineCompra}
                editarLineaEntrada={editarLineaEntrada}
                elegirProductoEntrada={elegirProductoEntrada}
                entradaRegistrada={entradaRegistrada}
                filtroCompra={filtroCompra}
                guardandoEntrada={guardandoEntrada}
                guardandoProductoInlineCompra={guardandoProductoInlineCompra}
                guardarEntradaMercaderia={guardarEntradaMercaderia}
                idsNuevosCompra={idsNuevosCompra}
                modalEntradaMercaderia={modalEntradaMercaderia}
                nuevoProductoInlineCompra={nuevoProductoInlineCompra}
                pedirCerrarEntrada={pedirCerrarEntrada}
                productos={productos}
                proveedoresLista={proveedoresLista}
                quitarItemEntradaMercaderia={quitarItemEntradaMercaderia}
                resaltadoCompra={resaltadoCompra}
                setBusquedaCompra={setBusquedaCompra}
                setCompraCabecera={setCompraCabecera}
                setCompraItemTemp={setCompraItemTemp}
                setEntradaRegistrada={setEntradaRegistrada}
                setFiltroCompra={setFiltroCompra}
                setMetodoForzado={setMetodoForzado}
                setModalEscaner={setModalEscaner}
                setModoEscaner={setModoEscaner}
                setNuevoProductoInlineCompra={setNuevoProductoInlineCompra}
                setResaltadoCompra={setResaltadoCompra}
              />
            </Suspense>
          )}

          {modalCobrarDeudas && (
            <Suspense fallback={null}>
              <FiadosModal
                IconoTrazo={IconoTrazo}
                boletasDeudores={boletasDeudores}
                busquedaDeudores={busquedaDeudores}
                cargandoDetalleDeudor={cargandoDetalleDeudor}
                cargandoDeudores={cargandoDeudores}
                clientesDeudores={clientesDeudores}
                confirmandoPagoDeudor={confirmandoPagoDeudor}
                descargarEstadoCuenta={descargarEstadoCuenta}
                deudorSeleccionado={deudorSeleccionado}
                enviarEstadoCuentaWhatsApp={enviarEstadoCuentaWhatsApp}
                estadoDeudorSel={estadoDeudorSel}
                etiquetaCuandoTurno={etiquetaCuandoTurno}
                filtroDeudores={filtroDeudores}
                formatoSoles={formatoSoles}
                hojaPagoDeudor={hojaPagoDeudor}
                listaCajeros={listaCajeros}
                modalCobrarDeudas={modalCobrarDeudas}
                montoAbonoDeuda={montoAbonoDeuda}
                mostrarHistorialCompletoDeuda={mostrarHistorialCompletoDeuda}
                ordenDeudores={ordenDeudores}
                pagoRegistrado={pagoRegistrado}
                pagosRecientes={pagosRecientes}
                procesarPagoDeudaCliente={procesarPagoDeudaCliente}
                seleccionarDeudor={seleccionarDeudor}
                setBoletasDeudor={setBoletasDeudor}
                setBusquedaDeudores={setBusquedaDeudores}
                setConfirmandoPagoDeudor={setConfirmandoPagoDeudor}
                setDeudorSeleccionado={setDeudorSeleccionado}
                setFiltroDeudores={setFiltroDeudores}
                setHojaPagoDeudor={setHojaPagoDeudor}
                setModalCobrarDeudas={setModalCobrarDeudas}
                setMontoAbonoDeuda={setMontoAbonoDeuda}
                setMostrarHistorialCompletoDeuda={setMostrarHistorialCompletoDeuda}
                setOrdenDeudores={setOrdenDeudores}
                setPagoRegistrado={setPagoRegistrado}
              />
            </Suspense>
          )}

          {modalCuentasPagar && (
            <Suspense fallback={null}>
              <CuentasPagar
                modalCuentasPagar={modalCuentasPagar}
                montoMovimientoProveedor={montoMovimientoProveedor}
                proveedorSeleccionado={proveedorSeleccionado}
                proveedoresLista={proveedoresLista}
                registrarMovimientoProveedor={registrarMovimientoProveedor}
                setModalCuentasPagar={setModalCuentasPagar}
                setModalNuevoProveedor={setModalNuevoProveedor}
                setMontoMovimientoProveedor={setMontoMovimientoProveedor}
                setProveedorSeleccionado={setProveedorSeleccionado}
              />
            </Suspense>
          )}

          {modalNuevoProveedor && (
            <Suspense fallback={null}>
              <NuevoProveedor
                formProveedor={formProveedor}
                handleGuardarNuevoProveedor={handleGuardarNuevoProveedor}
                modalNuevoProveedor={modalNuevoProveedor}
                setFormProveedor={setFormProveedor}
                setModalNuevoProveedor={setModalNuevoProveedor}
              />
            </Suspense>
          )}

          {modalHistorialCierres && (
            <Suspense fallback={null}>
              <HistorialCierres
                abrirHistorialDelDia={abrirHistorialDelDia}
                atajoCierres={atajoCierres}
                cargandoCierres={cargandoCierres}
                cargarHistorialCierresPorRango={cargarHistorialCierresPorRango}
                cierreDetalle={cierreDetalle}
                cierresCaja={cierresCaja}
                elegirAtajoCierres={elegirAtajoCierres}
                etiquetaDiaHistorial={etiquetaDiaHistorial}
                fechaFinCierres={fechaFinCierres}
                fechaInicioCierres={fechaInicioCierres}
                formatoSoles={formatoSoles}
                modalHistorialCierres={modalHistorialCierres}
                setCierreDetalle={setCierreDetalle}
                setFechaFinCierres={setFechaFinCierres}
                setFechaInicioCierres={setFechaInicioCierres}
                setModalHistorialCierres={setModalHistorialCierres}
                setSoloConDiferenciaCierres={setSoloConDiferenciaCierres}
                soloConDiferenciaCierres={soloConDiferenciaCierres}
              />
            </Suspense>
          )}

          {/* Modal: Historial de Toma de Inventario -- comparar, producto por
              producto, si un día cuadró contra el sistema y otro no. */}
          {modalHistorialInventario && (
            <Suspense fallback={null}>
              <HistorialInventario
                FiltroFechasRapido={FiltroFechasRapido}
                PestanasModal={PestanasModal}
                abrirTomaInventario={abrirTomaInventario}
                cargandoHistorialInventario={cargandoHistorialInventario}
                cargarHistorialInventarioPorRango={cargarHistorialInventarioPorRango}
                fechaFinHistInventario={fechaFinHistInventario}
                fechaInicioHistInventario={fechaInicioHistInventario}
                historialInventarioAgrupado={historialInventarioAgrupado}
                historialInventarioBusqueda={historialInventarioBusqueda}
                historialInventarioSoloDif={historialInventarioSoloDif}
                listaCajeros={listaCajeros}
                modalHistorialInventario={modalHistorialInventario}
                setFechaFinHistInventario={setFechaFinHistInventario}
                setFechaInicioHistInventario={setFechaInicioHistInventario}
                setHistorialInventarioBusqueda={setHistorialInventarioBusqueda}
                setHistorialInventarioSoloDif={setHistorialInventarioSoloDif}
                setModalHistorialInventario={setModalHistorialInventario}
              />
            </Suspense>
          )}

          {modalGestionCajeros && (
            <Suspense fallback={null}>
              <GestionCajeros
                abrirHorarioBarbero={abrirHorarioBarbero}
                alternarActivoCajero={alternarActivoCajero}
                barberosConHorario={barberosConHorario}
                cajerosGestion={cajerosGestion}
                cargandoCajerosGestion={cargandoCajerosGestion}
                eliminarCajero={eliminarCajero}
                esBarberia={esBarberia}
                formNuevoCajero={formNuevoCajero}
                guardandoNuevoCajero={guardandoNuevoCajero}
                guardarComisionBarbero={guardarComisionBarbero}
                modalGestionCajeros={modalGestionCajeros}
                mostrarFormNuevoCajero={mostrarFormNuevoCajero}
                registrarNuevoCajeroCompleto={registrarNuevoCajeroCompleto}
                setFormNuevoCajero={setFormNuevoCajero}
                setModalGestionCajeros={setModalGestionCajeros}
                setModalPinCajero={setModalPinCajero}
                setMostrarFormNuevoCajero={setMostrarFormNuevoCajero}
                setNuevoPinCajero={setNuevoPinCajero}
              />
            </Suspense>
          )}

          {modalComisiones && esBarberia && (
            <Suspense fallback={null}>
              <ComisionesBarberos
                cargandoComisiones={cargandoComisiones}
                cargarComisiones={cargarComisiones}
                combos={combos}
                esBarberia={esBarberia}
                filasComisiones={filasComisiones}
                modalComisiones={modalComisiones}
                periodoComisiones={periodoComisiones}
                productos={productos}
                setModalComisiones={setModalComisiones}
                setPeriodoComisiones={setPeriodoComisiones}
              />
            </Suspense>
          )}

          {modalHorario && esBarberia && (
            <Suspense fallback={null}>
              <HorarioBarbero
                cambiarDiaHorario={cambiarDiaHorario}
                copiarHorarioADias={copiarHorarioADias}
                esBarberia={esBarberia}
                guardandoHorario={guardandoHorario}
                guardarHorarioBarbero={guardarHorarioBarbero}
                modalHorario={modalHorario}
                setModalHorario={setModalHorario}
              />
            </Suspense>
          )}

          {modalAgenda && esBarberia && (
            <Suspense fallback={null}>
              <AgendaCitas
                ajustarDuracionCita={ajustarDuracionCita}
                cargandoAgenda={cargandoAgenda}
                cargarAgenda={cargarAgenda}
                citasAgenda={citasAgenda}
                esBarberia={esBarberia}
                fechaAgenda={fechaAgenda}
                modalAgenda={modalAgenda}
                setFechaAgenda={setFechaAgenda}
                setModalAgenda={setModalAgenda}
              />
            </Suspense>
          )}

          {modalDelivery && (
            <Suspense fallback={null}>
              <DeliveryModal
                DIAS_DELIVERY={DIAS_DELIVERY}
                IconoTrazo={IconoTrazo}
                KASERITA_DELIVERY_URL={KASERITA_DELIVERY_URL}
                avisarAMisClientes={avisarAMisClientes}
                costoEnvioDelivery={costoEnvioDelivery}
                deliveryHabilitado={deliveryHabilitado}
                direccionDelivery={direccionDelivery}
                domicilioHabilitado={domicilioHabilitado}
                enviandoAviso={enviandoAviso}
                esAdmin={esAdmin}
                estadoHorarioActualDelivery={estadoHorarioActualDelivery}
                guardandoDelivery={guardandoDelivery}
                guardarConfigDelivery={guardarConfigDelivery}
                hayCambiosDelivery={hayCambiosDelivery}
                horarioDelivery={horarioDelivery}
                linkDeliveryCopiado={linkDeliveryCopiado}
                logoUrlDelivery={logoUrlDelivery}
                modalDelivery={modalDelivery}
                notificar={notificar}
                pedidoMinimoDelivery={pedidoMinimoDelivery}
                resumenAvisos={resumenAvisos}
                resumenEntregaDelivery={resumenEntregaDelivery}
                resumenHorarioDelivery={resumenHorarioDelivery}
                seccionDelivery={seccionDelivery}
                sesion={sesion}
                setCostoEnvioDelivery={setCostoEnvioDelivery}
                setDeliveryHabilitado={setDeliveryHabilitado}
                setDireccionDelivery={setDireccionDelivery}
                setDomicilioHabilitado={setDomicilioHabilitado}
                setHorarioDelivery={setHorarioDelivery}
                setLinkDeliveryCopiado={setLinkDeliveryCopiado}
                setModalDelivery={setModalDelivery}
                setMostrarQRDelivery={setMostrarQRDelivery}
                setPedidoMinimoDelivery={setPedidoMinimoDelivery}
                setTelefonoDeliveryEditar={setTelefonoDeliveryEditar}
                setWhatsappRepartidor={setWhatsappRepartidor}
                setZonaRepartoDelivery={setZonaRepartoDelivery}
                slugDelivery={slugDelivery}
                subiendoLogoDelivery={subiendoLogoDelivery}
                subirLogoDelivery={subirLogoDelivery}
                telefonoDeliveryEditar={telefonoDeliveryEditar}
                whatsappRepartidor={whatsappRepartidor}
                zonaRepartoDelivery={zonaRepartoDelivery}
              />
            </Suspense>
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
                  <h3 className="text-sm font-bold text-stone-900">Escanea para pedir</h3>
                  <button aria-label="Cerrar" onClick={() => setMostrarQRDelivery(false)} className="text-stone-500 hover:text-stone-900">
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
                  Tus clientes escanean este código con la cámara de su celular para entrar directo a tu tienda en línea.
                </p>
              </div>
            </div>
          )}

          {modalAuditoria && (
            <Suspense fallback={null}>
              <RegistroActividad
                cargandoAuditoria={cargandoAuditoria}
                errorAuditoria={errorAuditoria}
                esModoDemo={esModoDemo}
                filasAuditoria={filasAuditoria}
                filtroAuditoria={filtroAuditoria}
                modalAuditoria={modalAuditoria}
                productos={productos}
                setFiltroAuditoria={setFiltroAuditoria}
                setModalAuditoria={setModalAuditoria}
              />
            </Suspense>
          )}

          {modalPinDueno && (
            <Suspense fallback={null}>
              <PinDueno
                cambiandoPinDueno={cambiandoPinDueno}
                cambiarPinDueno={cambiarPinDueno}
                formPinDueno={formPinDueno}
                modalPinDueno={modalPinDueno}
                setFormPinDueno={setFormPinDueno}
                setModalPinDueno={setModalPinDueno}
              />
            </Suspense>
          )}

          {modalPinCajero && (
            <Suspense fallback={null}>
              <PinCajero
                guardandoPinCajero={guardandoPinCajero}
                guardarPinCajero={guardarPinCajero}
                modalPinCajero={modalPinCajero}
                nuevoPinCajero={nuevoPinCajero}
                setModalPinCajero={setModalPinCajero}
                setNuevoPinCajero={setNuevoPinCajero}
              />
            </Suspense>
          )}

          {modalGestionClientes && (
            <Suspense fallback={null}>
              <GestionClientes
                abrirEdicionCliente={abrirEdicionCliente}
                busquedaClientes={busquedaClientes}
                cargandoClientes={cargandoClientes}
                clienteEditando={clienteEditando}
                clientesFiltradosGestion={clientesFiltradosGestion}
                clientesLista={clientesLista}
                esAdmin={esAdmin}
                exportarClientesExcel={exportarClientesExcel}
                filtroClientes={filtroClientes}
                formEditarCliente={formEditarCliente}
                formatoSoles={formatoSoles}
                guardandoEdicionCliente={guardandoEdicionCliente}
                guardarEdicionCliente={guardarEdicionCliente}
                inicialesCliente={inicialesCliente}
                modalGestionClientes={modalGestionClientes}
                setBusquedaClientes={setBusquedaClientes}
                setClienteEditando={setClienteEditando}
                setFiltroClientes={setFiltroClientes}
                setFormEditarCliente={setFormEditarCliente}
                setModalGestionClientes={setModalGestionClientes}
                setModalNuevoCliente={setModalNuevoCliente}
              />
            </Suspense>
          )}

          {/* Modal: Nuevo Cliente con Límite de Crédito */}
          {/* Modal: Buscar/Seleccionar Cliente (POS) */}
          {modalBuscarCliente && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3 max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2"><span className="w-8 h-8 rounded-xl bg-[#ece0fd] text-[#6105dc] flex items-center justify-center text-sm"><i className="fa-solid fa-user"></i></span> Seleccionar cliente</h3>
                  <button aria-label="Cerrar" onClick={() => setModalBuscarCliente(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
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
                    onClick={() => seleccionarClientePOS({ dni: '99999999', nombre_completo: 'Cliente sin registrar', saldo_actual: 0 })}
                    className="w-full text-left px-4 py-3 bg-white/60 hover:bg-[#f4eefe] backdrop-blur-xl border border-white/80 rounded-2xl shadow-sm transition"
                  >
                    <p className="text-sm font-semibold text-stone-900">Cliente sin registrar</p>
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
            <Suspense fallback={null}>
              <NuevoCliente
                formCliente={formCliente}
                handleGuardarNuevoCliente={handleGuardarNuevoCliente}
                modalNuevoCliente={modalNuevoCliente}
                setFormCliente={setFormCliente}
                setModalNuevoCliente={setModalNuevoCliente}
              />
            </Suspense>
          )}

          {modalDashboard && (
            <Suspense fallback={null}>
              <DashboardVentas
                cargandoDashboard={cargandoDashboard}
                cargarDashboard={cargarDashboard}
                clientesDeuda={clientesDeuda}
                combosVendidos={combosVendidos}
                dashStats={dashStats}
                diaCalendarioSel={diaCalendarioSel}
                diasAnioDash={diasAnioDash}
                diasAnioRango={diasAnioRango}
                exportarDashboardExcel={exportarDashboardExcel}
                fechaFinDash={fechaFinDash}
                fechaInicioDash={fechaInicioDash}
                horaResaltada={horaResaltada}
                mesResaltado={mesResaltado}
                mesCalendario={mesCalendario}
                pestanaDiaCal={pestanaDiaCal}
                productos={productos}
                proveedoresDeudaDash={proveedoresDeudaDash}
                setDiaCalendarioSel={setDiaCalendarioSel}
                setFechaFinDash={setFechaFinDash}
                setFechaInicioDash={setFechaInicioDash}
                setHoraResaltada={setHoraResaltada}
                setMesCalendario={setMesCalendario}
                setMesResaltado={setMesResaltado}
                setModalDashboard={setModalDashboard}
                setPestanaDiaCal={setPestanaDiaCal}
                formatoSoles={formatoSoles}
                montoResumen={montoResumen}
                montoCorto={montoCorto}
                FiltroFechasRapido={FiltroFechasRapido}
                VariacionPct={VariacionPct}
              />
            </Suspense>
          )}

          {modalHistorial && (
            <Suspense fallback={null}>
              <HistorialVentas
                abrirHistorialCierres={abrirHistorialCierres}
                anularVentaHoy={anularVentaHoy}
                atajoHistorial={atajoHistorial}
                busquedaBoletaHistorial={busquedaBoletaHistorial}
                cargandoHistorial={cargandoHistorial}
                cargarHistorialPorRango={cargarHistorialPorRango}
                elegirAtajoHistorial={elegirAtajoHistorial}
                esAdmin={esAdmin}
                etiquetaDiaHistorial={etiquetaDiaHistorial}
                exportarVentasExcel={exportarVentasExcel}
                fechaFinHistorial={fechaFinHistorial}
                fechaInicioHistorial={fechaInicioHistorial}
                formatoSoles={formatoSoles}
                limiteHistorial={limiteHistorial}
                menuVentaHistorial={menuVentaHistorial}
                modalHistorial={modalHistorial}
                nombreClienteHistorial={nombreClienteHistorial}
                productos={productos}
                setBusquedaBoletaHistorial={setBusquedaBoletaHistorial}
                setFechaFinHistorial={setFechaFinHistorial}
                setFechaInicioHistorial={setFechaInicioHistorial}
                setLimiteHistorial={setLimiteHistorial}
                setMenuVentaHistorial={setMenuVentaHistorial}
                setModalHistorial={setModalHistorial}
                setReciboReimpresion={setReciboReimpresion}
                setVentaDetalleHistorial={setVentaDetalleHistorial}
                ventaDetalleHistorial={ventaDetalleHistorial}
                ventasDelDia={ventasDelDia}
              />
            </Suspense>
          )}

          {(modalCierreCaja || resumenCierre) && (
            <Suspense fallback={null}>
              <CierreCaja
                abrirHistorialCierres={abrirHistorialCierres}
                arqueoEsperado={arqueoEsperado}
                cajeroSeleccionado={cajeroSeleccionado}
                cambiarConteo={cambiarConteo}
                confirmarCierreConArqueo={confirmarCierreConArqueo}
                conteoAbierto={conteoAbierto}
                conteoEfectivo={conteoEfectivo}
                modalCierreCaja={modalCierreCaja}
                montoConteoEfectivo={montoConteoEfectivo}
                resumenCierre={resumenCierre}
                setConteoAbierto={setConteoAbierto}
                setConteoEfectivo={setConteoEfectivo}
                setModalCierreCaja={setModalCierreCaja}
                setMontoConteoEfectivo={setMontoConteoEfectivo}
                setResumenCierre={setResumenCierre}
                turnoActivo={turnoActivo}
                ContadorEfectivo={ContadorEfectivo}
                DesgloseMediosPago={DesgloseMediosPago}
                etiquetaCuandoTurno={etiquetaCuandoTurno}
                vuelto={vuelto}
              />
            </Suspense>
          )}

          {/* Modal: Apertura Turno */}
          {modalTurno && (() => {
            const dinero = (v) => `S/ ${(Number(v) || 0).toFixed(2)}`;
            const montoNum = parseFloat(montoApertura);
            const montoInvalido = montoApertura === '' || !(montoNum >= 0);
            const conteoActivo = totalConteo(conteoEfectivo) > 0;
            const elegido = cajeroSeleccionado || listaCajeros[0];
            const iniciales = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
            const esElevado = (c) => c.rol === 'administrador' || c.rol === 'dueno';
            const fijarMonto = (v) => { setConteoEfectivo({}); setMontoApertura(String(v)); };
            const atajo = (activo) => `px-3 py-1.5 rounded-xl border-[1.5px] text-[12.5px] font-bold transition ${activo ? 'border-[#6105dc] bg-[#f4eefe] text-[#4d04b0]' : 'border-stone-200 bg-white hover:bg-[#f4eefe] hover:border-[#e4d6fb]'}`;
            const esIgual = (v) => !conteoActivo && !montoInvalido && montoNum === v;
            return (
              <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
                  <div className="bg-white border-b border-stone-100 px-4 sm:px-5 py-3.5 shrink-0 flex items-center gap-3">
                    <span className="w-11 h-11 rounded-[14px] bg-[#f4eefe] text-[#6105dc] grid place-items-center text-xl shrink-0"><i className="fa-solid fa-cash-register"></i></span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[17px] sm:text-lg font-extrabold text-stone-900 tracking-tight leading-tight">Abrir turno</h3>
                      <p className="text-[12.5px] text-stone-500 mt-0.5 leading-snug">Elige quién atiende y con cuánto efectivo empieza la caja.</p>
                    </div>
                    <button aria-label="Cerrar" onClick={() => setModalTurno(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors shrink-0"><i className="fa-solid fa-xmark"></i></button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5">
                    <div>
                      <label className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-stone-800 mb-2"><span>¿Quién abre la caja?</span></label>
                      <div className="grid gap-2">
                        {listaCajeros.map((c) => {
                          const activo = elegido?.id === c.id;
                          return (
                            <button type="button" key={c.id} onClick={() => elegirCajeroTurno(c)} className={`flex items-center gap-3 w-full text-left rounded-2xl border-[1.5px] bg-white px-3 py-2.5 transition hover:bg-[#fcfaff] hover:border-[#e4d6fb] ${activo ? 'border-[#6105dc] bg-[#fcfaff] ring-[3px] ring-[#6105dc]/15' : 'border-stone-100'}`}>
                              <span className={`w-[38px] h-[38px] rounded-full grid place-items-center text-[13px] font-extrabold shrink-0 ${esElevado(c) ? 'bg-gradient-to-br from-[#ffd45c] to-[#f0a500] text-stone-900' : 'bg-gradient-to-br from-[#8a3df2] to-[#4d04b0] text-white'}`}>{iniciales(c.nombre)}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13.5px] font-bold text-stone-900 leading-tight truncate">{c.nombre}</span>
                                <span className="block text-[11.5px] text-stone-500 capitalize">{c.rol || 'Cajero'}</span>
                              </span>
                              <span className={`w-[22px] h-[22px] rounded-full border-2 grid place-items-center text-white text-xs shrink-0 ${activo ? 'bg-[#6105dc] border-[#6105dc]' : 'border-stone-300'}`}>{activo && <i className="fa-solid fa-check text-[10px]"></i>}</span>
                            </button>
                          );
                        })}
                      </div>
                      {esAdmin && (
                        <button type="button" onClick={() => { setModalTurno(false); abrirGestionCajeros(); setMostrarFormNuevoCajero(true); }} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#4d04b0] hover:bg-[#f4eefe] rounded-lg px-1 py-1.5">
                          <i className="fa-solid fa-plus text-[10px]"></i> Agregar a alguien que no está en la lista
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-stone-800 mb-2"><span>Efectivo con el que empieza la caja</span><span className="text-stone-400 font-normal">fondo inicial</span></label>
                      <div className="flex items-baseline gap-2.5 border-2 border-stone-200 rounded-[20px] bg-stone-50/70 px-4 sm:px-[18px] py-3 focus-within:border-[#6105dc] focus-within:bg-white focus-within:ring-[5px] focus-within:ring-[#6105dc]/15 transition">
                        <span className="text-[22px] font-extrabold text-stone-300">S/</span>
                        <input type="number" min="0" step="0.50" inputMode="decimal" placeholder="0.00" aria-label="Monto inicial" readOnly={conteoActivo} value={montoApertura} onChange={(e) => setMontoApertura(e.target.value)} className="w-full min-w-0 bg-transparent outline-none border-0 text-[32px] sm:text-[38px] font-extrabold tracking-tight text-stone-900 placeholder:text-stone-300" />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {[0, 50, 100, 200].map((v) => <button type="button" key={v} onClick={() => fijarMonto(v)} className={atajo(esIgual(v))}>{v === 0 ? 'Sin fondo' : `S/ ${v}`}</button>)}
                        {ultimoCierre && ![0, 50, 100, 200].includes(ultimoCierre.monto) && (
                          <button type="button" onClick={() => fijarMonto(ultimoCierre.monto)} className={`${atajo(esIgual(ultimoCierre.monto))} border-dashed`}>Lo que quedó al cerrar <small className="font-medium text-stone-500 ml-1">{dinero(ultimoCierre.monto)} · {etiquetaCuandoTurno(ultimoCierre.fecha)}</small></button>
                        )}
                      </div>
                      {ultimoCierre && [0, 50, 100, 200].includes(ultimoCierre.monto) && (
                        <p className="mt-2 text-[11.5px] text-stone-500">La última caja se cerró con {dinero(ultimoCierre.monto)} ({etiquetaCuandoTurno(ultimoCierre.fecha)}).</p>
                      )}
                      <button type="button" onClick={() => setConteoAbierto((v) => !v)} className="mt-3 inline-flex items-center gap-2 text-[12.5px] font-bold text-[#4d04b0] hover:bg-[#f4eefe] rounded-lg px-1 py-1.5">
                        <i className="fa-solid fa-coins text-sm"></i> Contar billetes y monedas <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${conteoAbierto ? 'rotate-180' : ''}`}></i>
                      </button>
                      {conteoAbierto && <ContadorEfectivo conteo={conteoEfectivo} onChange={(n) => cambiarConteo(n, setMontoApertura)} />}
                      {conteoActivo && (
                        <p className="mt-2 text-[11.5px] text-stone-500">El monto se calcula con tu conteo. <button type="button" onClick={() => setConteoEfectivo({})} className="font-bold text-[#4d04b0]">Escribirlo a mano</button></p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 bg-white border-t border-stone-100 px-4 sm:px-5 py-3 flex items-center gap-2.5 shadow-[0_-8px_24px_-14px_rgba(40,10,90,0.18)]">
                    <button type="button" onClick={() => setModalTurno(false)} className="h-[46px] px-4 sm:px-5 rounded-[14px] text-stone-500 hover:text-stone-800 hover:bg-stone-100 font-bold text-[13.5px]">Cancelar</button>
                    <span className="flex-1 text-right text-xs text-stone-500 hidden sm:block">{montoInvalido ? 'Escribe con cuánto efectivo empieza la caja' : `${elegido?.nombre || ''} · empieza con ${dinero(montoNum)}`}</span>
                    <button type="button" onClick={handleAbrirTurno} disabled={montoInvalido} className="h-[46px] px-5 rounded-[14px] bg-[#6105dc] hover:bg-[#4d04b0] disabled:bg-[#d9d2ea] disabled:shadow-none disabled:cursor-not-allowed text-white font-bold text-[13.5px] shadow-lg shadow-[#6105dc]/30 inline-flex items-center justify-center gap-2 transition ml-auto sm:ml-0">
                      <i className="fa-solid fa-check text-xs"></i> Abrir turno
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

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
                <p className="text-xs text-stone-600">Esta cuenta tiene acceso de Administrador: ingresa su PIN para continuar.</p>
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
          {cajasAbiertasAviso && (() => {
            const iniciales = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
            return (
              <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-lg w-full shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
                  <div className="bg-white border-b border-stone-100 px-4 sm:px-5 py-3.5 shrink-0 flex items-center gap-3">
                    <span className="w-11 h-11 rounded-[14px] bg-[#f4eefe] text-[#6105dc] grid place-items-center text-xl shrink-0"><i className="fa-solid fa-cash-register"></i></span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[17px] sm:text-lg font-extrabold text-stone-900 tracking-tight leading-tight">
                        {cajasAbiertasAviso.length === 1 ? 'Ya hay una caja abierta' : `Ya hay ${cajasAbiertasAviso.length} cajas abiertas`}
                      </h3>
                      <p className="text-[12.5px] text-stone-500 mt-0.5 leading-snug">Elige con cuál vas a trabajar en este dispositivo, o abre una caja nueva y separada.</p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 grid gap-2.5 content-start">
                    {cajasAbiertasAviso.map((t, i) => {
                      const edad = antiguedadTurno(t.fecha_apertura);
                      const nombre = t.cajeros?.nombre || 'Cajero';
                      return (
                        <div key={t.id} className={`rounded-[20px] border-[1.5px] p-3.5 flex gap-3 items-start ${edad.antiguo ? 'border-amber-300 bg-amber-50/60' : 'border-stone-100 bg-white'}`}>
                          <span className={`w-[38px] h-[38px] rounded-full grid place-items-center text-[13px] font-extrabold shrink-0 ${i % 2 ? 'bg-gradient-to-br from-[#ffd45c] to-[#f0a500] text-stone-900' : 'bg-gradient-to-br from-[#8a3df2] to-[#4d04b0] text-white'}`}>{iniciales(nombre)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-stone-900 truncate">{nombre}{t.es_propia && <span className="text-[#6105dc]"> · tú</span>}</p>
                            <p className="text-xs text-stone-500 mt-0.5 leading-snug">Desde {etiquetaCuandoTurno(t.fecha_apertura)} · S/ {Number(t.monto_inicial || 0).toFixed(2)} de fondo inicial</p>
                            {edad.antiguo && (
                              <div className="flex gap-2 items-start rounded-xl bg-amber-100/70 text-amber-800 px-2.5 py-2 text-xs leading-snug mt-2.5"><i className="fa-solid fa-triangle-exclamation mt-0.5"></i><span>Abierta {edad.etiqueta}. Si sigues con ella, el cierre sumará las ventas de todo ese tiempo. Conviene cerrarla.</span></div>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2.5">
                              <button type="button" onClick={() => unirseACaja(t)} className="h-[38px] px-3.5 rounded-xl bg-[#6105dc] hover:bg-[#4d04b0] text-white text-[12.5px] font-bold shadow-md shadow-[#6105dc]/25">Usar esta caja</button>
                              {edad.antiguo && (
                                <button type="button" onClick={() => { unirseACaja(t); setCierreAlRetomar(true); }} className="h-[38px] px-3.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 text-[12.5px] font-bold">Cerrar esta caja</button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="shrink-0 bg-white border-t border-stone-100 px-4 sm:px-5 py-3 shadow-[0_-8px_24px_-14px_rgba(40,10,90,0.18)]">
                    <button type="button" onClick={abrirCajaNueva} className="w-full h-[46px] rounded-[14px] bg-[#f4eefe] hover:bg-[#ece0fd] text-[#4d04b0] font-bold text-[13.5px] inline-flex items-center justify-center gap-2"><i className="fa-solid fa-plus text-xs"></i> Abrir otra caja</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Aviso: tu caja sigue abierta de un día anterior */}
          {avisoTurnoViejo && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="alertdialog" aria-modal="true">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
                <div className="w-14 h-14 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-triangle-exclamation text-amber-600 text-xl"></i>
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900">Tienes una caja abierta {antiguedadTurno(avisoTurnoViejo.fecha_apertura).etiqueta}</h2>
                  <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                    Se abrió el {new Date(avisoTurnoViejo.fecha_apertura).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} con S/ {Number(avisoTurnoViejo.monto_inicial || 0).toFixed(2)} inicial.
                    Si sigues con ella, el cierre sumará las ventas de todos esos días. Lo recomendable es cerrarla y empezar una nueva.
                  </p>
                </div>
                <div className="space-y-2">
                  <button onClick={() => retomarTurnoViejo(true)} className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold rounded-full shadow">
                    Cerrar esa caja ahora
                  </button>
                  <button onClick={() => retomarTurnoViejo(false)} className="w-full py-2.5 bg-white/80 hover:bg-white text-stone-700 text-xs font-semibold rounded-full shadow-sm">
                    Seguir con esa caja
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Boleta Emitida -- ticket con muescas y borde en festón */}
          {ventaCompletada && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm z-50 overflow-y-auto">
              <div className="min-h-full flex items-center justify-center p-4">
                <div className="bol-ticket">
                  <div className="bol-a">
                    <div className="bol-ok">
                      <span className="bol-ok-c"><IconoTrazo nombre="check" className="w-7 h-7" grosor={2.6} /></span>
                      {CONFETI_BOLETA.map(([color, x, y, t], i) => (
                        <i key={i} style={{ background: color, width: t, height: t, left: `calc(50% - ${t / 2}px)`, top: `calc(50% - ${t / 2}px)`, '--x': `${x}px`, '--y': `${y}px`, animationDelay: `${0.45 + i * 0.04}s` }}></i>
                      ))}
                    </div>
                    <h3>¡Venta exitosa!</h3>
                    <p className="bol-sub">Tu boleta se emitió correctamente</p>
                    {ventaCompletada.offline && (
                      <div className="bol-off">
                        <IconoTrazo nombre="cloud" className="w-4 h-4 shrink-0 mt-px" />
                        <span>Guardada sin conexión. Se sincronizará sola cuando vuelva el internet.</span>
                      </div>
                    )}
                  </div>
                  <div className="bol-b">
                    <div className="bol-g">
                      <div>
                        <small>Boleta</small>
                        <b>{ventaCompletada.nro_boleta}</b>
                      </div>
                      <div className="bol-der">
                        <small>Monto</small>
                        <b className="bol-monto"><s>S/</s>{formatoSoles(ventaCompletada.total_venta)}</b>
                      </div>
                      {ventaCompletada.descuento > 0 && (
                        <div className="bol-desc">
                          <span>Subtotal <b>S/ {formatoSoles(ventaCompletada.subtotal)}</b></span>
                          <span className="bol-neg">Descuento − S/ {formatoSoles(ventaCompletada.descuento)}</span>
                        </div>
                      )}
                      <div className="bol-fecha">
                        <small>Fecha y hora</small>
                        <b>{formatoFechaHoraBoleta(ventaCompletada.fecha_hora)}</b>
                      </div>
                    </div>
                    <div className="bol-cli">
                      <span className="bol-mp"><IconoTrazo nombre={ICONO_MEDIO_PAGO[String(ventaCompletada.medio_pago || '').toUpperCase()] || 'efectivo'} className="w-5 h-5" /></span>
                      <div className="min-w-0">
                        <b>{ventaCompletada.cliente}</b>
                        <span>{String(ventaCompletada.medio_pago || '').charAt(0) + String(ventaCompletada.medio_pago || '').slice(1).toLowerCase()}</span>
                      </div>
                    </div>
                    <button onClick={() => setVentaCompletada(null)} className="bol-nv">
                      Nueva venta
                    </button>
                    <div className="bol-sec">
                      <button onClick={imprimirBoletaTermica}>
                        <IconoTrazo nombre="print" className="w-[15px] h-[15px]" /> Imprimir
                      </button>
                      <button onClick={() => enviarBoletaWhatsApp(ventaCompletada)}>
                        <IconoTrazo nombre="chat" className="w-[15px] h-[15px]" /> WhatsApp
                      </button>
                      {typeof navigator !== 'undefined' && navigator.bluetooth && (
                        <button onClick={() => imprimirBoletaBluetooth(ventaCompletada)}>
                          <IconoTrazo nombre="bluetooth" className="w-[15px] h-[15px]" /> Ticketera
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <ReciboImprimible
                bodega={bodegaNombre}
                direccion={bodegaDireccion}
                telefono={bodegaTelefono}
                cajero={ventaCompletada.cajero}
                recibido={ventaCompletada.recibido}
                boleta={ventaCompletada.nro_boleta}
                fecha={formatoFechaHoraBoleta(ventaCompletada.fecha_hora)}
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
                  <p><strong>Cliente:</strong> {nombreClienteHistorial(reciboReimpresion)}</p>
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
                  <button onClick={imprimirBoletaTermica} className="flex-1 py-2 bg-stone-200 text-stone-900 font-bold text-xs rounded-xl"><i className="fa-solid fa-print mr-1"></i> Imprimir</button>
                  <button onClick={() => setReciboReimpresion(null)} className="flex-1 py-2 bg-stone-900 text-white font-bold text-xs rounded-xl shadow">Cerrar</button>
                </div>
              </div>
              <ReciboImprimible
                bodega={bodegaNombre}
                direccion={bodegaDireccion}
                telefono={bodegaTelefono}
                boleta={reciboReimpresion.nro_boleta}
                fecha={formatoFechaHoraBoleta(reciboReimpresion.fecha_hora)}
                cliente={nombreClienteHistorial(reciboReimpresion)}
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

    // Si un error al dibujar la pantalla la rompiera, en vez de dejarla en blanco
    // se muestra un aviso con un botón para recargar, y el error queda registrado.
    class LimiteDeError extends React.Component {
      constructor(props) { super(props); this.state = { fallo: false }; }
      static getDerivedStateFromError() { return { fallo: true }; }
      componentDidCatch(error) {
        reportarError({ mensaje: (error && error.message) || String(error), stack: error && error.stack, origen: 'render' });
      }
      render() {
        if (!this.state.fallo) return this.props.children;
        return (
          <div role="alert" className="min-h-screen flex items-center justify-center bg-stone-100 p-6">
            <div className="max-w-sm w-full bg-white rounded-2xl shadow p-6 text-center space-y-3">
              <h1 className="text-lg font-bold text-stone-900">Algo salió mal</h1>
              <p className="text-sm text-stone-600">Tuvimos un problema al mostrar esta pantalla. Tus ventas guardadas están a salvo. Recarga para continuar.</p>
              <button onClick={() => window.location.reload()} className="w-full py-2.5 bg-stone-900 text-white text-sm font-bold rounded-xl">Recargar</button>
            </div>
          </div>
        );
      }
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<LimiteDeError><PosApp /></LimiteDeError>);
  