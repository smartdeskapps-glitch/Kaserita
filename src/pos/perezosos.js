// Pantallas y ventanas que se cargan bajo demanda (React.lazy): cada una baja su
// propio archivo la primera vez que se abre.
import React from 'react';

// Panel del super-administrador: crea bodegas (el único lugar donde se
// puede crear una, ver panel_admin.sql) y controla su vigencia. No usa
// "sesion" (esa es la de dueño/cajero de una bodega) -- entra con su
// propia cuenta de correo+contraseña de Supabase Auth.
export const PanelAdmin = React.lazy(() => import('../PanelAdmin.jsx'));

export const DashboardVentas = React.lazy(() => import('../DashboardVentas.jsx'));

export const CierreCaja = React.lazy(() => import('../CierreCaja.jsx'));

export const InventarioInicial = React.lazy(() => import('../InventarioInicial.jsx'));

export const CombosModal = React.lazy(() => import('../CombosModal.jsx'));

export const MermaModal = React.lazy(() => import('../MermaModal.jsx'));

export const TomaInventario = React.lazy(() => import('../TomaInventario.jsx'));

export const EditarProducto = React.lazy(() => import('../EditarProducto.jsx'));

export const EntradaMercaderia = React.lazy(() => import('../EntradaMercaderia.jsx'));

export const HistorialCierres = React.lazy(() => import('../HistorialCierres.jsx'));

export const EscanerCamara = React.lazy(() => import('../EscanerCamara.jsx'));

export const FiadosModal = React.lazy(() => import('../FiadosModal.jsx'));

export const CuentasPagar = React.lazy(() => import('../CuentasPagar.jsx'));

export const NuevoProveedor = React.lazy(() => import('../NuevoProveedor.jsx'));

export const HistorialInventario = React.lazy(() => import('../HistorialInventario.jsx'));

export const GestionCajeros = React.lazy(() => import('../GestionCajeros.jsx'));

export const ComisionesBarberos = React.lazy(() => import('../ComisionesBarberos.jsx'));

export const HorarioBarbero = React.lazy(() => import('../HorarioBarbero.jsx'));

export const AgendaCitas = React.lazy(() => import('../AgendaCitas.jsx'));

export const DeliveryModal = React.lazy(() => import('../DeliveryModal.jsx'));

export const RegistroActividad = React.lazy(() => import('../RegistroActividad.jsx'));

export const PinCajero = React.lazy(() => import('../PinCajero.jsx'));

export const QRLocal = React.lazy(() => import('../QRLocal.jsx'));

export const NuevoCliente = React.lazy(() => import('../NuevoCliente.jsx'));

export const HistorialVentas = React.lazy(() => import('../HistorialVentas.jsx'));
