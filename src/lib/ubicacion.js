// "Usar mi ubicación actual": pide el GPS del dispositivo y lo convierte en una dirección
// escrita (calle y número, distrito) con el geocodificador abierto de OpenStreetMap.
// El resultado solo rellena el campo de dirección: la persona puede corregirlo antes de guardar.

const URL_INVERSA = 'https://nominatim.openstreetmap.org/reverse';

// Arma "Av. Los Álamos 245, San Miguel" con lo que devuelva el geocodificador.
export function direccionDesdeRespuesta(r) {
  const a = (r && r.address) || {};
  const calle = [a.road || a.pedestrian || a.footway || '', a.house_number || ''].filter(Boolean).join(' ').trim();
  const zona = a.suburb || a.neighbourhood || a.city_district || a.quarter || '';
  const ciudad = a.city || a.town || a.village || a.municipality || '';
  const partes = [calle, zona, zona && ciudad && zona !== ciudad ? '' : ciudad].filter(Boolean);
  if (partes.length) return partes.join(', ');
  const completa = String((r && r.display_name) || '').split(',').slice(0, 3).join(',').trim();
  return completa;
}

function obtenerPosicion() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Tu dispositivo no permite obtener la ubicación.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (e) => {
      if (e && e.code === 1) reject(new Error('No diste permiso para usar tu ubicación. Actívalo en los ajustes del navegador e inténtalo de nuevo.'));
      else if (e && e.code === 3) reject(new Error('Tardó demasiado en encontrar tu ubicación. Acércate a una ventana e inténtalo de nuevo.'));
      else reject(new Error('No se pudo obtener tu ubicación. Revisa que el GPS esté activo.'));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
}

// Convierte coordenadas en una dirección escrita. Devuelve '' si no se pudo.
export async function direccionDeCoordenadas(lat, lng) {
  try {
    const ctl = new AbortController();
    const reloj = setTimeout(() => ctl.abort(), 10000);
    const resp = await fetch(`${URL_INVERSA}?format=jsonv2&addressdetails=1&zoom=18&accept-language=es&lat=${lat}&lon=${lng}`, { signal: ctl.signal });
    clearTimeout(reloj);
    if (!resp.ok) return '';
    return direccionDesdeRespuesta(await resp.json());
  } catch {
    return '';
  }
}

// Devuelve { direccion, lat, lng }. Lanza un Error con texto en español si algo falla.
// Si no se logra la dirección escrita, igual devuelve las coordenadas (direccion = '').
export async function ubicacionActual() {
  const pos = await obtenerPosicion();
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  return { direccion: await direccionDeCoordenadas(lat, lng), lat, lng };
}

// Matemática del mapa (teselas de 256 px, proyección Web Mercator).
export const TESELA = 256;
export function aPixeles(lat, lng, z) {
  const n = TESELA * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
}
export function aCoordenadas(x, y, z) {
  const n = TESELA * 2 ** z;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lat, lng };
}
