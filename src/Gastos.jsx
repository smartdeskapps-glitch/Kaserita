import React from 'react';
import { dinero } from './lib/dinero.js';
import { fechaHoyISO, fechaISOLocal } from './lib/fechas.js';
import { generarUUID, mensajeError, zonaLocal } from './pos/utilidades.js';
import VentanaModulo from './VentanaModulo.jsx';

// Registro de gastos del negocio (alquiler, luz, sueldos...). Con esto el dueño ve cuánto
// le queda de verdad: utilidad de las ventas del mes menos lo que gastó. Carga y guarda
// sus propios datos (tabla `gastos`, ver gastos.sql); desde PosApp solo recibe lo básico.
// La mercadería no es una categoría: ya se descuenta en el costo de cada venta.
// Los estilos de movimiento (gst-*) están en src/index.css.

const CATEGORIAS = ['Alquiler', 'Luz, agua e internet', 'Sueldos', 'Transporte', 'Impuestos', 'Publicidad', 'Mantenimiento', 'Otros'];
const ATAJOS_MONTO = [10, 50, 100];
const MS_SALIDA_FILA = 190;
const MS_CAMBIO_MES = 140;

const pad = (n) => String(n).padStart(2, '0');
const hoyISO = () => fechaHoyISO();
const ayerISO = () => fechaISOLocal(new Date(Date.now() - 86400000));
const mesDe = (iso) => ({ anio: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) - 1 });
const rangoMes = ({ anio, mes }) => ({
  desde: `${anio}-${pad(mes + 1)}-01`,
  hasta: `${anio}-${pad(mes + 1)}-${pad(new Date(anio, mes + 1, 0).getDate())}`,
});
const tituloDia = (iso) => {
  const t = new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Barra que crece desde la izquierda con transform (no width) y arranca vacía al aparecer.
function Barra({ valor, className }) {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    const r = requestAnimationFrame(() => setW(valor));
    return () => cancelAnimationFrame(r);
  }, [valor]);
  return <i className={`gst-barra block h-full rounded-full ${className}`} style={{ transform: `scaleX(${w})` }} />;
}

