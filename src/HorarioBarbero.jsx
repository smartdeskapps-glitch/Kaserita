import React from 'react';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function HorarioBarbero({
  cambiarDiaHorario,
  copiarHorarioADias,
  esBarberia,
  guardandoHorario,
  guardarHorarioBarbero,
  modalHorario,
  setModalHorario,
}) {
  return (
    <>
              {/* Modal: horario de atención de un barbero (agenda de reservas) */}
              {modalHorario && esBarberia && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                  <div className="bg-white border border-stone-200 rounded-[28px] max-w-lg w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1 shrink-0">
                      <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2"><i className="fa-regular fa-calendar text-[#5b4bd6]"></i> Horario de {modalHorario.barbero.nombre}</h3>
                      <button aria-label="Cerrar" onClick={() => setModalHorario(null)} className="text-stone-600 hover:text-stone-900 shrink-0"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <p className="px-5 pb-2 text-[11px] text-stone-500 shrink-0">
                      Marca los días que atiende y su horario. El descanso es opcional (por ejemplo, el almuerzo). Cuando un barbero tiene horario, la tienda en línea muestra horas libres y solo ofrece a los barberos con horario.
                    </p>
                    <div className="px-5 pb-3 overflow-y-auto space-y-2">
                      {modalHorario.dias.map((d) => (
                        <div key={d.dia} className={`p-2.5 border rounded-xl ${d.activo ? 'bg-stone-50 border-stone-200' : 'bg-white border-stone-100'}`}>
                          <label className="flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer">
                            <input type="checkbox" checked={d.activo} onChange={(e) => cambiarDiaHorario(d.dia, { activo: e.target.checked })} className="w-3.5 h-3.5" />
                            {d.nombre}
                            {!d.activo && <span className="font-normal text-stone-400">No atiende</span>}
                          </label>
                          {d.activo && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                              {[['desde', 'Desde'], ['hasta', 'Hasta'], ['descansoDesde', 'Descanso desde'], ['descansoHasta', 'Descanso hasta']].map(([campo, etiqueta]) => (
                                <label key={campo} className="flex flex-col gap-0.5 text-[10px] text-stone-500">
                                  {etiqueta}
                                  <input
                                    type="time"
                                    value={d[campo]}
                                    onChange={(e) => cambiarDiaHorario(d.dia, { [campo]: e.target.value })}
                                    className="px-2 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-800 bg-white"
                                  />
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 px-5 pb-4 pt-1 shrink-0">
                      <button onClick={copiarHorarioADias} className="px-3 py-2 bg-[#ebf0ff] hover:bg-[#dde4fa] text-[#2d284b] text-xs font-semibold rounded-full">
                        Copiar el primer día a los demás
                      </button>
                      <button onClick={guardarHorarioBarbero} disabled={guardandoHorario} className="flex-1 py-2 bg-[#5b4bd6] hover:bg-[#473bb5] disabled:opacity-60 text-white font-bold text-xs rounded-full shadow">
                        {guardandoHorario ? 'Guardando...' : 'Guardar horario'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
    </>
  );
}
