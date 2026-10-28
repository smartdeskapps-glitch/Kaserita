import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function HistorialCierres({
  abrirHistorialDelDia,
  atajoCierres,
  cargandoCierres,
  cargarHistorialCierresPorRango,
  cierreDetalle,
  cierresCaja,
  elegirAtajoCierres,
  etiquetaDiaHistorial,
  fechaFinCierres,
  fechaInicioCierres,
  formatoSoles,
  modalHistorialCierres,
  setCierreDetalle,
  setFechaFinCierres,
  setFechaInicioCierres,
  setModalHistorialCierres,
  setSoloConDiferenciaCierres,
  soloConDiferenciaCierres,
}) {
  return (
    <>
              {/* Modal: Historial de Cierres de Caja */}
              {/* Modal: Historial de cierres de caja (turnos cerrados y si cuadraron) */}
              {modalHistorialCierres && (() => {
                const borde = 'border-[#e9e6f0]';
                const dinero = (v) => `S/ ${formatoSoles(Math.abs(Number(v) || 0))}`;
                const difDe = (t) => Number(t.diferencia) || 0;
                const total = cierresCaja.length;
                const cuadran = cierresCaja.filter((t) => difDe(t) === 0).length;
                const conDif = total - cuadran;
                const pctCuadran = total > 0 ? (cuadran / total) * 100 : 0;
                const acumulada = cierresCaja.reduce((a, t) => a + difDe(t), 0);
                const visibles = soloConDiferenciaCierres ? cierresCaja.filter((t) => difDe(t) !== 0) : cierresCaja;
                const grupos = [];
                visibles.forEach((t) => {
                  const etiqueta = etiquetaDiaHistorial(t.fecha_cierre);
                  const ultimo = grupos[grupos.length - 1];
                  if (ultimo && ultimo.etiqueta === etiqueta) ultimo.turnos.push(t);
                  else grupos.push({ etiqueta, turnos: [t] });
                });
                const elegido = cierreDetalle ? cierresCaja.find((t) => t.id === cierreDetalle) || null : null;
                const panel = elegido || visibles[0] || null;
                const hora = (f) => new Date(f).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
                const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
                const horaApertura = (t) => (mismoDia(t.fecha_apertura, t.fecha_cierre) ? hora(t.fecha_apertura) : `${new Date(t.fecha_apertura).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }).replace(/\./g, '')}, ${hora(t.fecha_apertura)}`);
                const fechaHora = (f) => `${new Date(f).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }).replace(/\./g, '')}, ${hora(f)}`;
                const esperadoDe = (t) => Number(t.monto_inicial || 0) + Number(t.ventas_sistema || 0);
                const duracion = (t) => {
                  const min = Math.max(0, Math.round((new Date(t.fecha_cierre) - new Date(t.fecha_apertura)) / 60000));
                  return min < 60 ? `${min} min` : `${Math.round(min / 60)} h`;
                };
                const ATAJOS = [['hoy', 'Hoy'], ['7dias', '7 días'], ['30dias', '30 días'], ['fechas', 'Fechas']];
                const rangoTexto = `${new Date(`${fechaInicioCierres}T00:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }).replace(/\./g, '')} – ${new Date(`${fechaFinCierres}T00:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '')}`;
                const tarjeta = `relative overflow-hidden bg-white border ${borde} rounded-[18px] px-5 py-[18px] shadow-[0_1px_2px_rgba(20,10,50,0.04),0_16px_36px_-26px_rgba(20,10,50,0.3)]`;
                const celdaDif = (t) => {
                  const d = difDe(t);
                  if (d === 0) return <span className="inline-flex items-center text-[13px] font-semibold rounded-full px-3 py-[3px] text-[#0f7b4a] bg-[#eef8f2]">Cuadra</span>;
                  const leve = Math.abs(d) < 1;
                  return <span className={`inline-flex items-center text-[13px] font-semibold rounded-full px-3 py-[3px] tabular-nums ${leve ? 'text-[#a15c07] bg-[#fdf5e8]' : 'text-[#c0262d] bg-[#fdf1f1]'}`}>{d > 0 ? '+' : '-'} {dinero(d)}</span>;
                };
                const detalleCierre = (t) => {
                  const d = difDe(t);
                  const ok = d === 0;
                  const leve = Math.abs(d) < 1;
                  return (
                    <div className="flex flex-col gap-3.5">
                      <div className={`bg-white border ${borde} rounded-[18px] shadow-[0_18px_40px_-24px_rgba(20,10,50,0.35)]`}>
                        <div className="px-[22px] pt-[22px] pb-[18px]">
                          <div className={`w-[60px] h-[60px] rounded-full grid place-items-center text-[26px] text-white mb-3 ${ok ? 'bg-gradient-to-br from-[#2fa972] to-[#0f7b4a] shadow-[0_14px_26px_-10px_rgba(15,123,74,0.6)]' : leve ? 'bg-gradient-to-br from-[#f0b24a] to-[#d98a14] shadow-[0_14px_26px_-10px_rgba(217,138,20,0.6)]' : 'bg-gradient-to-br from-[#e0565c] to-[#c0262d] shadow-[0_14px_26px_-10px_rgba(192,38,45,0.6)]'}`}>
                            <i className={`fa-solid ${ok ? 'fa-check' : 'fa-circle-exclamation'}`}></i>
                          </div>
                          <p className="text-[13px] text-stone-500">{t.cajeros?.nombre || 'Cajero'} · {etiquetaDiaHistorial(t.fecha_cierre)}</p>
                          <p className="text-[30px] font-bold tracking-[-0.04em] leading-[1.1] mt-1.5 text-stone-900">{ok ? 'Cuadra' : d > 0 ? `Sobran ${dinero(d)}` : `Faltan ${dinero(d)}`}</p>
                          <p className={`text-[13px] mt-1.5 ${ok ? 'text-[#0f7b4a]' : leve ? 'text-[#a15c07]' : 'text-[#c0262d]'}`}>
                            {ok ? 'Lo contado es igual a lo esperado.' : d > 0 ? 'Había más efectivo del esperado.' : 'Había menos efectivo del esperado.'}
                          </p>
                          <div className="h-1.5 rounded-sm bg-[#ece9f4] mt-4"><i className="block h-full rounded-sm bg-gradient-to-r from-[#9b7bf5] to-[#6b44d8]"></i></div>
                          <div className="flex justify-between text-xs text-stone-500 mt-1.5"><span>{hora(t.fecha_apertura)}</span><span>{hora(t.fecha_cierre)} · {duracion(t)}</span></div>
                        </div>
                        <div className="relative mx-3.5 border-t-2 border-dashed border-[#e3dff0]">
                          <span className={`absolute -top-[11px] -left-[25px] w-5 h-5 rounded-full bg-[#f8f7fb] border ${borde} [clip-path:inset(0_0_0_50%)]`}></span>
                          <span className={`absolute -top-[11px] -right-[25px] w-5 h-5 rounded-full bg-[#f8f7fb] border ${borde} [clip-path:inset(0_50%_0_0)]`}></span>
                        </div>
                        <div className="px-[22px] pt-[18px] pb-[22px] text-[13.5px]">
                          {[
                            ['Apertura', fechaHora(t.fecha_apertura)],
                            ['Cierre', fechaHora(t.fecha_cierre)],
                            ['Fondo inicial', `S/ ${formatoSoles(Number(t.monto_inicial || 0))}`],
                            ['Ventas en efectivo', `+ S/ ${formatoSoles(Number(t.ventas_sistema || 0))}`],
                            ['Esperado en caja', `S/ ${formatoSoles(esperadoDe(t))}`],
                          ].map(([r, v]) => (
                            <div key={r} className="flex justify-between gap-3 py-[11px] border-b border-[#f3f0f8]">
                              <span className="text-stone-500">{r}</span><span className="font-medium text-stone-900 tabular-nums">{v}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-baseline gap-3 pt-[13px] mt-0.5 border-t border-stone-900 font-semibold">
                            <span>Contado</span><span className="text-xl font-bold tracking-tight tabular-nums">S/ {formatoSoles(Number(t.monto_final_real || 0))}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-[12.5px] text-stone-500 bg-[#f1eff7] rounded-[10px] px-3.5 py-3 leading-snug">Las ventas con Yape, Plin o tarjeta no cuentan en el efectivo de la caja. Se ven en el historial de ventas.</p>
                    </div>
                  );
                };

                return (
                  <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
                    <div className="bg-[#f8f7fb] rounded-[18px] max-w-xl lg:max-w-6xl w-full max-h-[94vh] h-[94vh] lg:h-[780px] flex flex-col shadow-2xl border border-black/5 overflow-hidden">
                      <div className={`bg-white px-4 sm:px-7 py-3.5 sm:py-[18px] shrink-0 flex flex-wrap lg:flex-nowrap items-center gap-x-3 gap-y-2.5 border-b ${borde}`}>
                        {elegido && (
                          <button aria-label="Volver a la lista" onClick={() => setCierreDetalle(null)} className="lg:hidden h-9 pl-2.5 pr-3.5 rounded-full border border-[#e9e6f0] bg-white text-[13px] font-medium text-stone-700 inline-flex items-center gap-1 shrink-0"><i className="fa-solid fa-chevron-left text-[10px]"></i> Historial</button>
                        )}
                        <h3 className={`text-xl sm:text-[21px] font-bold tracking-tight text-stone-900 whitespace-nowrap ${elegido ? 'hidden lg:block' : ''}`}>Historial de ventas</h3>
                        <div className={`${elegido ? 'hidden lg:inline-flex' : 'inline-flex'} bg-[#ece9f4] rounded-full p-[3px] order-last basis-full lg:order-none lg:basis-auto lg:ml-2`}>
                          <button type="button" onClick={() => { setModalHistorialCierres(false); abrirHistorialDelDia(); }} className="flex-1 lg:flex-none h-8 px-[17px] rounded-full text-[13px] font-medium text-stone-500 hover:text-stone-900">Ventas</button>
                          <button type="button" className="flex-1 lg:flex-none h-8 px-[17px] rounded-full text-[13px] font-semibold text-stone-900 bg-white shadow-[0_1px_3px_rgba(20,10,50,0.14)] whitespace-nowrap">Cierres de caja</button>
                        </div>
                        <span className="flex-1"></span>
                        <button aria-label="Cerrar" onClick={() => { setModalHistorialCierres(false); setCierreDetalle(null); }} className="w-9 h-9 rounded-full text-stone-400 hover:text-stone-700 hover:bg-[#f1eef9] shrink-0"><i className="fa-solid fa-xmark"></i></button>
                      </div>

                      {elegido && (
                        <div className="lg:hidden flex-1 min-h-0 overflow-y-auto hide-scrollbar p-4">{detalleCierre(elegido)}</div>
                      )}

                      <div className={`${elegido ? 'hidden lg:flex' : 'flex'} flex-1 min-h-0 flex-col`}>
                        <div className="px-4 sm:px-7 pt-4 lg:pt-5 shrink-0 grid grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr] gap-3 lg:gap-3.5">
                          <div className={`${tarjeta} col-span-2 lg:col-span-1`}>
                            <span className="absolute -right-14 -top-[70px] w-[200px] h-[200px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(124,80,240,0.16), rgba(124,80,240,0))' }}></span>
                            <span className="relative text-[13px] text-stone-500">Turnos cerrados</span>
                            <b className="relative block text-[30px] lg:text-4xl font-bold tracking-[-0.04em] leading-[1.05] mt-1 mb-3 tabular-nums">{total}</b>
                            <div className="relative flex h-2 rounded overflow-hidden bg-[#ece9f4] gap-0.5">
                              {pctCuadran > 0 && <i className="block h-full bg-gradient-to-r from-[#3fbf8a] to-[#0f7b4a]" style={{ width: `${pctCuadran}%` }}></i>}
                              {pctCuadran < 100 && total > 0 && <i className="block h-full bg-gradient-to-r from-[#e0565c] to-[#c0262d]" style={{ width: `${100 - pctCuadran}%` }}></i>}
                            </div>
                            <div className="relative flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[12.5px] text-stone-500">
                              <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#0f7b4a]"></i>Cuadraron <b className="text-stone-900 font-semibold">{cuadran}</b></span>
                              <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#c0262d]"></i>Con diferencia <b className="text-stone-900 font-semibold">{conDif}</b></span>
                            </div>
                          </div>
                          <div className={tarjeta}>
                            <div className="flex items-center gap-3.5">
                              <div className="relative w-[64px] h-[64px] lg:w-[84px] lg:h-[84px] shrink-0">
                                <svg viewBox="0 0 90 90" className="w-full h-full -rotate-90">
                                  <circle cx="45" cy="45" r="36" fill="none" stroke="#ece9f4" strokeWidth="10" />
                                  <circle cx="45" cy="45" r="36" fill="none" stroke="#0f7b4a" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(pctCuadran / 100) * 226.2} 226.2`} />
                                </svg>
                                <span className="absolute inset-0 grid place-items-center text-sm lg:text-lg font-bold tracking-tight">{Math.round(pctCuadran)}%</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-[13px] text-stone-500">Cuadraron</span>
                                <b className="block text-lg lg:text-2xl font-bold tracking-tight text-[#0f7b4a] mt-0.5 whitespace-nowrap">{cuadran} de {total}</b>
                              </div>
                            </div>
                          </div>
                          <div className={tarjeta}>
                            <span className="text-[13px] text-stone-500">Diferencia acumulada</span>
                            <b className={`block text-xl lg:text-2xl font-bold tracking-tight mt-1 tabular-nums ${acumulada < 0 ? 'text-[#c0262d]' : acumulada > 0 ? 'text-[#a15c07]' : 'text-stone-900'}`}>{acumulada === 0 ? 'S/ 0.00' : `${acumulada > 0 ? '+' : '-'} ${dinero(acumulada)}`}</b>
                            <span className="block text-xs text-stone-500 mt-2">{conDif} turno{conDif === 1 ? '' : 's'} con diferencia</span>
                          </div>
                        </div>

                        <div className="px-4 sm:px-7 py-3.5 shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2.5">
                          <div className="flex bg-[#ece9f4] rounded-full p-[3px] max-w-full overflow-x-auto hide-scrollbar">
                            {ATAJOS.map(([id, texto]) => (
                              <button key={id} type="button" onClick={() => elegirAtajoCierres(id)} className={`h-8 px-[15px] rounded-full text-[13px] whitespace-nowrap transition ${atajoCierres === id ? 'bg-white text-stone-900 font-semibold shadow-[0_1px_3px_rgba(20,10,50,0.14)]' : 'text-stone-500 font-medium hover:text-stone-900'}`}>{texto}</button>
                            ))}
                          </div>
                          <span className="text-[13px] text-stone-500">{rangoTexto}</span>
                          <span className="flex-1 hidden lg:block"></span>
                          <button type="button" role="switch" aria-checked={soloConDiferenciaCierres} onClick={() => { setSoloConDiferenciaCierres((v) => !v); setCierreDetalle(null); }} className="inline-flex items-center gap-2.5 text-[13px] font-medium text-stone-700">
                            <span className={`kz-sw ${soloConDiferenciaCierres ? 'on' : ''}`}><i></i></span>Solo con diferencia
                          </button>
                          {atajoCierres === 'fechas' && (
                            <div className="flex flex-wrap items-center gap-2 w-full">
                              <input type="date" aria-label="Desde" value={fechaInicioCierres} onChange={(e) => setFechaInicioCierres(e.target.value)} className={`h-10 px-3.5 rounded-full border ${borde} bg-white text-[13px] text-stone-900`} />
                              <span className="text-xs text-stone-400">a</span>
                              <input type="date" aria-label="Hasta" value={fechaFinCierres} onChange={(e) => setFechaFinCierres(e.target.value)} className={`h-10 px-3.5 rounded-full border ${borde} bg-white text-[13px] text-stone-900`} />
                              <button onClick={() => cargarHistorialCierresPorRango(fechaInicioCierres, fechaFinCierres)} className="kz-pri h-10 px-5 text-[13px] font-semibold">Buscar</button>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-h-0 px-4 sm:px-7 pb-5 grid grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_330px] gap-4">
                          <div className="min-h-0 overflow-y-auto hide-scrollbar lg:bg-white lg:border lg:border-[#e9e6f0] lg:rounded-[18px]">
                            {cargandoCierres ? (
                              <p className="text-sm text-center py-10 text-stone-500">Cargando...</p>
                            ) : visibles.length === 0 ? (
                              <p className="text-sm text-center py-10 text-stone-500">{soloConDiferenciaCierres && total > 0 ? 'Todos los turnos de este período cuadraron.' : 'No hay cierres de caja en ese rango.'}</p>
                            ) : (
                              <>
                                {/* Celular: una tarjeta por turno */}
                                <div className="lg:hidden">
                                  {grupos.map((g) => (
                                    <div key={g.etiqueta}>
                                      <p className="flex justify-between px-1.5 pt-3 pb-1.5 text-xs font-semibold text-stone-500"><span>{g.etiqueta}</span><span>{g.turnos.length} turno{g.turnos.length === 1 ? '' : 's'}</span></p>
                                      {g.turnos.map((t) => (
                                        <div key={t.id} role="button" tabIndex={0} onClick={() => setCierreDetalle(t.id)} onKeyDown={(e) => { if (e.key === 'Enter') setCierreDetalle(t.id); }} className={`grid grid-cols-[1fr_auto] items-center gap-2.5 px-3.5 py-3.5 mb-2 bg-white border ${borde} rounded-[14px] cursor-pointer active:bg-[#faf8fe]`}>
                                          <div className="min-w-0">
                                            <p className="text-sm font-semibold text-stone-900 truncate">{t.cajeros?.nombre || 'Cajero'}</p>
                                            <p className="text-xs text-stone-500 mt-0.5">{horaApertura(t)} – {hora(t.fecha_cierre)}</p>
                                          </div>
                                          <div className="text-right">
                                            {celdaDif(t)}
                                            <p className="text-xs text-stone-500 mt-1.5 tabular-nums">Contado S/ {formatoSoles(Number(t.monto_final_real || 0))}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>

                                {/* PC: tabla */}
                                <table className="hidden lg:table w-full border-collapse">
                                  <thead>
                                    <tr className="text-left text-xs font-medium text-stone-500">
                                      {['Cajero', 'Apertura', 'Cierre'].map((c) => <th key={c} className={`sticky top-0 z-[2] bg-white px-3 py-3.5 border-b ${borde} whitespace-nowrap font-medium`}>{c}</th>)}
                                      {['Fondo', 'En efectivo', 'Contado', 'Diferencia'].map((c) => <th key={c} className={`sticky top-0 z-[2] bg-white px-3 py-3.5 border-b ${borde} whitespace-nowrap text-right font-medium`}>{c}</th>)}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {grupos.map((g) => (
                                      <React.Fragment key={g.etiqueta}>
                                        <tr className="bg-[#faf9fc] text-xs font-semibold text-stone-500">
                                          <td colSpan={5} className="px-3 py-2.5">{g.etiqueta}</td>
                                          <td colSpan={2} className="px-3 py-2.5 text-right">{g.turnos.length} turno{g.turnos.length === 1 ? '' : 's'}</td>
                                        </tr>
                                        {g.turnos.map((t) => (
                                          <tr key={t.id} onClick={() => setCierreDetalle(t.id)} className={`cursor-pointer text-[13.5px] text-stone-700 transition ${panel && panel.id === t.id ? 'bg-[#f4f0fd] shadow-[inset_3px_0_0_#6105dc]' : 'hover:bg-[#fbfafd]'}`}>
                                            <td className="px-3 py-3 border-b border-[#f3f0f8] whitespace-nowrap max-w-[140px] truncate">{t.cajeros?.nombre || 'Cajero'}</td>
                                            <td className="px-3 py-3 border-b border-[#f3f0f8] whitespace-nowrap text-stone-500">{horaApertura(t)}</td>
                                            <td className="px-3 py-3 border-b border-[#f3f0f8] whitespace-nowrap text-stone-500">{hora(t.fecha_cierre)}</td>
                                            <td className="px-3 py-3 border-b border-[#f3f0f8] whitespace-nowrap text-right tabular-nums font-semibold text-stone-900">S/ {formatoSoles(Number(t.monto_inicial || 0))}</td>
                                            <td className="px-3 py-3 border-b border-[#f3f0f8] whitespace-nowrap text-right tabular-nums font-semibold text-stone-900">S/ {formatoSoles(Number(t.ventas_sistema || 0))}</td>
                                            <td className="px-3 py-3 border-b border-[#f3f0f8] whitespace-nowrap text-right tabular-nums font-semibold text-stone-900">S/ {formatoSoles(Number(t.monto_final_real || 0))}</td>
                                            <td className="px-3 py-3 border-b border-[#f3f0f8] whitespace-nowrap text-right">{celdaDif(t)}</td>
                                          </tr>
                                        ))}
                                      </React.Fragment>
                                    ))}
                                  </tbody>
                                </table>
                              </>
                            )}
                          </div>

                          <div className="hidden lg:block min-h-0 overflow-y-auto hide-scrollbar">
                            {panel ? detalleCierre(panel) : <p className="text-sm text-stone-500 text-center py-10">Elige un turno para ver su detalle.</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
    </>
  );
}
