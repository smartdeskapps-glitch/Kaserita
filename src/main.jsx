import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import RielLateral from './RielLateral.jsx';
import PaletaMenu from './PaletaMenu.jsx';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import './index.css';
import { fechaHoyISO, comprimirImagenJPEG, PIN_MAX, PIN_MIN_DUENO, CATEGORIAS_FALLBACK, FotoProducto } from './PanelAdminCompartido.jsx';
import CombosCatalogo, { comboCoincide } from './CombosCatalogo.jsx';
import { totalConteo } from './lib/arqueo.js';
import { antiguedadTurno } from './lib/turnos.js';
import { iniciarMonitoreo, reportarError } from './monitoreo.js';
import { evitarZoomEnCampos } from './lib/movil.js';
import DeslizarParaConfirmar from './DeslizarParaConfirmar.jsx';
import { claveAuthSupabase, puedeUsarSesionGuardada, debeReintentar, PAUSAS_REINTENTO_SESION } from './lib/sesion.js';
import { BODEGA_DEMO_ID, KASERITA_DELIVERY_URL, formatoFechaHoraBoleta, CONFETI_BOLETA, ICONO_MEDIO_PAGO, urlMapa, mensajeError, etiquetaCuandoTurno, formatoSoles, montoCorto, montoResumen } from './pos/utilidades.js';
import { PRODUCTOS_SEMILLA } from './pos/demo.js';
import { PestanasModal, NumericKeypad, imprimirBoletaTermica, ReciboImprimible, QRPagoModal, FiltroFechasRapido, DesgloseMediosPago, ContadorEfectivo, VariacionPct, IconoTrazo, ProductoCard } from './pos/componentes.jsx';
import useCuentasPorPagar from './pos/useCuentasPorPagar.js';
import usePedidosDelivery from './pos/usePedidosDelivery.jsx';
import useCajeros from './pos/useCajeros.js';
import useCatalogo from './pos/useCatalogo.js';
import useCombos from './pos/useCombos.js';
import useSeleccionProducto from './pos/useSeleccionProducto.js';
import useLectores from './pos/useLectores.js';
import useVentasEnEspera from './pos/useVentasEnEspera.js';
import useCreditoCliente from './pos/useCreditoCliente.js';
import useClientes from './pos/useClientes.js';
import useInventarioInicial from './pos/useInventarioInicial.js';
import useEditarProducto from './pos/useEditarProducto.js';
import useMermasYToma from './pos/useMermasYToma.js';
import useHistorialTomas from './pos/useHistorialTomas.js';
import useEntradaMercaderia from './pos/useEntradaMercaderia.js';
import useHistorialVentas from './pos/useHistorialVentas.js';
import useDashboard from './pos/useDashboard.js';
import useCajaYCobro from './pos/useCajaYCobro.js';
import useImpresoraBluetooth from './pos/useImpresoraBluetooth.js';







































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
    const PinCajero = React.lazy(() => import('./PinCajero.jsx'));
    const QRLocal = React.lazy(() => import('./QRLocal.jsx'));
    const NuevoCliente = React.lazy(() => import('./NuevoCliente.jsx'));
    const HistorialVentas = React.lazy(() => import('./HistorialVentas.jsx'));

    function PosApp() {
      // Valores que algunos hooks de sección usan pero se declaran más abajo (ver src/pos/).
      const tarde = useRef({}).current;
      // --- Supabase Config ---
      // Fijos al construir la app: ya no se leen de localStorage (un script
      // inyectado o alguien con el equipo podía apuntar el login a otro backend).
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hzmrsbeamtbloudmxjrp.supabase.co';
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RHAkd7pZIadDnSQClFdjMQ_lrG3p-gw';

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
      // Los dueños entran solo con Google (ya no existe el ingreso con DNI + PIN).

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
      // Administración desbloqueada EN EL SERVIDOR para esta sesión (ver
      // autorizacion_por_rol.sql): se consigue con el PIN del perfil Dueño o
      // Administrador. Sin eso, la base rechaza las escrituras de administración.
      // rolesEnServidor = false mientras esa migración no esté ejecutada (se
      // comporta como antes para no dejar la app sin administración).
      const [elevado, setElevado] = useState(false);
      const [rolesEnServidor, setRolesEnServidor] = useState(true);
      // El "rol activo" es el de quien está atendiendo la caja en este momento
      // (el cajero elegido al abrir turno), no necesariamente el de quien inició
      // sesión en el dispositivo -- para dar permisos según quién opera la caja.
      const rolActivo = (cajeroSeleccionado?.rol || usuarioActivo?.rol || 'cajero').toLowerCase();
      const esAdmin = (rolActivo === 'dueno' || rolActivo === 'administrador') && (elevado || esModoDemo || !rolesEnServidor);
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
      // El dueño crea su PIN de administrador la primera vez (no es el de ingreso: se entra con Google).
      const [crearPinAdmin, setCrearPinAdmin] = useState(null);
      const [formCrearPin, setFormCrearPin] = useState({ nuevo: '', repetir: '' });
      const [guardandoCrearPin, setGuardandoCrearPin] = useState(false);
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
      // Hueco del riel donde se dibuja el menú "Más" en escritorio.
      const [ranuraRiel, setRanuraRiel] = useState(null);
      // Al abrir una ventana desde el riel o desde "Más" se cierran las otras que estuvieran abiertas,
      // para que no queden apiladas. (Turno, cierre de caja, cobro y escáner no se tocan.)
      const cerrarVentanasDelMenu = () => {
        setModalCobrarDeudas(false); setModalNuevoCliente(false); setModalHistorial(false);
        setModalTomaInventario(false); setModalHistorialInventario(false); setModalMerma(false);
        setModalDashboard(false); setModalCombos(false); setModalDelivery(false);
        setModalGestionCajeros(false); setModalComisiones(false); setModalAgenda(false);
        setModalCuentasPagar(false); setModalAuditoria(false); setModalInventarioInicial(false);
        setModalEntradaMercaderia(false); setModalHistorialCierres(false);
      };
      const abrirDesdeMenu = (abrir) => () => { cerrarVentanasDelMenu(); abrir(); };
      // En pantallas anchas el menú "Más" se abre dentro del riel; en celular es una hoja.
      const menuEnRiel = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
      const [formCliente, setFormCliente] = useState({ dni: '', nombre: '', telefono: '', correo: '', limiteCredito: '300.00' });
      const [modalCobrarDeudas, setModalCobrarDeudas] = useState(false);
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
      const [clientesLista, setClientesLista] = useState([]);
      const [cargandoClientes, setCargandoClientes] = useState(false);
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
      // Celular: en el cobro, la lista de productos va resumida; se abre con "Ver detalle de la venta".
      const [verDetalleCobro, setVerDetalleCobro] = useState(false);
      useEffect(() => { if (!mostrarPago) setVerDetalleCobro(false); }, [mostrarPago]);
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
      // se usa una bodega real ("Bodega Demo", con Google, ver el SQL que la
      // crea) que sí soporta el ciclo completo (catálogo online, pedidos
      // por WhatsApp, etc.). El resto del código que revisa "esModoDemo"
      // queda sin usar pero no se tocó -- borrarlo es un cambio grande y
      // separado, no hace falta para esto.

      // Si la sesión venció (no la cerró la persona), el aviso lo explica.
      // Copia de la sesión (usuario y bodega) para poder abrir la app si al
      // arrancar no se puede comprobar con internet. Se borra al cerrar sesión.
      const CLAVE_SESION_COPIA = 'kz_sesion_ultima';
      // Solo lo que la app necesita para abrir sin conexión: nada de teléfono ni correo.
      const copiaMinimaUsuario = (u) => (u ? {
        id: u.id, auth_id: u.auth_id, bodega_id: u.bodega_id, nombre: u.nombre,
        rol: u.rol, dni: u.dni || null, activo: u.activo,
      } : u);
      useEffect(() => {
        if (!sesion || esModoDemo) return;
        try { localStorage.setItem(CLAVE_SESION_COPIA, JSON.stringify({ usuario: copiaMinimaUsuario(sesion.usuario), bodega: sesion.bodega })); } catch (err) { /* sin almacenamiento: se sigue igual */ }
      }, [sesion]);
      const motivoCierreRef = useRef(null);
      const cerrandoSesionRef = useRef(false);
      const sesionRef = useRef(null);
      sesionRef.current = sesion;

      const cerrarSesion = async () => {
        cerrandoSesionRef.current = true;
        if (sbClient && !esModoDemo && rolesEnServidor) {
          try { await sbClient.rpc('bajar_admin'); } catch (err) { /* ya se cae con la sesión */ }
        }
        setElevado(false);
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
      // Supabase Auth (login anterior), se restaura sin pedir iniciar sesión de
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
        // Cada intento de arranque corta a los 6 s y sin los reintentos internos de
        // supabase-js (esperas de 1, 2 y 4 s): la app ya reintenta a su ritmo
        // (PAUSAS_REINTENTO_SESION). Con los dos juntos, sin buena señal el POS
        // tardaba ~35 s en abrir con la última sesión guardada.
        const limiteArranque = (q) => {
          const conTope = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
            ? q.abortSignal(AbortSignal.timeout(6000)) : q;
          return typeof conTope.retry === 'function' ? conTope.retry(false) : conTope;
        };
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
          let { data: usuarioConBodega, error: errUsuario } = await limiteArranque(sbClient.from('usuarios').select('*, bodegas(*)').eq('auth_id', session.user.id).maybeSingle());
          if (errUsuario) return { estado: 'error' };
          if (!usuarioConBodega) {
            // Bodega creada por el admin con el correo del dueño: en su
            // primer ingreso con Google se vincula la cuenta a esa bodega
            // (reclamar_cuenta_por_correo.sql). Si la función aún no existe
            // o el correo no tiene bodega, sigue el camino de siempre.
            const { data: bodegaReclamada } = await sbClient.rpc('reclamar_cuenta_por_correo');
            if (bodegaReclamada) {
              ({ data: usuarioConBodega, error: errUsuario } = await limiteArranque(sbClient.from('usuarios').select('*, bodegas(*)').eq('auth_id', session.user.id).maybeSingle()));
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
          const { data: esAdmin, error: errAdmin } = await limiteArranque(sbClient.from('super_admins').select('auth_id').eq('auth_id', session.user.id).maybeSingle());
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

      // LINK DE PEDIDOS (KaseritaDelivery): vitrina pública de la bodega  ->  ./pos/usePedidosDelivery.jsx
      const {
        DIAS_DELIVERY, abrirModalDelivery, avisarAMisClientes, cargarPedidoDesdeRetirar,
        cargarPedidosRetirar, desgloseComboPedido, eliminarPedidoRetirar, enviarPedidoAlRepartidor,
        estadoHorarioActualDelivery, guardarConfigDelivery, hayCambiosDelivery,
        marcarPedidoEnCamino, marcarPedidoListo, marcarRetiradoDirecto, resumenEntregaDelivery,
        resumenHorarioDelivery, seccionDelivery, subirLogoDelivery
      } = usePedidosDelivery({
        bodegaId, carrito, combos, costoEnvioDelivery, deliveryHabilitado, direccionDelivery,
        domicilioHabilitado, esModoDemo, horarioDelivery, logoUrlDelivery, modalDelivery,
        notificar, pedidoMinimoDelivery, pedidosCargadosAlCarrito, pedidosRetirar,
        pedirConfirmacion, productos, resumenAvisos, sbClient, seccionesDelivery, sesion,
        setCargandoPedidosRetirar, setCarrito, setCostoEnvioDelivery, setDeliveryHabilitado,
        setDescuentoTipo, setDescuentoValor, setDireccionDelivery, setDomicilioHabilitado,
        setEnviandoAviso, setGuardandoDelivery, setHorarioDelivery, setLogoUrlDelivery,
        setMarcandoListoId, setModalDelivery, setModalPedidosRetirar, setMostrarPago,
        setMostrarResumenMobile, setPedidoMinimoDelivery, setPedidosCargadosAlCarrito,
        setPedidosRetirar, setProcesandoPedidoRetirarId, setResumenAvisos, setSeccionesDelivery,
        setSesion, setSlugDelivery, setSubiendoLogoDelivery, setTelefonoDeliveryEditar,
        setWhatsappRepartidor, setZonaRepartoDelivery, slugDelivery, telefonoDeliveryEditar,
        whatsappRepartidor, zonaRepartoDelivery, tarde
      });

      // GESTIÓN DE CAJEROS (agregar empleados, activar/desactivar acceso)  ->  ./pos/useCajeros.js
      const {
        abrirAgenda, abrirComisiones, abrirGestionCajeros, abrirHorarioBarbero,
        ajustarDuracionCita, alternarActivoCajero, cambiarDiaHorario, cargarAgenda,
        cargarComisiones, confirmarPinCajero, copiarHorarioADias, elegirCajeroTurno,
        eliminarCajero, guardarComisionBarbero, guardarCrearPinAdmin, guardarHorarioBarbero,
        guardarPinCajero, registrarNuevoCajeroCompleto, soltarAdmin
      } = useCajeros({
        bodegaId, cajeroPendientePin, cajeroSeleccionado, cargarCajeros, crearPinAdmin, elevado,
        esBarberia, esCajeroDelUsuarioActivo, esModoDemo, fechaAgenda, formCrearPin,
        formNuevoCajero, listaCajeros, modalHorario, modalPinCajero, notificar, nuevoPinCajero,
        pedirConfirmacion, periodoComisiones, pinConfirmarCajero, rolActivo, rolesEnServidor,
        sbClient, sesion, setBarberosConHorario, setCajeroPendientePin, setCajeroSeleccionado,
        setCajerosGestion, setCargandoAgenda, setCargandoCajerosGestion, setCargandoComisiones,
        setCitasAgenda, setCrearPinAdmin, setElevado, setFechaAgenda, setFilasComisiones,
        setFormCrearPin, setFormNuevoCajero, setGuardandoCrearPin, setGuardandoHorario,
        setGuardandoNuevoCajero, setGuardandoPinCajero, setListaCajeros, setModalAgenda,
        setModalComisiones, setModalGestionCajeros, setModalHorario, setModalPinCajero,
        setMostrarFormNuevoCajero, setNuevoPinCajero, setPinConfirmarCajero, setRolesEnServidor,
        setVerificandoPinCajero
      });

      // PRODUCTOS & CATÁLOGO  ->  ./pos/useCatalogo.js
      const {
        cargarProductos, refrescarProductosPorId
      } = useCatalogo({
        bodegaId, busqueda, catalogoDemoInicial, catalogoDemoRef, esModoDemo, notificar, sbClient,
        setCargandoProductos, setProductos
      });

      // COMBOS (paquetes de varios productos a precio especial)  ->  ./pos/useCombos.js
      const {
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
      } = useCombos({
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
      });

      // SELECCIÓN Y CANTIDAD / BALANZA DE PRODUCTO  ->  ./pos/useSeleccionProducto.js
      const {
        agregarAlCarrito, agregarComboAlCarrito, buscarProductoPorCodigo, combosRechazadosRef,
        confirmarCantidadBalanza, expandirLineaCarrito, handleClicProducto, unidadesEnCarritoDe
      } = useSeleccionProducto({
        carrito, combos, inputCantidad, notificar, productoSeleccionadoCantidad, productos,
        setCarrito, setInputCantidad, setModalCantidad, setProductoSeleccionadoCantidad,
        setTipoVentaSeleccionado, tipoVentaSeleccionado
      });

      // LECTOR BLUETOOTH / USB (se comporta como un teclado)  ->  ./pos/useLectores.js
      const {
        abrirEscanerParaFilaInventario, abrirEscanerParaVenta, asignarDesdeTeclado, cambiarCamara,
        cambiarCantidadCarrito, efectivoRequeridoMixto, handleKeyDownBusqueda, montoDescuento,
        reiniciarClienteYMedioPago, totalConDescuento, totalVenta, valorTeclado, vuelto,
        vueltoMixto
      } = useLectores({
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
      });

      // VENTAS EN ESPERA (PARK SALES)  ->  ./pos/useVentasEnEspera.js
      const {
        aparcarVentaActual, avisarPedidosDevueltos, borrarVentaEspera, recuperarVentaEspera
      } = useVentasEnEspera({
        carrito, clienteActual, guardarVentasEnEsperaLS, medioPago, mostrarPago, notificar,
        pedidosCargadosAlCarrito, reiniciarClienteYMedioPago, setCarrito, setClienteActual,
        setModalVentasEspera, setMostrarPago, setPedidosCargadosAlCarrito, totalVenta,
        ventasEnEspera
      });

      // CLIENTE & GESTIÓN DE CRÉDITOS  ->  ./pos/useCreditoCliente.js
      const {
        abrirModuloCobroDeudas, cargarPagosRecientes, handleGuardarNuevoCliente,
        obtenerOCrearCliente, recargarDeudores
      } = useCreditoCliente({
        bodegaId, desconocidoCacheRef, enLinea, esModoDemo, formCliente, modalCobrarDeudas,
        notificar, sbClient, setBoletasDeudor, setBoletasDeudores, setBusquedaDeudores,
        setCargandoDeudores, setClienteActual, setClienteEditando, setClientesLista,
        setDeudorSeleccionado, setDniCliente, setFiltroDeudores, setFormCliente,
        setModalCobrarDeudas, setModalNuevoCliente, setOrdenDeudores, setPagoRegistrado,
        setPagosRecientes
      });

      // CUENTAS POR PAGAR (deuda de la bodega con proveedores)  ->  ./pos/useCuentasPorPagar.js
      const {
        abrirCuentasPorPagar, handleGuardarNuevoProveedor, registrarMovimientoProveedor
      } = useCuentasPorPagar({
        bodegaId, esModoDemo, formProveedor, montoMovimientoProveedor, notificar,
        proveedorSeleccionado, sbClient, setFormProveedor, setModalCuentasPagar,
        setModalNuevoProveedor, setMontoMovimientoProveedor, setProveedorSeleccionado,
        setProveedoresLista
      });

      // CLIENTES (editar, exportar; se usan desde Fiados)  ->  ./pos/useClientes.js
      const {
        abrirBuscarClientePOS, abrirEdicionCliente, clientesFiltradosPOS, descargarEstadoCuenta,
        enviarEstadoCuentaWhatsApp, exportarClientesExcel, guardarEdicionCliente,
        procesarPagoDeudaCliente, seleccionarClientePOS, seleccionarDeudor
      } = useClientes({
        bodegaId, bodegaNombre, boletasPendientesDeuda, busquedaClientePOS, cajeroSeleccionado,
        cargarPagosRecientes, clienteActual, clienteEditando, clientesLista, deudorSeleccionado,
        esModoDemo, formEditarCliente, montoAbonoDeuda, notificar, obtenerOCrearCliente,
        recargarDeudores, sbClient, setBoletasDeudor, setBusquedaClientePOS, setCargandoClientes,
        setCargandoDetalleDeudor, setClienteActual, setClienteEditando, setClientesLista,
        setConfirmandoPagoDeudor, setDeudorSeleccionado, setDniCliente, setFormEditarCliente,
        setGuardandoEdicionCliente, setModalBuscarCliente, setMontoAbonoDeuda,
        setMostrarHistorialCompletoDeuda, setPagoRegistrado, setPagosRecientes
      });

      // INVENTARIO INICIAL (carga de varios productos a la vez)  ->  ./pos/useInventarioInicial.js
      const {
        actualizarCodigoEanFila, actualizarCodigoEanPackFila, actualizarFilaInventario,
        buscarProductoExistente, desvincularFilaInventario, eliminarFilaInventario,
        guardarInventarioInicial, subiendoFotoFilaIdx, subirFotoFilaInventario,
        sugerenciasMaestroParaFila, sugerenciasParaFila, sugerenciasParaFilaPack,
        usarSugerenciaMaestraEnFila, vincularProductoExistenteEnFila
      } = useInventarioInicial({
        bodegaId, cargarProductos, catalogoDemoInicial, catalogoDemoRef, catalogoMaestroDisponible,
        esBarberia, esModoDemo, filaInventarioExpandidaIdx, filaInventarioVacia, filasInventario,
        modalInventarioInicial, notificar, pasoInventario, productosBusqueda, sbClient, sesion,
        setCargandoMaestroImport, setCatalogoMaestroDisponible, setFilaInventarioExpandidaIdx,
        setFilasInventario, setGuardandoInventario, setModalInventarioInicial, setPasoInventario
      });

      // EDITAR / DESACTIVAR PRODUCTO  ->  ./pos/useEditarProducto.js
      const {
        abrirEdicionProducto, desactivarProducto, guardarEdicionProducto
      } = useEditarProducto({
        busqueda, cargarProductos, catalogoDemoRef, esBarberia, esModoDemo, formEditarProducto,
        notificar, pedirConfirmacion, productoEditando, sbClient, setFormEditarOriginal,
        setFormEditarProducto, setGuardandoEdicionProducto, setModalEditarProducto,
        setProductoEditando, setTabEditarProducto
      });

      // MERMAS (pérdidas de producto: vencido, roto, robado, etc.)  ->  ./pos/useMermasYToma.js
      const {
        abrirEscanerParaMerma, abrirTomaInventario, actualizarPendienteConteo,
        actualizarStockContado, agregarHallazgo, agregarProductoAConteo, cerrarModalMerma,
        continuarARevisionInventario, elegirProductoMerma, guardarTomaInventario,
        promoverAActivoConteo, quitarHallazgo, quitarProductoDeConteo, registrarMermaProducto,
        vaciarConteoInventario
      } = useMermasYToma({
        bodegaId, busqueda, cajeroSeleccionado, cargarProductos, catalogoDemoRef,
        claveConteoGuardado, esModoDemo, filasTomaInventario, formMerma, notificar,
        pedirConfirmacion, productoEscaneadoId, productos, sbClient, setBusquedaMerma,
        setConteoFisicoBusqueda, setFilaEscaneandoIndex, setFilasTomaInventario,
        setFocoPendienteConteo, setFormMerma, setGuardandoMerma, setGuardandoTomaInventario,
        setMetodoForzado, setModalEscaner, setModalMerma, setModalTomaInventario, setModoEscaner,
        setPasoTomaInventario, setProductoEscaneadoId, setTomaInventarioBusqueda,
        setTomaInventarioCategoria
      });

      // HISTORIAL DE TOMAS DE INVENTARIO (comparar cuadres a lo largo del tiempo)  ->  ./pos/useHistorialTomas.js
      const {
        abrirHistorialInventario, cargarHistorialInventarioPorRango, historialInventarioAgrupado
      } = useHistorialTomas({
        bodegaId, historialInventario, historialInventarioBusqueda, historialInventarioSoloDif,
        notificar, sbClient, setCargandoHistorialInventario, setFechaFinHistInventario,
        setFechaInicioHistInventario, setHistorialInventario, setHistorialInventarioBusqueda,
        setHistorialInventarioSoloDif, setModalHistorialInventario
      });

      // ENTRADA DE MERCADERÍA (COMPRAS)  ->  ./pos/useEntradaMercaderia.js
      const {
        abrirEntradaMercaderia, abrirProductoNuevoEntrada, agregarItemEntradaMercaderia,
        cambiarTipoEntrada, cerrarModalEntradaMercaderia, crearProductoInlineCompra,
        editarLineaEntrada, elegirProductoEntrada, guardarEntradaMercaderia, pedirCerrarEntrada,
        quitarItemEntradaMercaderia
      } = useEntradaMercaderia({
        bodegaId, cajeroSeleccionado, cargarProductos, catalogoDemoInicial, catalogoDemoRef,
        categoriasDB, compraCabecera, compraItemTemp, compraItems, esModoDemo, guardandoEntrada,
        idsNuevosCompra, notificar, nuevoProductoInlineCompra, pedirConfirmacion, productos,
        proveedoresLista, refrescarProductosPorId, sbClient, setBusquedaCompra, setCompraCabecera,
        setCompraItemTemp, setCompraItems, setEntradaRegistrada, setFiltroCompra,
        setGuardandoEntrada, setGuardandoProductoInlineCompra, setIdsNuevosCompra,
        setModalEntradaMercaderia, setNuevoProductoInlineCompra, setProductos, setProveedoresLista,
        setResaltadoCompra
      });

      // HISTORIAL DE VENTAS DEL DÍA & ANULACIÓN  ->  ./pos/useHistorialVentas.js
      const {
        abrirHistorialDelDia, cargarHistorialPorRango, elegirAtajoHistorial, etiquetaDiaHistorial,
        nombreClienteHistorial
      } = useHistorialVentas({
        bodegaId, esModoDemo, notificar, sbClient, setAtajoHistorial, setBusquedaBoletaHistorial,
        setCargandoHistorial, setFechaFinHistorial, setFechaInicioHistorial, setLimiteHistorial,
        setMenuVentaHistorial, setModalHistorial, setVentaDetalleHistorial, setVentasDelDia,
        ventasDemoRef
      });

      // DASHBOARD DE VENTAS (detallado, solo Administrador)  ->  ./pos/useDashboard.js
      const {
        abrirDashboard, anularVentaHoy, cargarDashboard, dashStats, exportarDashboardExcel,
        exportarVentasExcel
      } = useDashboard({
        bodegaId, busqueda, cargarProductos, catalogoDemoRef, clienteActual, clientesDeuda,
        clientesLista, combos, diasAnioDash, esModoDemo, fechaFinDash, fechaFinHistorial,
        fechaInicioDash, fechaInicioHistorial, notificar, pedirConfirmacion, pedirTexto,
        proveedoresDeudaDash, resumenPeriodo, sbClient, setCargandoDashboard, setClienteActual,
        setClientesDeuda, setClientesLista, setCombosVendidos, setDiasAnioDash, setDiasAnioRango,
        setFechaFinDash, setFechaInicioDash, setMesCalendario, setModalDashboard,
        setProveedoresDeudaDash, setResumenPeriodo, setVentasDelDia, ventasDelDia, ventasDemoRef
      });

      // ARQUEO Y CIERRE DE CAJA  ->  ./pos/useCajaYCobro.js
      const {
        abrirCajaNueva, abrirCierreCaja, abrirHistorialCierres, cambiarConteo,
        cargarHistorialCierresPorRango, confirmarCierreConArqueo, consultarTurnosAbiertos,
        elegirAtajoCierres, enviarBoletaWhatsApp, handleAbrirTurno, handleCobrar,
        retomarTurnoViejo, unirseACaja, verificarTurno
      } = useCajaYCobro({
        arqueoEsperado, avisoTurnoViejo, barberoVentaId, bodegaDireccion, bodegaId, bodegaNombre,
        bodegaTelefono, busqueda, cajeroSeleccionado, cargarProductos, carrito, catalogoDemoRef,
        cierreAlRetomar, clienteActual, efectivoRequeridoMixto, enLinea, esBarberia, esModoDemo,
        expandirLineaCarrito, guardarVentasPendientesLS, intentoVentaRef, listaCajeros, medioPago,
        modalTurno, montoApertura, montoConteoEfectivo, montoDescuento, montoMixtoOtro,
        montoMixtoRecibido, montoRecibido, notificar, pedidosCargadosAlCarrito, pedirConfirmacion,
        refrescarProductosPorId, registrarVentaAtomica, reiniciarClienteYMedioPago, sbClient,
        sesion, setArqueoEsperado, setAtajoCierres, setAvisoTurnoViejo, setBarberoVentaId,
        setCajasAbiertasAviso, setCajeroSeleccionado, setCampoTeclado, setCargandoCierres,
        setCarrito, setCierreAlRetomar, setCierreDetalle, setCierresCaja, setClienteActual,
        setClientesLista, setConteoAbierto, setConteoEfectivo, setDescuentoTipo, setDescuentoValor,
        setFechaFinCierres, setFechaInicioCierres, setModalCierreCaja, setModalHistorialCierres,
        setModalNuevoCliente, setModalTurno, setMontoConteoEfectivo, setMontoMixtoOtro,
        setMontoMixtoRecibido, setMontoRecibido, setMostrarPago, setMostrarResumenMobile,
        setPedidosCargadosAlCarrito, setPedidosRetirar, setProcesandoVenta, setProductos,
        setResumenCierre, setSoloConDiferenciaCierres, setTurnoActivo, setUltimoCierre,
        setVentaCompletada, totalConDescuento, totalVenta, turnoActivo, usuarioActivo,
        ventasDemoRef, ventasPendientesSync, verificarSesionVigente
      });

      // IMPRESIÓN DIRECTA POR BLUETOOTH (ticketera térmica)  ->  ./pos/useImpresoraBluetooth.js
      const {
        imprimirBoletaBluetooth
      } = useImpresoraBluetooth({
        bodegaDireccion, bodegaNombre, bodegaTelefono, notificar
      });

      // Completa "tarde" ahora que todo está declarado: los hooks de src/pos/ lo leen
      // solo dentro de funciones y efectos, nunca mientras se dibuja.
      Object.assign(tarde, {
        actualizarCodigoEanFila, actualizarCodigoEanPackFila, agregarAlCarrito, agregarComboAlCarrito, agregarProductoAConteo, aparcarVentaActual, buscarProductoExistente, consultarTurnosAbiertos, elegirProductoEntrada, elegirProductoMerma, obtenerOCrearCliente, reiniciarClienteYMedioPago, verificarTurno
      });

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
                  <p className="text-xs text-stone-500">{authTab === 'admin' ? 'Ingresa con tu cuenta de administrador' : 'Ingresa con tu cuenta de Google para continuar'}</p>
                </div>

                {authTab === 'login' && (
                <div className="space-y-5">
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
                </div>
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
          className={`relative flex h-screen text-stone-900 font-sans select-none overflow-hidden ${(!enLinea || ventasPendientesSync.length > 0) ? 'pt-7' : ''}`}
          style={{ background: '#ebf0ff' }}
        >

          {/* Toast */}
          {toast.visible && (
            <div className={`fixed top-[4.75rem] inset-x-4 md:top-4 md:inset-x-auto md:right-4 md:max-w-xs z-[100] pointer-events-none flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border-l-4 bg-white text-xs font-semibold ${toast.tipo === 'error' ? 'border-rose-500 text-rose-700' : 'border-emerald-500 text-emerald-700'}`}>
              <i className={`fa-solid ${toast.tipo === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-sm shrink-0`}></i>
              {toast.texto}
            </div>
          )}

          {versionNueva && !avisoVersionOculto && (
            <div role="status" className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:max-w-sm z-[95] flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-[#e6e9f5] shadow-2xl">
              <i className="fa-solid fa-rotate text-[#5b4bd6] shrink-0"></i>
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


          {/* Escritorio: riel de íconos en el borde izquierdo (el catálogo se corre a la derecha). */}
          <RielLateral
            opciones={[
              { clave: 'vender', etiqueta: 'Vender', accion: () => {}, activo: true },
              { clave: 'fiados', etiqueta: 'Fiados', accion: abrirDesdeMenu(abrirModuloCobroDeudas) },
              { clave: 'historial', etiqueta: 'Historial', accion: abrirDesdeMenu(abrirHistorialDelDia) },
              !esBarberia && { clave: 'inventario', etiqueta: 'Toma de inventario', accion: abrirDesdeMenu(abrirTomaInventario) },
              esAdmin && { clave: 'dashboard', etiqueta: 'Dashboard de ventas', accion: abrirDesdeMenu(abrirDashboard) },
            ].filter(Boolean)}
            onMas={() => { setBusquedaMenu(''); setIndiceMenu(0); setMenuMas(true); }}
            paletaAbierta={menuMas && menuEnRiel}
            activa={modalCobrarDeudas ? 'fiados' : modalHistorial ? 'historial' : modalTomaInventario ? 'inventario' : modalDashboard ? 'dashboard' : null}
            ranuraRef={setRanuraRiel}
          />

          {/* Columna Central: Catálogo (Order Line) */}
          <div className="flex-1 flex flex-col overflow-hidden md:ml-[36px]">
            <header className="flex items-center justify-between mx-3 mt-3 px-2 md:px-3 py-2 gap-3">
              <div className="flex items-center gap-3 min-w-0 max-w-full pl-1">
                <img src="/logo-horizontal-color.svg" width="2068" height="642" alt="Kaserita" className="h-7 md:h-8 w-auto shrink-0" />
                <span className="w-px h-[30px] bg-[#5b4bd6]/20 shrink-0"></span>
                <div className="min-w-0">
                  <h1 className="text-sm md:text-[15px] font-bold text-[#2d284b] leading-tight tracking-tight truncate">{bodegaNombre}</h1>
                  <p className="text-xs text-[#6b6890] truncate leading-tight mt-px">
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
                    className="btn-noise hidden sm:inline-flex text-xs font-medium text-[#2d284b]"
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
                  className="md:hidden w-10 h-10 flex items-center justify-center bg-white border border-stone-200 rounded-xl text-stone-700 hover:text-stone-900 shadow-sm transition"
                  title="Más opciones"
                >
                  <i className="fa-solid fa-bars"></i>
                </button>
              </div>
            </header>

            <div className="flex-1 flex flex-col overflow-hidden p-3 md:p-4">
              {/* Panel blanco del catálogo: barra única (categoría + buscador + combos + pedidos) y grilla. */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl p-3 md:p-4 gap-3 relative z-10">
                {/* Barra: selector Productos | Combos, categoría, buscador con contador y cámara, y "Por retirar". */}
                <div className="flex flex-wrap xl:flex-nowrap items-center gap-2.5 shrink-0">
                  <div className="w-full md:w-auto shrink-0 inline-flex items-center gap-0.5 p-1 h-[42px] md:h-[46px] rounded-full bg-[#ebf0ff]">
                    <div className="relative h-full flex-1 md:flex-none">
                      <button
                        onClick={() => {
                          if (categoriaFiltro === '__COMBOS__') { setCategoriaFiltro('TODOS'); return; }
                          setBusquedaCategoria(''); setMenuCategoriasAbierto((v) => !v);
                        }}
                        aria-pressed={categoriaFiltro !== '__COMBOS__'}
                        aria-haspopup="listbox"
                        title="Productos: elegir categoría"
                        className={claseSegmento(categoriaFiltro !== '__COMBOS__')}
                      >
                        <i className="fa-solid fa-table-cells-large text-[12px]"></i>
                        {categoriaFiltro === '__COMBOS__' ? (
                          <span>Productos</span>
                        ) : (
                          <>
                            <span className="max-w-[140px] truncate text-[13px] font-bold text-[#2d284b]">{categoriaFiltro === 'TODOS' ? 'Todos' : categoriaFiltro}</span>
                            <i className={`fa-solid fa-chevron-down text-[9px] transition-transform ${menuCategoriasAbierto ? 'rotate-180' : ''}`}></i>
                          </>
                        )}
                      </button>
                      {menuCategoriasAbierto && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setMenuCategoriasAbierto(false)}></div>
                          <div className="absolute top-full left-0 mt-2 w-64 bg-white/80 backdrop-blur-2xl border border-white/90 rounded-3xl shadow-[0_24px_60px_-24px_rgba(60,20,120,0.28)] ring-1 ring-[#5b4bd6]/5 p-2 z-30">
                            <div className="relative mb-2">
                              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] text-stone-400"></i>
                              <input
                                type="text"
                                value={busquedaCategoria}
                                onChange={(e) => setBusquedaCategoria(e.target.value)}
                                placeholder="Buscar categoría"
                                className="w-full bg-white rounded-full pl-9 pr-3 py-2 text-[13px] text-stone-900 placeholder-stone-400 ring-1 ring-[#5b4bd6]/10 focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
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
                                        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-full text-left text-sm transition ${activo ? 'bg-[#dde4fa] text-[#2d284b] font-bold' : 'text-stone-800 font-medium hover:bg-[#5b4bd6]/5'}`}
                                      >
                                        <span className="truncate">{cat === 'TODOS' ? 'Todos' : cat}</span>
                                        <span className={`text-xs shrink-0 tabular-nums ${activo ? 'bg-white text-[#5b4bd6] font-semibold px-2 py-0.5 rounded-full' : 'text-stone-400'}`}>{cantidad}</span>
                                      </button>
                                      {cat === 'TODOS' && !q && <div className="h-px bg-[#5b4bd6]/10 mx-3.5 my-1.5"></div>}
                                    </React.Fragment>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {combosActivos.length > 0 && (
                      <div className="flex-1 md:flex-none h-full">
                      <button
                        onClick={() => setCategoriaFiltro('__COMBOS__')}
                        aria-pressed={categoriaFiltro === '__COMBOS__'}
                        title="Combos"
                        className={claseSegmento(categoriaFiltro === '__COMBOS__')}
                      >
                        <i className="fa-solid fa-gift text-[12px]"></i>
                        <span>Combos</span>
                        <span className="tabular-nums">{combosDisponibles}</span>
                      </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 md:min-w-[290px] flex items-center h-[42px] md:h-[46px] pl-4 pr-1 bg-white border border-[#dde4fa] rounded-full transition focus-within:border-[#5b4bd6] focus-within:ring-4 focus-within:ring-[#5b4bd6]/10 group/bus">
                    <i className="fa-solid fa-magnifying-glass text-[13px] text-[#8f8cb0] group-focus-within/bus:text-[#5b4bd6] transition shrink-0 mr-2"></i>
                      <input
                        ref={inputBusquedaRef}
                        type="text"
                        value={busqueda}
                        onChange={(e) => {
                          setBusqueda(e.target.value);
                          // En la pestaña Combos se filtran los combos (por nombre o por sus productos);
                          // si ninguno coincide (p. ej. al escanear un código) se pasa a Todos.
                          if (e.target.value && categoriaFiltro === '__COMBOS__' && !combosActivos.some((c) => comboCoincide(c, e.target.value))) {
                            setCategoriaFiltro('TODOS');
                          }
                        }}
                        onKeyDown={handleKeyDownBusqueda}
                        placeholder="Busca o escanea un código"
                        className="flex-1 min-w-0 text-ellipsis bg-transparent text-[13px] md:text-[14px] font-medium text-stone-900 placeholder:text-[#8f8cb0] placeholder:font-normal focus:outline-none"
                      />
                      {busqueda && (
                        <>
                          <span className={`${categoriaFiltro === '__COMBOS__' ? 'hidden' : 'hidden sm:inline-flex'} shrink-0 text-xs font-bold text-[#2d284b] bg-[#edf0fa] rounded-full px-2.5 py-1.5 tabular-nums`}>
                            {productosFiltrados.length} {productosFiltrados.length === 1 ? 'resultado' : 'resultados'}
                          </span>
                          <button aria-label="Limpiar búsqueda"
                            onClick={() => {
                              setBusqueda('');
                              cargarProductos('');
                              inputBusquedaRef.current?.blur();
                            }}
                            className="shrink-0 w-[26px] h-[26px] flex items-center justify-center bg-[#f2f3f7] hover:bg-[#e5e9f6] text-[#6b6890] rounded-full transition"
                          ><i className="fa-solid fa-xmark text-xs"></i></button>
                        </>
                      )}
                      {!busqueda && (
                        <span className="shrink-0 pr-2.5 text-[12px] font-bold text-[#8f8cb0] tabular-nums" title={categoriaFiltro === '__COMBOS__' ? 'Combos' : 'Productos'}>
                          {categoriaFiltro === '__COMBOS__' ? combosActivos.length : productosFiltrados.length}
                        </span>
                      )}
                      <button
                        onClick={abrirEscanerParaVenta}
                        title="Escanear código de barras con la cámara"
                        aria-label="Escanear código de barras con la cámara"
                        className="shrink-0 flex items-center justify-center w-[34px] h-[34px] md:w-[38px] md:h-[38px] rounded-full text-white bg-gradient-to-br from-[#9687f5] to-[#5b4bd6] hover:brightness-105 active:scale-95 transition"
                      >
                        <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
                      </button>
                  </div>
                    <button
                      onClick={abrirPedidosRetirar}
                      title="Pedidos por retirar (clientes con cuenta)"
                      aria-label="Pedidos por retirar"
                      className="relative flex items-center justify-center h-[42px] md:h-[46px] w-[42px] md:w-[46px] shrink-0 bg-white hover:bg-[#ebf0ff] text-[#5f5d76] rounded-full border border-[#dde4fa] transition"
                    >
                      <i className="fa-solid fa-bag-shopping text-[16px]"></i>
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

              {/* Grilla de Productos */}
              {/* pb-24 en mobile: dejar espacio para que la última fila no
                  quede tapada por la barra flotante del carrito (fixed
                  bottom-3) ni pegada contra el borde de la pantalla. */}
              {/* pt-1.5 pl-1: margen para que el hover (sube 2px + sombra + anillo)
                  no se corte contra el borde del contenedor con scroll. */}
              <div className="flex-1 overflow-y-auto pt-1.5 pl-1 pr-1 pb-24 md:pb-6 hide-scrollbar">
                {categoriaFiltro === '__COMBOS__' ? (
                  <CombosCatalogo
                    combos={combosActivos}
                    estadoCombos={estadoCombos}
                    enCarrito={cantidadEnCarritoPorCombo}
                    busqueda={busqueda}
                    esAdmin={esAdmin}
                    onAgregar={(combo) => {
                      const est = estadoCombos.get(combo.id) || { unidades: Infinity };
                      if ((cantidadEnCarritoPorCombo.get(combo.id) || 0) + 1 > est.unidades) {
                        notificar(`No hay stock para más de ${est.unidades} de este combo.`, 'error');
                        return;
                      }
                      agregarComboAlCarrito(combo);
                    }}
                    onQuitar={(combo) => cambiarCantidadCarrito(`combo::${combo.id}`, -1)}
                    onCrear={abrirModalCombos}
                  />
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
                <div className="md:hidden fixed inset-x-0 bottom-0 h-28 z-30 pointer-events-none bg-gradient-to-t from-[#f8f9fd] via-[#f8f9fd]/70 to-transparent"></div>
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
                        <span className="-ml-3 w-9 h-9 rounded-full ring-2 ring-white/90 bg-[#2d284b] text-white text-[11px] font-bold tabular-nums flex items-center justify-center shrink-0">+{carrito.length - 2}</span>
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
                    <span className="flex items-center justify-center w-11 h-11 rounded-full bg-[#5b4bd6] text-white shrink-0 shadow-[0_4px_10px_-4px_rgba(45,40,75,0.6)]">
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
                    en_camino: { texto: 'En camino', color: 'text-[#5b4bd6]', dot: 'bg-[#5b4bd6]' },
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
                        <div className="rounded-lg bg-[#ebf0ff] px-3 py-2 text-xs">
                          <p className="font-semibold text-[#2d284b]">
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
                        <div className="rounded-lg bg-[#ebf0ff] px-3 py-2 space-y-1 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 font-semibold text-[#2d284b]">
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

                      {esDomicilioPedido && !esHistorial && urlMapa(p.entrega_lat, p.entrega_lng) && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => enviarPedidoAlRepartidor(p)}
                            className="flex-1 py-2 rounded-lg bg-[#5b4bd6] hover:bg-[#473bb5] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                          >
                            <IconoTrazo nombre="chat" className="w-3.5 h-3.5" /> Enviar al repartidor
                          </button>
                          <a
                            href={urlMapa(p.entrega_lat, p.entrega_lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 rounded-lg bg-[#ebf0ff] hover:bg-[#dde4fa] text-[#2d284b] text-xs font-semibold flex items-center gap-1.5 transition"
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
                  <div key={v.id} className="rounded-[22px] border border-[#edeff8] bg-gradient-to-br from-[#f5f6fc] to-white p-3.5">
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
                        className="flex-1 py-2.5 bg-[#5b4bd6] hover:bg-[#473bb5] text-white text-[13px] font-semibold rounded-full transition"
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
            <div className={`${mostrarPago ? 'hidden md:flex' : 'flex'} flex-wrap md:flex-nowrap items-center justify-between gap-y-2.5 px-4 pt-2 pb-3 md:py-3 bg-white border-b border-stone-100 shrink-0`}>
              <h2 className="text-[19px] md:text-sm font-bold md:font-extrabold tracking-tight text-stone-900">
                <span className="md:hidden">Carrito</span>
                <span className="ml-1.5 md:ml-0 text-[13px] md:text-sm text-stone-400 font-semibold">{carrito.reduce((a, c) => a + c.cantidad, 0)} ítems</span>
              </h2>
              <button
                onClick={() => setMostrarResumenMobile(false)}
                className="md:hidden w-9 h-9 rounded-full bg-[#ebf0ff] hover:bg-[#dde4fa] text-stone-500 flex items-center justify-center transition"
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
                    className="px-3.5 py-2.5 md:py-1.5 rounded-full bg-[#ebf0ff] hover:bg-[#dde4fa] text-xs text-[#2d284b] font-semibold transition"
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

            {/* Celular, paso de cobro: pantalla propia con el total grande arriba. Los productos
                se resumen y se abren con "Ver detalle de la venta". */}
            {mostrarPago && (
              <div className="md:hidden shrink-0 px-3.5 pt-2 pb-1 space-y-2.5 bg-white">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setMostrarPago(false); reiniciarClienteYMedioPago(); }}
                    className="flex items-center gap-1 pl-2 pr-3 py-2 rounded-full bg-[#ebf0ff] hover:bg-[#dde4fa] text-[13px] font-semibold text-[#2d284b] transition"
                  >
                    <IconoTrazo nombre="back" className="w-[15px] h-[15px]" /> Volver
                  </button>
                  <h2 className="text-[15px] font-bold text-stone-900">Cobro</h2>
                  <span className="px-2.5 py-1.5 rounded-full bg-[#ebf0ff] text-[11.5px] font-semibold text-[#2d284b]">
                    {carrito.reduce((a, c) => a + c.cantidad, 0)} ítems
                  </span>
                </div>
                <div className="relative overflow-hidden rounded-[22px] px-4 pt-3.5 pb-3 text-white bg-gradient-to-br from-[#7466e8] to-[#2d284b]">
                  <span className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10"></span>
                  <p className="relative text-[11.5px] font-semibold opacity-90">Total a cobrar</p>
                  <p className="relative text-[36px] leading-[1.1] font-extrabold tracking-tight tabular-nums">
                    <small className="text-[17px] font-semibold opacity-80 mr-1.5">S/</small>{formatoSoles(totalConDescuento)}
                  </p>
                  {montoDescuento > 0 && (
                    <p className="relative text-[11.5px] opacity-90 mt-0.5 tabular-nums">
                      Subtotal S/ {totalVenta.toFixed(2)} · Descuento - S/ {montoDescuento.toFixed(2)}
                    </p>
                  )}
                  <button
                    type="button"
                    aria-expanded={verDetalleCobro}
                    onClick={() => setVerDetalleCobro((v) => !v)}
                    className="relative mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-xs font-semibold transition"
                  >
                    {verDetalleCobro ? 'Ocultar detalle' : 'Ver detalle de la venta'}
                    <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${verDetalleCobro ? 'rotate-180' : ''}`}></i>
                  </button>
                </div>
              </div>
            )}

            {/* Recordatorio fijo de pedidos por retirar -- vive pegado arriba
                de la lista de ítems, no solo como badge en un botón, para que
                no se pierda de vista mientras el cajero sigue atendiendo el
                carrito normal. */}
            {pedidosPorRetirarPendientes === 0 && pedidosListosSinCargar > 0 && (
              <button
                onClick={abrirPedidosRetirar}
                className={`shrink-0 mx-3 mt-2.5 ${mostrarPago ? 'hidden md:flex' : 'flex'} items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition text-left`}
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
                className={`shrink-0 mx-3 mt-2.5 ${mostrarPago ? 'hidden md:flex' : 'flex'} items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition text-left`}
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
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${barberoVentaId === c.id ? 'bg-[#5b4bd6] text-white' : 'bg-[#ebf0ff] text-[#2d284b] hover:bg-[#dde4fa]'}`}
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lista Ítems */}
            {/* Celular al cobrar: la lista se achica (unas 2 filas) para dejar espacio a los medios de pago */}
            <div className={`overflow-y-auto p-2.5 space-y-1.5 hide-scrollbar ${mostrarPago ? `${verDetalleCobro ? 'max-h-[24vh] pb-2.5' : 'hidden'} md:block md:max-h-none md:flex-1 md:pb-16` : 'flex-1 pb-16'}`}>
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
                    className="flex items-center gap-2.5 p-2 bg-[#f7f9ff] rounded-[20px]"
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

                    <div className="flex items-center bg-white rounded-full ring-1 ring-[#5b4bd6]/10 shrink-0">
                      <button
                        onClick={() => cambiarCantidadCarrito(item.claveCarrito || item.productoId, -1)}
                        className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-[#5b4bd6] hover:bg-[#ebf0ff] rounded-full transition"
                        aria-label="Quitar uno"
                      >
                        <IconoTrazo nombre="minus" className="w-3.5 h-3.5" />
                      </button>
                      <span className="min-w-[18px] text-center text-[13px] font-bold text-stone-900 tabular-nums">
                        {item.cantidad}
                      </span>
                      <button
                        onClick={() => cambiarCantidadCarrito(item.claveCarrito || item.productoId, 1)}
                        className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-[#5b4bd6] hover:bg-[#ebf0ff] rounded-full transition"
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
                ? 'pt-4 scroll-pb-44 bg-white border-t border-[#dde4fa] shadow-[0_-14px_26px_-20px_rgba(40,20,100,0.4)]'
                : '-mt-10 pt-14 backdrop-blur-xl bg-gradient-to-b from-white/60 to-white/90'}`}
              style={mostrarPago ? undefined : { WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 44px)', maskImage: 'linear-gradient(to bottom, transparent 0, black 44px)' }}
            >
              {!mostrarPago ? (
                <>
                  <div className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] px-4 py-3 space-y-1.5">
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
                    <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-[#5b4bd6]/10">
                      <span className="text-xs font-semibold text-[#2d284b]">
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
                        ? 'bg-[#e6e9f5] text-[#8b869a] cursor-not-allowed'
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
                className="self-start hidden md:flex items-center gap-1 pl-2 pr-3 py-1.5 rounded-full bg-[#ebf0ff] hover:bg-[#dde4fa] text-[13px] font-semibold text-[#2d284b] transition"
              >
                <IconoTrazo nombre="back" className="w-[15px] h-[15px]" /> Volver
              </button>

              <div className="grid grid-cols-3 gap-1.5 md:gap-2 p-1 rounded-[18px] bg-[#ebf0ff] md:p-0 md:rounded-none md:bg-transparent">
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
                    className={`flex flex-row md:flex-col items-center justify-center gap-1.5 h-11 md:h-auto md:pt-3 md:pb-2.5 text-[12.5px] font-semibold rounded-[14px] md:rounded-[20px] transition ${
                      medioPago === m.id
                        ? 'bg-[#5b4bd6] text-white'
                        : 'bg-transparent md:bg-[#ebf0ff] hover:bg-[#dde4fa] text-stone-600'
                    }`}
                  >
                    <IconoTrazo nombre={m.icono} className={`w-[18px] h-[18px] md:w-5 md:h-5 ${medioPago === m.id ? 'text-white' : 'text-[#5b4bd6]'}`} />
                    {m.texto}
                  </button>
                ))}
              </div>

              {medioPago === 'EFECTIVO' && (
                <div data-campo-pago className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] p-3.5">
                  <label className="text-xs font-semibold text-[#2d284b] block mb-2">Paga con</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-14 flex items-center gap-1.5 px-4 rounded-[18px] bg-white ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                      <span className="text-[15px] font-semibold text-stone-400">S/</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        placeholder="0.00"
                        className="w-full min-w-0 bg-transparent text-[28px] font-bold tracking-tight text-stone-900 tabular-nums placeholder:text-[#c1c6da] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCampoTeclado(campoTeclado === 'recibido' ? null : 'recibido')}
                      title="Teclado numérico"
                      className={`shrink-0 w-14 h-14 flex items-center justify-center rounded-[18px] ring-1 ring-[#5b4bd6]/10 transition ${campoTeclado === 'recibido' ? 'bg-[#5b4bd6] text-white' : 'bg-white text-[#5b4bd6] hover:bg-[#f7f9ff]'}`}
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
                        className="px-3.5 py-1.5 rounded-full bg-white ring-1 ring-[#5b4bd6]/10 hover:bg-[#f7f9ff] text-[12.5px] font-semibold text-[#2d284b] transition"
                      >
                        {c.t}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#5b4bd6]/10">
                    <span className="text-xs font-semibold text-[#2d284b]">Vuelto</span>
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
                  className="w-full h-[50px] flex items-center justify-center gap-2 rounded-full bg-white ring-1 ring-[#5b4bd6]/15 hover:bg-[#f7f9ff] text-sm font-semibold text-[#2d284b] transition"
                >
                  <IconoTrazo nombre="qr" className="w-[18px] h-[18px]" /> Mostrar QR de {medioPago === 'YAPE' ? 'Yape' : 'Plin'}
                </button>
              )}

              {medioPago === 'TARJETA' && (
                <div className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] p-3.5 text-center text-[13px] font-semibold text-[#2d284b]">
                  Cobro exacto con tarjeta: S/ {totalConDescuento.toFixed(2)}
                </div>
              )}

              {medioPago === 'CREDITO' && (
                <div className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] p-3.5">
                  <div className="flex items-center gap-2.5 bg-white rounded-[18px] ring-1 ring-[#5b4bd6]/10 px-3 py-2.5">
                    <span className="w-[34px] h-[34px] rounded-full bg-[#dde4fa] text-[#2d284b] text-xs font-bold flex items-center justify-center shrink-0">
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
                    <button type="button" onClick={abrirBuscarClientePOS} className="shrink-0 px-3 py-1.5 rounded-full bg-[#ebf0ff] hover:bg-[#dde4fa] text-[12.5px] font-semibold text-[#5b4bd6] transition">
                      Cambiar
                    </button>
                  </div>
                  {clienteActual && clienteActual.dni !== '99999999' && Number(clienteActual.limite_credito) > 0 && (
                    <div className="h-2 rounded-full bg-[#dce0f3] mt-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#5b4bd6]"
                        style={{ width: `${Math.min(100, Math.max(0, ((Number(clienteActual.saldo_actual) || 0) / Number(clienteActual.limite_credito)) * 100))}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}

              {medioPago === 'MIXTO' && (
                <div data-campo-pago className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] p-3.5">
                  <label className="text-xs font-semibold text-[#2d284b] block mb-2">Monto en tarjeta / otro</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[50px] flex items-center gap-1.5 px-4 rounded-[18px] bg-white ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                      <span className="text-sm font-semibold text-stone-400">S/</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={montoMixtoOtro}
                        onChange={(e) => setMontoMixtoOtro(e.target.value)}
                        placeholder="0.00"
                        className="w-full min-w-0 bg-transparent text-[22px] font-bold tracking-tight text-stone-900 tabular-nums placeholder:text-[#c1c6da] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCampoTeclado(campoTeclado === 'mixtoOtro' ? null : 'mixtoOtro')}
                      title="Teclado numérico"
                      className={`shrink-0 w-[50px] h-[50px] flex items-center justify-center rounded-[18px] ring-1 ring-[#5b4bd6]/10 transition ${campoTeclado === 'mixtoOtro' ? 'bg-[#5b4bd6] text-white' : 'bg-white text-[#5b4bd6] hover:bg-[#f7f9ff]'}`}
                    >
                      <IconoTrazo nombre="calc" className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#5b4bd6]/10">
                    <span className="text-xs font-semibold text-[#2d284b]">Falta en efectivo</span>
                    <span className="text-[22px] font-bold tracking-tight tabular-nums text-stone-900">S/ {efectivoRequeridoMixto.toFixed(2)}</span>
                  </div>

                  {efectivoRequeridoMixto > 0 && (
                    <>
                      <label className="text-xs font-semibold text-[#2d284b] block mt-3 mb-2">Recibe en efectivo</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-[50px] flex items-center gap-1.5 px-4 rounded-[18px] bg-white ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                          <span className="text-sm font-semibold text-stone-400">S/</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={montoMixtoRecibido}
                            onChange={(e) => setMontoMixtoRecibido(e.target.value)}
                            placeholder="0.00"
                            className="w-full min-w-0 bg-transparent text-[22px] font-bold tracking-tight text-stone-900 tabular-nums placeholder:text-[#c1c6da] focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setCampoTeclado(campoTeclado === 'mixtoRecibido' ? null : 'mixtoRecibido')}
                          title="Teclado numérico"
                          className={`shrink-0 w-[50px] h-[50px] flex items-center justify-center rounded-[18px] ring-1 ring-[#5b4bd6]/10 transition ${campoTeclado === 'mixtoRecibido' ? 'bg-[#5b4bd6] text-white' : 'bg-white text-[#5b4bd6] hover:bg-[#f7f9ff]'}`}
                        >
                          <IconoTrazo nombre="calc" className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#5b4bd6]/10">
                    <span className="text-xs font-semibold text-[#2d284b]">Vuelto</span>
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
                      className="flex items-center gap-1.5 text-[13px] text-[#5b4bd6] hover:text-[#2d284b] font-semibold transition"
                    >
                      <IconoTrazo nombre="etiqueta" className="w-[15px] h-[15px]" /> Aplicar descuento
                    </button>
                  )
                ) : (
                  <div className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#2d284b]">Descuento</span>
                      <button
                        type="button"
                        onClick={() => { setDescuentoTipo(null); setDescuentoValor(''); }}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-white rounded-full ring-1 ring-[#5b4bd6]/10 p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDescuentoTipo('PORCENTAJE')}
                          className={`w-10 h-9 rounded-full text-xs font-bold transition ${descuentoTipo === 'PORCENTAJE' ? 'bg-[#5b4bd6] text-white' : 'text-stone-500'}`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setDescuentoTipo('MONTO')}
                          className={`w-10 h-9 rounded-full text-xs font-bold transition ${descuentoTipo === 'MONTO' ? 'bg-[#5b4bd6] text-white' : 'text-stone-500'}`}
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
                        className="w-full h-[44px] bg-white ring-1 ring-[#5b4bd6]/10 rounded-[16px] px-4 text-base font-bold text-stone-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5b4bd6]/40"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Total y botón de cobro siempre a la vista: si las opciones de pago no
                  caben en pantallas bajas, lo de arriba hace scroll y esto se queda abajo. */}
              <div className="sticky bottom-0 -mx-4 -mb-4 px-4 pb-4 pt-3 space-y-3 bg-white shadow-[0_-12px_18px_-14px_rgba(40,20,100,0.28)]">
              <div className="hidden md:block bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] px-4 py-3 space-y-1.5">
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
                <div className={`flex items-baseline justify-between ${montoDescuento > 0 ? 'pt-2 border-t border-[#5b4bd6]/10' : ''}`}>
                  <span className="text-xs font-semibold text-[#2d284b]">Total a cobrar</span>
                  <span className="text-[28px] font-bold tracking-tight text-stone-900 tabular-nums">
                    <small className="text-sm text-stone-500 font-semibold mr-1">S/</small>{formatoSoles(totalConDescuento)}
                  </span>
                </div>
              </div>

              <div className="md:hidden">
                <DeslizarParaConfirmar
                  onConfirm={handleCobrar}
                  ocupado={procesandoVenta}
                  disabled={carrito.length === 0 || !turnoActivo || (medioPago === 'EFECTIVO' && vuelto < 0)}
                  texto={medioPago === 'CREDITO' ? 'Desliza para fiar' : 'Desliza para cobrar'}
                  textoBloqueado={!turnoActivo ? 'Abre un turno para cobrar' : (medioPago === 'EFECTIVO' && vuelto < 0) ? `Falta S/ ${Math.abs(vuelto).toFixed(2)}` : ''}
                />
              </div>
              <button
                onClick={handleCobrar}
                disabled={procesandoVenta || carrito.length === 0 || !turnoActivo}
                className={`w-full h-[54px] rounded-full font-semibold text-base transition-all hidden md:flex items-center justify-center gap-2 ${
                  !turnoActivo || procesandoVenta || carrito.length === 0
                    ? 'bg-[#e6e9f5] text-[#8b869a] cursor-not-allowed'
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
              !esBarberia && { grupo: 'Inventario', etiqueta: 'Toma de Inventario', icono: 'fa-clipboard-check', accion: abrirTomaInventario },
              { grupo: 'Inventario', etiqueta: 'Registrar merma', buscar: 'merma perdida vencido roto robo', icono: 'fa-box', accion: () => setModalMerma(true) },
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
              // Administración protegida por PIN en el servidor.
              (!esModoDemo && rolesEnServidor && (rolActivo === 'dueno' || rolActivo === 'administrador')) && (
                elevado
                  ? { grupo: 'Cuenta', etiqueta: 'Bloquear administración', icono: 'fa-lock', accion: soltarAdmin }
                  : {
                      grupo: 'Cuenta', etiqueta: 'Desbloquear administración', icono: 'fa-lock-open', tono: 'amber',
                      insignia: 'PIN',
                      accion: () => {
                        const c = cajeroSeleccionado || listaCajeros.find(esCajeroDelUsuarioActivo);
                        if (c) { setPinConfirmarCajero(''); setCajeroPendientePin(c); }
                      }
                    }
              ),
              (!esModoDemo && rolesEnServidor && elevado && rolActivo === 'dueno' && cajeroSeleccionado) && {
                grupo: 'Cuenta', etiqueta: 'Cambiar mi PIN de administrador', icono: 'fa-key',
                accion: () => { setNuevoPinCajero(''); setModalPinCajero(cajeroSeleccionado); }
              },
              { grupo: 'Cuenta', etiqueta: 'Cerrar Sesión', icono: 'fa-right-from-bracket', tono: 'rose', accion: cerrarSesion },
            ].filter(Boolean);
            // El botón "Abrir Turno" del encabezado ya está visible desde sm (640px);
            // en pantallas más chicas se oculta y solo queda este ítem del menú.
            const esEscritorio = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
            const opcionesMenu = esEscritorio ? opciones.filter((o) => !o.soloMovil) : opciones;

            const cerrarMenu = () => setMenuMas(false);
            const propsPaleta = { opciones: opcionesMenu.map((o) => ({ ...o, accion: abrirDesdeMenu(o.accion) })), busqueda: busquedaMenu, setBusqueda: setBusquedaMenu, indice: indiceMenu, setIndice: setIndiceMenu, onClose: cerrarMenu };

            // Escritorio: la paleta vive dentro del riel (que se ensancha para contenerla).
            if (menuEnRiel) {
              return (
                <>
                  <div className="fixed inset-0 z-[25] bg-[#2d284b]/30 backdrop-blur-[2px]" onClick={cerrarMenu}></div>
                  {ranuraRiel && createPortal(<PaletaMenu {...propsPaleta} oscuro autoFocus />, ranuraRiel)}
                </>
              );
            }

            // Celular: hoja que sube desde abajo.
            return (
              <div className="fixed inset-0 bg-[#2d284b]/45 z-[60] flex items-end" onClick={cerrarMenu}>
                <div
                  className="menu-hoja relative w-full max-h-[85vh] flex flex-col bg-white/95 border-t border-[#dde4fa] rounded-t-3xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-10 h-1 bg-[#c5bcff] rounded-full mx-auto mt-2.5"></div>
                  <PaletaMenu {...propsPaleta} />
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
              <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-xs w-full p-5 shadow-2xl space-y-4 text-center">
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
                        className="w-32 bg-stone-50 border border-stone-200 text-center font-mono font-bold text-xl text-orange-600 p-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
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
                        className="w-32 bg-stone-50 border border-stone-200 text-center font-mono font-bold text-xl text-orange-600 p-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
                        autoFocus
                      />
                      <span className="text-sm font-bold text-stone-700">{tipoVentaSeleccionado === 'PACK' ? 'pack(s)' : 'und'}</span>
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setModalCantidad(false)} className="flex-1 py-2 bg-white/70 rounded-full text-xs font-semibold shadow-sm">Cancelar</button>
                  <button onClick={confirmarCantidadBalanza} className="flex-1 py-2 bg-[#5b4bd6] hover:bg-[#473bb5] text-white rounded-full text-xs font-bold shadow">Aceptar</button>
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
                filaInventarioVacia={filaInventarioVacia}
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
                abrirEdicionCliente={abrirEdicionCliente}
                boletasDeudores={boletasDeudores}
                busquedaDeudores={busquedaDeudores}
                cargandoDetalleDeudor={cargandoDetalleDeudor}
                cargandoDeudores={cargandoDeudores}
                clientesLista={clientesLista}
                confirmandoPagoDeudor={confirmandoPagoDeudor}
                descargarEstadoCuenta={descargarEstadoCuenta}
                deudorSeleccionado={deudorSeleccionado}
                enviarEstadoCuentaWhatsApp={enviarEstadoCuentaWhatsApp}
                esAdmin={esAdmin}
                estadoDeudorSel={estadoDeudorSel}
                etiquetaCuandoTurno={etiquetaCuandoTurno}
                exportarClientesExcel={exportarClientesExcel}
                filtroDeudores={filtroDeudores}
                formEditarCliente={formEditarCliente}
                formatoSoles={formatoSoles}
                guardandoEdicionCliente={guardandoEdicionCliente}
                guardarEdicionCliente={guardarEdicionCliente}
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
                setClienteEditando={setClienteEditando}
                setConfirmandoPagoDeudor={setConfirmandoPagoDeudor}
                setDeudorSeleccionado={setDeudorSeleccionado}
                setFiltroDeudores={setFiltroDeudores}
                setFormEditarCliente={setFormEditarCliente}
                setHojaPagoDeudor={setHojaPagoDeudor}
                setModalCobrarDeudas={setModalCobrarDeudas}
                setModalNuevoCliente={setModalNuevoCliente}
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
                <Suspense fallback={null}>
                  <QRLocal
                    texto={`${KASERITA_DELIVERY_URL}/${sesion.bodega.slug}`}
                    alt="QR del link de pedidos"
                    className="rounded-lg w-full max-w-[320px] h-auto"
                  />
                </Suspense>
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

          {/* Modal: Nuevo Cliente con Límite de Crédito */}
          {/* Modal: Buscar/Seleccionar Cliente (POS) */}
          {modalBuscarCliente && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3 max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2"><span className="w-8 h-8 rounded-xl bg-[#dde4fa] text-[#5b4bd6] flex items-center justify-center text-sm"><i className="fa-solid fa-user"></i></span> Seleccionar cliente</h3>
                  <button aria-label="Cerrar" onClick={() => setModalBuscarCliente(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={busquedaClientePOS}
                  onChange={(e) => setBusquedaClientePOS(e.target.value)}
                  placeholder="Buscar por nombre o DNI..."
                  className="w-full bg-white border border-stone-200/70 shadow-sm rounded-full px-4 py-2 text-sm text-stone-900 shrink-0 focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
                />
                <div className="flex-1 overflow-y-auto hide-scrollbar -mx-1 px-1 space-y-2">
                  <button
                    onClick={() => seleccionarClientePOS({ dni: '99999999', nombre_completo: 'Cliente sin registrar', saldo_actual: 0 })}
                    className="w-full text-left px-4 py-3 bg-white/60 hover:bg-[#ebf0ff] backdrop-blur-xl border border-white/80 rounded-2xl shadow-sm transition"
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
                        className="w-full text-left px-4 py-3 bg-white/60 hover:bg-[#ebf0ff] backdrop-blur-xl border border-white/80 rounded-2xl shadow-sm transition"
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
                  className="shrink-0 w-full py-2 text-xs font-semibold text-[#5b4bd6] hover:underline"
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
            const atajo = (activo) => `px-3 py-1.5 rounded-xl border-[1.5px] text-[12.5px] font-bold transition ${activo ? 'border-[#5b4bd6] bg-[#ebf0ff] text-[#2d284b]' : 'border-stone-200 bg-white hover:bg-[#ebf0ff] hover:border-[#d2d9f5]'}`;
            const esIgual = (v) => !conteoActivo && !montoInvalido && montoNum === v;
            return (
              <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-md w-full shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
                  <div className="bg-white border-b border-stone-100 px-4 sm:px-5 py-3.5 shrink-0 flex items-center gap-3">
                    <span className="w-11 h-11 rounded-[14px] bg-[#ebf0ff] text-[#5b4bd6] grid place-items-center text-xl shrink-0"><i className="fa-solid fa-cash-register"></i></span>
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
                            <button type="button" key={c.id} onClick={() => elegirCajeroTurno(c)} className={`flex items-center gap-3 w-full text-left rounded-2xl border-[1.5px] bg-white px-3 py-2.5 transition hover:bg-[#f8faff] hover:border-[#d2d9f5] ${activo ? 'border-[#5b4bd6] bg-[#f8faff] ring-[3px] ring-[#5b4bd6]/15' : 'border-stone-100'}`}>
                              <span className={`w-[38px] h-[38px] rounded-full grid place-items-center text-[13px] font-extrabold shrink-0 ${esElevado(c) ? 'bg-gradient-to-br from-[#ffd45c] to-[#f0a500] text-stone-900' : 'bg-gradient-to-br from-[#7466e8] to-[#2d284b] text-white'}`}>{iniciales(c.nombre)}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13.5px] font-bold text-stone-900 leading-tight truncate">{c.nombre}</span>
                                <span className="block text-[11.5px] text-stone-500 capitalize">{c.rol || 'Cajero'}</span>
                              </span>
                              <span className={`w-[22px] h-[22px] rounded-full border-2 grid place-items-center text-white text-xs shrink-0 ${activo ? 'bg-[#5b4bd6] border-[#5b4bd6]' : 'border-stone-300'}`}>{activo && <i className="fa-solid fa-check text-[10px]"></i>}</span>
                            </button>
                          );
                        })}
                      </div>
                      {esAdmin && (
                        <button type="button" onClick={() => { setModalTurno(false); abrirGestionCajeros(); setMostrarFormNuevoCajero(true); }} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#2d284b] hover:bg-[#ebf0ff] rounded-lg px-1 py-1.5">
                          <i className="fa-solid fa-plus text-[10px]"></i> Agregar a alguien que no está en la lista
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-stone-800 mb-2"><span>Efectivo con el que empieza la caja</span><span className="text-stone-400 font-normal">fondo inicial</span></label>
                      <div className="flex items-baseline gap-2.5 border-2 border-stone-200 rounded-[20px] bg-stone-50/70 px-4 sm:px-[18px] py-3 focus-within:border-[#5b4bd6] focus-within:bg-white focus-within:ring-[5px] focus-within:ring-[#5b4bd6]/15 transition">
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
                      <button type="button" onClick={() => setConteoAbierto((v) => !v)} className="mt-3 inline-flex items-center gap-2 text-[12.5px] font-bold text-[#2d284b] hover:bg-[#ebf0ff] rounded-lg px-1 py-1.5">
                        <i className="fa-solid fa-coins text-sm"></i> Contar billetes y monedas <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${conteoAbierto ? 'rotate-180' : ''}`}></i>
                      </button>
                      {conteoAbierto && <ContadorEfectivo conteo={conteoEfectivo} onChange={(n) => cambiarConteo(n, setMontoApertura)} />}
                      {conteoActivo && (
                        <p className="mt-2 text-[11.5px] text-stone-500">El monto se calcula con tu conteo. <button type="button" onClick={() => setConteoEfectivo({})} className="font-bold text-[#2d284b]">Escribirlo a mano</button></p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 bg-white border-t border-stone-100 px-4 sm:px-5 py-3 flex items-center gap-2.5 shadow-[0_-8px_24px_-14px_rgba(40,10,90,0.18)]">
                    <button type="button" onClick={() => setModalTurno(false)} className="h-[46px] px-4 sm:px-5 rounded-[14px] text-stone-500 hover:text-stone-800 hover:bg-stone-100 font-bold text-[13.5px]">Cancelar</button>
                    <span className="flex-1 text-right text-xs text-stone-500 hidden sm:block">{montoInvalido ? 'Escribe con cuánto efectivo empieza la caja' : `${elegido?.nombre || ''} · empieza con ${dinero(montoNum)}`}</span>
                    <button type="button" onClick={handleAbrirTurno} disabled={montoInvalido} className="h-[46px] px-5 rounded-[14px] bg-[#5b4bd6] hover:bg-[#473bb5] disabled:bg-[#d5dbef] disabled:shadow-none disabled:cursor-not-allowed text-white font-bold text-[13.5px] shadow-lg shadow-[#5b4bd6]/30 inline-flex items-center justify-center gap-2 transition ml-auto sm:ml-0">
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
          {crearPinAdmin && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-xs w-full p-5 shadow-2xl space-y-3">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-key text-orange-600"></i> Crea tu PIN de administrador
                </h3>
                <p className="text-xs text-stone-600">
                  Protege el Dashboard, los precios, los cajeros y demás funciones de administración cuando otras personas usan la caja.
                  No es tu contraseña: sigues entrando con Google. Usa {PIN_MIN_DUENO} caracteres o más.
                </p>
                {[['nuevo', 'PIN nuevo'], ['repetir', 'Repite el PIN']].map(([campo, etiqueta]) => (
                  <input
                    key={campo}
                    type="password"
                    maxLength={PIN_MAX}
                    autoComplete="off"
                    value={formCrearPin[campo]}
                    onChange={(e) => setFormCrearPin((f) => ({ ...f, [campo]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') guardarCrearPinAdmin(); }}
                    placeholder={etiqueta}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
                  />
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCrearPinAdmin(null); setFormCrearPin({ nuevo: '', repetir: '' }); }}
                    className="flex-1 py-2 bg-white/70 text-stone-600 text-xs font-semibold rounded-full shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarCrearPinAdmin}
                    disabled={guardandoCrearPin || !formCrearPin.nuevo.trim()}
                    className="flex-1 py-2 bg-[#5b4bd6] hover:bg-[#473bb5] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow"
                  >
                    {guardandoCrearPin ? 'Guardando...' : 'Crear PIN'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {cajeroPendientePin && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-xs w-full p-5 shadow-2xl space-y-3">
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
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-center text-lg tracking-widest text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
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
                    className="flex-1 py-2 bg-[#5b4bd6] hover:bg-[#473bb5] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow"
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
                <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-lg w-full shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
                  <div className="bg-white border-b border-stone-100 px-4 sm:px-5 py-3.5 shrink-0 flex items-center gap-3">
                    <span className="w-11 h-11 rounded-[14px] bg-[#ebf0ff] text-[#5b4bd6] grid place-items-center text-xl shrink-0"><i className="fa-solid fa-cash-register"></i></span>
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
                          <span className={`w-[38px] h-[38px] rounded-full grid place-items-center text-[13px] font-extrabold shrink-0 ${i % 2 ? 'bg-gradient-to-br from-[#ffd45c] to-[#f0a500] text-stone-900' : 'bg-gradient-to-br from-[#7466e8] to-[#2d284b] text-white'}`}>{iniciales(nombre)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-stone-900 truncate">{nombre}{t.es_propia && <span className="text-[#5b4bd6]"> · tú</span>}</p>
                            <p className="text-xs text-stone-500 mt-0.5 leading-snug">Desde {etiquetaCuandoTurno(t.fecha_apertura)} · S/ {Number(t.monto_inicial || 0).toFixed(2)} de fondo inicial</p>
                            {edad.antiguo && (
                              <div className="flex gap-2 items-start rounded-xl bg-amber-100/70 text-amber-800 px-2.5 py-2 text-xs leading-snug mt-2.5"><i className="fa-solid fa-triangle-exclamation mt-0.5"></i><span>Abierta {edad.etiqueta}. Si sigues con ella, el cierre sumará las ventas de todo ese tiempo. Conviene cerrarla.</span></div>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2.5">
                              <button type="button" onClick={() => unirseACaja(t)} className="h-[38px] px-3.5 rounded-xl bg-[#5b4bd6] hover:bg-[#473bb5] text-white text-[12.5px] font-bold shadow-md shadow-[#5b4bd6]/25">Usar esta caja</button>
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
                    <button type="button" onClick={abrirCajaNueva} className="w-full h-[46px] rounded-[14px] bg-[#ebf0ff] hover:bg-[#dde4fa] text-[#2d284b] font-bold text-[13.5px] inline-flex items-center justify-center gap-2"><i className="fa-solid fa-plus text-xs"></i> Abrir otra caja</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Aviso: tu caja sigue abierta de un día anterior */}
          {avisoTurnoViejo && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="alertdialog" aria-modal="true">
              <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
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
                        <span className="bol-fh">{formatoFechaHoraBoleta(ventaCompletada.fecha_hora)}</span>
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
                    </div>
                    <div className="bol-cli">
                      <span className="bol-mp"><IconoTrazo nombre={ICONO_MEDIO_PAGO[String(ventaCompletada.medio_pago || '').toUpperCase()] || 'efectivo'} className="w-5 h-5" /></span>
                      <div className="min-w-0">
                        <b>{ventaCompletada.cliente && ventaCompletada.cliente !== 'Desconocido' ? ventaCompletada.cliente : 'Cliente sin registrar'}</b>
                        <span>{String(ventaCompletada.medio_pago || '').charAt(0) + String(ventaCompletada.medio_pago || '').slice(1).toLowerCase()}</span>
                      </div>
                    </div>
                    {ventaCompletada.recibido > 0 && (
                      <div className="bol-vuelto">
                        <span>Recibido <b>S/ {formatoSoles(ventaCompletada.recibido)}</b></span>
                        <span className="bol-vv">Vuelto <b>S/ {formatoSoles(Math.max(0, ventaCompletada.recibido - ventaCompletada.total_venta))}</b></span>
                      </div>
                    )}
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
              <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3">
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
                  className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { modalPrompt.onCancelar(); setModalPrompt(null); }}
                    className="flex-1 py-2.5 bg-white/70 hover:bg-[#dde4fa] text-stone-600 font-semibold text-xs rounded-full shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { modalPrompt.onConfirmar(modalPromptValor); setModalPrompt(null); }}
                    className="flex-1 py-2.5 bg-[#5b4bd6] hover:bg-[#473bb5] text-white font-bold text-xs rounded-full shadow"
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
              <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3">
                <h3 className="text-lg font-bold text-stone-900">{modalConfirmar.titulo}</h3>
                <p className="text-xs text-stone-600">{modalConfirmar.mensaje}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { modalConfirmar.onCancelar(); setModalConfirmar(null); }}
                    className="flex-1 py-2.5 bg-white/70 hover:bg-[#dde4fa] text-stone-600 font-semibold text-xs rounded-full shadow-sm"
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
  