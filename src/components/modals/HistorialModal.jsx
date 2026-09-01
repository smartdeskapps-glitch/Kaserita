import React, { useEffect, useMemo, useState } from 'react';
import { posService } from '../../services/posService';

export default function HistorialModal({ bodegaId, onClose, notificar, onVentaAnulada, onReimprimir }) {
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);
    const data = await posService.obtenerVentasDelDia(bodegaId);
    setVentas(data);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, [bodegaId]);

  const totales = useMemo(() => {
    const validas = ventas.filter((v) => !v.anulada);
    const efectivo = validas.filter((v) => v.medio_pago === 'EFECTIVO' || v.medio_pago === 'MIXTO')
      .reduce((acc, v) => acc + (v.medio_pago === 'MIXTO' ? Number(v.monto_efectivo || 0) : Number(v.total_venta)), 0);
    const tarjeta = validas.filter((v) => v.medio_pago === 'TARJETA')
      .reduce((acc, v) => acc + Number(v.total_venta), 0);
    const otros = validas.filter((v) => !['EFECTIVO', 'TARJETA', 'MIXTO'].includes(v.medio_pago))
      .reduce((acc, v) => acc + Number(v.total_venta), 0);
    const general = validas.reduce((acc, v) => acc + Number(v.total_venta), 0);
    return { efectivo, tarjeta, otros, general, cantidad: validas.length };
  }, [ventas]);

  const handleAnular = async (venta) => {
    const motivo = window.prompt('Motivo de la anulación:', 'Error en el registro / solicitud del cliente');
    if (motivo === null) return;
    try {
      const resultado = await posService.anularVenta(venta.id, motivo || 'Sin motivo especificado');
      notificar(`Boleta ${venta.nro_boleta} anulada.`, 'info');
      onVentaAnulada?.(resultado);
      await cargar();
    } catch (err) {
      notificar(`Error al anular: ${err.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-white">Historial de Ventas de Hoy</h2>

        <div className="grid grid-cols-4 gap-2">
          <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-slate-400 uppercase">Efectivo</p>
            <p className="text-sm font-bold text-emerald-400">S/ {totales.efectivo.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-slate-400 uppercase">Tarjeta</p>
            <p className="text-sm font-bold text-emerald-400">S/ {totales.tarjeta.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-slate-400 uppercase">Otros / QR</p>
            <p className="text-sm font-bold text-emerald-400">S/ {totales.otros.toFixed(2)}</p>
          </div>
          <div className="bg-emerald-900/40 border border-emerald-600 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-emerald-300 uppercase">Total General</p>
            <p className="text-sm font-bold text-white">S/ {totales.general.toFixed(2)}</p>
          </div>
        </div>

        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {cargando ? (
            <p className="text-xs text-slate-500 text-center py-6">Cargando ventas...</p>
          ) : ventas.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Aún no hay ventas registradas hoy.</p>
          ) : (
            ventas.map((v) => (
              <div
                key={v.id}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                  v.anulada ? 'bg-rose-950/30 border-rose-800/50 opacity-60' : 'bg-slate-900/70 border-slate-700'
                }`}
              >
                <div className="flex-1">
                  <p className="font-mono font-bold text-slate-200">
                    {v.nro_boleta} {v.anulada && <span className="text-rose-400">(ANULADA)</span>}
                  </p>
                  <p className="text-slate-400">
                    {new Date(v.created_at).toLocaleTimeString('es-PE')} · {v.medio_pago} · {v.clientes?.nombre_completo || 'Cliente Varios'}
                  </p>
                </div>
                <span className="font-bold text-emerald-400 w-20 text-right">S/ {Number(v.total_venta).toFixed(2)}</span>
                <div className="flex gap-1.5 ml-3">
                  <button
                    onClick={() => onReimprimir?.(v)}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[11px]"
                    title="Reimprimir boleta"
                  >
                    🖨️
                  </button>
                  {!v.anulada && (
                    <button
                      onClick={() => handleAnular(v)}
                      className="px-2 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded text-[11px]"
                      title="Anular venta"
                    >
                      ❌
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
