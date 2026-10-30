import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function HistorialVentas({
  abrirHistorialCierres,
  anularVentaHoy,
  atajoHistorial,
  busquedaBoletaHistorial,
  cargandoHistorial,
  cargarHistorialPorRango,
  elegirAtajoHistorial,
  esAdmin,
  etiquetaDiaHistorial,
  exportarVentasExcel,
  fechaFinHistorial,
  fechaInicioHistorial,
  formatoSoles,
  limiteHistorial,
  menuVentaHistorial,
  modalHistorial,
  nombreClienteHistorial,
  productos,
  setBusquedaBoletaHistorial,
  setFechaFinHistorial,
  setFechaInicioHistorial,
  setLimiteHistorial,
  setMenuVentaHistorial,
  setModalHistorial,
  setReciboReimpresion,
  setVentaDetalleHistorial,
  ventaDetalleHistorial,
  ventasDelDia,
}) {
  return (
    <>
              {/* Modal: Historial de ventas (lista por día, resumen, detalle de cada venta) */}
              {modalHistorial && (() => {
                const activas = ventasDelDia.filter(v => !v.anulada);
                const anuladas = ventasDelDia.filter(v => v.anulada);
                const totalGeneral = activas.reduce((a, c) => a + Number(c.total_venta), 0);
                const totalEfectivo = activas.filter(v => v.medio_pago === 'EFECTIVO').reduce((a, c) => a + Number(c.total_venta), 0);
                const totalOtros = totalGeneral - totalEfectivo;
                const totalGanancia = activas.reduce((a, c) => a + Number(c.utilidad_total || 0), 0);
                const totalAnuladas = anuladas.reduce((a, c) => a + Number(c.total_venta), 0);
                const ticketPromedio = activas.length > 0 ? totalGeneral / activas.length : 0;
                const pctEfectivo = totalGeneral > 0 ? (totalEfectivo / totalGeneral) * 100 : 0;
                const q = busquedaBoletaHistorial.trim().toLowerCase();
                const filtradas = ventasDelDia.filter(v => !q || v.nro_boleta.toLowerCase().includes(q) || nombreClienteHistorial(v).toLowerCase().includes(q));
                const visibles = filtradas.slice(0, limiteHistorial);
                const grupos = [];
                visibles.forEach((v) => {
                  const etiqueta = etiquetaDiaHistorial(v.fecha_hora);
                  const ultimo = grupos[grupos.length - 1];
                  if (ultimo && ultimo.etiqueta === etiqueta) ultimo.ventas.push(v);
                  else grupos.push({ etiqueta, ventas: [v] });
                });
                const ventaElegida = ventaDetalleHistorial ? ventasDelDia.find(v => v.id === ventaDetalleHistorial) || null : null;
                const ventaPanel = ventaElegida || filtradas[0] || null;
                const horaVenta = (v) => new Date(v.fecha_hora).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
                const fechaCorta = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
                const rangoTexto = fechaInicioHistorial === fechaFinHistorial ? fechaCorta(fechaInicioHistorial) : `${fechaCorta(fechaInicioHistorial)} – ${fechaCorta(fechaFinHistorial)}`;
                const ATAJOS = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['7dias', '7 días'], ['mes', 'Este mes'], ['fechas', 'Fechas']];
                const unidadesVenta = (v) => (v.ventas_detalle || []).reduce((a, d) => a + (Number(d.cantidad) || 0), 0);
                const etiquetaPago = (v) => (v.medio_pago === 'EFECTIVO' ? 'Efectivo' : String(v.medio_pago || '').charAt(0) + String(v.medio_pago || '').slice(1).toLowerCase());
                const textoEstado = (v) => (v.anulada ? 'Anulada' : v.medio_pago === 'CREDITO' ? 'A crédito' : 'Pagada');
                const subtextoEstado = (v) => (v.anulada ? 'Venta anulada' : v.medio_pago === 'CREDITO' ? 'Venta a crédito' : `Pagada · ${etiquetaPago(v)}`);
                const clienteTexto = (v) => (nombreClienteHistorial(v) === 'Cliente sin registrar' ? '—' : nombreClienteHistorial(v));
                const ICONO_PAGO = {
                  EFECTIVO: ['fa-money-bill-wave', 'from-[#4cc995] to-[#0f7b4a]'],
                  YAPE: ['fa-mobile-screen', 'from-[#9687f5] to-[#5b4bd6]'],
                  PLIN: ['fa-mobile-screen', 'from-[#9687f5] to-[#5b4bd6]'],
                  TARJETA: ['fa-credit-card', 'from-[#7ab4ee] to-[#3d7fd0]'],
                  CREDITO: ['fa-file-invoice-dollar', 'from-[#f0b24a] to-[#d98a14]'],
                  MIXTO: ['fa-layer-group', 'from-[#aeb4cf] to-[#8f8cb0]'],
                };
                const iconoPago = (v) => (v.anulada ? ['fa-ban', 'from-[#d6dbec] to-[#d6dbec] !text-[#8f8aa3]'] : ICONO_PAGO[v.medio_pago] || ['fa-receipt', 'from-[#aeb4cf] to-[#8f8cb0]']);
                const circuloPago = (v, tam = 'w-8 h-8') => { const [icono, color] = iconoPago(v); return <span className={`${tam} rounded-full bg-gradient-to-br ${color} text-white grid place-items-center text-[13px] shrink-0`}><i className={`fa-solid ${icono}`}></i></span>; };
                const borde = 'border-[#e6e9f5]';
                const botonFantasma = `h-10 px-[17px] rounded-full border ${borde} bg-white hover:bg-[#f7f8fc] text-[13px] font-medium text-stone-700 inline-flex items-center justify-center gap-2 transition whitespace-nowrap`;
                const tarjeta = `relative overflow-hidden bg-white border ${borde} rounded-[18px] px-5 py-[18px] shadow-[0_1px_2px_rgba(20,10,50,0.04),0_16px_36px_-26px_rgba(20,10,50,0.3)]`;
                const chispa = (<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" /><path d="M19 15c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8Z" /></svg>);

                const menuVenta = (v) => (
                  <>
                    <div className="fixed inset-0 z-[5]" onClick={() => setMenuVentaHistorial(null)}></div>
                    <div className={`absolute right-3 top-10 z-10 bg-white border ${borde} rounded-xl p-1 min-w-[190px] shadow-[0_12px_30px_-8px_rgba(20,10,50,0.25)] text-left`}>
                      <button onClick={() => { setMenuVentaHistorial(null); setVentaDetalleHistorial(v.id); }} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-stone-700 hover:bg-[#f7f8fc]"><i className="fa-regular fa-eye w-4 text-stone-500"></i> Ver detalle</button>
                      <button onClick={() => { setMenuVentaHistorial(null); setReciboReimpresion(v); }} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-stone-700 hover:bg-[#f7f8fc]"><i className="fa-solid fa-print w-4 text-stone-500"></i> Reimprimir boleta</button>
                      {!v.anulada && esAdmin && (
                        <>
                          <div className={`border-t ${borde} my-1`}></div>
                          <button onClick={() => { setMenuVentaHistorial(null); anularVentaHoy(v); }} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[#c0262d] hover:bg-[#fdf1f1]"><i className="fa-solid fa-ban w-4"></i> Anular venta</button>
                        </>
                      )}
                    </div>
                  </>
                );

                // Detalle como ticket: total grande, sello de estado, línea punteada con muescas y el desglose.
                const detalleVenta = (v) => (
                  <div className="flex flex-col gap-4">
                    <div className={`relative bg-white border ${borde} rounded-[18px] shadow-[0_18px_40px_-24px_rgba(20,10,50,0.35)]`}>
                      <div className="px-[22px] pt-[22px] pb-[18px]">
                        <p className="text-[13px] text-stone-500"><b className="font-mono font-semibold text-stone-900">{v.nro_boleta}</b> · {etiquetaDiaHistorial(v.fecha_hora)}, {horaVenta(v)}</p>
                        <p className={`text-4xl font-bold tracking-[-0.04em] leading-[1.05] mt-1.5 tabular-nums ${v.anulada ? 'line-through text-stone-400' : 'text-stone-900'}`}>S/ {formatoSoles(Number(v.total_venta))}</p>
                        <span className={`inline-flex items-center gap-1.5 mt-2.5 text-[12.5px] font-semibold px-3 py-1 rounded-full ${v.anulada ? 'bg-[#fdf1f1] text-[#c0262d]' : 'bg-[#eef8f2] text-[#0f7b4a]'}`}>
                          <i className={`fa-solid ${v.anulada ? 'fa-ban' : 'fa-check'} text-[10px]`}></i>{subtextoEstado(v)}
                        </span>
                      </div>
                      <div className="relative mx-3.5 border-t-2 border-dashed border-[#e0e4f2]">
                        <span className={`absolute -top-[11px] -left-[25px] w-5 h-5 rounded-full bg-[#f7f8fc] border ${borde} [clip-path:inset(0_0_0_50%)]`}></span>
                        <span className={`absolute -top-[11px] -right-[25px] w-5 h-5 rounded-full bg-[#f7f8fc] border ${borde} [clip-path:inset(0_50%_0_0)]`}></span>
                      </div>
                      <div className="px-[22px] pt-[18px] pb-[22px]">
                        {(v.ventas_detalle || []).length > 0 ? (
                          (v.ventas_detalle || []).map((d, i) => (
                            <div key={i} className="flex justify-between gap-3 py-2.5 text-[13.5px] border-b border-[#f1f3fa]">
                              <span className="text-stone-800">{d.productos?.descripcion || d.descripcion || 'Producto'}<small className="block text-xs text-stone-500 mt-0.5">{d.cantidad} × S/ {formatoSoles(Number(d.precio_unitario))}</small></span>
                              <span className="font-semibold tabular-nums shrink-0">S/ {formatoSoles(Number(d.subtotal))}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-stone-500 py-2">Sin detalle de productos disponible.</p>
                        )}
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13px] mt-3.5">
                          <dt className="text-stone-500">Cliente</dt><dd className="text-right font-medium">{nombreClienteHistorial(v).replace('Cliente sin registrar', 'Sin registrar')}</dd>
                          <dt className="text-stone-500">Medio de pago</dt><dd className="text-right font-medium">{etiquetaPago(v)}</dd>
                          {Number(v.descuento_monto) > 0 && (<><dt className="text-stone-500">Descuento</dt><dd className="text-right font-medium">- S/ {formatoSoles(Number(v.descuento_monto))}</dd></>)}
                          {esAdmin && (<><dt className="text-stone-500">Ganancia</dt><dd className="text-right font-medium text-[#0f7b4a]">S/ {formatoSoles(Number(v.utilidad_total || 0))}</dd></>)}
                        </dl>
                        <div className="flex items-baseline justify-between border-t border-stone-900 pt-3 mt-3.5 text-[13px] font-semibold">
                          <span>Total</span><b className="text-xl tracking-tight tabular-nums">S/ {formatoSoles(Number(v.total_venta))}</b>
                        </div>
                      </div>
                    </div>
                    <div className={`grid gap-2.5 ${!v.anulada && esAdmin ? 'grid-cols-[1.3fr_1fr]' : 'grid-cols-1'}`}>
                      <button onClick={() => setReciboReimpresion(v)} className="kz-pri h-12 text-sm font-semibold inline-flex items-center justify-center gap-2"><i className="fa-solid fa-print text-xs"></i><span>Reimprimir</span>{chispa}</button>
                      {!v.anulada && esAdmin && (
                        <button onClick={() => anularVentaHoy(v)} className={`${botonFantasma} h-12 !text-[#c0262d]`}><i className="fa-solid fa-ban text-xs"></i> Anular</button>
                      )}
                    </div>
                  </div>
                );

                const estadoCelda = (v) => (
                  <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${v.anulada ? 'text-[#c0262d]' : 'text-stone-600'}`}>
                    <span className={`w-[7px] h-[7px] rounded-full ${v.anulada ? 'bg-[#c0262d]' : v.medio_pago === 'CREDITO' ? 'bg-[#d98a14]' : 'bg-[#16a34a]'}`}></span>{textoEstado(v)}
                  </span>
                );

                return (
                  <div className="ventana-riel fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
                    <div className="bg-[#f7f8fc] rounded-[18px] max-w-xl lg:max-w-6xl w-full max-h-[94vh] h-[94vh] lg:h-[780px] flex flex-col shadow-2xl border border-black/5 overflow-hidden">
                      <div className={`bg-white px-4 sm:px-7 py-3.5 sm:py-[18px] shrink-0 flex flex-wrap lg:flex-nowrap items-center gap-x-3 gap-y-2.5 border-b ${borde}`}>
                        {ventaElegida && (
                          <button aria-label="Volver a la lista" onClick={() => setVentaDetalleHistorial(null)} className="lg:hidden h-9 pl-2.5 pr-3.5 rounded-full border border-[#e6e9f5] bg-white text-[13px] font-medium text-stone-700 inline-flex items-center gap-1 shrink-0"><i className="fa-solid fa-chevron-left text-[10px]"></i> Historial</button>
                        )}
                        <h3 className={`text-xl sm:text-[21px] font-bold tracking-tight text-stone-900 whitespace-nowrap ${ventaElegida ? 'hidden lg:block' : ''}`}>Historial de ventas</h3>
                        {esAdmin && (
                          <div className={`${ventaElegida ? 'hidden lg:inline-flex' : 'inline-flex'} bg-[#e8ecf7] rounded-full p-[3px] order-last basis-full lg:order-none lg:basis-auto lg:ml-2`}>
                            <button type="button" className="flex-1 lg:flex-none h-8 px-[17px] rounded-full text-[13px] font-semibold text-stone-900 bg-white shadow-[0_1px_3px_rgba(20,10,50,0.14)]">Ventas</button>
                            <button type="button" onClick={() => { setModalHistorial(false); abrirHistorialCierres(); }} className="flex-1 lg:flex-none h-8 px-[17px] rounded-full text-[13px] font-medium text-stone-500 hover:text-stone-900 whitespace-nowrap">Cierres de caja</button>
                          </div>
                        )}
                        <span className="flex-1"></span>
                        <button aria-label="Cerrar" onClick={() => { setModalHistorial(false); setVentaDetalleHistorial(null); setMenuVentaHistorial(null); }} className="w-9 h-9 rounded-full text-stone-400 hover:text-stone-700 hover:bg-[#eef1fb] shrink-0"><i className="fa-solid fa-xmark"></i></button>
                      </div>

                      {ventaElegida && (
                        <div className="lg:hidden flex-1 min-h-0 overflow-y-auto hide-scrollbar p-4">{detalleVenta(ventaElegida)}</div>
                      )}

                      <div className={`${ventaElegida ? 'hidden lg:flex' : 'flex'} flex-1 min-h-0 flex-col`}>
                        <div className="px-4 sm:px-7 pt-4 lg:pt-5 shrink-0 grid grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr] gap-3 lg:gap-3.5">
                          <div className={`${tarjeta} col-span-2 lg:col-span-1`}>
                            <span className="absolute -right-14 -top-[70px] w-[200px] h-[200px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(150,135,245,0.16), rgba(150,135,245,0))' }}></span>
                            <span className="relative text-[13px] text-stone-500">Total vendido · {activas.length} venta{activas.length === 1 ? '' : 's'}</span>
                            <b className="relative block text-[30px] lg:text-4xl font-bold tracking-[-0.04em] leading-[1.05] mt-1 mb-3 tabular-nums">S/ {formatoSoles(totalGeneral)}</b>
                            <div className="relative flex h-2 rounded overflow-hidden bg-[#e8ecf7] gap-0.5">
                              {pctEfectivo > 0 && <i className="block h-full bg-gradient-to-r from-[#3fbf8a] to-[#0f7b4a]" style={{ width: `${pctEfectivo}%` }}></i>}
                              {pctEfectivo < 100 && <i className="block h-full bg-gradient-to-r from-[#9687f5] to-[#5b4bd6]" style={{ width: `${100 - pctEfectivo}%` }}></i>}
                            </div>
                            <div className="relative flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[12.5px] text-stone-500">
                              <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#0f7b4a]"></i>Efectivo <b className="text-stone-900 font-semibold">S/ {formatoSoles(totalEfectivo)}</b></span>
                              <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#5b4bd6]"></i>Otros medios <b className="text-stone-900 font-semibold">S/ {formatoSoles(totalOtros)}</b></span>
                            </div>
                          </div>
                          <div className={tarjeta}>
                            <span className="text-[13px] text-stone-500">Ticket promedio</span>
                            <b className="block text-[22px] lg:text-2xl font-bold tracking-tight mt-1 tabular-nums">S/ {formatoSoles(ticketPromedio)}</b>
                            {esAdmin && <span className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-semibold text-[#0f7b4a] bg-[#eef8f2] rounded-full px-2.5 py-[3px]"><i className="fa-solid fa-check text-[9px]"></i>Ganancia S/ {formatoSoles(totalGanancia)}</span>}
                          </div>
                          <div className={tarjeta}>
                            <span className="text-[13px] text-stone-500">Anuladas</span>
                            <b className="block text-[22px] lg:text-2xl font-bold tracking-tight mt-1 tabular-nums">{anuladas.length}</b>
                            <span className="block text-xs text-stone-500 mt-2">{anuladas.length > 0 ? `S/ ${formatoSoles(totalAnuladas)} sin contar` : 'Ninguna en este período'}</span>
                          </div>
                        </div>

                        <div className="px-4 sm:px-7 py-3.5 shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2.5">
                          <div className="flex bg-[#e8ecf7] rounded-full p-[3px] max-w-full overflow-x-auto hide-scrollbar">
                            {ATAJOS.map(([id, texto]) => (
                              <button key={id} type="button" onClick={() => elegirAtajoHistorial(id)} className={`h-8 px-2.5 sm:px-[15px] rounded-full text-[12.5px] sm:text-[13px] whitespace-nowrap transition ${atajoHistorial === id ? 'bg-white text-stone-900 font-semibold shadow-[0_1px_3px_rgba(20,10,50,0.14)]' : 'text-stone-500 font-medium hover:text-stone-900'}`}>{texto}</button>
                            ))}
                          </div>
                          <span className="text-[13px] text-stone-500">{rangoTexto}</span>
                          <span className="flex-1 hidden lg:block"></span>
                          <div className="flex items-center gap-2 w-full lg:w-auto">
                            <label className={`flex items-center gap-2.5 h-10 flex-1 lg:flex-none lg:w-[280px] px-4 rounded-full border ${borde} bg-white text-stone-400 focus-within:border-[#5b4bd6] focus-within:ring-[3px] focus-within:ring-[#5b4bd6]/10 transition`}>
                              <i className="fa-solid fa-magnifying-glass text-xs"></i>
                              <input type="text" placeholder="Buscar boleta o cliente" value={busquedaBoletaHistorial} onChange={(e) => { setBusquedaBoletaHistorial(e.target.value); setLimiteHistorial(40); }} className="flex-1 min-w-0 bg-transparent text-[13.5px] text-stone-900 outline-none placeholder:text-stone-400" />
                            </label>
                            {esAdmin && ventasDelDia.length > 0 && (
                              <button onClick={exportarVentasExcel} className={botonFantasma} title="Descargar en Excel" aria-label="Descargar en Excel"><i className="fa-solid fa-download text-xs"></i><span className="hidden sm:inline">Excel</span></button>
                            )}
                          </div>
                          {atajoHistorial === 'fechas' && (
                            <div className="flex flex-wrap items-center gap-2 w-full">
                              <input type="date" aria-label="Desde" value={fechaInicioHistorial} onChange={(e) => setFechaInicioHistorial(e.target.value)} className={`h-10 px-3.5 rounded-full border ${borde} bg-white text-[13px] text-stone-900`} />
                              <span className="text-xs text-stone-400">a</span>
                              <input type="date" aria-label="Hasta" value={fechaFinHistorial} onChange={(e) => setFechaFinHistorial(e.target.value)} className={`h-10 px-3.5 rounded-full border ${borde} bg-white text-[13px] text-stone-900`} />
                              <button onClick={() => cargarHistorialPorRango(fechaInicioHistorial, fechaFinHistorial)} className="kz-pri h-10 px-5 text-[13px] font-semibold">Buscar</button>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-h-0 px-4 sm:px-7 pb-5 grid grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_330px] gap-4">
                          <div className="min-h-0 overflow-y-auto hide-scrollbar lg:bg-white lg:border lg:border-[#e6e9f5] lg:rounded-[18px]">
                            {cargandoHistorial ? (
                              <p className="text-sm text-center py-10 text-stone-500">Cargando ventas...</p>
                            ) : filtradas.length === 0 ? (
                              <p className="text-sm text-center py-10 text-stone-500">No hay ventas en ese período.</p>
                            ) : (
                              <>
                                {/* Celular: una tarjeta por venta */}
                                <div className="lg:hidden">
                                  {grupos.map((g) => (
                                    <div key={g.etiqueta}>
                                      <p className="flex justify-between px-1.5 pt-3 pb-1.5 text-xs font-semibold text-stone-500"><span>{g.etiqueta}</span><span className="tabular-nums">S/ {formatoSoles(g.ventas.filter(v => !v.anulada).reduce((a, c) => a + Number(c.total_venta), 0))}</span></p>
                                      {g.ventas.map((v) => (
                                        <div key={v.id} className="relative mb-2">
                                          <div role="button" tabIndex={0} onClick={() => setVentaDetalleHistorial(v.id)} onKeyDown={(e) => { if (e.key === 'Enter') setVentaDetalleHistorial(v.id); }} className={`grid grid-cols-[36px_1fr_auto_28px] items-center gap-3 px-2.5 py-3 bg-white border ${borde} rounded-[14px] cursor-pointer active:bg-[#f7f9ff]`}>
                                            {circuloPago(v, 'w-9 h-9')}
                                            <div className="min-w-0">
                                              <p className={`font-mono text-[13.5px] font-semibold ${v.anulada ? 'line-through text-stone-400' : 'text-stone-900'}`}>{v.nro_boleta}</p>
                                              <p className="text-xs text-stone-500 mt-0.5 truncate">{horaVenta(v)} · {etiquetaPago(v)}{clienteTexto(v) !== '—' ? ` · ${clienteTexto(v)}` : ''}{v.anulada && <span className="text-[#c0262d] font-semibold"> · Anulada</span>}</p>
                                            </div>
                                            <span className={`text-[15px] font-bold tracking-tight tabular-nums ${v.anulada ? 'line-through text-stone-400' : 'text-stone-900'}`}>S/ {formatoSoles(Number(v.total_venta))}</span>
                                            <button type="button" aria-label="Más acciones" onClick={(e) => { e.stopPropagation(); setMenuVentaHistorial(menuVentaHistorial === v.id ? null : v.id); }} className="w-7 h-7 rounded-full text-stone-400 hover:bg-[#eef1fb] grid place-items-center"><i className="fa-solid fa-ellipsis-vertical"></i></button>
                                          </div>
                                          {menuVentaHistorial === v.id && menuVenta(v)}
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>

                                {/* PC: tabla */}
                                <table className="hidden lg:table w-full border-collapse">
                                  <thead>
                                    <tr className="text-left text-xs font-medium text-stone-500">
                                      {['Boleta', 'Hora', 'Cliente', 'Pago', 'Estado'].map((t) => <th key={t} className={`sticky top-0 z-[2] bg-white px-3 py-3.5 border-b ${borde} whitespace-nowrap font-medium`}>{t}</th>)}
                                      <th className={`sticky top-0 z-[2] bg-white px-3 py-3.5 border-b ${borde} text-right font-medium`}>Total</th>
                                      <th className={`sticky top-0 z-[2] bg-white border-b ${borde} w-11`}></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {grupos.map((g) => (
                                      <React.Fragment key={g.etiqueta}>
                                        <tr className="bg-[#f9fafd] text-xs font-semibold text-stone-500">
                                          <td colSpan={5} className="px-3 py-2.5">{g.etiqueta}</td>
                                          <td colSpan={2} className="px-3 py-2.5 text-right tabular-nums">{g.ventas.length} venta{g.ventas.length === 1 ? '' : 's'} · S/ {formatoSoles(g.ventas.filter(v => !v.anulada).reduce((a, c) => a + Number(c.total_venta), 0))}</td>
                                        </tr>
                                        {g.ventas.map((v) => {
                                          const elegida = ventaPanel && ventaPanel.id === v.id;
                                          return (
                                            <tr key={v.id} onClick={() => setVentaDetalleHistorial(v.id)} className={`cursor-pointer text-[13.5px] text-stone-700 transition ${elegida ? 'bg-[#eff2fd] shadow-[inset_3px_0_0_#5b4bd6]' : 'hover:bg-[#fafbfe]'}`}>
                                              <td className="px-3 py-3 border-b border-[#f1f3fa]"><span className={`flex items-center gap-2.5 font-mono text-[13px] font-medium ${v.anulada ? 'line-through text-stone-400' : 'text-stone-900'}`}>{circuloPago(v)}{v.nro_boleta}</span></td>
                                              <td className="px-3 py-3 border-b border-[#f1f3fa] text-stone-500 whitespace-nowrap">{horaVenta(v)}</td>
                                              <td className="px-3 py-3 border-b border-[#f1f3fa] text-stone-500 max-w-[140px] truncate">{clienteTexto(v)}</td>
                                              <td className="px-3 py-3 border-b border-[#f1f3fa]">{etiquetaPago(v)}</td>
                                              <td className="px-3 py-3 border-b border-[#f1f3fa] whitespace-nowrap">{estadoCelda(v)}</td>
                                              <td className={`px-3 py-3 border-b border-[#f1f3fa] text-right font-semibold tabular-nums whitespace-nowrap ${v.anulada ? 'line-through text-stone-400' : 'text-stone-900'}`}>S/ {formatoSoles(Number(v.total_venta))}</td>
                                              <td className="px-2 py-1 border-b border-[#f1f3fa] relative text-right">
                                                <button type="button" aria-label="Más acciones" onClick={(e) => { e.stopPropagation(); setMenuVentaHistorial(menuVentaHistorial === v.id ? null : v.id); }} className="w-[30px] h-[30px] rounded-full text-stone-400 hover:bg-[#ebecf2] hover:text-[#5b4bd6] grid place-items-center"><i className="fa-solid fa-ellipsis-vertical"></i></button>
                                                {menuVentaHistorial === v.id && menuVenta(v)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </React.Fragment>
                                    ))}
                                  </tbody>
                                </table>

                                {filtradas.length > visibles.length && (
                                  <div className="flex justify-center py-3">
                                    <button onClick={() => setLimiteHistorial((n) => n + 40)} className={botonFantasma}>Ver más ventas</button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          <div className="hidden lg:block min-h-0 overflow-y-auto hide-scrollbar">
                            {ventaPanel ? detalleVenta(ventaPanel) : <p className="text-sm text-stone-500 text-center py-10">Elige una venta para ver su detalle.</p>}
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
