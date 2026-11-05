// Pantalla de inicio de sesión (Google) y acceso del superadmin.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';
import { mensajeError } from '../pos/utilidades.js';

export default function PantallaLogin({
  authTab, cargandoAdminLogin, formAdminLogin, kgSyncDelayRef, notificar, revelarLogin,
  sbClient, setAdminSesion, setAuthTab, setCargandoAdminLogin, setFormAdminLogin, toast
}) {
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
