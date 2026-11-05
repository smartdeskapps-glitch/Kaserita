// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { formatoFechaHoraBoleta, mensajeError } from './utilidades.js';
import { detalleComboTicket } from '../lib/combos.js';

export default function useImpresoraBluetooth({
  bodegaDireccion, bodegaNombre, bodegaTelefono, notificar
}) {
  // ==========================================
  // IMPRESIÓN DIRECTA POR BLUETOOTH (ticketera térmica)
  // ==========================================
  // Servicios GATT que usan la mayoría de ticketeras térmicas Bluetooth
  // BLE "genéricas" (las comunes de 58/80mm que se compran sueltas, no
  // de marca). Si la impresora usa un chip distinto puede que no
  // aparezca un canal de escritura -- es un protocolo no estandarizado.
  const SERVICIOS_IMPRESORA_BLUETOOTH = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455'
  ];

  // Quita tildes/ñ: la mayoría de estas impresoras solo entienden la
  // página de código básica (ASCII/CP437) y muestran símbolos raros
  // con acentos si se les manda UTF-8 tal cual.
  const aTextoImprimible = (s) => (s || '').normalize('NFD').replace(/[^\x00-\x7F]/g, '');

  // Arma el ticket en comandos ESC/POS crudos (texto + alineación +
  // negrita), igual de angosto que el PDF/ticket impreso y con el mismo orden.
  const construirTicketEscPos = (venta) => {
    const bytes = [];
    const cmd = (...arr) => bytes.push(...arr);
    const texto = (s) => { for (const ch of aTextoImprimible(s)) bytes.push(ch.charCodeAt(0) & 0xFF); };
    const salto = (n = 1) => { for (let i = 0; i < n; i++) bytes.push(0x0A); };
    const ANCHO = 32; // caracteres por línea en una ticketera de 58mm
    const lineaPunteada = () => { texto('- '.repeat(ANCHO / 2)); salto(); };
    // Dos columnas: texto a la izquierda y valor pegado a la derecha.
    const dosColumnas = (izq, der) => {
      const i = aTextoImprimible(izq), d = aTextoImprimible(der);
      texto(i + ' '.repeat(Math.max(1, ANCHO - i.length - d.length)) + d); salto();
    };
    const recibido = Number(venta.recibido) || 0;
    const unidades = (venta.items || []).reduce((a, it) => a + (Number(it.cantidad) || 0), 0);

    cmd(0x1B, 0x40); // inicializar
    cmd(0x1B, 0x61, 0x01); // centrado
    cmd(0x1B, 0x45, 0x01); // negrita on
    texto(bodegaNombre); salto();
    cmd(0x1B, 0x45, 0x00); // negrita off
    if (bodegaDireccion) { texto(bodegaDireccion.slice(0, ANCHO)); salto(); }
    if (bodegaTelefono) { texto(`Tel. ${bodegaTelefono}`); salto(); }
    cmd(0x1B, 0x45, 0x01);
    texto('Gracias por su compra!'); salto();
    cmd(0x1B, 0x45, 0x00);
    texto('Tu boleta se emitio correctamente'); salto();
    cmd(0x1B, 0x61, 0x00); // izquierda
    lineaPunteada();
    dosColumnas('BOLETA', String(venta.nro_boleta));
    dosColumnas('FECHA Y HORA', formatoFechaHoraBoleta(venta.fecha_hora));
    texto(`Cliente: ${venta.cliente}`.slice(0, ANCHO)); salto();
    if (venta.cajero) { texto(`Atendido por: ${venta.cajero}`.slice(0, ANCHO)); salto(); }
    lineaPunteada();

    // Tabla: CANT PRODUCTO ... IMPORTE
    dosColumnas('CANT PRODUCTO', 'IMPORTE');
    (venta.items || []).forEach((it) => {
      const importe = Number(it.subtotal).toFixed(2);
      const nombre = aTextoImprimible(it.descripcion).slice(0, ANCHO - 4 - importe.length - 1);
      dosColumnas(`${String(it.cantidad).padEnd(3)} ${nombre}`, importe);
      texto(`    ${Number(it.precioUnitario || 0).toFixed(2)} c/u`); salto();
      detalleComboTicket(it).forEach((l) => { texto('    - ' + l.slice(0, ANCHO - 6)); salto(); });
    });

    lineaPunteada();
    texto(`${unidades} ${unidades === 1 ? 'articulo' : 'articulos'}`); salto();
    if (venta.descuento > 0) {
      dosColumnas('Subtotal', `S/ ${venta.subtotal.toFixed(2)}`);
      dosColumnas('Descuento', `-S/ ${venta.descuento.toFixed(2)}`);
    }
    cmd(0x1B, 0x45, 0x01);
    dosColumnas('MONTO', `S/ ${venta.total_venta.toFixed(2)}`);
    cmd(0x1B, 0x45, 0x00);
    dosColumnas('Pago', String(venta.medio_pago || ''));
    if (recibido > 0) {
      dosColumnas('Recibido', `S/ ${recibido.toFixed(2)}`);
      dosColumnas('Vuelto', `S/ ${(recibido >= Number(venta.total_venta) ? recibido - Number(venta.total_venta) : 0).toFixed(2)}`);
    }
    lineaPunteada();

    cmd(0x1B, 0x61, 0x01);
    texto('Documento sin valor tributario.'); salto();
    texto('Solo informativo.'); salto(4);

    return new Uint8Array(bytes);
  };

  const imprimirBoletaBluetooth = async (venta) => {
    if (!navigator.bluetooth) {
      notificar('Este navegador no soporta impresión Bluetooth. Usa Chrome en Android o en una PC con Bluetooth.', 'error');
      return;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: SERVICIOS_IMPRESORA_BLUETOOTH
      });
      const server = await device.gatt.connect();
      const servicios = await server.getPrimaryServices();

      let caracteristica = null;
      for (const servicio of servicios) {
        const chars = await servicio.getCharacteristics();
        caracteristica = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse) || caracteristica;
        if (caracteristica) break;
      }
      if (!caracteristica) {
        notificar('No se encontró un canal de impresión en ese dispositivo. Puede que no sea compatible.', 'error');
        return;
      }

      const datos = construirTicketEscPos(venta);
      const TAMANO_BLOQUE = 20; // BLE suele limitar el tamaño por escritura
      for (let i = 0; i < datos.length; i += TAMANO_BLOQUE) {
        const bloque = datos.slice(i, i + TAMANO_BLOQUE);
        if (caracteristica.properties.writeWithoutResponse) {
          await caracteristica.writeValueWithoutResponse(bloque);
        } else {
          await caracteristica.writeValue(bloque);
        }
        await new Promise((r) => setTimeout(r, 30));
      }
      notificar('Boleta enviada a la impresora Bluetooth.', 'success');
    } catch (err) {
      if (err?.name === 'NotFoundError') return; // el cajero canceló la selección
      console.warn(err);
      notificar(mensajeError(err, 'No se pudo imprimir por Bluetooth'), 'error');
    }
  };


  return {
    imprimirBoletaBluetooth
  };
}
