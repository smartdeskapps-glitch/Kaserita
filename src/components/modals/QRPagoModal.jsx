import React, { useRef, useState } from 'react';

/**
 * Muestra el QR real de Yape/Plin de la bodega (imagen subida una sola vez y
 * guardada localmente en el navegador de la caja). No se genera un QR
 * "falso" porque Yape/Plin exigen su propio formato propietario emitido
 * por el banco/app — aquí se reutiliza la imagen física/oficial del negocio.
 */
const storageKey = (bodegaId, medio) => `qr_pago_${medio}_${bodegaId}`;

export default function QRPagoModal({ bodegaId, medioPago, monto, onClose }) {
  const [qrImg, setQrImg] = useState(() => localStorage.getItem(storageKey(bodegaId, medioPago)));
  const inputRef = useRef(null);

  const handleSubirQR = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem(storageKey(bodegaId, medioPago), reader.result);
      setQrImg(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-xs w-full p-6 shadow-2xl text-center space-y-4">
        <h2 className="text-lg font-bold text-white">Pago con {medioPago}</h2>
        <p className="text-sm text-slate-300">
          Monto a cobrar: <span className="font-black text-emerald-400 text-xl">S/ {Number(monto).toFixed(2)}</span>
        </p>

        {qrImg ? (
          <div className="bg-white p-3 rounded-xl inline-block">
            <img src={qrImg} alt={`QR ${medioPago}`} className="w-48 h-48 object-contain" />
          </div>
        ) : (
          <div className="bg-slate-900 border border-dashed border-slate-600 rounded-xl p-6 text-xs text-slate-400">
            Aún no has guardado el QR de {medioPago} de tu bodega.
          </div>
        )}

        <input ref={inputRef} type="file" accept="image/*" onChange={handleSubirQR} className="hidden" />
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg"
        >
          {qrImg ? 'Cambiar imagen del QR' : `Subir QR de ${medioPago}`}
        </button>

        <button
          onClick={onClose}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
