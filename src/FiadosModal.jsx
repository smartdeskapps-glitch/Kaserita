import React from 'react';
import { coberturaPago, estadoDeudor, restoPrimeraBoleta } from './lib/deudas.js';
import { iniciales } from './lib/nombres.js';
import Chispa from './Chispa.jsx';

const GRADIENTES = ['from-[#9687f5] to-[#5b4bd6]', 'from-[#f09a7a] to-[#d9594f]', 'from-[#6fc3a3] to-[#2e8b72]', 'from-[#e6b85a] to-[#c9892a]', 'from-[#7ab4ee] to-[#3d7fd0]'];
const gradienteDe = (cl) => GRADIENTES[String(cl.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTES.length];
const saldoDe = (cl) => Math.max(0, Number(cl.saldo_actual) || 0);
const usoLimite = (cl) => ((Number(cl.limite_credito) || 0) > 0 ? saldoDe(cl) / Number(cl.limite_credito) : 0);
const tieneVencidas = (x) => !!x.e && x.e.vencidas.length > 0;

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function FiadosModal({
  IconoTrazo,
  abrirEdicionCliente,
  boletasDeudores,
  busquedaDeudores,
  cargandoDetalleDeudor,
  cargandoDeudores,
  clientesLista,
  confirmandoPagoDeudor,
  descargarEstadoCuenta,
  deudorSeleccionado,
  enviarEstadoCuentaWhatsApp,
  esAdmin,
  estadoDeudorSel,
  etiquetaCuandoTurno,
  exportarClientesExcel,
  filtroDeudores,
  formEditarCliente,
  formatoSoles,
  guardandoEdicionCliente,
  guardarEdicionCliente,
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
  setClienteEditando,
  setConfirmandoPagoDeudor,
  setDeudorSeleccionado,
  setFiltroDeudores,
  setFormEditarCliente,
  setHojaPagoDeudor,
  setModalCobrarDeudas,
  setModalNuevoCliente,
  setMontoAbonoDeuda,
  setMostrarHistorialCompletoDeuda,
  setOrdenDeudores,
  setPagoRegistrado,
}) {
  // Pestaña de la ficha: cobrar (pago + boletas) o datos del cliente (teléfono, crédito...).
  const [pestana, setPestana] = React.useState('cobrar');
  const conEstado = boletasDeudores !== null;

  // Cada cliente con su estado de deuda y los totales de la banda: se recalculan solo
  // cuando cambian los clientes o las boletas (no al escribir en el buscador o el monto).
  const resumen = React.useMemo(() => {
    const filas = clientesLista.map((cl) => ({
      cl,
      e: conEstado && saldoDe(cl) > 0 ? estadoDeudor({ saldo: cl.saldo_actual, diasCredito: cl.dias_credito }, boletasDeudores[cl.id] || []) : null,
      uso: usoLimite(cl),
    }));
    const r = { filas, totalPorCobrar: 0, totalVencido: 0, nConDeuda: 0, nVencidos: 0, nCercaLimite: 0 };
    filas.forEach((x) => {
      const saldo = saldoDe(x.cl);
      r.totalPorCobrar += saldo;
      if (saldo > 0) r.nConDeuda += 1;
      if (x.e) r.totalVencido += x.e.vencidoMonto;
      if (tieneVencidas(x)) r.nVencidos += 1;
      if (x.uso >= 0.8) r.nCercaLimite += 1;
    });
    return r;
  }, [clientesLista, boletasDeudores, conEstado]);
  const { filas, totalPorCobrar, totalVencido, nConDeuda, nVencidos, nCercaLimite } = resumen;

  const visibles = React.useMemo(() => {
    const qd = busquedaDeudores.trim().toLowerCase();
    return filas
      .filter((x) => (filtroDeudores === 'todos' || (filtroDeudores === 'deuda' && saldoDe(x.cl) > 0) || (filtroDeudores === 'venc' && tieneVencidas(x)) || (filtroDeudores === 'lim' && x.uso >= 0.8))
        && (!qd || String(x.cl.nombre_completo || '').toLowerCase().includes(qd) || String(x.cl.dni || '').includes(qd)))
      .sort(ordenDeudores === 'antigua' && conEstado
        ? (a, b) => (b.e && b.e.masVieja ? b.e.masVieja.diasTranscurridos : -1) - (a.e && a.e.masVieja ? a.e.masVieja.diasTranscurridos : -1)
        : (a, b) => saldoDe(b.cl) - saldoDe(a.cl) || String(a.cl.nombre_completo || '').localeCompare(String(b.cl.nombre_completo || '')));
  }, [filas, busquedaDeudores, filtroDeudores, ordenDeudores, conEstado]);

  return (
    <>
              {/* Modal: Fiados. Reúne a todos los clientes: se cobra su deuda y se editan sus datos.
                  Banda oscura con el total por cobrar y la ficha del cliente; hoja blanca con la lista
                  y las pestañas Cobrar / Datos. */}
              {modalCobrarDeudas && (() => {
                const dinero = (v) => `S/ ${formatoSoles(Number(v) || 0)}`;
                const avatar = (cl, tam) => <span className={`${tam} rounded-full bg-gradient-to-br ${gradienteDe(cl)} text-white grid place-items-center font-bold shrink-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25),0_6px_14px_-6px_rgba(20,10,50,0.4)]`}>{iniciales(cl.nombre_completo, '?')}</span>;
                const pctVencido = totalPorCobrar > 0 ? Math.min(100, (totalVencido / totalPorCobrar) * 100) : 0;
                const linea = 'border-[#dde4fa]';
                const botonSeg = (activo) => `h-[30px] px-3 rounded-full text-[12px] whitespace-nowrap flex items-center gap-1.5 transition ${activo ? 'bg-white text-[#2d284b] font-bold' : 'text-[#6b6890] font-semibold hover:text-[#2d284b]'}`;
                const colorBarra = (uso) => (uso >= 1 ? 'bg-gradient-to-r from-[#e0565c] to-[#c0262d]' : uso >= 0.8 ? 'bg-gradient-to-r from-[#f0b24a] to-[#d98a14]' : 'bg-gradient-to-r from-[#aeb4cf] to-[#9a9dbd]');
                const botonFantasma = `h-12 px-6 rounded-full border-[1.5px] ${linea} bg-white hover:bg-[#f3f5ff] text-[13.5px] font-bold text-[#6b6890] inline-flex items-center justify-center gap-2 transition whitespace-nowrap`;
                const circulo = 'w-10 h-10 rounded-full border-[1.5px] border-white/25 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white shrink-0 transition';
                const botonOscuro = 'h-[34px] px-3.5 rounded-full border-[1.5px] border-white/25 bg-white/5 hover:bg-white/10 text-[12px] font-bold inline-flex items-center gap-1.5 transition';
                const labP = 'flex items-center justify-between gap-2 text-[11.5px] font-bold text-[#6b6890] mb-1.5';
                const inputP = 'w-full h-11 bg-[#f3f5ff] rounded-[14px] px-3.5 text-sm font-semibold text-[#2d284b] placeholder:text-[#9a98bd] outline-none focus:bg-white focus:ring-2 focus:ring-[#5b4bd6]/40 transition';
                const chispa = <Chispa />;
                const volverALista = () => { setDeudorSeleccionado(null); setClienteEditando(null); setBoletasDeudor([]); setPagoRegistrado(null); setHojaPagoDeudor(false); };
                const cerrar = () => { volverALista(); setModalCobrarDeudas(false); };
                const elegirCliente = (cl) => { setHojaPagoDeudor(false); setPestana('cobrar'); abrirEdicionCliente(cl); seleccionarDeudor(cl); };
                const hayFicha = !!deudorSeleccionado;
                const verDatos = pestana === 'datos' && esAdmin && !!formEditarCliente;

                // ----- Banda oscura, lado derecho: el cliente elegido -----
                const fichaOscura = (() => {
                  if (!deudorSeleccionado) {
                    return (
                      <div className="hidden md:flex flex-col justify-center text-white/60 text-[13px] leading-snug">
                        <b className="block text-[17px] font-semibold text-white/90 mb-0.5">Elige un cliente</b>
                        Verás su deuda y sus boletas pendientes, y podrás registrar un pago o cambiar sus datos.
                      </div>
                    );
                  }
                  const cl = deudorSeleccionado;
                  const e = estadoDeudorSel;
                  const saldo = saldoDe(cl);
                  const limite = Number(cl.limite_credito) || 0;
                  const uso = limite > 0 ? saldo / limite : 0;
                  const v0 = e && e.vencidas[0];
                  const palabras = String(cl.nombre_completo || '').trim().split(/\s+/);
                  const ultima = palabras.length > 1 ? palabras.pop() : '';
                  return (
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3.5">
                        {avatar(cl, 'w-[56px] h-[56px] md:w-[62px] md:h-[62px] text-[17px] md:text-[19px]')}
                        <div className="min-w-0 flex-1 basis-[170px]">
                          <h4 className="text-[22px] md:text-2xl font-light tracking-tight leading-tight truncate">{palabras.join(' ')}{ultima && <> <b className="font-bold">{ultima}</b></>}</h4>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {[`DNI ${cl.dni}`, cl.telefono || 'Sin teléfono', `Plazo ${Number(cl.dias_credito) || 30} días`].map((t) => <span key={t} className="text-[11px] font-semibold text-white/85 bg-white/[0.06] border border-white/[0.18] rounded-full px-2.5 py-[3px]">{t}</span>)}
                          </div>
                        </div>
                        <div className="text-left md:text-right shrink-0 w-full md:w-auto">
                          <span className="block text-[11.5px] text-white/55">Deuda actual</span>
                          <strong className={`block text-[34px] font-light tracking-[-0.03em] leading-none tabular-nums ${saldo > 0 ? 'text-[#ffb3c0]' : 'text-[#7ee2b0]'}`}>{dinero(saldo)}</strong>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button type="button" onClick={descargarEstadoCuenta} className={botonOscuro}><IconoTrazo nombre="pdf" className="w-[14px] h-[14px]" /> PDF</button>
                        <button type="button" onClick={() => enviarEstadoCuentaWhatsApp(cl)} className={botonOscuro}><IconoTrazo nombre="chat" className="w-[14px] h-[14px]" /> WhatsApp</button>
                      </div>
                      {limite > 0 ? (
                        <div className="mt-3">
                          <div className="h-1.5 rounded-full bg-white/[0.14] overflow-hidden"><i className="block h-full rounded-full bg-gradient-to-r from-[#ffb3c0] to-[#ff7f94]" style={{ width: `${Math.min(100, uso * 100)}%` }}></i></div>
                          <div className="flex justify-between gap-2 flex-wrap text-[11.5px] text-white/60 mt-1.5"><span>Usa {Math.round(uso * 100)}% de su crédito · disponible {dinero(Math.max(0, limite - saldo))}</span><span>Límite {dinero(limite)}</span></div>
                        </div>
                      ) : (
                        <p className="text-[11.5px] text-white/60 mt-3">Sin límite de crédito: no se le puede fiar hasta que le pongas uno.</p>
                      )}
                      {v0 && (
                        <p className="flex gap-2 items-start text-xs text-[#ffd0d8] bg-[#ff7896]/[0.12] border border-[#ff96aa]/25 rounded-[14px] px-3 py-2 mt-2.5 leading-snug"><i className="fa-solid fa-triangle-exclamation mt-0.5"></i><span><b>{dinero(e.vencidoMonto)} vencido.</b> La boleta {v0.nro_boleta} pasó su plazo hace {v0.diasVencido} día{v0.diasVencido > 1 ? 's' : ''}.</span></p>
                      )}
                    </div>
                  );
                })();

                // ----- Hoja blanca, lado derecho -----
                const cuerpoFicha = (() => {
                  if (!deudorSeleccionado) {
                    return (
                      <div className="m-auto text-center text-[13.5px] text-[#8f8cb0] leading-snug max-w-[260px] p-5">
                        <b className="block text-[15px] text-[#2d284b] mb-0.5">Elige un cliente</b>
                        Verás sus boletas pendientes y podrás registrar un pago.
                      </div>
                    );
                  }
                  if (pagoRegistrado) {
                    const siguiente = clientesLista.reduce((mejor, c) => (c.id !== pagoRegistrado.id && saldoDe(c) > 0 && (!mejor || saldoDe(c) > saldoDe(mejor)) ? c : mejor), null);
                    return (
                      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-5 flex">
                        <div className="text-center max-w-sm w-full mx-auto my-auto py-8">
                          <div className="relative w-[78px] h-[78px] rounded-full bg-gradient-to-br from-[#2fa972] to-[#0f7b4a] text-white grid place-items-center text-[32px] mx-auto mb-[18px] shadow-[0_14px_28px_-10px_rgba(15,123,74,0.6)]"><i className="fa-solid fa-check"></i><span className="absolute -inset-2.5 rounded-full border-2 border-[#0f7b4a]/25 animate-ping"></span></div>
                          <h4 className="text-2xl font-bold text-[#2d284b] tracking-tight">Pago registrado</h4>
                          <p className="text-sm text-[#6b6890] mt-2 mb-5 leading-snug">{pagoRegistrado.nombre} {pagoRegistrado.despues <= 0.004 ? 'quedó sin deuda.' : `sigue debiendo ${dinero(pagoRegistrado.despues)}.`}</p>
                          <div className="bg-[#f3f5ff] rounded-[20px] px-[18px] py-1 text-left mb-[18px]">
                            <div className="flex justify-between gap-3 py-3 text-[13.5px] border-b border-dashed border-[#dde4fa]"><span className="text-[#6b6890]">Deuda anterior</span><b>{dinero(pagoRegistrado.antes)}</b></div>
                            <div className="flex justify-between gap-3 py-3 text-[13.5px] border-b border-dashed border-[#dde4fa]"><span className="text-[#6b6890]">Pago recibido</span><b className="text-[#0f7b4a]">+ {dinero(pagoRegistrado.abono)}</b></div>
                            <div className="flex justify-between gap-3 py-3 text-[13.5px] items-baseline"><span className="text-[#6b6890]">Deuda actual</span><b className="text-base">{dinero(pagoRegistrado.despues)}</b></div>
                          </div>
                          <div className="grid gap-2.5">
                            {siguiente && <button type="button" onClick={() => elegirCliente(siguiente)} className="kz-pri h-12 text-sm font-semibold inline-flex items-center justify-center gap-2"><span>Siguiente cliente</span>{chispa}</button>}
                            <button type="button" onClick={volverALista} className={botonFantasma}>Volver a la lista</button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const cl = deudorSeleccionado;
                  const e = estadoDeudorSel;
                  const saldo = saldoDe(cl);
                  const abono = parseFloat(montoAbonoDeuda) || 0;
                  const excede = abono > saldo + 0.004;
                  const restante = Math.max(0, +(saldo - abono).toFixed(2));
                  const cob = coberturaPago(e, Math.min(abono, saldo));
                  const lista = mostrarHistorialCompletoDeuda ? e.boletas : e.pendientesAsc;
                  const atajo = (activo) => `h-[34px] px-4 rounded-full text-[12.5px] font-bold whitespace-nowrap shrink-0 transition ${activo ? 'bg-[#2d284b] text-white' : 'bg-white text-[#6b6890] ring-1 ring-[#dde4fa] hover:bg-[#f3f5ff]'}`;
                  const restoAntigua = restoPrimeraBoleta(e);
                  const etiquetaBoton = abono > 0 && !excede ? `Registrar pago de ${dinero(abono)}` : 'Registrar pago';

                  // Formulario del pago: en el celular va dentro de una hoja que sube desde abajo.
                  const formularioPago = (
                    <>
                      <label className={`flex items-center gap-2.5 h-[64px] rounded-[18px] px-[18px] transition cursor-text bg-white ${excede ? 'ring-2 ring-[#c0262d] bg-[#fdf6f6]' : `ring-[1.5px] ring-[#dde4fa] focus-within:ring-2 focus-within:ring-[#5b4bd6]`}`}>
                        <span className="text-[22px] font-medium text-[#8f8cb0]">S/</span>
                        <input type="number" min="0" step="0.10" inputMode="decimal" placeholder="0.00" aria-label="Monto a abonar" value={montoAbonoDeuda} onChange={(ev) => setMontoAbonoDeuda(ev.target.value)} className="w-full min-w-0 bg-transparent outline-none border-0 text-[32px] font-bold tracking-tight text-[#2d284b] placeholder:text-[#c5c3d6] tabular-nums" />
                      </label>
                      <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar -mr-4 pr-4 md:mr-0 md:pr-0 md:flex-wrap">
                        <button type="button" onClick={() => setMontoAbonoDeuda(saldo.toFixed(2))} className={atajo(abono > 0 && Math.abs(abono - saldo) < 0.005)}>Pagar todo</button>
                        <button type="button" onClick={() => setMontoAbonoDeuda((saldo / 2).toFixed(2))} className={atajo(abono > 0 && Math.abs(abono - saldo / 2) < 0.005)}>Mitad</button>
                        {e.pendientesAsc.length > 1 && restoAntigua > 0 && <button type="button" onClick={() => setMontoAbonoDeuda(restoAntigua.toFixed(2))} className={atajo(abono > 0 && Math.abs(abono - restoAntigua) < 0.005)}>Boleta más antigua {dinero(restoAntigua)}</button>}
                      </div>
                      <div className={`mt-3.5 flex justify-between items-baseline gap-2.5 rounded-2xl px-4 py-3 text-[13px] font-semibold transition ${excede ? 'bg-[#fdf1f1] text-[#c0262d]' : 'bg-white text-[#6b6890]'}`}>
                        <span>{excede ? 'El monto excede la deuda' : 'Saldo después del pago'}</span>
                        <b className={`text-xl tracking-tight tabular-nums ${excede ? 'text-[#c0262d]' : abono > 0 && restante === 0 ? 'text-[#0f7b4a]' : 'text-[#2d284b]'}`}>{dinero(excede ? saldo : restante)}</b>
                      </div>
                      <p className="mt-2 text-xs text-[#8f8cb0] min-h-[16px]">
                        {abono > 0 && !excede && e.pendientesAsc.length > 0 ? (cob.cubiertas === 0 ? 'No alcanza para cubrir una boleta completa; queda como pago a cuenta.' : `Cubre ${cob.cubiertas} de ${e.pendientesAsc.length} boleta${e.pendientesAsc.length > 1 ? 's' : ''} pendiente${e.pendientesAsc.length > 1 ? 's' : ''} (las más antiguas primero).`) : ''}
                      </p>
                      <button type="button" onClick={() => setConfirmandoPagoDeudor(true)} disabled={!(abono > 0) || excede} className="kz-pri mt-1.5 w-full h-[52px] text-[14.5px] font-semibold inline-flex items-center justify-center gap-2">
                        <span>{etiquetaBoton}</span>{chispa}
                      </button>
                    </>
                  );

                  return (
                    <>
                      {esAdmin && (
                        <div className="shrink-0 flex gap-1.5 px-5 md:px-7 pt-4">
                          {[['cobrar', 'Cobrar'], ['datos', 'Datos']].map(([k, t]) => (
                            <button key={k} type="button" onClick={() => setPestana(k)} className={`h-9 px-[18px] rounded-full text-[13px] font-bold transition ${pestana === k ? 'bg-[#2d284b] text-white' : 'bg-[#f3f5ff] text-[#6b6890] hover:bg-[#e6ebff]'}`}>{t}</button>
                          ))}
                        </div>
                      )}

                      {verDatos ? (
                        <>
                          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-5 md:px-7 pt-5 pb-3 space-y-5">
                            <div>
                              <h5 className="text-sm font-bold text-[#2d284b]">Datos del cliente</h5>
                              <p className="text-xs text-[#6b6890] mt-0.5 mb-3 leading-snug">El DNI no se cambia; el resto sí.</p>
                              <div className="space-y-3">
                                <div>
                                  <label className={labP}><span>Nombre completo</span></label>
                                  <input type="text" autoComplete="off" value={formEditarCliente.nombre_completo} onChange={(ev) => setFormEditarCliente({ ...formEditarCliente, nombre_completo: ev.target.value })} className={inputP} />
                                </div>
                                <div className="grid sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className={labP}><span>Teléfono</span></label>
                                    <input type="text" inputMode="tel" autoComplete="off" value={formEditarCliente.telefono} onChange={(ev) => setFormEditarCliente({ ...formEditarCliente, telefono: ev.target.value })} className={inputP} />
                                  </div>
                                  <div>
                                    <label className={labP}><span>Correo</span><span className="text-[#8f8cb0] font-normal">opcional</span></label>
                                    <input type="text" autoComplete="off" placeholder="correo@ejemplo.com" value={formEditarCliente.correo} onChange={(ev) => setFormEditarCliente({ ...formEditarCliente, correo: ev.target.value })} className={inputP} />
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
                                  <input type="number" step="10" inputMode="decimal" value={formEditarCliente.limite_credito} onChange={(ev) => setFormEditarCliente({ ...formEditarCliente, limite_credito: ev.target.value })} className={`${inputP} tabular-nums`} />
                                </div>
                                <div>
                                  <label className={labP}><span>Días de crédito</span></label>
                                  <input type="number" step="1" inputMode="numeric" value={formEditarCliente.dias_credito} onChange={(ev) => setFormEditarCliente({ ...formEditarCliente, dias_credito: ev.target.value })} className={`${inputP} tabular-nums`} />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className={`shrink-0 px-5 md:px-7 py-3.5 bg-white border-t ${linea} flex items-center gap-2.5 justify-end`}>
                            <button type="button" onClick={() => { abrirEdicionCliente(deudorSeleccionado); setPestana('cobrar'); }} className={botonFantasma}>Cancelar</button>
                            <button type="button" onClick={guardarEdicionCliente} disabled={guardandoEdicionCliente} className="kz-pri h-12 px-6 text-[14px] font-semibold inline-flex items-center justify-center gap-2 flex-1 md:flex-none"><span>{guardandoEdicionCliente ? 'Guardando...' : 'Guardar cambios'}</span>{chispa}</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-5 md:px-7 pt-4 md:pt-5 pb-4 md:pb-6 flex flex-col gap-5">
                            {saldo > 0 ? (
                              <div className="hidden md:block rounded-[22px] bg-[#f6f8ff] p-4 shrink-0">
                                <h5 className="text-sm font-bold text-[#2d284b] mb-2.5">Registrar pago</h5>
                                {formularioPago}
                              </div>
                            ) : (
                              <div className="shrink-0 text-center text-[13.5px] text-[#8f8cb0] leading-snug py-6">
                                <b className="block text-[15px] text-[#2d284b] mb-0.5">Sin deuda</b>
                                {String(cl.nombre_completo || '').split(' ')[0]} está al día. Cuando le fíes algo, podrás cobrarle aquí.
                              </div>
                            )}

                            <div className="shrink-0">
                              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                                <h5 className="text-sm font-bold text-[#2d284b]">{mostrarHistorialCompletoDeuda ? 'Historial de compras a crédito' : 'Boletas pendientes'}</h5>
                                {e.boletas.some((b) => b.pagada) && (
                                  <button type="button" onClick={() => setMostrarHistorialCompletoDeuda((x) => !x)} className="text-[12.5px] font-bold text-[#5b4bd6] hover:underline shrink-0">
                                    {mostrarHistorialCompletoDeuda ? 'Ver solo pendientes' : `Ver historial completo (${e.boletas.length})`}
                                  </button>
                                )}
                              </div>
                              {cargandoDetalleDeudor ? (
                                <p className="text-xs text-[#8f8cb0] text-center py-4">Cargando...</p>
                              ) : e.boletas.length === 0 ? (
                                <p className="text-xs text-[#8f8cb0] text-center py-4">Sin boletas a crédito registradas.</p>
                              ) : lista.length === 0 ? (
                                <p className="text-xs text-[#0f7b4a] text-center py-4">No hay boletas pendientes.</p>
                              ) : (
                                lista.map((b, i) => {
                                  const cubre = !b.pagada && abono > 0 && !excede && cob.ids.includes(b.id);
                                  return (
                                    <div key={b.id} className={`relative grid grid-cols-[22px_1fr_auto] gap-3.5 py-3.5 items-start ${b.pagada ? 'opacity-50' : ''}`}>
                                      {i < lista.length - 1 && <span className="absolute left-[10px] top-[38px] -bottom-3.5 w-0.5 bg-[#eaebf5]"></span>}
                                      <span className={`relative z-[1] w-[22px] h-[22px] rounded-full border-2 grid place-items-center text-white transition ${b.pagada || cubre ? 'bg-[#0f7b4a] border-[#0f7b4a] shadow-[0_0_0_4px_rgba(15,123,74,0.12)]' : b.vencida ? 'bg-white border-[#c0262d]' : 'bg-white border-[#cfd0e0]'}`}>{(b.pagada || cubre) && <i className="fa-solid fa-check text-[10px]"></i>}</span>
                                      <div className="min-w-0">
                                        <p className="text-[13.5px] flex items-center gap-2 flex-wrap">
                                          <b className="font-mono font-semibold text-[#2d284b]">{b.nro_boleta}</b>
                                          {b.pagada && <span className="text-[11.5px] font-semibold text-[#0f7b4a]">Pagada</span>}
                                          {b.vencida && <span className="text-[11.5px] font-bold text-[#c0262d] bg-[#fdf1f1] rounded-full px-2 py-[2px]">Vencida hace {b.diasVencido} d</span>}
                                        </p>
                                        <p className="text-xs text-[#8f8cb0] mt-1 leading-snug">
                                          {new Date(b.fecha_hora).toLocaleDateString('es-PE')} · {(b.ventas_detalle || []).map((d) => `${d.productos?.descripcion || 'Producto'} x${d.cantidad}`).join(', ') || 'Sin detalle'}
                                        </p>
                                      </div>
                                      <span className={`text-[14px] font-extrabold tracking-tight tabular-nums whitespace-nowrap ${b.pagada ? 'line-through' : ''}`}>{dinero(b.total_venta)}</span>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {pagosRecientes.length > 0 && (
                              <div className="shrink-0">
                                <h5 className="text-sm font-bold text-[#2d284b] mb-1">Pagos recientes</h5>
                                {pagosRecientes.map((p, i) => (
                                  <div key={i} className="flex justify-between gap-2.5 py-2.5 border-b border-[#eef0f9] last:border-0 text-[12.5px]">
                                    <span className="text-[#8f8cb0]">{etiquetaCuandoTurno(p.fecha)}{listaCajeros.find((c) => c.id === p.cajero_id) ? ` · ${listaCajeros.find((c) => c.id === p.cajero_id).nombre}` : ''}</span>
                                    <b className="text-[#0f7b4a] font-bold tabular-nums">+ {dinero(p.monto_pagado)}</b>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Celular: botón fijo abajo y hoja que sube para registrar el pago */}
                          {saldo > 0 && (
                            <div className="md:hidden shrink-0 px-4 pt-3 pb-4 bg-white border-t border-[#dde4fa] relative z-[2]">
                              <p className="text-center text-xs text-[#8f8cb0] mb-2">Deuda actual {dinero(saldo)}</p>
                              <button type="button" onClick={() => setHojaPagoDeudor(true)} className="kz-pri w-full h-[54px] text-[15px] font-semibold inline-flex items-center justify-center gap-2"><span>Registrar pago</span>{chispa}</button>
                            </div>
                          )}
                          {confirmandoPagoDeudor && abono > 0 && !excede && (
                            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirmar pago">
                              <div className="absolute inset-0 bg-[rgba(20,12,40,0.5)] backdrop-blur-[2px]" onClick={() => setConfirmandoPagoDeudor(false)}></div>
                              <div className="relative bg-white rounded-[28px] w-full max-w-[360px] p-6 shadow-2xl">
                                <h5 className="text-lg font-bold tracking-tight text-[#2d284b]">¿Confirmas el pago?</h5>
                                <p className="text-[13.5px] text-[#6b6890] mt-1.5 leading-snug">Vas a registrar que <b className="text-[#2d284b]">{cl.nombre_completo}</b> pagó <b className="text-[#2d284b]">{dinero(abono)}</b>. {restante === 0 ? 'Su deuda quedará en S/ 0.00.' : `Su deuda quedará en ${dinero(restante)}.`}</p>
                                <div className="grid grid-cols-2 gap-2.5 mt-5">
                                  <button type="button" onClick={() => setConfirmandoPagoDeudor(false)} className={botonFantasma}>Cancelar</button>
                                  <button type="button" onClick={() => { setConfirmandoPagoDeudor(false); procesarPagoDeudaCliente(); }} className="kz-pri h-12 text-sm font-semibold">Sí, registrar</button>
                                </div>
                              </div>
                            </div>
                          )}
                          {hojaPagoDeudor && (
                            <div className="md:hidden fixed inset-0 z-[70]">
                              <div className="absolute inset-0 bg-[rgba(20,12,40,0.42)] backdrop-blur-[2px]" onClick={() => setHojaPagoDeudor(false)}></div>
                              <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-[30px] px-[18px] pt-2.5 pb-6 shadow-[0_-20px_50px_-20px_rgba(20,10,50,0.5)] max-h-[92vh] overflow-y-auto">
                                <div className="w-10 h-1 rounded-sm bg-[#c5bcff] mx-auto mb-3.5"></div>
                                <h5 className="text-lg font-bold tracking-tight text-[#2d284b]">Registrar pago</h5>
                                <p className="text-[13px] text-[#6b6890] mt-0.5 mb-3.5">{cl.nombre_completo} · Deuda {dinero(saldo)}</p>
                                {formularioPago}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  );
                })();

                return (
                  <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="rounded-[30px] md:rounded-[34px] max-w-5xl w-full shadow-2xl h-[95vh] max-h-[780px] flex flex-col overflow-hidden">
                      {/* Banda oscura */}
                      <div
                        className="kz-panel-oscuro [--kz-halo:radial-gradient(70%_90%_at_25%_0%,rgba(150,135,245,0.3),transparent_70%)] relative text-white px-4 sm:px-6 pt-3.5 pb-9 shrink-0 flex flex-col gap-3.5 md:grid md:grid-cols-[340px_minmax(0,1fr)] md:gap-x-7"
                      
                      >
                        <div className="md:col-span-2 flex items-center gap-2.5">
                          {hayFicha && !pagoRegistrado && <button type="button" onClick={volverALista} aria-label="Volver a la lista" className={`${circulo} md:hidden`}><i className="fa-solid fa-chevron-left text-xs"></i></button>}
                          <span className={`${circulo} ${hayFicha && !pagoRegistrado ? 'hidden md:flex' : 'flex'} pointer-events-none`}><i className="fa-solid fa-hand-holding-dollar text-sm"></i></span>
                          <span className="flex-1 text-center text-[13px] font-semibold text-white/85">Fiados</span>
                          <button type="button" onClick={() => setModalNuevoCliente(true)} className={`h-10 px-4 rounded-full border-[1.5px] border-white/25 bg-white/[0.06] hover:bg-white/10 text-[13px] font-bold items-center gap-2 shrink-0 transition ${hayFicha ? 'hidden md:inline-flex' : 'inline-flex'}`}><i className="fa-solid fa-plus text-[11px]"></i><span>Nuevo<span className="hidden sm:inline"> cliente</span></span></button>
                          <button aria-label="Cerrar" onClick={cerrar} className={circulo}><i className="fa-solid fa-xmark text-sm"></i></button>
                        </div>

                        <div className={hayFicha ? 'hidden md:block' : ''}>
                          <span className="text-xs text-white/60">Total por cobrar</span>
                          <strong className="block text-[38px] md:text-[40px] font-light tracking-[-0.03em] leading-[1.05] mt-0.5 tabular-nums"><small className="text-xl text-white/60 mr-1 font-normal">S/</small>{formatoSoles(totalPorCobrar)}</strong>
                          {conEstado && totalPorCobrar > 0 && (
                            <>
                              <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.14] gap-0.5 mt-3">
                                {pctVencido > 0 && <i className="block h-full bg-gradient-to-r from-[#ff7f94] to-[#ffb3c0]" style={{ width: `${pctVencido}%` }}></i>}
                                <i className="block h-full bg-gradient-to-r from-[#9687f5] to-[#c5bcff]" style={{ width: `${100 - pctVencido}%` }}></i>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11.5px] text-white/60">
                                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#ff7f94]"></i>Vencido <b className="text-white font-semibold">{dinero(totalVencido)}</b></span>
                                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#9687f5]"></i>Al día <b className="text-white font-semibold">{dinero(totalPorCobrar - totalVencido)}</b></span>
                              </div>
                            </>
                          )}
                          <p className="text-xs text-white/55 mt-2">{clientesLista.length} {clientesLista.length === 1 ? 'cliente' : 'clientes'} · {nConDeuda === 0 ? 'ninguno con deuda' : `${nConDeuda} con deuda`}{conEstado && totalVencido <= 0 && nConDeuda > 0 ? ' · Nada vencido' : ''}</p>
                        </div>

                        <div className={`min-w-0 ${hayFicha ? '' : 'hidden md:block'}`}>{fichaOscura}</div>
                      </div>

                      {/* Hoja blanca */}
                      <div className="relative -mt-5 rounded-t-[30px] bg-white flex-1 min-h-0 flex flex-col">
                        {clientesLista.length === 0 ? (
                          <div className="flex-1 grid place-items-center p-6">
                            {cargandoDeudores ? (
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
                            <div className={`${hayFicha ? 'hidden md:flex' : 'flex'} flex-col min-h-0 md:border-r ${linea} pt-5 pl-4 sm:pl-6 pr-2 sm:pr-3`}>
                              <div className="space-y-3 pr-2 sm:pr-3 md:pr-2">
                                <label className="flex items-center gap-2.5 h-[42px] bg-[#f3f5ff] rounded-full px-4 text-[#8f8cb0] focus-within:ring-2 focus-within:ring-[#5b4bd6]/40 focus-within:bg-white transition">
                                  <i className="fa-solid fa-magnifying-glass text-xs"></i>
                                  <input type="text" autoComplete="off" placeholder="Buscar por nombre o DNI" value={busquedaDeudores} onChange={(ev) => setBusquedaDeudores(ev.target.value)} className="flex-1 min-w-0 bg-transparent text-[13.5px] font-medium text-[#2d284b] outline-none placeholder:text-[#8f8cb0]" />
                                </label>
                                <div className="flex bg-[#ebf0ff] rounded-full p-[3px] w-fit max-w-full overflow-x-auto hide-scrollbar">
                                  <button type="button" onClick={() => setFiltroDeudores('todos')} className={botonSeg(filtroDeudores === 'todos')}>Todos <span className="text-[11px] text-[#8f8cb0] font-medium">{filas.length}</span></button>
                                  <button type="button" onClick={() => setFiltroDeudores('deuda')} className={botonSeg(filtroDeudores === 'deuda')}>Con deuda <span className="text-[11px] text-[#8f8cb0] font-medium">{nConDeuda}</span></button>
                                  {conEstado && <button type="button" onClick={() => setFiltroDeudores('venc')} className={botonSeg(filtroDeudores === 'venc')}>Vencidos <span className="text-[11px] text-[#8f8cb0] font-medium">{nVencidos}</span></button>}
                                  <button type="button" onClick={() => setFiltroDeudores('lim')} className={botonSeg(filtroDeudores === 'lim')}>Cerca del límite <span className="text-[11px] text-[#8f8cb0] font-medium">{nCercaLimite}</span></button>
                                </div>
                                <div className="flex justify-between items-center gap-2 text-xs text-[#8f8cb0]">
                                  <span>{visibles.length} resultado{visibles.length === 1 ? '' : 's'}{esAdmin && <> · <button type="button" onClick={exportarClientesExcel} className="font-bold text-[#2d284b] hover:text-[#5b4bd6] inline-flex items-center gap-1 transition"><i className="fa-solid fa-file-excel"></i> Exportar</button></>}</span>
                                  {conEstado && (
                                    <button type="button" onClick={() => setOrdenDeudores((o) => (o === 'deuda' ? 'antigua' : 'deuda'))} className="font-bold text-[#2d284b] hover:text-[#5b4bd6] transition">Orden: {ordenDeudores === 'deuda' ? 'mayor deuda' : 'más antigua'}</button>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar pr-2 sm:pr-3 md:pr-2 pb-4 mt-2">
                                {visibles.length === 0 && <p className="text-center text-[13px] text-[#8f8cb0] py-8 px-4"><b className="block text-[#2d284b]">Nadie coincide</b>Prueba con otro filtro o nombre.</p>}
                                {visibles.map(({ cl, e, uso }) => {
                                  const saldo = saldoDe(cl);
                                  const venc = e && e.vencidas.length > 0;
                                  const pend = e ? e.pendientesAsc.length : 0;
                                  const elegido = deudorSeleccionado?.id === cl.id;
                                  return (
                                    <button type="button" key={cl.id} onClick={() => elegirCliente(cl)} className={`grid grid-cols-[42px_minmax(0,1fr)_auto] gap-3 items-center w-full text-left px-2.5 py-2.5 rounded-[18px] mb-0.5 border transition ${elegido ? 'md:bg-[#f3f5ff] md:border-[#dde4fa] border-transparent' : 'border-transparent hover:bg-[#f6f8ff]'}`}>
                                      {avatar(cl, 'w-[42px] h-[42px] text-[13px]')}
                                      <span className="min-w-0">
                                        <span className="block text-[13.5px] font-bold text-[#2d284b] tracking-tight leading-tight truncate">{cl.nombre_completo}</span>
                                        <span className={`block text-[11.5px] mt-0.5 truncate ${venc ? 'text-[#c0262d] font-semibold' : 'text-[#8f8cb0]'}`}>
                                          {e
                                            ? (venc ? `Vencida hace ${e.vencidas[0].diasVencido} d · ${pend} boleta${pend === 1 ? '' : 's'}` : e.masVieja ? `Debe desde hace ${e.masVieja.diasTranscurridos} d · ${pend} boleta${pend === 1 ? '' : 's'}` : 'Sin boletas a crédito')
                                            : `DNI ${cl.dni}${cl.telefono ? ` · ${cl.telefono}` : ''}`}
                                        </span>
                                      </span>
                                      <span className="text-right shrink-0">
                                        {saldo > 0 ? (
                                          <>
                                            <strong className="block text-[14px] font-extrabold tracking-tight tabular-nums text-[#2d284b] whitespace-nowrap">{dinero(saldo)}</strong>
                                            {(Number(cl.limite_credito) || 0) > 0 && <span className="block w-[56px] h-1 rounded-full bg-[#e8ecf7] mt-1.5 ml-auto overflow-hidden"><i className={`block h-full rounded-full ${colorBarra(uso)}`} style={{ width: `${Math.min(100, uso * 100)}%` }}></i></span>}
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
                            <div className={`${hayFicha ? 'flex' : 'hidden md:flex'} flex-col min-h-0 relative`}>{cuerpoFicha}</div>
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
