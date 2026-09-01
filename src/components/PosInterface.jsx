import React, { useState, useEffect, useRef, useMemo } from 'react';
import { posService } from '../services/posService';
import { creditosService } from '../services/creditosService';
import ProductoModal from './modals/ProductoModal';
import EntradaMercaderiaModal from './modals/EntradaMercaderiaModal';
import ClienteModal from './modals/ClienteModal';
import CobroDeudaModal from './modals/CobroDeudaModal';
import HistorialModal from './modals/HistorialModal';
import VentasEsperaModal from './modals/VentasEsperaModal';
import CierreTurnoModal from './modals/CierreTurnoModal';
import QRPagoModal from './modals/QRPagoModal';
import ReciboModal from './modals/ReciboModal';
import NumericKeypad from './NumericKeypad';

const MEDIOS_PAGO = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'CREDITO', 'MIXTO'];

// La sesión de caja (bodega/cajero) se persiste para que un refresh de página
// no pierda el contexto y obligue a reabrir el turno innecesariamente.
const leerSesionGuardada = () => {
  try {
    return {
      bodegaId: localStorage.getItem('pos_bodegaId') || 'BOD-01',
      cajeroId: localStorage.getItem('pos_cajeroId') || 'CAJERO-01'
    };
  } catch {
    return { bodegaId: 'BOD-01', cajeroId: 'CAJERO-01' };
  }
};

