// Service worker mínimo: no cachea nada (la app necesita internet siempre
// para hablar con Supabase). Registra la app como PWA y muestra los avisos push
// de pedidos nuevos al dueño.
// Sin manejador 'fetch': los Chrome actuales ya no lo exigen para instalar
// y un manejador vacío solo agrega sobrecarga en cada navegación.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('push', (event) => {
  let datos = { title: 'Kaserita', body: 'Tienes novedades.', url: '/pos', tag: 'kaserita' };
  try {
    if (event.data) datos = { ...datos, ...event.data.json() };
  } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(datos.title, {
      body: datos.body,
      icon: '/icon-192.png',
      tag: datos.tag,
      data: { url: datos.url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/pos', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((c) => c.url.startsWith(self.location.origin) && 'focus' in c);
      if (abierta) return abierta.focus();
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
