import React from 'react';

export default function ReciboModal({ venta, detalles = [], onClose, reimpresion = false }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-850 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-center space-y-4">
        <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl">
          {reimpresion ? '🖨️' : '✓'}
        </div>
        <h3 className="text-xl font-bold text-white">{reimpresion ? 'Reimpresión de Boleta' : 'Venta Exitosa'}</h3>
        <p className="text-sm text-slate-300">
          Boleta: <span className="font-mono font-bold text-emerald-400">{venta.nro_boleta}</span>
        </p>
        <div className="text-left bg-slate-900 p-3 rounded-lg text-xs space-y-1 text-slate-300 max-h-56 overflow-y-auto">
          <p><strong>Medio de Pago:</strong> {venta.medio_pago}</p>
          <p><strong>Total Pagado:</strong> S/ {Number(venta.total_venta).toFixed(2)}</p>
          {venta.medio_pago === 'MIXTO' && (
            <p><strong>Efectivo:</strong> S/ {Number(venta.monto_efectivo || 0).toFixed(2)} · <strong>Otro:</strong> S/ {Number(venta.monto_otro || 0).toFixed(2)}</p>
          )}
          {detalles.length > 0 && (
            <div className="pt-1 border-t border-slate-700 mt-1 space-y-0.5">
              {detalles.map((d, i) => (
                <div key={i} className="flex justify-between">
                  <span>{d.descripcion || d.productos?.descripcion || 'Producto'} x{d.cantidad}</span>
                  <span>S/ {Number(d.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => window.print()}
          className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl text-sm"
        >
          🖨️ Imprimir
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
        >
          {reimpresion ? 'Cerrar' : 'Nueva Venta'}
        </button>
      </div>
    </div>
  );
}
