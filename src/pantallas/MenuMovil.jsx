import React, { useEffect, useRef, useState } from 'react';
import { IconoTrazo } from '../pos/componentes.jsx';
import { normalizarBusqueda as normalizar } from '../lib/busqueda.js';

// Menú del celular: tarjeta de turno, 4 accesos rápidos que cada persona elige (se guardan en
// este dispositivo) y el resto de opciones por tema. La versión de escritorio sigue siendo la
// paleta de comandos (PaletaMenu); las dos leen la misma lista de opciones.
// Estética: superficies planas con líneas de 1 px, un solo acento (el violeta del cobro) y los
// íconos en tinta neutra. La hoja se puede arrastrar hacia abajo para cerrarla.
const CLAVE = 'kaserita-menu-accesos';
const MAX = 4;
// Orden de preferencia: de aquí salen los 4 accesos mientras la persona no elija los suyos.
const POR_DEFECTO = ['fiados', 'historial', 'entrada', 'merma', 'toma', 'dashboard'];
const ORDEN_GRUPOS = ['Ventas y caja', 'Inventario', 'Administración', 'Entradas', 'Catálogo'];

const FINO = 'ring-1 ring-[rgba(91,75,214,0.11)]';
// El mismo violeta del total en la pantalla de cobro.
const DEGRADADO_TURNO = 'radial-gradient(90% 130% at 100% 0%, rgba(197,188,255,0.5) 0%, transparent 60%), linear-gradient(150deg, #7466e8 0%, #5b4bd6 48%, #473bb5 100%)';
const EASE_CAJON = 'cubic-bezier(0.32, 0.72, 0, 1)';

const leerAccesos = (disponibles) => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (Array.isArray(guardado)) return guardado.filter((id) => disponibles.includes(id)).slice(0, MAX);
  } catch { /* sin almacenamiento: se usan los de por defecto */ }
  return POR_DEFECTO.filter((id) => disponibles.includes(id)).slice(0, MAX);
};

const minutosDesde = (iso) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t) / 60000));
};
const horaApertura = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
};
const iniciales = (nombre) => {
  const p = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || 'K') + (p[1]?.[0] || '')).toUpperCase();
};

