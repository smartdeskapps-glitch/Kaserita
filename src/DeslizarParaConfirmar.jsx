import { useEffect, useRef } from 'react';

// Control "desliza para confirmar" (celular): se arrastra la perilla hasta el final
// para cobrar, así un toque sin querer no registra la venta. Si se suelta antes del
// 85 % del recorrido, la perilla vuelve al inicio. Con teclado, Enter o espacio confirma.
const UMBRAL = 0.85;

export default function DeslizarParaConfirmar({
  onConfirm,
  disabled = false,
  ocupado = false,
  texto = 'Desliza para confirmar',
  textoBloqueado = ''
}) {
  const pistaRef = useRef(null);
  const perillaRef = useRef(null);
  const rellenoRef = useRef(null);
  const textoRef = useRef(null);
  const arrastre = useRef(null);
  const ocupadoRef = useRef(ocupado);
  const temporizadores = useRef([]);
  ocupadoRef.current = ocupado;

  const maximo = () => (pistaRef.current?.clientWidth || 0) - (perillaRef.current?.offsetWidth || 0) - 10;

  const mover = (x) => {
    if (!perillaRef.current) return;
    perillaRef.current.style.transform = `translateX(${x}px)`;
    rellenoRef.current.style.width = x > 0 ? `${x + 53}px` : '0';
    const m = maximo();
    textoRef.current.style.opacity = m > 0 ? String(Math.max(0, 1 - (x / m) * 1.2)) : '';
  };

  const reiniciar = (anima) => {
    pistaRef.current?.classList.toggle('kz-slide-vuelve', anima);
    mover(0);
  };

  const esperar = (fn, ms) => { temporizadores.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => temporizadores.current.forEach(clearTimeout), []);

  // Al terminar de registrar (o si el botón se bloquea) la perilla vuelve al inicio.
  useEffect(() => { if (!ocupado) reiniciar(true); }, [ocupado]);
  useEffect(() => { reiniciar(false); }, [disabled]);

  const alBajar = (e) => {
    if (disabled || ocupado) return;
    arrastre.current = { inicio: e.clientX, pos: 0 };
    pistaRef.current.classList.remove('kz-slide-vuelve');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const alMover = (e) => {
    if (!arrastre.current) return;
    const x = Math.max(0, Math.min(maximo(), e.clientX - arrastre.current.inicio));
    arrastre.current.pos = x;
    mover(x);
  };
  const alSoltar = () => {
    if (!arrastre.current) return;
    const { pos } = arrastre.current;
    arrastre.current = null;
    const m = maximo();
    if (m > 0 && pos >= m * UMBRAL) {
      pistaRef.current.classList.add('kz-slide-vuelve');
      mover(m);
      esperar(() => onConfirm?.(), 200);
      // Si la venta no llega a iniciarse (por ejemplo falta un dato), vuelve al inicio.
      esperar(() => { if (!ocupadoRef.current) reiniciar(true); }, 900);
    } else {
      reiniciar(true);
    }
  };

  return (
    <div
      ref={pistaRef}
      role="group"
      aria-label={texto}
      className={`kz-slide${disabled ? ' kz-slide-off' : ''}${ocupado ? ' kz-slide-ocupado' : ''}`}
    >
      <div ref={rellenoRef} className="kz-slide-fill" />
      <div ref={textoRef} className="kz-slide-lbl">
        {ocupado
          ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Registrando venta...</>
          : disabled ? (textoBloqueado || texto) : texto}
      </div>
      <button
        ref={perillaRef}
        type="button"
        className="kz-slide-mano"
        disabled={disabled || ocupado}
        aria-label={texto}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !ocupado) {
            e.preventDefault();
            onConfirm?.();
          }
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </div>
  );
}
