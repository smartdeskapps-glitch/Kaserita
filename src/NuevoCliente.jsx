import React from 'react';
import { esDocumentoValido } from './lib/validaciones.js';

const ATAJOS_LIMITE = [
  { valor: 0, etiqueta: 'Sin crédito' },
  { valor: 50, etiqueta: '50' },
  { valor: 100, etiqueta: '100' },
  { valor: 200, etiqueta: '200' },
  { valor: 300, etiqueta: '300' },
  { valor: 500, etiqueta: '500' },
];

// Qué tipo de documento parece lo escrito: para la etiqueta del campo y para saber si ya es válido.
const tipoDocumento = (texto) => {
  const doc = String(texto || '').trim();
  if (!doc) return null;
  if (esDocumentoValido(doc)) {
    if (/^\d{8}$/.test(doc)) return { texto: 'DNI', estado: 'ok' };
    if (/^\d{11}$/.test(doc)) return { texto: 'RUC', estado: 'ok' };
    return { texto: 'Carné', estado: 'ok' };
  }
  // Todavía escribiendo: no se marca como error hasta tener el largo mínimo.
  if (doc.length < 8) return { texto: /^\d+$/.test(doc) ? `DNI · faltan ${8 - doc.length}` : 'Carné', estado: 'tipeando' };
  return { texto: 'Revisar', estado: 'mal' };
};

