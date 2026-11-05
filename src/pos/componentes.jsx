// Componentes de presentación del POS sin estado propio de la app (tarjetas,
// boleta, teclado numérico, filtros de fecha, íconos...). Extraídos de src/main.jsx.
import React, { useState, useRef, useEffect } from 'react';
import { detalleComboTicket } from '../lib/combos.js';
import { fechaHoyISO, fechaISOLocal, FotoProducto } from '../PanelAdminCompartido.jsx';
import { COLOR_BILLETE, tonoCategoria } from './utilidades.js';
import { DENOMINACIONES, totalConteo } from '../lib/arqueo.js';

// Selector de pestañas en pastilla para las ventanas que agrupan dos vistas
// (Toma/Historial de inventario, Ventas/Cierres). La pestaña activa no lleva
// onClick; la otra abre la ventana hermana.
export function PestanasModal({ pestanas }) {
  return (
    <div className="flex gap-0.5 p-1 rounded-full bg-[#5b4bd6]/[0.08] shrink-0">
      {pestanas.map((t) => (
        <button
          key={t.texto}
          type="button"
          onClick={t.onClick}
          className={`flex-1 h-9 rounded-full text-[13px] font-semibold transition ${
            t.activa ? 'bg-white text-[#2d284b] shadow-[0_1px_3px_rgba(40,20,80,0.15)]' : 'text-[#6b6890] hover:text-[#2d284b]'
          }`}
        >
          {t.texto}
        </button>
      ))}
    </div>
  );
}

// Teclado numérico en pantalla, reutilizable para efectivo y pagos mixtos.
export function NumericKeypad({ value, onChange }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'BORRAR'];
  const presionar = (t) => {
    if (t === 'BORRAR') { onChange(value.slice(0, -1)); return; }
    if (t === '.' && value.includes('.')) return;
    onChange(value + t);
  };
  return (
    <div className="grid grid-cols-3 gap-1.5 mt-3">
      {teclas.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => presionar(t)}
          className="h-11 bg-white hover:bg-[#f7f9ff] ring-1 ring-[#5b4bd6]/10 rounded-[14px] text-lg font-semibold text-stone-800 flex items-center justify-center active:scale-95 transition"
        >
          {t === 'BORRAR' ? <IconoTrazo nombre="borrar" className="w-[22px] h-[22px] text-[#5b4bd6]" /> : t}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange('')}
        className="col-span-3 h-9 bg-rose-50 hover:bg-rose-100 rounded-full text-xs font-semibold text-rose-700 transition"
      >
        Limpiar
      </button>
    </div>
  );
}

// Ticket con formato de impresora térmica (80mm): invisible en pantalla
// (clase sr-only) pero se muestra en su lugar al imprimir gracias al CSS
// @media print de la cabecera, que oculta todo lo demás.
// Calculadora rápida: dado el costo, sugiere el precio de venta según un
// % de margen (precio = costo × (1 + margen/100)).
export function CalculadoraMargen({ costo, onAplicar }) {
  const [margen, setMargen] = useState('30');
  const costoNum = Number(costo) || 0;
  const sugerido = +(costoNum * (1 + (Number(margen) || 0) / 100)).toFixed(2);
  return (
    <div className="flex items-end gap-1.5 bg-stone-50/60 border border-stone-200 rounded-lg p-1.5 mt-1">
      <div className="flex-1">
        <label className="text-xs text-stone-500 block">Margen %:</label>
        <input
          type="number"
          step="1"
          value={margen}
          onChange={(e) => setMargen(e.target.value)}
          className="w-full bg-stone-100 border border-stone-300 rounded px-2 py-1 text-xs text-stone-900"
        />
      </div>
      <span className="text-xs text-stone-500 pb-1.5">→ S/ {sugerido.toFixed(2)}</span>
      <button
        type="button"
        onClick={() => onAplicar(sugerido)}
        disabled={costoNum <= 0}
        className="px-2 py-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white text-xs font-bold rounded"
      >
        Usar
      </button>
    </div>
  );
}

