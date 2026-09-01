import React, { useEffect, useState } from 'react';
import { posService } from '../../services/posService';

export default function VentasEsperaModal({ bodegaId, onClose, notificar, onRecuperar }) {
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);
    const data = await posService.obtenerVentasEnEspera(bodegaId);
    setVentas(data);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, [bodegaId]);

  const handleRecuperar = async (venta) => {
    try {
      const recuperada = await posService.recuperarVentaEnEspera(venta.id);
      onRecuperar?.(recuperada);
      notificar('Venta recuperada al carrito.', 'success');
      onClose();
    } catch (err) {
      notificar(`Error al recuperar venta: ${err.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-3 max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-white">Ventas en Espera</h2>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {cargando ? (
            <p className="text-xs text-slate-500 text-center py-6">Cargando...</p>
          ) : ventas.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No hay ventas aparcadas.</p>
          ) : (
            ventas.map((v) => (
              <div key={v.id} className="bg-slate-900/70 border border-slate-700 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{v.nombre_referencia || `Venta #${v.id}`}</p>
                  <p className="text-xs text-slate-400">
                    {v.items.length} ítem(s) · {new Date(v.created_at).toLocaleTimeString('es-PE')}
                  </p>
                  <p className="text-sm font-bold text-emerald-400">S/ {Number(v.total).toFixed(2)}</p>
                </div>
                <button
                  onClick={() => handleRecuperar(v)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
                >
                  Recuperar
                </button>
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
