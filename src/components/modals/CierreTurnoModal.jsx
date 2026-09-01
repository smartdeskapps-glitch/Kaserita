import React, { useState } from 'react';
import { posService } from '../../services/posService';

export default function CierreTurnoModal({ turno, ventasEfectivo, onClose, notificar, onCerrado }) {
  const [montoContado, setMontoContado] = useState('');
  const [resultado, setResultado] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const handleConfirmarConteo = async () => {
    const contado = Number(montoContado);
    if (montoContado === '' || Number.isNaN(contado) || contado < 0) {
      notificar('Ingresa el monto real contado en caja.', 'error');
      return;
    }
    setProcesando(true);
    try {
      const res = await posService.cerrarTurnoConArqueo({
        turnoId: turno.id,
        montoFinalReal: contado,
        montoInicial: turno.monto_inicial,
        ventasEfectivo
      });
      setResultado(res.resumen);
    } catch (err) {
      notificar(`Error al cerrar turno: ${err.message}`, 'error');
    } finally {
      setProcesando(false);
    }
  };

  const handleFinalizar = () => {
    onCerrado?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
        <h2 className="text-lg font-bold text-white">Cierre de Turno — Arqueo Ciego</h2>

        {!resultado ? (
          <>
            <p className="text-xs text-slate-300">
              Cuenta físicamente el efectivo en caja e ingresa el monto <strong>sin ver</strong> el total esperado del sistema.
            </p>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Monto Real Contado (S/):</label>
              <input
                type="number"
                step="0.10"
                autoFocus
                value={montoContado}
                onChange={(e) => setMontoContado(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarConteo}
                disabled={procesando}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold rounded-lg"
              >
                {procesando ? 'Calculando...' : 'Confirmar Conteo'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-slate-900 rounded-lg p-3 text-sm space-y-1.5 text-slate-300">
              <div className="flex justify-between"><span>Monto Inicial:</span><span>S/ {resultado.inicio.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Ventas en Efectivo:</span><span>S/ {resultado.ventas.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold border-t border-slate-700 pt-1.5"><span>Esperado en Caja:</span><span>S/ {resultado.esperado.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Contado Real:</span><span>S/ {resultado.real.toFixed(2)}</span></div>
              <div className={`flex justify-between text-base font-black pt-1.5 border-t border-slate-700 ${
                resultado.diferencia === 0 ? 'text-emerald-400' : resultado.diferencia > 0 ? 'text-sky-400' : 'text-rose-400'
              }`}>
                <span>{resultado.diferencia === 0 ? 'Cuadre Exacto' : resultado.diferencia > 0 ? 'Sobrante' : 'Faltante'}:</span>
                <span>S/ {Math.abs(resultado.diferencia).toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={handleFinalizar}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
            >
              Finalizar Turno
            </button>
          </>
        )}
      </div>
    </div>
  );
}
