// Diálogos propios que reemplazan prompt() y confirm() del navegador.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';

export default function DialogosGenericos({
  modalConfirmar, modalPrompt, modalPromptValor, setModalConfirmar, setModalPrompt,
  setModalPromptValor
}) {
  return (
    <>
      {/* Modal genérico: reemplazo de prompt() nativo */}
      {modalPrompt && (
        <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3">
            <h3 className="text-lg font-bold text-stone-900">{modalPrompt.titulo}</h3>
            {modalPrompt.mensaje && <p className="text-xs text-stone-600">{modalPrompt.mensaje}</p>}
            <input
              type="text"
              autoFocus
              value={modalPromptValor}
              onChange={(e) => setModalPromptValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { modalPrompt.onConfirmar(modalPromptValor); setModalPrompt(null); }
              }}
              placeholder={modalPrompt.placeholder}
              className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#c5bcff]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { modalPrompt.onCancelar(); setModalPrompt(null); }}
                className="flex-1 py-2.5 bg-white/70 hover:bg-[#dde4fa] text-stone-600 font-semibold text-xs rounded-full shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => { modalPrompt.onConfirmar(modalPromptValor); setModalPrompt(null); }}
                className="flex-1 py-2.5 bg-[#5b4bd6] hover:bg-[#473bb5] text-white font-bold text-xs rounded-full shadow"
              >
                {modalPrompt.textoBoton}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal genérico: reemplazo de confirm() nativo */}
      {modalConfirmar && (
        <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-3">
            <h3 className="text-lg font-bold text-stone-900">{modalConfirmar.titulo}</h3>
            <p className="text-xs text-stone-600">{modalConfirmar.mensaje}</p>
            <div className="flex gap-2">
              <button
                onClick={() => { modalConfirmar.onCancelar(); setModalConfirmar(null); }}
                className="flex-1 py-2.5 bg-white/70 hover:bg-[#dde4fa] text-stone-600 font-semibold text-xs rounded-full shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => { modalConfirmar.onConfirmar(); setModalConfirmar(null); }}
                className={`flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow ${modalConfirmar.peligroso ? 'bg-rose-600 hover:bg-rose-500' : 'bg-stone-900 hover:bg-stone-800'}`}
              >
                {modalConfirmar.textoBoton}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