export default function MenuMovil({ opciones, busqueda, setBusqueda, onClose, turnoActivo, nombreUsuario, bodegaNombre, hojaRef, velaRef }) {
  const modulos = opciones.filter((o) => o.id);
  const cuenta = opciones.filter((o) => o.grupo === 'Cuenta');
  const turno = opciones.find((o) => o.esTurno);
  const idsDisponibles = modulos.map((o) => o.id);

  const [accesos, setAccesos] = useState(() => leerAccesos(idsDisponibles));
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [conLinea, setConLinea] = useState(false);
  const [, setTic] = useState(0);
  const temporizador = useRef(null);
  const arrastre = useRef(null);
  useEffect(() => () => clearTimeout(temporizador.current), []);
  // El tiempo del turno se refresca cada 30 s.
  useEffect(() => {
    const id = setInterval(() => setTic((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const ejecutar = (o) => { if (!o) return; o.accion(); onClose(); };
  const guardar = (siguiente) => {
    setAccesos(siguiente);
    try { localStorage.setItem(CLAVE, JSON.stringify(siguiente)); } catch { /* sin almacenamiento */ }
  };
  const fijar = (id) => {
    if (accesos.length >= MAX) {
      setAviso(`Máximo ${MAX} accesos. Quita uno para fijar otro.`);
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setAviso(''), 2200);
      return;
    }
    guardar([...accesos, id]);
  };
  const quitar = (id) => guardar(accesos.filter((x) => x !== id));

  // La hoja sigue al dedo, cede con fricción hacia arriba y se cierra por velocidad
  // (más de 0,11 px/ms) o por distancia (más del 30 %).
  const alBajar = (e) => {
    if (e.target.closest('button') || !hojaRef.current) return;
    arrastre.current = { y0: e.clientY, t0: performance.now(), dy: 0 };
    hojaRef.current.style.transition = 'none';
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* el puntero ya no está activo */ }
  };
  const alMover = (e) => {
    const a = arrastre.current; const h = hojaRef.current;
    if (!a || !h) return;
    let dy = e.clientY - a.y0;
    if (dy < 0) dy = -Math.sqrt(-dy) * 3;
    a.dy = dy;
    h.style.transform = `translateY(${Math.max(dy, -24)}px)`;
    if (velaRef.current) velaRef.current.style.opacity = String(Math.max(0, 1 - Math.max(dy, 0) / h.offsetHeight));
  };
  const alSoltar = () => {
    const a = arrastre.current; const h = hojaRef.current;
    arrastre.current = null;
    if (!a || !h) return;
    const v = Math.abs(a.dy) / Math.max(1, performance.now() - a.t0);
    const cierra = a.dy > 0 && (a.dy > h.offsetHeight * 0.3 || v > 0.11);
    h.style.transition = `transform 280ms ${EASE_CAJON}`;
    if (cierra) {
      h.style.transform = 'translateY(100%)';
      if (velaRef.current) { velaRef.current.style.transition = 'opacity 240ms ease'; velaRef.current.style.opacity = '0'; }
      setTimeout(onClose, 240);
    } else {
      h.style.transform = '';
      if (velaRef.current) velaRef.current.style.opacity = '';
      setTimeout(() => { if (hojaRef.current) hojaRef.current.style.transition = ''; }, 300);
    }
  };

  const q = normalizar(busqueda).trim();
  const fijados = accesos.map((id) => modulos.find((o) => o.id === id)).filter(Boolean);
  const enAccesos = (o) => accesos.includes(o.id);
  const alTeclear = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };

  /* ---------- Piezas (funciones, no componentes: así no se remontan al re-renderizar) ---------- */
  const icono = (o, cls = 'w-5 h-5') => <IconoTrazo nombre={o.trazo} className={`${cls} text-[#6b6890] shrink-0`} grosor={1.5} />;
  const subtitulo = (o, grupo) => (
    (o.sub || grupo)
      ? <small className={`block text-[12px] leading-tight mt-0.5 ${!grupo && o.subTono === 'amb' ? 'text-[#a8650a] font-medium' : 'text-[#8f8cb0]'}`}>{grupo ? o.grupo : o.sub}</small>
      : null
  );
  const titulo = (txt) => <h3 className="text-[13px] font-semibold tracking-[-0.005em] text-[#8f8cb0] mx-1 mb-2.5">{txt}</h3>;
  const grupo = (hijos) => <div className={`bg-white rounded-2xl overflow-hidden ${FINO}`}>{hijos}</div>;

  const fila = (o, conGrupo) => {
    const fijado = enAccesos(o);
    // En las listas solo el nombre; el grupo aparece únicamente en los resultados de búsqueda.
    const texto = <span className="flex-1 min-w-0 text-[15px] font-medium tracking-[-0.012em] text-[#2d284b]">{o.etiqueta}{conGrupo ? subtitulo(o, true) : null}</span>;
    if (editando) {
      return (
        <div key={o.id} className="menu-fila relative flex items-center gap-3.5 min-h-[52px] pl-4 pr-3.5">
          {icono(o)}{texto}
          <button
            type="button"
            onClick={() => (fijado ? quitar(o.id) : fijar(o.id))}
            aria-pressed={fijado}
            aria-label={`${fijado ? 'Quitar de' : 'Fijar en'} accesos rápidos: ${o.etiqueta}`}
            className={`w-[30px] h-[30px] rounded-full grid place-items-center shrink-0 transition active:scale-90 ${fijado ? 'bg-[#5b4bd6] text-white' : 'ring-[1.5px] ring-inset ring-[#b4b1cf] text-[#8f8cb0]'}`}
          >
            <IconoTrazo nombre={fijado ? 'check' : 'plus'} className="w-[15px] h-[15px]" grosor={2} />
          </button>
        </div>
      );
    }
    return (
      <button key={o.id} type="button" onClick={() => ejecutar(o)} className="menu-fila relative flex items-center gap-3.5 w-full min-h-[52px] pl-4 pr-3.5 text-left transition-colors active:bg-[#f3f5ff]">
        {icono(o)}{texto}
        {fijado && <span className="text-[11.5px] font-semibold text-[#5b4bd6] shrink-0">Fijado</span>}
        <IconoTrazo nombre="derecha" className="w-4 h-4 text-[#b4b1cf] shrink-0" grosor={1.5} />
      </button>
    );
  };

  const filaCuenta = (o) => (
    <button key={o.etiqueta} type="button" onClick={() => ejecutar(o)} className="menu-fila relative flex items-center gap-3.5 w-full min-h-[52px] pl-4 pr-3.5 text-left transition-colors active:bg-[#f3f5ff]">
      <IconoTrazo nombre={o.trazo} className={`w-5 h-5 shrink-0 ${o.tono === 'rose' ? 'text-[#c0262d]' : o.tono === 'amber' ? 'text-[#a8650a]' : 'text-[#6b6890]'}`} grosor={1.5} />
      <span className={`flex-1 min-w-0 text-[15px] font-medium tracking-[-0.012em] ${o.tono === 'rose' ? 'text-[#c0262d]' : 'text-[#2d284b]'}`}>{o.etiqueta}</span>
      {o.insignia && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">{o.insignia}</span>}
      {o.tono !== 'rose' && <IconoTrazo nombre="derecha" className="w-4 h-4 text-[#b4b1cf] shrink-0" grosor={1.5} />}
    </button>
  );

  // Sin insignia ni rótulo: el número es el estado y una frase normal lo completa.
  const tarjetaTurno = () => {
    if (!turno) return null;
    const boton = (txt, nombreIcono, cerrado) => (
      <button
        type="button"
        onClick={() => ejecutar(turno)}
        className={`h-9 pl-4 pr-[15px] rounded-full text-[13px] font-semibold inline-flex items-center gap-[7px] shrink-0 transition active:scale-[0.97] ${cerrado ? 'bg-white text-[#473bb5] shadow-[0_8px_18px_-10px_rgba(45,40,75,0.55)]' : 'bg-white/10 text-white ring-1 ring-inset ring-white/[0.15]'}`}
      >
        <IconoTrazo nombre={nombreIcono} className="w-[15px] h-[15px]" grosor={1.5} /> {txt}
      </button>
    );
    const base = 'rounded-[22px] pt-4 pb-[15px] pl-[18px] pr-4 text-white shadow-[0_1px_0_rgba(255,255,255,0.28)_inset,0_16px_28px_-18px_rgba(91,75,214,0.85)]';
    if (turnoActivo) {
      const m = minutosDesde(turnoActivo.fecha_apertura);
      const desde = horaApertura(turnoActivo.fecha_apertura);
      const unidad = (t) => <small className="text-[15px] font-medium tracking-[-0.01em] text-white/[0.55] ml-[3px] mr-[7px]">{t}</small>;
      return (
        <section aria-label="Turno abierto" className={base} style={{ background: DEGRADADO_TURNO }}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[34px] font-semibold tracking-[-0.04em] leading-none tabular-nums">
              {m === null
                ? <span className="text-[26px] tracking-[-0.03em]">Turno abierto</span>
                : m >= 60
                  ? <>{Math.floor(m / 60)}{unidad('h')}{String(m % 60).padStart(2, '0')}{unidad('min')}</>
                  : <>{m}{unidad('min')}</>}
            </div>
            {boton('Cerrar caja', 'candado', false)}
          </div>
          <p className="mt-[9px] text-[13px] leading-snug tracking-[-0.005em] text-white/60">
            <b className="font-medium text-white/95">Turno abierto</b>{desde ? <> desde las {desde.replace(/\s/g, ' ')}</> : null}
          </p>
        </section>
      );
    }
    return (
      <section aria-label="Caja cerrada" className={base} style={{ background: DEGRADADO_TURNO }}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[26px] font-semibold tracking-[-0.03em] leading-none">Caja cerrada</div>
          {boton('Abrir turno', 'rayo', true)}
        </div>
        <p className="mt-[9px] text-[13px] leading-snug tracking-[-0.005em] text-white/60">Abre un turno para empezar a cobrar.</p>
      </section>
    );
  };

  const celda = (o, ultimaImpar) => {
    const contenido = (
      <>
        <IconoTrazo nombre={o.trazo} className="w-[22px] h-[22px] text-[#6b6890]" grosor={1.5} />
        <span className="block">
          <b className="block text-[15px] font-semibold tracking-[-0.015em] leading-tight text-[#2d284b]">{o.etiqueta}</b>
          {subtitulo(o)}
        </span>
      </>
    );
    const base = `relative flex flex-col justify-between gap-[22px] px-4 pt-[15px] pb-3.5 bg-white text-left ${ultimaImpar ? 'col-span-2 min-h-[84px]' : 'min-h-[108px]'}`;
    if (editando) {
      return (
        <div key={o.id} role="group" aria-label={o.etiqueta} className={base}>
          {contenido}
          <button
            type="button"
            onClick={() => quitar(o.id)}
            aria-label={`Quitar ${o.etiqueta} de los accesos rápidos`}
            className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-[#c0262d]/10 text-[#c0262d] grid place-items-center transition active:scale-90"
          >
            <IconoTrazo nombre="minus" className="w-[13px] h-[13px]" grosor={2.2} />
          </button>
        </div>
      );
    }
    return <button key={o.id} type="button" onClick={() => ejecutar(o)} className={`${base} transition-colors active:bg-[#f3f5ff]`}>{contenido}</button>;
  };

  /* ---------- Cuerpo ---------- */
  let cuerpo;
  if (q) {
    const resultados = opciones.filter((o) => !o.esTurno && normalizar(`${o.etiqueta} ${o.grupo} ${o.buscar || ''}`).includes(q));
    cuerpo = resultados.length === 0
      ? <p className="text-center text-sm py-10 leading-relaxed text-[#8f8cb0]"><b className="block text-[15px] font-semibold text-[#2d284b] mb-0.5">Sin resultados</b>No encontramos “{busqueda}”. Prueba con otra palabra.</p>
      : grupo(resultados.map((o) => (o.id ? fila(o, true) : filaCuenta(o))));
  } else {
    const restantes = modulos.filter((o) => editando || !enAccesos(o));
    const grupos = ORDEN_GRUPOS.map((g) => ({ g, items: restantes.filter((o) => o.grupo === g) })).filter((x) => x.items.length > 0);
    const huecos = editando ? Math.max(0, MAX - fijados.length) : 0;
    const totalCeldas = fijados.length + huecos;
    cuerpo = (
      <>
        {tarjetaTurno()}
        {fijados.length > 0 || editando ? (
          <section>
            <div className="flex items-center justify-between min-h-[22px] mx-1 mb-2.5">
              <h3 className="text-[13px] font-semibold tracking-[-0.005em] text-[#8f8cb0]">Accesos rápidos</h3>
              <button type="button" onClick={() => { setEditando((v) => !v); setAviso(''); }} className="text-[13px] font-semibold text-[#5b4bd6] px-0.5 py-1 transition-opacity active:opacity-50">
                {editando ? 'Listo' : 'Editar'}
              </button>
            </div>
            {editando && (
              <p className="text-[12.5px] leading-normal text-[#6b6890] mx-1 mb-3">{aviso || `Fija hasta ${MAX} opciones. Quedan arriba, a un toque, y se guardan en este dispositivo.`}</p>
            )}
            <div className={`grid grid-cols-2 gap-px bg-[rgba(91,75,214,0.11)] rounded-2xl overflow-hidden ${FINO}`}>
              {fijados.map((o, i) => celda(o, totalCeldas % 2 === 1 && i === totalCeldas - 1))}
              {Array.from({ length: huecos }).map((_, i) => (
                <div key={`hueco-${i}`} className={`flex flex-col items-center justify-center gap-1.5 text-center px-3 min-h-[108px] bg-[#f3f5ff] text-[12.5px] font-medium text-[#8f8cb0] ${totalCeldas % 2 === 1 && i === huecos - 1 ? 'col-span-2' : ''}`}>
                  <IconoTrazo nombre="plus" className="w-[18px] h-[18px] text-[#b4b1cf]" grosor={1.5} />
                  Toca + en una opción de abajo
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="flex justify-end">
            <button type="button" onClick={() => setEditando(true)} className="text-[13px] font-semibold text-[#5b4bd6] px-0.5 py-1 transition-opacity active:opacity-50">Elegir accesos rápidos</button>
          </div>
        )}
        {grupos.map((x) => (
          <section key={x.g}>
            {titulo(x.g)}
            {grupo(x.items.map((o) => fila(o, false)))}
          </section>
        ))}
        {cuenta.length > 0 && (
          <section>
            {titulo('Cuenta')}
            {grupo(cuenta.map(filaCuenta))}
          </section>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1" onKeyDown={alTeclear}>
      <div
        className="touch-none cursor-grab active:cursor-grabbing px-[18px] pt-[9px] pb-1 shrink-0"
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      >
        <div className="w-9 h-1 rounded-full bg-[rgba(45,40,75,0.16)] mx-auto mb-3"></div>
        <div className="flex items-center gap-[11px]">
          <span className="w-[34px] h-[34px] rounded-full grid place-items-center shrink-0 text-[13px] font-semibold tracking-[0.02em] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.18)_inset,0_6px_12px_-8px_rgba(91,75,214,0.9)]" style={{ background: 'linear-gradient(150deg, #7466e8, #473bb5)' }}>
            {iniciales(bodegaNombre)}
          </span>
          <div className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold tracking-[-0.012em] leading-tight text-[#2d284b] truncate">{bodegaNombre || 'Mi negocio'}</b>
            {nombreUsuario && <span className="block text-[12.5px] text-[#8f8cb0] mt-px truncate">{nombreUsuario}</span>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar menú" className="w-[34px] h-[34px] rounded-full grid place-items-center text-[#8f8cb0] transition active:scale-95">
            <IconoTrazo nombre="x" className="w-5 h-5" grosor={1.5} />
          </button>
        </div>
      </div>

      <div className="px-[18px] pt-2 pb-3 shrink-0">
        <div className="relative">
          <IconoTrazo nombre="buscar" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-[#8f8cb0] pointer-events-none" grosor={1.5} />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); if (e.target.value) setEditando(false); }}
            placeholder="Buscar en el menú"
            aria-label="Buscar una opción del menú"
            autoComplete="off"
            className="w-full h-11 rounded-[13px] bg-[#ebf0ff] pl-[42px] pr-10 text-[15px] tracking-[-0.008em] text-[#2d284b] placeholder:text-[#8f8cb0] outline-none transition focus:bg-white focus:ring-[1.5px] focus:ring-[#5b4bd6]"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full grid place-items-center text-[#8f8cb0]">
              <IconoTrazo nombre="x" className="w-[15px] h-[15px]" grosor={1.5} />
            </button>
          )}
        </div>
      </div>
      <div className={`h-px bg-[rgba(91,75,214,0.11)] shrink-0 transition-opacity duration-200 ${conLinea ? 'opacity-100' : 'opacity-0'}`}></div>

      <div
        onScroll={(e) => setConLinea(e.currentTarget.scrollTop > 2)}
        className="menu-cuerpo flex-1 min-h-0 overflow-y-auto overscroll-contain hide-scrollbar px-4 pt-3.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-[26px]"
      >
        {cuerpo}
      </div>
    </div>
  );
}
