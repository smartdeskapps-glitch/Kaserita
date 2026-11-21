// Menú de escritorio: panel que cae del botón ☰ del encabezado. Buscador arriba (enfocado al abrir),
// pestañas por tema y filas con ícono. Lee la misma lista de opciones que la hoja del celular.
//  - Teclado: ↑ ↓ eligen, Enter abre, ← → cambian de pestaña (con el buscador vacío), Esc limpia o cierra.
//  - Entra en 200 ms y sale en 120 ms; si se abre con Ctrl K no se anima (se usa cientos de veces al día).
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { normalizarBusqueda as normalizar } from '../lib/busqueda.js';

// Cada grupo de opciones cae en una pestaña. Un grupo que no esté aquí va a "Negocio".
const PESTANAS = [
  { nombre: 'Operación', grupos: ['', 'Ventas y caja', 'Inventario'] },
  { nombre: 'Negocio', grupos: ['Administración', 'Entradas', 'Catálogo'] },
  { nombre: 'Cuenta', grupos: ['Cuenta'] },
];
const pestanaDe = (grupo) => {
  const i = PESTANAS.findIndex((p) => p.grupos.includes(grupo));
  return i < 0 ? 1 : i;
};

export default function MenuEscritorio({ abierto, opciones, busqueda, setBusqueda, indice, setIndice, onClose, instantaneo }) {
  // `montado` mantiene el panel en pantalla durante la salida; `visible` dispara las transiciones.
  const [montado, setMontado] = useState(abierto);
  const [visible, setVisible] = useState(false);
  const [seco, setSeco] = useState(false);
  const [pestana, setPestana] = useState(0);
  const [pos, setPos] = useState(null);
  const [desliza, setDesliza] = useState(false);
  const entradaRef = useRef(null);
  const refsPestana = useRef([]);
  const porTeclado = useRef(false);
  const filaActiva = useRef(null);

  useEffect(() => {
    setSeco(!!instantaneo);
    if (abierto) {
      setMontado(true);
      setPestana(0);
      let r2;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setVisible(true)); });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setVisible(false);
    setDesliza(false);
    const t = setTimeout(() => setMontado(false), instantaneo ? 0 : 150);
    return () => clearTimeout(t);
  }, [abierto]); // eslint-disable-line

  useEffect(() => {
    if (visible) entradaRef.current?.focus({ preventScroll: true });
  }, [visible]);

  const q = normalizar(busqueda).trim();
  const pestanas = useMemo(
    () => PESTANAS.map((p, i) => ({ ...p, i, filas: opciones.filter((o) => pestanaDe(o.grupo) === i) })).filter((p) => p.filas.length),
    [opciones]
  );
  const activa = pestanas.find((p) => p.i === pestana) || pestanas[0];
  const visibles = q
    ? opciones.filter((o) => normalizar(`${o.etiqueta} ${o.grupo} ${o.buscar || ''}`).includes(q))
    : (activa ? activa.filas : []);
  const sel = Math.min(indice, Math.max(visibles.length - 1, 0));
  const hayPestanas = !q && pestanas.length > 1;
  const mostrarGrupos = q ? true : new Set(visibles.map((o) => o.grupo)).size > 1;

  // La pieza blanca de la pestaña activa es una sola y se desliza entre pestañas.
  useLayoutEffect(() => {
    const el = activa && refsPestana.current[activa.i];
    if (!el || !hayPestanas || !el.offsetWidth) return;
    setPos({ x: el.offsetLeft, w: el.offsetWidth });
  }, [activa?.i, hayPestanas, montado, opciones]); // eslint-disable-line
  useEffect(() => {
    if (!visible || !pos) return;
    const id = requestAnimationFrame(() => setDesliza(true));
    return () => cancelAnimationFrame(id);
  }, [visible, !!pos]); // eslint-disable-line
  const esPrimera = activa && pestanas[0]?.i === activa.i;

  useEffect(() => {
    if (porTeclado.current) { filaActiva.current?.scrollIntoView({ block: 'nearest' }); porTeclado.current = false; }
  }, [sel]);

  const ejecutar = (o) => { if (!o) return; o.accion(); onClose(); };
  const irAPestana = (paso) => {
    const k = pestanas.findIndex((p) => p.i === activa.i) + paso;
    if (k < 0 || k >= pestanas.length) return;
    setPestana(pestanas[k].i);
    setIndice(0);
  };
  const alTeclear = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); porTeclado.current = true; setIndice(Math.min(sel + 1, visibles.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); porTeclado.current = true; setIndice(Math.max(sel - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); ejecutar(visibles[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); if (busqueda) { setBusqueda(''); setIndice(0); } else onClose(); }
    else if (!busqueda && hayPestanas && e.key === 'ArrowRight') { e.preventDefault(); irAPestana(1); }
    else if (!busqueda && hayPestanas && e.key === 'ArrowLeft') { e.preventDefault(); irAPestana(-1); }
  };

  if (!montado) return null;

  return (
    <div className={`mx-raiz ${visible ? 'mx-abierto' : ''} ${seco ? 'mx-seco' : ''}`}>
      <div className="mx-velo" onClick={onClose}></div>
      <section className="mx-panel" role="dialog" aria-label="Menú" onKeyDown={alTeclear}>
        <div className="mx-caja">
          <label className={`mx-busq ${busqueda ? 'mx-lleno' : ''}`}>
            <i className="fa-solid fa-magnifying-glass text-[14px]"></i>
            <input
              ref={entradaRef}
              type="text"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setIndice(0); }}
              placeholder="Buscar una opción..."
              autoComplete="off"
              spellCheck={false}
            />
            <kbd>Esc</kbd>
          </label>

          {hayPestanas && (
            <div className="mx-tabs" role="tablist">
              <i
                className={`mx-fondo ${desliza ? 'mx-desliza' : ''} ${esPrimera ? 'mx-izq' : ''}`}
                style={pos ? { transform: `translateX(${pos.x}px)`, width: pos.w } : { opacity: 0 }}
              />
              {pestanas.map((p) => (
                <button
                  key={p.nombre}
                  ref={(el) => { refsPestana.current[p.i] = el; }}
                  role="tab"
                  aria-selected={p.i === activa.i}
                  className={`mx-tab ${p.i === activa.i ? 'mx-tab-on' : ''}`}
                  onClick={() => { setPestana(p.i); setIndice(0); entradaRef.current?.focus({ preventScroll: true }); }}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
          )}

          <div className={`mx-cu hide-scrollbar ${hayPestanas && esPrimera ? 'mx-cu-izq' : ''}`} key={`${q ? 'q' : activa?.i}`}>
            {visibles.length === 0 && (
              <div className="mx-vacio"><b>Sin resultados para “{busqueda}”</b><span>Prueba con otra palabra</span></div>
            )}
            {visibles.map((o, i) => {
              const esActivo = i === sel;
              return (
                <React.Fragment key={`${o.grupo}-${o.etiqueta}`}>
                  {mostrarGrupos && o.grupo && o.grupo !== visibles[i - 1]?.grupo && <p className="mx-grp">{o.grupo}</p>}
                  <button
                    ref={esActivo ? filaActiva : undefined}
                    type="button"
                    onClick={() => ejecutar(o)}
                    onMouseMove={() => { if (i !== sel) setIndice(i); }}
                    className={`mx-fila ${esActivo ? 'mx-sel' : ''} ${o.tono === 'rose' ? 'mx-rose' : o.tono === 'amber' ? 'mx-amber' : ''}`}
                    style={{ '--i': Math.min(i, 8) }}
                  >
                    <span className="mx-circ"><i className={`fa-solid ${o.icono}`}></i></span>
                    <span className="mx-t">
                      <b>{o.etiqueta}</b>
                      {o.sub && <small className={o.subTono === 'amb' ? 'mx-amb' : ''}>{o.sub}</small>}
                    </span>
                    {o.insignia && <span className="mx-ins">{o.insignia}</span>}
                    <i className="fa-solid fa-arrow-right mx-go"></i>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
