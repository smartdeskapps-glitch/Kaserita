import React, { useState } from 'react';
import { inventarioService } from '../../services/inventarioService';

export default function EntradaMercaderiaModal({ bodegaId, cajeroId, productos, onClose, notificar, onRegistrado }) {
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [proveedorRuc, setProveedorRuc] = useState('');
  const [nroFactura, setNroFactura] = useState('');
  const [items, setItems] = useState([]);
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [guardando, setGuardando] = useState(false);

  const agregarItem = () => {
    const prod = productos.find((p) => String(p.id) === String(productoId));
    if (!prod) {
      notificar('Selecciona un producto válido.', 'error');
      return;
    }
    const cant = Number(cantidad) || 0;
    const costo = Number(costoUnitario) || 0;
    if (cant <= 0 || costo <= 0) {
      notificar('Cantidad y costo unitario deben ser mayores a 0.', 'error');
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        productoId: prod.id,
        descripcion: prod.descripcion,
        cantidad: cant,
        costoUnitario: costo,
        subtotal: +(cant * costo).toFixed(2)
      }
    ]);
    setProductoId('');
    setCantidad('1');
    setCostoUnitario('');
  };

  const quitarItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const totalCompra = +items.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2);

  const handleGuardar = async () => {
    if (items.length === 0) {
      notificar('Agrega al menos un producto a la entrada.', 'error');
      return;
    }
    setGuardando(true);
    try {
      const resultado = await inventarioService.registrarEntradaMercaderia({
        bodegaId,
        proveedorNombre,
        proveedorRuc,
        nroFactura,
        cajeroId,
        totalCompra,
        items
      });
      notificar('Entrada de mercadería registrada. Costos actualizados.', 'success');
      onRegistrado?.(resultado);
      onClose();
    } catch (err) {
      notificar(`Error al registrar entrada: ${err.message}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-white">Entrada de Mercadería / Compra a Proveedor</h2>

        <div className="grid grid-cols-3 gap-3">
          <input
            value={proveedorNombre}
            onChange={(e) => setProveedorNombre(e.target.value)}
            placeholder="Proveedor"
            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <input
            value={proveedorRuc}
            onChange={(e) => setProveedorRuc(e.target.value)}
            placeholder="RUC Proveedor"
            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <input
            value={nroFactura}
            onChange={(e) => setNroFactura(e.target.value)}
            placeholder="N° Factura/Guía"
            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase">Agregar producto a la compra</p>
          <div className="grid grid-cols-12 gap-2">
            <select
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              className="col-span-6 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Selecciona producto...</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.descripcion} {p.cod_ean ? `(${p.cod_ean})` : ''}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.001"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="Cant."
              className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="number"
              step="0.01"
              value={costoUnitario}
              onChange={(e) => setCostoUnitario(e.target.value)}
              placeholder="Costo Unit."
              className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={agregarItem}
              className="col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg"
            >
              + Añadir
            </button>
          </div>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1.5">
          {items.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Sin productos agregados aún.</p>
          ) : (
            items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-900/80 border border-slate-750 rounded-lg px-3 py-2 text-xs">
                <span className="text-slate-200 flex-1">{it.descripcion}</span>
                <span className="text-slate-400 w-16 text-center">{it.cantidad} u.</span>
                <span className="text-slate-400 w-20 text-center">S/ {it.costoUnitario.toFixed(2)}</span>
                <span className="text-emerald-400 font-bold w-20 text-right">S/ {it.subtotal.toFixed(2)}</span>
                <button onClick={() => quitarItem(idx)} className="text-rose-400 hover:text-rose-300 ml-2">✕</button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <span className="text-sm font-bold text-slate-300 uppercase">Total Compra:</span>
          <span className="text-2xl font-black text-emerald-400">S/ {totalCompra.toFixed(2)}</span>
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
            {guardando ? 'Registrando...' : 'Registrar Entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}
