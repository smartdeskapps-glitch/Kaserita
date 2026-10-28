import React from 'react';
import { fechaHoyISO } from './PanelAdminCompartido.jsx';

// Modal del dashboard de ventas (solo Administrador). Vive aparte y se carga al abrirlo
// (React.lazy en main.jsx) para no pesar en el arranque del POS. El estado y la carga de
// datos siguen en PosApp: aquí solo se dibuja lo que recibe por props.
// Modal: Dashboard de Ventas (detallado). Estilo sereno: fondo con niebla de
// color, tarjetas blancas translúcidas de esquinas redondeadas, texto pequeño
// y ordenado, la paleta Crocus Purple / Ebony Clay / Titan White como único
// acento (la hora pico y el mejor día se resaltan) y verde/rojo solo para
// variaciones y deudas. El encabezado con los
// filtros queda fijo y solo el contenido hace scroll.

// Colores consistentes por medio de pago, usados en la dona y la leyenda.
// Tonos del morado de la marca para los medios digitales y grises para el
// resto, en vez de un color distinto por medio.
const COLOR_MEDIO_PAGO = {
  EFECTIVO: '#2D284B',
  YAPE: '#9687F5',
  PLIN: '#c5bcff',
  TARJETA: '#57534e',
  CREDITO: '#a8a29e',
  MIXTO: '#78716c',
  OTRO: '#d6d3d1'
};
const iniciales = (t) => String(t || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
const NOMBRE_MEDIO_DIA = (medio) => medio.charAt(0) + medio.slice(1).toLowerCase();

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

export default function DashboardVentas({
  cargandoDashboard,
  cargarDashboard,
  clientesDeuda,
  combosVendidos,
  dashStats,
  diaCalendarioSel,
  diasAnioDash,
  diasAnioRango,
  exportarDashboardExcel,
  fechaFinDash,
  fechaInicioDash,
  horaResaltada,
  mesResaltado,
  mesCalendario,
  pestanaDiaCal,
  productos,
  proveedoresDeudaDash,
  setDiaCalendarioSel,
  setFechaFinDash,
  setFechaInicioDash,
  setHoraResaltada,
  setMesCalendario,
  setMesResaltado,
  setModalDashboard,
  setPestanaDiaCal,
  formatoSoles,
  montoResumen,
  montoCorto,
  FiltroFechasRapido,
  VariacionPct,
}) {
  return (
        <div className="fixed inset-0 bg-stone-900/30 md:backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4">
          <div className="dsh-panel border border-white/80 rounded-[28px] max-w-6xl w-full max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="shrink-0 px-5 md:px-7 pt-6 pb-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-2xl md:text-[28px] font-normal text-[#2D284B] tracking-tight">Dashboard de <span className="text-[#5b4bd6]">ventas</span></h3>
                  <p className="text-xs text-[#6b6890] mt-1.5">
                    Del {String(fechaInicioDash).split('-').reverse().join('/')} al {String(fechaFinDash).split('-').reverse().join('/')}
                    {dashStats.numVentas > 0 && <> · <span className="text-[#5b4bd6] font-semibold">{dashStats.numVentas} venta{dashStats.numVentas === 1 ? '' : 's'}</span></>}
                  </p>
                </div>
                <button onClick={() => setModalDashboard(false)} className="w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#2D284B] shadow-sm flex items-center justify-center shrink-0" aria-label="Cerrar">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <FiltroFechasRapido
                desde={fechaInicioDash}
                hasta={fechaFinDash}
                setDesde={setFechaInicioDash}
                setHasta={setFechaFinDash}
                onRango={cargarDashboard}
                diasAtras={7}
                tema="dsh"
              >
                {dashStats.numVentas > 0 && (
                  <button
                    onClick={exportarDashboardExcel}
                    className="px-4 py-1.5 bg-white hover:bg-[#EBF0FF] text-[#2D284B] text-xs font-semibold rounded-full shadow-sm flex items-center gap-1.5 ml-auto"
                    title="Exportar a Excel"
                  >
                    <i className="fa-solid fa-file-excel text-[#5b4bd6]"></i> Excel
                  </button>
                )}
              </FiltroFechasRapido>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar px-5 md:px-7 pb-7 pt-1 space-y-4">
            {cargandoDashboard ? (
              <p className="text-xs text-center py-10 text-stone-600">Calculando estadísticas...</p>
            ) : dashStats.numVentas === 0 ? (
              <p className="text-xs text-center py-10 text-stone-500">No hay ventas registradas en ese rango.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Izquierda: venta total, productos y combos */}
                  <div className="lg:col-span-5 space-y-4 min-w-0">
                    <section className="dsh-card dsh-hero p-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2.5 text-xs font-medium text-[#6b6890]">
                          <span className="dsh-ib"><i className="fa-solid fa-receipt text-[12px]"></i></span>Venta total
                        </span>
                        {dashStats.horaPico.total > 0 && (
                          <span className="text-[11px] text-[#6b6890]">Hora pico <b className="text-[#5b4bd6] font-semibold">{String(dashStats.horaPico.hora).padStart(2, '0')}:00</b></span>
                        )}
                      </div>
                      <p className="mt-3 text-[40px] md:text-[44px] font-normal tracking-tight tabular-nums text-[#2D284B] leading-none">
                        <small className="text-xl font-light text-[#8f8cb0] mr-1.5">S/</small>{formatoSoles(dashStats.totalVenta)}
                      </p>
                      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                        <VariacionPct pct={dashStats.hayBaseVentaAnterior ? dashStats.cambioVentaPct : null} />
                        <span className="dsh-chip">{dashStats.numVentas} venta{dashStats.numVentas === 1 ? '' : 's'}</span>
                      </div>
                    </section>

                    <section className="dsh-card p-5">
                      <h4 className="text-xs font-medium text-[#6b6890]">Productos más vendidos</h4>
                      <p className="text-[11px] text-[#8f8cb0] mt-0.5">Por monto vendido en el período</p>
                      <ol className="mt-2">
                        {dashStats.topProductos.map((p, i) => (
                          <li key={p.descripcion + i} className="flex items-center gap-3 py-2.5 border-t border-[#dde4fa] first:border-t-0">
                            <span className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11.5px] font-semibold shrink-0 ${i === 0 ? 'bg-[#2D284B] text-white' : 'bg-[#5b4bd6]/10 text-[#5b4bd6]'}`}>{iniciales(p.descripcion)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline gap-3">
                                <span className="text-[13px] font-medium text-[#2D284B] truncate">{p.descripcion}</span>
                                <span className="text-[13px] font-semibold text-[#2D284B] tabular-nums shrink-0">S/ {formatoSoles(p.monto)}</span>
                              </div>
                              <div className="w-full h-1 bg-[#e6ebfb] rounded-full overflow-hidden mt-1.5">
                                <div className="h-full bg-gradient-to-r from-[#c5bcff] to-[#9687F5] rounded-full" style={{ width: `${(p.monto / dashStats.maxProducto) * 100}%` }}></div>
                              </div>
                              <p className="text-[11px] text-[#6b6890] mt-1">
                                {p.cantidad} und · utilidad <span className="text-emerald-600 font-semibold tabular-nums">S/ {formatoSoles(p.utilidad)}</span>
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>

                    {combosVendidos.length > 0 && (
                      <section className="dsh-card dsh-combo p-5 text-white">
                        <h4 className="text-xs font-medium text-white/85">Combos vendidos</h4>
                        <ul className="mt-2">
                          {combosVendidos.map((c) => {
                            const margen = c.monto > 0 ? (c.utilidad / c.monto) * 100 : 0;
                            return (
                              <li key={c.id} className="relative flex items-center justify-between gap-3 py-2.5 border-t border-white/15 first:border-t-0">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{c.nombre}</p>
                                  <p className="text-[11px] text-white/80">{c.unidades} combo{c.unidades === 1 ? '' : 's'} · ganancia <span className={`font-semibold tabular-nums ${margen < 10 ? 'text-amber-300' : 'text-white'}`}>S/ {formatoSoles(c.utilidad)} ({margen.toFixed(margen < 10 ? 1 : 0)}%)</span></p>
                                </div>
                                <span className="text-sm font-semibold tabular-nums shrink-0">S/ {formatoSoles(c.monto)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    )}
                  </div>

                  {/* Derecha: métricas, actividad por hora y métodos de pago */}
                  <div className="lg:col-span-7 space-y-4 min-w-0">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { etiqueta: 'Utilidad', valor: `S/ ${formatoSoles(dashStats.totalUtilidad)}`, pct: dashStats.hayBaseUtilidadAnterior ? dashStats.cambioUtilidadPct : null },
                        { etiqueta: 'Costo', valor: `S/ ${formatoSoles(dashStats.totalCosto)}` },
                        { etiqueta: 'Margen', valor: `${dashStats.margenPct.toFixed(1)}%` },
                        { etiqueta: 'Ticket promedio', valor: `S/ ${formatoSoles(dashStats.ticketPromedio)}` },
                      ].map((d) => (
                        <div key={d.etiqueta} className="dsh-card p-4 min-w-0">
                          <p className="text-[11px] font-medium text-[#6b6890]">{d.etiqueta}</p>
                          <p className="text-[17px] xl:text-lg font-medium text-[#2D284B] tracking-tight tabular-nums mt-1 whitespace-nowrap">{d.valor}</p>
                          {d.pct != null && <div className="mt-1"><VariacionPct pct={d.pct} corto /></div>}
                        </div>
                      ))}
                    </div>

                    <section className="dsh-card p-5">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-medium text-[#6b6890]">Actividad por hora</h4>
                        {dashStats.horaPico.total > 0 && (
                          <span className="text-[11px] text-[#6b6890]">{((dashStats.horaPico.total / dashStats.totalVenta) * 100).toFixed(0)}% de las ventas en la hora pico</span>
                        )}
                      </div>
                      <div className="flex items-end gap-4 mt-3">
                        <p className="shrink-0 text-[30px] font-light tracking-tight tabular-nums text-[#2D284B] leading-none pb-5">
                          {dashStats.horaPico.total > 0 ? String(dashStats.horaPico.hora).padStart(2, '0') : '--'}<small className="text-[15px] text-[#8f8cb0]">:00</small>
                        </p>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-end gap-[3px] h-28" onMouseLeave={() => setHoraResaltada(null)}>
                            {dashStats.porHora.map((h, i) => {
                              const esPico = dashStats.horaPico.total > 0 && h.hora === dashStats.horaPico.hora;
                              const activa = horaResaltada === i;
                              return (
                                <div key={h.hora} className="relative flex-1 h-full flex items-end justify-center" onMouseEnter={() => setHoraResaltada(i)}>
                                  {activa && h.total > 0 && (
                                    <div className={`absolute bottom-full mb-1.5 bg-[#2D284B] text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap pointer-events-none z-20 shadow-lg ${i < 3 ? 'left-0' : i > 20 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                                      <div className="font-bold">{String(h.hora).padStart(2, '0')}:00 · S/ {formatoSoles(h.total)}</div>
                                      <div className="text-[#c5bcff]">{h.cantidad} venta{h.cantidad === 1 ? '' : 's'}</div>
                                    </div>
                                  )}
                                  <div
                                    className={`w-full max-w-[12px] rounded-full transition-colors duration-200 ${esPico ? 'dsh-pico' : activa ? 'bg-[#c5bcff]' : 'bg-[#5b4bd6]/15'}`}
                                    style={{ height: `${Math.max(7, (h.total / dashStats.maxHora) * 100)}%` }}
                                  ></div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-[3px] mt-2 text-[10px] text-[#8f8cb0]">
                            {dashStats.porHora.map((h) => (
                              <span key={h.hora} className={`flex-1 text-center whitespace-nowrap ${dashStats.horaPico.total > 0 && h.hora === dashStats.horaPico.hora ? 'font-bold text-[#5b4bd6]' : ''}`}>{h.hora % 3 === 0 ? `${h.hora}h` : ''}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="dsh-card p-5">
                      <h4 className="text-xs font-medium text-[#6b6890]">Métodos de pago</h4>
                      <p className="text-[11px] text-[#8f8cb0] mt-0.5">Cómo pagaron tus clientes</p>
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-[#e6ebfb] gap-0.5 mt-4">
                        {dashStats.porMedio.map(m => (
                          <div key={m.medio} title={`${m.medio}: ${m.pct.toFixed(0)}%`} style={{ width: `${m.pct}%`, background: COLOR_MEDIO_PAGO[m.medio] || '#d6d3d1' }}></div>
                        ))}
                      </div>
                      <ul className="mt-2">
                        {dashStats.porMedio.map(m => (
                          <li key={m.medio} className="flex items-center gap-3 py-2.5 border-t border-[#dde4fa] first:border-t-0 text-sm">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR_MEDIO_PAGO[m.medio] || '#d6d3d1' }}></span>
                            <span className="flex-1 min-w-0 truncate font-medium text-[#2D284B] capitalize">{m.medio.toLowerCase()}</span>
                            <span className="font-semibold text-[#2D284B] tabular-nums">S/ {formatoSoles(m.total)}</span>
                            <span className="w-10 text-right text-xs text-[#6b6890] tabular-nums">{m.pct.toFixed(0)}%</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                </div>

                {/* Ventas por día: calendario del mes completo. Los datos salen de
                    las ventas del año (diasAnioDash), no del rango del filtro, y
                    el rango elegido queda marcado con un borde. El promedio cuenta
                    los días transcurridos del mes; el "día de menor venta" ignora
                    los días sin ventas (esos se cuentan aparte), si no siempre
                    ganaría un día en cero. */}
                {(() => {
                  const [aHoy, mHoy, dHoy] = fechaHoyISO().split('-').map(Number);
                  const ver = mesCalendario || { anio: Number(fechaFinDash.slice(0, 4)) || aHoy, mes: (Number(fechaFinDash.slice(5, 7)) || mHoy) - 1 };
                  const diasFuente = ver.anio === aHoy ? diasAnioDash : diasAnioRango;
                  const totalPorFecha = new Map();
                  diasFuente.forEach((d) => totalPorFecha.set(d.fecha, Number(d.total)));
                  const diasMes = new Date(ver.anio, ver.mes + 1, 0).getDate();
                  const desfase = (new Date(ver.anio, ver.mes, 1).getDay() + 6) % 7; // semana desde el lunes
                  const prefijo = `${ver.anio}-${String(ver.mes + 1).padStart(2, '0')}-`;
                  const cmpMes = ver.anio * 12 + ver.mes - (aHoy * 12 + (mHoy - 1));
                  const hastaDia = cmpMes > 0 ? 0 : cmpMes === 0 ? dHoy : diasMes;
                  const clave = (d) => prefijo + String(d).padStart(2, '0');
                  const totalDe = (d) => totalPorFecha.get(clave(d)) || 0;
                  const transcurridos = Array.from({ length: hastaDia }, (_, k) => k + 1);
                  const conVentas = transcurridos.filter((d) => totalDe(d) > 0);
                  const totalMes = transcurridos.reduce((a, d) => a + totalDe(d), 0);
                  const promedio = hastaDia ? totalMes / hastaDia : 0;
                  const diaMax = conVentas.reduce((m, d) => (totalDe(d) > totalDe(m) ? d : m), conVentas[0]);
                  const diaMin = conVentas.reduce((m, d) => (totalDe(d) < totalDe(m) ? d : m), conVentas[0]);
                  const maxDia = conVentas.length ? totalDe(diaMax) : 1;
                  const sinVentas = hastaDia - conVentas.length;
                  const nombreDia = (d) => new Date(ver.anio, ver.mes, d).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: '2-digit' }).replace(',', '');
                  const nombreMes = (() => {
                    const t = new Date(ver.anio, ver.mes, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
                    return t.charAt(0).toUpperCase() + t.slice(1);
                  })();
                  const celdas = [...Array(desfase).fill(null), ...Array.from({ length: diasMes }, (_, k) => k + 1)];
                  while (celdas.length % 7) celdas.push(null);
                  const semanas = [];
                  for (let i = 0; i < celdas.length; i += 7) {
                    const dias = celdas.slice(i, i + 7).filter((d) => d !== null && d <= hastaDia);
                    semanas.push({ n: dias.length, total: dias.reduce((a, d) => a + totalDe(d), 0) });
                  }
                  const semanasVisibles = semanas.map((s, i) => ({ ...s, i })).filter((s) => s.n > 0);
                  const maxSemana = Math.max(1, ...semanasVisibles.map((s) => s.total));
                  const puedeAnterior = ver.anio === aHoy && ver.mes > 0;
                  const puedeSiguiente = ver.anio === aHoy && ver.mes < mHoy - 1;
                  const tarjeta = 'rounded-2xl shadow-sm p-4 min-w-0';

                  // Hoja de detalle del día tocado: monto, ventas, ticket, cómo
                  // pagaron y ventas por hora. Sale de las mismas ventas del
                  // calendario, no pide nada extra.
                  const selDia = diaCalendarioSel && diaCalendarioSel.startsWith(prefijo) ? Number(diaCalendarioSel.slice(8, 10)) : null;
                  const detalleDia = (() => {
                    if (!selDia || selDia > hastaDia) return null;
                    const dd = diasFuente.find((x) => x.fecha === clave(selDia));
                    const total = Number(dd?.total) || 0;
                    const medios = Object.entries(dd?.medios || {})
                      .map(([medio, m]) => ({ medio, total: Number(m.total) || 0, n: Number(m.n) || 0 }))
                      .sort((a, b) => b.total - a.total);
                    const horas = Array.from({ length: 24 }, (_, h) => Number(dd?.horas?.[h]) || 0);
                    const mixtoEfectivo = Number(dd?.mixto_efectivo) || 0;
                    const mixtoOtro = Number(dd?.mixto_otro) || 0;
                    const horasConVentas = horas.map((t, h) => (t > 0 ? h : -1)).filter((h) => h >= 0);
                    const desdeHora = horasConVentas.length ? Math.min(8, horasConVentas[0]) : 8;
                    const hastaHora = horasConVentas.length ? Math.max(21, horasConVentas[horasConVentas.length - 1]) : 21;
                    const rangoHoras = horas.slice(desdeHora, hastaHora + 1).map((t, i) => ({ hora: desdeHora + i, total: t }));
                    const maxH = Math.max(0, ...rangoHoras.map((h) => h.total));
                    const pico = maxH > 0 ? rangoHoras.find((h) => h.total === maxH).hora : null;
                    const titulo = new Date(ver.anio, ver.mes, selDia).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '').replace(/^./, (c) => c.toUpperCase());
                    return { total, n: Number(dd?.n) || 0, medios, mixtoEfectivo, mixtoOtro, rangoHoras, maxH, pico, titulo };
                  })();
                  const irDia = (d) => { if (d >= 1 && d <= hastaDia) setDiaCalendarioSel(clave(d)); };
                  return (
                    <>
                    <section className="dsh-card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-stone-800">Ventas por día</h4>
                          <p className="text-xs text-stone-500 mt-0.5">Toca un día para ver el detalle</p>
                        </div>
                        <p className="text-xs text-stone-500 sm:text-right">Total del mes<br /><span className="text-sm font-semibold text-stone-900 tabular-nums">S/ {formatoSoles(totalMes)}</span></p>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                        <div className={`${tarjeta} bg-white/80`}>
                          <p className="text-[11px] text-stone-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-stone-400"></span>Promedio diario</p>
                          <p className="text-lg font-semibold text-stone-900 mt-1 tabular-nums whitespace-nowrap truncate">{conVentas.length ? montoResumen(promedio) : '—'}</p>
                          <p className="text-[11px] text-stone-500">en {hastaDia} día{hastaDia === 1 ? '' : 's'} transcurrido{hastaDia === 1 ? '' : 's'}</p>
                        </div>
                        <div className={`${tarjeta} bg-[#EBF0FF] border border-[#c5bcff]`}>
                          <p className="text-[11px] text-stone-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#9687F5]"></span>Día de mayor venta</p>
                          <p className="text-lg font-semibold text-stone-900 mt-1 tabular-nums whitespace-nowrap truncate">{conVentas.length ? montoResumen(totalDe(diaMax)) : '—'}</p>
                          <p className="text-[11px] text-stone-500 truncate">{conVentas.length ? `${nombreDia(diaMax)} · ${(totalDe(diaMax) / promedio).toFixed(1).replace('.', ',')}× el promedio` : 'Sin ventas'}</p>
                        </div>
                        <div className={`${tarjeta} bg-white/80`}>
                          <p className="text-[11px] text-stone-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Día de menor venta</p>
                          <p className="text-lg font-semibold text-rose-600 mt-1 tabular-nums whitespace-nowrap truncate">{conVentas.length ? montoResumen(totalDe(diaMin)) : '—'}</p>
                          <p className="text-[11px] text-stone-500 truncate">{conVentas.length ? `${nombreDia(diaMin)} · ${Math.round((totalDe(diaMin) / promedio) * 100)}% del promedio` : 'Sin ventas'}</p>
                        </div>
                        <div className={`${tarjeta} bg-white/80`}>
                          <p className="text-[11px] text-stone-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-stone-300"></span>Días sin ventas</p>
                          <p className="text-lg font-semibold text-stone-900 mt-1 tabular-nums">{sinVentas}</p>
                          <p className="text-[11px] text-stone-500 truncate">{sinVentas ? 'Revisa si el local abrió' : hastaDia ? 'Vendiste todos los días' : '—'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-5">
                        <button
                          onClick={() => setMesCalendario({ anio: ver.anio, mes: ver.mes - 1 })}
                          disabled={!puedeAnterior}
                          className="w-7 h-7 rounded-full border border-stone-200 bg-white text-stone-500 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                          aria-label="Mes anterior"
                        ><i className="fa-solid fa-chevron-left text-[10px]"></i></button>
                        <span className="text-[15px] font-semibold text-stone-900 min-w-[8.5rem] text-center">{nombreMes}</span>
                        <button
                          onClick={() => setMesCalendario({ anio: ver.anio, mes: ver.mes + 1 })}
                          disabled={!puedeSiguiente}
                          className="w-7 h-7 rounded-full border border-stone-200 bg-white text-stone-500 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                          aria-label="Mes siguiente"
                        ><i className="fa-solid fa-chevron-right text-[10px]"></i></button>
                      </div>

                      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1.5 sm:gap-2.5 mt-4">
                        {['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => (
                          <div key={d} className="text-[10px] uppercase tracking-wider text-stone-400 text-center pb-0.5">{d}</div>
                        ))}
                        {celdas.map((d, i) => {
                          if (d === null) return <div key={`v${i}`}></div>;
                          const futuro = d > hastaDia;
                          if (futuro) {
                            return (
                              <div key={d} className="rounded-[14px] sm:rounded-2xl aspect-square sm:aspect-[5/4] min-w-0 p-2 lg:p-3 flex flex-col items-center justify-center sm:items-stretch sm:justify-between sm:border sm:border-dashed sm:border-stone-200 text-stone-300">
                                <span className="text-[13px] sm:text-sm font-semibold">{d}</span>
                                <span className="hidden sm:block text-[11px] md:text-sm lg:text-base text-right">—</span>
                              </div>
                            );
                          }
                          const v = totalDe(d);
                          const t = maxDia ? v / maxDia : 0;
                          const esMax = conVentas.length > 0 && d === diaMax;
                          const esMin = conVentas.length > 1 && d === diaMin;
                          const oscuro = esMax || t > 0.55;
                          const enRango = clave(d) >= fechaInicioDash && clave(d) <= fechaFinDash;
                          const esHoy = cmpMes === 0 && d === dHoy;
                          return (
                            <button
                              type="button"
                              key={d}
                              onClick={() => setDiaCalendarioSel(clave(d))}
                              title={`${nombreDia(d)}: S/ ${formatoSoles(v)}`}
                              className={`relative rounded-[14px] sm:rounded-2xl aspect-square sm:aspect-[5/4] min-w-0 p-2 lg:p-3 flex flex-col items-center justify-center sm:items-stretch sm:justify-between overflow-hidden active:scale-95 transition-transform ${selDia === d ? 'outline outline-[2.5px] outline-offset-2 outline-stone-900' : ''} ${enRango ? 'ring-2 ring-inset ring-[#9687F5]' : ''} ${esMax ? 'shadow-[0_10px_22px_-8px_rgba(150,135,245,0.55)]' : ''} ${oscuro ? 'text-white' : 'text-stone-800'}`}
                              style={{ background: esMax ? 'linear-gradient(160deg,#c5bcff,#9687F5)' : v > 0 ? `rgba(150,135,245,${(0.06 + t * 0.5).toFixed(2)})` : '#e6ebfb' }}
                            >
                              <span className="text-[13px] sm:text-sm font-bold sm:font-semibold sm:opacity-80">
                                {d}
                                {esMax && <span className="absolute top-1 right-1.5 text-[8px] leading-none sm:static sm:text-[9px] sm:ml-1">▲</span>}
                                {esMin && <span className={`absolute top-1 right-1.5 text-[8px] leading-none sm:static sm:text-[9px] sm:ml-1 ${oscuro ? 'text-rose-200' : 'text-rose-600'}`}>▼</span>}
                              </span>
                              <span className="hidden sm:block text-[11px] md:text-sm lg:text-base font-semibold text-right tabular-nums whitespace-nowrap">{v > 0 ? `S/ ${montoCorto(v)}` : '—'}</span>
                              {esHoy && <span className={`absolute bottom-1.5 left-1/2 -ml-[2px] w-1 h-1 sm:bottom-auto sm:left-auto sm:ml-0 sm:top-2 sm:right-2 sm:w-1.5 sm:h-1.5 rounded-full ${esMax || oscuro ? 'bg-white' : 'bg-[#9687F5]'}`}></span>}
                            </button>
                          );
                        })}
                      </div>

                      {semanasVisibles.length > 0 && (
                        <>
                          <div className="flex items-baseline justify-between mt-6 pt-5 border-t border-stone-200/70 mb-2.5">
                            <h5 className="text-[13px] font-semibold text-stone-800">Total por semana</h5>
                            <span className="text-[11px] text-stone-500 hidden sm:inline">La barra compara cada semana con la mejor del mes</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                            {semanasVisibles.map((s) => (
                              <div key={s.i} title={`Semana ${s.i + 1}: S/ ${formatoSoles(s.total)}`} className={`rounded-2xl p-4 flex flex-col gap-2 min-w-0 border ${s.total === maxSemana ? 'bg-[#EBF0FF] border-[#c5bcff]' : 'bg-white/70 border-stone-200/70'}`}>
                                <div className="flex justify-between items-baseline gap-1.5 text-[11px] text-stone-500">
                                  <span>Semana {s.i + 1}</span><span className="text-[10px]">{s.n} d.</span>
                                </div>
                                <p className="text-lg font-semibold text-stone-900 tabular-nums whitespace-nowrap">{montoResumen(s.total)}</p>
                                <div className="h-2 rounded-full bg-stone-200/70 overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-[#c5bcff] to-[#9687F5]" style={{ width: `${(s.total / maxSemana) * 100}%` }}></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-[11px] text-stone-500">
                        <span className="inline-flex items-center gap-1.5"><i className="inline-block w-7 h-2 rounded-full bg-gradient-to-r from-[#EBF0FF] to-[#9687F5]"></i>Menos → más ventas</span>
                        <span>▲ Mejor día</span>
                        <span className="text-rose-600">▼ Día más flojo</span>
                        <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3.5 h-3.5 rounded-[5px] ring-2 ring-inset ring-[#9687F5]"></i>Rango elegido</span>
                        <span>● Hoy</span>
                      </div>
                    </section>

                    {detalleDia && (
                      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-[#1c1830]/45 backdrop-blur-[3px]" onClick={() => setDiaCalendarioSel(null)}>
                        <div
                          role="dialog"
                          aria-modal="true"
                          onClick={(e) => e.stopPropagation()}
                          className="kd-hoja w-full sm:max-w-md max-h-[88vh] overflow-y-auto hide-scrollbar bg-white rounded-t-[28px] sm:rounded-[28px] px-[18px] pt-2.5 pb-6 flex flex-col gap-3 shadow-2xl"
                        >
                          <div className="w-[38px] h-1 rounded bg-[#dde4fa] mx-auto shrink-0 sm:hidden"></div>
                          <div className="flex items-center justify-between shrink-0">
                            <button onClick={() => irDia(selDia - 1)} disabled={selDia <= 1} aria-label="Día anterior" className="w-[34px] h-[34px] rounded-full bg-white ring-1 ring-[#dde4fa] text-[#2D284B] flex items-center justify-center disabled:opacity-30">
                              <i className="fa-solid fa-chevron-left text-xs"></i>
                            </button>
                            <p className="text-xs font-bold text-[#6b6890]">{detalleDia.titulo}</p>
                            <button onClick={() => irDia(selDia + 1)} disabled={selDia >= hastaDia} aria-label="Día siguiente" className="w-[34px] h-[34px] rounded-full bg-white ring-1 ring-[#dde4fa] text-[#2D284B] flex items-center justify-center disabled:opacity-30">
                              <i className="fa-solid fa-chevron-right text-xs"></i>
                            </button>
                          </div>

                          <div className="text-center flex flex-col items-center gap-1.5 shrink-0">
                            <p className={`text-4xl font-medium tracking-tight tabular-nums leading-none ${detalleDia.total > 0 ? 'text-stone-900' : 'text-[#a9a4c0]'}`}>S/ {formatoSoles(detalleDia.total)}</p>
                            <div className="flex flex-wrap justify-center gap-1.5">
                              {conVentas.length > 0 && selDia === diaMax && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-[#dde4fa] text-[#2D284B]"><i className="fa-solid fa-arrow-up text-[9px]"></i>Mejor día del mes</span>
                              )}
                              {conVentas.length > 1 && selDia === diaMin && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600"><i className="fa-solid fa-arrow-down text-[9px]"></i>Día más flojo</span>
                              )}
                              {detalleDia.total === 0 && (
                                <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-[#e6ebfb] text-[#6b6890]">Sin ventas</span>
                              )}
                            </div>
                            <p className="text-xs text-[#6b6890]">
                              {detalleDia.total > 0 && promedio > 0
                                ? `${(detalleDia.total / promedio).toFixed(1).replace('.', ',')}× el promedio diario`
                                : detalleDia.total > 0 ? '' : 'Ningún movimiento registrado'}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 shrink-0">
                            <div className="bg-[#EBF0FF] rounded-2xl px-3 py-2.5">
                              <p className="text-[10.5px] text-[#6b6890]">Ventas</p>
                              <p className="text-[15px] font-bold tabular-nums">{detalleDia.n}</p>
                            </div>
                            <div className="bg-[#EBF0FF] rounded-2xl px-3 py-2.5">
                              <p className="text-[10.5px] text-[#6b6890]">Ticket promedio</p>
                              <p className="text-[15px] font-bold tabular-nums">{detalleDia.n ? `S/ ${formatoSoles(detalleDia.total / detalleDia.n)}` : '—'}</p>
                            </div>
                          </div>

                          {detalleDia.n > 0 && (
                            <>
                              <div className="grid grid-cols-2 bg-[#e6ebfb] rounded-full p-[3px] shrink-0">
                                {[['pagos', 'Pagos'], ['horas', 'Por hora']].map(([id, texto]) => (
                                  <button
                                    key={id}
                                    onClick={() => setPestanaDiaCal(id)}
                                    className={`h-[34px] rounded-full text-[12.5px] font-bold transition ${pestanaDiaCal === id ? 'bg-white text-[#2D284B] shadow-[0_1px_4px_rgba(28,24,48,0.12)]' : 'text-[#6b6890]'}`}
                                  >
                                    {texto}
                                  </button>
                                ))}
                              </div>

                              {pestanaDiaCal === 'pagos' ? (
                                <>
                                  <div className="flex h-2.5 rounded-full overflow-hidden bg-[#e6ebfb] gap-0.5 shrink-0">
                                    {detalleDia.medios.map((m) => (
                                      <div key={m.medio} title={NOMBRE_MEDIO_DIA(m.medio)} style={{ width: `${(m.total / detalleDia.total) * 100}%`, background: COLOR_MEDIO_PAGO[m.medio] || '#d6d3d1' }}></div>
                                    ))}
                                  </div>
                                  <ul className="flex flex-col gap-1.5 shrink-0">
                                    {detalleDia.medios.map((m) => (
                                      <li key={m.medio} className="flex items-center gap-2.5 bg-[#EBF0FF] rounded-2xl px-3 py-2.5 text-[13px]">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR_MEDIO_PAGO[m.medio] || '#d6d3d1' }}></span>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-bold text-stone-800">{NOMBRE_MEDIO_DIA(m.medio)}</p>
                                          <p className="text-[10.5px] text-[#6b6890] truncate">
                                            {m.medio === 'MIXTO' && detalleDia.mixtoEfectivo + detalleDia.mixtoOtro > 0
                                              ? `Efectivo S/ ${formatoSoles(detalleDia.mixtoEfectivo)} + otro S/ ${formatoSoles(detalleDia.mixtoOtro)}`
                                              : `${m.n} venta${m.n === 1 ? '' : 's'}`}
                                          </p>
                                        </div>
                                        <span className="font-extrabold tabular-nums">S/ {formatoSoles(m.total)}</span>
                                        <span className="w-9 text-right text-[11.5px] text-[#6b6890] tabular-nums">{Math.round((m.total / detalleDia.total) * 100)}%</span>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-baseline justify-between shrink-0">
                                    <span className="text-xs font-bold text-stone-800">Ventas por hora</span>
                                    {detalleDia.pico != null && <span className="text-[11px] font-semibold text-[#6b6890]">Hora pico {String(detalleDia.pico).padStart(2, '0')}:00</span>}
                                  </div>
                                  <div className="flex items-end gap-[3px] h-16 shrink-0">
                                    {detalleDia.rangoHoras.map((h) => (
                                      <div
                                        key={h.hora}
                                        title={`${String(h.hora).padStart(2, '0')}:00 · S/ ${formatoSoles(h.total)}`}
                                        className={`flex-1 rounded-t-md rounded-b-sm ${h.total > 0 && h.hora === detalleDia.pico ? 'bg-gradient-to-t from-[#9687F5] to-[#c5bcff]' : 'bg-[#dde4fa]'}`}
                                        style={{ height: `${h.total > 0 ? Math.max(8, (h.total / detalleDia.maxH) * 100) : 4}%` }}
                                      ></div>
                                    ))}
                                  </div>
                                  <div className="flex gap-[3px] text-[9.5px] text-[#a8a3c2] shrink-0">
                                    {detalleDia.rangoHoras.map((h) => (
                                      <span key={h.hora} className="flex-1 text-center whitespace-nowrap">{h.hora % 3 === 0 ? `${h.hora}h` : ''}</span>
                                    ))}
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    </>
                  );
                })()}

                {/* Ventas por Mes */}
                {dashStats.totalAnio > 0 && (
                  <section className="dsh-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-stone-800">Ventas por mes · {dashStats.anioActual}</h4>
                        <p className="text-xs text-stone-500 mt-0.5">Acumulado del año <span className="font-semibold text-stone-800 tabular-nums">S/ {formatoSoles(dashStats.totalAnio)}</span></p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-[#dde4fa] text-[#2D284B] text-[11px] font-semibold px-3 py-1 rounded-full">Mejor mes: {MESES_CORTOS[dashStats.mesPico.mes]} · S/ {formatoSoles(dashStats.mesPico.total)}</span>
                        <span className="bg-white/80 text-stone-600 text-[11px] font-semibold px-3 py-1 rounded-full shadow-sm">Promedio: S/ {formatoSoles(dashStats.promedioMensual)}</span>
                        {dashStats.hayBaseMesAnterior && (
                          <span className="bg-white/80 text-[11px] px-3 py-1 rounded-full shadow-sm inline-flex items-center gap-1.5 text-stone-500">
                            vs mes anterior <VariacionPct pct={dashStats.cambioMesPct} corto />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-1.5 sm:gap-2.5 items-end h-48 pt-6 mt-4">
                      {dashStats.porMes.map((m, i) => {
                        const esPico = m.total > 0 && m.mes === dashStats.mesPico.mes;
                        const esActual = m.mes === dashStats.mesActualIdx;
                        return (
                          <div
                            key={m.mes}
                            className="flex flex-col items-center h-full justify-end group"
                            onMouseEnter={() => setMesResaltado(i)}
                            onMouseLeave={() => setMesResaltado((cur) => (cur === i ? null : cur))}
                            onFocus={() => setMesResaltado(i)}
                            onBlur={() => setMesResaltado((cur) => (cur === i ? null : cur))}
                            tabIndex={m.total > 0 ? 0 : -1}
                          >
                            <span className={`text-[9px] sm:text-[10px] font-semibold mb-1 tabular-nums transition-opacity ${mesResaltado === i || esPico ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${esPico ? 'text-[#5b4bd6]' : 'text-stone-500'}`}>
                              {m.total >= 1000 ? `${(m.total / 1000).toFixed(1)}k` : m.total.toFixed(0)}
                            </span>
                            <div
                              className={`w-full max-w-[34px] rounded-t-xl rounded-b-md transition-colors duration-200 ${esPico ? 'bg-gradient-to-t from-[#9687F5] to-[#c5bcff] shadow-[0_10px_24px_-8px_rgba(150,135,245,0.55)]' : mesResaltado === i ? 'bg-[#c5bcff]' : 'bg-white group-hover:bg-[#dde4fa]'}`}
                              style={{ height: `${Math.max(3, (m.total / dashStats.maxMes) * 100)}%` }}
                            ></div>
                            <span className={`text-[10px] sm:text-[11px] mt-2 ${esPico ? 'font-bold text-[#5b4bd6]' : esActual ? 'font-bold text-stone-800' : 'font-medium text-stone-500'}`}>{MESES_CORTOS[m.mes]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Deudas: no dependen del rango de fechas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <section className="dsh-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-stone-800">Fiados</h4>
                        <p className={`text-2xl font-medium tracking-tight tabular-nums mt-1.5 ${dashStats.totalDeuda > 0 ? 'text-rose-600' : 'text-stone-900'}`}>S/ {formatoSoles(dashStats.totalDeuda)}</p>
                      </div>
                      <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${dashStats.numDeudores > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {dashStats.numDeudores > 0 ? `${dashStats.numDeudores} cliente${dashStats.numDeudores === 1 ? '' : 's'}` : 'Al día'}
                      </span>
                    </div>
                    {dashStats.numDeudores === 0 ? (
                      <p className="text-xs text-stone-500 mt-3">Ningún cliente tiene deuda pendiente.</p>
                    ) : (
                      <ul className="space-y-2 mt-4 max-h-48 overflow-y-auto hide-scrollbar">
                        {clientesDeuda.map((c, i) => (
                          <li key={c.dni + i} className="bg-white/80 rounded-2xl px-3.5 py-2.5 shadow-sm">
                            <div className="flex justify-between items-baseline gap-3 text-sm">
                              <span className="text-stone-800 truncate">{c.nombre_completo || c.dni}</span>
                              <span className="font-semibold text-stone-900 tabular-nums shrink-0">S/ {formatoSoles(c.saldo_actual)}</span>
                            </div>
                            <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden mt-1.5">
                              <div className="h-full bg-rose-400 rounded-full" style={{ width: `${(Number(c.saldo_actual) / dashStats.maxDeuda) * 100}%` }}></div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="dsh-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-stone-800">Cuentas por pagar</h4>
                        <p className="text-2xl font-medium tracking-tight tabular-nums mt-1.5 text-stone-900">S/ {formatoSoles(dashStats.totalPorPagar)}</p>
                      </div>
                      <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${dashStats.numProveedoresDeuda > 0 ? 'bg-[#dde4fa] text-[#2D284B]' : 'bg-emerald-50 text-emerald-600'}`}>
                        {dashStats.numProveedoresDeuda > 0 ? `${dashStats.numProveedoresDeuda} proveedor${dashStats.numProveedoresDeuda === 1 ? '' : 'es'}` : 'Al día'}
                      </span>
                    </div>
                    {dashStats.numProveedoresDeuda === 0 ? (
                      <p className="text-xs text-stone-500 mt-3">No le debes a ningún proveedor.</p>
                    ) : (
                      <ul className="space-y-2 mt-4 max-h-48 overflow-y-auto hide-scrollbar">
                        {proveedoresDeudaDash.map((p, i) => (
                          <li key={p.nombre + i} className="bg-white/80 rounded-2xl px-3.5 py-2.5 shadow-sm">
                            <div className="flex justify-between items-baseline gap-3 text-sm">
                              <span className="text-stone-800 truncate">{p.nombre}</span>
                              <span className="font-semibold text-stone-900 tabular-nums shrink-0">S/ {formatoSoles(p.saldo_actual)}</span>
                            </div>
                            <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden mt-1.5">
                              <div className="h-full bg-gradient-to-r from-[#c5bcff] to-[#9687F5] rounded-full" style={{ width: `${(Number(p.saldo_actual) / dashStats.maxPorPagar) * 100}%` }}></div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
  );
}
