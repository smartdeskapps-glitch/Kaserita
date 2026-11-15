// "Usar mi ubicación actual": pide el GPS del dispositivo y lo convierte en una dirección
// escrita (calle y número, distrito) con el geocodificador abierto de OpenStreetMap.
// El resultado solo rellena el campo de dirección: la persona puede corregirlo antes de guardar.

const URL_INVERSA = 'https://nominatim.openstreetmap.org/reverse';

// Parte la respuesta del geocodificador en calle, número y zona (distrito / ciudad).
export function partesDeRespuesta(r) {
  const a = (r && r.address) || {};
  const calle = a.road || a.pedestrian || a.footway || a.path || '';
  const numero = a.house_number || '';
  const zona = [a.suburb || a.neighbourhood || a.city_district || a.quarter || '', a.city || a.town || a.village || a.municipality || '']
    .filter((x, i, todos) => x && todos.indexOf(x) === i)
    .join(', ');
  return { calle, numero, zona };
}

// Junta las partes en el texto que se guarda: "Av. Los Álamos 245, San Miguel".
export function componerDireccion(calle, numero, zona) {
  const via = [String(calle || '').trim(), String(numero || '').trim()].filter(Boolean).join(' ');
  return [via, String(zona || '').trim()].filter(Boolean).join(', ');
}

// Sigue el GPS sin hacer esperar: avisa en cuanto hay una primera lectura y después solo cuando
// llega una más precisa. Se detiene solo al llegar a PRECISION_BUENA o pasado ESPERA_MAXIMA.
// Devuelve una función para detenerlo antes.
const PRECISION_BUENA = 15; // metros
const ESPERA_MAXIMA = 20000;
function mensajeGps(e) {
  if (e && e.code === 1) return 'No diste permiso para usar tu ubicación. Actívalo en los ajustes del navegador e inténtalo de nuevo.';
  if (e && e.code === 3) return 'Tardó demasiado en encontrar tu ubicación. Acércate a una ventana e inténtalo de nuevo.';
  return 'No se pudo obtener tu ubicación. Revisa que el GPS esté activo.';
}
export function seguirGps({ alLeer, alFallar, alTerminar }) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    alFallar('Tu dispositivo no permite obtener la ubicación.');
    alTerminar();
    return () => {};
  }
  let activo = true;
  let mejor = Infinity;
  let id = null;
  let reloj = null;
  const parar = () => {
    if (!activo) return;
    activo = false;
    clearTimeout(reloj);
    if (id !== null) navigator.geolocation.clearWatch(id);
    alTerminar();
  };
  id = navigator.geolocation.watchPosition((pos) => {
    if (!activo) return;
    const precision = pos.coords.accuracy;
    if (precision < mejor) {
      mejor = precision;
      alLeer({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(precision) });
    }
    if (precision <= PRECISION_BUENA) parar();
  }, (e) => {
    if (!activo) return;
    // Solo el permiso denegado corta de inmediato: los demás errores suelen ser pasajeros (el GPS
    // todavía no engancha) y el límite de espera avisa si de verdad no hubo ninguna lectura.
    if (e && e.code === 1) {
      alFallar(mensajeGps(e));
      parar();
    }
  }, { enableHighAccuracy: true, timeout: ESPERA_MAXIMA, maximumAge: 15000 });
  reloj = setTimeout(() => {
    if (mejor === Infinity) alFallar(mensajeGps({ code: 3 }));
    parar();
  }, ESPERA_MAXIMA);
  return parar;
}

// Distancia en metros entre dos puntos (fórmula del haversine).
export function metrosEntre(lat1, lng1, lat2, lng2) {
  const rad = (g) => (g * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return Math.round(12742000 * Math.asin(Math.sqrt(a)));
}

// Convierte coordenadas en la dirección registrada más cercana. El servicio devuelve el lugar
// conocido más próximo al punto (un local, una calle), no la dirección exacta del punto: por eso
// el número de puerta solo se usa si ese lugar está pegado al pin. Devuelve null si no se pudo.
export async function direccionDeCoordenadas(lat, lng) {
  try {
    const ctl = new AbortController();
    const reloj = setTimeout(() => ctl.abort(), 10000);
    const resp = await fetch(`${URL_INVERSA}?format=jsonv2&addressdetails=1&zoom=18&accept-language=es&lat=${lat}&lon=${lng}`, { signal: ctl.signal });
    clearTimeout(reloj);
    if (!resp.ok) return null;
    const datos = await resp.json();
    const p = partesDeRespuesta(datos);
    if (!p.calle && !p.zona) return null;
    const lt = Number(datos.lat);
    const ln = Number(datos.lon);
    const metros = Number.isFinite(lt) && Number.isFinite(ln) ? metrosEntre(lat, lng, lt, ln) : 0;
    // El número de puerta es de ese local registrado: si queda lejos del pin, no es el del punto.
    const numero = metros > 12 ? '' : p.numero;
    return { calle: p.calle, numero, direccion: componerDireccion(p.calle, numero, p.zona) };
  } catch {
    return null;
  }
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
