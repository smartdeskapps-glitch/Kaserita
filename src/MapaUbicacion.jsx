import React from 'react';
import { TESELA, aPixeles, aCoordenadas, direccionDeCoordenadas } from './lib/ubicacion.js';

const ZOOM_MIN = 14;
const ZOOM_MAX = 19;

// Mapa para afinar la ubicación del negocio: el pin queda fijo al centro y se arrastra el mapa
// hasta ponerlo justo sobre la puerta. Sin librerías: teselas de OpenStreetMap + matemática propia.
export default function MapaUbicacion({ lat, lng, precision, direccionInicial, onConfirmar, onCerrar }) {
  const caja = React.useRef(null);
  const [tam, setTam] = React.useState({ w: 360, h: 320 });
  // Con un GPS fino se acerca más; con poca precisión se deja más vista para corregir a mano.
  const [zoom, setZoom] = React.useState(precision && precision > 60 ? 17 : 19);
  const [centro, setCentro] = React.useState({ lat, lng });
  const [arrastrando, setArrastrando] = React.useState(false);
  const [buscando, setBuscando] = React.useState(false);
  // Lugar conocido más cercano al pin: { direccion, metros }, o null si no se pudo consultar.
  const [lugar, setLugar] = React.useState(direccionInicial ? { direccion: direccionInicial, metros: 0 } : null);
  const [fallo, setFallo] = React.useState(false);
  const inicioArrastre = React.useRef(null);
  const turno = React.useRef(0);
  // Si ya hay una dirección para el punto inicial no hace falta buscarla de nuevo al abrir.
  const primera = React.useRef(!!direccionInicial);

  React.useEffect(() => {
    const el = caja.current;
    if (!el) return undefined;
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight });
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cuando el mapa se queda quieto, se busca la dirección del punto del centro.
  React.useEffect(() => {
    if (primera.current) { primera.current = false; return undefined; }
    if (arrastrando) return undefined;
    const mio = ++turno.current;
    setBuscando(true);
    const t = setTimeout(async () => {
      const d = await direccionDeCoordenadas(centro.lat, centro.lng);
      if (mio !== turno.current) return;
      setBuscando(false);
      setFallo(!d);
      setLugar(d);
    }, 450);
    return () => { clearTimeout(t); };
  }, [centro, arrastrando]);

  const c = aPixeles(centro.lat, centro.lng, zoom);
  const izq = c.x - tam.w / 2;
  const arr = c.y - tam.h / 2;
  const n = 2 ** zoom;
  // Círculo del margen de error del GPS (metros -> píxeles según el zoom y la latitud).
  const origen = aPixeles(lat, lng, zoom);
  const lejos = !!lugar && lugar.metros > 60;
  const radioPx = precision ? precision / ((156543.03392 * Math.cos((lat * Math.PI) / 180)) / n) : 0;
  const tesel = [];
  for (let ty = Math.floor(arr / TESELA); ty <= Math.floor((arr + tam.h) / TESELA); ty += 1) {
    for (let tx = Math.floor(izq / TESELA); tx <= Math.floor((izq + tam.w) / TESELA); tx += 1) {
      if (ty < 0 || ty >= n) continue;
      const tx2 = ((tx % n) + n) % n;
      tesel.push({ k: `${zoom}/${tx}/${ty}`, src: `https://tile.openstreetmap.org/${zoom}/${tx2}/${ty}.png`, x: tx * TESELA - izq, y: ty * TESELA - arr });
    }
  }

  const alPresionar = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    inicioArrastre.current = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y };
    setArrastrando(true);
  };
  const alMover = (e) => {
    const i = inicioArrastre.current;
    if (!i) return;
    setCentro(aCoordenadas(i.cx - (e.clientX - i.x), i.cy - (e.clientY - i.y), zoom));
  };
  const alSoltar = () => { inicioArrastre.current = null; setArrastrando(false); };
  const cambiarZoom = (d) => setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + d)));

  return (
    <div className="fixed inset-0 z-[70] bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-md rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 pt-4 pb-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] text-[#2d284b] leading-tight">Ubica tu <b className="font-bold">negocio</b></h3>
            <p className="text-xs text-[#8f8cb0] mt-0.5">Arrastra el mapa hasta que el pin quede sobre tu puerta.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className="w-[34px] h-[34px] rounded-full text-[#8f8cb0] hover:bg-[#f3f5ff] grid place-items-center shrink-0">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div
          ref={caja}
          className="relative h-[320px] bg-[#e8ebf4] overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={alPresionar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          {tesel.map((t) => (
            <img key={t.k} src={t.src} alt="" draggable={false} width={TESELA} height={TESELA} className="absolute max-w-none pointer-events-none" style={{ left: t.x, top: t.y }} />
          ))}

          {radioPx >= 6 && (
            <span
              className="absolute rounded-full bg-[#5b4bd6]/10 border border-[#5b4bd6]/35 pointer-events-none"
              style={{ left: origen.x - izq - radioPx, top: origen.y - arr - radioPx, width: radioPx * 2, height: radioPx * 2 }}
            ></span>
          )}
          {/* Pin fijo al centro: sube un poco mientras se arrastra y cae al soltar */}
          <div className="absolute left-1/2 top-1/2 pointer-events-none" style={{ transform: 'translate(-50%, -100%)' }}>
            <div style={{ transform: arrastrando ? 'translateY(-10px) scale(1.06)' : 'translateY(0)', transition: 'transform 180ms cubic-bezier(0.23, 1, 0.32, 1)' }}>
              <svg width="38" height="48" viewBox="0 0 38 48" aria-hidden="true">
                <path d="M19 47C19 47 3 29.500 3 18a16 16 0 0 1 32 0c0 11.500-16 29-16 29Z" fill="#5b4bd6" stroke="#fff" strokeWidth="2.500" />
                <circle cx="19" cy="18" r="6" fill="#fff" />
              </svg>
            </div>
          </div>
          <span
            className="absolute left-1/2 top-1/2 w-3 h-1.5 rounded-full bg-black/25 pointer-events-none"
            style={{ transform: `translate(-50%, -50%) scale(${arrastrando ? 0.7 : 1})`, transition: 'transform 180ms cubic-bezier(0.23, 1, 0.32, 1)' }}
          ></span>

          <div className="absolute right-3 top-3 flex flex-col rounded-2xl overflow-hidden bg-white shadow-[0_4px_14px_-4px_rgba(45,40,75,0.35)]" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Acercar" onClick={() => cambiarZoom(1)} disabled={zoom >= ZOOM_MAX} className="w-10 h-10 grid place-items-center text-[#2d284b] hover:bg-[#f3f5ff] disabled:opacity-35"><i className="fa-solid fa-plus text-sm"></i></button>
            <span className="h-px bg-[#eef1fd]"></span>
            <button type="button" aria-label="Alejar" onClick={() => cambiarZoom(-1)} disabled={zoom <= ZOOM_MIN} className="w-10 h-10 grid place-items-center text-[#2d284b] hover:bg-[#f3f5ff] disabled:opacity-35"><i className="fa-solid fa-minus text-sm"></i></button>
          </div>

          <p className="absolute left-2 bottom-1.5 text-[10px] text-stone-600 bg-white/75 rounded px-1.5 pointer-events-none">© OpenStreetMap</p>
        </div>

        <div className="px-5 pt-4 pb-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8f8cb0]">{lejos ? 'Lugar registrado más cercano' : 'Dirección del pin'}</p>
          <p className={`mt-1 text-[15px] font-semibold min-h-[22px] break-words transition-opacity ${buscando ? 'opacity-50' : ''} ${lejos ? 'text-[#8f8cb0]' : 'text-[#2d284b]'}`}>
            {lugar ? lugar.direccion : (buscando ? 'Buscando dirección...' : fallo ? 'No se pudo consultar la dirección ahora' : 'Sin dirección registrada en este punto')}
          </p>
          <p className="mt-1 text-[12px] text-[#6b6890]">
            {lejos
              ? `Queda a unos ${lugar.metros} m del pin, así que no se usa como dirección. Se guarda el punto exacto y se mantiene la dirección que ya tenías.`
              : fallo
                ? 'El servicio de direcciones está ocupado. Espera unos segundos y mueve un poco el mapa. El punto exacto se guarda igual.'
                : lugar && lugar.metros > 15
                  ? `Dirección cercana, a unos ${lugar.metros} m del pin.`
                  : ''}
          </p>
          <p className="mt-1.5 text-[11.5px] text-[#8f8cb0] tabular-nums"><i className="fa-solid fa-location-dot mr-1.5"></i>Pin: {centro.lat.toFixed(6)}, {centro.lng.toFixed(6)}</p>
          {precision ? (
            <p className={`mt-2 text-[12px] ${precision > 50 ? 'text-[#a8650a]' : 'text-[#6b6890]'}`}>
              <i className="fa-solid fa-satellite-dish mr-1.5"></i>
              Precisión del GPS: unos {precision} m{precision > 50 ? '. Mueve el mapa para corregirla.' : '. El círculo marca el margen de error.'}
            </p>
          ) : null}
          <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-2.5">
            <button type="button" onClick={onCerrar} className="h-12 rounded-full bg-[#f3f5ff] text-[#2d284b] font-bold text-sm transition active:scale-[0.97]">Cancelar</button>
            <button
              type="button"
              disabled={buscando || arrastrando}
              onClick={() => onConfirmar(lugar && !lejos ? lugar.direccion : '', { lat: Number(centro.lat.toFixed(6)), lng: Number(centro.lng.toFixed(6)) })}
              className="h-12 rounded-full text-white font-bold text-sm bg-gradient-to-br from-[#7466e8] to-[#5b4bd6] shadow-[0_10px_20px_-10px_rgba(91,75,214,0.8)] transition active:scale-[0.97] disabled:opacity-50 disabled:shadow-none"
            >
              Confirmar ubicación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
