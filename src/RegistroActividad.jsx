import React from 'react';
import { describirAuditoria } from './lib/auditoria.js';

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function RegistroActividad({
  cargandoAuditoria,
  errorAuditoria,
  esModoDemo,
  filasAuditoria,
  filtroAuditoria,
  modalAuditoria,
  productos,
  setFiltroAuditoria,
  setModalAuditoria,
}) {
  return (
    <>
              {/* Modal: registro de actividad (cambios de precio, anulaciones, turnos, empleados, mermas) */}
              {modalAuditoria && (
                <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setModalAuditoria(false)}>
                  <div className="bg-gradient-to-br from-[#eef1fb] via-[#f8f9fd] to-[#f4f5fa] border border-white/80 rounded-[28px] max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                        <i className="fa-solid fa-clipboard-check text-orange-600"></i> Registro de actividad
                      </h3>
                      <button aria-label="Cerrar" onClick={() => setModalAuditoria(false)} className="text-stone-500 hover:text-stone-800"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <div className="px-4 pt-3 flex gap-1.5 flex-wrap">
                      {[['todo', 'Todo'], ['productos', 'Precios y productos'], ['ventas', 'Ventas'], ['turnos_caja', 'Turnos'], ['cajeros', 'Empleados'], ['mermas', 'Pérdidas']].map(([valor, etiqueta]) => (
                        <button
                          key={valor}
                          onClick={() => setFiltroAuditoria(valor)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${filtroAuditoria === valor ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'}`}
                        >
                          {etiqueta}
                        </button>
                      ))}
                    </div>
                    <div className="p-4 overflow-y-auto space-y-2">
                      {esModoDemo && <p className="text-xs text-stone-500">El registro de actividad no está disponible en el modo demostración local.</p>}
                      {errorAuditoria && <p className="text-xs text-rose-600">{errorAuditoria}</p>}
                      {cargandoAuditoria && <p className="text-xs text-stone-500">Cargando...</p>}
                      {!cargandoAuditoria && !errorAuditoria && !esModoDemo && filasAuditoria.filter((f) => filtroAuditoria === 'todo' || f.tabla === filtroAuditoria).length === 0 && (
                        <p className="text-xs text-stone-500">Todavía no hay actividad registrada en esta categoría.</p>
                      )}
                      {filasAuditoria.filter((f) => filtroAuditoria === 'todo' || f.tabla === filtroAuditoria).map((f) => (
                        <div key={f.id} className="bg-white border border-stone-200 rounded-xl px-3 py-2">
                          {(() => { const d = describirAuditoria(f); return (
                            <>
                              <p className="text-xs font-semibold text-stone-800 break-words">{d.titulo}</p>
                              {d.detalle.length > 0 && <p className="text-[11px] text-stone-600 mt-0.5 break-words">{d.detalle.join(' · ')}</p>}
                            </>
                          ); })()}
                          <p className="text-[10px] text-stone-500 mt-0.5">
                            {new Date(f.creado_en).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {f.turnos_abiertos && f.turnos_abiertos.length > 0 ? ` · Turno abierto de: ${f.turnos_abiertos.join(', ')}` : ' · Sin turnos abiertos'}
                          </p>
                        </div>
                      ))}
                      {!cargandoAuditoria && filasAuditoria.length >= 300 && <p className="text-[10px] text-stone-400 text-center">Se muestran los últimos 300 movimientos.</p>}
                    </div>
                  </div>
                </div>
              )}
    </>
  );
}
