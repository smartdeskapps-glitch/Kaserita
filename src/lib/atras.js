import { useEffect, useRef } from 'react';

// El botón "atrás" del celular cierra la ventana de arriba (escáner, menú, un módulo...)
// en vez de sacar al usuario de la app.
//
// `capas` va ordenada de la más alta a la más baja: [{ abierta, cerrar }]. Por cada capa
// abierta se deja una entrada en el historial del navegador; al volver atrás se cierra la
// de arriba. Si una capa se cierra con su propio botón, se retira la entrada que sobra.
export function contarAbiertas(capas) {
  return capas.filter((c) => c.abierta).length;
}

export function useBotonAtras(capas) {
  const capasRef = useRef(capas);
  capasRef.current = capas;
  const apiladas = useRef(0);
  const ignorarPop = useRef(false);
  const abiertas = contarAbiertas(capas);

  useEffect(() => {
    const alVolver = () => {
      if (ignorarPop.current) { ignorarPop.current = false; return; }
      if (apiladas.current === 0) return;
      apiladas.current -= 1;
      const arriba = capasRef.current.find((c) => c.abierta);
      if (arriba) arriba.cerrar();
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  useEffect(() => {
    if (abiertas > apiladas.current) {
      while (apiladas.current < abiertas) {
        try { window.history.pushState({ kaserita: apiladas.current + 1 }, ''); } catch { return; }
        apiladas.current += 1;
      }
    } else if (abiertas < apiladas.current) {
      const sobran = apiladas.current - abiertas;
      apiladas.current = abiertas;
      ignorarPop.current = true;
      try { window.history.go(-sobran); } catch { ignorarPop.current = false; }
    }
  }, [abiertas]);
}
