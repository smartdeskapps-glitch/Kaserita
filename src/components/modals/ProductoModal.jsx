import React, { useState } from 'react';
import { inventarioService } from '../../services/inventarioService';

export default function ProductoModal({ bodegaId, onClose, onCreado, notificar }) {
  const [form, setForm] = useState({
    descripcion: '',
    cod_ean: '',
    sku: '',
    precio_costo: '',
    precio_venta: '',
    categoria: 'General',
    unidad_medida: 'UND'
  });
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const handleGuardar = async () => {
    if (!form.descripcion.trim() || !form.precio_venta) {
      notificar('Descripción y precio de venta son obligatorios.', 'error');
      return;
    }
    setGuardando(true);
    try {
      const producto = await inventarioService.crearProducto({
        bodegaId,
        descripcion: form.descripcion,
        cod_ean: form.cod_ean,
        sku: form.sku,
        precio_costo: form.precio_costo,
        precio_venta: form.precio_venta,
        categoria: form.categoria,
        unidad_medida: form.unidad_medida
      });
      notificar(`Producto "${producto.descripcion}" registrado.`, 'success');
      onCreado?.(producto);
      onClose();
    } catch (err) {
      notificar(`Error al crear producto: ${err.message}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-3">
        <h2 className="text-lg font-bold text-white">Registrar Nuevo Producto</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-slate-400 block mb-1">Descripción *</label>
            <input
              value={form.descripcion}
              onChange={set('descripcion')}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              placeholder="Ej. Leche Gloria Entera 400g"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Código EAN</label>
            <input
              value={form.cod_ean}
              onChange={set('cod_ean')}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              placeholder="775..."
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">SKU</label>
            <input
              value={form.sku}
              onChange={set('sku')}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              placeholder="Código interno"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Precio Costo (S/)</label>
            <input
              type="number"
              step="0.01"
              value={form.precio_costo}
              onChange={set('precio_costo')}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Precio Venta (S/) *</label>
            <input
              type="number"
              step="0.01"
              value={form.precio_venta}
              onChange={set('precio_venta')}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Categoría</label>
            <input
              value={form.categoria}
              onChange={set('categoria')}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Unidad de Medida</label>
            <div className="flex gap-2">
              {['UND', 'KG'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, unidad_medida: u }))}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                    form.unidad_medida === u
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
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
            {guardando ? 'Guardando...' : 'Guardar Producto'}
          </button>
        </div>
      </div>
    </div>
  );
}
