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
              {/* Modal: Mi Link de Pedidos (vitrina pública de KaseritaDelivery) */}
              {modalDelivery && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-md w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
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

                    {!sesion?.bodega?.delivery_permitido ? (
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
                    ) : (
                      <>
                        <div className="flex-1 overflow-y-auto px-4 pb-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                          <div className="relative overflow-hidden rounded-[26px] p-4 mb-2.5 text-white bg-gradient-to-br from-[#7466e8] via-[#5b4bd6] to-[#221e3d] shadow-[0_20px_30px_-22px_rgba(45,40,75,0.85)]">
                            <span className="absolute -right-11 -top-14 w-[150px] h-[150px] rounded-full bg-white/10 pointer-events-none"></span>
                            <span className="absolute right-14 top-20 w-20 h-20 rounded-full bg-yellow-300/15 pointer-events-none"></span>
                            <div className="relative flex items-center gap-3.5">
                              <label className="relative w-[68px] h-[68px] rounded-[20px] cursor-pointer bg-white shrink-0 shadow-[0_10px_18px_-10px_rgba(0,0,0,0.5)]">
                                <span className="absolute inset-0 rounded-[20px] overflow-hidden flex items-center justify-center text-[#5b4bd6]">
                                  {logoUrlDelivery ? (
                                    <img src={logoUrlDelivery} alt="Logo" className="w-full h-full object-cover" />
                                  ) : (
                                    <IconoTrazo nombre="tienda" className="w-[26px] h-[26px]" />
                                  )}
                                  {subiendoLogoDelivery && (
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    </span>
                                  )}
                                </span>
                                <span className="absolute -right-1.5 -bottom-1.5 w-6 h-6 rounded-full bg-[#5b4bd6] text-white flex items-center justify-center border-2 border-white">
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
                              <div className="min-w-0">
                                <p className="text-[19px] font-extrabold tracking-tight leading-tight truncate">{sesion?.bodega?.nombre}</p>
                                {estadoHorarioActualDelivery ? (
                                  <span className="inline-flex items-center gap-1.5 mt-1.5 text-[11.5px] font-bold bg-white/20 rounded-full px-2.5 py-0.5">
                                    <span className={`w-[7px] h-[7px] rounded-full ${estadoHorarioActualDelivery.abierto ? 'bg-green-400' : 'bg-white/60'}`}></span>
                                    {estadoHorarioActualDelivery.texto}
                                  </span>
                                ) : (
                                  <p className="text-[11.5px] text-white/80 mt-1 leading-snug">Configura tu horario para mostrar "Abierto" o "Cerrado".</p>
                                )}
                                {estadoHorarioActualDelivery && <p className="text-[11px] text-white/70 mt-1">Toca el círculo para cambiar tu logo.</p>}
                              </div>
                            </div>

                            <div className="relative flex items-center justify-between gap-3 mt-3.5 bg-white/15 rounded-2xl px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="text-[13.5px] font-bold">Mostrar mi tienda al público</p>
                                <p className="text-[11.5px] text-white/85">{deliveryHabilitado ? 'Visible para tus clientes' : 'Solo entra quien tenga tu link'}</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={deliveryHabilitado}
                                aria-label="Mostrar mi tienda al público"
                                onClick={() => setDeliveryHabilitado((v) => !v)}
                                className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${deliveryHabilitado ? 'bg-green-500' : 'bg-white/30'}`}
                              >
                                <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow transition-all ${deliveryHabilitado ? 'left-[23px]' : 'left-[3px]'}`}></span>
                              </button>
                            </div>

                            <div className="relative flex items-center gap-2 mt-2.5 bg-white text-stone-900 rounded-2xl p-1.5 pl-3.5">
                              <span className="flex-1 min-w-0 truncate text-[12.5px] text-stone-400">
                                {KASERITA_DELIVERY_URL.replace(/^https?:\/\//, '')}/
                                {/* El link es fijo: ya se comparte impreso y en QR, y si cambiara dejaría de funcionar. */}
                                <b className="text-stone-900 font-bold">{slugDelivery}</b>
                              </span>
                              {deliveryHabilitado && sesion?.bodega?.slug && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${KASERITA_DELIVERY_URL}/${sesion.bodega.slug}`);
                                    setLinkDeliveryCopiado(true);
                                    setTimeout(() => setLinkDeliveryCopiado(false), 1600);
                                  }}
                                  className={`shrink-0 h-9 px-3.5 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5 transition ${linkDeliveryCopiado ? 'bg-green-100 text-green-700' : 'bg-[#5b4bd6] text-white'}`}
                                >
                                  <IconoTrazo nombre={linkDeliveryCopiado ? 'check' : 'copiar'} className="w-3.5 h-3.5" />
                                  {linkDeliveryCopiado ? 'Copiado' : 'Copiar'}
                                </button>
                              )}
                            </div>

                            {deliveryHabilitado && sesion?.bodega?.slug && (
                              <div className="relative grid gap-2 mt-2.5" style={{ gridTemplateColumns: `repeat(${typeof navigator !== 'undefined' && navigator.share ? 3 : 2}, minmax(0, 1fr))` }}>
                                <button
                                  type="button"
                                  onClick={() => setMostrarQRDelivery(true)}
                                  className="h-10 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition"
                                >
                                  <IconoTrazo nombre="qr" className="w-4 h-4" /> QR
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
                                    className="h-10 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition"
                                  >
                                    <IconoTrazo nombre="compartir" className="w-4 h-4" /> Compartir
                                  </button>
                                )}
                                <a
                                  href={`${KASERITA_DELIVERY_URL}/${sesion.bodega.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="h-10 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition"
                                >
                                  <i className="fa-solid fa-arrow-up-right-from-square text-[11px]"></i> Ver tienda
                                </a>
                              </div>
                            )}
                          </div>

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
                          ))}

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
                                  className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${domicilioHabilitado ? 'bg-[#5b4bd6]' : 'bg-[#d8d7e0]'}`}
                                >
                                  <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow transition-all ${domicilioHabilitado ? 'left-[23px]' : 'left-[3px]'}`}></span>
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
                          ))}

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
                          ))}

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
                            )
                          )}
                        </div>

                        <div className="relative -mt-14 px-4 pt-8 pb-4 shrink-0 bg-gradient-to-t from-[#f8f9fd] from-70% to-transparent">
                          {hayCambiosDelivery && (
                            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-700 mb-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Tienes cambios sin guardar
                            </p>
                          )}
                          <button
                            onClick={guardarConfigDelivery}
                            disabled={guardandoDelivery}
                            className="w-full h-[54px] rounded-full bg-gradient-to-r from-[#7466e8] to-[#2d284b] text-white font-semibold text-base transition disabled:opacity-50"
                          >
                            {guardandoDelivery ? 'Guardando...' : 'Guardar cambios'}
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
