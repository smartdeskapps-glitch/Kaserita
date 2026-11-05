// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { useEffect } from 'react';

export default function useVentasEnEspera({
  carrito, clienteActual, guardarVentasEnEsperaLS, medioPago, mostrarPago, notificar,
  pedidosCargadosAlCarrito, reiniciarClienteYMedioPago, setCarrito, setClienteActual,
  setModalVentasEspera, setMostrarPago, setPedidosCargadosAlCarrito, totalVenta,
  ventasEnEspera
}) {
  // ==========================================
  // VENTAS EN ESPERA (PARK SALES)
  // ==========================================
  // Al vaciar o pausar el carrito con un pedido de delivery cargado, el
  // pedido no se borra: vuelve a su cola. Se avisa para que no parezca
  // perdido.
  const avisarPedidosDevueltos = () => {
    if (pedidosCargadosAlCarrito.length === 0) return;
    const codigos = pedidosCargadosAlCarrito.map((p) => p.codigoCorto).join(', ');
    notificar(
      pedidosCargadosAlCarrito.length === 1
        ? `El pedido ${codigos} no se perdió: sigue en «Pedidos por retirar» para volver a cargarlo.`
        : `Los pedidos ${codigos} no se perdieron: siguen en «Pedidos por retirar» para volver a cargarlos.`,
      'info'
    );
  };

  const aparcarVentaActual = () => {
    if (carrito.length === 0) return;
    avisarPedidosDevueltos();
    const nuevaVentaEspera = {
      id: Date.now(),
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      items: [...carrito],
      total: totalVenta,
      cliente: clienteActual
    };

    const nuevaLista = [...ventasEnEspera, nuevaVentaEspera];
    guardarVentasEnEsperaLS(nuevaLista);
    setCarrito([]);
    setMostrarPago(false);
    reiniciarClienteYMedioPago();
    // Al pausar se desvincula cualquier pedido de "Pedidos por retirar"
    // que estuviera cargado -- sigue disponible en su cola por si esta
    // venta en espera nunca se retoma; si se retoma y cobra más tarde,
    // el pedido se cierra a mano: "Cargar al carrito" y "Confirmar retiro".
    setPedidosCargadosAlCarrito([]);
  };

  // Si el carrito queda vacío por otro camino (quitando los productos uno
  // por uno), el pedido también se desvincula: si no, su tarjeta seguía
  // diciendo "en el carrito" y ya no ofrecía "Cargar al carrito".
  useEffect(() => {
    if (carrito.length === 0 && pedidosCargadosAlCarrito.length > 0) {
      avisarPedidosDevueltos();
      setPedidosCargadosAlCarrito([]);
    }
  }, [carrito.length, pedidosCargadosAlCarrito.length]);

  // En pantallas bajas la barra fija de "Total a cobrar" tapa los campos de
  // monto (Paga con / Monto en tarjeta) y había que adivinar que se podía
  // desplazar. Al elegir Efectivo o Mixto se sube solo ese panel; se mueve
  // el contenedor con scroll y no la página (scrollIntoView podía correrla).
  useEffect(() => {
    if (!mostrarPago || (medioPago !== 'EFECTIVO' && medioPago !== 'MIXTO')) return undefined;
    const t = setTimeout(() => {
      const el = document.querySelector('[data-campo-pago]');
      if (!el) return;
      let cont = el.parentElement;
      while (cont && !(cont.scrollHeight > cont.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(cont).overflowY))) {
        cont = cont.parentElement;
      }
      if (!cont) return;
      const top = el.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop - 8;
      cont.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(t);
  }, [medioPago, mostrarPago]);

  const recuperarVentaEspera = (index) => {
    const v = ventasEnEspera[index];
    if (!v) return;
    const nuevaLista = ventasEnEspera.filter((_, i) => i !== index);
    // Si ya hay productos en el carrito, se ponen en espera antes de
    // recuperar la otra venta, para no perderlos.
    const habiaVentaActual = carrito.length > 0;
    if (habiaVentaActual) {
      nuevaLista.push({
        id: Date.now(),
        hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        items: [...carrito],
        total: totalVenta,
        cliente: clienteActual
      });
      setPedidosCargadosAlCarrito([]);
    }
    setCarrito(v.items);
    if (v.cliente) setClienteActual(v.cliente);
    setMostrarPago(false);
    guardarVentasEnEsperaLS(nuevaLista);
    setModalVentasEspera(false);
  };

  const borrarVentaEspera = (index) => {
    const nuevaLista = ventasEnEspera.filter((_, i) => i !== index);
    guardarVentasEnEsperaLS(nuevaLista);
    notificar('Venta en espera eliminada.', 'info');
  };

  return {
    aparcarVentaActual, avisarPedidosDevueltos, borrarVentaEspera, recuperarVentaEspera
  };
}
