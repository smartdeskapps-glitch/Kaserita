// Menú «Más» (paleta de comandos con buscador) con todas las opciones del POS.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';
import { createPortal } from 'react-dom';
import PaletaMenu from '../PaletaMenu.jsx';
import MenuMovil from './MenuMovil.jsx';

export default function MenuMas({
  abrirAgenda, abrirAuditoria, abrirCierreCaja, abrirComisiones, abrirCuentasPorPagar,
  abrirDashboard, abrirDesdeMenu, abrirEntradaMercaderia, abrirGestionCajeros,
  abrirHistorialDelDia, abrirModalCombos, abrirModalDelivery, abrirModuloCobroDeudas,
  abrirInventarioValorizado, abrirTomaInventario, busquedaMenu, cajeroSeleccionado, cerrarSesion, elevado, esAdmin,
  esBarberia, esCajeroDelUsuarioActivo, esModoDemo, indiceMenu, listaCajeros, menuEnRiel,
  menuMas, productos, ranuraRiel, rolActivo, rolesEnServidor, sbClient, setBusquedaMenu,
  setCajeroPendientePin, setIndiceMenu, setMenuMas, setModalInventarioInicial, setModalMerma,
  setModalPinCajero, setModalTurno, setNuevoPinCajero, setPinConfirmarCajero, soltarAdmin,
  turnoActivo, bodegaNombre, usuarioActivo
}) {
  // Referencias de la hoja del celular: el arrastre para cerrar mueve la hoja y atenúa el velo directamente.
  const hojaRef = React.useRef(null);
  const velaRef = React.useRef(null);
  return (
    <>
      {/* Menú "Más módulos" estilo paleta de comandos: buscador arriba,
          opciones agrupadas y navegación con teclado (↑ ↓ Enter Esc).
          Es el único punto de entrada a estas funciones en cualquier
          tamaño de pantalla -- en mobile sigue siendo una hoja que sube
          desde abajo, en desktop es un panel centrado cerca del borde
          superior. Las opciones son datos (no botones sueltos) para que
          el buscador y el teclado funcionen sobre la misma lista. */}
      {menuMas && (() => {
        // Productos con 5 o menos unidades: mismo criterio que "Por reponer" en Entrada de mercadería.
        const porReponer = (productos || []).filter((p) => p.stock_actual !== null && p.stock_actual !== undefined && p.stock_actual !== '' && Number(p.stock_actual) <= 5).length;
        // `id`, `trazo` (icono de trazo) y `sub` (subtítulo) los usa la hoja del celular; la paleta de
        // escritorio solo lee etiqueta, grupo, buscar e icono.
        const opciones = [
          turnoActivo
            ? { grupo: '', etiqueta: 'Cerrar Caja', icono: 'fa-lock', trazo: 'candado', tono: 'rose', esTurno: true, accion: abrirCierreCaja }
            : { grupo: '', etiqueta: 'Abrir Turno', icono: 'fa-bolt', trazo: 'rayo', tono: 'primario', soloMovil: true, esTurno: true, accion: () => setModalTurno(true) },
          { id: 'fiados', grupo: 'Ventas y caja', etiqueta: 'Fiados', buscar: 'cuentas por cobrar deudas credito deuda', icono: 'fa-hand-holding-dollar', trazo: 'hand', sub: 'Cuentas por cobrar', accion: abrirModuloCobroDeudas },
          { id: 'historial', grupo: 'Ventas y caja', etiqueta: 'Historial', buscar: 'ventas boletas anular reimprimir whatsapp', icono: 'fa-receipt', trazo: 'recibo', sub: 'Ventas, boletas y anulaciones', accion: abrirHistorialDelDia },
          !esBarberia && { id: 'toma', grupo: 'Inventario', etiqueta: 'Toma de Inventario', buscar: 'conteo stock contar', icono: 'fa-clipboard-check', trazo: 'clip', sub: 'Cuenta y ajusta el stock', accion: abrirTomaInventario },
          { id: 'merma', grupo: 'Inventario', etiqueta: 'Registrar merma', buscar: 'merma perdida vencido roto robo', icono: 'fa-box', trazo: 'warn', sub: 'Vencidos, rotos o perdidos', accion: () => setModalMerma(true) },
          ...(esAdmin ? [
            { id: 'dashboard', grupo: 'Administración', etiqueta: 'Dashboard de Ventas', buscar: 'reportes ganancia analisis', icono: 'fa-chart-pie', trazo: 'pie', sub: 'Ventas, ganancia y tendencias', accion: abrirDashboard },
            !esBarberia && { id: 'valorizado', grupo: 'Administración', etiqueta: 'Inventario valorizado', buscar: 'costo venta ganancia margen precio valor inversion utilidad', icono: 'fa-tags', trazo: 'etiqueta', sub: 'Costo, venta y ganancia', accion: abrirInventarioValorizado },
            !esBarberia && { id: 'pagar', grupo: 'Administración', etiqueta: 'Cuentas por Pagar', buscar: 'proveedores deuda', icono: 'fa-file-invoice', trazo: 'credito', sub: 'Lo que debes a proveedores', accion: abrirCuentasPorPagar },
            { id: 'cajeros', grupo: 'Administración', etiqueta: esBarberia ? 'Barberos' : 'Cajeros y Empleados', buscar: 'personal usuarios pin', icono: 'fa-user-group', trazo: 'users', sub: 'Quién puede entrar y vender', accion: abrirGestionCajeros },
            esBarberia && { id: 'comisiones', grupo: 'Administración', etiqueta: 'Comisiones de barberos', icono: 'fa-percent', trazo: 'porcentaje', sub: 'Pagos por barbero', accion: abrirComisiones },
            esBarberia && { id: 'agenda', grupo: 'Administración', etiqueta: 'Agenda de citas', icono: 'fa-calendar-days', trazo: 'calendario', sub: 'Citas del día', accion: abrirAgenda },
            { id: 'actividad', grupo: 'Administración', etiqueta: 'Registro de actividad', buscar: 'auditoria cambios anulaciones', icono: 'fa-clipboard-check', trazo: 'act', sub: 'Cambios y anulaciones', accion: abrirAuditoria },
            { id: 'link', grupo: 'Administración', etiqueta: 'Mi Link de Pedidos', buscar: 'delivery tienda pedidos online', icono: 'fa-share-nodes', trazo: 'compartir', sub: 'Tu tienda para clientes', accion: abrirModalDelivery },
            { id: 'registrar', grupo: 'Entradas', etiqueta: esBarberia ? 'Registrar Servicios y Productos' : 'Registrar Productos', buscar: 'crear producto nuevo catalogo', icono: 'fa-boxes-stacked', trazo: 'boxes', sub: 'Agrega productos nuevos', accion: () => setModalInventarioInicial(true) },
            !esBarberia && { id: 'entrada', grupo: 'Entradas', etiqueta: 'Entrada de Mercadería', buscar: 'compra proveedor reponer stock', icono: 'fa-truck-ramp-box', trazo: 'truck', sub: porReponer > 0 ? `${porReponer} por reponer` : 'Suma stock de tus compras', subTono: porReponer > 0 ? 'amb' : undefined, accion: abrirEntradaMercaderia },
            { id: 'combos', grupo: 'Catálogo', etiqueta: 'Combos', buscar: 'promociones ofertas packs', icono: 'fa-gift', trazo: 'gift', sub: 'Promociones y packs', accion: abrirModalCombos },
          ] : []),
          // El manual solo lo sirve /api/manual a quien tiene sesión: antes de abrirlo se
          // renueva el token por si venció, y la pestaña se abre primero para que el
          // navegador no la bloquee como ventana emergente.
          !esModoDemo && {
            grupo: 'Cuenta', etiqueta: 'Manual de uso', icono: 'fa-circle-question', trazo: 'ayuda',
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
              ? { grupo: 'Cuenta', etiqueta: 'Bloquear administración', icono: 'fa-lock', trazo: 'candado', accion: soltarAdmin }
              : {
                  grupo: 'Cuenta', etiqueta: 'Desbloquear administración', icono: 'fa-lock-open', trazo: 'candadoAbierto', tono: 'amber',
                  insignia: 'PIN',
                  accion: () => {
                    const c = cajeroSeleccionado || listaCajeros.find(esCajeroDelUsuarioActivo);
                    if (c) { setPinConfirmarCajero(''); setCajeroPendientePin(c); }
                  }
                }
          ),
          (!esModoDemo && rolesEnServidor && elevado && rolActivo === 'dueno' && cajeroSeleccionado) && {
            grupo: 'Cuenta', etiqueta: 'Cambiar mi PIN de administrador', icono: 'fa-key', trazo: 'llave',
            accion: () => { setNuevoPinCajero(''); setModalPinCajero(cajeroSeleccionado); }
          },
          { grupo: 'Cuenta', etiqueta: 'Cerrar Sesión', icono: 'fa-right-from-bracket', trazo: 'salir', tono: 'rose', accion: cerrarSesion },
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

        // Celular: hoja que sube desde abajo (y se puede arrastrar hacia abajo para cerrarla).
        return (
          <div ref={velaRef} className="menu-vela-anim fixed inset-0 bg-[#2d284b]/45 z-[60] flex items-end" onClick={cerrarMenu}>
            <div
              ref={hojaRef}
              className="menu-hoja menu-hoja-anim relative w-full max-h-[88dvh] flex flex-col bg-[#f3f5ff] rounded-t-[28px] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <MenuMovil
                opciones={propsPaleta.opciones}
                busqueda={busquedaMenu}
                setBusqueda={setBusquedaMenu}
                onClose={cerrarMenu}
                turnoActivo={turnoActivo}
                nombreUsuario={cajeroSeleccionado?.nombre || usuarioActivo?.nombre}
                bodegaNombre={bodegaNombre}
                hojaRef={hojaRef}
                velaRef={velaRef}
              />
            </div>
          </div>
        );
      })()}
    </>
  );
}
