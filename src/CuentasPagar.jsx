import React from 'react';
import VentanaModulo from './VentanaModulo.jsx';
import { iniciales } from './lib/nombres.js';

const dinero = (v) => `S/ ${(Number(v) || 0).toFixed(2)}`;

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function CuentasPagar({
  modalCuentasPagar,
  montoMovimientoProveedor,
  proveedorSeleccionado,
  proveedoresLista,
  registrarMovimientoProveedor,
  setModalCuentasPagar,
  setModalNuevoProveedor,
  setMontoMovimientoProveedor,
  setProveedorSeleccionado,
}) {
  if (!modalCuentasPagar) return null;
  const deudaTotal = proveedoresLista.reduce((s, p) => s + Math.max(0, Number(p.saldo_actual) || 0), 0);
  const conDeuda = proveedoresLista.filter((p) => Number(p.saldo_actual) > 0).length;
  const p = proveedorSeleccionado;

  return (
    <VentanaModulo
      icono="fa-file-invoice"
      titulo="Cuentas por pagar"
      subtitulo="Lo que le debes a tus proveedores"
      cifras={[
        { etiqueta: 'Deuda total', valor: dinero(deudaTotal), tono: deudaTotal > 0 ? 'mal' : 'ok' },
        { etiqueta: 'Proveedores con deuda', valor: conDeuda },
      ]}
      acciones={!p && (
        <button type="button" onClick={() => setModalNuevoProveedor(true)} className="kz-pri h-10 px-4 text-[13px] font-bold inline-flex items-center gap-2 shrink-0">
          <i className="fa-solid fa-plus text-[11px]"></i><span>Nuevo<span className="hidden sm:inline"> proveedor</span></span>
        </button>
      )}
      onClose={() => setModalCuentasPagar(false)}
      ancho="max-w-2xl"
    >
      {p ? (
        <div className="p-4 sm:p-6 space-y-4">
          <button type="button" onClick={() => setProveedorSeleccionado(null)} className="text-[13px] font-bold text-[#6b6890] hover:text-[#2d284b] inline-flex items-center gap-2 transition">
            <i className="fa-solid fa-chevron-left text-[11px]"></i> Todos los proveedores
          </button>
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9687f5] to-[#5b4bd6] text-white grid place-items-center font-bold shrink-0">{iniciales(p.nombre, '?')}</span>
            <div className="flex-1 min-w-0">
              <b className="block text-[15px] text-[#2d284b] truncate">{p.nombre}</b>
              <span className="text-xs text-[#8f8cb0]">{[p.ruc && `RUC ${p.ruc}`, p.telefono && `Tel. ${p.telefono}`].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
            </div>
            <div className="text-right shrink-0">
              <span className="block text-[11.5px] text-[#8f8cb0]">Le debes</span>
              <b className={`text-lg tabular-nums ${Number(p.saldo_actual) > 0 ? 'text-[#c0262d]' : 'text-[#0f7b4a]'}`}>{dinero(p.saldo_actual)}</b>
            </div>
          </div>
          <div className="rounded-[20px] bg-[#f3f5ff] p-4">
            <label htmlFor="monto-proveedor" className="text-[13px] font-bold text-[#2d284b]">Monto</label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[13px] font-semibold text-[#6b6890]">S/</span>
              <input
                id="monto-proveedor"
                type="number"
                step="1.00"
                inputMode="decimal"
                placeholder="0.00"
                value={montoMovimientoProveedor}
                onChange={(e) => setMontoMovimientoProveedor(e.target.value)}
                className="flex-1 min-w-0 h-12 rounded-[14px] bg-white px-3.5 text-2xl font-light tabular-nums text-[#2d284b] outline-none focus:ring-2 focus:ring-[#5b4bd6]/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <button type="button" onClick={() => registrarMovimientoProveedor('deuda')} className="h-11 rounded-full bg-white hover:bg-[#e6ebff] text-[#6b6890] text-[13px] font-bold inline-flex items-center justify-center gap-2 transition">
                <i className="fa-solid fa-plus text-[11px]"></i> Agregar deuda
              </button>
              <button type="button" onClick={() => registrarMovimientoProveedor('pago')} className="kz-pri h-11 text-[13px] font-bold inline-flex items-center justify-center gap-2">
                <i className="fa-solid fa-check text-[11px]"></i> Registrar pago
              </button>
            </div>
          </div>
        </div>
      ) : proveedoresLista.length === 0 ? (
        <div className="text-center px-6 py-12 text-[13.5px] text-[#6b6890]">
          <div className="w-14 h-14 rounded-2xl bg-[#f3f5ff] text-[#5b4bd6] grid place-items-center text-xl mx-auto mb-3"><i className="fa-solid fa-truck-field"></i></div>
          <b className="block text-[#2d284b]">Todavía no tienes proveedores</b>
          Toca «Nuevo proveedor» para registrar el primero.
        </div>
      ) : (
        <div className="p-2 sm:p-3">
          {proveedoresLista.map((prov) => {
            const saldo = Number(prov.saldo_actual) || 0;
            return (
              <button
                type="button"
                key={prov.id}
                onClick={() => { setProveedorSeleccionado(prov); setMontoMovimientoProveedor(''); }}
                className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-[18px] hover:bg-[#f6f8ff] transition"
              >
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9687f5] to-[#5b4bd6] text-white grid place-items-center text-[13px] font-bold shrink-0">{iniciales(prov.nombre, '?')}</span>
                <span className="flex-1 min-w-0">
                  <b className="block text-[13.5px] text-[#2d284b] truncate">{prov.nombre}</b>
                  <span className="text-xs text-[#8f8cb0]">{prov.ruc ? `RUC ${prov.ruc}` : 'Sin RUC'}</span>
                </span>
                {saldo > 0
                  ? <b className="text-[14px] tabular-nums text-[#2d284b] whitespace-nowrap">{dinero(saldo)}</b>
                  : <span className="text-xs font-bold text-[#0f7b4a]">Al día</span>}
                <i className="fa-solid fa-chevron-right text-[11px] text-[#c5c9e0]"></i>
              </button>
            );
          })}
        </div>
      )}
    </VentanaModulo>
  );
}
