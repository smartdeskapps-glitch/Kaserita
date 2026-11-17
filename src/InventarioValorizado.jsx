import React, { useMemo, useState } from 'react';
import VentanaModulo from './VentanaModulo.jsx';
import { FotoProducto } from './PanelAdminCompartido.jsx';
import { dinero } from './lib/dinero.js';
import { normalizarBusqueda, productoCoincide } from './lib/busqueda.js';

// Inventario valorizado: por cada producto, cuánto costó, a cuánto se vende y cuánto deja por
// unidad vendida; arriba, el total invertido y la ganancia posible con el stock actual.
// Solo lectura: no toca el stock ni los precios. Se abre desde «Más» y solo la ve la administración.

const STOCK_BAJO = 5;
const MARGEN_BAJO = 15;
const MARGEN_BUENO = 25;
const PAGINA = 60;

const FILTROS = [
  ['todos', 'Todos'],
  ['stock', 'Con stock'],
  ['bajo', 'Stock bajo'],
  ['margen', 'Margen bajo'],
  ['sincosto', 'Sin costo'],
  ['agotado', 'Agotados'],
];
const ORDENES = [
  ['nombre', 'A–Z'],
  ['gana-u', 'Ganancia x unidad'],
  ['margen', 'Mayor margen'],
  ['total', 'Ganancia total'],
  ['invertido', 'Más invertido'],
];

const numero = (v) => Number(v) || 0;
// Sin dato de stock (null o vacío) significa que no se controla; no cuenta como agotado.
const controlaStock = (p) => p.stock_actual !== null && p.stock_actual !== undefined && p.stock_actual !== '';
const agotado = (p) => controlaStock(p) && numero(p.stock_actual) <= 0;
const textoStock = (n) => String(+numero(n).toFixed(2));

// Todo lo que se calcula de un producto, una sola vez.
const medir = (p) => {
  const costo = numero(p.precio_costo);
  const venta = numero(p.precio_venta);
  const stock = controlaStock(p) ? Math.max(0, numero(p.stock_actual)) : 0;
  const tieneCosto = costo > 0;
  const gu = venta - costo;
  return {
    p, costo, venta, stock, tieneCosto, gu,
    margen: tieneCosto && venta > 0 ? (gu / venta) * 100 : null,
    invertido: costo * stock,
    ventaTotal: venta * stock,
    total: tieneCosto ? gu * stock : 0,
  };
};

const tonoMargen = (m) => (m === null ? 'mut' : m >= MARGEN_BUENO ? 'good' : m >= MARGEN_BAJO ? 'warn' : 'bad');
const COLOR = { good: 'text-[#17895c]', warn: 'text-[#a96a00]', bad: 'text-[#c2334f]', mut: 'text-[#8f8cb0]' };

const Ojo = ({ tachado }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    {tachado && <path d="M4 4l16 16" />}
  </svg>
);