export default function PosInterface() {
  // --- Parámetros de Sesión / Multi-tienda ---
  const sesionGuardada = useMemo(leerSesionGuardada, []);
  const [bodegaId, setBodegaId] = useState(sesionGuardada.bodegaId);
  const [cajeroId, setCajeroId] = useState(sesionGuardada.cajeroId);

  // --- Estados de Datos ---
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargandoProductos, setCargandoProductos] = useState(false);

  // --- Estado de Turno de Caja ---
  const [turnoActivo, setTurnoActivo] = useState(null);
  const [montoApertura, setMontoApertura] = useState('100.00');
  const [modalTurno, setModalTurno] = useState(false);
  const [modalCierreTurno, setModalCierreTurno] = useState(false);
  const [ventasEfectivoTurno, setVentasEfectivoTurno] = useState(0);

  // --- Estado de Carrito ---
  const [carrito, setCarrito] = useState([]);

  // --- Estado de Cliente ---
  const [dniCliente, setDniCliente] = useState('99999999');
  const [clienteActual, setClienteActual] = useState(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  // --- Estado de Pago ---
  const [medioPago, setMedioPago] = useState('EFECTIVO');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [montoMixtoEfectivo, setMontoMixtoEfectivo] = useState('');
  const [montoMixtoOtro, setMontoMixtoOtro] = useState('');
  const [campoTeclado, setCampoTeclado] = useState(null); // 'recibido' | 'mixtoEfectivo' | 'mixtoOtro' | null
  const [procesandoVenta, setProcesandoVenta] = useState(false);
  const [ventaCompletada, setVentaCompletada] = useState(null);
  const [validacionCredito, setValidacionCredito] = useState(null);
  const [medioQR, setMedioQR] = useState(null); // 'YAPE' | 'PLIN' | null

  // --- Modales de Módulos ---
  const [modalProducto, setModalProducto] = useState(false);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);
  const [modalCobroDeuda, setModalCobroDeuda] = useState(false);
  const [modalHistorial, setModalHistorial] = useState(false);
  const [modalVentasEspera, setModalVentasEspera] = useState(false);
  const [reciboReimpresion, setReciboReimpresion] = useState(null);

  // --- Mensajes / Alertas ---
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const inputBusquedaRef = useRef(null);

  const notificar = (texto, tipo = 'info') => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 4500);
  };

  const cargarCatalogo = async (filtro = '') => {
    setCargandoProductos(true);
    try {
      const data = await posService.obtenerProductos(bodegaId, filtro);
      setProductos(data);
    } catch (err) {
      notificar(`Error al cargar productos: ${err.message}`, 'error');
    } finally {
      setCargandoProductos(false);
    }
  };

  const verificarTurno = async () => {
    try {
      const turno = await posService.obtenerTurnoActivo(bodegaId, cajeroId);
      setTurnoActivo(turno);
    } catch (err) {
      notificar(`Error al verificar turno: ${err.message}`, 'error');
    }
  };

  const cargarClienteDefault = async () => {
    try {
      const cliente = await posService.buscarOCrearCliente(bodegaId, '99999999');
      setClienteActual(cliente);
      setDniCliente(cliente.dni);
    } catch (err) {
      console.error(err);
    }
  };

  // Persistir la sesión de caja (bodega/cajero) para sobrevivir a un refresh de página.
  useEffect(() => {
    try {
      localStorage.setItem('pos_bodegaId', bodegaId);
      localStorage.setItem('pos_cajeroId', cajeroId);
    } catch {
      // localStorage no disponible (modo privado, etc.) — no es crítico.
    }
  }, [bodegaId, cajeroId]);

  useEffect(() => {
    cargarCatalogo();
    verificarTurno();
    cargarClienteDefault();
  }, [bodegaId, cajeroId]);

  const handleBuscarCliente = async () => {
    if (!dniCliente.trim()) return;
    setBuscandoCliente(true);
    try {
      const cliente = await posService.buscarOCrearCliente(bodegaId, dniCliente.trim());
      setClienteActual(cliente);
      notificar(`Cliente asignado: ${cliente.nombre_completo}`, 'success');
    } catch (err) {
      notificar(`No se encontró cliente: ${err.message}`, 'error');
    } finally {
      setBuscandoCliente(false);
    }
  };

  const handleAbrirTurno = async () => {
    try {
      const nuevoTurno = await posService.abrirTurnoCaja({
        bodegaId,
        cajeroId,
        montoInicial: parseFloat(montoApertura) || 0
      });
      setTurnoActivo(nuevoTurno);
      setModalTurno(false);
      notificar('Turno de caja abierto correctamente.', 'success');
    } catch (err) {
      notificar(`Error al abrir turno: ${err.message}`, 'error');
    }
  };

  // Abrir el flujo de cierre: calcula ventas en efectivo del turno antes del arqueo ciego
  const handleAbrirCierreTurno = async () => {
    if (!turnoActivo) return;
    try {
      const ventasHoy = await posService.obtenerVentasDelDia(bodegaId);
      const ventasTurno = ventasHoy.filter((v) => v.turno_caja_id === turnoActivo.id && !v.anulada);
      const efectivo = ventasTurno.reduce((acc, v) => {
        if (v.medio_pago === 'MIXTO') return acc + Number(v.monto_efectivo || 0);
        if (v.medio_pago === 'EFECTIVO') return acc + Number(v.total_venta);
        return acc;
      }, 0);
      setVentasEfectivoTurno(efectivo);
      setModalCierreTurno(true);
    } catch (err) {
      notificar(`Error al preparar el cierre: ${err.message}`, 'error');
    }
  };

  // Agregar producto al carrito (soporta balanza/peso para productos en KG)
  const agregarAlCarrito = (producto) => {
    const esKg = producto.unidad_medida === 'KG';
    let cantidadInicial = 1;

    if (esKg) {
      const entrada = window.prompt(
        `Ingresa el peso en KG para "${producto.descripcion}" (ej. 0.350):`,
        '0.500'
      );
      if (entrada === null) return;
      const peso = parseFloat(entrada.replace(',', '.'));
      if (!peso || peso <= 0) {
        notificar('Peso inválido.', 'error');
        return;
      }
      cantidadInicial = +peso.toFixed(3);
    }

    setCarrito((prev) => {
      const index = prev.findIndex((item) => item.productoId === producto.id);
      if (index >= 0 && !esKg) {
        const actual = prev[index];
        const nuevaCantidad = actual.cantidad + 1;
        const actualizado = [...prev];
        actualizado[index] = {
          ...actual,
          cantidad: nuevaCantidad,
          subtotal: +(nuevaCantidad * actual.precioUnitario).toFixed(2)
        };
        return actualizado;
      }
      return [
        ...prev,
        {
          productoId: producto.id,
          cod_ean: producto.cod_ean,
          descripcion: producto.descripcion,
          unidad_medida: producto.unidad_medida || 'UND',
          precioUnitario: Number(producto.precio_venta),
          cantidad: cantidadInicial,
          subtotal: +(cantidadInicial * Number(producto.precio_venta)).toFixed(2)
        }
      ];
    });
  };

  const handleKeyDownBusqueda = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = busqueda.trim().toLowerCase();
      if (!term) return;

      const exactoEan = productos.find((p) => (p.cod_ean || '').toLowerCase() === term);
      if (exactoEan) {
        agregarAlCarrito(exactoEan);
        setBusqueda('');
        return;
      }

      const coincidencias = productos.filter(
        (p) =>
          (p.descripcion || '').toLowerCase().includes(term) ||
          (p.cod_ean || '').toLowerCase().includes(term)
      );
      if (coincidencias.length === 1) {
        agregarAlCarrito(coincidencias[0]);
        setBusqueda('');
      } else {
        cargarCatalogo(term);
      }
    }
  };

  const actualizarCantidad = (productoId, direccion) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.productoId === productoId) {
            const paso = item.unidad_medida === 'KG' ? 0.1 : 1;
            const nuevaCantidad = +(item.cantidad + direccion * paso).toFixed(3);
            if (nuevaCantidad <= 0) return null;
            return {
              ...item,
              cantidad: nuevaCantidad,
              subtotal: +(nuevaCantidad * item.precioUnitario).toFixed(2)
            };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const eliminarItem = (productoId) => {
    setCarrito((prev) => prev.filter((item) => item.productoId !== productoId));
  };

  const vaciarCarrito = () => {
    if (carrito.length === 0) return;
    if (window.confirm('¿Vaciar todos los productos del carrito?')) {
      setCarrito([]);
    }
  };

  const totalVenta = useMemo(() => {
    return +carrito.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2);
  }, [carrito]);

  const vuelto = useMemo(() => {
    if (medioPago !== 'EFECTIVO' || !montoRecibido) return 0;
    const recibido = parseFloat(montoRecibido) || 0;
    return +(recibido - totalVenta).toFixed(2);
  }, [montoRecibido, totalVenta, medioPago]);

  const sumaMixto = useMemo(() => {
    return +((parseFloat(montoMixtoEfectivo) || 0) + (parseFloat(montoMixtoOtro) || 0)).toFixed(2);
  }, [montoMixtoEfectivo, montoMixtoOtro]);

  // Validar crédito en tiempo real cuando el medio de pago es CRÉDITO
  useEffect(() => {
    let activo = true;
    const validar = async () => {
      if (medioPago !== 'CREDITO' || !clienteActual || totalVenta <= 0) {
        setValidacionCredito(null);
        return;
      }
      try {
        const resultado = await creditosService.validarCredito(bodegaId, clienteActual.dni, totalVenta);
        if (activo) setValidacionCredito(resultado);
      } catch (err) {
        if (activo) setValidacionCredito({ aprobado: false, mensaje: err.message });
      }
    };
    validar();
    return () => {
      activo = false;
    };
  }, [medioPago, clienteActual, totalVenta, bodegaId]);

  const asignarDesdeTeclado = (texto) => {
    if (campoTeclado === 'recibido') setMontoRecibido(texto);
    if (campoTeclado === 'mixtoEfectivo') setMontoMixtoEfectivo(texto);
    if (campoTeclado === 'mixtoOtro') setMontoMixtoOtro(texto);
  };

  const valorTeclado = useMemo(() => {
    if (campoTeclado === 'recibido') return montoRecibido;
    if (campoTeclado === 'mixtoEfectivo') return montoMixtoEfectivo;
    if (campoTeclado === 'mixtoOtro') return montoMixtoOtro;
    return '';
  }, [campoTeclado, montoRecibido, montoMixtoEfectivo, montoMixtoOtro]);

  const handleAparcarVenta = async () => {
    if (carrito.length === 0) {
      notificar('El carrito está vacío, no hay nada que aparcar.', 'error');
      return;
    }
    const nombreReferencia = window.prompt('Nombre o referencia para esta venta en espera:', clienteActual?.nombre_completo || '');
    if (nombreReferencia === null) return;
    try {
      await posService.aparcarVenta({
        bodegaId,
        cajeroId,
        clienteId: clienteActual?.id || null,
        nombreReferencia,
        items: carrito,
        total: totalVenta
      });
      setCarrito([]);
      notificar('Venta puesta en espera correctamente.', 'success');
    } catch (err) {
      notificar(`Error al aparcar venta: ${err.message}`, 'error');
    }
  };

  const handleRecuperarVenta = (ventaEspera) => {
    setCarrito(ventaEspera.items || []);
    notificar('Venta recuperada al carrito activo.', 'success');
  };

  // Procesar Cobro / Registrar Venta
  const handleCobrar = async () => {
    if (!turnoActivo) {
      notificar('No puedes cobrar sin un turno de caja ABIERTO.', 'error');
      setModalTurno(true);
      return;
    }

    if (carrito.length === 0) {
      notificar('El carrito de compras está vacío.', 'error');
      return;
    }

    if (medioPago === 'EFECTIVO' && montoRecibido && parseFloat(montoRecibido) < totalVenta) {
      notificar('El monto recibido es menor al total de la venta.', 'error');
      return;
    }

    if (medioPago === 'CREDITO') {
      if (!clienteActual || clienteActual.dni === '99999999') {
        notificar('Para vender a crédito debes asignar un cliente registrado (no genérico).', 'error');
        return;
      }
      if (!validacionCredito?.aprobado) {
        notificar(validacionCredito?.mensaje || 'Crédito no aprobado.', 'error');
        return;
      }
    }

    let montoEfectivo = 0;
    let montoOtro = 0;
    if (medioPago === 'MIXTO') {
      montoEfectivo = parseFloat(montoMixtoEfectivo) || 0;
      montoOtro = parseFloat(montoMixtoOtro) || 0;
      if (Math.abs(sumaMixto - totalVenta) > 0.01) {
        notificar(`Los montos mixtos (S/ ${sumaMixto.toFixed(2)}) deben sumar el total S/ ${totalVenta.toFixed(2)}.`, 'error');
        return;
      }
    }

    setProcesandoVenta(true);
    try {
      const resultado = await posService.registrarVenta({
        bodegaId,
        turnoCajaId: turnoActivo.id,
        cajeroId,
        clienteId: clienteActual ? clienteActual.id : null,
        medioPago,
        totalVenta,
        items: carrito,
        montoEfectivo,
        montoOtro
      });

      setVentaCompletada(resultado);
      setCarrito([]);
      setMontoRecibido('');
      setMontoMixtoEfectivo('');
      setMontoMixtoOtro('');
      setCampoTeclado(null);
      notificar(`¡Venta registrada con éxito! Boleta: ${resultado.venta.nro_boleta}`, 'success');
    } catch (err) {
      notificar(`Error al procesar la venta: ${err.message}`, 'error');
    } finally {
      setProcesandoVenta(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans select-none">
      {/* 1. Barra Superior / Header de la Caja */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-800 border-b border-slate-700 shadow-md flex-wrap gap-y-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-600 rounded-lg text-white font-black text-xl tracking-wider">
              POS
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Bodeguita Express</h1>
              <p className="text-xs text-slate-400">Punto de Venta Multi-Tienda</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-2 bg-slate-900/60 px-3 py-1.5 rounded-md border border-slate-700">
            <label className="text-xs text-slate-400 font-medium">Bodega / Tienda:</label>
            <input
              type="text"
              value={bodegaId}
              onChange={(e) => setBodegaId(e.target.value)}
              className="bg-transparent text-sm font-semibold text-emerald-400 focus:outline-none w-24"
              title="ID de la Bodega (Multi-inquilino)"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-md border border-slate-700">
            <label className="text-xs text-slate-400 font-medium">Cajero:</label>
            <span className="text-xs font-semibold text-slate-200">{cajeroId}</span>
          </div>

          {/* Accesos a Módulos */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setModalProducto(true)} className="px-2.5 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition">
              🆕 Producto
            </button>
            <button onClick={() => setModalEntrada(true)} className="px-2.5 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition">
              📦 Entrada Mercadería
            </button>
            <button onClick={() => setModalCliente(true)} className="px-2.5 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition">
              👤 Cliente/Crédito
            </button>
            <button onClick={() => setModalCobroDeuda(true)} className="px-2.5 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition">
              💵 Cobrar Deuda
            </button>
            <button onClick={() => setModalHistorial(true)} className="px-2.5 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition">
              📜 Historial Hoy
            </button>
            <button onClick={() => setModalVentasEspera(true)} className="px-2.5 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition">
              ⏸️ Ventas en Espera
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {turnoActivo ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Turno #{turnoActivo.id} (Abierto)
              </span>
              <button
                onClick={handleAbrirCierreTurno}
                className="px-3 py-1.5 text-xs font-medium bg-red-600/80 hover:bg-red-600 text-white rounded transition shadow-sm"
              >
                Cerrar Turno
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Caja Cerrada
              </span>
              <button
                onClick={() => setModalTurno(true)}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition shadow"
              >
                Abrir Turno
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Alerta / Notificación flotante */}
      {mensaje.texto && (
        <div
          className={`fixed top-16 right-6 z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-medium border transition-all ${
            mensaje.tipo === 'error'
              ? 'bg-rose-900/90 text-rose-100 border-rose-500'
              : mensaje.tipo === 'success'
              ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500'
              : 'bg-blue-900/90 text-blue-100 border-blue-500'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* 2. Cuerpo Principal (Layout 2 Columnas) */}
      <div className="flex flex-1 overflow-hidden">
        {/* COLUMNA IZQUIERDA: Catálogo de Productos y Búsqueda */}
        <section className="flex-1 flex flex-col border-r border-slate-800 bg-slate-900/50 p-4 gap-4 overflow-hidden">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputBusquedaRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={handleKeyDownBusqueda}
                placeholder="Escanear Código EAN (pistola USB/Bluetooth) o buscar producto (Enter para agregar)..."
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                autoFocus
              />
              <span className="absolute left-3.5 top-3.5 text-slate-400 text-sm">🔍</span>
            </div>
            <button
              onClick={() => cargarCatalogo(busqueda)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg border border-slate-700 transition"
            >
              Buscar
            </button>
            {busqueda && (
              <button
                onClick={() => {
                  setBusqueda('');
                  cargarCatalogo('');
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm rounded-lg border border-slate-700"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {cargandoProductos ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm">Consultando catálogo en Supabase...</p>
              </div>
            ) : productos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-2">
                <p className="text-lg">No hay productos registrados para esta bodega.</p>
                <p className="text-xs text-slate-600">Usa el botón "🆕 Producto" para registrar el primero.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {productos.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => agregarAlCarrito(prod)}
                    className="flex flex-col justify-between text-left p-3.5 bg-slate-800/90 hover:bg-slate-750 hover:border-emerald-500/60 border border-slate-700/80 rounded-xl transition duration-150 shadow-sm active:scale-95 group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                          {prod.cod_ean || 'SIN-EAN'}
                        </span>
                        {prod.unidad_medida === 'KG' && (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50">
                            ⚖️ KG
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-slate-200 mt-2 line-clamp-2 group-hover:text-white">
                        {prod.descripcion}
                      </h3>
                      {prod.categoria && (
                        <span className="text-[11px] text-slate-400 block mt-1">
                          {prod.categoria}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between w-full">
                      <span className="text-xs text-slate-400">Precio {prod.unidad_medida === 'KG' ? '/ KG' : ''}</span>
                      <span className="text-base font-bold text-emerald-400">
                        S/ {Number(prod.precio_venta).toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* COLUMNA DERECHA: Carrito de Compras, Cliente y Cobro */}
        <section className="w-[460px] lg:w-[500px] flex flex-col bg-slate-800 border-l border-slate-700 shadow-2xl overflow-y-auto">
          {/* Sección de Cliente */}
          <div className="p-3 bg-slate-850 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Cliente:</span>
              <input
                type="text"
                value={dniCliente}
                onChange={(e) => setDniCliente(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBuscarCliente()}
                placeholder="DNI / RUC"
                className="w-28 bg-slate-900 border border-slate-700 text-xs text-white px-2.5 py-1 rounded focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleBuscarCliente}
                disabled={buscandoCliente}
                className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition"
              >
                {buscandoCliente ? '...' : 'Buscar'}
              </button>
              <button
                onClick={() => {
                  setDniCliente('99999999');
                  cargarClienteDefault();
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline ml-auto"
                title="Cliente Varios"
              >
                Genérico
              </button>
            </div>
            {clienteActual && (
              <div className="mt-1.5 flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold truncate max-w-[220px]">
                  👤 {clienteActual.nombre_completo}
                </span>
                <span className="text-slate-400">
                  Límite: S/ {Number(clienteActual.limite_credito || 0).toFixed(2)} · Deuda: S/ {Number(clienteActual.saldo_actual || 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Encabezado del Carrito */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Ítems en Carrito ({carrito.reduce((a, c) => a + c.cantidad, 0).toFixed(carrito.some(i => i.unidad_medida === 'KG') ? 2 : 0)})
            </span>
            <div className="flex items-center gap-3">
              {carrito.length > 0 && (
                <button onClick={handleAparcarVenta} className="text-xs text-amber-400 hover:text-amber-300 transition font-semibold">
                  ⏸️ Aparcar
                </button>
              )}
              {carrito.length > 0 && (
                <button onClick={vaciarCarrito} className="text-xs text-rose-400 hover:text-rose-300 transition">
                  Vaciar
                </button>
              )}
            </div>
          </div>

          {/* Lista de Ítems del Carrito */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[160px]">
            {carrito.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center px-4 py-8">
                <span className="text-4xl mb-2">🛒</span>
                <p className="text-sm font-medium">El carrito está vacío</p>
                <p className="text-xs text-slate-500 mt-1">
                  Escanea un código de barras o selecciona productos del catálogo.
                </p>
              </div>
            ) : (
              carrito.map((item) => (
                <div
                  key={item.productoId}
                  className="flex items-center justify-between p-2.5 bg-slate-900/80 border border-slate-750 rounded-lg"
                >
                  <div className="flex-1 pr-2">
                    <p className="text-xs font-medium text-slate-200 leading-tight">
                      {item.descripcion} {item.unidad_medida === 'KG' && <span className="text-amber-400">⚖️</span>}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      S/ {item.precioUnitario.toFixed(2)} {item.unidad_medida === 'KG' ? '/ KG' : 'c/u'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                    <button
                      onClick={() => actualizarCantidad(item.productoId, -1)}
                      className="w-6 h-6 flex items-center justify-center text-sm font-bold text-slate-300 hover:bg-slate-700 rounded"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-xs font-bold text-emerald-400">
                      {item.unidad_medida === 'KG' ? item.cantidad.toFixed(3) : item.cantidad}
                    </span>
                    <button
                      onClick={() => actualizarCantidad(item.productoId, 1)}
                      className="w-6 h-6 flex items-center justify-center text-sm font-bold text-slate-300 hover:bg-slate-700 rounded"
                    >
                      +
                    </button>
                  </div>

                  <div className="w-20 text-right pl-2">
                    <span className="text-sm font-bold text-white block">
                      S/ {item.subtotal.toFixed(2)}
                    </span>
                    <button
                      onClick={() => eliminarItem(item.productoId)}
                      className="text-[10px] text-rose-400 hover:text-rose-300"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Panel de Métodos de Pago y Total */}
          <div className="p-4 bg-slate-850 border-t border-slate-700 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5 uppercase">
                Medio de Pago
              </label>
              <div className="grid grid-cols-3 gap-2">
                {MEDIOS_PAGO.map((metodo) => (
                  <button
                    key={metodo}
                    onClick={() => {
                      setMedioPago(metodo);
                      setCampoTeclado(null);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      medioPago === metodo
                        ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    {metodo}
                  </button>
                ))}
              </div>
            </div>

            {/* EFECTIVO: monto recibido + teclado numérico + vuelto */}
            {medioPago === 'EFECTIVO' && (
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-750 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block">Paga con (S/):</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={montoRecibido}
                      onFocus={() => setCampoTeclado('recibido')}
                      onChange={(e) => setMontoRecibido(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Vuelto:</span>
                    <span className={`text-base font-black ${vuelto < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      S/ {vuelto > 0 ? vuelto.toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setCampoTeclado(campoTeclado === 'recibido' ? null : 'recibido')}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  🔢 {campoTeclado === 'recibido' ? 'Ocultar teclado' : 'Teclado numérico'}
                </button>
                {campoTeclado === 'recibido' && <NumericKeypad value={montoRecibido} onChange={asignarDesdeTeclado} />}
              </div>
            )}

            {/* YAPE / PLIN: mostrar botón de QR */}
            {(medioPago === 'YAPE' || medioPago === 'PLIN') && (
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-750 text-center">
                <button
                  onClick={() => setMedioQR(medioPago)}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg"
                >
                  📱 Mostrar QR de {medioPago}
                </button>
              </div>
            )}

            {/* CREDITO: validación en tiempo real */}
            {medioPago === 'CREDITO' && (
              <div className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                validacionCredito?.aprobado
                  ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-700 text-rose-300'
              }`}>
                {!clienteActual || clienteActual.dni === '99999999' ? (
                  <p>Asigna un cliente registrado (no genérico) para vender a crédito.</p>
                ) : validacionCredito ? (
                  <>
                    <p className="font-semibold">{validacionCredito.mensaje}</p>
                    {validacionCredito.limiteCredito != null && (
                      <p>Disponible: S/ {Number(validacionCredito.disponible).toFixed(2)} de S/ {Number(validacionCredito.limiteCredito).toFixed(2)}</p>
                    )}
                  </>
                ) : (
                  <p>Validando crédito...</p>
                )}
              </div>
            )}

            {/* MIXTO: split de montos con teclado */}
            {medioPago === 'MIXTO' && (
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-750 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block">Efectivo (S/):</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={montoMixtoEfectivo}
                      onFocus={() => setCampoTeclado('mixtoEfectivo')}
                      onChange={(e) => setMontoMixtoEfectivo(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block">Tarjeta/Otro (S/):</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={montoMixtoOtro}
                      onFocus={() => setCampoTeclado('mixtoOtro')}
                      onChange={(e) => setMontoMixtoOtro(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <p className={`text-[11px] font-semibold ${Math.abs(sumaMixto - totalVenta) > 0.01 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  Suma: S/ {sumaMixto.toFixed(2)} / Total: S/ {totalVenta.toFixed(2)}
                </p>
                {campoTeclado && (campoTeclado === 'mixtoEfectivo' || campoTeclado === 'mixtoOtro') && (
                  <NumericKeypad value={valorTeclado} onChange={asignarDesdeTeclado} />
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Total a Cobrar:
              </span>
              <span className="text-3xl font-black text-emerald-400 tracking-tight">
                S/ {totalVenta.toFixed(2)}
              </span>
            </div>

            <button
              onClick={handleCobrar}
              disabled={procesandoVenta || carrito.length === 0 || !turnoActivo}
              className={`w-full py-4 rounded-xl font-black text-lg tracking-wider transition uppercase shadow-xl ${
                !turnoActivo
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : procesandoVenta || carrito.length === 0
                  ? 'bg-slate-750 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-[0.98]'
              }`}
            >
              {procesandoVenta ? 'Registrando en Supabase...' : '⚡ Cobrar e Imprimir (F12)'}
            </button>
          </div>
        </section>
      </div>

      {/* Modal: Apertura de Turno */}
      {modalTurno && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">Abrir Turno de Caja</h2>
            <p className="text-xs text-slate-300">
              Ingresa el fondo o monto inicial de apertura para la bodega{' '}
              <strong className="text-emerald-400">{bodegaId}</strong>.
            </p>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Monto Inicial (S/):</label>
              <input
                type="number"
                step="0.50"
                value={montoApertura}
                onChange={(e) => setMontoApertura(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setModalTurno(false)}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleAbrirTurno}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Comprobante de Venta Exitosa */}
      {ventaCompletada && (
        <ReciboModal
          venta={ventaCompletada.venta}
          detalles={ventaCompletada.detalles}
          onClose={() => setVentaCompletada(null)}
        />
      )}

      {/* Modal: Reimpresión desde Historial */}
      {reciboReimpresion && (
        <ReciboModal
          venta={reciboReimpresion}
          detalles={reciboReimpresion.ventas_detalle || []}
          reimpresion
          onClose={() => setReciboReimpresion(null)}
        />
      )}

      {/* Modal: QR de Pago */}
      {medioQR && (
        <QRPagoModal
          bodegaId={bodegaId}
          medioPago={medioQR}
          monto={totalVenta}
          onClose={() => setMedioQR(null)}
        />
      )}

      {/* Modal: Cierre de Turno con Arqueo Ciego */}
      {modalCierreTurno && turnoActivo && (
        <CierreTurnoModal
          turno={turnoActivo}
          ventasEfectivo={ventasEfectivoTurno}
          notificar={notificar}
          onClose={() => setModalCierreTurno(false)}
          onCerrado={() => {
            setTurnoActivo(null);
            notificar('Turno de caja cerrado con éxito.', 'info');
          }}
        />
      )}

      {/* Módulo: Registrar Nuevo Producto */}
      {modalProducto && (
        <ProductoModal
          bodegaId={bodegaId}
          notificar={notificar}
          onClose={() => setModalProducto(false)}
          onCreado={() => cargarCatalogo(busqueda)}
        />
      )}

      {/* Módulo: Entrada de Mercadería */}
      {modalEntrada && (
        <EntradaMercaderiaModal
          bodegaId={bodegaId}
          cajeroId={cajeroId}
          productos={productos}
          notificar={notificar}
          onClose={() => setModalEntrada(false)}
          onRegistrado={() => cargarCatalogo(busqueda)}
        />
      )}

      {/* Módulo: Nuevo Cliente con Crédito */}
      {modalCliente && (
        <ClienteModal
          bodegaId={bodegaId}
          notificar={notificar}
          onClose={() => setModalCliente(false)}
          onGuardado={(cliente) => {
            setClienteActual(cliente);
            setDniCliente(cliente.dni);
          }}
        />
      )}

      {/* Módulo: Cobrar Deuda Pendiente */}
      {modalCobroDeuda && (
        <CobroDeudaModal
          bodegaId={bodegaId}
          cajeroId={cajeroId}
          notificar={notificar}
          onClose={() => setModalCobroDeuda(false)}
          onPagoRealizado={(res) => {
            if (clienteActual && res.cliente.id === clienteActual.id) {
              setClienteActual(res.cliente);
            }
          }}
        />
      )}

      {/* Módulo: Historial de Ventas de Hoy */}
      {modalHistorial && (
        <HistorialModal
          bodegaId={bodegaId}
          notificar={notificar}
          onClose={() => setModalHistorial(false)}
          onReimprimir={(venta) => setReciboReimpresion(venta)}
          onVentaAnulada={() => {}}
        />
      )}

      {/* Módulo: Ventas en Espera */}
      {modalVentasEspera && (
        <VentasEsperaModal
          bodegaId={bodegaId}
          notificar={notificar}
          onClose={() => setModalVentasEspera(false)}
          onRecuperar={handleRecuperarVenta}
        />
      )}
    </div>
  );
}
