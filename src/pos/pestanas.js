// Pestañas de módulos en la pantalla de venta (PC). Cada VentanaModulo que se abre dentro del
// área de la venta se registra aquí; la barra de pestañas (PestanasModulos) lee esta lista y el
// módulo activo es el único visible. Los demás siguen montados (conservan lo que estabas
// haciendo) y la venta (catálogo + carrito) queda siempre disponible.
// Estado fuera de React para que la ventana, la barra y el menú compartan la misma lista.
import { useSyncExternalStore } from 'react';

let tabs = [];          // [{ id, titulo, icono, cerrar }]
let activa = null;      // id de la pestaña visible; null = la venta
let instantanea = { tabs, activa };
const oyentes = new Set();

const publicar = () => {
  instantanea = { tabs, activa };
  oyentes.forEach((f) => f());
};
const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
const leer = () => instantanea;

export function usePestanas() {
  return useSyncExternalStore(suscribir, leer, leer);
}

// Registra un módulo abierto y lo deja activo. Devuelve la función que lo quita.
export function registrarPestana(tab) {
  tabs = [...tabs, tab];
  activa = tab.id;
  publicar();
  return () => {
    tabs = tabs.filter((t) => t.id !== tab.id);
    if (activa === tab.id) activa = tabs.length ? tabs[tabs.length - 1].id : null;
    publicar();
  };
}

// Actualiza título o cierre de una pestaña ya registrada (por ejemplo, cuando cambia el título).
export function actualizarPestana(id, cambios) {
  const t = tabs.find((x) => x.id === id);
  if (!t) return;
  const cambia = Object.keys(cambios).some((k) => t[k] !== cambios[k]);
  if (!cambia) return;
  tabs = tabs.map((x) => (x.id === id ? { ...x, ...cambios } : x));
  publicar();
}

export function activarPestana(id) {
  if (activa === id) return;
  activa = id;
  publicar();
}

// Al reabrir desde el menú un módulo que ya estaba abierto, se pasa a su pestaña (las opciones
// del menú y las ventanas comparten el icono).
export function activarPestanaPorIcono(icono) {
  const t = tabs.find((x) => x.icono === icono);
  if (t) activarPestana(t.id);
}

export const hayPestanas = () => tabs.length > 0;
