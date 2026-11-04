import React, { useEffect, useState } from 'react';

// Código QR generado en el propio navegador (sin enviar el enlace a ningún
// servicio externo). La librería se baja solo al abrir el QR.
export default function QRLocal({ texto, alt = 'Código QR', className = '', ancho = 320 }) {
  const [src, setSrc] = useState('');
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setSrc('');
    setFallo(false);
    import('qrcode')
      .then((m) => (m.default || m).toDataURL(String(texto || ''), { width: 640, margin: 2, errorCorrectionLevel: 'M' }))
      .then((url) => { if (!cancelado) setSrc(url); })
      .catch(() => { if (!cancelado) setFallo(true); });
    return () => { cancelado = true; };
  }, [texto]);

  if (fallo) return <p className="text-xs text-rose-600 text-center">No se pudo generar el QR. Recarga la página e intenta de nuevo.</p>;
  if (!src) return <div className={className} style={{ width: ancho, height: ancho, maxWidth: '100%' }} aria-busy="true" />;
  return <img src={src} alt={alt} width={ancho} height={ancho} className={className} />;
}
