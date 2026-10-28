import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function GestionClientes({
  abrirEdicionCliente,
  busquedaClientes,
  cargandoClientes,
  clienteEditando,
  clientesFiltradosGestion,
  clientesLista,
  esAdmin,
  exportarClientesExcel,
  filtroClientes,
  formEditarCliente,
  formatoSoles,
  guardandoEdicionCliente,
  guardarEdicionCliente,
  inicialesCliente,
  modalGestionClientes,
  setBusquedaClientes,
  setClienteEditando,
  setFiltroClientes,
  setFormEditarCliente,
  setModalGestionClientes,
  setModalNuevoCliente,
}) {
  return (
    <>
              {/* Modal: Gestión de Clientes (listar / editar) */}
              {modalGestionClientes && (() => {
                const dinero = (v) => `S/ ${formatoSoles(Number(v) || 0)}`;
                const GRADIENTES = ['from-[#9687f5] to-[#5b4bd6]', 'from-[#f09a7a] to-[#d9594f]', 'from-[#6fc3a3] to-[#2e8b72]', 'from-[#e6b85a] to-[#c9892a]', 'from-[#7ab4ee] to-[#3d7fd0]'];
                const gradienteDe = (c) => GRADIENTES[String(c.id ?? c.dni ?? '').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % GRADIENTES.length];
                const avatar = (c, tam) => <span className={`${tam} rounded-full bg-gradient-to-br ${gradienteDe(c)} text-white grid place-items-center font-bold shrink-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25),0_4px_10px_-4px_rgba(20,10,50,0.35)]`}>{inicialesCliente(c.nombre_completo)}</span>;
                const borde = 'border-[#e6e9f5]';
                const botonSeg = (activo) => `h-[30px] px-3.5 rounded-full text-[12.5px] whitespace-nowrap flex items-center gap-1.5 transition ${activo ? 'bg-white text-stone-900 font-semibold shadow-[0_1px_3px_rgba(20,10,50,0.14)]' : 'text-stone-500 font-medium hover:text-stone-900'}`;
                const colorBarra = (uso) => (uso >= 1 ? 'bg-gradient-to-r from-[#e0565c] to-[#c0262d]' : uso >= 0.8 ? 'bg-gradient-to-r from-[#f0b24a] to-[#d98a14]' : 'bg-gradient-to-r from-[#aeb4cf] to-[#9a9dbd]');
                const botonFantasma = `h-11 px-5 rounded-full border ${borde} bg-white hover:bg-[#f7f8fc] text-[13.5px] font-medium text-stone-700 inline-flex items-center justify-center gap-2 transition whitespace-nowrap`;
                const panelP = `bg-white border ${borde} rounded-2xl px-5 sm:px-6 py-5 sm:py-[22px] shadow-[0_1px_2px_rgba(20,10,50,0.03)]`;
                const labP = 'flex items-center justify-between gap-2 text-[12.5px] font-medium text-stone-700 mb-1.5';
                const inputP = 'w-full h-11 bg-white border border-[#e6e9f5] rounded-[10px] px-3.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#5b4bd6] focus:ring-[3px] focus:ring-[#5b4bd6]/10 transition';
                const chispa = (<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" /><path d="M19 15c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8Z" /></svg>);
                const saldoDe = (c) => Math.max(0, Number(c.saldo_actual) || 0);
                const usoDe = (c) => ((Number(c.limite_credito) || 0) > 0 ? saldoDe(c) / Number(c.limite_credito) : 0);
                const totalPorCobrar = clientesLista.reduce((acc, c) => acc + saldoDe(c), 0);
                const conDeuda = clientesLista.filter((c) => saldoDe(c) > 0).length;
                const filtrados = clientesFiltradosGestion();
                const sel = clienteEditando;
                const cerrar = () => { setModalGestionClientes(false); setClienteEditando(null); };
                const volverALista = () => setClienteEditando(null);

                // ----- Columna de la derecha: la ficha del cliente elegido -----
                const detalle = (() => {
                  if (!sel || !formEditarCliente) {
                    return (
                      <div className="m-auto text-center text-[13.5px] text-stone-500 leading-snug max-w-[260px] p-5">
                        <b className="block text-[15px] text-stone-900 mb-0.5">Elige un cliente</b>
                        {esAdmin ? 'Verás sus datos y podrás cambiar su teléfono, correo y crédito.' : 'Solo el administrador puede editar los datos de un cliente.'}
                      </div>
                    );
                  }
                  const saldo = saldoDe(sel);
                  const limite = Number(formEditarCliente.limite_credito) || 0;
                  const uso = limite > 0 ? saldo / limite : 0;
                  return (
                    <>
                      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 md:px-[30px] pt-4 md:pt-[26px] pb-4 md:pb-8 flex flex-col gap-5">
                        <div className="flex flex-wrap items-center gap-3.5">
                          {avatar(sel, 'w-[52px] h-[52px] md:w-14 md:h-14 text-[17px] md:text-lg')}
                          <div className="min-w-0 flex-1 basis-[180px]">
                            <h4 className="text-xl md:text-[22px] font-bold text-stone-900 tracking-tight leading-tight truncate">{sel.nombre_completo}</h4>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {[`DNI ${sel.dni}`, sel.telefono || 'Sin teléfono', `Plazo ${Number(sel.dias_credito) || 30} días`].map((t) => <span key={t} className={`text-xs text-stone-700 bg-white border ${borde} rounded-full px-2.5 py-[3px]`}>{t}</span>)}
                            </div>
                          </div>
                        </div>

                        <div className={`relative overflow-hidden bg-white border ${borde} rounded-[18px] px-[18px] md:px-6 py-[18px] md:py-[22px] shadow-[0_1px_2px_rgba(20,10,50,0.04),0_18px_40px_-26px_rgba(20,10,50,0.3)] shrink-0`}>
                          {saldo > 0 && <span className="absolute -right-14 -top-[70px] w-[220px] h-[220px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(192,38,45,0.10), rgba(192,38,45,0))' }}></span>}
                          <div className="relative flex justify-between items-end gap-3">
                            <div>
                              <span className="text-[13px] text-stone-500">Deuda actual</span>
                              <strong className={`block text-[36px] md:text-[42px] font-bold tracking-[-0.04em] leading-none mt-1.5 tabular-nums ${saldo > 0 ? 'text-[#c0262d]' : 'text-[#0f7b4a]'}`}>{dinero(saldo)}</strong>
                            </div>
                            {limite > 0 && (
                              <div className="text-right">
                                <span className="text-[13px] text-stone-500">Disponible para fiar</span>
                                <b className="block text-[17px] md:text-[19px] font-bold tracking-tight mt-1 tabular-nums">{dinero(Math.max(0, limite - saldo))}</b>
                              </div>
                            )}
                          </div>
                          {limite > 0 ? (
                            <>
                              <div className="relative h-2 rounded bg-[#e8ecf7] mt-5"><i className={`block h-full rounded ${colorBarra(uso)}`} style={{ width: `${Math.min(100, uso * 100)}%` }}></i><u className="absolute left-[80%] -top-1 w-px h-4 bg-[#bac0d6]"></u></div>
                              <div className="relative flex justify-between gap-2 flex-wrap text-[12.5px] text-stone-500 mt-2.5"><span>Usa {Math.round(uso * 100)}% de su crédito</span><span>Límite {dinero(limite)}</span></div>
                            </>
                          ) : (
                            <p className="relative text-[12.5px] text-stone-500 mt-4">Sin límite de crédito: no se le puede fiar hasta que le pongas uno.</p>
                          )}
                        </div>

                        <div className={`${panelP} shrink-0`}>
                          <h5 className="text-base font-semibold text-stone-900 tracking-tight">Datos del cliente</h5>
                          <p className="text-[13px] text-stone-500 mt-1 mb-[18px] leading-snug">El DNI no se cambia; el resto sí.</p>
                          <div className="space-y-3.5">
                            <div>
                              <label className={labP}><span>Nombre completo</span></label>
                              <input type="text" autoComplete="off" value={formEditarCliente.nombre_completo} onChange={(e) => setFormEditarCliente({ ...formEditarCliente, nombre_completo: e.target.value })} className={inputP} />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3.5">
                              <div>
                                <label className={labP}><span>Teléfono</span></label>
                                <input type="text" inputMode="tel" autoComplete="off" value={formEditarCliente.telefono} onChange={(e) => setFormEditarCliente({ ...formEditarCliente, telefono: e.target.value })} className={inputP} />
                              </div>
                              <div>
                                <label className={labP}><span>Correo</span><span className="text-stone-400 font-normal">opcional</span></label>
                                <input type="text" autoComplete="off" placeholder="correo@ejemplo.com" value={formEditarCliente.correo} onChange={(e) => setFormEditarCliente({ ...formEditarCliente, correo: e.target.value })} className={inputP} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={`${panelP} shrink-0`}>
                          <h5 className="text-base font-semibold text-stone-900 tracking-tight">Crédito</h5>
                          <p className="text-[13px] text-stone-500 mt-1 mb-[18px] leading-snug">Cuánto se le puede fiar y en cuántos días debe pagar. La deuda cambia sola con las ventas fiadas y los pagos.</p>
                          <div className="grid sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className={labP}><span>Límite de crédito (S/)</span></label>
                              <input type="number" step="10" inputMode="decimal" value={formEditarCliente.limite_credito} onChange={(e) => setFormEditarCliente({ ...formEditarCliente, limite_credito: e.target.value })} className={`${inputP} font-bold tabular-nums`} />
                            </div>
                            <div>
                              <label className={labP}><span>Días de crédito</span></label>
                              <input type="number" step="1" inputMode="numeric" value={formEditarCliente.dias_credito} onChange={(e) => setFormEditarCliente({ ...formEditarCliente, dias_credito: e.target.value })} className={`${inputP} font-bold tabular-nums`} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={`shrink-0 px-4 md:px-[30px] py-3.5 bg-white border-t ${borde} flex items-center gap-2.5 justify-end`}>
                        <button type="button" onClick={volverALista} className={botonFantasma}>Cancelar</button>
                        <button type="button" onClick={guardarEdicionCliente} disabled={guardandoEdicionCliente} className="kz-pri h-11 px-6 text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 flex-1 md:flex-none"><span>{guardandoEdicionCliente ? 'Guardando...' : 'Guardar cambios'}</span>{chispa}</button>
                      </div>
                    </>
                  );
                })();

                return (
                  <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-[#f7f8fc] border border-black/5 rounded-[18px] max-w-5xl w-full shadow-2xl h-[95vh] max-h-[780px] flex flex-col overflow-hidden">
                      <div className={`bg-white px-4 sm:px-7 py-3.5 sm:py-[18px] shrink-0 flex items-center gap-3 border-b ${borde}`}>
                        {sel && <button type="button" onClick={volverALista} className="md:hidden h-9 pl-2.5 pr-3.5 rounded-full border border-[#e6e9f5] bg-white text-[13px] font-medium text-stone-700 inline-flex items-center gap-1 shrink-0"><i className="fa-solid fa-chevron-left text-[10px]"></i> Clientes</button>}
                        <div className={`min-w-0 ${sel ? 'hidden md:block' : ''}`}>
                          <h3 className="text-xl sm:text-[21px] font-bold tracking-tight text-stone-900 leading-tight">Clientes</h3>
                          <p className="hidden md:block text-[13px] text-stone-500 mt-0.5 truncate">Tus clientes, su crédito y lo que te deben</p>
                        </div>
                        <span className="flex-1"></span>
                        <button type="button" onClick={() => setModalNuevoCliente(true)} className={`kz-pri h-11 px-5 text-[13.5px] font-semibold items-center gap-2 shrink-0 ${sel ? 'hidden md:inline-flex' : 'inline-flex'}`}><span>Nuevo<span className="hidden sm:inline"> cliente</span></span>{chispa}</button>
                        <button aria-label="Cerrar" onClick={cerrar} className="w-9 h-9 rounded-full text-stone-400 hover:text-stone-700 hover:bg-[#eef1fb] shrink-0"><i className="fa-solid fa-xmark"></i></button>
                      </div>

                      {clientesLista.length === 0 ? (
                        <div className="flex-1 grid place-items-center p-6">
                          {cargandoClientes ? (
                            <p className="text-[13px] text-stone-500">Cargando clientes...</p>
                          ) : (
                            <div className="text-center max-w-xs text-[13.5px] text-stone-500 leading-snug">
                              <div className="w-16 h-16 rounded-2xl bg-white border border-[#e6e9f5] text-[#5b4bd6] grid place-items-center text-[26px] mx-auto mb-3"><i className="fa-solid fa-users"></i></div>
                              <b className="block text-base text-stone-900 mb-0.5">Todavía no tienes clientes</b>
                              Los clientes aparecen aquí cuando les vendes o los registras. Toca «Nuevo cliente» para agregar el primero.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0 grid md:grid-cols-[380px_minmax(0,1fr)]">
                          <div className={`${sel ? 'hidden md:flex' : 'flex'} flex-col min-h-0 bg-white md:border-r ${borde}`}>
                            <div className="px-5 md:px-6 pt-5 pb-4">
                              <span className="text-[13px] text-stone-500">Por cobrar</span>
                              <strong className={`block text-[32px] md:text-4xl font-bold tracking-[-0.04em] leading-[1.05] mt-0.5 tabular-nums ${totalPorCobrar > 0 ? 'text-stone-900' : 'text-[#0f7b4a]'}`}>{dinero(totalPorCobrar)}</strong>
                              <p className="text-xs text-stone-500 mt-2">{clientesLista.length} {clientesLista.length === 1 ? 'cliente' : 'clientes'} · {conDeuda === 0 ? 'ninguno con deuda' : `${conDeuda} con deuda`}</p>
                            </div>
                            <div className="px-5 md:px-6 pb-3 space-y-2.5">
                              <label className={`flex items-center gap-2.5 h-10 border ${borde} rounded-full px-4 text-stone-400 bg-white focus-within:border-[#5b4bd6] focus-within:ring-[3px] focus-within:ring-[#5b4bd6]/10 transition`}>
                                <i className="fa-solid fa-magnifying-glass text-xs"></i>
                                <input type="text" autoComplete="off" placeholder="Buscar por nombre o DNI" value={busquedaClientes} onChange={(e) => setBusquedaClientes(e.target.value)} className="flex-1 min-w-0 bg-transparent text-[13.5px] text-stone-900 outline-none placeholder:text-stone-400" />
                              </label>
                              <div className="flex bg-[#e8ecf7] rounded-full p-[3px] w-fit max-w-full overflow-x-auto hide-scrollbar">
                                {[['todos', 'Todos', clientesLista.length], ['deuda', 'Con deuda', conDeuda], ['aldia', 'Al día', clientesLista.length - conDeuda]].map(([k, t, n]) => (
                                  <button key={k} type="button" onClick={() => setFiltroClientes(k)} className={botonSeg(filtroClientes === k)}>{t} <span className="text-[11.5px] text-stone-500 font-medium">{n}</span></button>
                                ))}
                              </div>
                              <div className="flex justify-between items-center text-xs text-stone-500">
                                <span>{filtrados.length} resultado{filtrados.length === 1 ? '' : 's'}</span>
                                {esAdmin && (
                                  <button type="button" onClick={exportarClientesExcel} className="font-semibold text-stone-700 hover:text-stone-900 inline-flex items-center gap-1.5"><i className="fa-solid fa-file-excel"></i> Exportar</button>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-3.5 pb-[18px]">
                              {cargandoClientes && <p className="text-center text-[13px] text-stone-500 py-8">Cargando...</p>}
                              {!cargandoClientes && filtrados.length === 0 && <p className="text-center text-[13px] text-stone-500 py-8 px-4"><b className="block text-stone-900">Nadie coincide</b>Prueba con otro filtro o nombre.</p>}
                              {filtrados.map((c) => {
                                const saldo = saldoDe(c);
                                const uso = usoDe(c);
                                const elegido = sel?.id === c.id;
                                return (
                                  <button type="button" key={c.id} onClick={() => { if (esAdmin) abrirEdicionCliente(c); }} className={`grid grid-cols-[44px_minmax(0,1fr)_auto] gap-3 items-center w-full text-left px-3 py-3 rounded-[14px] mb-0.5 border transition ${elegido ? 'md:bg-white md:border-[#d2d9f5] md:shadow-[0_10px_24px_-14px_rgba(91,75,214,0.45),0_0_0_3px_rgba(91,75,214,0.06)] border-transparent' : 'border-transparent hover:bg-[#f7f8fc]'} ${esAdmin ? '' : 'cursor-default'}`}>
                                    {avatar(c, 'w-11 h-11 text-sm')}
                                    <span className="min-w-0">
                                      <span className="block text-sm font-semibold text-stone-900 tracking-tight leading-tight truncate">{c.nombre_completo}</span>
                                      <span className="block text-xs mt-0.5 truncate text-stone-500">DNI {c.dni}{c.telefono ? ` · ${c.telefono}` : ''}</span>
                                    </span>
                                    <span className="text-right shrink-0">
                                      {saldo > 0 ? (
                                        <>
                                          <strong className="block text-[15px] font-bold tracking-tight tabular-nums text-[#c0262d]">{dinero(saldo)}</strong>
                                          {(Number(c.limite_credito) || 0) > 0 && <span className="block w-[60px] h-1 rounded-sm bg-[#e8ecf7] mt-[7px] ml-auto overflow-hidden"><i className={`block h-full rounded-sm ${colorBarra(uso)}`} style={{ width: `${Math.min(100, uso * 100)}%` }}></i></span>}
                                        </>
                                      ) : (
                                        <span className="block text-xs font-semibold text-[#0f7b4a]">Al día</span>
                                      )}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className={`${sel ? 'flex' : 'hidden md:flex'} flex-col min-h-0 relative`}>{detalle}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
    </>
  );
}
