import React, { useMemo, useState } from 'react';
import { FotoProducto } from './PanelAdminCompartido.jsx';
import { precioNormalCombo, costoNormalCombo, margenCombo } from './lib/combos.js';

// Vista "Combos" del catálogo del POS: tarjetas con el mosaico de productos, cuánto ahorra el
// cliente, qué incluye, disponibilidad real, botón para agregar sin abrir el combo y (solo el
// dueño) el margen. Todo sale de datos que ya trae cada combo (combos_items + productos) y de
// estadoCombos (stock disponible), así que no pide nada extra al servidor.

const texto = (combo) =>
  [combo.nombre, ...(combo.combos_items || []).map((ci) => ci.productos?.descripcion || '')].join(' ').toLowerCase();

// ¿El combo coincide con lo que se escribió en el buscador? (por su nombre o por sus productos)
export const comboCoincide = (combo, busqueda) => {
  const t = String(busqueda || '').trim().toLowerCase();
  return !t || texto(combo).includes(t);
};

const dinero = (n) => Number(n || 0).toFixed(2);
const nombreCorto = (d) => String(d || '?').replace(/\s*\(unidad\)/i, '');

export default function CombosCatalogo({ combos, estadoCombos, enCarrito, busqueda, esAdmin, onAgregar, onQuitar, onCrear }) {
  const [orden, setOrden] = useState('rec');
  const [verMargen, setVerMargen] = useState(false);

  const filas = useMemo(() => {
    const lista = combos.filter((c) => comboCoincide(c, busqueda)).map((combo) => {
      const items = (combo.combos_items || []).map((ci) => ({
        precio_venta: Number(ci.productos?.precio_venta) || 0,
        precio_costo: Number(ci.productos?.precio_costo) || 0,
        cantidad: Number(ci.cantidad) || 0,
        descripcion: ci.productos?.descripcion,
        foto: ci.productos?.foto_url,
        categoria: ci.productos?.categoria,
      }));
      const normal = precioNormalCombo(items);
      const precio = Number(combo.precio_venta) || 0;
      const est = estadoCombos.get(combo.id) || { disponible: true, faltan: [], unidades: Infinity };
      return { combo, items, normal, precio, ahorro: normal - precio, margen: margenCombo(precio, costoNormalCombo(items)), est };
    });
    const base = orden === 'aho' ? [...lista].sort((a, b) => b.ahorro - a.ahorro)
      : orden === 'pre' ? [...lista].sort((a, b) => a.precio - b.precio)
      : lista;
    // Los agotados van al final, en cualquier orden.
    return [...base.filter((f) => f.est.disponible), ...base.filter((f) => !f.est.disponible)];
  }, [combos, estadoCombos, busqueda, orden]);

  if (combos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-stone-500 text-center">
        <p className="text-base font-semibold">No hay combos activos</p>
        <p className="text-xs text-stone-400 mt-1">Créalos desde "Entradas → Combos".</p>
        {esAdmin && onCrear && (
          <button onClick={onCrear} className="mt-3 px-4 py-2 rounded-full bg-[#2d284b] text-white text-xs font-semibold">Crear un combo</button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[11.5px] font-semibold text-[#6b6890] mr-0.5">Ordenar</span>
        {[['rec', 'Recomendados'], ['aho', 'Mayor ahorro'], ['pre', 'Menor precio']].map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            onClick={() => setOrden(id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${orden === id ? 'bg-[#2d284b] border-[#2d284b] text-white' : 'bg-white border-[#dde4fa] text-[#4a4670] hover:bg-[#ebf0ff]'}`}
          >
            {etiqueta}
          </button>
        ))}
        {esAdmin && (
          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-[#6b6890] cursor-pointer select-none">
            <input type="checkbox" checked={verMargen} onChange={(e) => setVerMargen(e.target.checked)} className="w-[15px] h-[15px] accent-[#5b4bd6]" />
            Ver margen
          </label>
        )}
      </div>

      {filas.length === 0 && (
        <p className="text-center text-sm text-[#6b6890] py-10">Ningún combo coincide con “{busqueda.trim()}”.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
        {filas.map(({ combo, items, normal, precio, ahorro, margen, est }) => {
          const cantidad = enCarrito.get(combo.id) || 0;
          const agotado = !est.disponible;
          const pocas = Number.isFinite(est.unidades) && est.unidades <= 5;
          const mosaico = items.slice(0, 4);
          return (
            <article
              key={combo.id}
              className={`relative flex flex-row md:flex-col bg-white border rounded-[20px] md:rounded-[22px] overflow-hidden transition-all duration-200 ${
                agotado ? 'border-[#dde4fa] opacity-65' : cantidad > 0 ? 'border-[#5b4bd6] ring-2 ring-[#5b4bd6]/25' : 'border-[#dde4fa] hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-22px_rgba(91,75,214,0.7)]'
              }`}
            >
              <div className={`relative shrink-0 w-[112px] md:w-auto md:aspect-[16/9.4] self-stretch min-h-[150px] md:min-h-0 p-2 grid gap-[3px] ${mosaico.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {mosaico.map((it, i) => (
                  <div key={i} className={`relative rounded-[14px] overflow-hidden bg-[#ebf0ff] ${mosaico.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
                    <FotoProducto fotoUrl={it.foto} categoria={it.categoria} className="w-full h-full" iconClassName="text-lg" />
                    {it.cantidad > 1 && (
                      <span className="absolute right-1.5 bottom-1 text-[10px] font-bold bg-white/90 text-[#2d284b] rounded-full px-1.5 leading-4">×{it.cantidad}</span>
                    )}
                  </div>
                ))}
                {ahorro > 0.005 && !agotado && (
                  <span className="absolute left-3 top-3 md:left-3.5 md:top-3.5 flex items-center gap-1 bg-[#2d284b] text-white text-[10px] md:text-[11px] font-bold px-2 md:px-2.5 py-1 rounded-full shadow-[0_8px_14px_-8px_rgba(45,40,75,0.8)]">
                    Ahorras <b className="text-[#c5bcff] tabular-nums">S/ {dinero(ahorro)}</b>
                    <span className="hidden md:inline"> · {Math.round((ahorro / normal) * 100)}%</span>
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-2 p-3 pl-1 md:p-3.5 md:pt-3">
                <h3 className="text-[14px] md:text-[15px] font-bold text-[#2d284b] leading-snug line-clamp-2">{combo.nombre}</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {items.slice(0, 3).map((it, i) => (
                    <li key={i} className="text-[10.5px] text-[#4a4670] bg-[#ebf0ff] rounded-full px-2 py-0.5 max-w-full truncate">
                      {it.cantidad > 1 ? `${it.cantidad}× ` : ''}{nombreCorto(it.descripcion)}
                    </li>
                  ))}
                  {items.length > 3 && (
                    <li className="text-[10.5px] font-semibold text-[#5b4bd6] border border-dashed border-[#c5bcff] rounded-full px-2 py-0.5" title={items.slice(3).map((it) => nombreCorto(it.descripcion)).join(', ')}>
                      +{items.length - 3} más
                    </li>
                  )}
                </ul>
                {agotado && est.faltan.length > 0 && (
                  <p className="text-[10.5px] font-semibold text-rose-600 line-clamp-2">Sin stock: {est.faltan.join(', ')}</p>
                )}

                <div className="flex items-center gap-2.5 mt-auto pt-1">
                  <div className="min-w-0">
                    <b className="block text-[19px] md:text-xl font-bold tracking-tight text-[#2d284b] tabular-nums leading-tight">S/ {dinero(precio)}</b>
                    {ahorro > 0.005 && <s className="text-[11.5px] text-[#9a9ab5] tabular-nums">S/ {dinero(normal)}</s>}
                  </div>
                  <span className="flex-1"></span>
                  {agotado ? (
                    <span className="w-11 h-11 rounded-full bg-[#d9dcea] text-white grid place-items-center" aria-label="Agotado"><i className="fa-solid fa-plus text-sm"></i></span>
                  ) : cantidad > 0 ? (
                    <div className="flex items-center h-11 rounded-full bg-[#ebf0ff] p-[3px] shrink-0">
                      <button type="button" onClick={() => onQuitar(combo)} aria-label="Quitar uno" className="w-[38px] h-[38px] rounded-full bg-white text-[#2d284b] shadow-[0_2px_6px_-2px_rgba(45,40,75,0.3)] grid place-items-center"><i className="fa-solid fa-minus text-xs"></i></button>
                      <span className="min-w-[26px] text-center font-bold tabular-nums text-[#2d284b]">{cantidad}</span>
                      <button type="button" onClick={() => onAgregar(combo)} aria-label="Agregar uno" className="w-[38px] h-[38px] rounded-full bg-white text-[#2d284b] shadow-[0_2px_6px_-2px_rgba(45,40,75,0.3)] grid place-items-center"><i className="fa-solid fa-plus text-xs"></i></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => onAgregar(combo)} aria-label={`Agregar ${combo.nombre}`} className="w-11 h-11 rounded-full bg-[#2d284b] hover:bg-[#3b3466] text-white grid place-items-center shadow-[0_12px_20px_-12px_rgba(45,40,75,0.9)] active:scale-95 transition shrink-0"><i className="fa-solid fa-plus"></i></button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${agotado ? 'bg-[#eceef5] text-[#6b6890]' : pocas ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    <i className="w-1.5 h-1.5 rounded-full bg-current"></i>
                    {agotado ? 'Agotado' : pocas ? `Pocas · ${est.unidades}` : Number.isFinite(est.unidades) ? `${est.unidades} disp.` : 'Disponible'}
                  </span>
                  {esAdmin && verMargen && (
                    <span className={`inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full ${margen.perdida ? 'bg-rose-50 text-rose-600' : margen.bajo ? 'bg-amber-100 text-amber-700' : 'bg-[#5b4bd6]/10 text-[#5b4bd6]'}`}>
                      {margen.perdida ? 'Vende bajo el costo' : `Margen ${Math.round(margen.margenPct)}%`}
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {esAdmin && onCrear && (
          <button
            type="button"
            onClick={onCrear}
            className="flex flex-row md:flex-col items-center justify-center gap-2.5 min-h-[110px] md:min-h-[210px] border-2 border-dashed border-[#c5bcff] bg-[#ebf0ff]/50 hover:bg-[#ebf0ff] rounded-[20px] md:rounded-[22px] text-[#5b4bd6] font-semibold p-5 transition"
          >
            <span className="w-11 h-11 rounded-full bg-white grid place-items-center shadow-[0_8px_16px_-10px_rgba(91,75,214,0.6)]"><i className="fa-solid fa-plus"></i></span>
            <span className="text-left md:text-center">
              Crear un combo
              <small className="block text-[11.5px] font-normal text-[#6b6890] max-w-[22ch]">Junta productos y ponles un precio especial</small>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
