// Pantalla de cuenta vencida o desactivada (la bodega existe pero no puede operar).
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';

export default function PantallaCuentaVencida({
  bodegaNombre, cerrarSesion, sesion, toast
}) {
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
