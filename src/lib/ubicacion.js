// "Usar mi ubicación actual": pide el GPS del dispositivo y lo convierte en una dirección
// escrita (calle y número, distrito) con el geocodificador abierto de OpenStreetMap.
// El resultado solo rellena el campo de dirección: la persona puede corregirlo antes de guardar.

const URL_INVERSA = 'https://nominatim.openstreetmap.org/reverse';

// Arma "Av. Los Álamos 245, San Miguel" con lo que devuelva el geocodificador.
// Con `sinNumero` omite el número de puerta (cuando pertenece a un local vecino, no al punto).
export function direccionDesdeRespuesta(r, sinNumero = false) {
  const a = (r && r.address) || {};
  const calle = [a.road || a.pedestrian || a.footway || '', sinNumero ? '' : (a.house_number || '')].filter(Boolean).join(' ').trim();
  const zona = a.suburb || a.neighbourhood || a.city_district || a.quarter || '';
  const ciudad = a.city || a.town || a.village || a.municipality || '';
  // El distrito y la ciudad a veces se llaman igual ("San Miguel"): se escribe una sola vez.
  const lugares = [zona, ciudad].filter((x, i, todos) => x && todos.indexOf(x) === i);
  const partes = [calle, ...lugares].filter(Boolean);
  if (partes.length) return partes.join(', ');
  const completa = String((r && r.display_name) || '').split(',').slice(0, 3).join(',').trim();
  return completa;
}

// Escucha el GPS unos segundos y se queda con la lectura más precisa: la primera lectura
// suele salir de antenas o wifi y errar por cientos de metros; el GPS real tarda en afinar.
const PRECISION_BUENA = 12; // metros: con esto se corta la espera
const ESPERA_MAXIMA = 14000;
function obtenerPosicion(alMejorar) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Tu dispositivo no permite obtener la ubicación.'));
      return;
    }
    let mejor = null;
    let id = null;
    let reloj = null;
    const terminar = () => {
      if (id !== null) navigator.geolocation.clearWatch(id);
      clearTimeout(reloj);
      if (mejor) resolve(mejor);
    };
    const fallar = (e) => {
      if (id !== null) navigator.geolocation.clearWatch(id);
      clearTimeout(reloj);
      if (mejor) { resolve(mejor); return; }
      if (e && e.code === 1) reject(new Error('No diste permiso para usar tu ubicación. Actívalo en los ajustes del navegador e inténtalo de nuevo.'));
      else if (e && e.code === 3) reject(new Error('Tardó demasiado en encontrar tu ubicación. Acércate a una ventana e inténtalo de nuevo.'));
      else reject(new Error('No se pudo obtener tu ubicación. Revisa que el GPS esté activo.'));
    };
    id = navigator.geolocation.watchPosition((pos) => {
      if (!mejor || pos.coords.accuracy < mejor.coords.accuracy) {
        mejor = pos;
        if (alMejorar) alMejorar(pos.coords.accuracy);
      }
      if (pos.coords.accuracy <= PRECISION_BUENA) terminar();
    }, fallar, { enableHighAccuracy: true, timeout: ESPERA_MAXIMA, maximumAge: 0 });
    reloj = setTimeout(() => {
      if (mejor) terminar();
      else fallar({ code: 3 });
    }, ESPERA_MAXIMA);
  });
}

// Distancia en metros entre dos puntos (fórmula del haversine).
export function metrosEntre(lat1, lng1, lat2, lng2) {
  const rad = (g) => (g * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return Math.round(12742000 * Math.asin(Math.sqrt(a)));
}

// Convierte coordenadas en la dirección registrada más cercana. El servicio devuelve el lugar
// conocido más próximo al punto (un local, una calle), no la dirección exacta del punto, así
// que también se devuelve a cuántos metros queda ese lugar. Devuelve null si no se pudo.
export async function direccionDeCoordenadas(lat, lng) {
  try {
    const ctl = new AbortController();
    const reloj = setTimeout(() => ctl.abort(), 10000);
    const resp = await fetch(`${URL_INVERSA}?format=jsonv2&addressdetails=1&zoom=18&accept-language=es&lat=${lat}&lon=${lng}`, { signal: ctl.signal });
    clearTimeout(reloj);
    if (!resp.ok) return null;
    const datos = await resp.json();
    const lt = Number(datos.lat);
    const ln = Number(datos.lon);
    const metros = Number.isFinite(lt) && Number.isFinite(ln) ? metrosEntre(lat, lng, lt, ln) : 0;
    // El número de puerta es de ese local registrado: si queda lejos del pin, no es el del punto.
    const sinNumero = !!(datos.address && datos.address.house_number) && metros > 12;
    const direccion = direccionDesdeRespuesta(datos, sinNumero);
    if (!direccion) return null;
    return { direccion, metros, sinNumero };
  } catch {
    return null;
  }
}

// Devuelve { direccion, lat, lng, precision }. Lanza un Error con texto en español si algo falla.
// Si no se logra la dirección escrita, igual devuelve las coordenadas (direccion = '').
// `alMejorar(metros)` avisa cada vez que el GPS afina la lectura. `precision` = margen de error en metros.
export async function ubicacionActual(alMejorar) {
  const pos = await obtenerPosicion(alMejorar);
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const d = await direccionDeCoordenadas(lat, lng);
  return { direccion: d ? d.direccion : '', lat, lng, precision: Math.round(pos.coords.accuracy) };
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
