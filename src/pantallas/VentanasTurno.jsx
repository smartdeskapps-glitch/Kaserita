// Ventanas del turno: abrir turno, PIN de administrador, cajas abiertas y caja de un día anterior.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';
import { totalConteo } from '../lib/arqueo.js';
import { etiquetaCuandoTurno } from '../pos/utilidades.js';
import { ContadorEfectivo } from '../pos/componentes.jsx';
import { PIN_MIN_DUENO, PIN_MAX } from '../PanelAdminCompartido.jsx';
import { antiguedadTurno } from '../lib/turnos.js';

export default function VentanasTurno({
  abrirCajaNueva, abrirGestionCajeros, avisoTurnoViejo, cajasAbiertasAviso, cajeroPendientePin,
  cajeroSeleccionado, cambiarConteo, confirmarPinCajero, conteoAbierto, conteoEfectivo,
  crearPinAdmin, elegirCajeroTurno, esAdmin, formCrearPin, guardandoCrearPin,
  guardarCrearPinAdmin, handleAbrirTurno, listaCajeros, modalTurno, montoApertura,
  pinConfirmarCajero, retomarTurnoViejo, setCajeroPendientePin, setCierreAlRetomar,
  setConteoAbierto, setConteoEfectivo, setCrearPinAdmin, setFormCrearPin, setModalTurno,
  setMontoApertura, setMostrarFormNuevoCajero, setPinConfirmarCajero, ultimoCierre,
  unirseACaja, verificandoPinCajero
}) {
  return (
    <>
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
    </>
  );
}
