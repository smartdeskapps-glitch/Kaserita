import React from 'react';
import { describirAuditoria } from './lib/auditoria.js';
import VentanaModulo from './VentanaModulo.jsx';

const FILTROS = [['todo', 'Todo'], ['productos', 'Precios y productos'], ['ventas', 'Ventas'], ['turnos_caja', 'Turnos'], ['cajeros', 'Empleados'], ['mermas', 'Mermas'], ['pagos_credito', 'Pagos de clientes'], ['clientes', 'Clientes'], ['usuarios', 'Cuentas']];
const ICONOS = { productos: 'fa-tag', ventas: 'fa-receipt', turnos_caja: 'fa-cash-register', cajeros: 'fa-user', mermas: 'fa-box', pagos_credito: 'fa-hand-holding-dollar', clientes: 'fa-user', usuarios: 'fa-key' };

// Modal separado de main.jsx: se carga al abrirlo (React.lazy). El estado y las acciones
// siguen en PosApp: aquí solo se dibuja lo que recibe por props.
export default function RegistroActividad({
  cargandoAuditoria,
  errorAuditoria,
  esModoDemo,
  filasAuditoria,
  filtroAuditoria,
  modalAuditoria,
  setFiltroAuditoria,
  setModalAuditoria,
}) {
  if (!modalAuditoria) return null;
  const visibles = filasAuditoria.filter((f) => filtroAuditoria === 'todo' || f.tabla === filtroAuditoria);
  const hoy = new Date().toDateString();
  const deHoy = filasAuditoria.filter((f) => new Date(f.creado_en).toDateString() === hoy).length;
  const cerrar = () => setModalAuditoria(false);

  return (
    <VentanaModulo
      icono="fa-clipboard-check"
      titulo="Registro de actividad"
      subtitulo="Cambios de precio, anulaciones, turnos, empleados y mermas"
      cifras={!cargandoAuditoria && !esModoDemo && [{ etiqueta: 'Movimientos de hoy', valor: deHoy }]}
      onClose={cerrar}
      onFondo={cerrar}
      ancho="max-w-2xl"
      z="z-[60]"
      desplazable={false}
    >
      <div className="shrink-0 px-4 sm:px-6 pt-4 pb-2 flex gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTROS.map(([valor, etiqueta]) => (
          <button
            type="button"
            key={valor}
            onClick={() => setFiltroAuditoria(valor)}
            className={`h-[34px] px-3.5 rounded-full text-[12.5px] font-bold whitespace-nowrap transition ${filtroAuditoria === valor ? 'bg-[#2d284b] text-white' : 'bg-[#f3f5ff] text-[#6b6890] hover:bg-[#e6ebff]'}`}
          >
            {etiqueta}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-5 pt-2">
        {esModoDemo && <p className="text-[13px] text-[#8f8cb0] py-6 text-center">El registro de actividad no está disponible en el modo demostración local.</p>}
        {errorAuditoria && <p className="text-[13px] text-[#c0262d] py-2">{errorAuditoria}</p>}
        {cargandoAuditoria && <p className="text-[13px] text-[#8f8cb0] py-6 text-center">Cargando...</p>}
        {!cargandoAuditoria && !errorAuditoria && !esModoDemo && visibles.length === 0 && (
          <p className="text-[13px] text-[#8f8cb0] py-6 text-center">Todavía no hay actividad registrada en esta categoría.</p>
        )}
        <ol>
          {visibles.map((f, i) => {
            const d = describirAuditoria(f);
            return (
              <li key={f.id} className="relative flex gap-3.5 py-2.5">
                {i < visibles.length - 1 && <span className="absolute left-[13px] top-[42px] -bottom-1 w-0.5 bg-[#eef1fd]" aria-hidden="true"></span>}
                <span className="relative w-7 h-7 rounded-full bg-[#f1efff] text-[#5b4bd6] grid place-items-center shrink-0"><i className={`fa-solid ${ICONOS[f.tabla] || 'fa-circle-dot'} text-[11px]`}></i></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#2d284b] break-words">{d.titulo}</p>
                  {d.detalle.length > 0 && <p className="text-xs text-[#6b6890] mt-0.5 break-words">{d.detalle.join(' · ')}</p>}
                  <p className="text-[11.5px] text-[#8f8cb0] mt-0.5">
                    {new Date(f.creado_en).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {f.turnos_abiertos && f.turnos_abiertos.length > 0 ? ` · Turno abierto de: ${f.turnos_abiertos.join(', ')}` : ' · Sin turnos abiertos'}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        {!cargandoAuditoria && filasAuditoria.length >= 300 && <p className="text-[11px] text-[#8f8cb0] text-center pt-2">Se muestran los últimos 300 movimientos.</p>}
      </div>
    </VentanaModulo>
  );
}
