// Vista del panel de superadmin (se carga bajo demanda).
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React, { Suspense } from 'react';
import { PanelAdmin } from '../pos/perezosos.js';

export default function PantallaAdmin({
  adminSesion, bodegasAdmin, cargandoBodegasAdmin, formNuevaBodega, guardandoNuevaBodega,
  notificar, sbClient, setAdminSesion, setBodegasAdmin, setCargandoBodegasAdmin,
  setFormNuevaBodega, setGuardandoNuevaBodega, toast
}) {
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
