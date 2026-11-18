// "Avisarme de pedidos nuevos en este celular": suscribe el dispositivo al push web y guarda la
// suscripción en push_dueno (una fila por dispositivo). La función de servidor
// enviar-aviso-pedido-tienda la lee cuando entra un pedido, aunque el POS esté cerrado.
import React, { useEffect, useState } from 'react';

// Clave pública VAPID (la misma de Kaserita Delivery; es pública a propósito).
const VAPID_PUBLIC_KEY = 'BOygmWrwaP8XjdL9v-VzAC7ADw36O_W7JcXPitn8nDU_bs6f3ZylCxo4lu2D46ksneRKmBvneNJyDiPxn4EK13k';

function aUint8Array(base64Url) {
  const relleno = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const bin = atob((base64Url + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function mismaClave(sub) {
  const actual = sub.options && sub.options.applicationServerKey;
  if (!actual) return false;
  const a = new Uint8Array(actual);
  const b = aUint8Array(VAPID_PUBLIC_KEY);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const soportado = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

export default function AvisosPush({ sbClient, bodegaId, notificar }) {
  // 'cargando' | 'no-soportado' | 'bloqueado' | 'apagado' | 'activo'
  const [estado, setEstado] = useState('cargando');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!soportado()) return vivo && setEstado('no-soportado');
      if (Notification.permission === 'denied') return vivo && setEstado('bloqueado');
      try {
        const reg = await navigator.serviceWorker.getRegistration('/');
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (vivo) setEstado(sub && Notification.permission === 'granted' ? 'activo' : 'apagado');
      } catch {
        if (vivo) setEstado('apagado');
      }
    })();
    return () => { vivo = false; };
  }, []);

  const activar = async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueado' : 'apagado');
        return;
      }
      let sub = await reg.pushManager.getSubscription();
      if (sub && !mismaClave(sub)) {
        await sub.unsubscribe();
        sub = null;
      }
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aUint8Array(VAPID_PUBLIC_KEY) });
      }
      const json = sub.toJSON();
      const { error } = await sbClient
        .from('push_dueno')
        .upsert({ bodega_id: bodegaId, endpoint: json.endpoint, suscripcion: json }, { onConflict: 'endpoint' });
      if (error) throw error;
      setEstado('activo');
      notificar?.('Listo: este celular recibirá un aviso por cada pedido nuevo.');
    } catch {
      notificar?.('No se pudieron activar los avisos. Inténtalo de nuevo.');
    } finally {
      setOcupado(false);
    }
  };

  const apagar = async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await sbClient.from('push_dueno').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado('apagado');
    } catch {
      notificar?.('No se pudieron apagar los avisos. Inténtalo de nuevo.');
    } finally {
      setOcupado(false);
    }
  };

  if (estado === 'cargando') return null;

  const texto = {
    'no-soportado': 'Este navegador no permite avisos. En iPhone, agrega el POS a la pantalla de inicio y ábrelo desde ahí.',
    bloqueado: 'Bloqueaste las notificaciones. Actívalas en los ajustes del navegador para este sitio.',
    apagado: 'Recibe un aviso en este celular cuando llegue un pedido, aunque el POS esté cerrado.',
    activo: 'Este celular recibe un aviso por cada pedido nuevo, aunque el POS esté cerrado.',
  }[estado];

  return (
    <div className="mx-4 mt-2 shrink-0 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
      <i className={`fa-solid ${estado === 'activo' ? 'fa-bell text-emerald-600' : 'fa-bell-slash text-stone-400'}`}></i>
      <span className="flex-1">{texto}</span>
      {estado === 'apagado' && (
        <button onClick={activar} disabled={ocupado} className="shrink-0 rounded-lg bg-orange-600 px-2.5 py-1 font-semibold text-white disabled:opacity-60">
          {ocupado ? 'Activando…' : 'Activar'}
        </button>
      )}
      {estado === 'activo' && (
        <button onClick={apagar} disabled={ocupado} className="shrink-0 rounded-lg border border-stone-300 px-2.5 py-1 font-semibold text-stone-700 disabled:opacity-60">
          Apagar
        </button>
      )}
    </div>
  );
}
