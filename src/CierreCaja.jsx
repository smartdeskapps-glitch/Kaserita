import React from 'react';
import { diferenciaArqueo, totalConteo } from './lib/arqueo.js';
import { antiguedadTurno } from './lib/turnos.js';

// Modales de cierre de caja: el arqueo (contar el efectivo) y el resumen del turno
// cerrado. Se cargan al abrirlos (React.lazy en main.jsx). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function CierreCaja({
  abrirHistorialCierres,
  arqueoEsperado,
  cajeroSeleccionado,
  cambiarConteo,
  confirmarCierreConArqueo,
  conteoAbierto,
  conteoEfectivo,
  modalCierreCaja,
  montoConteoEfectivo,
  resumenCierre,
  setConteoAbierto,
  setConteoEfectivo,
  setModalCierreCaja,
  setMontoConteoEfectivo,
  setResumenCierre,
  turnoActivo,
  ContadorEfectivo,
  DesgloseMediosPago,
  etiquetaCuandoTurno,
}) {
  return (
    <>
              {/* Modal: Cierre de Caja con Arqueo */}
              {modalCierreCaja && (() => {
                const dinero = (v) => `S/ ${(Number(v) || 0).toFixed(2)}`;
                const f = arqueoEsperado;
                const montoVacio = montoConteoEfectivo === '';
                const conteoActivo = totalConteo(conteoEfectivo) > 0;
                const dif = f && !montoVacio ? diferenciaArqueo(montoConteoEfectivo, f.esperado) : null;
                const edad = turnoActivo ? antiguedadTurno(turnoActivo.fecha_apertura) : null;
                const nombreCajero = turnoActivo?.cajeros?.nombre || cajeroSeleccionado?.nombre || 'Cajero';
                const cuando = turnoActivo?.fecha_apertura ? new Date(turnoActivo.fecha_apertura).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                const resultado = dif === null
                  ? { clase: 'bg-[#f1eef9] text-stone-500', icono: 'fa-coins', titulo: 'Escribe lo que contaste', texto: 'Te diré si cuadra con lo que debería haber.' }
                  : dif === 0
                    ? { clase: 'bg-emerald-50 text-emerald-600', icono: 'fa-check', titulo: 'Cuadra perfecto', texto: 'Lo que contaste es justo lo que debería haber.' }
                    : dif > 0
                      ? { clase: 'bg-[#eaf1ff] text-blue-600', icono: 'fa-arrow-up', titulo: `Sobran ${dinero(dif)}`, texto: 'Hay más efectivo del esperado. Revisa si diste de menos en algún vuelto o si falta registrar una venta.' }
                      : { clase: 'bg-rose-50 text-rose-600', icono: 'fa-arrow-down', titulo: `Faltan ${dinero(-dif)}`, texto: 'Hay menos efectivo del esperado. Vuelve a contar los billetes y revisa los vueltos antes de cerrar.' };
                return (
                  <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-3xl w-full shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
                      <div className="bg-white border-b border-stone-100 px-4 sm:px-5 py-3.5 shrink-0 flex items-center gap-3">
                        <span className="w-11 h-11 rounded-[14px] bg-stone-900 text-white grid place-items-center text-xl shrink-0"><i className="fa-solid fa-lock"></i></span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[17px] sm:text-lg font-extrabold text-stone-900 tracking-tight leading-tight">Cerrar turno</h3>
                          <p className="hidden sm:block text-[12.5px] text-stone-500 mt-0.5 truncate">Caja de {nombreCajero}{cuando && edad ? ` · abierta el ${cuando} (${edad.etiqueta})` : ''}</p>
                        </div>
                        <button aria-label="Cerrar" onClick={() => setModalCierreCaja(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors shrink-0"><i className="fa-solid fa-xmark"></i></button>
                      </div>

                      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5">
                        {edad?.antiguo && (
                          <div className="flex gap-2.5 items-start rounded-[14px] bg-amber-50 text-amber-700 px-3 py-2.5 text-xs leading-snug mb-4"><i className="fa-solid fa-triangle-exclamation mt-0.5"></i><span>Esta caja lleva abierta {edad.etiqueta.replace('hace ', '')}: el arqueo suma las ventas de todo ese tiempo. Cuenta con cuidado y ciérrala hoy.</span></div>
                        )}
                        <div className="grid gap-4 md:grid-cols-2 items-start">
                          <div className="bg-white border border-stone-100 rounded-[22px] p-4 sm:p-[18px]">
                            {!f ? (
                              <p className="text-[13px] text-stone-500 py-6 text-center">Calculando cuánto debería haber en caja...</p>
                            ) : (
                              <>
                                <div className="flex flex-wrap gap-2 mb-3">
                                  <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-[#f1eef9] text-stone-500">{f.cantidadVentas} venta{f.cantidadVentas === 1 ? '' : 's'}</span>
                                  <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-[#f1eef9] text-stone-500">{dinero(f.totalVendido)} vendido</span>
                                </div>
                                <div className="flex justify-between items-baseline py-[7px] text-[13px]"><span className="font-semibold text-stone-500">Fondo inicial</span><b>{dinero(f.inicio)}</b></div>
                                <div className="flex justify-between items-baseline py-[7px] text-[13px]"><span className="font-semibold text-stone-500">+ Ventas en efectivo</span><b>{dinero(f.ventas)}</b></div>
                                <div className="flex justify-between items-baseline pt-3 mt-1.5 border-t-2 border-dashed border-[#e4d6fb]"><span className="font-bold text-[13px]">Deberías tener</span><b className="text-[28px] font-extrabold text-[#4d04b0] tracking-tight leading-none">{dinero(f.esperado)}</b></div>
                              </>
                            )}
                            <DesgloseMediosPago desglose={f?.desglose} />
                          </div>

                          <div className="bg-white border border-stone-100 rounded-[22px] p-4 sm:p-[18px]">
                            <h4 className="text-[15px] font-extrabold text-stone-900 tracking-tight">Cuenta tu efectivo</h4>
                            <p className="text-[12.5px] text-stone-500 mt-0.5 mb-3.5">Cuenta todo el dinero que tienes físicamente en la caja.</p>
                            <div className="flex items-baseline gap-2.5 border-2 border-stone-200 rounded-[20px] bg-stone-50/70 px-4 sm:px-[18px] py-3 focus-within:border-[#6105dc] focus-within:bg-white focus-within:ring-[5px] focus-within:ring-[#6105dc]/15 transition">
                              <span className="text-[22px] font-extrabold text-stone-300">S/</span>
                              <input type="number" min="0" step="0.50" inputMode="decimal" placeholder="0.00" aria-label="Efectivo contado" autoFocus readOnly={conteoActivo} value={montoConteoEfectivo} onChange={(e) => setMontoConteoEfectivo(e.target.value)} className="w-full min-w-0 bg-transparent outline-none border-0 text-[32px] sm:text-[38px] font-extrabold tracking-tight text-stone-900 placeholder:text-stone-300" />
                            </div>
                            <button type="button" onClick={() => setConteoAbierto((v) => !v)} className="mt-3 inline-flex items-center gap-2 text-[12.5px] font-bold text-[#4d04b0] hover:bg-[#f4eefe] rounded-lg px-1 py-1.5">
                              <i className="fa-solid fa-coins text-sm"></i> Contar billetes y monedas <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${conteoAbierto ? 'rotate-180' : ''}`}></i>
                            </button>
                            {conteoAbierto && <ContadorEfectivo conteo={conteoEfectivo} onChange={(n) => cambiarConteo(n, setMontoConteoEfectivo)} />}
                            {conteoActivo && (
                              <p className="mt-2 text-[11.5px] text-stone-500">El monto se calcula con tu conteo. <button type="button" onClick={() => setConteoEfectivo({})} className="font-bold text-[#4d04b0]">Escribirlo a mano</button></p>
                            )}
                            <div className={`mt-3.5 rounded-[18px] px-4 py-3.5 flex gap-3 items-center ${resultado.clase}`}>
                              <span className="w-10 h-10 rounded-full bg-white/70 grid place-items-center text-lg shrink-0"><i className={`fa-solid ${resultado.icono}`}></i></span>
                              <div><b className="block text-[17px] font-extrabold leading-tight">{resultado.titulo}</b><small className="block text-xs mt-0.5 leading-snug">{resultado.texto}</small></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 bg-white border-t border-stone-100 px-4 sm:px-5 py-3 flex items-center gap-2.5 shadow-[0_-8px_24px_-14px_rgba(40,10,90,0.18)]">
                        <button type="button" onClick={() => setModalCierreCaja(false)} className="h-[46px] px-4 sm:px-5 rounded-[14px] text-stone-500 hover:text-stone-800 hover:bg-stone-100 font-bold text-[13.5px]">Cancelar</button>
                        <span className="flex-1"></span>
                        <span className="hidden md:block text-xs text-stone-500">{montoVacio ? 'Escribe lo que contaste para cerrar' : ''}</span>
                        <button type="button" onClick={confirmarCierreConArqueo} disabled={montoVacio || !f} className="h-[46px] px-5 rounded-[14px] bg-stone-900 hover:bg-black disabled:bg-[#cfc8e4] disabled:cursor-not-allowed text-white font-bold text-[13.5px] inline-flex items-center justify-center gap-2 transition">
                          <i className="fa-solid fa-lock text-xs"></i> Cerrar turno
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Modal: Resumen de Arqueo */}
              {resumenCierre && (() => {
                const dinero = (v) => `S/ ${(Number(v) || 0).toFixed(2)}`;
                const d = resumenCierre.diferencia;
                const tono = d === 0 ? { fondo: 'bg-emerald-50 text-emerald-600', num: 'text-emerald-600', icono: 'fa-check' } : d > 0 ? { fondo: 'bg-[#eaf1ff] text-blue-600', num: 'text-blue-600', icono: 'fa-arrow-up' } : { fondo: 'bg-rose-50 text-rose-600', num: 'text-rose-600', icono: 'fa-arrow-down' };
                const titulo = d === 0 ? 'Turno cerrado: cuadra perfecto' : d > 0 ? `Turno cerrado: sobran ${dinero(d)}` : `Turno cerrado: faltan ${dinero(-d)}`;
                return (
                  <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-md w-full shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
                      <div className="bg-white border-b border-stone-100 px-4 sm:px-5 py-3.5 shrink-0 flex items-center gap-3">
                        <span className="w-11 h-11 rounded-[14px] bg-[#f4eefe] text-[#6105dc] grid place-items-center text-xl shrink-0"><i className="fa-solid fa-chart-simple"></i></span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[17px] sm:text-lg font-extrabold text-stone-900 tracking-tight leading-tight">Resumen del turno</h3>
                          {resumenCierre.cajero && <p className="text-[12.5px] text-stone-500 mt-0.5 truncate">Caja de {resumenCierre.cajero}{resumenCierre.cerradoEn ? ` · cerrada ${etiquetaCuandoTurno(resumenCierre.cerradoEn)}` : ''}</p>}
                        </div>
                        <button aria-label="Cerrar" onClick={() => setResumenCierre(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors shrink-0"><i className="fa-solid fa-xmark"></i></button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
                        <div className="text-center pt-1 pb-1">
                          <div className={`w-[84px] h-[84px] rounded-full grid place-items-center mx-auto mb-3 text-[34px] ${tono.fondo}`}><i className={`fa-solid ${tono.icono}`}></i></div>
                          <h4 className="text-[22px] font-extrabold text-stone-900 tracking-tight leading-tight">{titulo}</h4>
                          <p className="text-[13.5px] text-stone-500 mt-1 mb-3.5 max-w-xs mx-auto leading-snug">{d === 0 ? 'Lo contado coincide con lo esperado.' : 'La diferencia quedó registrada en el historial de cierres.'}</p>
                        </div>
                        <div className="bg-white border border-stone-100 rounded-[22px] p-4 sm:p-[18px]">
                          <div className="flex justify-between items-baseline py-[7px] text-[13px]"><span className="font-semibold text-stone-500">Fondo inicial</span><b>{dinero(resumenCierre.inicio)}</b></div>
                          <div className="flex justify-between items-baseline py-[7px] text-[13px]"><span className="font-semibold text-stone-500">+ Efectivo recibido</span><b>{dinero(resumenCierre.ventas)}</b></div>
                          <div className="flex justify-between items-baseline py-[7px] text-[13px]"><span className="font-semibold text-stone-500">= Debería haber</span><b>{dinero(resumenCierre.esperado)}</b></div>
                          <div className="flex justify-between items-baseline py-[7px] text-[13px]"><span className="font-semibold text-stone-500">Tú contaste</span><b>{dinero(resumenCierre.real)}</b></div>
                          <div className="flex justify-between items-baseline pt-3 mt-1.5 border-t-2 border-dashed border-[#e4d6fb]"><span className="font-bold text-[13px]">Diferencia</span><b className={`text-[28px] font-extrabold tracking-tight leading-none ${tono.num}`}>{d === 0 ? 'S/ 0.00' : `${d > 0 ? '+' : '−'}${dinero(Math.abs(d))}`}</b></div>
                          <DesgloseMediosPago desglose={resumenCierre.desglose} />
                        </div>
                      </div>
                      <div className="shrink-0 bg-white border-t border-stone-100 px-4 sm:px-5 py-3 flex items-center gap-2.5 shadow-[0_-8px_24px_-14px_rgba(40,10,90,0.18)]">
                        <button type="button" onClick={() => { setResumenCierre(null); abrirHistorialCierres(); }} className="h-[46px] px-4 rounded-[14px] bg-[#f4eefe] hover:bg-[#ece0fd] text-[#4d04b0] font-bold text-[13px] inline-flex items-center gap-2"><i className="fa-solid fa-clock-rotate-left text-xs"></i><span>Ver<span className="hidden sm:inline"> historial de</span> cierres</span></button>
                        <span className="flex-1"></span>
                        <button type="button" onClick={() => setResumenCierre(null)} className="h-[46px] px-6 rounded-[14px] bg-[#6105dc] hover:bg-[#4d04b0] text-white font-bold text-[13.5px] shadow-lg shadow-[#6105dc]/30">Listo</button>
                      </div>
                    </div>
                  </div>
                );
              })()}
    </>
  );
}
