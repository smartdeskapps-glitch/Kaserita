// Service worker mínimo: no cachea nada (la app necesita internet siempre
// para hablar con Supabase), solo existe para que el navegador permita
// "Agregar a pantalla de inicio" / instalar como app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', () => {});