export default function Gastos({ bodegaId, cajeroId, esModoDemo, notificar, onClose, sbClient }) {
  const [mes, setMes] = React.useState(() => mesDe(hoyISO()));
  const [gastos, setGastos] = React.useState([]);
  const [cargando, setCargando] = React.useState(true);
  const [cambiando, setCambiando] = React.useState(false);
  const [utilidad, setUtilidad] = React.useState(null);
  const [guardando, setGuardando] = React.useState(false);
  const [registrado, setRegistrado] = React.useState(false);
  const [borrando, setBorrando] = React.useState(null);
  const [saliendo, setSaliendo] = React.useState(null);
  const [nuevoId, setNuevoId] = React.useState(null);
  const [fechaModo, setFechaModo] = React.useState('hoy');
  const [form, setForm] = React.useState({ monto: '', categoria: '', descripcion: '', fecha: hoyISO() });
  const refMonto = React.useRef(null);
  const refOtros = React.useRef(null);

  const { desde, hasta } = rangoMes(mes);
  const hoy = hoyISO();
  const mesActual = mesDe(hoy);
  const esMesActual = mes.anio === mesActual.anio && mes.mes === mesActual.mes;
  const esOtros = form.categoria === 'Otros';

  React.useEffect(() => {
    let vigente = true;
    setCargando(true);
    setBorrando(null);
    if (esModoDemo || !sbClient || !bodegaId) {
      setCargando(false);
      setCambiando(false);
      setUtilidad(null);
      return undefined;
    }
    (async () => {
      try {
        const [resGastos, resResumen] = await Promise.all([
          sbClient.from('gastos').select('*').eq('bodega_id', bodegaId).gte('fecha', desde).lte('fecha', hasta)
            .order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(1000),
          sbClient.rpc('dashboard_resumen_periodo', { p_bodega_id: bodegaId, p_desde: desde, p_hasta: hasta, p_zona: zonaLocal() }),
        ]);
        if (!vigente) return;
        if (resGastos.error) throw resGastos.error;
        setGastos(resGastos.data || []);
        const u = resResumen.data && typeof resResumen.data === 'object' ? Number(resResumen.data.utilidad) : NaN;
        setUtilidad(Number.isFinite(u) ? u : null);
      } catch (err) {
        if (!vigente) return;
        console.warn(err);
        notificar(mensajeError(err, 'No se pudieron cargar los gastos'), 'error');
      } finally {
        if (vigente) { setCargando(false); setCambiando(false); }
      }
    })();
    return () => { vigente = false; };
  }, [desde, hasta, bodegaId]); // eslint-disable-line

  const total = gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const deHoy = gastos.filter((g) => g.fecha === hoy).reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const queda = utilidad == null ? null : utilidad - total;
  const pctUtilidad = utilidad > 0 ? Math.min(1, total / utilidad) : 0;

  const porCategoria = React.useMemo(() => {
    const m = new Map();
    gastos.forEach((g) => m.set(g.categoria, (m.get(g.categoria) || 0) + (Number(g.monto) || 0)));
    return [...m.entries()].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto);
  }, [gastos]);

  const porDia = React.useMemo(() => {
    const m = new Map();
    gastos.forEach((g) => { const l = m.get(g.fecha) || []; l.push(g); m.set(g.fecha, l); });
    return [...m.entries()].map(([dia, items]) => ({ dia, items, total: items.reduce((s, g) => s + (Number(g.monto) || 0), 0) }));
  }, [gastos]);

  const montoNum = parseFloat(form.monto) || 0;
  const puedeGuardar = montoNum > 0 && !!form.categoria && (!esOtros || !!form.descripcion.trim()) && !guardando;

  const elegirCategoria = (c) => {
    // El texto de «Otros» (qué gasto es) y el detalle opcional no se mezclan al cambiar de uno a otro.
    setForm((f) => ({ ...f, categoria: c, descripcion: (c === 'Otros') !== (f.categoria === 'Otros') ? '' : f.descripcion }));
    if (c === 'Otros') setTimeout(() => refOtros.current?.focus({ preventScroll: true }), 120);
  };
  const sumarMonto = (n) => {
    setForm((f) => ({ ...f, monto: n === 0 ? '' : String(Math.round(((parseFloat(f.monto) || 0) + n) * 100) / 100) }));
    refMonto.current?.focus({ preventScroll: true });
  };
  const elegirFecha = (modo) => {
    setFechaModo(modo);
    setForm((f) => ({ ...f, fecha: modo === 'hoy' ? hoy : modo === 'ayer' ? ayerISO() : (f.fecha || hoy) }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    const monto = Math.round((parseFloat(form.monto) || 0) * 100) / 100;
    if (monto <= 0) { notificar('Ingresa el monto del gasto.', 'error'); return; }
    if (!form.categoria) { notificar('Elige la categoría del gasto.', 'error'); return; }
    if (esOtros && !form.descripcion.trim()) { notificar('Escribe qué gasto es.', 'error'); return; }
    if (!form.fecha || form.fecha > hoy) { notificar('La fecha no puede ser futura.', 'error'); return; }
    const fila = {
      bodega_id: bodegaId,
      fecha: form.fecha,
      monto,
      categoria: form.categoria,
      descripcion: form.descripcion.trim() || null,
      cajero_id: cajeroId || null,
    };
    setGuardando(true);
    try {
      let guardado = { ...fila, id: generarUUID(), creado_en: new Date().toISOString() };
      if (!esModoDemo && sbClient) {
        const { data, error } = await sbClient.from('gastos').insert([fila]).select().single();
        if (error) throw error;
        guardado = data;
      }
      const enMes = form.fecha >= desde && form.fecha <= hasta;
      if (enMes) {
        setGastos((prev) => ordenar([guardado, ...prev]));
        setNuevoId(guardado.id);
      }
      // Se conservan categoría y fecha (se suelen anotar varios seguidos) y el foco vuelve al monto.
      setForm((f) => ({ ...f, monto: '', descripcion: '' }));
      setRegistrado(true);
      setTimeout(() => setRegistrado(false), 1100);
      notificar(`Gasto de ${dinero(monto)} registrado.`, 'success');
      refMonto.current?.focus({ preventScroll: true });
      // Si se anotó en otro mes, se muestra ese mes para que el dueño lo vea.
      if (!enMes) setMes(mesDe(form.fecha));
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo registrar el gasto'), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (g) => {
    try {
      if (!esModoDemo && sbClient) {
        const { error } = await sbClient.from('gastos').delete().eq('id', g.id).eq('bodega_id', bodegaId);
        if (error) throw error;
      }
      setBorrando(null);
      setSaliendo(g.id);
      // La fila colapsa (más rápido de lo que entró) y recién después sale de la lista.
      setTimeout(() => {
        setGastos((prev) => prev.filter((x) => x.id !== g.id));
        setSaliendo(null);
      }, MS_SALIDA_FILA);
      notificar('Gasto eliminado.', 'success');
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo eliminar el gasto'), 'error');
    }
  };

  const nombreMes = (() => {
    const t = new Date(mes.anio, mes.mes, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();
  // Fundido corto: se usa seguido, no merece una animación larga. El panel queda atenuado hasta que llegan los datos.
  const cambiarMes = (delta) => {
    if (cambiando) return;
    setCambiando(true);
    setNuevoId(null);
    setTimeout(() => {
      const d = new Date(mes.anio, mes.mes + delta, 1);
      setMes({ anio: d.getFullYear(), mes: d.getMonth() });
    }, MS_CAMBIO_MES);
  };
  const maxCategoria = Math.max(1, ...porCategoria.map((c) => c.monto));
  const campo = 'w-full h-11 rounded-[14px] bg-white px-3.5 text-sm text-[#2d284b] placeholder:text-[#9290a2] outline-none focus:ring-2 focus:ring-[#5b4bd6]/40 transition-shadow';

  return (
    <VentanaModulo
      icono="fa-wallet"
      titulo="Gastos del negocio"
      tituloCorto="Gastos"
      subtitulo="Anota lo que gastas para ver cuánto te queda"
      cifras={[
        { etiqueta: esMesActual ? 'Gastos del mes' : `Gastos de ${nombreMes}`, valor: dinero(total), tono: total > 0 ? 'mal' : undefined },
        esMesActual && { etiqueta: 'Gastos de hoy', valor: dinero(deHoy) },
        queda != null && { etiqueta: 'Te queda', valor: dinero(queda), tono: queda >= 0 ? 'ok' : 'mal' },
      ]}
      onClose={onClose}
      ancho="max-w-2xl lg:max-w-4xl"
      desplazable={false}
    >
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[340px_minmax(0,1fr)] hide-scrollbar">
        {/* Izquierda: formulario y cuánto queda */}
        <div className="p-4 sm:p-6 lg:overflow-y-auto hide-scrollbar space-y-4 lg:border-r border-[#eef1fd]">
          <form onSubmit={guardar} className="rounded-[20px] bg-[#f3f5ff] p-4 space-y-3.5" autoComplete="off">
            <div>
              <label htmlFor="gasto-monto" className="text-[13px] font-bold text-[#2d284b]">Monto</label>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[13px] font-semibold text-[#6b6890]">S/</span>
                <input
                  id="gasto-monto"
                  ref={refMonto}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.monto}
                  onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Escape' && form.monto) { e.stopPropagation(); setForm((f) => ({ ...f, monto: '' })); } }}
                  className="flex-1 min-w-0 h-12 rounded-[14px] bg-white px-3.5 text-2xl font-light tabular-nums text-[#2d284b] outline-none focus:ring-2 focus:ring-[#5b4bd6]/40 transition-shadow [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="flex gap-1.5 mt-2" role="group" aria-label="Montos frecuentes">
                {ATAJOS_MONTO.map((n) => (
                  <button key={n} type="button" onClick={() => sumarMonto(n)} className="gst-press gst-hv h-[30px] px-3 rounded-full bg-white text-[#6b6890] text-xs font-bold">+{n}</button>
                ))}
                <button type="button" onClick={() => sumarMonto(0)} className="gst-press gst-hv h-[30px] px-3 rounded-full bg-white text-[#6b6890] text-xs font-bold">Borrar</button>
              </div>
            </div>

            <div>
              <p className="text-[13px] font-bold text-[#2d284b] mb-2">Categoría</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categoría">
                {CATEGORIAS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={form.categoria === c}
                    onClick={() => elegirCategoria(c)}
                    className={`gst-press gst-hv h-9 px-3.5 rounded-full text-[12.5px] font-bold ${form.categoria === c ? 'bg-[#2d284b] text-white' : 'bg-white text-[#6b6890]'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className={`gst-otros ${esOtros ? 'abierto' : ''}`} aria-hidden={!esOtros}>
                <div className="-mx-1 px-1 pb-1">
                  <input
                    ref={refOtros}
                    type="text"
                    maxLength={80}
                    tabIndex={esOtros ? 0 : -1}
                    aria-label="¿Qué gasto es?"
                    placeholder="¿Qué gasto es? Ej: reparación de la refrigeradora"
                    value={esOtros ? form.descripcion : ''}
                    onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                    className={`${campo} mt-2`}
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#8f8cb0] mt-2 leading-snug">La mercadería no se anota aquí: ya se descuenta en el costo de tus ventas.</p>
            </div>

            <div className={`gst-otros ${esOtros ? '' : 'abierto'}`} aria-hidden={esOtros}>
              <div className="-mx-1 px-1 pb-1">
                <label htmlFor="gasto-desc" className="text-[13px] font-bold text-[#2d284b] block">Detalle <span className="font-medium text-[#8f8cb0]">(opcional)</span></label>
                <input
                  id="gasto-desc"
                  type="text"
                  maxLength={80}
                  tabIndex={esOtros ? -1 : 0}
                  placeholder="Ej: recibo de luz"
                  value={esOtros ? '' : form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className={`${campo} mt-2`}
                />
              </div>
            </div>

            <div>
              <p className="text-[13px] font-bold text-[#2d284b]">Fecha</p>
              <div className="flex items-center gap-1.5 mt-2" role="group" aria-label="Fecha del gasto">
                {[['hoy', 'Hoy'], ['ayer', 'Ayer'], ['otra', 'Otra fecha']].map(([modo, texto]) => (
                  <button
                    key={modo}
                    type="button"
                    aria-pressed={fechaModo === modo}
                    onClick={() => elegirFecha(modo)}
                    className={`gst-press gst-hv h-11 px-3.5 rounded-full text-[12.5px] font-bold ${fechaModo === modo ? 'bg-[#2d284b] text-white' : 'bg-white text-[#6b6890]'}`}
                  >
                    {texto}
                  </button>
                ))}
                <input
                  type="date"
                  max={hoy}
                  aria-label="Fecha del gasto"
                  tabIndex={fechaModo === 'otra' ? 0 : -1}
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  className={`gst-fecha ${fechaModo === 'otra' ? 'abierto' : ''} h-11 rounded-[14px] bg-white text-sm text-[#2d284b] outline-none focus:ring-2 focus:ring-[#5b4bd6]/40 min-w-0`}
                />
              </div>
            </div>

            <button type="submit" disabled={!puedeGuardar} className="gst-press kz-pri w-full h-12 text-[14px] font-bold inline-flex items-center justify-center gap-2">
              <i className="fa-solid fa-check text-[12px]"></i>{guardando ? 'Guardando...' : registrado ? 'Registrado' : 'Registrar gasto'}
            </button>
          </form>

          <section className="rounded-[20px] border border-[#dde4fa] p-4">
            <h4 className="text-[13px] font-bold text-[#2d284b]">Cuánto te queda · {nombreMes}</h4>
            {utilidad == null ? (
              <p className="text-xs text-[#8f8cb0] mt-2">{esModoDemo ? 'En el modo demo no se calcula con tus ventas reales.' : 'No se pudo calcular la utilidad de este mes.'}</p>
            ) : (
              <>
                <dl className="mt-3 space-y-2 text-[13px]">
                  <div className="flex justify-between gap-3"><dt className="text-[#6b6890]">Utilidad de ventas</dt><dd className="font-semibold tabular-nums text-[#2d284b]">{dinero(utilidad)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-[#6b6890]">Gastos</dt><dd key={total} className="gst-bump font-semibold tabular-nums text-[#c0262d]">− {dinero(total)}</dd></div>
                  <div className="flex justify-between gap-3 pt-2.5 border-t border-[#dde4fa]">
                    <dt className="font-bold text-[#2d284b]">Te queda</dt>
                    <dd key={queda} className={`gst-bump text-[17px] font-bold tabular-nums ${queda >= 0 ? 'text-[#0f7b4a]' : 'text-[#c0262d]'}`}>{dinero(queda)}</dd>
                  </div>
                </dl>
                {utilidad > 0 && (
                  <>
                    <div className="mt-3 h-1.5 rounded-full bg-[#e6ebfb] overflow-hidden"><Barra valor={pctUtilidad} className="bg-gradient-to-r from-[#c5bcff] to-[#9687F5]" /></div>
                    <p className="text-[11px] text-[#8f8cb0] mt-1.5">Los gastos se llevaron el {Math.round((total / utilidad) * 100)}% de tu utilidad</p>
                  </>
                )}
              </>
            )}
          </section>
        </div>

        {/* Derecha: mes, categorías y lista */}
        <div className="p-4 sm:p-6 lg:pl-6 lg:overflow-y-auto hide-scrollbar space-y-4 min-w-0 max-lg:pt-0">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => cambiarMes(-1)} aria-label="Mes anterior" className="gst-press gst-hv w-9 h-9 rounded-full bg-[#f3f5ff] text-[#2d284b] grid place-items-center">
              <i className="fa-solid fa-chevron-left text-[11px]"></i>
            </button>
            <span className="text-[15px] font-bold text-[#2d284b]">{nombreMes}</span>
            <button type="button" onClick={() => cambiarMes(1)} disabled={esMesActual} aria-label="Mes siguiente" className="gst-press gst-hv w-9 h-9 rounded-full bg-[#f3f5ff] text-[#2d284b] grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed">
              <i className="fa-solid fa-chevron-right text-[11px]"></i>
            </button>
          </div>

          {cargando && !cambiando ? (
            <p className="text-xs text-center py-8 text-[#6b6890]">Cargando...</p>
          ) : (
            <div className={`gst-panel space-y-4 ${cambiando ? 'sale' : ''}`}>
              {porCategoria.length > 0 && (
                <section className="rounded-[20px] bg-[#f6f8ff] p-4">
                  <h4 className="text-xs font-medium text-[#6b6890]">En qué se fue</h4>
                  <ul className="mt-2.5 space-y-2.5">
                    {porCategoria.map((c) => (
                      <li key={c.categoria}>
                        <div className="flex justify-between items-baseline gap-3 text-[13px]">
                          <span className="font-medium text-[#2d284b] truncate">{c.categoria}</span>
                          <span className="shrink-0 tabular-nums text-[#2d284b]"><b className="font-semibold">{dinero(c.monto)}</b> <span className="text-xs text-[#8f8cb0] ml-1">{Math.round((c.monto / total) * 100)}%</span></span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#e6ebfb] overflow-hidden mt-1.5">
                          <Barra valor={c.monto / maxCategoria} className="bg-gradient-to-r from-[#c5bcff] to-[#9687F5]" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {porDia.length === 0 ? (
                <div className="text-center px-6 py-10 text-[13.5px] text-[#6b6890]">
                  <div className="w-14 h-14 rounded-2xl bg-[#f3f5ff] text-[#5b4bd6] grid place-items-center text-xl mx-auto mb-3"><i className="fa-solid fa-wallet"></i></div>
                  <b className="block text-[#2d284b]">No hay gastos en {nombreMes}</b>
                  Anota el primero con el formulario.
                </div>
              ) : (
                <div className="space-y-4">
                  {porDia.map((d) => (
                    <section key={d.dia}>
                      <div className="flex justify-between items-baseline gap-3 mb-1.5">
                        <p className="text-[11px] font-bold text-[#8f8cb0] uppercase tracking-wide">{tituloDia(d.dia)}</p>
                        <span className="text-[11.5px] font-semibold tabular-nums text-[#6b6890]">{dinero(d.total)}</span>
                      </div>
                      <ul className="rounded-[18px] border border-[#eef1fd] divide-y divide-[#eef1fd] overflow-hidden">
                        {d.items.map((g) => (
                          <li key={g.id} className={`gst-item ${saliendo === g.id ? 'sale' : ''} ${nuevoId === g.id ? 'entra' : ''}`}>
                            <div>
                              <div className="gst-fila flex items-center gap-3 px-3.5 py-2.5 bg-white">
                                <div className="flex-1 min-w-0">
                                  <b className="block text-[13.5px] text-[#2d284b] truncate">{g.categoria === 'Otros' && g.descripcion ? g.descripcion : g.categoria}</b>
                                  {g.descripcion && g.categoria !== 'Otros' && <span className="block text-xs text-[#8f8cb0] truncate">{g.descripcion}</span>}
                                  {g.categoria === 'Otros' && g.descripcion && <span className="block text-xs text-[#8f8cb0]">Otros</span>}
                                </div>
                                <b className="text-[14px] tabular-nums text-[#2d284b] whitespace-nowrap">{dinero(g.monto)}</b>
                                {borrando === g.id ? (
                                  <span className="gst-conf flex items-center gap-1.5 shrink-0">
                                    <button type="button" onClick={() => borrar(g)} className="gst-press h-8 px-3 rounded-full bg-[#c0262d] text-white text-xs font-bold">Borrar</button>
                                    <button type="button" onClick={() => setBorrando(null)} className="gst-press h-8 px-3 rounded-full bg-[#f3f5ff] text-[#6b6890] text-xs font-bold">No</button>
                                  </span>
                                ) : (
                                  <button type="button" onClick={() => setBorrando(g.id)} aria-label={`Eliminar gasto de ${g.categoria}`} className="gst-press w-8 h-8 rounded-full text-[#b3b0cc] hover:bg-[#f3f5ff] hover:text-[#c0262d] grid place-items-center shrink-0">
                                    <i className="fa-regular fa-trash-can text-[13px]"></i>
                                  </button>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </VentanaModulo>
  );
}

function ordenar(lista) {
  return [...lista].sort((a, b) => (a.fecha === b.fecha ? String(b.creado_en).localeCompare(String(a.creado_en)) : a.fecha < b.fecha ? 1 : -1));
}
