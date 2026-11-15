import React from 'react';
import { TESELA, aPixeles, aCoordenadas, direccionDeCoordenadas, componerDireccion, partirDireccion } from './lib/ubicacion.js';

const ZOOM_MIN = 14;
const ZOOM_MAX = 19;
const zoomPara = (precision) => (precision && precision > 60 ? 17 : 19);

// Mapa para ubicar el negocio. Abre al instante en el punto del GPS y se corrige solo mientras el
// GPS afina; si la persona toca el mapa, deja de moverse. El pin queda fijo al centro: se arrastra
// el mapa hasta ponerlo sobre la puerta y la dirección se rellena sola. Sin librerías: teselas de
// OpenStreetMap y matemática propia.
export default function MapaUbicacion({ lat, lng, precision, afinando, direccionInicial, onConfirmar, onCerrar }) {
  const caja = React.useRef(null);
  const [tam, setTam] = React.useState({ w: 360, h: 320 });
  const [zoom, setZoom] = React.useState(zoomPara(precision));
  const [centro, setCentro] = React.useState({ lat, lng });
  const [arrastrando, setArrastrando] = React.useState(false);
  const [buscando, setBuscando] = React.useState(false);
  // La calle se rellena sola y sigue al pin; el número de puerta se escribe aparte porque el mapa
  // abierto casi nunca lo tiene (si lo trae, también se rellena).
  const inicial = React.useMemo(() => partirDireccion(direccionInicial), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [calle, setCalle] = React.useState(inicial.calle);
  const [numero, setNumero] = React.useState(inicial.numero);
  const [zona, setZona] = React.useState(inicial.zona);
  const inicioArrastre = React.useRef(null);
  const turno = React.useRef(0);
  // Con una dirección ya guardada no se pisa lo escrito; con una lectura nueva de GPS sí se rellena.
  const calleEditada = React.useRef(!!inicial.calle);
  const numeroEditado = React.useRef(!!inicial.numero);
  const ultimaCalle = React.useRef(null);
  // En cuanto la persona toca el mapa, las lecturas nuevas del GPS ya no lo mueven.
  const tocado = React.useRef(false);

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

  // El GPS afina: mientras nadie haya tocado el mapa, el pin sigue la lectura más precisa.
  React.useEffect(() => {
    if (tocado.current) return;
    setCentro((c) => (c.lat === lat && c.lng === lng ? c : { lat, lng }));
    setZoom(zoomPara(precision));
  }, [lat, lng, precision]);

  // Cuando el mapa se queda quieto, se busca la dirección del punto del centro.
  React.useEffect(() => {
    if (arrastrando) return undefined;
    const mio = ++turno.current;
    setBuscando(true);
    const t = setTimeout(async () => {
      const d = await direccionDeCoordenadas(centro.lat, centro.lng);
      if (mio !== turno.current) return;
      setBuscando(false);
      if (!d) return;
      // Si el pin pasó a otra calle, lo escrito antes ya no vale: calle y número vuelven a rellenarse solos.
      if (ultimaCalle.current !== null && d.calle !== ultimaCalle.current) {
        calleEditada.current = false;
        numeroEditado.current = false;
      }
      ultimaCalle.current = d.calle;
      if (!calleEditada.current) setCalle(d.calle);
      if (!numeroEditado.current) setNumero(d.numero);
      setZona(d.zona);
    }, 450);
    return () => { clearTimeout(t); turno.current += 1; };
  }, [centro, arrastrando]);

  const c = aPixeles(centro.lat, centro.lng, zoom);
  const izq = c.x - tam.w / 2;
  const arr = c.y - tam.h / 2;
  const n = 2 ** zoom;
  // Círculo del margen de error del GPS (metros -> píxeles según el zoom y la latitud).
  const origen = aPixeles(lat, lng, zoom);
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
    tocado.current = true;
    inicioArrastre.current = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y };
    setArrastrando(true);
  };
  const alMover = (e) => {
    const i = inicioArrastre.current;
    if (!i) return;
    setCentro(aCoordenadas(i.cx - (e.clientX - i.x), i.cy - (e.clientY - i.y), zoom));
  };
  const alSoltar = () => { inicioArrastre.current = null; setArrastrando(false); };
  const cambiarZoom = (d) => { tocado.current = true; setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + d))); };

  const direccion = componerDireccion(calle, numero, zona);

  return (
    <div className="fixed inset-0 z-[70] bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-md rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 pt-4 pb-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] text-[#2d284b] leading-tight">Ubica tu <b className="font-bold">negocio</b></h3>
            <p className="text-xs text-[#8f8cb0] mt-0.5">Mueve el mapa hasta que el pin quede sobre tu puerta.</p>
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

          {precision ? (
            <p className="absolute left-3 top-3 h-7 px-2.5 rounded-full bg-white/90 text-[11.5px] font-semibold text-[#5a5684] inline-flex items-center gap-1.5 shadow-[0_2px_8px_-2px_rgba(45,40,75,0.3)] pointer-events-none">
              {afinando && <i className="fa-solid fa-circle-notch fa-spin text-[10px] text-[#5b4bd6]"></i>}
              GPS ±{precision} m
            </p>
          ) : null}

          <div className="absolute right-3 top-3 flex flex-col rounded-2xl overflow-hidden bg-white shadow-[0_4px_14px_-4px_rgba(45,40,75,0.35)]" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Acercar" onClick={() => cambiarZoom(1)} disabled={zoom >= ZOOM_MAX} className="w-10 h-10 grid place-items-center text-[#2d284b] hover:bg-[#f3f5ff] disabled:opacity-35"><i className="fa-solid fa-plus text-sm"></i></button>
            <span className="h-px bg-[#eef1fd]"></span>
            <button type="button" aria-label="Alejar" onClick={() => cambiarZoom(-1)} disabled={zoom <= ZOOM_MIN} className="w-10 h-10 grid place-items-center text-[#2d284b] hover:bg-[#f3f5ff] disabled:opacity-35"><i className="fa-solid fa-minus text-sm"></i></button>
          </div>

          <p className="absolute left-2 bottom-1.5 text-[10px] text-stone-600 bg-white/75 rounded px-1.5 pointer-events-none">© OpenStreetMap</p>
        </div>

        <div className="px-5 pt-4 pb-5">
          <div className="grid grid-cols-[1fr_96px] gap-2.5">
            <label className="block min-w-0">
              <span className="text-[12px] font-semibold text-[#6b6890]">Calle o avenida</span>
              <input
                type="text"
                value={calle}
                onChange={(e) => { calleEditada.current = true; setCalle(e.target.value); }}
                placeholder={buscando ? 'Buscando...' : 'Escribe la calle'}
                className={`mt-1 w-full h-12 px-3.5 rounded-2xl bg-[#f7f9ff] ring-1 ring-[#5b4bd6]/10 text-[15px] font-semibold text-[#2d284b] placeholder:font-normal placeholder:text-[#9290a2] focus:outline-none focus:ring-2 focus:ring-[#5b4bd6]/45 transition-opacity ${buscando ? 'opacity-60' : ''}`}
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-[#6b6890]">Número</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={numero}
                onChange={(e) => { numeroEditado.current = true; setNumero(e.target.value); }}
                placeholder="185"
                className="mt-1 w-full h-12 px-3 rounded-2xl bg-[#f7f9ff] ring-1 ring-[#5b4bd6]/10 text-[15px] font-bold text-[#2d284b] text-center placeholder:font-normal placeholder:text-[#b9b7c9] focus:outline-none focus:ring-2 focus:ring-[#5b4bd6]/45"
              />
            </label>
          </div>
          <p className="mt-2 text-[12.5px] text-[#6b6890] min-h-[18px] break-words">
            {calle.trim() && !numero.trim() ? 'Escribe el número de tu puerta.' : direccion}
          </p>
          <div className="mt-2 grid grid-cols-[1fr_1.4fr] gap-2.5">
            <button type="button" onClick={onCerrar} className="h-12 rounded-full bg-[#f3f5ff] text-[#2d284b] font-bold text-sm transition active:scale-[0.97]">Cancelar</button>
            <button
              type="button"
              disabled={arrastrando || buscando}
              onClick={() => onConfirmar(calle.trim() ? direccion : '', { lat: Number(centro.lat.toFixed(6)), lng: Number(centro.lng.toFixed(6)) })}
              className="h-12 rounded-full text-white font-bold text-sm bg-gradient-to-br from-[#7466e8] to-[#5b4bd6] shadow-[0_10px_20px_-10px_rgba(91,75,214,0.8)] transition active:scale-[0.97] disabled:opacity-50 disabled:shadow-none"
            >
              {buscando ? 'Buscando dirección...' : 'Confirmar ubicación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
