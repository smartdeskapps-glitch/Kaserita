import React, { useEffect, useRef, useState } from 'react';
import { IconoTrazo } from '../pos/componentes.jsx';
import { normalizarBusqueda as normalizar } from '../lib/busqueda.js';

// Menú del celular: tarjeta de turno, 4 accesos rápidos que cada persona elige (se guardan en
// este dispositivo) y el resto de opciones por tema. La versión de escritorio sigue siendo la
// paleta de comandos (PaletaMenu); las dos leen la misma lista de opciones.
const CLAVE = 'kaserita-menu-accesos';
const MAX = 4;
// Orden de preferencia: de aquí salen los 4 accesos mientras la persona no elija los suyos.
const POR_DEFECTO = ['fiados', 'historial', 'entrada', 'merma', 'toma', 'dashboard'];
const ORDEN_GRUPOS = ['Ventas y caja', 'Inventario', 'Administración', 'Entradas', 'Catálogo'];

const leerAccesos = (disponibles) => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (Array.isArray(guardado)) return guardado.filter((id) => disponibles.includes(id)).slice(0, MAX);
  } catch { /* sin almacenamiento: se usan los de por defecto */ }
  return POR_DEFECTO.filter((id) => disponibles.includes(id)).slice(0, MAX);
};

const horaApertura = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
};

const TONO_SUB = { amb: 'text-[#a8650a] font-semibold', ok: 'text-[#0f7b4a] font-semibold' };
const SOMBRA_TARJETA = 'shadow-[0_1px_0_#dde4fa,0_8px_18px_-14px_rgba(45,40,75,0.35)]';

