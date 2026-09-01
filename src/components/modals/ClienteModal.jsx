import React, { useState } from 'react';
import { creditosService } from '../../services/creditosService';

export default function ClienteModal({ bodegaId, onClose, notificar, onGuardado }) {
  const [form, setForm] = useState({
    dni: '',
    nombre: '',
    telefono: '',
    correo: '',
    limiteCredito: '200.00'
  });
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const handleGuardar = async () => {
    if (!form.dni.trim() || !form.nombre.trim()) {
      notificar('DNI y Nombre son obligatorios.', 'error');
      return;
    }
    setGuardando(true);
    try {
      const cliente = await creditosService.crearClienteConCredito({
        bodegaId,
        dni: form.dni,
        nombre: form.nombre,
        telefono: form.telefono,
        correo: form.correo,
        limiteCredito: form.limiteCredito
      });
      notificar(`Cliente "${cliente.nombre_completo}" guardado con límite S/ ${Number(cliente.limite_credito).toFixed(2)}.`, 'success');
      onGuardado?.(cliente);
      onClose();
    } catch (err) {
      notificar(`Error al guardar cliente: ${err.message}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-3">
        <h2 className="text-lg font-bold text-white">Nuevo Cliente con Crédito</h2>

        <div>
          <label className="text-xs text-slate-400 block mb-1">DNI *</label>
          <input
            value={form.dni}
            onChange={set('dni')}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Nombre Completo *</label>
          <input
            value={form.nombre}
            onChange={set('nombre')}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Teléfono</label>
            <input
              value={form.telefono}
              onChange={set('telefono')}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Correo</label>
            <input
              value={form.correo}
              onChange={set('correo')}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Límite de Crédito (S/) *</label>
          <input
            type="number"
            step="10"
            value={form.limiteCredito}
            onChange={set('limiteCredito')}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
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
            onClick={handleGuardar}
            disabled={guardando}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold rounded-lg"
          >
            {guardando ? 'Guardando...' : 'Guardar Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
