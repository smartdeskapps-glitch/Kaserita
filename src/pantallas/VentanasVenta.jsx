// Ventanas de la venta: boleta emitida, QR de pago (Yape/Plin) y reimpresión de boleta.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';
import { IconoTrazo, imprimirBoletaTermica, ReciboImprimible, QRPagoModal } from '../pos/componentes.jsx';
import { CONFETI_BOLETA, formatoFechaHoraBoleta, formatoSoles, ICONO_MEDIO_PAGO } from '../pos/utilidades.js';

export default function VentanasVenta({
  bodegaDireccion, bodegaId, bodegaNombre, bodegaTelefono, enviarBoletaWhatsApp,
  imprimirBoletaBluetooth, medioQR, nombreClienteHistorial, reciboReimpresion, setMedioQR,
  setReciboReimpresion, setVentaCompletada, totalConDescuento, ventaCompletada
}) {
  return (
    <>
      {/* Modal: Boleta Emitida -- ticket con muescas y borde en festón */}
      {ventaCompletada && (
        <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bol-ticket">
              <div className="bol-a">
                <div className="bol-ok">
                  <span className="bol-ok-c"><IconoTrazo nombre="check" className="w-7 h-7" grosor={2.6} /></span>
                  {CONFETI_BOLETA.map(([color, x, y, t], i) => (
                    <i key={i} style={{ background: color, width: t, height: t, left: `calc(50% - ${t / 2}px)`, top: `calc(50% - ${t / 2}px)`, '--x': `${x}px`, '--y': `${y}px`, animationDelay: `${0.45 + i * 0.04}s` }}></i>
                  ))}
                </div>
                <h3>¡Venta exitosa!</h3>
                <p className="bol-sub">Tu boleta se emitió correctamente</p>
                {ventaCompletada.offline && (
                  <div className="bol-off">
                    <IconoTrazo nombre="cloud" className="w-4 h-4 shrink-0 mt-px" />
                    <span>Guardada sin conexión. Se sincronizará sola cuando vuelva el internet.</span>
                  </div>
                )}
              </div>
              <div className="bol-b">
                <div className="bol-g">
                  <div>
                    <small>Boleta</small>
                    <b>{ventaCompletada.nro_boleta}</b>
                    <span className="bol-fh">{formatoFechaHoraBoleta(ventaCompletada.fecha_hora)}</span>
                  </div>
                  <div className="bol-der">
                    <small>Monto</small>
                    <b className="bol-monto"><s>S/</s>{formatoSoles(ventaCompletada.total_venta)}</b>
                  </div>
                  {ventaCompletada.descuento > 0 && (
                    <div className="bol-desc">
                      <span>Subtotal <b>S/ {formatoSoles(ventaCompletada.subtotal)}</b></span>
                      <span className="bol-neg">Descuento − S/ {formatoSoles(ventaCompletada.descuento)}</span>
                    </div>
                  )}
                </div>
                <div className="bol-cli">
                  <span className="bol-mp"><IconoTrazo nombre={ICONO_MEDIO_PAGO[String(ventaCompletada.medio_pago || '').toUpperCase()] || 'efectivo'} className="w-5 h-5" /></span>
                  <div className="min-w-0">
                    <b>{ventaCompletada.cliente && ventaCompletada.cliente !== 'Desconocido' ? ventaCompletada.cliente : 'Cliente sin registrar'}</b>
                    <span>{String(ventaCompletada.medio_pago || '').charAt(0) + String(ventaCompletada.medio_pago || '').slice(1).toLowerCase()}</span>
                  </div>
                </div>
                {ventaCompletada.recibido > 0 && (
                  <div className="bol-vuelto">
                    <span>Recibido <b>S/ {formatoSoles(ventaCompletada.recibido)}</b></span>
                    <span className="bol-vv">Vuelto <b>S/ {formatoSoles(Math.max(0, ventaCompletada.recibido - ventaCompletada.total_venta))}</b></span>
                  </div>
                )}
                <button onClick={() => setVentaCompletada(null)} className="bol-nv">
                  Nueva venta
                </button>
                <div className="bol-sec">
                  <button onClick={imprimirBoletaTermica}>
                    <IconoTrazo nombre="print" className="w-[15px] h-[15px]" /> Imprimir
                  </button>
                  <button onClick={() => enviarBoletaWhatsApp(ventaCompletada)}>
                    <IconoTrazo nombre="chat" className="w-[15px] h-[15px]" /> WhatsApp
                  </button>
                  {typeof navigator !== 'undefined' && navigator.bluetooth && (
                    <button onClick={() => imprimirBoletaBluetooth(ventaCompletada)}>
                      <IconoTrazo nombre="bluetooth" className="w-[15px] h-[15px]" /> Ticketera
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <ReciboImprimible
            bodega={bodegaNombre}
            direccion={bodegaDireccion}
            telefono={bodegaTelefono}
            cajero={ventaCompletada.cajero}
            recibido={ventaCompletada.recibido}
            boleta={ventaCompletada.nro_boleta}
            fecha={formatoFechaHoraBoleta(ventaCompletada.fecha_hora)}
            cliente={ventaCompletada.cliente}
            medioPago={ventaCompletada.medio_pago}
            items={ventaCompletada.items || []}
            total={ventaCompletada.total_venta}
            subtotal={ventaCompletada.subtotal}
            descuento={ventaCompletada.descuento}
          />
        </div>
      )}

      {/* Modal: QR de Pago (Yape/Plin) */}
      {medioQR && (
        <QRPagoModal
          bodegaId={bodegaId}
          medioPago={medioQR}
          monto={totalConDescuento}
          onClose={() => setMedioQR(null)}
        />
      )}

      {/* Modal: Reimpresión de Boleta desde el Historial */}
      {reciboReimpresion && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-stone-100 border border-stone-200 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 bg-stone-200 text-stone-800 rounded-full flex items-center justify-center mx-auto text-xl"><i className="fa-solid fa-print"></i></div>
            <h3 className="text-lg font-black text-stone-900">Reimpresión de Boleta</h3>
            <p className="text-xs text-stone-700 font-mono">Boleta: <span className="text-orange-600 font-bold">{reciboReimpresion.nro_boleta}</span></p>
            {reciboReimpresion.anulada && (
              <p className="text-xs font-bold text-rose-600"><i className="fa-solid fa-triangle-exclamation mr-1"></i> Esta venta está ANULADA</p>
            )}
            <div className="bg-stone-50 p-3 rounded-lg text-left text-xs font-mono space-y-1 text-stone-700 border border-stone-100 max-h-56 overflow-y-auto">
              <p><strong>Pago:</strong> {reciboReimpresion.medio_pago}</p>
              <p><strong>Cliente:</strong> {nombreClienteHistorial(reciboReimpresion)}</p>
              {(reciboReimpresion.ventas_detalle || []).length > 0 ? (
                <div className="border-t border-stone-200 pt-1 mt-1 space-y-0.5">
                  {reciboReimpresion.ventas_detalle.map((d, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{d.productos?.descripcion || 'Producto'} x{d.cantidad}</span>
                      <span>S/ {Number(d.subtotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-stone-500 border-t border-stone-200 pt-1 mt-1">Sin detalle de productos disponible.</p>
              )}
              <div className="border-t border-stone-200 pt-1 mt-1 flex justify-between font-bold text-sm text-orange-600">
                <span>TOTAL:</span><span>S/ {Number(reciboReimpresion.total_venta).toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={imprimirBoletaTermica} className="flex-1 py-2 bg-stone-200 text-stone-900 font-bold text-xs rounded-xl"><i className="fa-solid fa-print mr-1"></i> Imprimir</button>
              <button onClick={() => setReciboReimpresion(null)} className="flex-1 py-2 bg-stone-900 text-white font-bold text-xs rounded-xl shadow">Cerrar</button>
            </div>
          </div>
          <ReciboImprimible
            bodega={bodegaNombre}
            direccion={bodegaDireccion}
            telefono={bodegaTelefono}
            boleta={reciboReimpresion.nro_boleta}
            fecha={formatoFechaHoraBoleta(reciboReimpresion.fecha_hora)}
            cliente={nombreClienteHistorial(reciboReimpresion)}
            medioPago={reciboReimpresion.medio_pago}
            items={(reciboReimpresion.ventas_detalle || []).map(d => ({
              descripcion: d.productos?.descripcion || d.descripcion || 'Producto',
              cantidad: d.cantidad,
              precioUnitario: d.precio_unitario,
              unidad: d.productos?.unidad || 'UND',
              subtotal: d.subtotal
            }))}
            total={reciboReimpresion.total_venta}
            subtotal={Number(reciboReimpresion.total_venta) + Number(reciboReimpresion.descuento_monto || 0)}
            descuento={reciboReimpresion.descuento_monto || 0}
            anulada={reciboReimpresion.anulada}
          />
        </div>
      )}
    </>
  );
}
