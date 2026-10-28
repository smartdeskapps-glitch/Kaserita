import React from 'react';
import { coberturaPago, estadoDeudor, restoPrimeraBoleta } from './lib/deudas.js';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function FiadosModal({
  IconoTrazo,
  boletasDeudores,
  busquedaDeudores,
  cargandoDetalleDeudor,
  cargandoDeudores,
  clientesDeudores,
  confirmandoPagoDeudor,
  descargarEstadoCuenta,
  deudorSeleccionado,
  enviarEstadoCuentaWhatsApp,
  estadoDeudorSel,
  etiquetaCuandoTurno,
  filtroDeudores,
  formatoSoles,
  hojaPagoDeudor,
  listaCajeros,
  modalCobrarDeudas,
  montoAbonoDeuda,
  mostrarHistorialCompletoDeuda,
  ordenDeudores,
  pagoRegistrado,
  pagosRecientes,
  procesarPagoDeudaCliente,
  seleccionarDeudor,
  setBoletasDeudor,
  setBusquedaDeudores,
  setConfirmandoPagoDeudor,
  setDeudorSeleccionado,
  setFiltroDeudores,
  setHojaPagoDeudor,
  setModalCobrarDeudas,
  setMontoAbonoDeuda,
  setMostrarHistorialCompletoDeuda,
  setOrdenDeudores,
  setPagoRegistrado,
}) {
  return (
    <>
              {/* Modal: Fiados (cobrar deudas / créditos) */}
              {modalCobrarDeudas && (() => {
                const dinero = (v) => `S/ ${formatoSoles(Number(v) || 0)}`;
                const iniciales = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                const GRADIENTES = ['from-[#9687f5] to-[#5b4bd6]', 'from-[#f09a7a] to-[#d9594f]', 'from-[#6fc3a3] to-[#2e8b72]', 'from-[#e6b85a] to-[#c9892a]', 'from-[#7ab4ee] to-[#3d7fd0]'];
                const gradienteDe = (cl) => GRADIENTES[String(cl.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTES.length];
                const avatar = (cl, tam) => <span className={`${tam} rounded-full bg-gradient-to-br ${gradienteDe(cl)} text-white grid place-items-center font-bold shrink-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25),0_4px_10px_-4px_rgba(20,10,50,0.35)]`}>{iniciales(cl.nombre_completo)}</span>;
                const conEstado = boletasDeudores !== null;
                const estadoDe = (cl) => (conEstado ? estadoDeudor({ saldo: cl.saldo_actual, diasCredito: cl.dias_credito }, boletasDeudores[cl.id] || []) : null);
                const usoLimite = (cl) => ((Number(cl.limite_credito) || 0) > 0 ? (Number(cl.saldo_actual) || 0) / Number(cl.limite_credito) : 0);
                const filas = clientesDeudores.map((cl) => ({ cl, e: estadoDe(cl), uso: usoLimite(cl) }));
                const totalPorCobrar = filas.reduce((a, x) => a + (Number(x.cl.saldo_actual) || 0), 0);
                const totalVencido = filas.reduce((a, x) => a + (x.e ? x.e.vencidoMonto : 0), 0);
                const pctVencido = totalPorCobrar > 0 ? Math.min(100, (totalVencido / totalPorCobrar) * 100) : 0;
                const nVencidos = filas.filter((x) => x.e && x.e.vencidas.length > 0).length;
                const nCercaLimite = filas.filter((x) => x.uso >= 0.8).length;
                const qd = busquedaDeudores.trim().toLowerCase();
                const visibles = filas
                  .filter((x) => (filtroDeudores === 'todos' || (filtroDeudores === 'venc' && x.e && x.e.vencidas.length > 0) || (filtroDeudores === 'lim' && x.uso >= 0.8))
                    && (!qd || String(x.cl.nombre_completo || '').toLowerCase().includes(qd) || String(x.cl.dni || '').includes(qd)))
                  .sort(ordenDeudores === 'antigua' && conEstado
                    ? (a, b) => (b.e.masVieja ? b.e.masVieja.diasTranscurridos : 0) - (a.e.masVieja ? a.e.masVieja.diasTranscurridos : 0)
                    : (a, b) => (Number(b.cl.saldo_actual) || 0) - (Number(a.cl.saldo_actual) || 0));
                const borde = 'border-[#e6e9f5]';
                const botonSeg = (activo) => `h-[30px] px-3.5 rounded-full text-[12.5px] whitespace-nowrap flex items-center gap-1.5 transition ${activo ? 'bg-white text-stone-900 font-semibold shadow-[0_1px_3px_rgba(20,10,50,0.14)]' : 'text-stone-500 font-medium hover:text-stone-900'}`;
                const colorBarra = (uso) => (uso >= 1 ? 'bg-gradient-to-r from-[#e0565c] to-[#c0262d]' : uso >= 0.8 ? 'bg-gradient-to-r from-[#f0b24a] to-[#d98a14]' : 'bg-gradient-to-r from-[#aeb4cf] to-[#9a9dbd]');
                const botonFantasma = `h-[38px] px-4 rounded-full border ${borde} bg-white hover:bg-[#f7f8fc] text-[13px] font-medium text-stone-700 inline-flex items-center justify-center gap-2 transition whitespace-nowrap`;
                const botonCirculo = `w-9 h-9 rounded-full border ${borde} bg-white hover:bg-[#f7f8fc] text-stone-700 grid place-items-center`;
                const chispa = (<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" /><path d="M19 15c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8Z" /></svg>);
                const cerrar = () => { setModalCobrarDeudas(false); setDeudorSeleccionado(null); setBoletasDeudor([]); setPagoRegistrado(null); setHojaPagoDeudor(false); };
                const volverALista = () => { setDeudorSeleccionado(null); setBoletasDeudor([]); setPagoRegistrado(null); setHojaPagoDeudor(false); };

                // ----- Columna de la derecha: el cliente elegido -----
                const detalle = (() => {
                  if (!deudorSeleccionado) {
                    return (
                      <div className="m-auto text-center text-[13.5px] text-stone-500 leading-snug max-w-[260px] p-5">
                        <b className="block text-[15px] text-stone-900 mb-0.5">Elige un cliente</b>
                        Verás sus boletas pendientes y podrás registrar un pago.
                      </div>
                    );
                  }
                  if (pagoRegistrado) {
                    const siguiente = [...clientesDeudores].filter((c) => c.id !== pagoRegistrado.id).sort((a, b) => (Number(b.saldo_actual) || 0) - (Number(a.saldo_actual) || 0))[0];
                    return (
                      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-5 flex">
                        <div className="text-center max-w-sm w-full mx-auto my-auto py-8">
                          <div className="relative w-[78px] h-[78px] rounded-full bg-gradient-to-br from-[#2fa972] to-[#0f7b4a] text-white grid place-items-center text-[32px] mx-auto mb-[18px] shadow-[0_14px_28px_-10px_rgba(15,123,74,0.6)]"><i className="fa-solid fa-check"></i><span className="absolute -inset-2.5 rounded-full border-2 border-[#0f7b4a]/25 animate-ping"></span></div>
                          <h4 className="text-2xl font-bold text-stone-900 tracking-tight">Pago registrado</h4>
                          <p className="text-sm text-stone-500 mt-2 mb-5 leading-snug">{pagoRegistrado.nombre} {pagoRegistrado.despues <= 0.004 ? 'quedó sin deuda.' : `sigue debiendo ${dinero(pagoRegistrado.despues)}.`}</p>
                          <div className={`bg-white border ${borde} rounded-2xl px-[18px] py-1 text-left mb-[18px]`}>
                            <div className="flex justify-between gap-3 py-3 text-[13.5px] border-b border-dashed border-[#e6e9f5]"><span className="text-stone-500">Deuda anterior</span><b>{dinero(pagoRegistrado.antes)}</b></div>
                            <div className="flex justify-between gap-3 py-3 text-[13.5px] border-b border-dashed border-[#e6e9f5]"><span className="text-stone-500">Pago recibido</span><b className="text-[#0f7b4a]">+ {dinero(pagoRegistrado.abono)}</b></div>
                            <div className="flex justify-between gap-3 py-3 text-[13.5px] items-baseline"><span className="text-stone-500">Deuda actual</span><b className="text-base">{dinero(pagoRegistrado.despues)}</b></div>
                          </div>
                          <div className="grid gap-2.5">
                            {siguiente && <button type="button" onClick={() => { setHojaPagoDeudor(false); seleccionarDeudor(siguiente); }} className="kz-pri h-12 text-sm font-semibold inline-flex items-center justify-center gap-2"><span>Siguiente cliente</span>{chispa}</button>}
                            <button type="button" onClick={volverALista} className={`${botonFantasma} h-12`}>Volver a la lista</button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const cl = deudorSeleccionado;
                  const e = estadoDeudorSel;
                  const saldo = Number(cl.saldo_actual) || 0;
                  const abono = parseFloat(montoAbonoDeuda) || 0;
                  const excede = abono > saldo + 0.004;
                  const restante = Math.max(0, +(saldo - abono).toFixed(2));
                  const cob = coberturaPago(e, Math.min(abono, saldo));
                  const limite = Number(cl.limite_credito) || 0;
                  const uso = limite > 0 ? saldo / limite : 0;
                  const lista = mostrarHistorialCompletoDeuda ? e.boletas : e.pendientesAsc;
                  const v0 = e.vencidas[0];
                  const atajo = (activo) => `h-[34px] px-4 rounded-full border text-[13px] whitespace-nowrap shrink-0 transition ${activo ? 'border-[#5b4bd6] bg-[#eff2fd] text-[#2d284b] font-semibold' : `${borde} bg-white text-stone-700 font-medium hover:bg-[#f7f8fc]`}`;
                  const restoAntigua = restoPrimeraBoleta(e);
                  const etiquetaBoton = abono > 0 && !excede ? `Registrar pago de ${dinero(abono)}` : 'Registrar pago';

                  // Formulario del pago: en el celular va dentro de una hoja que sube desde abajo.
                  const formularioPago = (
                    <>
                      <label className={`flex items-center gap-2.5 h-[62px] border rounded-[14px] px-[18px] transition cursor-text ${excede ? 'border-[#c0262d] bg-[#fdf6f6]' : `${borde} focus-within:border-[#5b4bd6] focus-within:ring-4 focus-within:ring-[#5b4bd6]/10`}`}>
                        <span className="text-[22px] font-medium text-stone-400">S/</span>
                        <input type="number" min="0" step="0.10" inputMode="decimal" placeholder="0.00" aria-label="Monto a abonar" value={montoAbonoDeuda} onChange={(ev) => setMontoAbonoDeuda(ev.target.value)} className="w-full min-w-0 bg-transparent outline-none border-0 text-[32px] font-bold tracking-tight text-stone-900 placeholder:text-stone-300 tabular-nums" />
                      </label>
                      <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar -mr-4 pr-4 md:mr-0 md:pr-0 md:flex-wrap">
                        <button type="button" onClick={() => setMontoAbonoDeuda(saldo.toFixed(2))} className={atajo(abono > 0 && Math.abs(abono - saldo) < 0.005)}>Pagar todo</button>
                        <button type="button" onClick={() => setMontoAbonoDeuda((saldo / 2).toFixed(2))} className={atajo(abono > 0 && Math.abs(abono - saldo / 2) < 0.005)}>Mitad</button>
                        {e.pendientesAsc.length > 1 && restoAntigua > 0 && <button type="button" onClick={() => setMontoAbonoDeuda(restoAntigua.toFixed(2))} className={atajo(abono > 0 && Math.abs(abono - restoAntigua) < 0.005)}>Boleta más antigua {dinero(restoAntigua)}</button>}
                      </div>
                      <div className={`mt-4 flex justify-between items-baseline gap-2.5 rounded-xl px-4 py-3 text-[13.5px] transition ${excede ? 'bg-[#fdf1f1] text-[#c0262d]' : abono > 0 && restante === 0 ? 'bg-[#eef8f2] text-stone-500' : 'bg-[#f7f8fc] text-stone-500'}`}>
                        <span>{excede ? 'El monto excede la deuda' : 'Saldo después del pago'}</span>
                        <b className={`text-xl tracking-tight tabular-nums ${excede ? 'text-[#c0262d]' : abono > 0 && restante === 0 ? 'text-[#0f7b4a]' : 'text-stone-900'}`}>{dinero(excede ? saldo : restante)}</b>
                      </div>
                      <p className="mt-2.5 text-[12.5px] text-stone-500 min-h-[16px]">
                        {abono > 0 && !excede && e.pendientesAsc.length > 0 ? (cob.cubiertas === 0 ? 'No alcanza para cubrir una boleta completa; queda como pago a cuenta.' : `Cubre ${cob.cubiertas} de ${e.pendientesAsc.length} boleta${e.pendientesAsc.length > 1 ? 's' : ''} pendiente${e.pendientesAsc.length > 1 ? 's' : ''} (las más antiguas primero).`) : ''}
                      </p>
                      <button type="button" onClick={() => setConfirmandoPagoDeudor(true)} disabled={!(abono > 0) || excede} className="kz-pri mt-1.5 w-full h-[52px] text-[14.5px] font-semibold inline-flex items-center justify-center gap-2">
                        <span>{etiquetaBoton}</span>{chispa}
                      </button>
                    </>
                  );

                  return (
                    <>
                      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 md:px-[30px] pt-4 md:pt-[26px] pb-4 md:pb-8 flex flex-col gap-5">
                        <div className="flex flex-wrap items-center gap-3.5">
                          {avatar(cl, 'w-[52px] h-[52px] md:w-14 md:h-14 text-[17px] md:text-lg')}
                          <div className="min-w-0 flex-1 basis-[180px]">
                            <h4 className="text-xl md:text-[22px] font-bold text-stone-900 tracking-tight leading-tight truncate">{cl.nombre_completo}</h4>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {[`DNI ${cl.dni}`, cl.telefono || 'Sin teléfono', `Plazo ${Number(cl.dias_credito) || 30} días`].map((t) => <span key={t} className={`text-xs text-stone-700 bg-white border ${borde} rounded-full px-2.5 py-[3px]`}>{t}</span>)}
                            </div>
                          </div>
                          <div className="hidden md:flex gap-2">
                            <button type="button" onClick={descargarEstadoCuenta} className={botonFantasma}><IconoTrazo nombre="pdf" className="w-[15px] h-[15px]" /> PDF</button>
                            <button type="button" onClick={() => enviarEstadoCuentaWhatsApp(cl)} className={botonFantasma}><IconoTrazo nombre="chat" className="w-[15px] h-[15px]" /> WhatsApp</button>
                          </div>
                        </div>

                        <div className={`relative overflow-hidden bg-white border ${borde} rounded-[18px] px-[18px] md:px-6 py-[18px] md:py-[22px] shadow-[0_1px_2px_rgba(20,10,50,0.04),0_18px_40px_-26px_rgba(20,10,50,0.3)] shrink-0`}>
                          <span className="absolute -right-14 -top-[70px] w-[220px] h-[220px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(192,38,45,0.10), rgba(192,38,45,0))' }}></span>
                          <div className="relative flex justify-between items-end gap-3">
                            <div>
                              <span className="text-[13px] text-stone-500">Deuda actual</span>
                              <strong className="block text-[36px] md:text-[42px] font-bold tracking-[-0.04em] text-[#c0262d] leading-none mt-1.5 tabular-nums">{dinero(saldo)}</strong>
                            </div>
                            {limite > 0 && (
                              <div className="text-right">
                                <span className="text-[13px] text-stone-500">Disponible</span>
                                <b className="block text-[17px] md:text-[19px] font-bold tracking-tight mt-1 tabular-nums">{dinero(Math.max(0, limite - saldo))}</b>
                              </div>
                            )}
                          </div>
                          {limite > 0 && (
                            <>
                              <div className="relative h-2 rounded bg-[#e8ecf7] mt-5"><i className={`block h-full rounded ${colorBarra(uso)}`} style={{ width: `${Math.min(100, uso * 100)}%` }}></i><u className="absolute left-[80%] -top-1 w-px h-4 bg-[#bac0d6]"></u></div>
                              <div className="relative flex justify-between gap-2 flex-wrap text-[12.5px] text-stone-500 mt-2.5"><span>Usa {Math.round(uso * 100)}% de su crédito</span><span>Límite {dinero(limite)}</span></div>
                            </>
                          )}
                          {v0 && (
                            <p className="relative flex gap-2.5 items-start text-[13px] text-[#c0262d] bg-[#fdf1f1] rounded-[10px] px-3.5 py-2.5 mt-4 leading-snug"><i className="fa-solid fa-triangle-exclamation mt-0.5"></i><span><b>{dinero(e.vencidoMonto)} vencido.</b> La boleta {v0.nro_boleta} pasó su plazo hace {v0.diasVencido} día{v0.diasVencido > 1 ? 's' : ''}.</span></p>
                          )}
                        </div>

                        <div className="hidden md:block rounded-[18px] border border-transparent px-6 py-[22px] shadow-[0_18px_40px_-24px_rgba(91,75,214,0.4)] shrink-0" style={{ background: 'linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg,#c5bcff,#e6e9f5 45%,#c5bcff) border-box' }}>
                          <h5 className="text-base font-semibold text-stone-900 tracking-tight mb-3.5">Registrar pago</h5>
                          {formularioPago}
                        </div>

                        <div className="shrink-0">
                          <div className="flex items-baseline justify-between gap-2 mb-1.5">
                            <h5 className="text-base font-semibold text-stone-900 tracking-tight">{mostrarHistorialCompletoDeuda ? 'Historial de compras a crédito' : 'Boletas pendientes'}</h5>
                            {e.boletas.some((b) => b.pagada) && (
                              <button type="button" onClick={() => setMostrarHistorialCompletoDeuda((x) => !x)} className="text-[13px] font-medium text-[#5b4bd6] hover:underline shrink-0">
                                {mostrarHistorialCompletoDeuda ? 'Ver solo pendientes' : `Ver historial completo (${e.boletas.length})`}
                              </button>
                            )}
                          </div>
                          {cargandoDetalleDeudor ? (
                            <p className="text-xs text-stone-500 text-center py-4">Cargando...</p>
                          ) : e.boletas.length === 0 ? (
                            <p className="text-xs text-stone-500 text-center py-4">Sin boletas a crédito registradas.</p>
                          ) : lista.length === 0 ? (
                            <p className="text-xs text-[#0f7b4a] text-center py-4">No hay boletas pendientes.</p>
                          ) : (
                            lista.map((b, i) => {
                              const cubre = !b.pagada && abono > 0 && !excede && cob.ids.includes(b.id);
                              return (
                                <div key={b.id} className={`relative grid grid-cols-[22px_1fr_auto] gap-3.5 py-3.5 items-start ${b.pagada ? 'opacity-50' : ''}`}>
                                  {i < lista.length - 1 && <span className="absolute left-[10px] top-[38px] -bottom-3.5 w-0.5 bg-[#eaebf0]"></span>}
                                  <span className={`relative z-[1] w-[22px] h-[22px] rounded-full border-2 grid place-items-center text-white transition ${b.pagada || cubre ? 'bg-[#0f7b4a] border-[#0f7b4a] shadow-[0_0_0_4px_rgba(15,123,74,0.12)]' : b.vencida ? 'bg-white border-[#c0262d]' : 'bg-white border-[#cccbd9]'}`}>{(b.pagada || cubre) && <i className="fa-solid fa-check text-[10px]"></i>}</span>
                                  <div className="min-w-0">
                                    <p className="text-[13.5px] flex items-center gap-2 flex-wrap">
                                      <b className="font-mono font-semibold text-stone-900">{b.nro_boleta}</b>
                                      {b.pagada && <span className="text-[11.5px] font-semibold text-[#0f7b4a]">Pagada</span>}
                                      {b.vencida && <span className="text-[11.5px] font-semibold text-[#c0262d] bg-[#fdf1f1] rounded-full px-2 py-[2px]">Vencida hace {b.diasVencido} d</span>}
                                    </p>
                                    <p className="text-[12.5px] text-stone-500 mt-1 leading-snug">
                                      {new Date(b.fecha_hora).toLocaleDateString('es-PE')} · {(b.ventas_detalle || []).map((d) => `${d.productos?.descripcion || 'Producto'} x${d.cantidad}`).join(', ') || 'Sin detalle'}
                                    </p>
                                  </div>
                                  <span className={`text-[15px] font-bold tracking-tight tabular-nums whitespace-nowrap ${b.pagada ? 'line-through' : ''}`}>{dinero(b.total_venta)}</span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {pagosRecientes.length > 0 && (
                          <div className="shrink-0">
                            <h5 className="text-base font-semibold text-stone-900 tracking-tight mb-1">Pagos recientes</h5>
                            {pagosRecientes.map((p, i) => (
                              <div key={i} className="flex justify-between gap-2.5 py-2.5 border-b border-[#eef0f9] last:border-0 text-[13px]">
                                <span className="text-stone-500">{etiquetaCuandoTurno(p.fecha)}{listaCajeros.find((c) => c.id === p.cajero_id) ? ` · ${listaCajeros.find((c) => c.id === p.cajero_id).nombre}` : ''}</span>
                                <b className="text-[#0f7b4a] font-semibold tabular-nums">+ {dinero(p.monto_pagado)}</b>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Celular: botón fijo abajo y hoja que sube para registrar el pago */}
                      <div className="md:hidden shrink-0 px-4 pt-3 pb-4 bg-[#f7f8fc] border-t border-[#e6e9f5] shadow-[0_-12px_24px_-16px_rgba(20,10,50,0.18)] relative z-[2]">
                        <p className="text-center text-xs text-stone-500 mb-2">Deuda actual {dinero(saldo)}</p>
                        <button type="button" onClick={() => setHojaPagoDeudor(true)} className="kz-pri w-full h-[54px] text-[15px] font-semibold inline-flex items-center justify-center gap-2"><span>Registrar pago</span>{chispa}</button>
                      </div>
                      {confirmandoPagoDeudor && abono > 0 && !excede && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirmar pago">
                          <div className="absolute inset-0 bg-[rgba(20,12,40,0.5)] backdrop-blur-[2px]" onClick={() => setConfirmandoPagoDeudor(false)}></div>
                          <div className="relative bg-white rounded-[20px] w-full max-w-[360px] p-6 shadow-2xl">
                            <h5 className="text-lg font-bold tracking-tight text-stone-900">¿Confirmas el pago?</h5>
                            <p className="text-[13.5px] text-stone-500 mt-1.5 leading-snug">Vas a registrar que <b className="text-stone-900">{cl.nombre_completo}</b> pagó <b className="text-stone-900">{dinero(abono)}</b>. {restante === 0 ? 'Su deuda quedará en S/ 0.00.' : `Su deuda quedará en ${dinero(restante)}.`}</p>
                            <div className="grid grid-cols-2 gap-2.5 mt-5">
                              <button type="button" onClick={() => setConfirmandoPagoDeudor(false)} className={`${botonFantasma} h-12`}>Cancelar</button>
                              <button type="button" onClick={() => { setConfirmandoPagoDeudor(false); procesarPagoDeudaCliente(); }} className="kz-pri h-12 text-sm font-semibold">Sí, registrar</button>
                            </div>
                          </div>
                        </div>
                      )}
                      {hojaPagoDeudor && (
                        <div className="md:hidden fixed inset-0 z-[70]">
                          <div className="absolute inset-0 bg-[rgba(20,12,40,0.42)] backdrop-blur-[2px]" onClick={() => setHojaPagoDeudor(false)}></div>
                          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl px-[18px] pt-2.5 pb-6 shadow-[0_-20px_50px_-20px_rgba(20,10,50,0.5)] max-h-[92vh] overflow-y-auto">
                            <div className="w-10 h-1 rounded-sm bg-[#d6d4e0] mx-auto mb-3.5"></div>
                            <h5 className="text-lg font-bold tracking-tight text-stone-900">Registrar pago</h5>
                            <p className="text-[13px] text-stone-500 mt-0.5 mb-3.5">{cl.nombre_completo} · Deuda {dinero(saldo)}</p>
                            {formularioPago}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })();

                return (
                  <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-[#f7f8fc] border border-black/5 rounded-[18px] max-w-5xl w-full shadow-2xl h-[95vh] max-h-[780px] flex flex-col overflow-hidden">
                      <div className={`bg-white px-4 sm:px-7 py-3.5 sm:py-[18px] shrink-0 flex items-center gap-3 border-b ${borde}`}>
                        {deudorSeleccionado && !pagoRegistrado && <button type="button" onClick={volverALista} className="md:hidden h-9 pl-2.5 pr-3.5 rounded-full border border-[#e6e9f5] bg-white text-[13px] font-medium text-stone-700 inline-flex items-center gap-1 shrink-0"><i className="fa-solid fa-chevron-left text-[10px]"></i> Clientes</button>}
                        <h3 className={`text-xl sm:text-[21px] font-bold tracking-tight text-stone-900 ${deudorSeleccionado ? 'hidden md:block' : ''}`}>Fiados</h3>
                        <p className="hidden md:block text-[13px] text-stone-500 truncate">Lo que tus clientes te deben a crédito</p>
                        <span className="flex-1"></span>
                        {deudorSeleccionado && !pagoRegistrado && (
                          <div className="md:hidden flex gap-2">
                            <button type="button" onClick={descargarEstadoCuenta} aria-label="Estado de cuenta en PDF" className={botonCirculo}><IconoTrazo nombre="pdf" className="w-4 h-4" /></button>
                            <button type="button" onClick={() => enviarEstadoCuentaWhatsApp(deudorSeleccionado)} aria-label="Enviar por WhatsApp" className={botonCirculo}><IconoTrazo nombre="chat" className="w-4 h-4" /></button>
                          </div>
                        )}
                        <button aria-label="Cerrar" onClick={cerrar} className="w-9 h-9 rounded-full text-stone-400 hover:text-stone-700 hover:bg-[#eef1fb] shrink-0"><i className="fa-solid fa-xmark"></i></button>
                      </div>

                      {clientesDeudores.length === 0 && !deudorSeleccionado ? (
                        <div className="flex-1 grid place-items-center p-6">
                          {cargandoDeudores ? (
                            <p className="text-[13px] text-stone-500">Cargando clientes con deuda...</p>
                          ) : (
                            <div className="text-center max-w-xs text-[13.5px] text-stone-500 leading-snug">
                              <div className="w-14 h-14 rounded-full bg-[#e7f7ee] text-[#0f7b4a] grid place-items-center text-[24px] mx-auto mb-3"><i className="fa-solid fa-check"></i></div>
                              <b className="block text-base text-stone-900 mb-0.5">No hay clientes con deuda</b>
                              Todo está cobrado. Cuando vendas a crédito, el cliente aparecerá aquí.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0 grid md:grid-cols-[380px_minmax(0,1fr)]">
                          <div className={`${deudorSeleccionado ? 'hidden md:flex' : 'flex'} flex-col min-h-0 bg-white md:border-r ${borde}`}>
                            <div className="px-5 md:px-6 pt-5 pb-4">
                              <span className="text-[13px] text-stone-500">Total por cobrar</span>
                              <strong className="block text-[32px] md:text-4xl font-bold tracking-[-0.04em] text-stone-900 leading-[1.05] mt-0.5 mb-3.5 tabular-nums">{dinero(totalPorCobrar)}</strong>
                              {conEstado && totalPorCobrar > 0 && (
                                <>
                                  <div className="flex h-2 rounded overflow-hidden bg-[#e8ecf7] gap-0.5">
                                    {pctVencido > 0 && <i className="block h-full bg-gradient-to-r from-[#d94b52] to-[#c0262d]" style={{ width: `${pctVencido}%` }}></i>}
                                    <i className="block h-full bg-gradient-to-r from-[#9687f5] to-[#5b4bd6]" style={{ width: `${100 - pctVencido}%` }}></i>
                                  </div>
                                  <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 mt-2.5 text-[12.5px] text-stone-500">
                                    <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#c0262d]"></i>Vencido <b className="text-stone-900 font-semibold">{dinero(totalVencido)}</b></span>
                                    <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#5b4bd6]"></i>Al día <b className="text-stone-900 font-semibold">{dinero(totalPorCobrar - totalVencido)}</b></span>
                                  </div>
                                </>
                              )}
                              <p className="text-xs text-stone-500 mt-2">{clientesDeudores.length} {clientesDeudores.length === 1 ? 'cliente' : 'clientes'}{conEstado && totalVencido <= 0 ? ' · Nada vencido' : ''}</p>
                            </div>
                            <div className="px-5 md:px-6 pb-3 space-y-2.5">
                              <label className={`flex items-center gap-2.5 h-10 border ${borde} rounded-full px-4 text-stone-400 bg-white focus-within:border-[#5b4bd6] focus-within:ring-[3px] focus-within:ring-[#5b4bd6]/10 transition`}>
                                <i className="fa-solid fa-magnifying-glass text-xs"></i>
                                <input type="text" autoComplete="off" placeholder="Buscar por nombre o DNI" value={busquedaDeudores} onChange={(ev) => setBusquedaDeudores(ev.target.value)} className="flex-1 min-w-0 bg-transparent text-[13.5px] text-stone-900 outline-none placeholder:text-stone-400" />
                              </label>
                              <div className="flex bg-[#e8ecf7] rounded-full p-[3px] w-fit max-w-full overflow-x-auto hide-scrollbar">
                                <button type="button" onClick={() => setFiltroDeudores('todos')} className={botonSeg(filtroDeudores === 'todos')}>Todos <span className="text-[11.5px] text-stone-500 font-medium">{filas.length}</span></button>
                                {conEstado && <button type="button" onClick={() => setFiltroDeudores('venc')} className={botonSeg(filtroDeudores === 'venc')}>Vencidos <span className="text-[11.5px] text-stone-500 font-medium">{nVencidos}</span></button>}
                                <button type="button" onClick={() => setFiltroDeudores('lim')} className={botonSeg(filtroDeudores === 'lim')}>Cerca del límite <span className="text-[11.5px] text-stone-500 font-medium">{nCercaLimite}</span></button>
                              </div>
                              {conEstado && (
                                <div className="flex justify-between items-center text-xs text-stone-500">
                                  <span>{visibles.length} resultado{visibles.length === 1 ? '' : 's'}</span>
                                  <button type="button" onClick={() => setOrdenDeudores((o) => (o === 'deuda' ? 'antigua' : 'deuda'))} className="font-semibold text-stone-700 hover:text-stone-900">Orden: {ordenDeudores === 'deuda' ? 'mayor deuda' : 'más antigua'}</button>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-3.5 pb-[18px]">
                              {visibles.length === 0 && <p className="text-center text-[13px] text-stone-500 py-8 px-4"><b className="block text-stone-900">Nadie coincide</b>Prueba con otro filtro o nombre.</p>}
                              {visibles.map(({ cl, e, uso }) => {
                                const venc = e && e.vencidas.length > 0;
                                const pend = e ? e.pendientesAsc.length : 0;
                                const elegido = deudorSeleccionado?.id === cl.id;
                                return (
                                  <button type="button" key={cl.id} onClick={() => { setHojaPagoDeudor(false); seleccionarDeudor(cl); }} className={`grid grid-cols-[44px_minmax(0,1fr)_auto] gap-3 items-center w-full text-left px-3 py-3 rounded-[14px] mb-0.5 border transition ${elegido ? 'md:bg-white md:border-[#d2d9f5] md:shadow-[0_10px_24px_-14px_rgba(91,75,214,0.45),0_0_0_3px_rgba(91,75,214,0.06)] border-transparent' : 'border-transparent hover:bg-[#f7f8fc]'}`}>
                                    {avatar(cl, 'w-11 h-11 text-sm')}
                                    <span className="min-w-0">
                                      <span className="block text-sm font-semibold text-stone-900 tracking-tight leading-tight truncate">{cl.nombre_completo}</span>
                                      <span className={`block text-xs mt-0.5 truncate ${venc ? 'text-[#c0262d] font-medium' : 'text-stone-500'}`}>
                                        {e
                                          ? (venc ? `Vencida hace ${e.vencidas[0].diasVencido} d · ${pend} boleta${pend === 1 ? '' : 's'}` : e.masVieja ? `Debe desde hace ${e.masVieja.diasTranscurridos} d · ${pend} boleta${pend === 1 ? '' : 's'}` : 'Sin boletas a crédito')
                                          : `DNI ${cl.dni}`}
                                      </span>
                                    </span>
                                    <span className="text-right shrink-0">
                                      <strong className="block text-[15px] font-bold tracking-tight tabular-nums">{dinero(cl.saldo_actual)}</strong>
                                      {(Number(cl.limite_credito) || 0) > 0 && <span className="block w-[60px] h-1 rounded-sm bg-[#e8ecf7] mt-[7px] ml-auto overflow-hidden"><i className={`block h-full rounded-sm ${colorBarra(uso)}`} style={{ width: `${Math.min(100, uso * 100)}%` }}></i></span>}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className={`${deudorSeleccionado ? 'flex' : 'hidden md:flex'} flex-col min-h-0 relative`}>{detalle}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
    </>
  );
}