export default function InventarioValorizado({ productos, onClose }) {
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [orden, setOrden] = useState('nombre');
  const [verCostos, setVerCostos] = useState(true);
  const [limite, setLimite] = useState(PAGINA);

  const filas = useMemo(() => (productos || []).filter((p) => p.activo !== false).map(medir), [productos]);

  const resumen = useMemo(() => {
    const r = { invertido: 0, ventaTotal: 0, total: 0, bajo: 0, agotados: 0, margenBajo: 0, sinCosto: 0 };
    filas.forEach((f) => {
      r.invertido += f.invertido;
      if (f.tieneCosto) { r.ventaTotal += f.ventaTotal; r.total += f.total; } // sin costo, la ganancia no se puede saber
      if (agotado(f.p)) r.agotados += 1;
      else if (f.stock > 0 && f.stock <= STOCK_BAJO) r.bajo += 1;
      if (!f.tieneCosto) r.sinCosto += 1;
      else if (f.margen !== null && f.margen < MARGEN_BAJO) r.margenBajo += 1;
    });
    r.margen = r.ventaTotal > 0 ? (r.total / r.ventaTotal) * 100 : 0;
    return r;
  }, [filas]);

  const visibles = useMemo(() => {
    const q = normalizarBusqueda(texto);
    const cache = new Map();
    let l = filas.filter((f) => productoCoincide(f.p, q, cache));
    l = l.filter((f) => {
      if (filtro === 'stock') return f.stock > 0;
      if (filtro === 'bajo') return f.stock > 0 && f.stock <= STOCK_BAJO;
      if (filtro === 'margen') return f.margen !== null && f.margen < MARGEN_BAJO;
      if (filtro === 'sincosto') return !f.tieneCosto;
      if (filtro === 'agotado') return agotado(f.p);
      return true;
    });
    const clave = {
      'gana-u': (f) => (f.tieneCosto ? f.gu : -Infinity),
      margen: (f) => (f.margen === null ? -Infinity : f.margen),
      total: (f) => f.total,
      invertido: (f) => f.invertido,
    }[orden];
    if (clave) l.sort((a, b) => clave(b) - clave(a));
    else l.sort((a, b) => String(a.p.descripcion || '').localeCompare(String(b.p.descripcion || ''), 'es'));
    // Los agotados van al final, como en el catálogo.
    return [...l.filter((f) => !agotado(f.p)), ...l.filter((f) => agotado(f.p))];
  }, [filas, texto, filtro, orden]);

  const elegirFiltro = (f) => { setFiltro(f); setLimite(PAGINA); };
  const oculto = <span className="tracking-[0.12em]">••••</span>;
  const pctCosto = 100 - resumen.margen;

  const atajos = [
    resumen.margenBajo > 0 && ['margen', `${resumen.margenBajo} con margen bajo`, 'bg-[#fdecef] text-[#c2334f]'],
    resumen.sinCosto > 0 && ['sincosto', `${resumen.sinCosto} sin costo`, 'bg-[#fff3df] text-[#a96a00]'],
    resumen.bajo > 0 && ['bajo', `${resumen.bajo} con stock bajo`, 'bg-[#fff3df] text-[#a96a00]'],
    resumen.agotados > 0 && ['agotado', `${resumen.agotados} agotados`, 'bg-[#f3f5ff] text-[#2d284b]'],
  ].filter(Boolean);

  return (
    <VentanaModulo
      icono="fa-tags"
      titulo="Inventario valorizado"
      subtitulo="Costo, venta y ganancia de cada producto"
      onClose={onClose}
      onFondo={onClose}
      ancho="max-w-2xl"
      desplazable={false}
    >
      {/* Todo se desplaza junto; solo el buscador y los filtros se quedan fijos arriba de la lista. */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#f4f6ff]">
        <section className="bg-white px-4 sm:px-6 pt-4 pb-4 space-y-3.5">
          <dl className="grid grid-cols-3">
            <div className="min-w-0 pr-3">
              <dt className="text-[11.5px] font-semibold text-[#8f8cb0]">Invertido</dt>
              <dd className="mt-0.5 text-[15px] sm:text-[17px] font-extrabold text-[#2d284b] tabular-nums whitespace-nowrap">{verCostos ? dinero(resumen.invertido) : oculto}</dd>
            </div>
            <div className="min-w-0 px-3 border-l border-[#eef1fd]">
              <dt className="text-[11.5px] font-semibold text-[#8f8cb0]">Si vendés todo</dt>
              <dd className="mt-0.5 text-[15px] sm:text-[17px] font-extrabold text-[#2d284b] tabular-nums whitespace-nowrap">{dinero(resumen.ventaTotal)}</dd>
            </div>
            <div className="min-w-0 pl-3 border-l border-[#eef1fd]">
              <dt className="text-[11.5px] font-semibold text-[#8f8cb0]">Ganancia posible</dt>
              <dd className="mt-0.5 text-[15px] sm:text-[17px] font-extrabold text-[#17895c] tabular-nums whitespace-nowrap">{verCostos ? dinero(resumen.total) : oculto}</dd>
            </div>
          </dl>
          {verCostos && resumen.ventaTotal > 0 && (
            <div>
              <div className="flex h-2.5 gap-[3px] rounded-full overflow-hidden bg-[#f1efff]" role="img" aria-label={`Costo ${pctCosto.toFixed(0)} por ciento, ganancia ${resumen.margen.toFixed(0)} por ciento`}>
                <i className="block h-full rounded-full bg-[#9687f5]" style={{ width: `${pctCosto}%` }} />
                <i className="block h-full rounded-full bg-[#17895c]" style={{ width: `${resumen.margen}%` }} />
              </div>
              <p className="mt-2 text-[12.5px] text-[#6b6890]">
                De cada S/ 100 que vendés, <b className="text-[#2d284b]">S/ {pctCosto.toFixed(0)}</b> es costo y <b className="text-[#17895c]">S/ {resumen.margen.toFixed(0)}</b> es ganancia.
              </p>
            </div>
          )}
          {atajos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {atajos.map(([f, t, c]) => (
                <button key={f} type="button" onClick={() => elegirFiltro(f)} className={`text-[12px] font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform duration-150 ${c}`}>{t}</button>
              ))}
            </div>
          )}
        </section>

        <div className="sticky top-0 z-10 bg-[#f4f6ff] px-4 sm:px-6 pt-3 pb-2.5 space-y-2.5 border-y border-[#e6ebff]">
          <label className="relative block">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8f8cb0] pointer-events-none" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              type="search" value={texto} onChange={(e) => { setTexto(e.target.value); setLimite(PAGINA); }}
              placeholder="Buscar producto o código" autoComplete="off" aria-label="Buscar producto"
              className="w-full h-11 rounded-2xl bg-white ring-1 ring-[#5b4bd6]/10 pl-10 pr-3 text-[15px] text-[#2d284b] placeholder:text-[#9a98b4] focus:outline-none focus:ring-2 focus:ring-[#5b4bd6]/40"
            />
          </label>
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filtrar productos">
            {FILTROS.map(([f, t]) => (
              <button
                key={f} type="button" aria-pressed={filtro === f} onClick={() => elegirFiltro(f)}
                className={`shrink-0 text-[12.5px] font-semibold px-3.5 py-2 rounded-full transition active:scale-95 ${filtro === f ? 'bg-[#5b4bd6] text-white' : 'bg-white ring-1 ring-[#5b4bd6]/10 text-[#6b6890] hover:bg-[#e9edff]'}`}
              >{t}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-[13px] font-bold text-[#2d284b] whitespace-nowrap">{visibles.length} {visibles.length === 1 ? 'producto' : 'productos'}</span>
            <button
              type="button" onClick={() => setVerCostos((v) => !v)} aria-pressed={!verCostos}
              aria-label={verCostos ? 'Ocultar costos' : 'Mostrar costos'} title={verCostos ? 'Ocultar costos' : 'Mostrar costos'}
              className="w-9 h-9 rounded-xl bg-white ring-1 ring-[#5b4bd6]/10 text-[#5b4bd6] grid place-items-center shrink-0 active:scale-95 transition-transform duration-150"
            ><Ojo tachado={verCostos} /></button>
            <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar por" className="h-9 w-[150px] shrink-0 rounded-xl bg-white ring-1 ring-[#5b4bd6]/10 px-2.5 text-[13px] font-semibold text-[#2d284b] focus:outline-none focus:ring-2 focus:ring-[#5b4bd6]/40">
              {ORDENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 space-y-2.5">
          {visibles.length === 0 && (
            <p className="py-10 text-center text-sm text-[#8f8cb0]">No hay productos con ese filtro.</p>
          )}
          {visibles.slice(0, limite).map((f) => {
            const p = f.p;
            const t = tonoMargen(f.margen);
            const sinStock = agotado(p);
            const bajo = f.stock > 0 && f.stock <= STOCK_BAJO;
            return (
              <div key={p.id} className="bg-white rounded-[20px] ring-1 ring-[#5b4bd6]/10 p-3.5">
                <div className="flex items-start gap-3">
                  <span className="w-11 h-11 rounded-[13px] overflow-hidden shrink-0 bg-[#f1efff]"><FotoProducto fotoUrl={p.foto_url} categoria={p.categoria} className="w-full h-full" iconClassName="text-sm" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] leading-snug font-bold text-[#2d284b] line-clamp-2">{p.descripcion}</p>
                    <p className="mt-0.5 text-[12.5px] text-[#6b6890] truncate">
                      {sinStock ? <b className="text-[#c2334f]">Agotado</b>
                        : !controlaStock(p) ? 'Sin control de stock'
                        : bajo ? <b className="text-[#a96a00]">Quedan {textoStock(f.stock)}</b>
                        : `${textoStock(f.stock)} en stock`}
                      {p.categoria ? ` · ${p.categoria}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[12.5px] leading-snug font-extrabold whitespace-nowrap pt-0.5 ${COLOR[t]}`}>
                    {f.margen === null ? 'Sin costo' : `${f.margen.toFixed(0)} % margen`}
                  </span>
                </div>
                <dl className="mt-3 pt-3 border-t border-[#eef1fd] grid grid-cols-3">
                  <div className="min-w-0 pr-2">
                    <dt className="text-[11.5px] font-semibold text-[#8f8cb0]">Costo</dt>
                    <dd className="mt-0.5 text-[15px] font-extrabold text-[#2d284b] tabular-nums whitespace-nowrap">{!f.tieneCosto ? <span className="text-[#a96a00]">Falta</span> : verCostos ? dinero(f.costo) : oculto}</dd>
                  </div>
                  <div className="min-w-0 px-2 border-l border-[#eef1fd]">
                    <dt className="text-[11.5px] font-semibold text-[#8f8cb0]">Venta</dt>
                    <dd className="mt-0.5 text-[15px] font-extrabold text-[#2d284b] tabular-nums whitespace-nowrap">{dinero(f.venta)}</dd>
                  </div>
                  <div className="min-w-0 pl-2 border-l border-[#eef1fd]">
                    <dt className="text-[11.5px] font-semibold text-[#8f8cb0]">Ganás x unidad</dt>
                    <dd className={`mt-0.5 text-[15px] font-extrabold tabular-nums whitespace-nowrap ${COLOR[t]}`}>{!f.tieneCosto ? '—' : verCostos ? dinero(f.gu) : oculto}</dd>
                  </div>
                </dl>
                {f.stock > 0 && f.tieneCosto && (
                  <dl className="mt-3 pt-2.5 border-t border-[#eef1fd] flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12px] text-[#6b6890]">
                    <div className="flex gap-1.5"><dt>Invertido en stock</dt><dd className="font-bold text-[#2d284b] tabular-nums">{verCostos ? dinero(f.invertido) : oculto}</dd></div>
                    <div className="flex gap-1.5"><dt>Ganarías</dt><dd className="font-bold text-[#17895c] tabular-nums">{verCostos ? dinero(f.total) : oculto}</dd></div>
                  </dl>
                )}
              </div>
            );
          })}
          {visibles.length > limite && (
            <button type="button" onClick={() => setLimite((n) => n + PAGINA)} className="w-full h-11 rounded-2xl bg-white ring-1 ring-[#5b4bd6]/10 text-[13px] font-bold text-[#5b4bd6] active:scale-[0.98] transition-transform duration-150">
              Mostrar más ({visibles.length - limite})
            </button>
          )}
          <p className="pt-1 pb-2 text-[12px] leading-relaxed text-[#8f8cb0]">
            Margen = (venta − costo) ÷ venta. Verde desde {MARGEN_BUENO} %, ámbar desde {MARGEN_BAJO} %, rojo por debajo. Los productos sin costo cargado no entran en la ganancia ni en el margen.
          </p>
        </div>
      </div>
    </VentanaModulo>
  );
}
