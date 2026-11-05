// Menú «Más» (paleta de comandos con buscador) con todas las opciones del POS.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';
import { createPortal } from 'react-dom';
import PaletaMenu from '../PaletaMenu.jsx';

export default function MenuMas({
  abrirAgenda, abrirAuditoria, abrirCierreCaja, abrirComisiones, abrirCuentasPorPagar,
  abrirDashboard, abrirDesdeMenu, abrirEntradaMercaderia, abrirGestionCajeros,
  abrirHistorialDelDia, abrirModalCombos, abrirModalDelivery, abrirModuloCobroDeudas,
  abrirTomaInventario, busquedaMenu, cajeroSeleccionado, cerrarSesion, elevado, esAdmin,
  esBarberia, esCajeroDelUsuarioActivo, esModoDemo, indiceMenu, listaCajeros, menuEnRiel,
  menuMas, ranuraRiel, rolActivo, rolesEnServidor, sbClient, setBusquedaMenu,
  setCajeroPendientePin, setIndiceMenu, setMenuMas, setModalInventarioInicial, setModalMerma,
  setModalPinCajero, setModalTurno, setNuevoPinCajero, setPinConfirmarCajero, soltarAdmin,
  turnoActivo
}) {
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
    </>
  );
}
