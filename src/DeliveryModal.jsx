import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function DeliveryModal({
  DIAS_DELIVERY,
  IconoTrazo,
  KASERITA_DELIVERY_URL,
  avisarAMisClientes,
  costoEnvioDelivery,
  deliveryHabilitado,
  direccionDelivery,
  domicilioHabilitado,
  enviandoAviso,
  esAdmin,
  estadoHorarioActualDelivery,
  guardandoDelivery,
  guardarConfigDelivery,
  hayCambiosDelivery,
  horarioDelivery,
  linkDeliveryCopiado,
  logoUrlDelivery,
  modalDelivery,
  notificar,
  pedidoMinimoDelivery,
  resumenAvisos,
  resumenEntregaDelivery,
  resumenHorarioDelivery,
  seccionDelivery,
  sesion,
  setCostoEnvioDelivery,
  setDeliveryHabilitado,
  setDireccionDelivery,
  setDomicilioHabilitado,
  setHorarioDelivery,
  setLinkDeliveryCopiado,
  setModalDelivery,
  setMostrarQRDelivery,
  setPedidoMinimoDelivery,
  setTelefonoDeliveryEditar,
  setWhatsappRepartidor,
  setZonaRepartoDelivery,
  slugDelivery,
  subiendoLogoDelivery,
  subirLogoDelivery,
  telefonoDeliveryEditar,
  whatsappRepartidor,
  zonaRepartoDelivery,
}) {
  return (
    <>
              {/* Modal: Mi Link de Pedidos (vitrina pública de KaseritaDelivery).
                  Panel superior oscuro (Ebony) con lo principal del link y, debajo, una hoja
                  blanca con los ajustes de la tienda. */}
              {modalDelivery && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-[#f6f8ff] border border-white/80 rounded-[34px] max-w-md w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
                    {!sesion?.bodega?.delivery_permitido ? (
                      <>
                        <div className="flex items-start gap-2.5 px-4 pt-4 pb-2.5 shrink-0">
                          <span className="w-[38px] h-[38px] rounded-[14px] bg-[#dde4fa] text-[#5b4bd6] flex items-center justify-center shrink-0">
                            <IconoTrazo nombre="compartir" className="w-[19px] h-[19px]" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[19px] font-bold tracking-tight text-stone-900 leading-tight">Mi link de pedidos</h3>
                            <p className="text-xs text-stone-500 mt-0.5 leading-snug">
                              Tus clientes piden desde este link y te llega el pedido por WhatsApp con un código. Ingresa ese código en caja para cobrar.
                            </p>
                          </div>
                          <button onClick={() => { setModalDelivery(false); setMostrarQRDelivery(false); }} className="w-9 h-9 rounded-full bg-white ring-1 ring-[#5b4bd6]/10 hover:bg-[#ebf0ff] text-stone-500 flex items-center justify-center transition shrink-0" aria-label="Cerrar">
                            <IconoTrazo nombre="x" className="w-[15px] h-[15px]" />
                          </button>
                        </div>
                        <div className="px-4 pb-4">
                          <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-3.5 space-y-1.5">
                            <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                              <IconoTrazo nombre="warn" className="w-4 h-4" /> Función no habilitada
                            </p>
                            <p className="text-xs text-amber-700">
                              Los Pedidos por WhatsApp son una función paga aparte de tu plan.
                              Escribe a soporte de Kaserita para habilitarla en tu bodega.
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                          {/* Panel oscuro */}
                          <div
                            className="relative text-white px-5 pt-4 pb-9"
                            style={{ background: 'radial-gradient(90% 60% at 50% 0%, rgba(150,135,245,0.28), transparent 70%), linear-gradient(180deg, #34305a 0%, #26224a 55%, #1d1a38 100%)' }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="w-10 h-10 rounded-full border-[1.5px] border-white/25 bg-white/5 flex items-center justify-center">
                                <IconoTrazo nombre="compartir" className="w-[17px] h-[17px]" />
                              </span>
                              <span className="text-[12.5px] font-semibold text-white/80">Mi link de pedidos</span>
                              <button onClick={() => { setModalDelivery(false); setMostrarQRDelivery(false); }} className="w-10 h-10 rounded-full border-[1.5px] border-white/25 bg-white/5 hover:bg-white/10 flex items-center justify-center transition" aria-label="Cerrar">
                                <IconoTrazo nombre="x" className="w-[15px] h-[15px]" />
                              </button>
                            </div>

                            <div className="text-center mt-4">
                              <label className="relative w-[76px] h-[76px] rounded-[24px] cursor-pointer bg-white mx-auto block shadow-[0_14px_26px_-14px_rgba(0,0,0,0.6)]">
                                <span className="absolute inset-0 rounded-[24px] overflow-hidden flex items-center justify-center text-[#5b4bd6]">
                                  {logoUrlDelivery ? (
                                    <img src={logoUrlDelivery} alt="Logo" className="w-full h-full object-cover" />
                                  ) : (
                                    <IconoTrazo nombre="tienda" className="w-[28px] h-[28px]" />
                                  )}
                                  {subiendoLogoDelivery && (
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    </span>
                                  )}
                                </span>
                                <span className="absolute -right-1.5 -bottom-1.5 w-6 h-6 rounded-full bg-[#2d284b] text-white flex items-center justify-center border-2 border-white">
                                  <IconoTrazo nombre="plus" className="w-3 h-3" grosor={2.4} />
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files && e.target.files[0];
                                    e.target.value = '';
                                    if (file) subirLogoDelivery(file);
                                  }}
                                />
                              </label>
                              {(() => {
                                const palabras = String(sesion?.bodega?.nombre || '').trim().split(/\s+/);
                                const ultima = palabras.length > 1 ? palabras.pop() : '';
                                return (
                                  <p className="text-[27px] font-light tracking-tight leading-tight mt-3.5 truncate">
                                    {palabras.join(' ')}{ultima && <> <b className="font-bold">{ultima}</b></>}
                                  </p>
                                );
                              })()}
                              {estadoHorarioActualDelivery ? (
                                <span className="inline-flex items-center gap-1.5 mt-1.5 text-[11.5px] font-semibold text-white/85">
                                  <span className={`w-[7px] h-[7px] rounded-full ${estadoHorarioActualDelivery.abierto ? 'bg-green-400 shadow-[0_0_0_3px_rgba(74,222,128,0.2)]' : 'bg-white/60'}`}></span>
                                  {estadoHorarioActualDelivery.texto}
                                </span>
                              ) : (
                                <p className="text-[11.5px] text-white/70 mt-1.5 leading-snug">Configura tu horario para mostrar "Abierto" o "Cerrado".</p>
                              )}
                              <p className="text-[11px] text-white/50 mt-1">Toca el círculo para cambiar tu logo.</p>

                              <p className="mt-4 text-[11.5px] text-white/55 truncate">
                                {KASERITA_DELIVERY_URL.replace(/^https?:\/\//, '')}/
                                {/* El link es fijo: ya se comparte impreso y en QR, y si cambiara dejaría de funcionar. */}
                                <b className="block text-[19px] font-medium text-white mt-0.5 truncate">{slugDelivery}</b>
                              </p>
                              {deliveryHabilitado && sesion?.bodega?.slug && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${KASERITA_DELIVERY_URL}/${sesion.bodega.slug}`);
                                    setLinkDeliveryCopiado(true);
                                    setTimeout(() => setLinkDeliveryCopiado(false), 1600);
                                  }}
                                  className={`mt-3 inline-flex items-center gap-1.5 h-[34px] px-4 rounded-full border-[1.5px] text-[12.5px] font-bold transition ${linkDeliveryCopiado ? 'border-green-400/60 bg-green-400/15 text-green-300' : 'border-white/25 bg-white/5 hover:bg-white/10 text-white'}`}
                                >
                                  <IconoTrazo nombre={linkDeliveryCopiado ? 'check' : 'copiar'} className="w-3.5 h-3.5" />
                                  {linkDeliveryCopiado ? 'Copiado' : 'Copiar link'}
                                </button>
                              )}
                            </div>

                            {deliveryHabilitado && sesion?.bodega?.slug && (
                              <div className="grid gap-2.5 mt-5" style={{ gridTemplateColumns: `repeat(${typeof navigator !== 'undefined' && navigator.share ? 3 : 2}, minmax(0, 1fr))` }}>
                                <button
                                  type="button"
                                  onClick={() => setMostrarQRDelivery(true)}
                                  className="h-[62px] rounded-[20px] border-[1.5px] border-white/20 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] text-white/90 text-[11.5px] font-semibold flex flex-col items-center justify-center gap-1.5 transition"
                                >
                                  <IconoTrazo nombre="qr" className="w-[18px] h-[18px]" /> QR
                                </button>
                                {typeof navigator !== 'undefined' && navigator.share && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const url = `${KASERITA_DELIVERY_URL}/${sesion.bodega.slug}`;
                                      try {
                                        await navigator.share({ title: 'Mi Link de Pedidos', text: 'Haz tu pedido aquí:', url });
                                      } catch (err) {
                                        if (err?.name !== 'AbortError') notificar('No se pudo abrir el menú de compartir.', 'error');
                                      }
                                    }}
                                    className="h-[62px] rounded-[20px] border-[1.5px] border-white/20 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] text-white/90 text-[11.5px] font-semibold flex flex-col items-center justify-center gap-1.5 transition"
                                  >
                                    <IconoTrazo nombre="compartir" className="w-[18px] h-[18px]" /> Compartir
                                  </button>
                                )}
                                <a
                                  href={`${KASERITA_DELIVERY_URL}/${sesion.bodega.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="h-[62px] rounded-[20px] border-[1.5px] border-white/20 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] text-white/90 text-[11.5px] font-semibold flex flex-col items-center justify-center gap-1.5 transition"
                                >
                                  <i className="fa-solid fa-arrow-up-right-from-square text-[15px]"></i> Ver tienda
                                </a>
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-3 mt-4 rounded-[20px] border-[1.5px] border-white/15 bg-white/5 px-4 py-3">
                              <div className="min-w-0">
                                <p className="text-[13.5px] font-bold">Mostrar mi tienda al público</p>
                                <p className="text-[11.5px] text-white/60">{deliveryHabilitado ? 'Visible para tus clientes' : 'Solo entra quien tenga tu link'}</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={deliveryHabilitado}
                                aria-label="Mostrar mi tienda al público"
                                onClick={() => setDeliveryHabilitado((v) => !v)}
                                className={`kz-sw ${deliveryHabilitado ? 'on' : ''}`}
                              >
                                <i></i>
                              </button>
                            </div>
                          </div>

                          {/* Hoja blanca con los ajustes de la tienda */}
                          <div className="relative -mt-5 rounded-t-[30px] bg-white px-4 pt-4 pb-3">
                            <p className="text-sm font-bold text-[#2d284b] mx-1 mb-3">Tu tienda</p>
                          {seccionDelivery('donde', 'ubicacion', 'Ubicación y horarios', `${direccionDelivery.trim() || 'Sin dirección'} · ${resumenHorarioDelivery(horarioDelivery)}`, (
                            <>
                              <div>
                                <label className="text-[12.5px] font-semibold text-stone-700 block mb-1.5">Dirección de tu negocio</label>
                                <div className="h-[46px] flex items-center gap-2 px-3.5 rounded-2xl bg-[#f7f9ff] ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                                  <input
                                    type="text"
                                    value={direccionDelivery}
                                    onChange={(e) => setDireccionDelivery(e.target.value)}
                                    placeholder="Ej. Av. Larco 450, Miraflores"
                                    className="w-full min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-[#9290a2] focus:outline-none"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[12.5px] font-semibold text-stone-700 block mb-1.5">Días y horario de atención</label>
                                <div className="grid grid-cols-7 gap-1.5">
                                  {DIAS_DELIVERY.map(([dia, letra]) => {
                                    const abierto = !!horarioDelivery[dia]?.abierto;
                                    return (
                                      <button
                                        key={dia}
                                        type="button"
                                        onClick={() => setHorarioDelivery((h) => {
                                          if (abierto) return { ...h, [dia]: { ...h[dia], abierto: false } };
                                          // Toma el horario que ya tengan los otros días abiertos, para
                                          // que todos los días activos compartan el mismo rango -- si
                                          // ninguno está abierto todavía, cae al horario típico de bodega.
                                          const otroAbierto = Object.values(h).find((v) => v?.abierto);
                                          return {
                                            ...h,
                                            [dia]: { abierto: true, desde: otroAbierto?.desde || '08:00', hasta: otroAbierto?.hasta || '21:00' },
                                          };
                                        })}
                                        className={`h-[38px] rounded-xl text-xs font-bold flex items-center justify-center transition ${
                                          abierto ? 'bg-[#5b4bd6] text-white' : 'bg-[#ebf0ff] text-[#6f6c93]'
                                        }`}
                                      >
                                        {letra}
                                      </button>
                                    );
                                  })}
                                </div>
                                {Object.values(horarioDelivery).some((v) => v?.abierto) ? (
                                  <div className="flex items-center gap-2 mt-2.5">
                                    <input
                                      type="time"
                                      value={Object.values(horarioDelivery).find((v) => v?.abierto)?.desde || '08:00'}
                                      onChange={(e) => setHorarioDelivery((h) => {
                                        const nuevo = { ...h };
                                        Object.keys(nuevo).forEach((d) => { if (nuevo[d]?.abierto) nuevo[d] = { ...nuevo[d], desde: e.target.value }; });
                                        return nuevo;
                                      })}
                                      className="flex-1 min-w-0 h-[46px] bg-[#f7f9ff] ring-1 ring-[#5b4bd6]/10 rounded-2xl px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5b4bd6]/40"
                                    />
                                    <span className="text-stone-400 text-xs shrink-0">a</span>
                                    <input
                                      type="time"
                                      value={Object.values(horarioDelivery).find((v) => v?.abierto)?.hasta || '21:00'}
                                      onChange={(e) => setHorarioDelivery((h) => {
                                        const nuevo = { ...h };
                                        Object.keys(nuevo).forEach((d) => { if (nuevo[d]?.abierto) nuevo[d] = { ...nuevo[d], hasta: e.target.value }; });
                                        return nuevo;
                                      })}
                                      className="flex-1 min-w-0 h-[46px] bg-[#f7f9ff] ring-1 ring-[#5b4bd6]/10 rounded-2xl px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5b4bd6]/40"
                                    />
                                  </div>
                                ) : (
                                  <p className="text-xs text-stone-400 mt-2">Marca los días en que atiendes.</p>
                                )}
                                <p className="text-[11.5px] text-stone-400 mt-1.5 leading-snug">
                                  La tienda muestra "Abierto" o "Cerrado" según este horario.
                                </p>
                              </div>
                            </>
                          ), estadoHorarioActualDelivery
                            ? { texto: estadoHorarioActualDelivery.abierto ? 'Abierta' : 'Cerrada', tono: estadoHorarioActualDelivery.abierto ? 'ok' : 'apagado' }
                            : { texto: 'Sin horario', tono: 'aviso' })}

                          {seccionDelivery('entrega', 'moto', 'Entrega a domicilio', resumenEntregaDelivery, (
                            <>
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-stone-900">Llevar pedidos a domicilio</p>
                                  <p className="text-[11.5px] text-stone-400 leading-snug mt-0.5">Tus clientes marcan su ubicación en el mapa y tú la reenvías a tu repartidor por WhatsApp.</p>
                                </div>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={domicilioHabilitado}
                                  aria-label="Entrega a domicilio"
                                  onClick={() => setDomicilioHabilitado((v) => !v)}
                                  className={`kz-sw ${domicilioHabilitado ? 'on' : ''}`}
                                >
                                  <i></i>
                                </button>
                              </div>

                              {domicilioHabilitado && (
                                <>
                                  <div className="grid grid-cols-2 gap-2.5">
                                    <div>
                                      <label className="text-[12.5px] font-semibold text-stone-700 block mb-1.5">Costo de envío</label>
                                      <div className="h-[46px] flex items-center gap-1.5 px-3.5 rounded-2xl bg-[#f7f9ff] ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                                        <span className="text-sm text-stone-400">S/</span>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={costoEnvioDelivery}
                                          onChange={(e) => setCostoEnvioDelivery(e.target.value)}
                                          placeholder="3.00"
                                          className="w-full min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-[#9290a2] focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-[12.5px] font-semibold text-stone-700 block mb-1.5">Pedido mínimo</label>
                                      <div className="h-[46px] flex items-center gap-1.5 px-3.5 rounded-2xl bg-[#f7f9ff] ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                                        <span className="text-sm text-stone-400">S/</span>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={pedidoMinimoDelivery}
                                          onChange={(e) => setPedidoMinimoDelivery(e.target.value)}
                                          placeholder="20.00"
                                          className="w-full min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-[#9290a2] focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-[12.5px] font-semibold text-stone-700 block mb-1.5">Zona de reparto</label>
                                    <div className="h-[46px] flex items-center gap-2 px-3.5 rounded-2xl bg-[#f7f9ff] ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                                      <input
                                        type="text"
                                        value={zonaRepartoDelivery}
                                        onChange={(e) => setZonaRepartoDelivery(e.target.value)}
                                        maxLength={120}
                                        placeholder="Ej. Cercado, Breña y Jesús María"
                                        className="w-full min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-[#9290a2] focus:outline-none"
                                      />
                                    </div>
                                    <p className="text-[11.5px] text-stone-400 mt-1.5 leading-snug">Se le muestra al cliente antes de pedir.</p>
                                  </div>

                                  <div>
                                    <label className="text-[12.5px] font-semibold text-stone-700 block mb-1.5">WhatsApp de tu repartidor (opcional)</label>
                                    <div className="h-[46px] flex items-center gap-2 px-3.5 rounded-2xl bg-[#f7f9ff] ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                                      <input
                                        type="text"
                                        inputMode="tel"
                                        value={whatsappRepartidor}
                                        onChange={(e) => setWhatsappRepartidor(e.target.value)}
                                        placeholder="Ej. 51987111222"
                                        className="w-full min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-[#9290a2] focus:outline-none"
                                      />
                                    </div>
                                    <p className="text-[11.5px] text-stone-400 mt-1.5 leading-snug">Con el código de país. Si lo dejas vacío, WhatsApp te deja elegir el contacto cada vez. Los clientes no ven este número.</p>
                                  </div>
                                </>
                              )}
                            </>
                          ), domicilioHabilitado ? { texto: 'Activa', tono: 'ok' } : { texto: 'Apagada', tono: 'apagado' })}

                          {sesion?.usuario?.rol === 'dueno' && seccionDelivery('whatsapp', 'chat', 'Pedidos por WhatsApp', telefonoDeliveryEditar.trim() ? `Te llegan al ${telefonoDeliveryEditar.trim()}` : 'Falta tu número', (
                            <div>
                              <label className="text-[12.5px] font-semibold text-stone-700 block mb-1.5">Tu número (ahí te van a llegar los pedidos)</label>
                              <div className="h-[46px] flex items-center gap-2 px-3.5 rounded-2xl bg-[#f7f9ff] ring-1 ring-[#5b4bd6]/10 focus-within:ring-2 focus-within:ring-[#5b4bd6]/40">
                                <input
                                  type="text"
                                  value={telefonoDeliveryEditar}
                                  onChange={(e) => setTelefonoDeliveryEditar(e.target.value)}
                                  placeholder="Ej. 51987654321"
                                  className="w-full min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-[#9290a2] focus:outline-none"
                                />
                              </div>
                              <p className="text-[11.5px] text-stone-400 mt-1.5 leading-snug">Sin espacios ni guiones, con el código de país adelante.</p>
                            </div>
                          ), telefonoDeliveryEditar.trim() ? { texto: 'Conectado', tono: 'ok' } : { texto: 'Falta número', tono: 'aviso' })}

                          {esAdmin && resumenAvisos && sesion?.bodega?.delivery_habilitado && sesion?.bodega?.slug && seccionDelivery(
                            'avisos',
                            'campana',
                            'Avisar a tus clientes',
                            `${resumenAvisos.audiencia} cliente${resumenAvisos.audiencia === 1 ? '' : 's'} recibiría${resumenAvisos.audiencia === 1 ? '' : 'n'} el aviso`,
                            (
                              <>
                                <p className="text-[12.5px] text-stone-600 leading-snug">
                                  Avisa a quienes siguen o visitaron tu tienda: <strong>“¡{sesion.bodega.nombre} ya recibe pedidos!”</strong>.
                                </p>
                                <p className="text-[11.5px] text-stone-400 leading-snug">
                                  Máximo una vez por semana. También se avisa solo cuando activas tu tienda o la entrega a domicilio.
                                </p>
                                <button
                                  type="button"
                                  onClick={avisarAMisClientes}
                                  disabled={enviandoAviso || resumenAvisos.audiencia === 0 || !!resumenAvisos.proximo}
                                  className="w-full h-[46px] rounded-full bg-[#ebf0ff] hover:bg-[#dde4fa] text-[#2d284b] text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:hover:bg-[#ebf0ff]"
                                >
                                  <IconoTrazo nombre="campana" className="w-[17px] h-[17px]" />
                                  {enviandoAviso
                                    ? 'Enviando...'
                                    : resumenAvisos.proximo
                                    ? `Disponible el ${new Date(resumenAvisos.proximo).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}`
                                    : resumenAvisos.audiencia === 0
                                    ? 'Aún no tienes clientes con avisos'
                                    : 'Avisar ahora'}
                                </button>
                              </>
                            ),
                            resumenAvisos.audiencia > 0 && !resumenAvisos.proximo ? { texto: `${resumenAvisos.audiencia} listos`, tono: 'aviso' } : null
                          )}
                          </div>
                        </div>

                        <div className="shrink-0 bg-white px-4 pb-4 pt-1">
                          {hayCambiosDelivery && (
                            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-700 mb-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Tienes cambios sin guardar
                            </p>
                          )}
                          <button
                            onClick={guardarConfigDelivery}
                            disabled={guardandoDelivery || !hayCambiosDelivery}
                            className="kz-pri w-full h-[54px] text-base font-semibold flex items-center justify-center gap-2.5"
                          >
                            <span>{guardandoDelivery ? 'Guardando...' : 'Guardar cambios'}</span>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" /><path d="M19 15c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8Z" /></svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
    </>
  );
}
