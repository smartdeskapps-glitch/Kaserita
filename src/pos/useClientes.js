// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { mensajeError, exportarExcel, asegurarJsPDF, formatoSoles, asegurarConfetti } from './utilidades.js';

export default function useClientes({
  bodegaId, bodegaNombre, boletasPendientesDeuda, busquedaClientePOS, cajeroSeleccionado,
  cargarPagosRecientes, clienteActual, clienteEditando, clientesLista, deudorSeleccionado,
  esModoDemo, formEditarCliente, montoAbonoDeuda, notificar, obtenerOCrearCliente,
  recargarDeudores, sbClient, setBoletasDeudor, setBusquedaClientePOS, setCargandoClientes,
  setCargandoDetalleDeudor, setClienteActual, setClienteEditando, setClientesLista,
  setConfirmandoPagoDeudor, setDeudorSeleccionado, setDniCliente, setFormEditarCliente,
  setGuardandoEdicionCliente, setModalBuscarCliente, setMontoAbonoDeuda,
  setMostrarHistorialCompletoDeuda, setPagoRegistrado, setPagosRecientes
}) {
  // ==========================================
  // CLIENTES (editar, exportar; se usan desde Fiados)
  // ==========================================
  // Abre el selector de cliente del POS: muestra la lista completa para
  // elegir con un toque, en vez de pedir escribir el DNI a ciegas.
  const abrirBuscarClientePOS = async () => {
    setBusquedaClientePOS('');
    setModalBuscarCliente(true);
    if (!sbClient || !bodegaId) return;
    setCargandoClientes(true);
    try {
      const { data, error } = await sbClient
        .from('clientes')
        .select('*')
        .eq('bodega_id', bodegaId)
        .order('nombre_completo', { ascending: true });
      if (error) throw error;
      setClientesLista(data || []);
    } catch (err) {
      notificar(mensajeError(err, 'No se pudo cargar la lista de clientes'), 'error');
    } finally {
      setCargandoClientes(false);
    }
  };

  const clientesFiltradosPOS = () => {
    const t = busquedaClientePOS.trim().toLowerCase();
    if (!t) return clientesLista;
    return clientesLista.filter(
      (c) => (c.nombre_completo || '').toLowerCase().includes(t) || (c.dni || '').includes(t)
    );
  };

  const seleccionarClientePOS = async (c) => {
    setDniCliente(c.dni);
    setModalBuscarCliente(false);
    if (c.id) {
      // Cliente real, ya viene de la base de datos.
      setClienteActual(c);
    } else {
      // "Cliente sin registrar": es un objeto local sin id todavía
      // (nunca se guardó en la BD). Se busca/crea su fila real, igual
      // que al escribir el DNI a mano, para que la venta pueda
      // registrarse (ventas.cliente_id no admite NULL).
      await obtenerOCrearCliente(c.dni);
    }
  };

  const exportarClientesExcel = () => {
    const filas = clientesLista.map((c) => ({
      DNI: c.dni,
      Nombre: c.nombre_completo,
      'Teléfono': c.telefono || '',
      Correo: c.correo || '',
      'Limite de Credito': Number(c.limite_credito || 0),
      'Saldo Actual (Deuda)': Number(c.saldo_actual || 0)
    }));
    exportarExcel(`Clientes_${bodegaNombre}.xlsx`, filas, 'Clientes');
  };

  const abrirEdicionCliente = (cliente) => {
    setClienteEditando(cliente);
    setFormEditarCliente({
      nombre_completo: cliente.nombre_completo || '',
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
      limite_credito: cliente.limite_credito != null ? String(cliente.limite_credito) : '0',
      dias_credito: cliente.dias_credito != null ? String(cliente.dias_credito) : '30'
    });
  };

  const guardarEdicionCliente = async () => {
    if (!clienteEditando || !formEditarCliente) return;
    if (!formEditarCliente.nombre_completo.trim()) {
      notificar('El nombre es obligatorio.', 'error');
      return;
    }
    setGuardandoEdicionCliente(true);
    try {
      const payload = {
        nombre_completo: formEditarCliente.nombre_completo.trim(),
        telefono: formEditarCliente.telefono.trim() || null,
        correo: formEditarCliente.correo.trim() || null,
        limite_credito: Number(formEditarCliente.limite_credito) || 0,
        dias_credito: Number(formEditarCliente.dias_credito) || 30
      };
      if (sbClient && !esModoDemo) {
        const { error } = await sbClient.from('clientes').update(payload).eq('id', clienteEditando.id);
        if (error) throw error;
      }
      setClientesLista((prev) => prev.map((c) => (c.id === clienteEditando.id ? { ...c, ...payload } : c)));
      // La ficha de Fiados sigue abierta: se actualiza con los datos nuevos.
      setDeudorSeleccionado((prev) => (prev && prev.id === clienteEditando.id ? { ...prev, ...payload } : prev));
      setClienteEditando((prev) => (prev ? { ...prev, ...payload } : prev));
      notificar('Cliente actualizado.', 'success');
    } catch (err) {
      notificar(mensajeError(err, 'Error al guardar'), 'error');
    } finally {
      setGuardandoEdicionCliente(false);
    }
  };

  // Al elegir un deudor, cargar el detalle de sus boletas a crédito pendientes
  const seleccionarDeudor = async (cliente) => {
    setPagoRegistrado(null);
    setDeudorSeleccionado(cliente);
    setMontoAbonoDeuda(Number(cliente.saldo_actual).toFixed(2));
    setConfirmandoPagoDeudor(false);
    setBoletasDeudor([]);
    setMostrarHistorialCompletoDeuda(false);
    setPagosRecientes([]);
    if (!sbClient) return;
    cargarPagosRecientes(cliente);
    setCargandoDetalleDeudor(true);
    try {
      const { data, error } = await sbClient
        .from('ventas')
        .select('*, ventas_detalle(*, productos(descripcion, unidad))')
        .eq('cliente_id', cliente.id)
        .eq('medio_pago', 'CREDITO')
        .eq('anulada', false)
        .order('fecha_hora', { ascending: false });
      if (error) throw error;
      setBoletasDeudor(data || []);
    } catch (err) {
      console.warn('Error al cargar boletas del deudor:', err.message);
    } finally {
      setCargandoDetalleDeudor(false);
    }
  };

  // Genera el PDF de estado de cuenta en el propio navegador (sin backend).
  // Formato formal: membrete, resumen de la cuenta, antigüedad del saldo
  // por tramos y detalle de boletas, todo en Helvetica y un solo color.
  const generarPDFEstadoCuenta = async (cliente, boletas) => {
    await asegurarJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const M = 15;
    const R = 195;
    const OSCURO = [43, 10, 99];
    const MORADO = [97, 5, 220];
    const GRIS = [110, 110, 120];
    const LINEA = [221, 221, 221];
    const FONDO = [243, 240, 248];
    const RIESGO = [180, 35, 24];
    const colorTexto = (c) => doc.setTextColor(c[0], c[1], c[2]);
    const colorLinea = (c) => doc.setDrawColor(c[0], c[1], c[2]);
    const colorRelleno = (c) => doc.setFillColor(c[0], c[1], c[2]);

    const hoy = new Date();
    const ordenadas = [...boletas].sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
    const filas = ordenadas.map((b) => {
      const fecha = new Date(b.fecha_hora);
      const items = (b.ventas_detalle || []).map((d) => `${d.cantidad} x ${d.productos?.descripcion || 'Producto'}`);
      return {
        nro: b.nro_boleta,
        fecha: fecha.toLocaleDateString('es-PE'),
        dias: Math.max(0, Math.floor((hoy - fecha) / 86400000)),
        items: items.length ? items : ['Sin detalle disponible'],
        total: Number(b.total_venta) || 0,
      };
    });
    const sumaBoletas = filas.reduce((a, f) => a + f.total, 0);
    const saldo = Number(cliente.saldo_actual) || 0;
    const limite = Number(cliente.limite_credito) || 0;
    // Si el cliente ya hizo pagos a cuenta, el saldo es menor que la suma
    // de las boletas: se muestra la diferencia como línea aparte.
    const pagosACuenta = sumaBoletas - saldo;
    const hayPagos = pagosACuenta > 0.005;

    // ---- Membrete ----
    colorTexto(OSCURO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(String(bodegaNombre || '').toUpperCase(), M, 20);
    colorTexto(GRIS);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('KASERITA · ESTADO DE CUENTA DE CLIENTES', M, 25);
    colorTexto([34, 34, 34]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('ESTADO DE CUENTA', R, 20, { align: 'right' });
    colorTexto(GRIS);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Emitido el ${hoy.toLocaleDateString('es-PE')}, ${hoy.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`, R, 25, { align: 'right' });
    colorLinea(OSCURO);
    doc.setLineWidth(0.9);
    doc.line(M, 29, R, 29);

    const titulo = (txt, x, y, ancho) => {
      colorTexto(MORADO);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(txt.toUpperCase(), x, y);
      colorLinea(LINEA);
      doc.setLineWidth(0.25);
      doc.line(x, y + 1.6, x + ancho, y + 1.6);
    };

    // ---- Cliente y resumen ----
    let y = 39;
    titulo('Cliente', M, y, 88);
    titulo('Resumen de la cuenta', 111, y, R - 111);
    colorTexto([34, 34, 34]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(String(cliente.nombre_completo || ''), M, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    colorTexto([70, 70, 70]);
    doc.text(`DNI ${cliente.dni || '-'}`, M, y + 14);
    if (cliente.telefono) doc.text(`Teléfono ${cliente.telefono}`, M, y + 19);

    const resumen = [];
    if (limite > 0) resumen.push(['Límite de crédito', `S/ ${formatoSoles(limite)}`]);
    resumen.push(['Boletas pendientes', String(filas.length)]);
    if (filas.length) resumen.push(['Boleta más antigua', filas[0].fecha]);
    resumen.push(['Saldo pendiente', `S/ ${formatoSoles(saldo)}`, true]);
    if (limite > 0) resumen.push(['Crédito disponible', `S/ ${formatoSoles(Math.max(0, limite - saldo))}`]);
    let ry = y + 8;
    resumen.forEach(([k, v, fuerte]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      colorTexto(GRIS);
      doc.text(k, 111, ry);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fuerte ? 10.5 : 9);
      colorTexto(fuerte ? OSCURO : [34, 34, 34]);
      doc.text(v, R, ry, { align: 'right' });
      ry += 5.6;
    });
    y = Math.max(y + 24, ry) + 6;

    // ---- Antigüedad del saldo (tramos según los días de cada boleta) ----
    titulo('Antigüedad de las boletas', M, y, R - M);
    y += 6;
    const tramos = [
      { t: '0 - 7', min: 0, max: 7 },
      { t: '8 - 15', min: 8, max: 15 },
      { t: '16 - 30', min: 16, max: 30 },
      { t: 'Más de 30', min: 31, max: Infinity },
    ].map((tr) => ({ ...tr, monto: filas.filter((f) => f.dias >= tr.min && f.dias <= tr.max).reduce((a, f) => a + f.total, 0) }));
    const anchoCol = (R - M - 34) / 5;
    colorRelleno(FONDO);
    doc.rect(M, y, R - M, 7, 'F');
    colorTexto([68, 68, 68]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('DÍAS TRANSCURRIDOS', M + 2, y + 4.7);
    tramos.forEach((tr, i) => doc.text(tr.t.toUpperCase(), M + 34 + anchoCol * (i + 1) - 2, y + 4.7, { align: 'right' }));
    doc.text('TOTAL', R - 2, y + 4.7, { align: 'right' });
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    colorTexto([34, 34, 34]);
    doc.text('Importe (S/)', M + 2, y + 5.5);
    tramos.forEach((tr, i) => {
      const atrasado = tr.min >= 16 && tr.monto > 0;
      doc.setFont('helvetica', atrasado ? 'bold' : 'normal');
      colorTexto(atrasado ? RIESGO : tr.monto === 0 ? [170, 170, 170] : [34, 34, 34]);
      doc.text(formatoSoles(tr.monto), M + 34 + anchoCol * (i + 1) - 2, y + 5.5, { align: 'right' });
    });
    doc.setFont('helvetica', 'bold');
    colorTexto([34, 34, 34]);
    doc.text(formatoSoles(sumaBoletas), R - 2, y + 5.5, { align: 'right' });
    colorLinea(LINEA);
    doc.line(M, y + 8, R, y + 8);
    y += 16;

    // ---- Detalle de boletas ----
    titulo('Detalle de boletas pendientes', M, y, R - M);
    y += 6;
    const cabeceraDetalle = () => {
      colorRelleno(FONDO);
      doc.rect(M, y, R - M, 7, 'F');
      colorTexto([68, 68, 68]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('FECHA', M + 2, y + 4.7);
      doc.text('N.º DE BOLETA', M + 26, y + 4.7);
      doc.text('DESCRIPCIÓN', M + 62, y + 4.7);
      doc.text('DÍAS', R - 32, y + 4.7, { align: 'right' });
      doc.text('IMPORTE (S/)', R - 2, y + 4.7, { align: 'right' });
      y += 7;
    };
    cabeceraDetalle();

    if (filas.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      colorTexto(GRIS);
      doc.text('Sin boletas a crédito registradas.', M + 2, y + 6);
      y += 10;
    }

    filas.forEach((f) => {
      const lineas = doc.splitTextToSize(f.items.join('\n'), 70).flat();
      const alto = Math.max(7.5, lineas.length * 4.2 + 3.5);
      if (y + alto > 262) {
        doc.addPage();
        y = 20;
        cabeceraDetalle();
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      colorTexto([85, 85, 85]);
      doc.text(f.fecha, M + 2, y + 5);
      doc.setFont('helvetica', 'bold');
      colorTexto([34, 34, 34]);
      doc.text(String(f.nro), M + 26, y + 5);
      doc.setFont('helvetica', 'normal');
      colorTexto([85, 85, 85]);
      doc.text(lineas, M + 62, y + 5);
      doc.text(String(f.dias), R - 32, y + 5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      colorTexto([34, 34, 34]);
      doc.text(formatoSoles(f.total), R - 2, y + 5, { align: 'right' });
      colorLinea(LINEA);
      doc.setLineWidth(0.2);
      doc.line(M, y + alto, R, y + alto);
      y += alto;
    });

    // ---- Totales ----
    if (y > 246) { doc.addPage(); y = 20; }
    if (hayPagos) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      colorTexto(GRIS);
      doc.text('Pagos a cuenta', M + 62, y + 6);
      colorTexto([34, 34, 34]);
      doc.text(`- ${formatoSoles(pagosACuenta)}`, R - 2, y + 6, { align: 'right' });
      y += 8;
    }
    colorLinea(OSCURO);
    doc.setLineWidth(0.7);
    doc.line(M, y + 1, R, y + 1);
    doc.setLineWidth(0.25);
    doc.line(M, y + 12, R, y + 12);
    doc.line(M, y + 13, R, y + 13);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    colorTexto(OSCURO);
    doc.text('Total adeudado', M + 2, y + 8);
    doc.text(formatoSoles(saldo), R - 2, y + 8, { align: 'right' });
    y += 24;

    // ---- Nota y saldo a pagar ----
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    colorTexto(GRIS);
    const nota = doc.splitTextToSize('Este documento resume las boletas a crédito pendientes de pago a la fecha de emisión. Si ya realizó un pago que no figura aquí, comuníquese con el negocio para actualizar su cuenta.', 105);
    doc.text(nota, M, y + 4);
    colorLinea(OSCURO);
    doc.setLineWidth(0.5);
    doc.rect(R - 62, y - 2, 62, 17);
    colorTexto(MORADO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text('SALDO TOTAL A PAGAR', R - 4, y + 3.5, { align: 'right' });
    colorTexto(OSCURO);
    doc.setFontSize(15);
    doc.text(`S/ ${formatoSoles(saldo)}`, R - 4, y + 11.5, { align: 'right' });

    // ---- Pie de página en cada hoja ----
    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      colorLinea(LINEA);
      doc.setLineWidth(0.25);
      doc.line(M, 281, R, 281);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      colorTexto([136, 136, 136]);
      doc.text(`${bodegaNombre} · Documento informativo, no tiene valor tributario`, M, 286);
      doc.text(`Página ${i} de ${paginas}`, R, 286, { align: 'right' });
    }

    return doc;
  };

  const descargarEstadoCuenta = async () => {
    if (!deudorSeleccionado) return;
    const doc = await generarPDFEstadoCuenta(deudorSeleccionado, boletasPendientesDeuda);
    doc.save(`Estado_Cuenta_${deudorSeleccionado.dni}.pdf`);
  };

  // Comparte el PDF directo a WhatsApp vía el share nativo del celular (sin API);
  // en desktop, donde no se puede adjuntar archivos así, descarga el PDF y abre
  // WhatsApp Web con el chat listo para adjuntarlo manualmente.
  const enviarEstadoCuentaWhatsApp = async (cliente) => {
    const doc = await generarPDFEstadoCuenta(cliente, boletasPendientesDeuda);
    const nombreArchivo = `Estado_Cuenta_${cliente.dni}.pdf`;
    const blob = doc.output('blob');

    try {
      const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        await navigator.share({
          files: [archivo],
          title: 'Estado de Cuenta',
          text: `Estado de cuenta de ${cliente.nombre_completo} - ${bodegaNombre}`
        });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return; // el cajero canceló el share
      console.warn('No se pudo compartir directamente, usando alternativa:', err.message);
    }

    doc.save(nombreArchivo);
    const soloNumeros = (cliente.telefono || '').replace(/\D/g, '');
    const telConCodigo = soloNumeros.length === 9 ? `51${soloNumeros}` : soloNumeros;
    const mensaje = encodeURIComponent(
      `Hola ${cliente.nombre_completo}, te comparto tu estado de cuenta de ${bodegaNombre}. Adjunta el PDF que se acaba de descargar. Total adeudado: S/ ${Number(cliente.saldo_actual).toFixed(2)}`
    );
    const urlWhatsapp = telConCodigo ? `https://wa.me/${telConCodigo}?text=${mensaje}` : `https://wa.me/?text=${mensaje}`;
    window.open(urlWhatsapp, '_blank');
    notificar('Se descargó el PDF. Adjúntalo manualmente en el chat de WhatsApp que se abrió.', 'info');
  };

  const procesarPagoDeudaCliente = async () => {
    if (!deudorSeleccionado) return;
    const abono = parseFloat(montoAbonoDeuda) || 0;
    if (abono <= 0) {
      notificar('Ingresa un monto de abono mayor a 0.', 'error');
      return;
    }

    const saldoAnterior = Number(deudorSeleccionado.saldo_actual) || 0;
    if (abono > saldoAnterior + 0.004) {
      notificar('El monto es mayor que la deuda. Ajústalo al saldo del cliente.', 'error');
      return;
    }
    let nuevoSaldo = Math.max(0, +(saldoAnterior - abono).toFixed(2));

    if (sbClient && !esModoDemo) {
      try {
        // Ajuste atómico (RPC): si otro dispositivo también le está
        // cobrando/vendiendo a este mismo cliente en este instante, los
        // dos cambios se aplican uno tras otro sin pisarse.
        const { data: saldoRpc, error: errSaldo } = await sbClient.rpc('ajustar_saldo_cliente', {
          p_cliente_id: deudorSeleccionado.id,
          p_delta: -abono
        });

        if (errSaldo) {
          console.warn('Error al actualizar el saldo del cliente:', errSaldo);
          notificar(`No se pudo registrar el pago en el servidor. Avisa al soporte.`, 'error');
          return;
        }
        if (saldoRpc != null) nuevoSaldo = Number(saldoRpc);

        const { error: errPago } = await sbClient.from('pagos_credito').insert([{
          bodega_id: bodegaId,
          cliente_id: deudorSeleccionado.id,
          cajero_id: cajeroSeleccionado?.id || null,
          monto_pagado: abono,
          boletas_canceladas: `Saldo anterior: S/ ${saldoAnterior.toFixed(2)} → Saldo restante: S/ ${nuevoSaldo.toFixed(2)}`,
          fecha: new Date().toISOString()
        }]);
        if (errPago) console.warn('No se pudo registrar el historial de pago:', errPago.message);
      } catch (err) {
        console.error(err);
        notificar(mensajeError(err, 'No se pudo registrar el pago'), 'error');
        return;
      }
    }

    // Lanzar Confeti -- puramente decorativo, así que no se espera a que
    // cargue (no debe demorar el resto del flujo) y si falla se ignora.
    asegurarConfetti().then(() => confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })).catch(() => {});

    // La lista de Fiados se actualiza al toque; con servidor, además se vuelve a leer de fondo.
    setClientesLista((prev) => prev.map((c) => (c.id === deudorSeleccionado.id ? { ...c, saldo_actual: nuevoSaldo } : c)));
    if (esModoDemo) {
      if (clienteActual?.id === deudorSeleccionado.id) {
        setClienteActual((prev) => (prev ? { ...prev, saldo_actual: nuevoSaldo } : prev));
      }
    }

    notificar(`¡Pago de S/ ${abono.toFixed(2)} registrado! Saldo restante: S/ ${nuevoSaldo.toFixed(2)}`, 'success');
    setMontoAbonoDeuda('');
    setBoletasDeudor([]);
    // Se muestra "Pago registrado" con el cliente aún elegido.
    setPagoRegistrado({ id: deudorSeleccionado.id, nombre: deudorSeleccionado.nombre_completo, abono, antes: saldoAnterior, despues: nuevoSaldo });
    if (!esModoDemo) recargarDeudores();
  };

  return {
    abrirBuscarClientePOS, abrirEdicionCliente, clientesFiltradosPOS, descargarEstadoCuenta,
    enviarEstadoCuentaWhatsApp, exportarClientesExcel, guardarEdicionCliente,
    procesarPagoDeudaCliente, seleccionarClientePOS, seleccionarDeudor
  };
}
