import React from 'react';

// ============================================================
// Helpers compartidos entre PosApp (src/main.jsx) y PanelAdmin
// (src/PanelAdmin.jsx). Viven en su propio archivo para que ambos los
// puedan importar sin duplicar codigo, y para que PanelAdmin (que solo
// se usa si eres super-admin) pueda separarse del resto en su propio
// chunk de JavaScript, sin arrastrar codigo a medias.
// ============================================================

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
        return <img src={fotoUrl} alt="" loading="lazy" decoding="async" className={`object-cover ${className}`} />;
      }
      const est = estiloCategoria(categoria);
      return (
        <div className={`flex items-center justify-center bg-gradient-to-br ${est.fondo} ${className}`}>
          <i className={`fa-solid ${est.icono} ${est.color} ${iconClassName || 'text-2xl'}`}></i>
        </div>
      );
    }
    // Interruptor compacto para las filas del panel de administrador: la
    // etiqueta va arriba y el interruptor abajo, para que tres de ellos
    // quepan en una sola columna de la tabla.
    function MiniInterruptor({ activo, onClick, etiqueta, title }) {
      return (
        <button
          type="button"
          onClick={onClick}
          title={title}
          role="switch"
          aria-checked={!!activo}
          aria-label={etiqueta}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold text-stone-500"
        >
          <span>{etiqueta}</span>
          <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${activo ? 'bg-violet-600' : 'bg-stone-300'}`}>
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${activo ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </span>
        </button>
      );
    }

export {
  scriptsExternosCargados, cargarScriptExterno, asegurarXLSX,
  generarSKU, fechaISOLocal, fechaHoyISO,
  comprimirImagenJPEG, formatearBytes,
  PIN_MIN, PIN_MAX, PIN_MIN_DUENO, pinValido,
  CATEGORIA_ESTILO, CATEGORIAS_FALLBACK, normalizarCategoria,
  CATEGORIA_ESTILO_POR_NOMBRE_NORMALIZADO, CATEGORIA_ALIAS,
  estiloCategoria, categoriaDesdeTexto, FotoProducto, MiniInterruptor,
};
