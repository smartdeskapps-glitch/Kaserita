// Prepara la imagen del QR de Yape/Plin que sube la dueña: busca el código dentro de la foto, recorta
// solo el código (sin logo, nombre ni fondo de color) y lo deja con un borde blanco para que se lea
// bien en el cobro. Si no encuentra el código, devuelve la imagen tal cual.
import { asegurarZXing } from './utilidades.js';
import { cajaDelQR } from '../lib/qrPago.js';

const LADO_MAX_TRABAJO = 1400; // para buscar el código no hace falta la resolución completa del celular
const LADO_FINAL = 640;
const MARGEN = 0.08; // borde blanco alrededor del código, como proporción de su lado

const leerArchivo = (archivo) => new Promise((resolver, rechazar) => {
  const lector = new FileReader();
  lector.onload = () => resolver(lector.result);
  lector.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
  lector.readAsDataURL(archivo);
});

const cargarImagen = (url) => new Promise((resolver, rechazar) => {
  const img = new Image();
  img.onload = () => resolver(img);
  img.onerror = () => rechazar(new Error('La imagen no se pudo abrir.'));
  img.src = url;
});

// Devuelve { dataUrl, recortado }: recortado = true si se encontró el código y se dejó solo él.
export async function prepararImagenQR(archivo) {
  const original = await leerArchivo(archivo);
  let img;
  try {
    img = await cargarImagen(original);
  } catch (err) {
    return { dataUrl: original, recortado: false };
  }
  const escala = Math.min(1, LADO_MAX_TRABAJO / Math.max(img.naturalWidth, img.naturalHeight));
  const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
  const alto = Math.max(1, Math.round(img.naturalHeight * escala));
  const trabajo = document.createElement('canvas');
  trabajo.width = ancho;
  trabajo.height = alto;
  const ctx = trabajo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, ancho, alto);

  let caja = null;
  try {
    const urlWasm = await asegurarZXing();
    await window.ZXingWASM.prepareZXingModule({
      overrides: { locateFile: (ruta) => (ruta.endsWith('.wasm') ? urlWasm : ruta) }
    });
    const resultados = await window.ZXingWASM.readBarcodesFromImageData(ctx.getImageData(0, 0, ancho, alto), {
      tryHarder: true,
      formats: ['QRCode']
    });
    caja = cajaDelQR(resultados && resultados[0] && resultados[0].position, ancho, alto);
  } catch (err) {
    console.warn('[qr-pago] no se pudo buscar el código en la imagen:', err);
  }
  if (!caja) {
    // Sin código a la vista: se guarda la imagen reducida (si no, una foto grande no cabe en el almacenamiento).
    const mini = document.createElement('canvas');
    const e = Math.min(1, LADO_FINAL / Math.max(ancho, alto));
    mini.width = Math.round(ancho * e);
    mini.height = Math.round(alto * e);
    mini.getContext('2d').drawImage(trabajo, 0, 0, mini.width, mini.height);
    return { dataUrl: mini.toDataURL('image/jpeg', 0.85), recortado: false };
  }

  const margen = Math.round(caja.lado * MARGEN);
  const salida = document.createElement('canvas');
  const lado = Math.min(LADO_FINAL, caja.lado + margen * 2);
  salida.width = lado;
  salida.height = lado;
  const sctx = salida.getContext('2d');
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, lado, lado);
  const proporcion = lado / (caja.lado + margen * 2);
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(
    trabajo,
    caja.x, caja.y, caja.lado, caja.lado,
    margen * proporcion, margen * proporcion, caja.lado * proporcion, caja.lado * proporcion
  );
  return { dataUrl: salida.toDataURL('image/png'), recortado: true };
}
