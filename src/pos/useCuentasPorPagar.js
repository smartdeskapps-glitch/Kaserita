// Sección del POS extraída de src/main.jsx (hook): mismo código, mismo orden de
// hooks. Recibe lo que usa del resto del POS y devuelve lo que el resto usa.
import { mensajeError, generarUUID } from './utilidades.js';
import { esRucValido, esMontoNoNegativo } from '../lib/validaciones.js';

export default function useCuentasPorPagar({
  bodegaId, esModoDemo, formProveedor, montoMovimientoProveedor, notificar,
  proveedorSeleccionado, sbClient, setFormProveedor, setModalCuentasPagar,
  setModalNuevoProveedor, setMontoMovimientoProveedor, setProveedorSeleccionado,
  setProveedoresLista
}) {
  // ==========================================
  // CUENTAS POR PAGAR (deuda de la bodega con proveedores)
  // ==========================================
  const abrirCuentasPorPagar = async () => {
    setModalCuentasPagar(true);
    setProveedorSeleccionado(null);
    setMontoMovimientoProveedor('');
    if (sbClient && bodegaId) {
      try {
        const { data, error } = await sbClient
          .from('proveedores')
          .select('*')
          .eq('bodega_id', bodegaId)
          .order('saldo_actual', { ascending: false });
        if (error) throw error;
        setProveedoresLista(data || []);
      } catch (err) {
        console.warn(err);
        notificar(mensajeError(err, 'No se pudo cargar los proveedores'), 'error');
      }
    }
  };

  const handleGuardarNuevoProveedor = async (e) => {
    e.preventDefault();
    const { nombre, ruc, telefono, saldoInicial } = formProveedor;
    if (!nombre.trim()) {
      notificar('El nombre del proveedor es obligatorio.', 'error');
      return;
    }
    if (ruc.trim() && !esRucValido(ruc)) {
      notificar('El RUC debe tener 11 dígitos.', 'error');
      return;
    }
    if (!esMontoNoNegativo(saldoInicial)) {
      notificar('La deuda inicial no puede ser negativa.', 'error');
      return;
    }
    const saldo = Math.max(0, Number(saldoInicial) || 0);
    try {
      if (esModoDemo) {
        const local = { id: generarUUID(), bodega_id: bodegaId, nombre: nombre.trim(), ruc: ruc.trim() || null, telefono: telefono.trim() || null, saldo_actual: saldo };
        setProveedoresLista((prev) => [local, ...prev].sort((a, b) => Number(b.saldo_actual) - Number(a.saldo_actual)));
      } else if (sbClient) {
        const { data, error } = await sbClient
          .from('proveedores')
          .insert([{
            bodega_id: bodegaId,
            nombre: nombre.trim(),
            ruc: ruc.trim() || null,
            telefono: telefono.trim() || null,
            saldo_actual: saldo
          }])
          .select()
          .single();
        if (error) throw error;
        setProveedoresLista((prev) => [data, ...prev].sort((a, b) => Number(b.saldo_actual) - Number(a.saldo_actual)));
      }
      setModalNuevoProveedor(false);
      setFormProveedor({ nombre: '', ruc: '', telefono: '', saldoInicial: '' });
      notificar(`Proveedor "${nombre}" registrado.`, 'success');
    } catch (err) {
      notificar(mensajeError(err, 'Error al registrar el proveedor'), 'error');
    }
  };

  // tipo: 'deuda' (recibiste mercadería a crédito, sube lo que debes) o
  // 'pago' (le pagaste al proveedor, baja lo que debes).
  const registrarMovimientoProveedor = async (tipo) => {
    if (!proveedorSeleccionado) return;
    const monto = parseFloat(montoMovimientoProveedor) || 0;
    if (monto <= 0) {
      notificar('Ingresa un monto válido.', 'error');
      return;
    }
    // Ajuste atómico (RPC) en vez de leer-y-escribir: si dos personas
    // registran un movimiento al mismo proveedor casi al mismo
    // tiempo, ninguno de los dos se pierde.
    const delta = tipo === 'pago' ? -monto : monto;

    try {
      let nuevoSaldo = Math.max(0, +((Number(proveedorSeleccionado.saldo_actual) || 0) + delta).toFixed(2));
      if (sbClient && !esModoDemo) {
        const { data, error: errUpdate } = await sbClient.rpc('ajustar_saldo_proveedor', {
          p_proveedor_id: proveedorSeleccionado.id,
          p_delta: delta
        });
        if (errUpdate) throw errUpdate;
        if (data != null) nuevoSaldo = Number(data);

        if (tipo === 'pago') {
          const { error: errPago } = await sbClient
            .from('pagos_proveedor')
            .insert([{ bodega_id: bodegaId, proveedor_id: proveedorSeleccionado.id, monto }]);
          if (errPago) console.warn('No se pudo registrar el historial de pago:', errPago);
        }
      }
      setProveedoresLista((prev) => prev.map((p) => (p.id === proveedorSeleccionado.id ? { ...p, saldo_actual: nuevoSaldo } : p)));
      setProveedorSeleccionado((prev) => ({ ...prev, saldo_actual: nuevoSaldo }));
      setMontoMovimientoProveedor('');
      notificar(
        tipo === 'pago' ? `Pago de S/ ${monto.toFixed(2)} registrado.` : `Se agregó S/ ${monto.toFixed(2)} a la deuda.`,
        'success'
      );
    } catch (err) {
      notificar(mensajeError(err, 'Error al registrar el movimiento'), 'error');
    }
  };

  return {
    abrirCuentasPorPagar, handleGuardarNuevoProveedor, registrarMovimientoProveedor
  };
}