const iniciales = (nombre) => {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  return (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
};

const claseCampoOscuro = 'h-[50px] flex items-center gap-2.5 px-4 rounded-full border-[1.5px] border-white/20 bg-white/5 focus-within:border-[#c5bcff] focus-within:ring-4 focus-within:ring-[#9687f5]/20 transition';
const claseCampoClaro = 'h-[46px] flex items-center gap-2 px-3.5 rounded-[14px] bg-[#f3f5ff] focus-within:ring-2 focus-within:ring-[#5b4bd6]/40';
const clasesTipo = {
  ok: 'bg-emerald-400/20 text-emerald-200',
  tipeando: 'bg-white/10 text-white/80',
  mal: 'bg-[#ffb3c0]/20 text-[#ffb3c0]',
};

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function NuevoCliente({
  formCliente,
  handleGuardarNuevoCliente,
  modalNuevoCliente,
  setFormCliente,
  setModalNuevoCliente,
}) {
  if (!modalNuevoCliente) return null;

  const tipo = tipoDocumento(formCliente.dni);
  const nombre = formCliente.nombre.trim();
  const palabras = nombre.split(/\s+/).filter(Boolean);
  const ultima = palabras.pop();
  const ini = iniciales(nombre);
  const puedeGuardar = tipo?.estado === 'ok' && nombre.length > 1;
  const limite = String(formCliente.limiteCredito);
  const campo = (clave) => (e) => setFormCliente({ ...formCliente, [clave]: e.target.value });

  return (
    <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form onSubmit={handleGuardarNuevoCliente} className="rounded-[34px] max-w-sm w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white">
          {/* Panel oscuro: documento y nombre */}
          <div
            className="relative text-white px-5 pt-4 pb-9"
            style={{ background: 'radial-gradient(90% 60% at 50% 0%, rgba(150,135,245,0.28), transparent 70%), linear-gradient(180deg, #34305a 0%, #26224a 55%, #1d1a38 100%)' }}
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-full border-[1.5px] border-white/25 bg-white/5 flex items-center justify-center">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.6 3.1-6 7-6M18 8v6M15 11h6" /></svg>
              </span>
              <span className="text-[12.5px] font-semibold text-white/85">Registrar cliente</span>
              <button type="button" aria-label="Cerrar" onClick={() => setModalNuevoCliente(false)} className="w-10 h-10 rounded-full border-[1.5px] border-white/25 bg-white/5 hover:bg-white/10 flex items-center justify-center transition">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="text-center mt-4">
              {ini ? (
                <div className="w-[68px] h-[68px] mx-auto rounded-full grid place-items-center text-2xl font-bold tracking-wide bg-gradient-to-br from-[#9687f5] to-[#5b4bd6] shadow-[0_8px_22px_-8px_rgba(150,135,245,0.7)]">{ini}</div>
              ) : (
                <div className="w-[68px] h-[68px] mx-auto rounded-full grid place-items-center border-[1.5px] border-dashed border-white/30 bg-white/5 text-white/60">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                </div>
              )}
              <h3 className="mt-3 text-2xl font-light tracking-tight min-h-[30px] break-words">
                {ultima ? <>{palabras.length > 0 && `${palabras.join(' ')} `}<b className="font-bold">{ultima}</b></> : <>Nuevo <b className="font-bold">cliente</b></>}
              </h3>
              <p className="text-xs text-white/55 mt-0.5">
                {ultima ? (tipo?.estado === 'ok' ? `${tipo.texto} ${formCliente.dni.trim()}` : 'Nuevo cliente') : 'Para vender a crédito (fiado) y llevar su cuenta.'}
              </p>
            </div>

            <div className="mt-5 space-y-2.5">
              <label className={claseCampoOscuro}>
                <svg className="shrink-0 opacity-80" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M8 11h4M8 15h8" /></svg>
                <input
                  type="text"
                  required
                  autoFocus
                  inputMode="text"
                  autoComplete="off"
                  aria-label="DNI o RUC"
                  value={formCliente.dni}
                  onChange={campo('dni')}
                  placeholder="DNI o RUC"
                  className="flex-1 min-w-0 bg-transparent text-sm font-medium text-white placeholder:text-white/50 focus:outline-none"
                />
                {tipo && <span className={`shrink-0 text-[11px] font-bold tracking-wide px-2.5 py-0.5 rounded-full ${clasesTipo[tipo.estado]}`}>{tipo.texto}</span>}
              </label>
              <label className={claseCampoOscuro}>
                <svg className="shrink-0 opacity-80" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  aria-label="Nombre completo"
                  value={formCliente.nombre}
                  onChange={campo('nombre')}
                  placeholder="Nombre completo"
                  className="flex-1 min-w-0 bg-transparent text-sm font-medium text-white placeholder:text-white/50 focus:outline-none"
                />
              </label>
            </div>
          </div>

          {/* Hoja blanca: contacto y crédito */}
          <div className="relative -mt-5 rounded-t-[30px] bg-white px-5 pt-5 pb-1">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="min-w-0">
                <span className="block text-xs font-bold text-[#6b6890] mb-1.5 ml-1">Teléfono</span>
                <label className={claseCampoClaro}>
                  <svg className="shrink-0 text-[#8f8cb0]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
                  <input type="text" inputMode="tel" aria-label="Teléfono" value={formCliente.telefono} onChange={campo('telefono')} placeholder="Opcional" className="flex-1 min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-[#9290a2] focus:outline-none" />
                </label>
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-[#6b6890] mb-1.5 ml-1">Correo</span>
                <label className={claseCampoClaro}>
                  <svg className="shrink-0 text-[#8f8cb0]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
                  <input type="text" inputMode="email" aria-label="Correo" value={formCliente.correo} onChange={campo('correo')} placeholder="Opcional" className="flex-1 min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-[#9290a2] focus:outline-none" />
                </label>
              </div>
            </div>

            <div className="mt-4 rounded-[20px] bg-[#f3f5ff] p-4">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#2d284b]">Límite de crédito</p>
                  <p className="text-[11.5px] text-[#8f8cb0] mt-px">Hasta cuánto le podés fiar</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 text-[#2d284b]">
                  <span className="text-[13px] font-semibold text-[#6b6890]">S/</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="10"
                    min="0"
                    required
                    aria-label="Límite de crédito en soles"
                    value={formCliente.limiteCredito}
                    onChange={campo('limiteCredito')}
                    className="w-[72px] text-right text-[28px] leading-none font-light tracking-tight tabular-nums bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-[7px] mt-3">
                {ATAJOS_LIMITE.map((a) => (
                  <button
                    key={a.valor}
                    type="button"
                    onClick={() => setFormCliente({ ...formCliente, limiteCredito: String(a.valor) })}
                    className={`h-[34px] px-3.5 rounded-full text-[12.5px] font-bold transition ${
                      limite !== '' && Number(limite) === a.valor ? 'bg-[#2d284b] text-white' : 'bg-white text-[#6b6890] hover:bg-[#e6ebff]'
                    }`}
                  >
                    {a.etiqueta}
                  </button>
                ))}
              </div>
            </div>
            <p className="mx-1 mt-3 text-[11.5px] leading-snug text-[#8f8cb0]">Plazo de pago: 30 días. Después lo podés cambiar desde Fiados → Datos.</p>
          </div>
        </div>

        <div className="shrink-0 bg-white px-5 pb-5 pt-3">
          <button
            type="submit"
            disabled={!puedeGuardar}
            className="kz-pri w-full h-[54px] text-base font-semibold flex items-center justify-center gap-2.5"
          >
            <span>Guardar cliente</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" /><path d="M19 15c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8Z" /></svg>
          </button>
        </div>
      </form>
    </div>
  );
}