export default function MenuMovil({ opciones, busqueda, setBusqueda, onClose, turnoActivo, nombreCajero }) {
  const modulos = opciones.filter((o) => o.id);
  const cuenta = opciones.filter((o) => o.grupo === 'Cuenta');
  const turno = opciones.find((o) => o.esTurno);
  const idsDisponibles = modulos.map((o) => o.id);

  const [accesos, setAccesos] = useState(() => leerAccesos(idsDisponibles));
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState('');
  const temporizador = useRef(null);
  useEffect(() => () => clearTimeout(temporizador.current), []);

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

  const q = normalizar(busqueda).trim();
  const fijados = accesos.map((id) => modulos.find((o) => o.id === id)).filter(Boolean);
  const enAccesos = (o) => accesos.includes(o.id);

  const alTeclear = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };

  const Subtitulo = ({ o, grupo }) => (
    o.sub || grupo
      ? <small className={`block text-[11.5px] leading-tight mt-0.5 ${!grupo && TONO_SUB[o.subTono] ? TONO_SUB[o.subTono] : 'text-[#8f8cb0] font-medium'}`}>{grupo ? o.grupo : o.sub}</small>
      : null
  );

  const Fila = ({ o, conGrupo }) => {
    const fijado = enAccesos(o);
    const icono = (
      <span className="w-[34px] h-[34px] rounded-[11px] bg-[#f1efff] text-[#5b4bd6] grid place-items-center shrink-0">
        <IconoTrazo nombre={o.trazo} className="w-[18px] h-[18px]" />
      </span>
    );
    if (editando) {
      return (
        <div className="flex items-center gap-3 min-h-[54px] px-3.5 py-2">
          {icono}
          <span className="flex-1 min-w-0 text-[14.5px] font-semibold text-[#2d284b]">{o.etiqueta}<Subtitulo o={o} grupo={conGrupo} /></span>
          <button
            type="button"
            onClick={() => (fijado ? quitar(o.id) : fijar(o.id))}
            aria-pressed={fijado}
            aria-label={`${fijado ? 'Quitar de' : 'Fijar en'} accesos rápidos: ${o.etiqueta}`}
            className={`w-9 h-9 rounded-full grid place-items-center shrink-0 transition hover:bg-[#ebf0ff] ${fijado ? 'text-[#e0a21b]' : 'text-[#b4b1cf]'}`}
          >
            <IconoTrazo nombre="estrella" className={`w-[19px] h-[19px] ${fijado ? 'fill-current' : ''}`} />
          </button>
        </div>
      );
    }
    return (
      <button type="button" onClick={() => ejecutar(o)} className="w-full flex items-center gap-3 min-h-[54px] px-3.5 py-2 text-left active:bg-[#f3f5ff] transition-colors">
        {icono}
        <span className="flex-1 min-w-0 text-[14.5px] font-semibold text-[#2d284b]">{o.etiqueta}<Subtitulo o={o} grupo={conGrupo} /></span>
        {fijado && <span className="text-[11px] font-bold text-[#473bb5] bg-[#f1efff] px-2.5 py-0.5 rounded-full shrink-0">★ Fijado</span>}
        <IconoTrazo nombre="derecha" className="w-[18px] h-[18px] text-[#c3c0da] shrink-0" />
      </button>
    );
  };

  const Lista = ({ children }) => (
    <div className={`bg-white rounded-[22px] overflow-hidden divide-y divide-[#eef1fd] ${SOMBRA_TARJETA}`}>{children}</div>
  );
  const Titulo = ({ children }) => (
    <h3 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[#8f8cb0] mb-2.5">{children}</h3>
  );

  const tarjetaTurno = () => {
    if (!turno) return null;
    if (turnoActivo) {
      const desde = horaApertura(turnoActivo.fecha_apertura);
      return (
        <div className="flex items-center gap-3 pl-3.5 pr-3 py-3 rounded-[22px] bg-[#f3f5ff] ring-1 ring-[#dde4fa]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] shadow-[0_0_0_4px_rgba(22,163,74,0.18)] shrink-0"></span>
          <div className="flex-1 min-w-0">
            <b className="block text-[14px] font-bold text-[#2d284b]">Turno abierto</b>
            <span className="block text-[12px] text-[#8f8cb0] mt-0.5 truncate">{[nombreCajero, desde && `desde ${desde}`].filter(Boolean).join(' · ') || 'Caja en curso'}</span>
          </div>
          <button type="button" onClick={() => ejecutar(turno)} className="h-10 px-4 rounded-full bg-white text-[#c0262d] text-[12.5px] font-bold inline-flex items-center gap-1.5 shrink-0 shadow-[0_1px_0_#dde4fa,0_6px_14px_-10px_rgba(45,40,75,0.4)] active:scale-[0.96] transition">
            <IconoTrazo nombre="candado" className="w-4 h-4" /> Cerrar caja
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 p-3.5 rounded-[22px] bg-gradient-to-br from-[#7466e8] via-[#5b4bd6] to-[#473bb5] shadow-[0_14px_26px_-16px_rgba(91,75,214,0.9)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#f0b24a] shadow-[0_0_0_4px_rgba(240,178,74,0.25)] shrink-0"></span>
        <div className="flex-1 min-w-0">
          <b className="block text-[14px] font-bold text-white">Caja cerrada</b>
          <span className="block text-[12px] text-white/75 mt-0.5">Abre un turno para empezar a cobrar</span>
        </div>
        <button type="button" onClick={() => ejecutar(turno)} className="h-11 px-[18px] rounded-full bg-white text-[#473bb5] text-[13.5px] font-bold inline-flex items-center gap-1.5 shrink-0 active:scale-[0.96] transition">
          <IconoTrazo nombre="rayo" className="w-4 h-4" /> Abrir turno
        </button>
      </div>
    );
  };

  const tile = (o) => {
    const contenido = (
      <>
        <span className="w-[42px] h-[42px] rounded-[14px] bg-[#f1efff] text-[#5b4bd6] grid place-items-center">
          <IconoTrazo nombre={o.trazo} className="w-[22px] h-[22px]" />
        </span>
        <span className="block">
          <b className="block text-[14.5px] font-bold text-[#2d284b] tracking-tight leading-tight">{o.etiqueta}</b>
          <Subtitulo o={o} />
        </span>
      </>
    );
    const base = `relative flex flex-col gap-3 min-h-[112px] p-3.5 rounded-[24px] bg-white text-left ${SOMBRA_TARJETA}`;
    if (editando) {
      return (
        <div key={o.id} className={`${base} menu-tile-edita`}>
          {contenido}
          <button type="button" onClick={() => quitar(o.id)} aria-label={`Quitar ${o.etiqueta} de los accesos rápidos`} className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-[#fde0e5] text-[#c0262d] grid place-items-center">
            <IconoTrazo nombre="x" className="w-3.5 h-3.5" grosor={2.6} />
          </button>
        </div>
      );
    }
    return (
      <button key={o.id} type="button" onClick={() => ejecutar(o)} className={`${base} active:scale-[0.97] transition-transform`}>{contenido}</button>
    );
  };

  let cuerpo;
  if (q) {
    const resultados = opciones.filter((o) => !o.esTurno && normalizar(`${o.etiqueta} ${o.grupo} ${o.buscar || ''}`).includes(q));
    cuerpo = resultados.length === 0
      ? <p className="text-center text-sm py-10 text-[#8f8cb0]"><b className="block text-[15px] text-[#2d284b] mb-1">Sin resultados</b>No encontramos “{busqueda}”. Prueba con otra palabra.</p>
      : <Lista>{resultados.map((o) => (o.id ? <Fila key={o.id} o={o} conGrupo /> : (
        <button key={o.etiqueta} type="button" onClick={() => ejecutar(o)} className="w-full flex items-center gap-3 min-h-[54px] px-3.5 py-2 text-left">
          <span className="w-[34px] h-[34px] rounded-[11px] bg-[#f1efff] text-[#5b4bd6] grid place-items-center shrink-0"><IconoTrazo nombre={o.trazo} className="w-[18px] h-[18px]" /></span>
          <span className="flex-1 min-w-0 text-[14.5px] font-semibold text-[#2d284b]">{o.etiqueta}</span>
        </button>
      )))}</Lista>;
  } else {
    const restantes = modulos.filter((o) => editando || !enAccesos(o));
    const grupos = ORDEN_GRUPOS.map((g) => ({ g, items: restantes.filter((o) => o.grupo === g) })).filter((x) => x.items.length > 0);
    cuerpo = (
      <>
        {tarjetaTurno()}
        {fijados.length > 0 || editando ? (
          <section>
            <div className="flex items-center justify-between min-h-[30px] mb-2.5">
              <h3 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[#8f8cb0]">Accesos rápidos</h3>
              <button type="button" onClick={() => { setEditando((v) => !v); setAviso(''); }} className={`h-[30px] px-3.5 rounded-full text-[12.5px] font-bold transition ${editando ? 'bg-[#5b4bd6] text-white' : 'bg-[#f1efff] text-[#473bb5] hover:bg-[#dde4fa]'}`}>
                {editando ? 'Listo' : 'Editar'}
              </button>
            </div>
            {editando && (
              <p className="flex items-start gap-2 text-[12.5px] leading-snug text-[#473bb5] bg-[#f1efff] rounded-2xl px-3 py-2.5 mb-2.5">
                <IconoTrazo nombre="info" className="w-4 h-4 mt-px shrink-0" />
                <span>{aviso || `Fija hasta ${MAX} opciones con ★. Quedan arriba, siempre a un toque. Se guardan en este dispositivo.`}</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {fijados.map(tile)}
              {editando && Array.from({ length: Math.max(0, MAX - fijados.length) }).map((_, i) => (
                <div key={`vacio-${i}`} className="min-h-[112px] rounded-[24px] border-2 border-dashed border-[#c5bcff] bg-[#f3f5ff] grid place-items-center text-center px-3 text-[12.5px] font-semibold text-[#473bb5]">Toca ★ en una opción de abajo para fijarla</div>
              ))}
            </div>
          </section>
        ) : (
          <div className="flex justify-end">
            <button type="button" onClick={() => setEditando(true)} className="h-[30px] px-3.5 rounded-full text-[12.5px] font-bold bg-[#f1efff] text-[#473bb5] hover:bg-[#dde4fa] transition">Elegir accesos rápidos</button>
          </div>
        )}
        {grupos.map((x) => (
          <section key={x.g}>
            <Titulo>{x.g}</Titulo>
            <Lista>{x.items.map((o) => <Fila key={o.id} o={o} />)}</Lista>
          </section>
        ))}
        {cuenta.length > 0 && (
          <section>
            <Titulo>Cuenta</Titulo>
            <Lista>
              {cuenta.map((o) => (
                <button key={o.etiqueta} type="button" onClick={() => ejecutar(o)} className="w-full flex items-center gap-3 min-h-[54px] px-3.5 py-2 text-left active:bg-[#f3f5ff] transition-colors">
                  <span className={`w-[34px] h-[34px] rounded-[11px] grid place-items-center shrink-0 ${o.tono === 'rose' ? 'bg-[#fde0e5] text-[#c0262d]' : o.tono === 'amber' ? 'bg-[#fdf0d8] text-[#a8650a]' : 'bg-[#f1efff] text-[#5b4bd6]'}`}>
                    <IconoTrazo nombre={o.trazo} className="w-[18px] h-[18px]" />
                  </span>
                  <span className={`flex-1 min-w-0 text-[14.5px] font-semibold ${o.tono === 'rose' ? 'text-[#c0262d]' : 'text-[#2d284b]'}`}>{o.etiqueta}</span>
                  {o.insignia && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">{o.insignia}</span>}
                  <IconoTrazo nombre="derecha" className="w-[18px] h-[18px] text-[#c3c0da] shrink-0" />
                </button>
              ))}
            </Lista>
          </section>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1" onKeyDown={alTeclear}>
      <div className="px-4 pt-3 pb-2.5 shrink-0">
        <div className="relative">
          <IconoTrazo nombre="buscar" className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8f8cb0] pointer-events-none" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); if (e.target.value) setEditando(false); }}
            placeholder="Busca una opción…"
            aria-label="Buscar una opción del menú"
            autoComplete="off"
            className="w-full h-12 rounded-full bg-[#f3f5ff] pl-11 pr-11 text-[14.5px] text-[#2d284b] placeholder:text-[#8f8cb0] outline-none focus:ring-2 focus:ring-[#c5bcff] transition"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full grid place-items-center text-[#8f8cb0] hover:bg-[#ebf0ff]">
              <IconoTrazo nombre="x" className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain hide-scrollbar px-4 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-[18px]">
        {cuerpo}
      </div>
    </div>
  );
}