// Línea de corte del ticket impreso: punteada, con las dos muescas redondas de
// los lados (hechas con bordes, que sí salen en cualquier ticketera).
export function CorteTicket() {
  const muesca = { position: 'absolute', top: -7, width: 7, height: 14, border: '2px solid #000', background: '#fff' };
  return (
    <div style={{ position: 'relative', margin: '10px 0', borderTop: '2px dashed #000' }}>
      <span style={{ ...muesca, left: -6, borderLeft: 'none', borderRadius: '0 14px 14px 0' }}></span>
      <span style={{ ...muesca, right: -6, borderRight: 'none', borderRadius: '14px 0 0 14px' }}></span>
    </div>
  );
}

// Imprime la boleta en una ventana propia y del tamaño justo: 80 mm de ancho y el
// largo exacto de la boleta. Así la ticketera no gasta papel de más (antes salía
// una hoja larga con la boleta chica arriba) ni achica el texto para que quepa.
export function imprimirBoletaTermica() {
  const origen = document.getElementById('recibo-imprimible');
  if (!origen) { window.print(); return; }
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;left:-9999px;top:0;width:80mm;height:10px;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(marco);
  const doc = marco.contentDocument;
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Boleta</title><style>'
    + '*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}'
    + 'body{width:80mm;padding:2mm 4mm 8mm;font-family:"Courier New",monospace;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '#recibo-imprimible{width:100%;font-weight:700;text-align:center}'
    + '</style></head><body></body></html>');
  doc.close();
  const copia = doc.importNode(origen, true);
  copia.removeAttribute('class');
  copia.removeAttribute('style');
  copia.style.cssText = 'font-weight:700;text-align:center;width:100%';
  doc.body.appendChild(copia);
  const altoMm = Math.ceil((doc.documentElement.scrollHeight * 25.4) / 96) + 2;
  const estilo = doc.createElement('style');
  estilo.textContent = `@page{size:80mm ${altoMm}mm;margin:0}`;
  doc.head.appendChild(estilo);
  const quitar = () => { try { marco.remove(); } catch (e) { /* ya no está */ } };
  marco.contentWindow.onafterprint = quitar;
  marco.contentWindow.focus();
  marco.contentWindow.print();
  setTimeout(quitar, 60000);
}

