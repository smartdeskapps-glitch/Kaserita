// Service worker mínimo: no cachea nada (la app necesita internet siempre
// para hablar con Supabase), solo existe para registrar la app como PWA.
// Sin manejador 'fetch': los Chrome actuales ya no lo exigen para instalar
// y un manejador vacío solo agrega sobrecarga en cada navegación.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
