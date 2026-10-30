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
              {/* Modal: Gestión de Clientes (listar / editar). Banda oscura con lo que importa
                  (total por cobrar y deuda del cliente) y hoja blanca con la lista y los datos. */}
              {modalGestionClientes && (() => {
                const dinero = (v) => `S/ ${formatoSoles(Number(v) || 0)}`;
                const GRADIENTES = ['from-[#9687f5] to-[#5b4bd6]', 'from-[#f09a7a] to-[#d9594f]', 'from-[#6fc3a3] to-[#2e8b72]', 'from-[#e6b85a] to-[#c9892a]', 'from-[#7ab4ee] to-[#3d7fd0]'];
                const gradienteDe = (c) => GRADIENTES[String(c.id ?? c.dni ?? '').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % GRADIENTES.length];
                const avatar = (c, tam) => <span className={`${tam} rounded-full bg-gradient-to-br ${gradienteDe(c)} text-white grid place-items-center font-bold shrink-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25),0_6px_14px_-6px_rgba(20,10,50,0.4)]`}>{inicialesCliente(c.nombre_completo)}</span>;
                const linea = 'border-[#dde4fa]';
                const botonSeg = (activo) => `h-[30px] px-3.5 rounded-full text-[12.5px] whitespace-nowrap flex items-center gap-1.5 transition ${activo ? 'bg-white text-[#2d284b] font-bold' : 'text-[#6b6890] font-semibold hover:text-[#2d284b]'}`;
                const colorBarra = (uso) => (uso >= 1 ? 'bg-gradient-to-r from-[#e0565c] to-[#c0262d]' : uso >= 0.8 ? 'bg-gradient-to-r from-[#f0b24a] to-[#d98a14]' : 'bg-gradient-to-r from-[#aeb4cf] to-[#9a9dbd]');
                const circulo = 'w-10 h-10 rounded-full border-[1.5px] border-white/25 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white shrink-0 transition';
                const labP = 'flex items-center justify-between gap-2 text-[11.5px] font-bold text-[#6b6890] mb-1.5';
                const inputP = 'w-full h-11 bg-[#f3f5ff] rounded-[14px] px-3.5 text-sm font-semibold text-[#2d284b] placeholder:text-[#9a98bd] outline-none focus:bg-white focus:ring-2 focus:ring-[#5b4bd6]/40 transition';
                const chispa = (<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" /><path d="M19 15c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8Z" /></svg>);
                const saldoDe = (c) => Math.max(0, Number(c.saldo_actual) || 0);
                const usoDe = (c) => ((Number(c.limite_credito) || 0) > 0 ? saldoDe(c) / Number(c.limite_credito) : 0);
                const totalPorCobrar = clientesLista.reduce((acc, c) => acc + saldoDe(c), 0);
                const conDeuda = clientesLista.filter((c) => saldoDe(c) > 0).length;
                const filtrados = clientesFiltradosGestion();
                const sel = clienteEditando;
                const cerrar = () => { setModalGestionClientes(false); setClienteEditando(null); };
                const volverALista = () => setClienteEditando(null);
                const hayFicha = !!sel && !!formEditarCliente;
                const fondoOscuro = 'radial-gradient(70% 90% at 25% 0%, rgba(150,135,245,0.3), transparent 70%), linear-gradient(180deg, #34305a 0%, #26224a 55%, #1d1a38 100%)';

                // ----- Banda oscura, lado derecho: el cliente elegido con su deuda y su crédito -----
                const fichaOscura = (() => {
                  if (!hayFicha) {
                    return (
                      <div className="hidden md:flex flex-col justify-center text-white/60 text-[13px] leading-snug">
                        <b className="block text-[17px] font-semibold text-white/90 mb-0.5">Elige un cliente</b>
                        {esAdmin ? 'Verás sus datos y podrás cambiar su teléfono, correo y crédito.' : 'Solo el administrador puede editar los datos de un cliente.'}
                      </div>
                    );
                  }
                  const saldo = saldoDe(sel);
                  const limite = Number(formEditarCliente.limite_credito) || 0;
                  const uso = limite > 0 ? saldo / limite : 0;
                  const palabras = String(sel.nombre_completo || '').trim().split(/\s+/);
                  const ultima = palabras.length > 1 ? palabras.pop() : '';
                  return (
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3.5">
                        {avatar(sel, 'w-[56px] h-[56px] md:w-[62px] md:h-[62px] text-[17px] md:text-[19px]')}
                        <div className="min-w-0 flex-1 basis-[170px]">
                          <h4 className="text-[22px] md:text-2xl font-light tracking-tight leading-tight truncate">{palabras.join(' ')}{ultima && <> <b className="font-bold">{ultima}</b></>}</h4>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {[`DNI ${sel.dni}`, sel.telefono || 'Sin teléfono', `Plazo ${Number(sel.dias_credito) || 30} días`].map((t) => <span key={t} className="text-[11px] font-semibold text-white/85 bg-white/[0.06] border border-white/[0.18] rounded-full px-2.5 py-[3px]">{t}</span>)}
                          </div>
                        </div>
                        <div className="text-left md:text-right shrink-0 w-full md:w-auto">
                          <span className="block text-[11.5px] text-white/55">Deuda actual</span>
                          <strong className={`block text-[34px] font-light tracking-[-0.03em] leading-none tabular-nums ${saldo > 0 ? 'text-[#ffb3c0]' : 'text-[#7ee2b0]'}`}>{dinero(saldo)}</strong>
                        </div>
                      </div>
                      {limite > 0 ? (
                        <div className="mt-3.5">
                          <div className="h-1.5 rounded-full bg-white/[0.14] overflow-hidden"><i className="block h-full rounded-full bg-gradient-to-r from-[#ffb3c0] to-[#ff7f94]" style={{ width: `${Math.min(100, uso * 100)}%` }}></i></div>
                          <div className="flex justify-between gap-2 flex-wrap text-[11.5px] text-white/60 mt-1.5"><span>Usa {Math.round(uso * 100)}% de su crédito · disponible {dinero(Math.max(0, limite - saldo))}</span><span>Límite {dinero(limite)}</span></div>
                        </div>
                      ) : (
                        <p className="text-[11.5px] text-white/60 mt-3.5">Sin límite de crédito: no se le puede fiar hasta que le pongas uno.</p>
                      )}
                    </div>
                  );
                })();

                // ----- Hoja blanca, lado derecho: datos y crédito del cliente elegido -----
                const cuerpoFicha = (() => {
                  if (!hayFicha) {
                    return (
                      <div className="m-auto text-center text-[13.5px] text-[#8f8cb0] leading-snug max-w-[260px] p-5">
                        <b className="block text-[15px] text-[#2d284b] mb-0.5">Elige un cliente</b>
                        {esAdmin ? 'Verás sus datos y podrás cambiar su teléfono, correo y crédito.' : 'Solo el administrador puede editar los datos de un cliente.'}
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-5 md:px-7 pt-5 pb-3 space-y-5">
                        <div>
                          <h5 className="text-sm font-bold text-[#2d284b]">Datos del cliente</h5>
                          <p className="text-xs text-[#6b6890] mt-0.5 mb-3 leading-snug">El DNI no se cambia; el resto sí.</p>
                          <div className="space-y-3">
                            <div>
                              <label className={labP}><span>Nombre completo</span></label>
                              <input type="text" autoComplete="off" value={formEditarCliente.nombre_completo} onChange={(e) => setFormEditarCliente({ ...formEditarCliente, nombre_completo: e.target.value })} className={inputP} />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div>
                                <label className={labP}><span>Teléfono</span></label>
                                <input type="text" inputMode="tel" autoComplete="off" value={formEditarCliente.telefono} onChange={(e) => setFormEditarCliente({ ...formEditarCliente, telefono: e.target.value })} className={inputP} />
                              </div>
                              <div>
                                <label className={labP}><span>Correo</span><span className="text-[#8f8cb0] font-normal">opcional</span></label>
                                <input type="text" autoComplete="off" placeholder="correo@ejemplo.com" value={formEditarCliente.correo} onChange={(e) => setFormEditarCliente({ ...formEditarCliente, correo: e.target.value })} className={inputP} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h5 className="text-sm font-bold text-[#2d284b]">Crédito</h5>
                          <p className="text-xs text-[#6b6890] mt-0.5 mb-3 leading-snug">Cuánto se le puede fiar y en cuántos días debe pagar. La deuda cambia sola con las ventas fiadas y los pagos.</p>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <label className={labP}><span>Límite de crédito (S/)</span></label>
                              <input type="number" step="10" inputMode="decimal" value={formEditarCliente.limite_credito} onChange={(e) => setFormEditarCliente({ ...formEditarCliente, limite_credito: e.target.value })} className={`${inputP} tabular-nums`} />
                            </div>
                            <div>
                              <label className={labP}><span>Días de crédito</span></label>
                              <input type="number" step="1" inputMode="numeric" value={formEditarCliente.dias_credito} onChange={(e) => setFormEditarCliente({ ...formEditarCliente, dias_credito: e.target.value })} className={`${inputP} tabular-nums`} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={`shrink-0 px-5 md:px-7 py-3.5 bg-white border-t ${linea} flex items-center gap-2.5 justify-end`}>
                        <button type="button" onClick={volverALista} className="h-12 px-6 rounded-full border-[1.5px] border-[#dde4fa] bg-white hover:bg-[#f3f5ff] text-[13.5px] font-bold text-[#6b6890] transition">Cancelar</button>
                        <button type="button" onClick={guardarEdicionCliente} disabled={guardandoEdicionCliente} className="kz-pri h-12 px-6 text-[14px] font-semibold inline-flex items-center justify-center gap-2 flex-1 md:flex-none"><span>{guardandoEdicionCliente ? 'Guardando...' : 'Guardar cambios'}</span>{chispa}</button>
                      </div>
                    </>
                  );
                })();

                return (
                  <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="rounded-[30px] md:rounded-[34px] max-w-5xl w-full shadow-2xl h-[95vh] max-h-[780px] flex flex-col overflow-hidden">
                      {/* Banda oscura */}
                      <div
                        className="relative text-white px-4 sm:px-6 pt-3.5 pb-9 shrink-0 flex flex-col gap-4 md:grid md:grid-cols-[340px_minmax(0,1fr)] md:gap-x-7"
                        style={{ background: fondoOscuro }}
                      >
                        <div className="md:col-span-2 flex items-center gap-2.5">
                          {sel && <button type="button" onClick={volverALista} aria-label="Volver a clientes" className={`${circulo} md:hidden`}><i className="fa-solid fa-chevron-left text-xs"></i></button>}
                          <span className={`${circulo} ${sel ? 'hidden md:flex' : 'flex'} pointer-events-none`}><i className="fa-solid fa-users text-sm"></i></span>
                          <span className="flex-1 text-center text-[13px] font-semibold text-white/85">Clientes</span>
                          <button type="button" onClick={() => setModalNuevoCliente(true)} className={`h-10 px-4 rounded-full border-[1.5px] border-white/25 bg-white/[0.06] hover:bg-white/10 text-[13px] font-bold items-center gap-2 shrink-0 transition ${sel ? 'hidden md:inline-flex' : 'inline-flex'}`}><i className="fa-solid fa-plus text-[11px]"></i><span>Nuevo<span className="hidden sm:inline"> cliente</span></span></button>
                          <button aria-label="Cerrar" onClick={cerrar} className={circulo}><i className="fa-solid fa-xmark text-sm"></i></button>
                        </div>

                        <div className={sel ? 'hidden md:block' : ''}>
                          <span className="text-xs text-white/60">Por cobrar</span>
                          <strong className="block text-[38px] md:text-[40px] font-light tracking-[-0.03em] leading-[1.05] mt-0.5 tabular-nums"><small className="text-xl text-white/60 mr-1 font-normal">S/</small>{formatoSoles(totalPorCobrar)}</strong>
                          <p className="text-xs text-white/55 mt-1.5">{clientesLista.length} {clientesLista.length === 1 ? 'cliente' : 'clientes'} · {conDeuda === 0 ? 'ninguno con deuda' : `${conDeuda} con deuda`}</p>
                        </div>

                        <div className={`min-w-0 ${hayFicha ? '' : 'hidden md:block'}`}>{fichaOscura}</div>
                      </div>

                      {/* Hoja blanca */}
                      <div className="relative -mt-5 rounded-t-[30px] bg-white flex-1 min-h-0 flex flex-col">
                        {clientesLista.length === 0 ? (
                          <div className="flex-1 grid place-items-center p-6">
                            {cargandoClientes ? (
                              <p className="text-[13px] text-[#8f8cb0]">Cargando clientes...</p>
                            ) : (
                              <div className="text-center max-w-xs text-[13.5px] text-[#6b6890] leading-snug">
                                <div className="w-16 h-16 rounded-2xl bg-[#f3f5ff] text-[#5b4bd6] grid place-items-center text-[26px] mx-auto mb-3"><i className="fa-solid fa-users"></i></div>
                                <b className="block text-base text-[#2d284b] mb-0.5">Todavía no tienes clientes</b>
                                Los clientes aparecen aquí cuando les vendes o los registras. Toca «Nuevo cliente» para agregar el primero.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex-1 min-h-0 grid md:grid-cols-[340px_minmax(0,1fr)]">
                            <div className={`${sel ? 'hidden md:flex' : 'flex'} flex-col min-h-0 md:border-r ${linea} pt-5 pl-4 sm:pl-6 pr-2 sm:pr-3`}>
                              <div className="space-y-3 pr-2 sm:pr-3 md:pr-2">
                                <label className="flex items-center gap-2.5 h-[42px] bg-[#f3f5ff] rounded-full px-4 text-[#8f8cb0] focus-within:ring-2 focus-within:ring-[#5b4bd6]/40 focus-within:bg-white transition">
                                  <i className="fa-solid fa-magnifying-glass text-xs"></i>
                                  <input type="text" autoComplete="off" placeholder="Buscar por nombre o DNI" value={busquedaClientes} onChange={(e) => setBusquedaClientes(e.target.value)} className="flex-1 min-w-0 bg-transparent text-[13.5px] font-medium text-[#2d284b] outline-none placeholder:text-[#8f8cb0]" />
                                </label>
                                <div className="flex bg-[#ebf0ff] rounded-full p-[3px] w-fit max-w-full overflow-x-auto hide-scrollbar">
                                  {[['todos', 'Todos', clientesLista.length], ['deuda', 'Con deuda', conDeuda], ['aldia', 'Al día', clientesLista.length - conDeuda]].map(([k, t, n]) => (
                                    <button key={k} type="button" onClick={() => setFiltroClientes(k)} className={botonSeg(filtroClientes === k)}>{t} <span className="text-[11.5px] text-[#8f8cb0] font-medium">{n}</span></button>
                                  ))}
                                </div>
                                <div className="flex justify-between items-center text-xs text-[#8f8cb0]">
                                  <span>{filtrados.length} resultado{filtrados.length === 1 ? '' : 's'}</span>
                                  {esAdmin && (
                                    <button type="button" onClick={exportarClientesExcel} className="font-bold text-[#2d284b] hover:text-[#5b4bd6] inline-flex items-center gap-1.5 transition"><i className="fa-solid fa-file-excel"></i> Exportar</button>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar pr-2 sm:pr-3 md:pr-2 pb-4 mt-2">
                                {cargandoClientes && <p className="text-center text-[13px] text-[#8f8cb0] py-8">Cargando...</p>}
                                {!cargandoClientes && filtrados.length === 0 && <p className="text-center text-[13px] text-[#8f8cb0] py-8 px-4"><b className="block text-[#2d284b]">Nadie coincide</b>Prueba con otro filtro o nombre.</p>}
                                {filtrados.map((c) => {
                                  const saldo = saldoDe(c);
                                  const uso = usoDe(c);
                                  const elegido = sel?.id === c.id;
                                  return (
                                    <button type="button" key={c.id} onClick={() => { if (esAdmin) abrirEdicionCliente(c); }} className={`grid grid-cols-[42px_minmax(0,1fr)_auto] gap-3 items-center w-full text-left px-2.5 py-2.5 rounded-[18px] mb-0.5 border transition ${elegido ? 'md:bg-[#f3f5ff] md:border-[#dde4fa] border-transparent' : 'border-transparent hover:bg-[#f6f8ff]'} ${esAdmin ? '' : 'cursor-default'}`}>
                                      {avatar(c, 'w-[42px] h-[42px] text-[13px]')}
                                      <span className="min-w-0">
                                        <span className="block text-[13.5px] font-bold text-[#2d284b] tracking-tight leading-tight truncate">{c.nombre_completo}</span>
                                        <span className="block text-[11.5px] mt-0.5 truncate text-[#8f8cb0]">DNI {c.dni}{c.telefono ? ` · ${c.telefono}` : ''}</span>
                                      </span>
                                      <span className="text-right shrink-0">
                                        {saldo > 0 ? (
                                          <>
                                            <strong className="block text-[14px] font-extrabold tracking-tight tabular-nums text-[#c0262d]">{dinero(saldo)}</strong>
                                            {(Number(c.limite_credito) || 0) > 0 && <span className="block w-[56px] h-1 rounded-full bg-[#e8ecf7] mt-1.5 ml-auto overflow-hidden"><i className={`block h-full rounded-full ${colorBarra(uso)}`} style={{ width: `${Math.min(100, uso * 100)}%` }}></i></span>}
                                          </>
                                        ) : (
                                          <span className="block text-xs font-bold text-[#0f7b4a]">Al día</span>
                                        )}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className={`${sel ? 'flex' : 'hidden md:flex'} flex-col min-h-0 relative`}>{cuerpoFicha}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
    </>
  );
}
