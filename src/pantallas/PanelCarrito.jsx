// Panel derecho: carrito, cliente, medios de pago y cobro (hoja deslizable en celular).
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React from 'react';
import { IconoTrazo, NumericKeypad } from '../pos/componentes.jsx';
import { urlMapa, formatoSoles } from '../pos/utilidades.js';
import { FotoProducto } from '../PanelAdminCompartido.jsx';
import DeslizarParaConfirmar from '../DeslizarParaConfirmar.jsx';

export default function PanelCarrito({
  abrirBuscarClientePOS, abrirPedidosRetirar, aparcarVentaActual, asignarDesdeTeclado,
  avisarPedidosDevueltos, barberoVentaId, borrarVentaEspera, cambiarCantidadCarrito,
  campoTeclado, cargandoPedidosRetirar, cargarPedidoDesdeRetirar, carrito, clienteActual,
  descuentoTipo, descuentoValor, desgloseComboPedido, efectivoRequeridoMixto,
  eliminarPedidoRetirar, enviarPedidoAlRepartidor, esBarberia, filtroFechaHistorial,
  handleCobrar, historialPedidosFiltrado, listaCajeros, marcandoListoId, marcarPedidoEnCamino,
  marcarPedidoListo, marcarRetiradoDirecto, medioPago, modalPedidosRetirar, modalVentasEspera,
  montoDescuento, montoMixtoOtro, montoMixtoRecibido, montoRecibido, mostrarPago,
  mostrarResumenMobile, pedidosCargadosAlCarrito, pedidosListosSinCargar,
  pedidosPorRetirarPendientes, pedidosRetirarPorTab, pedirConfirmacion,
  procesandoPedidoRetirarId, procesandoVenta, recuperarVentaEspera, reiniciarClienteYMedioPago,
  setBarberoVentaId, setCampoTeclado, setCarrito, setDescuentoTipo, setDescuentoValor,
  setFiltroFechaHistorial, setMedioPago, setMedioQR, setModalPedidosRetirar,
  setModalVentasEspera, setMontoMixtoOtro, setMontoMixtoRecibido, setMontoRecibido,
  setMostrarPago, setMostrarResumenMobile, setPedidosCargadosAlCarrito, setTabPedidosRetirar,
  setVerDetalleCobro, tabPedidosRetirar, totalConDescuento, totalVenta, turnoActivo,
  valorTeclado, ventasEnEspera, verDetalleCobro, vuelto, vueltoMixto
}) {
  return (
    <>
      <div className="flex flex-col md:mt-3 md:mb-3 md:mr-3 md:w-[400px] lg:w-[440px] min-h-0">
        {/* Pestaña "Carrito" + pill "En espera" (solo desktop), igual a
            "Order Detail" + "Order Saved" de la referencia: ambas en la
            misma fila, alineadas abajo, la pestaña fundida sin costura
            con el panel y el pill de en-espera siempre visible (con 0
            cuando no hay ninguna) en vez de aparecer/desaparecer. */}
        <div className="hidden md:flex items-end justify-between relative z-10">
          <div className="folder-tab-active px-6 py-3 text-sm font-bold text-stone-900 flex items-center gap-2">
            {modalPedidosRetirar && (
              <button
                onClick={() => setModalPedidosRetirar(false)}
                className="text-stone-500 hover:text-stone-800 -ml-1"
                title="Volver al carrito"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
            )}
            {modalPedidosRetirar ? 'Pedidos por retirar' : 'Carrito'}
          </div>
          <button
            onClick={() => { setModalPedidosRetirar(false); setModalVentasEspera((v) => !v); }}
            className={`mb-2 flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full border text-xs font-semibold transition ${modalVentasEspera ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-200 bg-white/70 hover:bg-white text-amber-700'}`}
          >
            En espera
            <span className={`w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center ${modalVentasEspera ? 'bg-white text-amber-700' : 'bg-amber-500 text-white'}`}>
              {ventasEnEspera.length}
            </span>
          </button>
        </div>
        <section
          className={`${mostrarResumenMobile ? 'flex' : 'hidden'} md:flex flex-col w-full md:flex-1 bg-white border border-stone-200 md:border-none fixed inset-x-0 bottom-0 top-auto md:static md:inset-auto rounded-t-2xl md:rounded-tl-none md:rounded-tr-2xl md:rounded-bl-2xl md:rounded-br-2xl max-h-[88vh] md:max-h-none md:min-h-0 md:-mt-px shadow-2xl md:shadow-none overflow-hidden z-50 md:z-auto`}
        >
        {/* Manija de arrastre (solo mobile) */}
        <div className="md:hidden w-10 h-1.5 bg-stone-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>

        {modalPedidosRetirar ? (
        <>
        {/* Encabezado Pedidos por retirar (solo mobile trae botón de volver) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 md:hidden shrink-0">
          <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
            <i className="fa-solid fa-bell-concierge text-orange-600"></i> Pedidos por retirar
          </h2>
          <button aria-label="Cerrar" onClick={() => setModalPedidosRetirar(false)} className="text-stone-600 hover:text-stone-900 text-lg"><i className="fa-solid fa-xmark"></i></button>
        </div>

        {/* Pestañas: pendiente -> listo -> historial, el mismo recorrido
            de un pedido de principio a fin. */}
        <div className="px-4 pt-3 shrink-0">
          <div className="flex p-1 bg-stone-100 rounded-xl text-[11px] font-medium text-stone-500">
            {[
              { key: 'pendiente', label: 'Pendientes', count: pedidosRetirarPorTab.pendiente.length },
              { key: 'listo', label: 'Listos para entrega', count: pedidosRetirarPorTab.listo.length },
              { key: 'historial', label: 'Historial', count: 0 },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTabPedidosRetirar(tab.key)}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  tabPedidosRetirar === tab.key ? 'bg-white text-stone-900 shadow-sm font-semibold' : 'hover:text-stone-800'
                }`}
              >
                {tab.label}{tab.count > 0 && ` (${tab.count})`}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro de fecha, solo en Historial -- pendientes/listos son
            siempre "lo de ahora", no hace falta filtrarlos por fecha. */}
        {tabPedidosRetirar === 'historial' && (
          <div className="px-4 pt-2 shrink-0 flex gap-1.5 overflow-x-auto hide-scrollbar">
            {[
              { key: 'hoy', label: 'Hoy' },
              { key: '7dias', label: '7 días' },
              { key: '30dias', label: '30 días' },
              { key: 'todos', label: 'Todos' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltroFechaHistorial(f.key)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                  filtroFechaHistorial === f.key
                    ? 'bg-stone-900 border-stone-900 text-white'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 hide-scrollbar">
          {cargandoPedidosRetirar ? (
            <p className="text-center text-stone-400 text-sm py-6">Cargando...</p>
          ) : (tabPedidosRetirar === 'historial' ? historialPedidosFiltrado : pedidosRetirarPorTab[tabPedidosRetirar]).length === 0 ? (
            <p className="text-center text-stone-400 text-sm py-6">
              {tabPedidosRetirar === 'pendiente' && 'No hay pedidos pendientes de armar.'}
              {tabPedidosRetirar === 'listo' && 'No hay pedidos listos esperando que los retiren.'}
              {tabPedidosRetirar === 'historial' && 'No hay pedidos entregados o cancelados en este rango.'}
            </p>
          ) : (
            (tabPedidosRetirar === 'historial' ? historialPedidosFiltrado : pedidosRetirarPorTab[tabPedidosRetirar]).map((p, idx, lista) => {
              const esHoyPedido = (() => {
                const d = new Date(p.creado_en);
                const hoy = new Date();
                return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();
              })();
              const grupoAnterior = idx > 0 ? (() => {
                const d = new Date(lista[idx - 1].creado_en);
                const hoy = new Date();
                return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();
              })() : null;
              const mostrarEncabezadoGrupo = tabPedidosRetirar === 'historial' && (idx === 0 || esHoyPedido !== grupoAnterior);
              const minutos = Math.max(0, Math.floor((Date.now() - new Date(p.creado_en).getTime()) / 60000));
              const tiempoTexto = minutos < 60 ? `hace ${minutos} min` : `hace ${Math.floor(minutos / 60)} h`;
              const colgado = p.estado === 'pendiente' && minutos >= 120; // más de 2 horas: probablemente el cliente ya no viene.
              const procesando = procesandoPedidoRetirarId === p.id;
              const nombreCliente = p.cliente_nombre || p.codigo_corto;
              const esDomicilioPedido = p.tipo_entrega === 'domicilio';
              const envioPedido = esDomicilioPedido ? Number(p.costo_envio || 0) : 0;
              const totalPedido = (p.items || []).reduce(
                (acc, it) => acc + Number(it.cantidad || 0) * Number(it.precio_venta || 0),
                0
              ) + envioPedido;
              const esHistorial = p.estado === 'retirado' || p.estado === 'cancelado';
              const yaEnCarrito = pedidosCargadosAlCarrito.some((c) => c.id === p.id);
              const estadoInfo = {
                pendiente: { texto: 'Pendiente', color: 'text-amber-600', dot: 'bg-amber-500' },
                listo: { texto: 'Listo', color: 'text-emerald-600', dot: 'bg-emerald-500' },
                en_camino: { texto: 'En camino', color: 'text-[#5b4bd6]', dot: 'bg-[#5b4bd6]' },
                retirado: { texto: 'Entregado', color: 'text-stone-400', dot: 'bg-stone-300' },
                cancelado: { texto: 'Cancelado', color: 'text-rose-400', dot: 'bg-rose-300' },
              }[p.estado];
              return (
                <React.Fragment key={p.id}>
                {mostrarEncabezadoGrupo && (
                  <p className={`text-[11px] font-semibold uppercase tracking-wide px-1 ${idx === 0 ? '' : 'pt-2'} ${esHoyPedido ? 'text-stone-600' : 'text-stone-400'}`}>
                    {esHoyPedido ? 'Hoy' : 'Anteriores'}
                  </p>
                )}
                <div
                  className={`bg-white border border-stone-200 rounded-xl p-4 space-y-3 ${esHistorial ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${estadoInfo.dot}`}></span>
                        <p className="text-[13.5px] font-semibold text-stone-900 truncate">{nombreCliente}</p>
                      </div>
                      <p className="text-[11px] text-stone-400 mt-0.5 pl-3">
                        <span className="font-mono">{p.codigo_corto}</span> · {tiempoTexto}
                        {colgado && <span className="text-rose-500"> · sin retirar</span>}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide pt-0.5 ${estadoInfo.color}`}>
                      {estadoInfo.texto}
                    </span>
                  </div>

                  <div className="divide-y divide-stone-100 border-y border-stone-100">
                    {(p.items || []).map((it, i) => {
                      const desglose = desgloseComboPedido(it);
                      return (
                        <div key={i} className="py-1.5 text-xs">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-stone-500 truncate">
                              <span className="text-stone-400">{it.cantidad} ×</span> {it.descripcion}
                            </span>
                            <span className="text-stone-500 tabular-nums shrink-0">
                              {(Number(it.cantidad || 0) * Number(it.precio_venta || 0)).toFixed(2)}
                            </span>
                          </div>
                          {desglose.length > 0 && (
                            <ul className="mt-1 ml-1 pl-2.5 border-l-2 border-stone-100 space-y-0.5">
                              {desglose.map((c, j) => (
                                <li key={j} className="text-[11px] text-stone-400 truncate">
                                  <span className="tabular-nums">{c.cantidad} ×</span> {c.descripcion}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {p.cita_fecha && (
                    <div className="rounded-lg bg-[#ebf0ff] px-3 py-2 text-xs">
                      <p className="font-semibold text-[#2d284b]">
                        Cita: {(() => {
                          const [a, m, d] = String(p.cita_fecha).split('-').map(Number);
                          const t = new Date(a, m - 1, d).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
                          return t.charAt(0).toUpperCase() + t.slice(1);
                        })()} · {p.cita_hora}
                      </p>
                      <p className="text-stone-500">Barbero: {p.cita_barbero || 'Cualquiera'}</p>
                    </div>
                  )}

                  {esDomicilioPedido && (
                    <div className="rounded-lg bg-[#ebf0ff] px-3 py-2 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-semibold text-[#2d284b]">
                          <IconoTrazo nombre="moto" className="w-3.5 h-3.5" /> A domicilio
                        </span>
                        <span className="text-stone-500 tabular-nums">Envío S/ {envioPedido.toFixed(2)}</span>
                      </div>
                      <p className="text-stone-800">{p.entrega_referencia}</p>
                      <p className="text-stone-500">
                        Tel. {p.telefono_contacto}
                        {p.medio_pago && (
                          <>
                            {' · Paga al recibir: '}
                            {{ efectivo: 'efectivo', yape_plin: 'Yape / Plin', tarjeta: 'tarjeta' }[p.medio_pago] || p.medio_pago}
                            {p.medio_pago === 'efectivo' && Number(p.paga_con) > 0 && ` (con S/ ${Number(p.paga_con).toFixed(2)}, vuelto S/ ${Math.max(0, Number(p.paga_con) - totalPedido).toFixed(2)})`}
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-stone-400">{esDomicilioPedido ? 'Total a cobrar (con envío)' : 'Total'}</span>
                    <span className="text-sm font-semibold text-stone-900 tabular-nums">S/ {totalPedido.toFixed(2)}</span>
                  </div>

                  {esDomicilioPedido && !esHistorial && urlMapa(p.entrega_lat, p.entrega_lng) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => enviarPedidoAlRepartidor(p)}
                        className="flex-1 py-2 rounded-lg bg-[#5b4bd6] hover:bg-[#473bb5] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <IconoTrazo nombre="chat" className="w-3.5 h-3.5" /> Enviar al repartidor
                      </button>
                      <a
                        href={urlMapa(p.entrega_lat, p.entrega_lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-lg bg-[#ebf0ff] hover:bg-[#dde4fa] text-[#2d284b] text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <IconoTrazo nombre="ubicacion" className="w-3.5 h-3.5" /> Ver mapa
                      </a>
                    </div>
                  )}
                  {esDomicilioPedido && (p.estado === 'pendiente' || p.estado === 'listo') && (
                    <button
                      onClick={() => marcarPedidoEnCamino(p.id)}
                      disabled={procesando}
                      className="w-full py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold disabled:opacity-50 transition"
                    >
                      Marcar en camino
                    </button>
                  )}

                  {/* "Ya retiró" ya no es un atajo disponible desde el
                      arranque -- confundía con "Marcar listo"/"Al
                      carrito" y cerraba el pedido sin pasar por el
                      carrito. Ahora solo existe (como "Confirmar
                      retiro") una vez que el pedido ya está cargado en
                      el carrito y pendiente de cobro: en ese punto ya
                      no tiene sentido ofrecer "Marcar listo" ni volver a
                      "Cargar al carrito", así que el botón principal
                      cambia de rol. */}
                  {yaEnCarrito ? (
                    <button
                      onClick={() => marcarRetiradoDirecto(p)}
                      disabled={procesando}
                      title="Confirmar que el cliente ya se llevó lo que está en el carrito"
                      className="w-full py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold disabled:opacity-50 transition"
                    >
                      {esDomicilioPedido ? 'Confirmar entrega' : 'Confirmar retiro'}
                    </button>
                  ) : (
                    <>
                      {p.estado === 'pendiente' && (
                        <button
                          onClick={() => marcarPedidoListo(p.id)}
                          disabled={marcandoListoId === p.id || procesando}
                          className="w-full py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold disabled:opacity-50 transition"
                        >
                          {marcandoListoId === p.id ? 'Un momento...' : 'Marcar listo'}
                        </button>
                      )}
                      {(p.estado === 'listo' || p.estado === 'en_camino') && (
                        <button
                          onClick={() => cargarPedidoDesdeRetirar(p)}
                          disabled={procesando}
                          title="Agregar los productos al carrito"
                          className="w-full py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold disabled:opacity-50 transition"
                        >
                          {procesando ? 'Un momento...' : 'Cargar al carrito'}
                        </button>
                      )}
                      {!esHistorial && (
                        <div className="flex items-center gap-3 pt-0.5">
                          {p.estado === 'pendiente' && (
                            <>
                              <button
                                onClick={() => cargarPedidoDesdeRetirar(p)}
                                disabled={procesando}
                                title="Agregar los productos al carrito"
                                className="text-[11px] font-medium text-stone-600 hover:text-stone-900 transition"
                              >
                                Al carrito
                              </button>
                              <span className="text-stone-200">·</span>
                            </>
                          )}
                          <button
                            onClick={() => eliminarPedidoRetirar(p)}
                            disabled={procesando}
                            title="Eliminar de la cola"
                            className="ml-auto text-[11px] font-medium text-stone-400 hover:text-rose-500 transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                </React.Fragment>
              );
            })
          )}
        </div>
        </>
        ) : modalVentasEspera ? (
        <>
        {/* Ventas en espera, dentro del carrito (antes era una ventana emergente) */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-stone-100 shrink-0">
          <span className="text-sm font-extrabold text-stone-900">Ventas en espera</span>
          <button
            onClick={() => setModalVentasEspera(false)}
            className="text-xs font-bold text-amber-700 hover:text-amber-800 transition"
          >
            <i className="fa-solid fa-arrow-left text-[10px]"></i> Volver al carrito
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 hide-scrollbar">
          {ventasEnEspera.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-500 text-center p-4">
              <i className="fa-solid fa-pause text-3xl mb-2 text-stone-300"></i>
              <p className="text-xs font-semibold">No hay ventas en espera</p>
              <p className="text-xs text-stone-500 mt-0.5">Usa "Pausar" en el carrito para dejar una venta aparte.</p>
            </div>
          ) : ventasEnEspera.map((v, i) => {
            const nombres = v.items.map((it) => it.descripcion).filter(Boolean);
            const resumen = nombres.length > 2 ? `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más` : nombres.join(', ');
            const unidades = v.items.reduce((a, it) => a + (Number(it.cantidad) || 0), 0);
            return (
              <div key={v.id} className="rounded-[22px] border border-[#edeff8] bg-gradient-to-br from-[#f5f6fc] to-white p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-stone-400 flex items-center gap-1.5">
                    <i className="w-1.5 h-1.5 rounded-full bg-amber-500"></i> {v.hora}
                  </span>
                  <span className="text-[22px] font-bold text-stone-900 tabular-nums tracking-tight whitespace-nowrap">
                    <small className="text-xs font-semibold text-stone-500 mr-0.5">S/</small>{Number(v.total).toFixed(2)}
                  </span>
                </div>
                <p className="text-[13px] text-stone-500 mt-1.5 mb-3 leading-snug line-clamp-2">
                  <b className="font-semibold text-stone-900">{unidades} {unidades === 1 ? 'ítem' : 'ítems'}</b>{resumen ? ` · ${resumen}` : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => recuperarVentaEspera(i)}
                    className="flex-1 py-2.5 bg-[#5b4bd6] hover:bg-[#473bb5] text-white text-[13px] font-semibold rounded-full transition"
                  >
                    Recuperar
                  </button>
                  <button
                    onClick={() => borrarVentaEspera(i)}
                    title="Descartar"
                    className="w-10 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs transition"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </>
        ) : (
        <>
        {/* Encabezado del carrito: una sola fila de título (con el cierre en
            mobile) y debajo las acciones rápidas. En desktop todo va en una fila. */}
        <div className={`${mostrarPago ? 'hidden md:flex' : 'flex'} flex-wrap md:flex-nowrap items-center justify-between gap-y-2.5 px-4 pt-2 pb-3 md:py-3 bg-white border-b border-stone-100 shrink-0`}>
          <h2 className="text-[19px] md:text-sm font-bold md:font-extrabold tracking-tight text-stone-900">
            <span className="md:hidden">Carrito</span>
            <span className="ml-1.5 md:ml-0 text-[13px] md:text-sm text-stone-400 font-semibold">{carrito.reduce((a, c) => a + c.cantidad, 0)} ítems</span>
          </h2>
          <button
            onClick={() => setMostrarResumenMobile(false)}
            className="md:hidden w-9 h-9 rounded-full bg-[#ebf0ff] hover:bg-[#dde4fa] text-stone-500 flex items-center justify-center transition"
            aria-label="Cerrar"
          >
            <IconoTrazo nombre="x" className="w-[15px] h-[15px]" />
          </button>
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <button
              onClick={() => { setModalPedidosRetirar(false); setModalVentasEspera(true); }}
              className="md:hidden flex items-center gap-1.5 pl-3 pr-2 py-2.5 rounded-full ring-1 ring-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-700 transition"
            >
              En espera
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                {ventasEnEspera.length}
              </span>
            </button>
            {carrito.length > 0 && (
              <button
                onClick={aparcarVentaActual}
                className="px-3.5 py-2.5 md:py-1.5 rounded-full bg-[#ebf0ff] hover:bg-[#dde4fa] text-xs text-[#2d284b] font-semibold transition"
              >
                Pausar
              </button>
            )}
            {carrito.length > 0 && (
              <button
                onClick={async () => {
                  // Con varias líneas se pregunta antes: un toque sin querer borraría toda la venta.
                  if (carrito.length > 1) {
                    const ok = await pedirConfirmacion({ titulo: 'Vaciar el carrito', mensaje: `Se quitarán los ${carrito.length} productos de esta venta.`, textoBoton: 'Sí, vaciar', peligroso: true });
                    if (!ok) return;
                  }
                  avisarPedidosDevueltos(); setCarrito([]); setDescuentoTipo(null); setDescuentoValor(''); setMostrarPago(false); reiniciarClienteYMedioPago(); setPedidosCargadosAlCarrito([]);
                }}
                className="px-3.5 py-2.5 md:py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-xs text-rose-700 font-semibold transition"
              >
                Vaciar
              </button>
            )}
          </div>
        </div>

        {/* Celular, paso de cobro: pantalla propia con el total grande arriba. Los productos
            se resumen y se abren con "Ver detalle de la venta". */}
        {mostrarPago && (
          <div className="md:hidden shrink-0 px-3.5 pt-2 pb-1 space-y-2.5 bg-white">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setMostrarPago(false); reiniciarClienteYMedioPago(); }}
                className="flex items-center gap-1 pl-2 pr-3 py-2 rounded-full bg-[#ebf0ff] hover:bg-[#dde4fa] text-[13px] font-semibold text-[#2d284b] transition"
              >
                <IconoTrazo nombre="back" className="w-[15px] h-[15px]" /> Volver
              </button>
              <h2 className="text-[15px] font-bold text-stone-900">Cobro</h2>
              <span className="px-2.5 py-1.5 rounded-full bg-[#ebf0ff] text-[11.5px] font-semibold text-[#2d284b]">
                {carrito.reduce((a, c) => a + c.cantidad, 0)} ítems
              </span>
            </div>
            <div className="relative overflow-hidden rounded-[22px] px-4 pt-3.5 pb-3 text-white bg-gradient-to-br from-[#7466e8] to-[#2d284b]">
              <span className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10"></span>
              <p className="relative text-[11.5px] font-semibold opacity-90">Total a cobrar</p>
              <p className="relative text-[36px] leading-[1.1] font-extrabold tracking-tight tabular-nums">
                <small className="text-[17px] font-semibold opacity-80 mr-1.5">S/</small>{formatoSoles(totalConDescuento)}
              </p>
              {montoDescuento > 0 && (
                <p className="relative text-[11.5px] opacity-90 mt-0.5 tabular-nums">
                  Subtotal S/ {totalVenta.toFixed(2)} · Descuento - S/ {montoDescuento.toFixed(2)}
                </p>
              )}
              <button
                type="button"
                aria-expanded={verDetalleCobro}
                onClick={() => setVerDetalleCobro((v) => !v)}
                className="relative mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-xs font-semibold transition"
              >
                {verDetalleCobro ? 'Ocultar detalle' : 'Ver detalle de la venta'}
                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${verDetalleCobro ? 'rotate-180' : ''}`}></i>
              </button>
            </div>
          </div>
        )}

        {/* Recordatorio fijo de pedidos por retirar -- vive pegado arriba
            de la lista de ítems, no solo como badge en un botón, para que
            no se pierda de vista mientras el cajero sigue atendiendo el
            carrito normal. */}
        {pedidosPorRetirarPendientes === 0 && pedidosListosSinCargar > 0 && (
          <button
            onClick={abrirPedidosRetirar}
            className={`shrink-0 mx-3 mt-2.5 ${mostrarPago ? 'hidden md:flex' : 'flex'} items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition text-left`}
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white shrink-0">
              <i className="fa-solid fa-bell-concierge text-xs"></i>
            </span>
            <span className="flex-1 text-xs font-bold text-emerald-800">
              {pedidosListosSinCargar === 1
                ? '1 pedido listo, falta entregarlo y cobrarlo'
                : `${pedidosListosSinCargar} pedidos listos, falta entregarlos y cobrarlos`}
            </span>
            <i className="fa-solid fa-chevron-right text-xs text-emerald-600"></i>
          </button>
        )}
        {pedidosPorRetirarPendientes > 0 && (
          <button
            onClick={abrirPedidosRetirar}
            className={`shrink-0 mx-3 mt-2.5 ${mostrarPago ? 'hidden md:flex' : 'flex'} items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition text-left`}
          >
            <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white shrink-0">
              <i className="fa-solid fa-bell-concierge text-xs"></i>
              <span className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-60"></span>
            </span>
            <span className="flex-1 text-xs font-bold text-amber-800">
              {pedidosPorRetirarPendientes === 1
                ? '1 pedido esperando que lo armes'
                : `${pedidosPorRetirarPendientes} pedidos esperando que los armes`}
            </span>
            <i className="fa-solid fa-chevron-right text-xs text-amber-600"></i>
          </button>
        )}

        {/* Solo barbería: quién atendió. Se elige antes de cobrar y se limpia
            después de cada venta. */}
        {esBarberia && (
          <div className="shrink-0 mx-3 mt-2.5">
            <p className="text-[11px] font-semibold text-stone-500 mb-1">Barbero que atendió</p>
            <div className="flex flex-wrap gap-1.5">
              {listaCajeros.filter((c) => c.activo !== false).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setBarberoVentaId(barberoVentaId === c.id ? null : c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${barberoVentaId === c.id ? 'bg-[#5b4bd6] text-white' : 'bg-[#ebf0ff] text-[#2d284b] hover:bg-[#dde4fa]'}`}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lista Ítems */}
        {/* Celular al cobrar: la lista se achica (unas 2 filas) para dejar espacio a los medios de pago */}
        <div className={`overflow-y-auto p-2.5 space-y-1.5 hide-scrollbar ${mostrarPago ? `${verDetalleCobro ? 'max-h-[24vh] pb-2.5' : 'hidden'} md:block md:max-h-none md:flex-1 md:pb-16` : 'flex-1 pb-16'}`}>
          {carrito.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-500 text-center p-4">
              <i className="fa-solid fa-basket-shopping text-3xl mb-2 text-stone-300"></i>
              <p className="text-xs font-semibold">Carrito vacío</p>
              <p className="text-xs text-stone-500 mt-0.5">
                Toca un producto o escanea su código de barras.
              </p>
            </div>
          ) : (
            carrito.map((item) => (
              <div
                key={item.claveCarrito || item.productoId}
                className="flex items-center gap-2.5 p-2 bg-[#f7f9ff] rounded-[20px]"
              >
                <FotoProducto
                  fotoUrl={item.foto_url}
                  categoria={item.categoria}
                  className="w-11 h-11 rounded-[14px] shrink-0 ring-1 ring-black/5 bg-white"
                  iconClassName="text-sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-stone-900 truncate">
                    {item.descripcion}
                  </p>
                  <p className="text-[11.5px] text-stone-400 tabular-nums">
                    S/ {item.precioUnitario.toFixed(2)} / {item.unidad || 'UND'}
                  </p>
                </div>

                <div className="flex items-center bg-white rounded-full ring-1 ring-[#5b4bd6]/10 shrink-0">
                  <button
                    onClick={() => cambiarCantidadCarrito(item.claveCarrito || item.productoId, -1)}
                    className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-[#5b4bd6] hover:bg-[#ebf0ff] rounded-full transition"
                    aria-label="Quitar uno"
                  >
                    <IconoTrazo nombre="minus" className="w-3.5 h-3.5" />
                  </button>
                  <span className="min-w-[18px] text-center text-[13px] font-bold text-stone-900 tabular-nums">
                    {item.cantidad}
                  </span>
                  <button
                    onClick={() => cambiarCantidadCarrito(item.claveCarrito || item.productoId, 1)}
                    className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-[#5b4bd6] hover:bg-[#ebf0ff] rounded-full transition"
                    aria-label="Agregar uno"
                  >
                    <IconoTrazo nombre="plus" className="w-3.5 h-3.5" />
                  </button>
                </div>

                <span className="w-[58px] text-right text-[13px] font-bold text-stone-900 tabular-nums shrink-0">
                  S/ {item.subtotal.toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Panel Cobro */}
        {/* El panel es vidrio esmerilado y se monta 40px sobre el final de la lista:
            los items pasan por debajo, borrosos, y el borde superior se desvanece. */}
        <div
          className={`relative z-10 p-4 space-y-3 min-h-0 overflow-y-auto overscroll-contain ${mostrarPago
            ? 'pt-4 scroll-pb-44 bg-white border-t border-[#dde4fa] shadow-[0_-14px_26px_-20px_rgba(40,20,100,0.4)]'
            : '-mt-10 pt-14 backdrop-blur-xl bg-gradient-to-b from-white/60 to-white/90'}`}
          style={mostrarPago ? undefined : { WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 44px)', maskImage: 'linear-gradient(to bottom, transparent 0, black 44px)' }}
        >
          {!mostrarPago ? (
            <>
              <div className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] px-4 py-3 space-y-1.5">
                <div className="flex items-baseline justify-between text-[12.5px] text-stone-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums">S/ {formatoSoles(totalVenta)}</span>
                </div>
                {montoDescuento > 0 && (
                  <div className="flex items-center justify-between text-xs text-rose-600 font-semibold">
                    <span>Descuento</span>
                    <span className="tabular-nums">- S/ {montoDescuento.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-[#5b4bd6]/10">
                  <span className="text-xs font-semibold text-[#2d284b]">
                    Total
                  </span>
                  <span className="text-[28px] font-bold tracking-tight text-stone-900 tabular-nums">
                    <small className="text-sm font-semibold text-stone-500 mr-1">S/</small>{formatoSoles(totalConDescuento)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMostrarPago(true)}
                disabled={carrito.length === 0 || !turnoActivo}
                className={`w-full py-3.5 rounded-full font-semibold text-[15px] transition-all flex items-center justify-center gap-2 ${
                  !turnoActivo || carrito.length === 0
                    ? 'bg-[#e6e9f5] text-[#8b869a] cursor-not-allowed'
                    : 'kz-pri'
                }`}
              >
                {!turnoActivo ? (
                  <><IconoTrazo nombre="warn" className="w-[18px] h-[18px]" /> Abre un turno para cobrar</>
                ) : (
                  <><IconoTrazo nombre="till" className="w-[18px] h-[18px]" /> Cobrar</>
                )}
              </button>
            </>
          ) : (
          <>
          <button
            type="button"
            onClick={() => { setMostrarPago(false); reiniciarClienteYMedioPago(); }}
            className="self-start hidden md:flex items-center gap-1 pl-2 pr-3 py-1.5 rounded-full bg-[#ebf0ff] hover:bg-[#dde4fa] text-[13px] font-semibold text-[#2d284b] transition"
          >
            <IconoTrazo nombre="back" className="w-[15px] h-[15px]" /> Volver
          </button>

          <div className="grid grid-cols-3 gap-1.5 md:gap-2 p-1 rounded-[18px] bg-[#ebf0ff] md:p-0 md:rounded-none md:bg-transparent">
            {[
              { id: 'EFECTIVO', icono: 'efectivo', texto: 'Efectivo' },
              { id: 'YAPE', icono: 'movil', texto: 'Yape' },
              { id: 'PLIN', icono: 'movil', texto: 'Plin' },
              { id: 'TARJETA', icono: 'tarjeta', texto: 'Tarjeta' },
              { id: 'CREDITO', icono: 'credito', texto: 'Crédito' },
              { id: 'MIXTO', icono: 'mixto', texto: 'Mixto' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMedioPago(m.id);
                  setCampoTeclado(null);
                  if (m.id === 'CREDITO' && (!clienteActual || clienteActual.dni === '99999999')) {
                    abrirBuscarClientePOS();
                  }
                }}
                className={`flex flex-row md:flex-col items-center justify-center gap-1.5 h-11 md:h-auto md:pt-3 md:pb-2.5 text-[12.5px] font-semibold rounded-[14px] md:rounded-[20px] transition ${
                  medioPago === m.id
                    ? 'bg-[#5b4bd6] text-white'
                    : 'bg-transparent md:bg-[#ebf0ff] hover:bg-[#dde4fa] text-stone-600'
                }`}
              >
                <IconoTrazo nombre={m.icono} className={`w-[18px] h-[18px] md:w-5 md:h-5 ${medioPago === m.id ? 'text-white' : 'text-[#5b4bd6]'}`} />
                {m.texto}
              </button>
            ))}
          </div>

          {medioPago === 'EFECTIVO' && (
            <div data-campo-pago className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] p-3.5">
              <label className="text-xs font-semibold text-[#2d284b] block mb-2">Paga con</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-14 flex items-center gap-1.5 px-4 rounded-[18px] bg-white ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                  <span className="text-[15px] font-semibold text-stone-400">S/</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    placeholder="0.00"
                    className="w-full min-w-0 bg-transparent text-[28px] font-bold tracking-tight text-stone-900 tabular-nums placeholder:text-[#c1c6da] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCampoTeclado(campoTeclado === 'recibido' ? null : 'recibido')}
                  title="Teclado numérico"
                  className={`shrink-0 w-14 h-14 flex items-center justify-center rounded-[18px] ring-1 ring-[#5b4bd6]/10 transition ${campoTeclado === 'recibido' ? 'bg-[#5b4bd6] text-white' : 'bg-white text-[#5b4bd6] hover:bg-[#f7f9ff]'}`}
                >
                  <IconoTrazo nombre="calc" className="w-[22px] h-[22px]" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[
                  { t: 'Exacto', v: totalConDescuento },
                  ...[50, 100, 200].filter((n) => n >= totalConDescuento).map((n) => ({ t: `S/ ${n}`, v: n }))
                ].map((c) => (
                  <button
                    key={c.t}
                    type="button"
                    onClick={() => setMontoRecibido(String(+Number(c.v).toFixed(2)))}
                    className="px-3.5 py-1.5 rounded-full bg-white ring-1 ring-[#5b4bd6]/10 hover:bg-[#f7f9ff] text-[12.5px] font-semibold text-[#2d284b] transition"
                  >
                    {c.t}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#5b4bd6]/10">
                <span className="text-xs font-semibold text-[#2d284b]">Vuelto</span>
                <span className={`text-[26px] font-bold tracking-tight tabular-nums ${vuelto < 0 ? 'text-rose-600' : 'text-green-700'}`}>
                  S/ {vuelto > 0 ? vuelto.toFixed(2) : '0.00'}
                </span>
              </div>
              {campoTeclado === 'recibido' && <NumericKeypad value={montoRecibido} onChange={asignarDesdeTeclado} />}
            </div>
          )}

          {(medioPago === 'YAPE' || medioPago === 'PLIN') && (
            <button
              type="button"
              onClick={() => setMedioQR(medioPago)}
              className="w-full h-[50px] flex items-center justify-center gap-2 rounded-full bg-white ring-1 ring-[#5b4bd6]/15 hover:bg-[#f7f9ff] text-sm font-semibold text-[#2d284b] transition"
            >
              <IconoTrazo nombre="qr" className="w-[18px] h-[18px]" /> Mostrar QR de {medioPago === 'YAPE' ? 'Yape' : 'Plin'}
            </button>
          )}

          {medioPago === 'TARJETA' && (
            <div className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] p-3.5 text-center text-[13px] font-semibold text-[#2d284b]">
              Cobro exacto con tarjeta: S/ {totalConDescuento.toFixed(2)}
            </div>
          )}

          {medioPago === 'CREDITO' && (
            <div className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] p-3.5">
              <div className="flex items-center gap-2.5 bg-white rounded-[18px] ring-1 ring-[#5b4bd6]/10 px-3 py-2.5">
                <span className="w-[34px] h-[34px] rounded-full bg-[#dde4fa] text-[#2d284b] text-xs font-bold flex items-center justify-center shrink-0">
                  {(!clienteActual || clienteActual.dni === '99999999')
                    ? '?'
                    : (clienteActual.nombre_completo || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </span>
                <div className="flex-1 min-w-0 text-[13.5px] font-semibold text-stone-900">
                  <p className="truncate">
                    {(!clienteActual || clienteActual.dni === '99999999') ? 'Sin cliente asignado' : clienteActual.nombre_completo}
                  </p>
                  <p className={`text-xs font-medium truncate ${(!clienteActual || clienteActual.dni === '99999999') ? 'text-rose-600' : 'text-stone-500'}`}>
                    {(!clienteActual || clienteActual.dni === '99999999')
                      ? 'Asigna un cliente registrado para vender a crédito.'
                      : `Disponible S/ ${Math.max(0, (Number(clienteActual.limite_credito) || 0) - (Number(clienteActual.saldo_actual) || 0)).toFixed(2)} de S/ ${(Number(clienteActual.limite_credito) || 0).toFixed(2)}`}
                  </p>
                </div>
                <button type="button" onClick={abrirBuscarClientePOS} className="shrink-0 px-3 py-1.5 rounded-full bg-[#ebf0ff] hover:bg-[#dde4fa] text-[12.5px] font-semibold text-[#5b4bd6] transition">
                  Cambiar
                </button>
              </div>
              {clienteActual && clienteActual.dni !== '99999999' && Number(clienteActual.limite_credito) > 0 && (
                <div className="h-2 rounded-full bg-[#dce0f3] mt-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#5b4bd6]"
                    style={{ width: `${Math.min(100, Math.max(0, ((Number(clienteActual.saldo_actual) || 0) / Number(clienteActual.limite_credito)) * 100))}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}

          {medioPago === 'MIXTO' && (
            <div data-campo-pago className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] p-3.5">
              <label className="text-xs font-semibold text-[#2d284b] block mb-2">Monto en tarjeta / otro</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-[50px] flex items-center gap-1.5 px-4 rounded-[18px] bg-white ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                  <span className="text-sm font-semibold text-stone-400">S/</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={montoMixtoOtro}
                    onChange={(e) => setMontoMixtoOtro(e.target.value)}
                    placeholder="0.00"
                    className="w-full min-w-0 bg-transparent text-[22px] font-bold tracking-tight text-stone-900 tabular-nums placeholder:text-[#c1c6da] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCampoTeclado(campoTeclado === 'mixtoOtro' ? null : 'mixtoOtro')}
                  title="Teclado numérico"
                  className={`shrink-0 w-[50px] h-[50px] flex items-center justify-center rounded-[18px] ring-1 ring-[#5b4bd6]/10 transition ${campoTeclado === 'mixtoOtro' ? 'bg-[#5b4bd6] text-white' : 'bg-white text-[#5b4bd6] hover:bg-[#f7f9ff]'}`}
                >
                  <IconoTrazo nombre="calc" className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#5b4bd6]/10">
                <span className="text-xs font-semibold text-[#2d284b]">Falta en efectivo</span>
                <span className="text-[22px] font-bold tracking-tight tabular-nums text-stone-900">S/ {efectivoRequeridoMixto.toFixed(2)}</span>
              </div>

              {efectivoRequeridoMixto > 0 && (
                <>
                  <label className="text-xs font-semibold text-[#2d284b] block mt-3 mb-2">Recibe en efectivo</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[50px] flex items-center gap-1.5 px-4 rounded-[18px] bg-white ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                      <span className="text-sm font-semibold text-stone-400">S/</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={montoMixtoRecibido}
                        onChange={(e) => setMontoMixtoRecibido(e.target.value)}
                        placeholder="0.00"
                        className="w-full min-w-0 bg-transparent text-[22px] font-bold tracking-tight text-stone-900 tabular-nums placeholder:text-[#c1c6da] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCampoTeclado(campoTeclado === 'mixtoRecibido' ? null : 'mixtoRecibido')}
                      title="Teclado numérico"
                      className={`shrink-0 w-[50px] h-[50px] flex items-center justify-center rounded-[18px] ring-1 ring-[#5b4bd6]/10 transition ${campoTeclado === 'mixtoRecibido' ? 'bg-[#5b4bd6] text-white' : 'bg-white text-[#5b4bd6] hover:bg-[#f7f9ff]'}`}
                    >
                      <IconoTrazo nombre="calc" className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#5b4bd6]/10">
                <span className="text-xs font-semibold text-[#2d284b]">Vuelto</span>
                <span className={`text-[22px] font-bold tracking-tight tabular-nums ${vueltoMixto < 0 ? 'text-rose-600' : 'text-green-700'}`}>
                  S/ {vueltoMixto > 0 ? vueltoMixto.toFixed(2) : '0.00'}
                </span>
              </div>

              {(campoTeclado === 'mixtoOtro' || campoTeclado === 'mixtoRecibido') && (
                <NumericKeypad value={valorTeclado} onChange={asignarDesdeTeclado} />
              )}
            </div>
          )}

          <div>
            {!descuentoTipo ? (
              carrito.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setDescuentoTipo('PORCENTAJE'); setDescuentoValor(''); }}
                  className="flex items-center gap-1.5 text-[13px] text-[#5b4bd6] hover:text-[#2d284b] font-semibold transition"
                >
                  <IconoTrazo nombre="etiqueta" className="w-[15px] h-[15px]" /> Aplicar descuento
                </button>
              )
            ) : (
              <div className="bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#2d284b]">Descuento</span>
                  <button
                    type="button"
                    onClick={() => { setDescuentoTipo(null); setDescuentoValor(''); }}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Quitar
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-white rounded-full ring-1 ring-[#5b4bd6]/10 p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDescuentoTipo('PORCENTAJE')}
                      className={`w-10 h-9 rounded-full text-xs font-bold transition ${descuentoTipo === 'PORCENTAJE' ? 'bg-[#5b4bd6] text-white' : 'text-stone-500'}`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescuentoTipo('MONTO')}
                      className={`w-10 h-9 rounded-full text-xs font-bold transition ${descuentoTipo === 'MONTO' ? 'bg-[#5b4bd6] text-white' : 'text-stone-500'}`}
                    >
                      S/
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={descuentoValor}
                    onChange={(e) => setDescuentoValor(e.target.value)}
                    placeholder={descuentoTipo === 'PORCENTAJE' ? '0-100' : '0.00'}
                    className="w-full h-[44px] bg-white ring-1 ring-[#5b4bd6]/10 rounded-[16px] px-4 text-base font-bold text-stone-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5b4bd6]/40"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Total y botón de cobro siempre a la vista: si las opciones de pago no
              caben en pantallas bajas, lo de arriba hace scroll y esto se queda abajo. */}
          <div className="sticky bottom-0 -mx-4 -mb-4 px-4 pb-4 pt-3 space-y-3 bg-white shadow-[0_-12px_18px_-14px_rgba(40,20,100,0.28)]">
          <div className="hidden md:block bg-[#ebf0ff] border border-[#dde4fa] rounded-[22px] px-4 py-3 space-y-1.5">
            {montoDescuento > 0 && (
              <>
                <div className="flex items-center justify-between text-[12.5px] text-stone-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums">S/ {totalVenta.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[12.5px] text-rose-600 font-semibold">
                  <span>Descuento</span>
                  <span className="tabular-nums">- S/ {montoDescuento.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className={`flex items-baseline justify-between ${montoDescuento > 0 ? 'pt-2 border-t border-[#5b4bd6]/10' : ''}`}>
              <span className="text-xs font-semibold text-[#2d284b]">Total a cobrar</span>
              <span className="text-[28px] font-bold tracking-tight text-stone-900 tabular-nums">
                <small className="text-sm text-stone-500 font-semibold mr-1">S/</small>{formatoSoles(totalConDescuento)}
              </span>
            </div>
          </div>

          <div className="md:hidden">
            <DeslizarParaConfirmar
              onConfirm={handleCobrar}
              ocupado={procesandoVenta}
              disabled={carrito.length === 0 || !turnoActivo || (medioPago === 'EFECTIVO' && vuelto < 0)}
              texto={medioPago === 'CREDITO' ? 'Desliza para fiar' : 'Desliza para cobrar'}
              textoBloqueado={!turnoActivo ? 'Abre un turno para cobrar' : (medioPago === 'EFECTIVO' && vuelto < 0) ? `Falta S/ ${Math.abs(vuelto).toFixed(2)}` : ''}
            />
          </div>
          <button
            onClick={handleCobrar}
            disabled={procesandoVenta || carrito.length === 0 || !turnoActivo}
            className={`w-full h-[54px] rounded-full font-semibold text-base transition-all hidden md:flex items-center justify-center gap-2 ${
              !turnoActivo || procesandoVenta || carrito.length === 0
                ? 'bg-[#e6e9f5] text-[#8b869a] cursor-not-allowed'
                : 'kz-pri'
            }`}
          >
            {!turnoActivo ? (
              <><IconoTrazo nombre="warn" className="w-[18px] h-[18px]" /> Abre un turno para cobrar</>
            ) : procesandoVenta ? (
              <><i className="fa-solid fa-spinner fa-spin"></i> Registrando venta...</>
            ) : medioPago === 'CREDITO' ? (
              <><IconoTrazo nombre="credito" className="w-[19px] h-[19px]" /> Registrar venta a crédito</>
            ) : (
              <><IconoTrazo nombre="recibo" className="w-[19px] h-[19px]" /> Cobrar e imprimir boleta</>
            )}
          </button>
          </div>
          </>
          )}
        </div>
        </>
        )}
      </section>
      </div>
    </>
  );
}