// Boleta impresa (térmica 58/80 mm): en blanco y negro, con el mismo orden de la
// pantalla de venta exitosa. Las líneas que no tienen dato (dirección, teléfono,
// cajero, recibido/vuelto) simplemente no se imprimen.
export function ReciboImprimible({ bodega, direccion, telefono, boleta, fecha, cliente, cajero, medioPago, recibido, items, total, anulada, subtotal, descuento }) {
  const etiqueta = { fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' };
  const fila = { display: 'flex', justifyContent: 'space-between', gap: 6 };
  const tabla = { display: 'grid', gridTemplateColumns: '26px 1fr 62px', gap: 4 };
  const medio = String(medioPago || '');
  const medioLindo = medio.charAt(0).toUpperCase() + medio.slice(1).toLowerCase();
  const unidades = items.reduce((a, it) => a + (Number(it.cantidad) || 0), 0);
  const vuelto = Number(recibido) >= Number(total) ? Number(recibido) - Number(total) : 0;
  return (
    <div id="recibo-imprimible" className="sr-only" style={{ fontWeight: 700, textAlign: 'center' }}>
      <div style={{ border: '2px solid #000', borderRadius: 4, padding: '5px 8px', margin: '0 auto 4px', display: 'inline-block' }}>
        <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 0.3 }}>{bodega}</div>
      </div>
      {(direccion || telefono) && (
        <div style={{ fontSize: 11, lineHeight: 1.3 }}>
          {direccion && <div>{direccion}</div>}
          {telefono && <div>Tel. {telefono}</div>}
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 900, marginTop: 6 }}>¡Gracias por su compra!</div>
      <div style={{ fontSize: 11 }}>Tu boleta se emitió correctamente</div>
      {anulada && <div style={{ fontWeight: 900, fontSize: 14, marginTop: 3 }}>*** ANULADA ***</div>}

      <CorteTicket />
      <div style={{ ...fila, textAlign: 'left' }}>
        <div>
          <div style={etiqueta}>Boleta</div>
          <div style={{ fontSize: 15 }}>{boleta}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={etiqueta}>Fecha y hora</div>
          <div style={{ fontSize: 12 }}>{fecha}</div>
        </div>
      </div>
      <div style={{ textAlign: 'left', fontSize: 11, marginTop: 6 }}>
        <div>Cliente: {cliente}</div>
        {cajero && <div>Atendido por: {cajero}</div>}
      </div>

      <CorteTicket />
      <div style={{ textAlign: 'left', fontSize: 12 }}>
        <div style={{ ...tabla, ...etiqueta, borderBottom: '2px solid #000', paddingBottom: 3, marginBottom: 4 }}>
          <span>Cant</span><span>Producto</span><span style={{ textAlign: 'right' }}>Importe</span>
        </div>
        {items.map((it, i) => (
          <div key={i} style={{ ...tabla, marginBottom: 5 }}>
            <span>{it.cantidad}</span>
            <span>
              {it.descripcion}
              <span style={{ display: 'block', fontSize: 10 }}>{Number(it.precioUnitario || 0).toFixed(2)} c/u{it.unidad && it.unidad !== 'UND' ? ` (${it.unidad})` : ''}</span>
              {detalleComboTicket(it).map((l, k) => (
                <span key={k} style={{ display: 'block', fontSize: 10, paddingLeft: 2 }}>· {l}</span>
              ))}
            </span>
            <span style={{ textAlign: 'right' }}>{Number(it.subtotal).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '2px dashed #000', margin: '6px 0' }}></div>
      <div style={{ ...etiqueta, textAlign: 'left' }}>{unidades} {unidades === 1 ? 'artículo' : 'artículos'}</div>
      {descuento > 0 && (
        <>
          <div style={{ ...fila, fontSize: 12 }}>
            <span>Subtotal</span><span>S/ {Number(subtotal).toFixed(2)}</span>
          </div>
          <div style={{ ...fila, fontSize: 12 }}>
            <span>Descuento</span><span>- S/ {Number(descuento).toFixed(2)}</span>
          </div>
        </>
      )}
      <div style={{ ...fila, alignItems: 'baseline', marginTop: 4, textAlign: 'left' }}>
        <span style={etiqueta}>Monto</span>
        <span style={{ fontSize: 24, fontWeight: 900 }}>S/ {Number(total).toFixed(2)}</span>
      </div>
      <div style={{ border: '2px solid #000', borderRadius: 8, padding: '4px 8px', marginTop: 6, textAlign: 'left', fontSize: 12 }}>
        <div style={fila}><span>Pago</span><span>{medioLindo}</span></div>
        {Number(recibido) > 0 && (
          <>
            <div style={fila}><span>Recibido</span><span>S/ {Number(recibido).toFixed(2)}</span></div>
            <div style={fila}><span>Vuelto</span><span>S/ {vuelto.toFixed(2)}</span></div>
          </>
        )}
      </div>

      <CorteTicket />
      <div style={{ fontSize: 10, lineHeight: 1.3 }}>
        Documento sin valor tributario.
        <br />No válido como comprobante de pago ante SUNAT. Solo informativo.
      </div>
    </div>
  );
}

// Muestra el QR real de Yape/Plin de la bodega (imagen subida una sola vez y
// guardada en este navegador). No se genera un QR "falso" porque Yape/Plin
// usan un formato propietario del banco — aquí se reutiliza la imagen
// física/oficial del negocio.
export function QRPagoModal({ bodegaId, medioPago, monto, onClose }) {
  const storageKey = `qr_pago_${medioPago}_${bodegaId}`;
  const [qrImg, setQrImg] = useState(() => localStorage.getItem(storageKey));
  const inputRef = useRef(null);

  const guardarQRDesdeArchivo = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem(storageKey, reader.result);
      setQrImg(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubirQR = (e) => guardarQRDesdeArchivo(e.target.files?.[0]);

  // Muchos dueños ya tienen el QR como una captura de pantalla en el
  // portapapeles (de Yape/Plin) -- con Ctrl+V se pega directo, sin tener
  // que guardarla como archivo primero para recién subirla.
  useEffect(() => {
    const manejarPegado = (e) => {
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'));
      if (item) guardarQRDesdeArchivo(item.getAsFile());
    };
    window.addEventListener('paste', manejarPegado);
    return () => window.removeEventListener('paste', manejarPegado);
  }, [storageKey]);

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
      <div className="bg-stone-100 border border-stone-200 rounded-2xl max-w-xs w-full p-5 shadow-2xl text-center space-y-3">
        <h3 className="text-base font-bold text-stone-900">Pago con {medioPago}</h3>
        <p className="text-sm text-stone-700">
          Monto: <span className="font-black text-orange-600 text-lg">S/ {Number(monto).toFixed(2)}</span>
        </p>
        {qrImg ? (
          <div className="bg-white p-3 rounded-xl inline-block">
            <img src={qrImg} alt={`QR ${medioPago}`} className="w-44 h-44 object-contain" />
          </div>
        ) : (
          <div className="bg-stone-50 border border-dashed border-stone-300 rounded-xl p-5 text-xs text-stone-600">
            Aún no has guardado el QR de {medioPago} de tu bodega.
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleSubirQR} className="hidden" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-2 bg-stone-200 hover:bg-stone-300 text-stone-900 text-xs font-semibold rounded-lg"
        >
          {qrImg ? 'Cambiar imagen del QR' : `Subir QR de ${medioPago}`}
        </button>
        <p className="text-[10px] text-stone-400">o copia la imagen y pégala aquí con Ctrl+V</p>
        <button onClick={onClose} className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl">
          Cerrar
        </button>
      </div>
    </div>
  );
}

// Ícono de la barra lateral de navegación (desktop) / barra inferior (mobile).
// Barra de "Desde / Hasta" + atajos rápidos (Hoy / Últimos N días / Este
// mes), usada en Historial de Cierres y en el Dashboard de Ventas -- antes
// este bloque estaba copiado en los dos lugares, con solo el nombre de los
// setters y el número de días distinto.
export function FiltroFechasRapido({ desde, hasta, setDesde, setHasta, onRango, diasAtras, children, tema }) {
  const dsh = tema === 'dsh';
  const claseBuscar = dsh ? 'bg-[#2D284B] hover:bg-[#3b3466]' : 'bg-[#5b4bd6] hover:bg-[#473bb5]';
  const claseAtajo = dsh ? 'hover:bg-[#dde4fa] hover:text-[#2D284B]' : 'hover:bg-[#dde4fa] hover:text-[#2d284b]';
  const irAHoy = () => {
    const hoy = fechaHoyISO();
    setDesde(hoy); setHasta(hoy); onRango(hoy, hoy);
  };
  const irAUltimosNDias = () => {
    const hoy = fechaHoyISO();
    const desdeDate = new Date();
    desdeDate.setDate(desdeDate.getDate() - (diasAtras - 1));
    const desdeStr = fechaISOLocal(desdeDate);
    setDesde(desdeStr); setHasta(hoy); onRango(desdeStr, hoy);
  };
  const irAEsteMes = () => {
    const hoy = fechaHoyISO();
    const inicioMes = hoy.slice(0, 8) + '01';
    setDesde(inicioMes); setHasta(hoy); onRango(inicioMes, hoy);
  };
  return (
    <div className="flex flex-wrap items-end gap-2 shrink-0">
      <div>
        <label className="text-xs text-stone-600 block mb-1">Desde:</label>
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="bg-white border border-stone-200/70 shadow-sm rounded-full px-3 py-1.5 text-xs text-stone-900"
        />
      </div>
      <div>
        <label className="text-xs text-stone-600 block mb-1">Hasta:</label>
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="bg-white border border-stone-200/70 shadow-sm rounded-full px-3 py-1.5 text-xs text-stone-900"
        />
      </div>
      <button
        onClick={() => onRango(desde, hasta)}
        className={`px-4 py-1.5 ${claseBuscar} text-white text-xs font-semibold rounded-full shadow-sm`}
      >
        Buscar
      </button>
      <div className="inline-flex items-center bg-white/70 shadow-sm rounded-full p-0.5">
        <button onClick={irAHoy} className={`px-3 py-1 text-stone-600 ${claseAtajo} text-xs font-semibold rounded-full transition`}>
          Hoy
        </button>
        <button onClick={irAUltimosNDias} className={`px-3 py-1 text-stone-600 ${claseAtajo} text-xs font-semibold rounded-full transition`}>
          Últimos {diasAtras} días
        </button>
        <button onClick={irAEsteMes} className={`px-3 py-1 text-stone-600 ${claseAtajo} text-xs font-semibold rounded-full transition`}>
          Este mes
        </button>
      </div>
      {children}
    </div>
  );
}

// Informativo dentro del cierre de turno: cuánto se vendió en cada medio
// que NO es efectivo, para que el cajero lo cruce contra su POS de
// tarjeta / apps de Yape y Plin -- no participa en el cálculo de cuánto
// debería haber en la caja física, que sigue siendo solo efectivo.
export function DesgloseMediosPago({ desglose }) {
  if (!desglose) return null;
  const filas = [
    { label: 'Yape', valor: desglose.YAPE, color: '#5b4bd6' },
    { label: 'Plin', valor: desglose.PLIN, color: '#06b6d4' },
    { label: 'Tarjeta', valor: desglose.TARJETA, color: '#f59e0b' },
    { label: 'Crédito', valor: desglose.CREDITO, color: '#64748b' },
    { label: 'Tarjeta/Otro (de ventas Mixtas)', valor: desglose.MIXTO_OTRO, color: '#94a3b8' }
  ].filter((f) => f.valor > 0);
  if (filas.length === 0) return null;
  return (
    <div className="mt-3.5 bg-[#f8faff] border border-stone-100 rounded-[18px] px-3.5 py-1 text-left text-xs text-stone-600">
      <p className="font-semibold text-stone-500 py-2 leading-snug">Otros medios de pago: no es efectivo. Cruza estos montos con tu app de Yape o tu POS de tarjeta.</p>
      {filas.map((f) => (
        <div key={f.label} className="flex justify-between items-center py-1.5 border-t border-dashed border-[#d2d9f5]">
          <span className="flex items-center"><i className="w-[9px] h-[9px] rounded-[3px] inline-block mr-2" style={{ background: f.color }}></i>{f.label}</span>
          <b className="text-stone-800">S/ {f.valor.toFixed(2)}</b>
        </div>
      ))}
    </div>
  );
}

export function ContadorEfectivo({ conteo, onChange }) {
  const cambiar = (d, n) => onChange({ ...conteo, [d]: Math.max(0, Math.floor(n) || 0) });
  const fila = (d) => {
    const n = Math.max(0, Math.floor(Number(conteo[d])) || 0);
    const esBillete = d >= 10;
    return (
      <div key={d} className="flex items-center gap-2.5 py-[7px] border-b border-dashed border-[#d2d9f5] last:border-b-0">
        <span className="flex items-center gap-2 text-[13px] font-bold min-w-[88px]">
          {esBillete
            ? <span className="w-[34px] h-5 rounded-[5px] grid place-items-center text-[9px] font-extrabold text-white shrink-0" style={{ background: COLOR_BILLETE[d] }}>S/</span>
            : <span className="w-[22px] h-[22px] mx-1.5 rounded-full grid place-items-center text-[9px] font-extrabold bg-[#d2d9f5] text-[#2d284b] shrink-0">¢</span>}
          {d >= 1 ? `S/ ${d}` : d.toFixed(2)}
        </span>
        <span className="ml-auto flex items-center bg-[#eef1fb] rounded-[11px]">
          <button type="button" aria-label={`Menos ${d}`} onClick={() => cambiar(d, n - 1)} className="w-[30px] h-[30px] rounded-[11px] text-[#2d284b] hover:bg-[#dde4fa] grid place-items-center"><i className="fa-solid fa-minus text-[11px]"></i></button>
          <input type="number" min="0" inputMode="numeric" value={n || ''} placeholder="0" aria-label={`Cantidad de ${d}`} onChange={(e) => cambiar(d, Number(e.target.value))} className="w-[38px] h-[30px] bg-transparent border-0 text-center font-extrabold text-sm outline-none p-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          <button type="button" aria-label={`Más ${d}`} onClick={() => cambiar(d, n + 1)} className="w-[30px] h-[30px] rounded-[11px] text-[#2d284b] hover:bg-[#dde4fa] grid place-items-center"><i className="fa-solid fa-plus text-[11px]"></i></button>
        </span>
        <span className={`min-w-[70px] text-right text-[12.5px] font-bold ${n ? 'text-stone-900' : 'text-stone-400'}`}>S/ {(n * d).toFixed(2)}</span>
      </div>
    );
  };
  const etiqueta = 'text-[11px] font-bold text-stone-500 tracking-[0.06em] uppercase';
  return (
    <div className="mt-1.5 border border-stone-100 rounded-[18px] bg-[#f8faff] px-3.5 py-1.5">
      <p className={`${etiqueta} pt-2 pb-0.5`}>Billetes</p>
      {DENOMINACIONES.filter((d) => d >= 10).map(fila)}
      <p className={`${etiqueta} pt-2.5 pb-0.5`}>Monedas</p>
      {DENOMINACIONES.filter((d) => d < 10).map(fila)}
      <div className="flex justify-between items-center pt-2.5 pb-1.5 mt-1 border-t border-[#d2d9f5] text-[12.5px] font-bold">
        <span>Total contado en caja <b className="text-base font-extrabold ml-1.5">S/ {totalConteo(conteo).toFixed(2)}</b></span>
        <button type="button" onClick={() => onChange({})} className="text-xs font-bold text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg px-1.5 py-1">Limpiar</button>
      </div>
    </div>
  );
}

// Variación porcentual del Dashboard: verde si sube, rojo si baja. Sin
// porcentaje (null) no dibuja nada -- pasa cuando el período anterior no
// tiene ventas y comparar contra cero no significa nada.
export function VariacionPct({ pct, corto }) {
  if (pct == null) return null;
  const sube = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${sube ? 'text-emerald-600' : 'text-rose-600'}`}>
      <i className={`fa-solid ${sube ? 'fa-arrow-up' : 'fa-arrow-down'} text-[10px]`}></i>
      {Math.abs(pct).toFixed(0)}%
      {!corto && <span className="font-normal text-stone-400">vs. período anterior</span>}
    </span>
  );
}

// Iconos vectoriales de trazo fino (los mismos de la ventana de venta exitosa).
export const ICONOS_TRAZO = {
  check: <path d="M20 6 9 17l-5-5" />,
  print: <><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  chat: <><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /><path d="M9 10c.5 2 2.5 4 5 5l1.5-1.5-2-1-1 .8c-.8-.4-1.6-1.2-2-2l.8-1-1-2z" /></>,
  bluetooth: <path d="m7 7 10 10-5 5V2l5 5L7 17" />,
  till: <><rect x="3" y="12" width="18" height="9" rx="2" /><path d="M6 12V6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" /><path d="M9 8.5h6" /><path d="M8 16.5h.01M12 16.5h.01M16 16.5h.01" /></>,
  warn: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17.5h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  bag: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
  efectivo: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  movil: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></>,
  tarjeta: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>,
  credito: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  mixto: <><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 12 10 5 10-5M2 17l10 5 10-5" /></>,
  calc: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v.01M14 21h.01M17 21h4v-4" /></>,
  etiqueta: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  borrar: <><path d="M21 5H9l-6 7 6 7h12z" /><path d="m17 9-4 6M13 9l4 6" /></>,
  recibo: <><path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z" /><path d="M8 8h8M8 12h8" /></>,
  caja: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  buscar: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  abajo: <path d="m6 9 6 6 6-6" />,
  tienda: <><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>,
  ubicacion: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  campana: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  moto: <><circle cx="5.5" cy="17" r="3" /><circle cx="18.5" cy="17" r="3" /><path d="M8.5 17h5l-2.5-8H8" /><path d="M11 9h4l3.5 8" /></>,
  compartir: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
  copiar: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
  barras: <><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" /><path d="M8 8v8M11 8v8M14 8v5M17 8v8" /></>,
  camaraGira: <><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></>,
  camaraOff: <><path d="M23 7l-7 5 7 5z" /><rect x="1" y="5" width="15" height="14" rx="2" /><path d="M4 2l16 20" /></>,
  cambio: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  back: <path d="m15 18-6-6 6-6" />,
  pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 12v6" /><path d="m9 15 3 3 3-3" /></>,
  hand: <><path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16" /><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" /><path d="m2 16 6 6" /><circle cx="16" cy="9" r="2.9" /><circle cx="6" cy="5" r="3" /></>,
  cloud: <><path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 5 15.5" /><path d="M12 12v9" /><path d="m8.5 15.5 3.5-3.5 3.5 3.5" /></>,
};

export function IconoTrazo({ nombre, className = 'w-4 h-4', grosor = 2 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONOS_TRAZO[nombre]}
    </svg>
  );
}

export function Interruptor({ activo, onClick, etiqueta, icono, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 text-xs font-semibold text-stone-600"
    >
      {icono && <i className={`fa-solid ${icono} text-[10px] text-stone-400`}></i>}
      <span>{etiqueta}</span>
      <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${activo ? 'bg-violet-600' : 'bg-stone-300'}`}>
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${activo ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

// Tarjeta de producto de la grilla principal, memoizada: como el catálogo
// puede tener cientos de tarjetas, sin esto cualquier cambio de estado en
// PosApp (escribir en el buscador, tocar el carrito, un aviso, etc.)
// volvía a renderizar TODAS las tarjetas aunque no tuvieran nada que ver.
// Con React.memo, una tarjeta solo se vuelve a renderizar si cambian sus
// propias props (su producto, o si cambia esAdmin/onSelect/onEdit).
export const ProductoCard = React.memo(function ProductoCard({ prod, esAdmin, enCarrito = 0, onSelect, onEdit, tieneCombo = false, onVerCombo }) {
  const stock = prod.stock_actual;
  const hayStock = stock !== null && stock !== undefined;
  const sinStock = hayStock && Number(stock) <= 0;
  const stockBajo = hayStock && !sinStock && Number(stock) <= Number(prod.stock_min || 5);
  const tono = tonoCategoria(prod.categoria);
  // Franja inferior del panel: un solo lugar para el aviso que importa.
  const aviso = sinStock
    ? { texto: 'Sin stock', clase: 'kc-banda-bad', icono: 'fa-triangle-exclamation' }
    : stockBajo
      ? { texto: `Quedan ${stock}`, clase: 'kc-banda-warn', icono: 'fa-triangle-exclamation' }
      : prod.es_destacado
        ? { texto: 'Destacado en Delivery', clase: '', icono: 'fa-star' }
        : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(prod)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(prod); }}
      className={`kc kc-pos group ${enCarrito > 0 ? 'kc-en' : ''}`}
      style={{ '--t': tono.t, '--td': tono.td }}
    >
      <div className="kc-fw">
        {/* Marco fijo: todas las fotos entran en el mismo cuadro, sin
            recortarse, sea alta como una botella o cuadrada como una bolsa. */}
        <div className="kc-panel">
          {prod.foto_url ? (
            <div className={`kc-foto ${sinStock ? 'kc-foto-sin' : ''}`}>
              <img src={prod.foto_url} alt="" loading="lazy" />
            </div>
          ) : (
            <FotoProducto
              fotoUrl=""
              categoria={prod.categoria}
              className={`w-full h-full ${sinStock ? 'opacity-40 grayscale' : ''}`}
              iconClassName="text-4xl opacity-90"
            />
          )}
          {aviso && (
            <div className={`kc-banda ${aviso.clase}`}>
              <i className={`fa-solid ${aviso.icono}`}></i>
              {aviso.texto}
            </div>
          )}
          {esAdmin && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(prod); }}
              className="kc-edit"
              title="Editar producto"
            >
              <i className="fa-solid fa-pen"></i>
            </button>
          )}
        </div>
        <div className="kc-precio"><small>S/</small>{Number(prod.precio_venta).toFixed(2)}</div>
        <div className="kc-top">
          {enCarrito > 0 && (
            <span className="kc-enc"><i className="fa-solid fa-check"></i> {enCarrito}</span>
          )}
          {tieneCombo && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onVerCombo?.(prod); }}
              className="kc-circ kc-circ-combo"
              title="Este producto es parte de un combo -- toca para verlo"
            >
              <i className="fa-solid fa-gift"></i>
            </button>
          )}
        </div>
      </div>

      <div className="kc-body">
        <h3>{prod.descripcion}</h3>
        <div className="kc-chips">
          <span className="kc-chip">{prod.categoria || 'General'}</span>
          {prod.unidad === 'KG' && <span className="kc-chip">Por KG</span>}
          {Number(prod.unidades_por_pack) > 1 && (
            <span className="kc-chip"><i className="fa-solid fa-boxes-packing"></i> x{prod.unidades_por_pack}</span>
          )}
          {hayStock && (
            <span className={`kc-chip kc-chip-stock ${sinStock ? 'kc-sin' : stockBajo ? 'kc-bajo' : ''}`}>
              <i className="kc-dot"></i>
              {sinStock ? 'Sin stock' : stockBajo ? `Quedan ${stock}` : `${stock} disp.`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
