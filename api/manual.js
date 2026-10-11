// Manual de uso: solo lo ve quien tiene una sesion valida en el POS.
//
// El contenido (texto y capturas) vive en /manual-privado, que NO se publica:
// solo esta funcion puede leerlo. Cada pedido trae el token de sesion de
// Supabase (Authorization: Bearer ...) y se comprueba que
//   1. el token sea valido, y
//   2. la persona tenga una fila en `usuarios` (personal de un negocio): los
//      clientes de la tienda tambien inician sesion con Google en este mismo
//      Supabase, pero esos no tienen fila en `usuarios` y quedan afuera.
// La clave publishable es publica (ya viaja en el JS del POS); no hay secretos aqui.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = 'https://hzmrsbeamtbloudmxjrp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RHAkd7pZIadDnSQClFdjMQ_lrG3p-gw';
const RAIZ = path.join(process.cwd(), 'manual-privado');

// Una pagina del manual pide ~50 imagenes seguidas: se recuerda unos minutos
// que el token ya fue comprobado para no consultar Supabase en cada una.
const VIGENCIA_MS = 5 * 60 * 1000;
const aceptados = new Map();

async function personalDelNegocio(token) {
  const hasta = aceptados.get(token);
  if (hasta && hasta > Date.now()) return true;

  const cabeceras = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
  const rUsuario = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: cabeceras });
  if (!rUsuario.ok) return false;
  const { id } = await rUsuario.json();
  if (!id) return false;

  // Con el token de la persona, la politica de la tabla solo deja ver su propia fila.
  const rFila = await fetch(
    `${SUPABASE_URL}/rest/v1/usuarios?select=id&auth_id=eq.${encodeURIComponent(id)}&limit=1`,
    { headers: cabeceras }
  );
  if (!rFila.ok) return false;
  const filas = await rFila.json();
  if (!Array.isArray(filas) || filas.length === 0) return false;

  if (aceptados.size > 500) aceptados.clear();
  aceptados.set(token, Date.now() + VIGENCIA_MS);
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex');

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Falta iniciar sesión.' });

  let permitido = false;
  try {
    permitido = await personalDelNegocio(token);
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo comprobar la sesión.' });
  }
  if (!permitido) return res.status(403).json({ error: 'Solo para personal de un negocio con sesión iniciada.' });

  const que = String(req.query.f || '');
  try {
    if (que === 'contenido') {
      const html = await readFile(path.join(RAIZ, 'contenido.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }
    if (que === 'img') {
      const nombre = String(req.query.n || '');
      if (!/^[a-z0-9-]{1,60}$/.test(nombre)) return res.status(400).json({ error: 'Imagen no válida.' });
      const bytes = await readFile(path.join(RAIZ, 'img', `${nombre}.webp`));
      res.setHeader('Content-Type', 'image/webp');
      // Las capturas casi no cambian: el navegador de esa persona puede guardarlas un rato.
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.status(200).send(bytes);
    }
  } catch (e) {
    return res.status(404).json({ error: 'No encontrado.' });
  }
  return res.status(400).json({ error: 'Pedido no válido.' });
}
