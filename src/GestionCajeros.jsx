import React from 'react';
import { PIN_MAX } from './PanelAdminCompartido.jsx';

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
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-md w-full p-5 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center shrink-0">
                      <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                        <i className="fa-solid fa-user-group text-orange-600"></i> {esBarberia ? 'Barberos' : 'Cajeros y Empleados'}
                      </h3>
                      <button aria-label="Cerrar" onClick={() => setModalGestionCajeros(false)} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-900 shadow-sm"><i className="fa-solid fa-xmark"></i></button>
                    </div>

                    {mostrarFormNuevoCajero ? (
                      <div className="p-3 bg-stone-50 rounded-xl border border-orange-700/40 space-y-2.5">
                        <div>
                          <label className="text-xs text-stone-600 block mb-1">Nombre:</label>
                          <input
                            type="text"
                            value={formNuevoCajero.nombre}
                            onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, nombre: e.target.value })}
                            className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-stone-600 block mb-1">DNI:</label>
                          <input
                            type="text"
                            maxLength={8}
                            value={formNuevoCajero.dni}
                            onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, dni: e.target.value })}
                            className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-stone-600 block mb-1">Rol:</label>
                          <select
                            value={formNuevoCajero.rol}
                            onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, rol: e.target.value })}
                            className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                          >
                            <option value="cajero">Cajero (solo vender y cobrar)</option>
                            <option value="administrador">Administrador (acceso completo)</option>
                          </select>
                        </div>
                        {formNuevoCajero.rol === 'administrador' && (
                          <div>
                            <label className="text-xs text-stone-600 block mb-1">PIN de seguridad (4 a 32 caracteres, con letras, números o símbolos):</label>
                            <input
                              type="text"
                              maxLength={PIN_MAX}
                              autoComplete="off"
                              value={formNuevoCajero.pin}
                              onChange={(e) => setFormNuevoCajero({ ...formNuevoCajero, pin: e.target.value })}
                              className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-1.5 text-xs text-stone-900"
                            />
                            <p className="text-[10px] text-stone-500 mt-1">Se le va a pedir cada vez que alguien más lo elija al abrir turno.</p>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setMostrarFormNuevoCajero(false)} className="flex-1 py-2 bg-white/70 text-stone-600 text-xs font-semibold rounded-full shadow-sm">
                            Cancelar
                          </button>
                          <button
                            onClick={registrarNuevoCajeroCompleto}
                            disabled={guardandoNuevoCajero}
                            className="flex-1 py-2 bg-[#5b4bd6] hover:bg-[#473bb5] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow"
                          >
                            {guardandoNuevoCajero ? 'Guardando...' : 'Agregar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setMostrarFormNuevoCajero(true)}
                          className="w-full py-2.5 bg-white/70 hover:bg-[#dde4fa] text-stone-600 text-xs font-semibold rounded-full border border-stone-300 border-dashed flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
                        >
                          <i className="fa-solid fa-user-plus"></i> {esBarberia ? 'Agregar barbero' : 'Agregar cajero'}
                        </button>
                        <div className="flex-1 overflow-y-auto space-y-1.5">
                          {cargandoCajerosGestion ? (
                            <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
                          ) : cajerosGestion.length === 0 ? (
                            <p className="text-xs text-stone-500 text-center py-6">Sin cajeros registrados.</p>
                          ) : (
                            cajerosGestion.map((c) => (
                              <div key={c.id} className={`flex items-center justify-between p-2.5 bg-stone-50 border border-stone-200 rounded-xl ${!c.activo ? 'opacity-50' : ''}`}>
                                <div>
                                  <p className="text-xs font-semibold text-stone-800">
                                    {c.nombre} {!c.activo && <span className="text-rose-600 font-sans">(Inactivo)</span>}
                                  </p>
                                  <p className="text-xs text-stone-500 capitalize">DNI: {c.dni} · {c.rol}</p>
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
                                      className="w-7 h-7 flex items-center justify-center bg-stone-200 hover:bg-orange-100 text-stone-500 hover:text-orange-600 rounded-lg"
                                    >
                                      <i className="fa-solid fa-key text-xs"></i>
                                    </button>
                                  )}
                                  {c.rol !== 'dueno' && (
                                    <button
                                      onClick={() => alternarActivoCajero(c)}
                                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                                        c.activo ? 'bg-rose-950/60 text-rose-600 hover:bg-rose-900' : 'bg-emerald-950/60 text-emerald-600 hover:bg-emerald-900'
                                      }`}
                                    >
                                      {c.activo ? 'Desactivar' : 'Reactivar'}
                                    </button>
                                  )}
                                  {c.rol !== 'dueno' && (
                                    <button
                                      onClick={() => eliminarCajero(c)}
                                      title="Eliminar de la lista de cajeros"
                                      className="w-7 h-7 flex items-center justify-center bg-stone-200 hover:bg-rose-100 text-stone-500 hover:text-rose-600 rounded-lg"
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
                </div>
              )}
    </>
  );
}
