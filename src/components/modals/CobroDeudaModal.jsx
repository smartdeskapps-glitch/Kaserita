import React, { useEffect, useState } from 'react';
import { creditosService } from '../../services/creditosService';

export default function CobroDeudaModal({ bodegaId, cajeroId, onClose, notificar, onPagoRealizado }) {
  const [deudores, setDeudores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [clienteSel, setClienteSel] = useState(null);
  const [boletas, setBoletas] = useState([]);
  const [monto, setMonto] = useState('');
  const [medioPago, setMedioPago] = useState('EFECTIVO');
  const [procesando, setProcesando] = useState(false);

  const cargarDeudores = async () => {
    setCargando(true);
    const data = await creditosService.obtenerClientesConDeuda(bodegaId);
    setDeudores(data);
    setCargando(false);
  };

  useEffect(() => {
    cargarDeudores();
  }, [bodegaId]);

  const seleccionarCliente = async (cliente) => {
    setClienteSel(cliente);
    setMonto('');
    const bols = await creditosService.obtenerBoletasPendientes(bodegaId, cliente.id);
    setBoletas(bols.filter((b) => !b.anulada));
  };

  const handlePagar = async () => {
    const montoNum = Number(monto) || 0;
    if (montoNum <= 0) {
      notificar('Ingresa un monto válido a pagar.', 'error');
      return;
    }
    setProcesando(true);
    try {
      const resultado = await creditosService.procesarPagoDeuda({
        bodegaId,
        clienteId: clienteSel.id,
        cajeroId,
        montoPagado: montoNum,
        medioPago
      });
      notificar(
        `Pago registrado. Nuevo saldo de ${clienteSel.nombre_completo}: S/ ${resultado.nuevoSaldo.toFixed(2)}`,
        'success'
      );
      onPagoRealizado?.(resultado);
      await cargarDeudores();
      setClienteSel(null);
      setMonto('');
    } catch (err) {
      notificar(`Error al procesar pago: ${err.message}`, 'error');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-white">Cobrar Deuda Pendiente (Fiados)</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Lista de deudores */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Clientes con Saldo Pendiente</p>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {cargando ? (
                <p className="text-xs text-slate-500">Cargando...</p>
              ) : deudores.length === 0 ? (
                <p className="text-xs text-slate-500">No hay deudores pendientes. 🎉</p>
              ) : (
                deudores.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => seleccionarCliente(c)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition ${
                      clienteSel?.id === c.id
                        ? 'bg-emerald-600/20 border-emerald-500 text-white'
                        : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{c.nombre_completo}</span>
                      <span className="text-rose-400 font-bold">S/ {Number(c.saldo_actual).toFixed(2)}</span>
                    </div>
                    <span className="text-slate-500">DNI: {c.dni} · Límite: S/ {Number(c.limite_credito || 0).toFixed(2)}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detalle y cobro */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
            {!clienteSel ? (
              <p className="text-xs text-slate-500 text-center py-10">Selecciona un cliente para ver sus boletas y cobrar.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-bold text-white">{clienteSel.nombre_completo}</p>
                  <p className="text-xs text-slate-400">Saldo actual: <span className="text-rose-400 font-bold">S/ {Number(clienteSel.saldo_actual).toFixed(2)}</span></p>
                </div>

                <div className="max-h-32 overflow-y-auto space-y-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">Boletas a crédito</p>
                  {boletas.length === 0 ? (
                    <p className="text-[11px] text-slate-500">Sin boletas registradas.</p>
                  ) : (
                    boletas.map((b) => (
                      <div key={b.id} className="flex justify-between text-[11px] text-slate-300 bg-slate-800/70 px-2 py-1 rounded">
                        <span>{b.nro_boleta}</span>
                        <span>S/ {Number(b.total_venta).toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Monto a Pagar (S/)</label>
                  <input
                    type="number"
                    step="0.10"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => setMonto(String(clienteSel.saldo_actual))}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 underline mt-1"
                  >
                    Pagar todo (S/ {Number(clienteSel.saldo_actual).toFixed(2)})
                  </button>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Medio de Pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['EFECTIVO', 'YAPE', 'TARJETA'].map((m) => (
                      <button
                        key={m}
                        onClick={() => setMedioPago(m)}
                        className={`py-1.5 text-[11px] font-bold rounded-lg border transition ${
                          medioPago === m
                            ? 'bg-emerald-600 border-emerald-400 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handlePagar}
                  disabled={procesando}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold rounded-lg"
                >
                  {procesando ? 'Procesando...' : 'Registrar Pago'}
                </button>
              </div>
            )}
          </div>
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
