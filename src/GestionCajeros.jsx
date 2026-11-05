import React from 'react';
import { PIN_MAX } from './PanelAdminCompartido.jsx';
import VentanaModulo from './VentanaModulo.jsx';
import { iniciales } from './lib/nombres.js';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function GestionCajeros({
  abrirHorarioBarbero,
  alternarActivoCajero,
  barberosConHorario,
  cajerosGestion,
  cargandoCajerosGestion,
  eliminarCajero,
  esBarberia,
  formNuevoCajero,
  guardandoNuevoCajero,
  guardarComisionBarbero,
  modalGestionCajeros,
  mostrarFormNuevoCajero,
  registrarNuevoCajeroCompleto,
  setFormNuevoCajero,
  setModalGestionCajeros,
  setModalPinCajero,
  setMostrarFormNuevoCajero,
  setNuevoPinCajero,
}) {
  return (
    <>
              {/* Modal: Gestión de Cajeros */}
              {modalGestionCajeros && (
                <VentanaModulo
                  icono="fa-user-group"
                  titulo={esBarberia ? 'Barberos' : 'Cajeros y empleados'}
                  subtitulo="Quién puede entrar y vender"
                  cifras={!cargandoCajerosGestion && cajerosGestion.length > 0 && [
                    { etiqueta: 'Personas', valor: cajerosGestion.length },
                    { etiqueta: 'Activas', valor: cajerosGestion.filter((c) => c.activo).length, tono: 'ok' },
                  ]}
                  acciones={!mostrarFormNuevoCajero && (
                    <button type="button" onClick={() => setMostrarFormNuevoCajero(true)} className="kz-pri h-10 px-4 text-[13px] font-bold inline-flex items-center gap-2 shrink-0">
                      <i className="fa-solid fa-user-plus text-[11px]"></i><span>{esBarberia ? 'Agregar' : 'Nuevo'}<span className="hidden sm:inline">{esBarberia ? ' barbero' : ' cajero'}</span></span>
                    </button>
                  )}
                  onClose={() => setModalGestionCajeros(false)}
                  ancho="max-w-2xl"
                >
                  <div className="p-4 sm:p-6 space-y-3">
                    {mostrarFormNuevoCajero ? (
                      <div className="rounded-[20px] bg-[#f3f5ff] p-4 space-y-3">
                        <div>
                          <label className="text-xs font-bold text-[#6b6890] block mb-1.5 ml-1">Nombre:</label>
                          <input
                            type="text"
                            value={formNuevoCajero.nombre}
                            onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, nombre: e.target.value })}
                            className="w-full h-11 bg-white rounded-[14px] px-3.5 text-[13.5px] text-[#2d284b] outline-none focus:ring-2 focus:ring-[#5b4bd6]/40"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-[#6b6890] block mb-1.5 ml-1">DNI:</label>
                          <input
                            type="text"
                            maxLength={8}
                            value={formNuevoCajero.dni}
                            onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, dni: e.target.value })}
                            className="w-full h-11 bg-white rounded-[14px] px-3.5 text-[13.5px] text-[#2d284b] outline-none focus:ring-2 focus:ring-[#5b4bd6]/40"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-[#6b6890] block mb-1.5 ml-1">Rol:</label>
                          <select
                            value={formNuevoCajero.rol}
                            onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, rol: e.target.value })}
                            className="w-full h-11 bg-white rounded-[14px] px-3.5 text-[13.5px] text-[#2d284b] outline-none focus:ring-2 focus:ring-[#5b4bd6]/40"
                          >
                            <option value="cajero">Cajero (solo vender y cobrar)</option>
                            <option value="administrador">Administrador (acceso completo)</option>
                          </select>
                        </div>
                        {formNuevoCajero.rol === 'administrador' && (
                          <div>
                            <label className="text-xs font-bold text-[#6b6890] block mb-1.5 ml-1">PIN de seguridad (4 a 32 caracteres, con letras, números o símbolos):</label>
                            <input
                              type="text"
                              maxLength={PIN_MAX}
                              autoComplete="off"
                              value={formNuevoCajero.pin}
                              onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, pin: e.target.value })}
                              className="w-full h-11 bg-white rounded-[14px] px-3.5 text-[13.5px] text-[#2d284b] outline-none focus:ring-2 focus:ring-[#5b4bd6]/40"
                            />
                            <p className="text-[11px] text-[#8f8cb0] mt-1 ml-1">Se le va a pedir cada vez que alguien más lo elija al abrir turno.</p>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setMostrarFormNuevoCajero(false)} className="flex-1 h-11 bg-white hover:bg-[#e6ebff] text-[#6b6890] text-[13px] font-bold rounded-full transition">
                            Cancelar
                          </button>
                          <button
                            onClick={registrarNuevoCajeroCompleto}
                            disabled={guardandoNuevoCajero}
                            className="kz-pri flex-1 h-11 text-[13px] font-bold"
                          >
                            {guardandoNuevoCajero ? 'Guardando...' : 'Agregar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          {cargandoCajerosGestion ? (
                            <p className="text-[13px] text-[#8f8cb0] text-center py-8">Cargando...</p>
                          ) : cajerosGestion.length === 0 ? (
                            <p className="text-[13px] text-[#8f8cb0] text-center py-8">Sin cajeros registrados.</p>
                          ) : (
                            cajerosGestion.map((c) => (
                              <div key={c.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-[18px] hover:bg-[#f6f8ff] transition ${!c.activo ? 'opacity-50' : ''}`}>
                                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9687f5] to-[#5b4bd6] text-white grid place-items-center text-[13px] font-bold shrink-0">{iniciales(c.nombre, '?')}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13.5px] font-bold text-[#2d284b]">
                                    {c.nombre} {!c.activo && <span className="text-[11px] font-bold text-[#c0262d] bg-[#fde0e5] rounded-full px-2 py-0.5 ml-1">Inactivo</span>}
                                  </p>
                                  <p className="text-xs text-[#8f8cb0] capitalize">DNI: {c.dni} · {c.rol}</p>
                                  {esBarberia && c.rol !== 'dueno' && (
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                                      {[['comision_pct', 'Cortes y servicios', 'Porcentaje que gana cuando hace un servicio (corte, barba...)'], ['comision_productos_pct', 'Productos', 'Porcentaje que gana cuando ayuda a vender un producto (pomada, shampoo...)']].map(([campo, etiqueta, ayuda]) => (
                                        <label key={campo} className="flex items-center gap-1 text-[11px] text-stone-500" title={ayuda}>
                                          {etiqueta}
                                          <input
                                            key={`${c.id}-${campo}-${c[campo]}`}
                                            type="number" min="0" max="100" step="1"
                                            defaultValue={c[campo] ?? 0}
                                            onBlur={(e) => guardarComisionBarbero(c, e.target.value, campo)}
                                            className="w-14 px-1.5 py-1 border border-stone-200 rounded-lg text-xs text-stone-800 text-right"
                                          />
                                          %
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                  {esBarberia && c.activo && (
                                    <button
                                      onClick={() => abrirHorarioBarbero(c)}
                                      title="Días y horas en que atiende; las citas de la tienda en línea se reservan dentro de este horario"
                                      className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#2d284b] hover:underline"
                                    >
                                      <i className="fa-regular fa-calendar"></i>
                                      Horario de atención · {barberosConHorario.has(c.id) ? 'configurado' : 'sin horario'}
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {c.rol === 'administrador' && (
                                    <button
                                      onClick={() => { setModalPinCajero(c); setNuevoPinCajero(''); }}
                                      title="Cambiar su PIN de seguridad"
                                      className="w-8 h-8 flex items-center justify-center bg-[#f3f5ff] hover:bg-[#e6ebff] text-[#6b6890] hover:text-[#5b4bd6] rounded-full transition"
                                    >
                                      <i className="fa-solid fa-key text-xs"></i>
                                    </button>
                                  )}
                                  {c.rol !== 'dueno' && (
                                    <button
                                      onClick={() => alternarActivoCajero(c)}
                                      className={`h-8 text-xs font-bold px-3 rounded-full transition ${
                                        c.activo ? 'bg-[#f3f5ff] text-[#6b6890] hover:bg-[#fde0e5] hover:text-[#c0262d]' : 'bg-[#d9f5e9] text-[#0f7b4a] hover:bg-[#c6efdc]'
                                      }`}
                                    >
                                      {c.activo ? 'Desactivar' : 'Reactivar'}
                                    </button>
                                  )}
                                  {c.rol !== 'dueno' && (
                                    <button
                                      onClick={() => eliminarCajero(c)}
                                      title="Eliminar de la lista de cajeros"
                                      className="w-8 h-8 flex items-center justify-center bg-[#f3f5ff] hover:bg-[#fde0e5] text-[#6b6890] hover:text-[#c0262d] rounded-full transition"
                                    >
                                      <i className="fa-solid fa-trash text-xs"></i>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </VentanaModulo>
              )}
    </>
  );
}
