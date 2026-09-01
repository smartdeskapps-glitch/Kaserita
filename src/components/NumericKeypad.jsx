import React from 'react';

/**
 * Teclado numérico en pantalla para ingresar montos sin depender del teclado físico
 * (táctil / touchscreen). `value` y `onChange` funcionan como un input controlado de texto.
 */
export default function NumericKeypad({ value, onChange }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  const presionar = (tecla) => {
    if (tecla === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (tecla === '.' && value.includes('.')) return;
    onChange(value + tecla);
  };

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {teclas.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => presionar(t)}
          className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-bold text-slate-200 active:scale-95 transition"
        >
          {t}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange('')}
        className="col-span-3 py-2 bg-rose-900/60 hover:bg-rose-800 border border-rose-700 rounded-lg text-xs font-bold text-rose-200"
      >
        Limpiar
      </button>
    </div>
  );
}
