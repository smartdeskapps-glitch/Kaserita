// Ventanas de la venta: boleta emitida, QR de pago (Yape/Plin) y reimpresión de boleta.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';
import { IconoTrazo, imprimirBoletaTermica, ReciboImprimible, QRPagoModal } from '../pos/componentes.jsx';
import { CONFETI_BOLETA, formatoFechaHoraBoleta, formatoSoles, ICONO_MEDIO_PAGO } from '../pos/utilidades.js';

export default function VentanasVenta({
  bodegaDireccion, bodegaId, bodegaNombre, bodegaTelefono, enviarBoletaWhatsApp,
  imprimirBoletaBluetooth, medioQR, nombreClienteHistorial, reciboReimpresion, setMedioQR,
  setReciboReimpresion, setVentaCompletada, totalConDescuento, ventaCompletada, sbClient, esModoDemo
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
          sbClient={sbClient}
          esModoDemo={esModoDemo}
          medioPago={medioQR}
          monto={totalConDescuento}
          onClose={() => setMedioQR(null)}
        />
      )}

      {/* Modal: Reimpresión de Boleta desde el Historial */}
      {reciboReimpresion && (
        <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[26px] max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-[42px] h-[42px] rounded-xl bg-[#f1efff] text-[#5b4bd6] grid place-items-center shrink-0"><IconoTrazo nombre="print" className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[19px] leading-tight tracking-tight text-[#2d284b]">Reimpresión de <b className="font-bold">boleta</b></h3>
                <p className="text-xs text-[#8f8cb0] tabular-nums mt-0.5">{reciboReimpresion.nro_boleta}</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setReciboReimpresion(null)} className="w-[34px] h-[34px] rounded-full text-[#8f8cb0] hover:bg-[#f3f5ff] hover:text-[#2d284b] grid place-items-center shrink-0 transition">
                <IconoTrazo nombre="x" className="w-4 h-4" />
              </button>
            </div>
            {reciboReimpresion.anulada && (
              <p className="flex items-center gap-2 text-[12.5px] font-bold text-[#c0262d] bg-[#fde0e5] rounded-2xl px-3.5 py-2.5"><IconoTrazo nombre="warn" className="w-4 h-4 shrink-0" /> Esta venta está ANULADA</p>
            )}
            <div className="bg-[#f3f5ff] p-4 rounded-[20px] text-[13px] text-[#2d284b] max-h-60 overflow-y-auto">
              <div className="flex justify-between gap-3"><span className="text-[#8f8cb0]">Pago</span><b className="font-semibold">{reciboReimpresion.medio_pago}</b></div>
              <div className="flex justify-between gap-3 mt-1"><span className="text-[#8f8cb0]">Cliente</span><b className="font-semibold text-right">{nombreClienteHistorial(reciboReimpresion)}</b></div>
              {(reciboReimpresion.ventas_detalle || []).length > 0 ? (
                <div className="border-t border-[#dde4fa] pt-2.5 mt-2.5 space-y-1.5">
                  {reciboReimpresion.ventas_detalle.map((d, i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <span className="min-w-0">{d.productos?.descripcion || 'Producto'} <span className="text-[#8f8cb0]">x{d.cantidad}</span></span>
                      <span className="tabular-nums whitespace-nowrap">S/ {Number(d.subtotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#8f8cb0] border-t border-[#dde4fa] pt-2.5 mt-2.5">Sin detalle de productos disponible.</p>
              )}
              <div className="border-t border-[#dde4fa] pt-2.5 mt-2.5 flex items-baseline justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold tracking-tight tabular-nums"><small className="text-[13px] font-semibold text-[#8f8cb0] mr-1">S/</small>{Number(reciboReimpresion.total_venta).toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setReciboReimpresion(null)} className="h-12 px-5 bg-[#f3f5ff] hover:bg-[#dde4fa] text-[#473bb5] font-bold text-sm rounded-full transition">Cerrar</button>
              <button onClick={imprimirBoletaTermica} className="flex-1 h-12 inline-flex items-center justify-center gap-2 bg-[#5b4bd6] hover:bg-[#473bb5] text-white font-bold text-sm rounded-full shadow-[0_8px_18px_-8px_rgba(91,75,214,0.6)] transition"><IconoTrazo nombre="print" className="w-4 h-4" /> Imprimir</button>
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
