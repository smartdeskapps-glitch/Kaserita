// Ventanas de administración: cajeros, comisiones/horario/agenda (barbería), Mi link de pedidos, QR, registro de actividad y PIN de cajero.
// Extraído de src/main.jsx: mismo JSX; recibe por props lo que usa del POS.
import React, { Suspense } from 'react';
import { GestionCajeros, ComisionesBarberos, HorarioBarbero, AgendaCitas, DeliveryModal, QRLocal, RegistroActividad, PinCajero } from '../pos/perezosos.js';
import { IconoTrazo } from '../pos/componentes.jsx';
import { KASERITA_DELIVERY_URL } from '../pos/utilidades.js';

export default function VentanasAdministracion({
  DIAS_DELIVERY, abrirHorarioBarbero, ajustarDuracionCita, alternarActivoCajero,
  avisarAMisClientes, barberosConHorario, cajerosGestion, cambiarDiaHorario, cargandoAgenda,
  cargandoAuditoria, cargandoCajerosGestion, cargandoComisiones, cargarAgenda,
  cargarComisiones, citasAgenda, combos, copiarHorarioADias, costoEnvioDelivery,
  deliveryHabilitado, direccionDelivery, domicilioHabilitado, eliminarCajero, enviandoAviso,
  errorAuditoria, esAdmin, esBarberia, esModoDemo, estadoHorarioActualDelivery, fechaAgenda,
  filasAuditoria, filasComisiones, filtroAuditoria, formNuevoCajero, guardandoDelivery,
  guardandoHorario, guardandoNuevoCajero, guardandoPinCajero, guardarComisionBarbero,
  guardarConfigDelivery, guardarHorarioBarbero, guardarPinCajero, hayCambiosDelivery,
  horarioDelivery, linkDeliveryCopiado, logoUrlDelivery, modalAgenda, modalAuditoria,
  modalComisiones, modalDelivery, modalGestionCajeros, modalHorario, modalPinCajero,
  mostrarFormNuevoCajero, mostrarQRDelivery, notificar, nuevoPinCajero, pedidoMinimoDelivery,
  periodoComisiones, productos, registrarNuevoCajeroCompleto, resumenAvisos,
  resumenEntregaDelivery, resumenHorarioDelivery, seccionDelivery, sesion,
  setCostoEnvioDelivery, setDeliveryHabilitado, setDireccionDelivery, setDomicilioHabilitado,
  setFechaAgenda, setFiltroAuditoria, setFormNuevoCajero, setHorarioDelivery,
  setLinkDeliveryCopiado, setModalAgenda, setModalAuditoria, setModalComisiones,
  setModalDelivery, setModalGestionCajeros, setModalHorario, setModalPinCajero,
  setMostrarFormNuevoCajero, setMostrarQRDelivery, setNuevoPinCajero, setPedidoMinimoDelivery,
  setPeriodoComisiones, setTelefonoDeliveryEditar, setWhatsappRepartidor,
  setZonaRepartoDelivery, slugDelivery, subiendoLogoDelivery, subirLogoDelivery,
  telefonoDeliveryEditar, whatsappRepartidor, zonaRepartoDelivery
}) {
  return (
    <>
      {modalGestionCajeros && (
        <Suspense fallback={null}>
          <GestionCajeros
            abrirHorarioBarbero={abrirHorarioBarbero}
            alternarActivoCajero={alternarActivoCajero}
            barberosConHorario={barberosConHorario}
            cajerosGestion={cajerosGestion}
            cargandoCajerosGestion={cargandoCajerosGestion}
            eliminarCajero={eliminarCajero}
            esBarberia={esBarberia}
            formNuevoCajero={formNuevoCajero}
            guardandoNuevoCajero={guardandoNuevoCajero}
            guardarComisionBarbero={guardarComisionBarbero}
            modalGestionCajeros={modalGestionCajeros}
            mostrarFormNuevoCajero={mostrarFormNuevoCajero}
            registrarNuevoCajeroCompleto={registrarNuevoCajeroCompleto}
            setFormNuevoCajero={setFormNuevoCajero}
            setModalGestionCajeros={setModalGestionCajeros}
            setModalPinCajero={setModalPinCajero}
            setMostrarFormNuevoCajero={setMostrarFormNuevoCajero}
            setNuevoPinCajero={setNuevoPinCajero}
          />
        </Suspense>
      )}

      {modalComisiones && esBarberia && (
        <Suspense fallback={null}>
          <ComisionesBarberos
            cargandoComisiones={cargandoComisiones}
            cargarComisiones={cargarComisiones}
            combos={combos}
            esBarberia={esBarberia}
            filasComisiones={filasComisiones}
            modalComisiones={modalComisiones}
            periodoComisiones={periodoComisiones}
            productos={productos}
            setModalComisiones={setModalComisiones}
            setPeriodoComisiones={setPeriodoComisiones}
          />
        </Suspense>
      )}

      {modalHorario && esBarberia && (
        <Suspense fallback={null}>
          <HorarioBarbero
            cambiarDiaHorario={cambiarDiaHorario}
            copiarHorarioADias={copiarHorarioADias}
            esBarberia={esBarberia}
            guardandoHorario={guardandoHorario}
            guardarHorarioBarbero={guardarHorarioBarbero}
            modalHorario={modalHorario}
            setModalHorario={setModalHorario}
          />
        </Suspense>
      )}

      {modalAgenda && esBarberia && (
        <Suspense fallback={null}>
          <AgendaCitas
            ajustarDuracionCita={ajustarDuracionCita}
            cargandoAgenda={cargandoAgenda}
            cargarAgenda={cargarAgenda}
            citasAgenda={citasAgenda}
            esBarberia={esBarberia}
            fechaAgenda={fechaAgenda}
            modalAgenda={modalAgenda}
            setFechaAgenda={setFechaAgenda}
            setModalAgenda={setModalAgenda}
          />
        </Suspense>
      )}

      {modalDelivery && (
        <Suspense fallback={null}>
          <DeliveryModal
            DIAS_DELIVERY={DIAS_DELIVERY}
            IconoTrazo={IconoTrazo}
            KASERITA_DELIVERY_URL={KASERITA_DELIVERY_URL}
            avisarAMisClientes={avisarAMisClientes}
            costoEnvioDelivery={costoEnvioDelivery}
            deliveryHabilitado={deliveryHabilitado}
            direccionDelivery={direccionDelivery}
            domicilioHabilitado={domicilioHabilitado}
            enviandoAviso={enviandoAviso}
            esAdmin={esAdmin}
            estadoHorarioActualDelivery={estadoHorarioActualDelivery}
            guardandoDelivery={guardandoDelivery}
            guardarConfigDelivery={guardarConfigDelivery}
            hayCambiosDelivery={hayCambiosDelivery}
            horarioDelivery={horarioDelivery}
            linkDeliveryCopiado={linkDeliveryCopiado}
            logoUrlDelivery={logoUrlDelivery}
            modalDelivery={modalDelivery}
            notificar={notificar}
            pedidoMinimoDelivery={pedidoMinimoDelivery}
            resumenAvisos={resumenAvisos}
            resumenEntregaDelivery={resumenEntregaDelivery}
            resumenHorarioDelivery={resumenHorarioDelivery}
            seccionDelivery={seccionDelivery}
            sesion={sesion}
            setCostoEnvioDelivery={setCostoEnvioDelivery}
            setDeliveryHabilitado={setDeliveryHabilitado}
            setDireccionDelivery={setDireccionDelivery}
            setDomicilioHabilitado={setDomicilioHabilitado}
            setHorarioDelivery={setHorarioDelivery}
            setLinkDeliveryCopiado={setLinkDeliveryCopiado}
            setModalDelivery={setModalDelivery}
            setMostrarQRDelivery={setMostrarQRDelivery}
            setPedidoMinimoDelivery={setPedidoMinimoDelivery}
            setTelefonoDeliveryEditar={setTelefonoDeliveryEditar}
            setWhatsappRepartidor={setWhatsappRepartidor}
            setZonaRepartoDelivery={setZonaRepartoDelivery}
            slugDelivery={slugDelivery}
            subiendoLogoDelivery={subiendoLogoDelivery}
            subirLogoDelivery={subirLogoDelivery}
            telefonoDeliveryEditar={telefonoDeliveryEditar}
            whatsappRepartidor={whatsappRepartidor}
            zonaRepartoDelivery={zonaRepartoDelivery}
          />
        </Suspense>
      )}

      {/* Modal: QR del link de pedidos en grande, para que el cliente lo escanee desde lejos */}
      {mostrarQRDelivery && sesion?.bodega?.slug && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4"
          onClick={() => setMostrarQRDelivery(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col items-center gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <h3 className="text-sm font-bold text-stone-900">Escanea para pedir</h3>
              <button aria-label="Cerrar" onClick={() => setMostrarQRDelivery(false)} className="text-stone-500 hover:text-stone-900">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <Suspense fallback={null}>
              <QRLocal
                texto={`${KASERITA_DELIVERY_URL}/${sesion.bodega.slug}`}
                alt="QR del link de pedidos"
                className="rounded-lg w-full max-w-[320px] h-auto"
              />
            </Suspense>
            <p className="text-xs text-stone-500 text-center">
              Tus clientes escanean este código con la cámara de su celular para entrar directo a tu tienda en línea.
            </p>
          </div>
        </div>
      )}

      {modalAuditoria && (
        <Suspense fallback={null}>
          <RegistroActividad
            cargandoAuditoria={cargandoAuditoria}
            errorAuditoria={errorAuditoria}
            esModoDemo={esModoDemo}
            filasAuditoria={filasAuditoria}
            filtroAuditoria={filtroAuditoria}
            modalAuditoria={modalAuditoria}
            productos={productos}
            setFiltroAuditoria={setFiltroAuditoria}
            setModalAuditoria={setModalAuditoria}
          />
        </Suspense>
      )}


      {modalPinCajero && (
        <Suspense fallback={null}>
          <PinCajero
            guardandoPinCajero={guardandoPinCajero}
            guardarPinCajero={guardarPinCajero}
            modalPinCajero={modalPinCajero}
            nuevoPinCajero={nuevoPinCajero}
            setModalPinCajero={setModalPinCajero}
            setNuevoPinCajero={setNuevoPinCajero}
          />
        </Suspense>
      )}
    </>
  );
}
