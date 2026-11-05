import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import RielLateral from './RielLateral.jsx';
import { createClient } from '@supabase/supabase-js';
import './index.css';
import { fechaHoyISO, comprimirImagenJPEG, CATEGORIAS_FALLBACK } from './PanelAdminCompartido.jsx';
import { iniciarMonitoreo, reportarError } from './monitoreo.js';
import { evitarZoomEnCampos } from './lib/movil.js';
import { claveAuthSupabase, puedeUsarSesionGuardada, debeReintentar, PAUSAS_REINTENTO_SESION } from './lib/sesion.js';
import { BODEGA_DEMO_ID, mensajeError } from './pos/utilidades.js';
import { PRODUCTOS_SEMILLA } from './pos/demo.js';
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
import AvisosSuperiores from './pantallas/AvisosSuperiores.jsx';
import Catalogo from './pantallas/Catalogo.jsx';
import CarritoMovil from './pantallas/CarritoMovil.jsx';
import PanelCarrito from './pantallas/PanelCarrito.jsx';
import MenuMas from './pantallas/MenuMas.jsx';
import VentanasProductos from './pantallas/VentanasProductos.jsx';
import VentanasFiadosYProveedores from './pantallas/VentanasFiadosYProveedores.jsx';
import VentanasHistoriales from './pantallas/VentanasHistoriales.jsx';
import VentanasAdministracion from './pantallas/VentanasAdministracion.jsx';
import VentanasClientes from './pantallas/VentanasClientes.jsx';
import VentanasReportes from './pantallas/VentanasReportes.jsx';
import VentanasTurno from './pantallas/VentanasTurno.jsx';
import VentanasVenta from './pantallas/VentanasVenta.jsx';
import DialogosGenericos from './pantallas/DialogosGenericos.jsx';
import PantallaCuentaVencida from './pantallas/PantallaCuentaVencida.jsx';
import PantallaLogin from './pantallas/PantallaLogin.jsx';
import PantallaAdmin from './pantallas/PantallaAdmin.jsx';








































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
        return <PantallaAdmin {...{
          adminSesion, bodegasAdmin, cargandoBodegasAdmin, formNuevaBodega, guardandoNuevaBodega,
          notificar, sbClient, setAdminSesion, setBodegasAdmin, setCargandoBodegasAdmin,
          setFormNuevaBodega, setGuardandoNuevaBodega, toast
        }} />;
      }

      if (!sesion) {
        return <PantallaLogin {...{
          authTab, cargandoAdminLogin, formAdminLogin, kgSyncDelayRef, notificar, revelarLogin,
          sbClient, setAdminSesion, setAuthTab, setCargandoAdminLogin, setFormAdminLogin, toast
        }} />;
      }

      // =========================================================================
      // VISTA: CUENTA VENCIDA -- la bodega existe y el login funcionó, pero
      // el administrador la desactivó o se venció su plazo. mi_bodega_id()
      // ya bloquea cualquier consulta real del lado del servidor; esto es
      // solo para que el dueño entienda por qué, en vez de ver un catálogo
      // vacío sin explicación.
      // =========================================================================
      if (cuentaVencida) {
        return <PantallaCuentaVencida {...{
          bodegaNombre, cerrarSesion, sesion, toast
        }} />;
      }

      // =========================================================================
      // VISTA 2: POS INTERFACE COMPLETO
      // =========================================================================
      return (
        <div
          className={`relative flex h-screen text-stone-900 font-sans select-none overflow-hidden ${(!enLinea || ventasPendientesSync.length > 0) ? 'pt-7' : ''}`}
          style={{ background: '#ebf0ff' }}
        >

          <AvisosSuperiores {...{
            abrirCierreCaja, avisoVersionOculto, enLinea, modalCierreCaja, setAvisoVersionOculto,
            sincronizandoVentas, sincronizarVentasPendientes, toast, turnoActivo, ventasPendientesSync,
            versionNueva
          }} />


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

          <Catalogo {...{
            abrirCierreCaja, abrirEdicionProducto, abrirEscanerParaVenta, abrirModalCombos,
            abrirPedidosRetirar, agregarComboAlCarrito, bodegaNombre, busqueda, busquedaCategoria,
            cajeroSeleccionado, cambiarCantidadCarrito, cantidadEnCarritoPorCombo,
            cantidadEnCarritoPorProducto, cargandoProductos, cargarProductos, categoriaFiltro,
            categorias, centinelaGridRef, claseSegmento, combosActivos, combosDisponibles,
            conteoPorCategoria, esAdmin, estadoCombos, handleClicProducto, handleKeyDownBusqueda,
            hayMasEnGrid, inputBusquedaRef, limiteGrid, menuCategoriasAbierto, notificar,
            pedidosListosSinCargar, pedidosPorRetirarPendientes, productos, productosEnCombo,
            productosFiltrados, setBusqueda, setBusquedaCategoria, setBusquedaMenu, setCategoriaFiltro,
            setIndiceMenu, setMenuCategoriasAbierto, setMenuMas, setModalInventarioInicial,
            setModalTurno, turnoActivo, usuarioActivo, verCombosDesdeTarjeta
          }} />

          <CarritoMovil {...{
            carrito, mostrarResumenMobile, setMostrarResumenMobile, totalConDescuento
          }} />

          <PanelCarrito {...{
            abrirBuscarClientePOS, abrirPedidosRetirar, aparcarVentaActual, asignarDesdeTeclado,
            avisarPedidosDevueltos, barberoVentaId, borrarVentaEspera, cambiarCantidadCarrito,
            campoTeclado, cargandoPedidosRetirar, cargarPedidoDesdeRetirar, carrito, clienteActual,
            descuentoTipo, descuentoValor, desgloseComboPedido, efectivoRequeridoMixto,
            eliminarPedidoRetirar, enviarPedidoAlRepartidor, esBarberia, filtroFechaHistorial,
            handleCobrar, historialPedidosFiltrado, listaCajeros, marcandoListoId, marcarPedidoEnCamino,
            marcarPedidoListo, marcarRetiradoDirecto, medioPago, modalPedidosRetirar, modalVentasEspera,
            montoDescuento, montoMixtoOtro, montoMixtoRecibido, montoRecibido, mostrarPago,
            mostrarResumenMobile, pedidosCargadosAlCarrito, pedidosListosSinCargar,
            pedidosPorRetirarPendientes, pedidosRetirarPorTab, pedirConfirmacion,
            procesandoPedidoRetirarId, procesandoVenta, recuperarVentaEspera, reiniciarClienteYMedioPago,
            setBarberoVentaId, setCampoTeclado, setCarrito, setDescuentoTipo, setDescuentoValor,
            setFiltroFechaHistorial, setMedioPago, setMedioQR, setModalPedidosRetirar,
            setModalVentasEspera, setMontoMixtoOtro, setMontoMixtoRecibido, setMontoRecibido,
            setMostrarPago, setMostrarResumenMobile, setPedidosCargadosAlCarrito, setTabPedidosRetirar,
            setVerDetalleCobro, tabPedidosRetirar, totalConDescuento, totalVenta, turnoActivo,
            valorTeclado, ventasEnEspera, verDetalleCobro, vuelto, vueltoMixto
          }} />

          <MenuMas {...{
            abrirAgenda, abrirAuditoria, abrirCierreCaja, abrirComisiones, abrirCuentasPorPagar,
            abrirDashboard, abrirDesdeMenu, abrirEntradaMercaderia, abrirGestionCajeros,
            abrirHistorialDelDia, abrirModalCombos, abrirModalDelivery, abrirModuloCobroDeudas,
            abrirTomaInventario, busquedaMenu, cajeroSeleccionado, cerrarSesion, elevado, esAdmin,
            esBarberia, esCajeroDelUsuarioActivo, esModoDemo, indiceMenu, listaCajeros, menuEnRiel,
            menuMas, ranuraRiel, rolActivo, rolesEnServidor, sbClient, setBusquedaMenu,
            setCajeroPendientePin, setIndiceMenu, setMenuMas, setModalInventarioInicial, setModalMerma,
            setModalPinCajero, setModalTurno, setNuevoPinCajero, setPinConfirmarCajero, soltarAdmin,
            turnoActivo
          }} />

          {/* ========================================================================= */}
          {/* MODALES ADICIONALES */}
          {/* ========================================================================= */}

          <VentanasProductos {...{
            abrirEscanerParaFilaInventario, abrirEscanerParaMerma, abrirHistorialInventario,
            abrirProductoNuevoEntrada, actualizarCantidadItemCombo, actualizarCodigoEanFila,
            actualizarCodigoEanPackFila, actualizarFilaInventario, actualizarPendienteConteo,
            actualizarStockContado, agregarCategoriaPersonalizada, agregarHallazgo,
            agregarItemEntradaMercaderia, agregarProductoAConteo, agregarProductoAFormCombo,
            alternarActivoCombo, aplicarDescuentoRapidoCombo, aplicarPrecioCombo,
            buscarProductoPorCodigo, busquedaCombos, busquedaCompra, busquedaMerma,
            busquedaProductoCombo, camarasDisponibles, cambiarCamara, cambiarCantidadCarrito,
            cambiarTipoEntrada, cargandoCombos, carrito, categoriasDB, cerrarEditorCombo,
            cerrarModalCombos, cerrarModalEntradaMercaderia, cerrarModalMerma, combos, compraCabecera,
            compraItemTemp, compraItems, confirmarCantidadBalanza, conteoFisicoBusqueda,
            continuarARevisionInventario, costoNormalCombo, crearProductoInlineCompra,
            desactivarProducto, destelloEscaner, desvincularFilaInventario, duplicarCombo,
            editandoPackParaId, editarCombo, editarLineaEntrada, elegirProductoEntrada,
            elegirProductoMerma, eliminarCombo, eliminarFilaInventario, entradaRegistrada, errorEscaner,
            esBarberia, estadoCombos, filaInventarioExpandidaIdx, filaInventarioVacia, filasInventario,
            filasTomaInventario, filasTomaInventarioVisibles, filtroCombos, filtroCompra, formCombo,
            formComboOriginal, formEditarOriginal, formEditarProducto, formMerma, guardandoCombo,
            guardandoEdicionProducto, guardandoEntrada, guardandoInventario, guardandoMerma,
            guardandoProductoInlineCompra, guardandoTomaInventario, guardarCombo, guardarEdicionProducto,
            guardarEntradaMercaderia, guardarInventarioInicial, guardarTomaInventario,
            historialConteoAbierto, idsNuevosCompra, inputBusquedaRef, inputCantidad, listaEscaneada,
            modalCantidad, modalCombos, modalEditarProducto, modalEntradaMercaderia, modalEscaner,
            modalInventarioInicial, modalMerma, modalTomaInventario, modoEscaner, notificar, nuevoCombo,
            nuevoProductoInlineCompra, pasoInventario, pasoTomaInventario, pedirCerrarEntrada,
            pedirConfirmacion, precioNormalCombo, productoEscaneadoId, productoSeleccionadoCantidad,
            productos, promoverAActivoConteo, proveedoresLista, quitarFotoExtra, quitarHallazgo,
            quitarItemCombo, quitarItemEntradaMercaderia, quitarProductoDeConteo, refsPendientesConteo,
            registrarMermaProducto, resaltadoCompra, resaltadoProductoCombo, resultadosBusquedaConteo,
            sesion, setBusquedaCombos, setBusquedaCompra, setBusquedaMerma, setBusquedaProductoCombo,
            setCompraCabecera, setCompraItemTemp, setConteoFisicoBusqueda, setEditandoPackParaId,
            setEntradaRegistrada, setFilaInventarioExpandidaIdx, setFilasInventario, setFiltroCombos,
            setFiltroCompra, setFormCombo, setFormEditarProducto, setFormMerma,
            setHistorialConteoAbierto, setInputCantidad, setMetodoForzado, setModalCantidad,
            setModalEditarProducto, setModalEscaner, setModalInventarioInicial, setModalTomaInventario,
            setModoEscaner, setMostrarResumenMobile, setNuevoProductoInlineCompra, setPasoInventario,
            setPasoTomaInventario, setResaltadoCompra, setResaltadoProductoCombo, setTabEditarProducto,
            setTipoVentaSeleccionado, setTomaInventarioBusqueda, setTomaInventarioCategoria,
            snapshotCombo, subiendoFotoExtra, subiendoFotoFilaIdx, subiendoFotoProducto,
            subirFotoExtraProducto, subirFotoFilaInventario, subirFotoProducto,
            sugerenciasMaestroParaFila, sugerenciasParaFila, sugerenciasParaFilaPack, tabEditarProducto,
            tipoVentaSeleccionado, tomaInventarioBusqueda, tomaInventarioCategoria, totalConDescuento,
            usarSugerenciaMaestraEnFila, vaciarConteoInventario, videoNativoRef,
            vincularProductoExistenteEnFila
          }} />

          <VentanasFiadosYProveedores {...{
            abrirEdicionCliente, boletasDeudores, busquedaDeudores, cargandoDetalleDeudor,
            cargandoDeudores, clientesLista, confirmandoPagoDeudor, descargarEstadoCuenta,
            deudorSeleccionado, enviarEstadoCuentaWhatsApp, esAdmin, estadoDeudorSel,
            exportarClientesExcel, filtroDeudores, formEditarCliente, formProveedor,
            guardandoEdicionCliente, guardarEdicionCliente, handleGuardarNuevoProveedor, hojaPagoDeudor,
            listaCajeros, modalCobrarDeudas, modalCuentasPagar, modalNuevoProveedor, montoAbonoDeuda,
            montoMovimientoProveedor, mostrarHistorialCompletoDeuda, ordenDeudores, pagoRegistrado,
            pagosRecientes, procesarPagoDeudaCliente, proveedorSeleccionado, proveedoresLista,
            registrarMovimientoProveedor, seleccionarDeudor, setBoletasDeudor, setBusquedaDeudores,
            setClienteEditando, setConfirmandoPagoDeudor, setDeudorSeleccionado, setFiltroDeudores,
            setFormEditarCliente, setFormProveedor, setHojaPagoDeudor, setModalCobrarDeudas,
            setModalCuentasPagar, setModalNuevoCliente, setModalNuevoProveedor, setMontoAbonoDeuda,
            setMontoMovimientoProveedor, setMostrarHistorialCompletoDeuda, setOrdenDeudores,
            setPagoRegistrado, setProveedorSeleccionado
          }} />

          <VentanasHistoriales {...{
            abrirHistorialDelDia, abrirTomaInventario, atajoCierres, cargandoCierres,
            cargandoHistorialInventario, cargarHistorialCierresPorRango,
            cargarHistorialInventarioPorRango, cierreDetalle, cierresCaja, elegirAtajoCierres,
            etiquetaDiaHistorial, fechaFinCierres, fechaFinHistInventario, fechaInicioCierres,
            fechaInicioHistInventario, historialInventarioAgrupado, historialInventarioBusqueda,
            historialInventarioSoloDif, listaCajeros, modalHistorialCierres, modalHistorialInventario,
            setCierreDetalle, setFechaFinCierres, setFechaFinHistInventario, setFechaInicioCierres,
            setFechaInicioHistInventario, setHistorialInventarioBusqueda, setHistorialInventarioSoloDif,
            setModalHistorialCierres, setModalHistorialInventario, setSoloConDiferenciaCierres,
            soloConDiferenciaCierres
          }} />

          <VentanasAdministracion {...{
            DIAS_DELIVERY, abrirHorarioBarbero, ajustarDuracionCita, alternarActivoCajero,
            avisarAMisClientes, barberosConHorario, cajerosGestion, cambiarDiaHorario, cargandoAgenda,
            cargandoAuditoria, cargandoCajerosGestion, cargandoComisiones, cargarAgenda,
            cargarComisiones, citasAgenda, combos, copiarHorarioADias, costoEnvioDelivery,
            deliveryHabilitado, direccionDelivery, domicilioHabilitado, eliminarCajero, enviandoAviso,
            errorAuditoria, esAdmin, esBarberia, esModoDemo, estadoHorarioActualDelivery, fechaAgenda,
            filasAuditoria, filasComisiones, filtroAuditoria, formNuevoCajero, guardandoDelivery,
            guardandoHorario, guardandoNuevoCajero, guardandoPinCajero, guardarComisionBarbero,
            guardarConfigDelivery, guardarHorarioBarbero, guardarPinCajero, hayCambiosDelivery,
            horarioDelivery, linkDeliveryCopiado, logoUrlDelivery, modalAgenda, modalAuditoria,
            modalComisiones, modalDelivery, modalGestionCajeros, modalHorario, modalPinCajero,
            mostrarFormNuevoCajero, mostrarQRDelivery, notificar, nuevoPinCajero, pedidoMinimoDelivery,
            periodoComisiones, productos, registrarNuevoCajeroCompleto, resumenAvisos,
            resumenEntregaDelivery, resumenHorarioDelivery, seccionDelivery, sesion,
            setCostoEnvioDelivery, setDeliveryHabilitado, setDireccionDelivery, setDomicilioHabilitado,
            setFechaAgenda, setFiltroAuditoria, setFormNuevoCajero, setHorarioDelivery,
            setLinkDeliveryCopiado, setModalAgenda, setModalAuditoria, setModalComisiones,
            setModalDelivery, setModalGestionCajeros, setModalHorario, setModalPinCajero,
            setMostrarFormNuevoCajero, setMostrarQRDelivery, setNuevoPinCajero, setPedidoMinimoDelivery,
            setPeriodoComisiones, setTelefonoDeliveryEditar, setWhatsappRepartidor,
            setZonaRepartoDelivery, slugDelivery, subiendoLogoDelivery, subirLogoDelivery,
            telefonoDeliveryEditar, whatsappRepartidor, zonaRepartoDelivery
          }} />

          <VentanasClientes {...{
            busquedaClientePOS, cargandoClientes, clientesFiltradosPOS, formCliente,
            handleGuardarNuevoCliente, modalBuscarCliente, modalNuevoCliente, seleccionarClientePOS,
            setBusquedaClientePOS, setFormCliente, setModalBuscarCliente, setModalNuevoCliente
          }} />

          <VentanasReportes {...{
            abrirHistorialCierres, anularVentaHoy, arqueoEsperado, atajoHistorial,
            busquedaBoletaHistorial, cajeroSeleccionado, cambiarConteo, cargandoDashboard,
            cargandoHistorial, cargarDashboard, cargarHistorialPorRango, clientesDeuda, combosVendidos,
            confirmarCierreConArqueo, conteoAbierto, conteoEfectivo, dashStats, diaCalendarioSel,
            diasAnioDash, diasAnioRango, elegirAtajoHistorial, esAdmin, etiquetaDiaHistorial,
            exportarDashboardExcel, exportarVentasExcel, fechaFinDash, fechaFinHistorial,
            fechaInicioDash, fechaInicioHistorial, horaResaltada, limiteHistorial, menuVentaHistorial,
            mesCalendario, mesResaltado, modalCierreCaja, modalDashboard, modalHistorial,
            montoConteoEfectivo, nombreClienteHistorial, pestanaDiaCal, productos, proveedoresDeudaDash,
            resumenCierre, setBusquedaBoletaHistorial, setConteoAbierto, setConteoEfectivo,
            setDiaCalendarioSel, setFechaFinDash, setFechaFinHistorial, setFechaInicioDash,
            setFechaInicioHistorial, setHoraResaltada, setLimiteHistorial, setMenuVentaHistorial,
            setMesCalendario, setMesResaltado, setModalCierreCaja, setModalDashboard, setModalHistorial,
            setMontoConteoEfectivo, setPestanaDiaCal, setReciboReimpresion, setResumenCierre,
            setVentaDetalleHistorial, turnoActivo, ventaDetalleHistorial, ventasDelDia, vuelto
          }} />

          <VentanasTurno {...{
            abrirCajaNueva, abrirGestionCajeros, avisoTurnoViejo, cajasAbiertasAviso, cajeroPendientePin,
            cajeroSeleccionado, cambiarConteo, confirmarPinCajero, conteoAbierto, conteoEfectivo,
            crearPinAdmin, elegirCajeroTurno, esAdmin, formCrearPin, guardandoCrearPin,
            guardarCrearPinAdmin, handleAbrirTurno, listaCajeros, modalTurno, montoApertura,
            pinConfirmarCajero, retomarTurnoViejo, setCajeroPendientePin, setCierreAlRetomar,
            setConteoAbierto, setConteoEfectivo, setCrearPinAdmin, setFormCrearPin, setModalTurno,
            setMontoApertura, setMostrarFormNuevoCajero, setPinConfirmarCajero, ultimoCierre,
            unirseACaja, verificandoPinCajero
          }} />

          <VentanasVenta {...{
            bodegaDireccion, bodegaId, bodegaNombre, bodegaTelefono, enviarBoletaWhatsApp,
            imprimirBoletaBluetooth, medioQR, nombreClienteHistorial, reciboReimpresion, setMedioQR,
            setReciboReimpresion, setVentaCompletada, totalConDescuento, ventaCompletada
          }} />

          <DialogosGenericos {...{
            modalConfirmar, modalPrompt, modalPromptValor, setModalConfirmar, setModalPrompt,
            setModalPromptValor
          }} />
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
  