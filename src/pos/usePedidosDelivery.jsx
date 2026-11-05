// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
// "tarde": valores que el POS declara después de este hook; se leen solo dentro de
// funciones y efectos (cuando ya están completos).
import { mensajeError, urlMapa, sonarAvisoPedidoNuevo } from './utilidades.js';
import { IconoTrazo } from './componentes.jsx';
import { comprimirImagenJPEG } from '../PanelAdminCompartido.jsx';
import { useRef, useEffect } from 'react';

export default function usePedidosDelivery({
  bodegaId, carrito, combos, costoEnvioDelivery, deliveryHabilitado, direccionDelivery,
  domicilioHabilitado, esModoDemo, horarioDelivery, logoUrlDelivery, modalDelivery,
  notificar, pedidoMinimoDelivery, pedidosCargadosAlCarrito, pedidosRetirar,
  pedirConfirmacion, productos, resumenAvisos, sbClient, seccionesDelivery, sesion,
  setCargandoPedidosRetirar, setCarrito, setCostoEnvioDelivery, setDeliveryHabilitado,
  setDescuentoTipo, setDescuentoValor, setDireccionDelivery, setDomicilioHabilitado,
  setEnviandoAviso, setGuardandoDelivery, setHorarioDelivery, setLogoUrlDelivery,
  setMarcandoListoId, setModalDelivery, setModalPedidosRetirar, setMostrarPago,
  setMostrarResumenMobile, setPedidoMinimoDelivery, setPedidosCargadosAlCarrito,
  setPedidosRetirar, setProcesandoPedidoRetirarId, setResumenAvisos, setSeccionesDelivery,
  setSesion, setSlugDelivery, setSubiendoLogoDelivery, setTelefonoDeliveryEditar,
  setWhatsappRepartidor, setZonaRepartoDelivery, slugDelivery, telefonoDeliveryEditar,
  whatsappRepartidor, zonaRepartoDelivery, tarde
}) {
  // ==========================================
  // LINK DE PEDIDOS (KaseritaDelivery): vitrina pública de la bodega
  // ==========================================
  const normalizarSlugDelivery = (texto) =>
    (texto || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '');

  const cargarResumenAvisos = async () => {
    if (esModoDemo || !sbClient) { setResumenAvisos(null); return; }
    try {
      const { data, error } = await sbClient.rpc('resumen_avisos_clientes');
      if (error) throw error;
      const fila = Array.isArray(data) ? data[0] : data;
      setResumenAvisos(fila ? { audiencia: Number(fila.audiencia) || 0, proximo: fila.proximo_envio || null } : null);
    } catch (err) {
      // Todavía no se corrió migration_34 (o no hay permiso): la tarjeta simplemente no se muestra.
      setResumenAvisos(null);
    }
  };

  const avisarAMisClientes = async () => {
    const n = resumenAvisos?.audiencia || 0;
    const ok = await pedirConfirmacion({
      titulo: 'Avisar a tus clientes',
      mensaje: `Se enviará una notificación a ${n} cliente${n === 1 ? '' : 's'}: "¡${sesion?.bodega?.nombre || 'Tu negocio'} ya recibe pedidos!". Solo puedes hacerlo una vez por semana. ¿Enviar ahora?`,
      textoBoton: 'Sí, avisar',
    });
    if (!ok) return;
    setEnviandoAviso(true);
    try {
      const { data, error } = await sbClient.rpc('avisar_a_mis_clientes');
      if (error) throw error;
      notificar(`Aviso en camino a ${data} cliente${data === 1 ? '' : 's'}.`, 'success');
      await cargarResumenAvisos();
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo enviar el aviso.'), 'error');
    } finally {
      setEnviandoAviso(false);
    }
  };

  // --- Pantalla "Mi link de pedidos": estado en vivo, resúmenes y cambios sin guardar ---
  const DIAS_DELIVERY = [[1, 'Lu'], [2, 'Ma'], [3, 'Mi'], [4, 'Ju'], [5, 'Vi'], [6, 'Sá'], [0, 'Do']];
  const aNumeroDelivery = (t) => Math.max(0, parseFloat(String(t ?? '').replace(',', '.')) || 0);
  const rangoHorarioDelivery = (h) => Object.values(h || {}).find((v) => v?.abierto) || null;
  const estadoHorarioDelivery = (h) => {
    if (!rangoHorarioDelivery(h)) return null;
    const hoy = h?.[new Date().getDay()];
    const ahora = new Date().toTimeString().slice(0, 5);
    let abierto = false;
    if (hoy?.abierto && hoy.desde && hoy.hasta) {
      abierto = hoy.hasta > hoy.desde ? ahora >= hoy.desde && ahora < hoy.hasta : ahora >= hoy.desde || ahora < hoy.hasta;
    }
    return abierto ? { abierto: true, texto: `Abierta ahora · hasta ${hoy.hasta}` } : { abierto: false, texto: 'Cerrada ahora' };
  };
  const resumenHorarioDelivery = (h) => {
    const rango = rangoHorarioDelivery(h);
    if (!rango) return 'Sin horario';
    const dias = DIAS_DELIVERY.filter(([d]) => h[d]?.abierto).map(([, l]) => l);
    return `${dias.length === 7 ? 'Todos los días' : dias.join(' ')} · ${rango.desde} a ${rango.hasta}`;
  };
  const huellaHorarioDelivery = (h) => DIAS_DELIVERY.map(([d]) => (h?.[d]?.abierto ? [h[d].desde, h[d].hasta] : null));
  // Compara lo que hay en pantalla con lo ya guardado en la bodega, para avisar de cambios sin guardar.
  const hayCambiosDelivery = (() => {
    if (!modalDelivery) return false;
    const b0 = sesion?.bodega || {};
    const esDueno = sesion?.usuario?.rol === 'dueno';
    const actual = [
      deliveryHabilitado, logoUrlDelivery || '', direccionDelivery.trim(), domicilioHabilitado,
      aNumeroDelivery(costoEnvioDelivery), aNumeroDelivery(pedidoMinimoDelivery), zonaRepartoDelivery.trim(),
      whatsappRepartidor.replace(/\D/g, ''), esDueno ? telefonoDeliveryEditar.trim() : '', huellaHorarioDelivery(horarioDelivery),
    ];
    const guardado = [
      !!b0.delivery_habilitado, b0.logo_url || '', (b0.direccion || '').trim(), !!b0.delivery_domicilio,
      aNumeroDelivery(b0.costo_envio), aNumeroDelivery(b0.pedido_minimo), (b0.zona_reparto || '').trim(),
      (b0.whatsapp_repartidor || '').replace(/\D/g, ''), esDueno ? (sesion?.usuario?.telefono || '').trim() : '', huellaHorarioDelivery(b0.horario_atencion),
    ];
    return JSON.stringify(actual) !== JSON.stringify(guardado);
  })();
  const estadoHorarioActualDelivery = modalDelivery ? estadoHorarioDelivery(horarioDelivery) : null;
  const resumenEntregaDelivery = domicilioHabilitado
    ? `Activa · ${aNumeroDelivery(costoEnvioDelivery) > 0 ? `S/ ${aNumeroDelivery(costoEnvioDelivery).toFixed(2)}` : 'Envío gratis'}${aNumeroDelivery(pedidoMinimoDelivery) > 0 ? ` · mín. S/ ${aNumeroDelivery(pedidoMinimoDelivery)}` : ''}${zonaRepartoDelivery.trim() ? ` · ${zonaRepartoDelivery.trim()}` : ''}`
    : 'Desactivada';
  // Una sección que se abre y se cierra, con un resumen visible cuando está cerrada.
  // `chip` (opcional) = { texto, tono: 'ok' | 'aviso' | 'apagado' }: el estado de la sección sin abrirla.
  const seccionDelivery = (id, icono, titulo, resumen, hijos, chip) => {
    const abierta = !!seccionesDelivery[id];
    return (
      <div className={`rounded-[22px] mb-2.5 overflow-hidden ${id === 'avisos' ? 'bg-[#2d284b] text-white' : 'bg-[#f3f5ff] text-stone-900'}`}>
        <button
          type="button"
          aria-expanded={abierta}
          onClick={() => setSeccionesDelivery((s) => ({ ...s, [id]: !s[id] }))}
          className="w-full flex items-center gap-3 p-3.5 text-left"
        >
          <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${id === 'avisos' ? 'bg-white/15 text-white' : 'bg-white text-[#5b4bd6] shadow-[0_2px_6px_-2px_rgba(45,40,75,0.2)]'}`}>
            <IconoTrazo nombre={icono} className="w-[18px] h-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold leading-tight">{titulo}</span>
            <span className={`block text-xs mt-0.5 truncate ${id === 'avisos' ? 'text-white/65' : 'text-stone-500'}`}>{resumen}</span>
          </span>
          {chip && (
            <span className={`shrink-0 text-[10.5px] font-extrabold rounded-full px-2.5 py-0.5 ${id === 'avisos' ? 'bg-white/15 text-white' : chip.tono === 'ok' ? 'bg-[#e3f6ea] text-[#157a40]' : chip.tono === 'aviso' ? 'bg-[#fff1d6] text-[#9a5b04]' : 'bg-white text-[#8f8cb0]'}`}>{chip.texto}</span>
          )}
          <i className={`fa-solid fa-chevron-down text-xs text-stone-400 transition-transform ${abierta ? 'rotate-180' : ''}`}></i>
        </button>
        {abierta && <div className="mx-2 mb-2 rounded-2xl bg-white text-stone-900 p-3.5 space-y-3.5">{hijos}</div>}
      </div>
    );
  };

  const abrirModalDelivery = () => {
    cargarResumenAvisos();
    setSlugDelivery(sesion?.bodega?.slug || normalizarSlugDelivery(sesion?.bodega?.nombre));
    setDeliveryHabilitado(!!sesion?.bodega?.delivery_habilitado);
    setLogoUrlDelivery(sesion?.bodega?.logo_url || '');
    setDireccionDelivery(sesion?.bodega?.direccion || '');
    setDomicilioHabilitado(!!sesion?.bodega?.delivery_domicilio);
    setCostoEnvioDelivery(sesion?.bodega?.costo_envio != null ? String(Number(sesion.bodega.costo_envio)) : '');
    setPedidoMinimoDelivery(sesion?.bodega?.pedido_minimo != null ? String(Number(sesion.bodega.pedido_minimo)) : '');
    setZonaRepartoDelivery(sesion?.bodega?.zona_reparto || '');
    setWhatsappRepartidor(sesion?.bodega?.whatsapp_repartidor || '');
    setTelefonoDeliveryEditar(sesion?.usuario?.rol === 'dueno' ? (sesion?.usuario?.telefono || '') : '');
    setHorarioDelivery({
      0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
      ...(sesion?.bodega?.horario_atencion || {}),
    });
    setModalDelivery(true);
  };

  // Logo (cuadrado, chico) y portada (rectangular, más grande) de la
  // vitrina pública -- van en el mismo bucket "Productos" que ya se usa
  // para fotos de producto, en su propia carpeta por bodega, con
  // upsert para que "cambiar la foto" sea simplemente subir de nuevo
  // sobre el mismo archivo.
  const subirLogoDelivery = async (file) => {
    setSubiendoLogoDelivery(true);
    try {
      const comprimida = await comprimirImagenJPEG(file, 25, 320);
      // La política RLS de storage.objects exige que el primer segmento
      // de la ruta sea el bodega_id (mismo esquema que las fotos de
      // producto) -- de paso, así el borrado de bodega (que barre todo
      // "{bodega_id}/*") también se lleva estas dos imágenes.
      const ruta = `${bodegaId}/delivery-logo.jpg`;
      const { error } = await sbClient.storage
        .from('Productos')
        .upload(ruta, comprimida, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = sbClient.storage.from('Productos').getPublicUrl(ruta);
      setLogoUrlDelivery(`${data.publicUrl}?t=${Date.now()}`);
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo subir el logo'), 'error');
    } finally {
      setSubiendoLogoDelivery(false);
    }
  };

  const guardarConfigDelivery = async () => {
    if (!esModoDemo && (!sbClient || !bodegaId)) {
      notificar('No se pudo guardar los cambios.', 'error');
      return;
    }
    const slugLimpio = normalizarSlugDelivery(slugDelivery);
    if (deliveryHabilitado && !slugLimpio) {
      notificar('Elige un link antes de mostrar tu tienda al público.', 'error');
      return;
    }
    if (slugLimpio && slugLimpio.length < 3) {
      notificar('El link debe tener al menos 3 letras o números.', 'error');
      return;
    }
    const aNumero = (t) => Math.max(0, parseFloat(String(t).replace(',', '.')) || 0);
    const costoEnvioNum = aNumero(costoEnvioDelivery);
    const pedidoMinimoNum = aNumero(pedidoMinimoDelivery);
    const whatsappRepartidorLimpio = whatsappRepartidor.replace(/\D/g, '');
    if (whatsappRepartidorLimpio && (whatsappRepartidorLimpio.length < 7 || whatsappRepartidorLimpio.length > 15)) {
      notificar('El WhatsApp del repartidor no es válido.', 'error');
      return;
    }
    setGuardandoDelivery(true);
    try {
      const telefonoLimpio = telefonoDeliveryEditar.trim();
      if (esModoDemo) {
        // Modo Demo Local: no hay bodega real en Supabase -- se aplica
        // directo en memoria, igual que el resto de la demo.
      } else {
        // Primero la entrega a domicilio y después el catálogo: si se activan las dos
        // a la vez, sale un solo aviso a los clientes ("ya recibe pedidos") que ya
        // menciona el delivery. Solo se llama si algo de la entrega cambió -- así
        // guardar el resto del link no depende de esta función.
        const b0 = sesion?.bodega || {};
        const cambioDomicilio =
          domicilioHabilitado !== !!b0.delivery_domicilio ||
          costoEnvioNum !== Number(b0.costo_envio || 0) ||
          pedidoMinimoNum !== Number(b0.pedido_minimo || 0) ||
          zonaRepartoDelivery.trim() !== (b0.zona_reparto || '') ||
          whatsappRepartidorLimpio !== (b0.whatsapp_repartidor || '');
        if (cambioDomicilio) {
          const { error: errDomicilio } = await sbClient.rpc('actualizar_mi_entrega_domicilio', {
            p_habilitado: domicilioHabilitado,
            p_costo_envio: costoEnvioNum,
            p_pedido_minimo: pedidoMinimoNum,
            p_zona: zonaRepartoDelivery.trim() || null,
            p_whatsapp_repartidor: whatsappRepartidorLimpio || null,
          });
          if (errDomicilio) throw errDomicilio;
        }
        // El dueño no puede actualizar bodegas directo (RLS solo lo permite
        // al super-admin) -- esta función security definer es el único
        // camino, y de paso respeta si el admin le dio delivery_permitido.
        const { error: errBodega } = await sbClient.rpc('actualizar_mi_delivery', {
          p_slug: slugLimpio || null,
          p_delivery_habilitado: deliveryHabilitado,
          p_logo_url: logoUrlDelivery || null,
          p_direccion: direccionDelivery.trim() || null,
          p_horario_atencion: horarioDelivery,
        });
        if (errBodega) {
          if (errBodega.code === '23505') throw new Error('Ese link ya lo usa otra tienda. Escribe a soporte de Kaserita para que te asignen otro.');
          throw errBodega;
        }
        if (sesion?.usuario?.rol === 'dueno' && telefonoLimpio !== (sesion?.usuario?.telefono || '')) {
          const { error: errTelefono } = await sbClient
            .from('usuarios')
            .update({ telefono: telefonoLimpio || null })
            .eq('id', sesion.usuario.id);
          if (errTelefono) throw errTelefono;
        }
      }
      setSesion((s) => ({
        ...s,
        bodega: {
          ...s.bodega,
          slug: slugLimpio,
          delivery_habilitado: deliveryHabilitado,
          logo_url: logoUrlDelivery || null,
          banner_url: null,
          direccion: direccionDelivery.trim() || null,
          horario_atencion: horarioDelivery,
          delivery_domicilio: domicilioHabilitado,
          costo_envio: costoEnvioNum,
          pedido_minimo: pedidoMinimoNum,
          zona_reparto: zonaRepartoDelivery.trim() || null,
          whatsapp_repartidor: whatsappRepartidorLimpio || null,
        },
        usuario: s.usuario?.rol === 'dueno' ? { ...s.usuario, telefono: telefonoLimpio || null } : s.usuario,
      }));
      setSlugDelivery(slugLimpio);
      notificar('Listo, tu link de pedidos quedó actualizado.', 'success');
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo guardar los cambios.'), 'error');
    } finally {
      setGuardandoDelivery(false);
    }
  };

  const cargarPedidosRetirar = async () => {
    if (esModoDemo || !sbClient) return;
    setCargandoPedidosRetirar(true);
    try {
      // Trae también "retirado"/"cancelado" (no solo la cola activa) para
      // poder mostrar la pestaña "Historial" con su filtro de fecha --
      // 200 alcanza de sobra para "últimos 30 días" en una bodega chica,
      // no hace falta el histórico completo acá.
      const { data, error } = await sbClient
        .from('pedidos_seguimiento')
        .select('*')
        // Solo los de esta bodega: si el dueño también compra como cliente
        // con la misma cuenta, sus pedidos de otras tiendas no deben verse acá.
        .eq('bodega_id', sesion.bodega.id)
        .order('creado_en', { ascending: false })
        .limit(200);
      if (error) throw error;
      setPedidosRetirar(data || []);
    } catch (err) {
      notificar(mensajeError(err, 'No se pudieron cargar los pedidos por retirar.'), 'error');
    } finally {
      setCargandoPedidosRetirar(false);
    }
  };

  const marcarPedidoListo = async (id) => {
    setMarcandoListoId(id);
    try {
      const { error } = await sbClient.rpc('marcar_pedido_listo', { p_id: id });
      if (error) throw error;
      setPedidosRetirar((prev) => prev.map((p) => (p.id === id ? { ...p, estado: 'listo' } : p)));
      notificar('Pedido marcado como listo. El cliente ya lo puede ver.', 'success');
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo marcar el pedido.'), 'error');
    } finally {
      setMarcandoListoId(null);
    }
  };

  // Pedido a domicilio: pasa a "en camino" (el cliente lo ve en su celular).
  const marcarPedidoEnCamino = async (id) => {
    setProcesandoPedidoRetirarId(id);
    try {
      const { error } = await sbClient.rpc('marcar_pedido_en_camino', { p_id: id });
      if (error) throw error;
      setPedidosRetirar((prev) => prev.map((p) => (p.id === id ? { ...p, estado: 'en_camino' } : p)));
      notificar('Pedido en camino. El cliente ya lo ve así.', 'success');
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo marcar el pedido.'), 'error');
    } finally {
      setProcesandoPedidoRetirarId(null);
    }
  };

  // Productos que forman un combo de un pedido de delivery, con la
  // cantidad total a preparar (por combo × combos pedidos). Los pedidos
  // nuevos traen el desglose guardado (migration_40); los anteriores lo
  // toman del combo tal como está ahora.
  const desgloseComboPedido = (it) => {
    if (!it?.combo_id) return [];
    const base = Array.isArray(it.componentes)
      ? it.componentes
      : (combos.find((c) => c.id === it.combo_id)?.combos_items || []).map((ci) => ({
          descripcion: ci.productos?.descripcion,
          cantidad: ci.cantidad,
        }));
    return base
      .filter((c) => c.descripcion)
      .map((c) => ({ descripcion: c.descripcion, cantidad: Number(c.cantidad || 0) * Number(it.cantidad || 0) }));
  };

  // Abre WhatsApp con el pedido ya armado (referencia, teléfono, monto a
  // cobrar y el enlace de la ubicación) para mandárselo al repartidor. Si
  // el negocio guardó el número de su repartidor va directo a ese chat;
  // si no, WhatsApp deja elegir el contacto.
  const enviarPedidoAlRepartidor = (p) => {
    const envio = Number(p.costo_envio || 0);
    const subtotal = (p.items || []).reduce((acc, it) => acc + Number(it.cantidad || 0) * Number(it.precio_venta || 0), 0);
    const total = subtotal + envio;
    const medio = { efectivo: 'efectivo', yape_plin: 'Yape / Plin', tarjeta: 'tarjeta' }[p.medio_pago] || p.medio_pago || '';
    const pagaCon = Number(p.paga_con || 0);
    const lineas = (p.items || []).flatMap((it) => [
      `${it.cantidad}x ${it.descripcion}`,
      ...desgloseComboPedido(it).map((c) => `   - ${c.cantidad}x ${c.descripcion}`),
    ]);
    const mensaje = [
      `Pedido a domicilio · ${p.codigo_corto}`,
      `Cliente: ${p.cliente_nombre || '-'} · ${p.telefono_contacto || '-'}`,
      `Referencia: ${p.entrega_referencia || '-'}`,
      '',
      ...lineas,
      '',
      `Cobrar S/ ${total.toFixed(2)}${medio ? ` en ${medio}` : ''}${p.medio_pago === 'efectivo' && pagaCon > 0 ? ` (paga con S/ ${pagaCon.toFixed(2)}, vuelto S/ ${Math.max(0, pagaCon - total).toFixed(2)})` : ''}`,
      '',
      `Ubicación: ${urlMapa(p.entrega_lat, p.entrega_lng) || '(sin ubicación)'}`,
    ].join('\n');
    const tel = (sesion?.bodega?.whatsapp_repartidor || '').replace(/\D/g, '');
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener,noreferrer');
  };

  // Carga directo al carrito del POS un pedido de "Pedidos por retirar",
  // sin tener que ir a buscarlo de nuevo por código en "Cargar Pedido".
  // Items ya vienen validados (los reconstruyó el trigger al crearse el
  // pedido), así que se agregan tal cual. El seguimiento NO se cierra
  // acá -- si se cerrara al cargar al carrito, un cajero que carga el
  // pedido y después no llega a cobrar (se distrae, el cliente se
  // arrepiente, se vacía el carrito) lo pierde igual, ya marcado como
  // entregado sin haberlo cobrado. Se queda "vinculado" y se cierra de
  // verdad recién cuando handleCobrar termina la venta con éxito.
  const cargarPedidoDesdeRetirar = async (pedido) => {
    if (pedidosCargadosAlCarrito.some((p) => p.id === pedido.id)) {
      notificar('Ese pedido ya está en el carrito: cóbralo para completarlo.', 'info');
      return;
    }
    setProcesandoPedidoRetirarId(pedido.id);
    try {
      // Si ya había una venta en curso en el carrito, se aparca primero
      // (igual que el botón "Pausar") -- el pedido de delivery pasa
      // adelante en vez de mezclarse con lo que se estaba cobrando.
      if (carrito.length > 0) {
        tarde.aparcarVentaActual();
      }
      let agregados = 0;
      (pedido.items || []).forEach((it) => {
        if (it.combo_id) {
          const combo = combos.find((c) => c.id === it.combo_id);
          if (combo) {
            tarde.agregarComboAlCarrito(combo, it.cantidad);
            agregados++;
          } else {
            notificar(`"${it.descripcion}" ya no está disponible, no se agregó.`, 'error');
          }
          return;
        }
        const prod = productos.find((p) => p.id === it.id);
        if (prod) {
          tarde.agregarAlCarrito(prod, it.cantidad);
          agregados++;
        } else {
          notificar(`"${it.descripcion}" ya no está en tu inventario, no se agregó.`, 'error');
        }
      });
      if (agregados > 0) {
        setPedidosCargadosAlCarrito((prev) => [...prev, { id: pedido.id, codigoCorto: pedido.codigo_corto }]);
        const envioPedido = Number(pedido.costo_envio || 0);
        notificar(
          pedido.tipo_entrega === 'domicilio' && envioPedido > 0
            ? `Pedido ${pedido.codigo_corto} agregado al carrito. Recuerda cobrar aparte S/ ${envioPedido.toFixed(2)} de envío (no está en el carrito).`
            : `Pedido ${pedido.codigo_corto} agregado al carrito. Se cierra solo cuando cobres.`,
          'success'
        );
        // Vuelve a la vista normal del carrito para que se vea de una
        // vez lo que se acaba de cargar, en vez de dejar al cajero
        // todavía parado en la pantalla de "Pedidos por retirar".
        setModalPedidosRetirar(false);
        setMostrarResumenMobile(true);
      }
    } finally {
      setProcesandoPedidoRetirarId(null);
    }
  };

  // Para cuando el cliente ya pasó y pagó por otra vía (no por
  // "Cargar Pedido") -- solo cierra el seguimiento, no toca el carrito.
  // Cierra el pedido de una, sin poder volver a "Marcar listo" ni
  // "Al carrito" después -- por eso pide confirmación, igual que
  // eliminarPedidoRetirar, para que no se marque por error un pedido
  // que en realidad no se cobró.
  const marcarRetiradoDirecto = async (pedido) => {
    const ok = await pedirConfirmacion({
      titulo: 'Confirmar retiro',
      mensaje: `¿El pedido ${pedido.codigo_corto} ya se cobró y el cliente ya se lo llevó? Esto lo cierra sin pasar por el carrito.`,
      textoBoton: 'Sí, ya retiró',
    });
    if (!ok) return;
    setProcesandoPedidoRetirarId(pedido.id);
    try {
      const { error } = await sbClient.rpc('marcar_pedido_retirado', { p_codigo_corto: pedido.codigo_corto });
      if (error) throw error;
      setPedidosRetirar((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, estado: 'retirado' } : p)));
      // Los productos de este pedido ya se cobraron y entregaron: si seguían
      // en el carrito, un cobro por descuido los vendería dos veces. Solo se
      // vacía cuando el carrito es exactamente este pedido (si hay otro
      // pedido cargado, sus productos están mezclados y no se separan).
      const soloEste = pedidosCargadosAlCarrito.length === 1 && pedidosCargadosAlCarrito[0].id === pedido.id;
      if (soloEste) {
        setPedidosCargadosAlCarrito([]);
        setCarrito([]);
        setDescuentoTipo(null);
        setDescuentoValor('');
        setMostrarPago(false);
        tarde.reiniciarClienteYMedioPago();
      } else if (pedidosCargadosAlCarrito.some((c) => c.id === pedido.id)) {
        setPedidosCargadosAlCarrito((prev) => prev.filter((c) => c.id !== pedido.id));
        notificar('Quita del carrito los productos de este pedido: ya se entregaron.', 'info');
      }
      notificar(`Pedido ${pedido.codigo_corto} marcado como retirado.`, 'success');
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo marcar el pedido.'), 'error');
    } finally {
      setProcesandoPedidoRetirarId(null);
    }
  };

  // Para pedidos viejos que quedaron colgados (el cliente nunca vino a
  // buscarlo). No se borra la fila -- queda como "cancelado" en el
  // historial -- pero desaparece de esta cola.
  const eliminarPedidoRetirar = async (pedido) => {
    const ok = await pedirConfirmacion({
      titulo: 'Eliminar pedido de la cola',
      mensaje: `¿Eliminar el pedido ${pedido.codigo_corto} de la cola? El cliente ya no lo va a ver como pendiente.`,
      textoBoton: 'Eliminar',
      peligroso: true,
    });
    if (!ok) return;
    setProcesandoPedidoRetirarId(pedido.id);
    // Para que el aviso en vivo (más abajo) no lo anuncie como
    // "el cliente canceló" si el evento llega antes que esta respuesta.
    canceladosDesdeAquiRef.current.add(pedido.id);
    try {
      const { error } = await sbClient.rpc('cancelar_seguimiento_pedido', { p_id: pedido.id });
      if (error) throw error;
      setPedidosRetirar((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, estado: 'cancelado' } : p)));
      notificar(`Pedido ${pedido.codigo_corto} eliminado.`, 'success');
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo eliminar el pedido.'), 'error');
    } finally {
      setProcesandoPedidoRetirarId(null);
    }
  };

  // Aviso en vivo: mientras haya sesión de bodega, escucha si entra un
  // pedido nuevo (Realtime de Supabase, filtrado por RLS a la propia
  // bodega igual que cualquier otra consulta) y suena + avisa, esté o
  // no abierta la pantalla de "Pedidos por retirar". También escucha
  // los cambios de estado: si el cliente cancela desde la tienda, el
  // pedido sale de la cola y del contador de pendientes sin recargar.
  const pedidosRetirarRef = useRef(pedidosRetirar);
  pedidosRetirarRef.current = pedidosRetirar;
  const pedidosCargadosRef = useRef(pedidosCargadosAlCarrito);
  pedidosCargadosRef.current = pedidosCargadosAlCarrito;
  const canceladosDesdeAquiRef = useRef(new Set());
  useEffect(() => {
    if (esModoDemo || !sbClient || !sesion?.bodega?.id) return;
    const canal = sbClient
      .channel(`pedidos-seguimiento-${sesion.bodega.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos_seguimiento', filter: `bodega_id=eq.${sesion.bodega.id}` },
        (payload) => {
          sonarAvisoPedidoNuevo();
          notificar(`Nuevo pedido${payload.new.tipo_entrega === 'domicilio' ? ' a domicilio' : ''}: ${payload.new.codigo_corto}`, 'success');
          setPedidosRetirar((prev) => (prev.some((p) => p.id === payload.new.id) ? prev : [...prev, payload.new]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos_seguimiento', filter: `bodega_id=eq.${sesion.bodega.id}` },
        (payload) => {
          const n = payload.new;
          if (!n?.id) return;
          const antes = pedidosRetirarRef.current.find((p) => p.id === n.id);
          setPedidosRetirar((prev) => prev.map((p) => (p.id === n.id ? { ...p, ...n } : p)));
          if (n.estado !== 'cancelado' || !antes || antes.estado === 'cancelado') return;
          if (canceladosDesdeAquiRef.current.delete(n.id)) return;
          if (pedidosCargadosRef.current.some((c) => c.id === n.id)) {
            // Ya no se cierra al cobrar: el pedido no existe más.
            setPedidosCargadosAlCarrito((prev) => prev.filter((c) => c.id !== n.id));
            notificar(`El cliente canceló el pedido ${n.codigo_corto}, que está en el carrito. Quita esos productos antes de cobrar.`, 'error');
          } else {
            notificar(`El cliente canceló el pedido ${n.codigo_corto}.`, 'info');
          }
        }
      )
      .subscribe();
    return () => { sbClient.removeChannel(canal); };
  }, [esModoDemo, sesion?.bodega?.id]);

  // Carga inicial de "Pedidos por retirar" al abrir sesión -- así el
  // aviso de pendientes ya sale correcto desde el arranque, sin
  // depender de que el cajero abra esa pantalla al menos una vez.
  useEffect(() => {
    if (esModoDemo || !sbClient || !sesion?.bodega?.id) return;
    cargarPedidosRetirar();
  }, [esModoDemo, sesion?.bodega?.id]);

  return {
    DIAS_DELIVERY, abrirModalDelivery, avisarAMisClientes, cargarPedidoDesdeRetirar,
    cargarPedidosRetirar, desgloseComboPedido, eliminarPedidoRetirar, enviarPedidoAlRepartidor,
    estadoHorarioActualDelivery, guardarConfigDelivery, hayCambiosDelivery,
    marcarPedidoEnCamino, marcarPedidoListo, marcarRetiradoDirecto, resumenEntregaDelivery,
    resumenHorarioDelivery, seccionDelivery, subirLogoDelivery
  };
}
