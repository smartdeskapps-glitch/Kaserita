import { supabase } from '../lib/supabase';

/**
 * SERVICIO DE AUTENTICACIÓN Y GESTIÓN DE USUARIOS / CAJEROS
 * 
 * Estructura de Tablas:
 * - `usuarios`: Cuentas de acceso con PIN (id, bodega_id, nombre, dni, pin_acceso, rol, activo)
 * - `cajeros`: Empleados de caja para turnos (id, bodega_id, nombre, dni, rol, activo, creado_en)
 * - `bodegas`: Tiendas / Sucursales (id, nombre, created_at)
 * - `clientes`: Clientes por bodega (id, bodega_id, dni, nombre_completo, saldo_actual)
 */

export const authService = {
  /**
   * 1. Iniciar sesión de usuario (Dueño / Administrador) con DNI y PIN en tabla `usuarios`.
   * @param {Object} params
   * @param {string} params.dni - DNI del usuario.
   * @param {string} params.pin - PIN de acceso.
   * @returns {Promise<{ usuario: Object, bodega: Object }>}
   */
  async iniciarSesionPorDniYPin({ dni, pin }) {
    try {
      const dniLimpio = String(dni || '').trim();
      const pinLimpio = String(pin || '').trim();

      if (!dniLimpio || !pinLimpio) {
        throw new Error('Ingresa tu DNI y tu PIN de acceso.');
      }

      // Buscar en tabla `usuarios`
      const { data: usuario, error: errUser } = await supabase
        .from('usuarios')
        .select('*')
        .eq('dni', dniLimpio)
        .eq('pin_acceso', pinLimpio)
        .eq('activo', true)
        .maybeSingle();

      if (errUser) throw errUser;
      if (!usuario) {
        throw new Error('DNI o PIN incorrecto. Si eres nuevo, regístrate en "Crear Bodega / Dueño".');
      }

      // Obtener datos de la bodega
      let bodega = null;
      if (usuario.bodega_id) {
        const { data: bData } = await supabase
          .from('bodegas')
          .select('*')
          .eq('id', usuario.bodega_id)
          .maybeSingle();
        bodega = bData;
      }

      return {
        usuario,
        bodega: bodega || { id: usuario.bodega_id, nombre: 'Mi Bodega' }
      };
    } catch (error) {
      console.error('Error al iniciar sesión:', error.message);
      throw error;
    }
  },

  /**
   * 2. Registrar nueva bodega, su dueño en `usuarios`, su perfil en `cajeros` y cliente default.
   * @param {Object} params
   * @param {string} params.nombreBodega - Nombre de la bodega.
   * @param {string} params.nombreDueno - Nombre del dueño.
   * @param {string} params.dni - DNI del dueño.
   * @param {string} params.pin - PIN de acceso.
   */
  async registrarNuevaBodegaYDueno({ nombreBodega, nombreDueno, dni, pin }) {
    try {
      if (!nombreBodega?.trim() || !nombreDueno?.trim() || !dni?.trim() || !pin?.trim()) {
        throw new Error('Todos los campos son obligatorios: Nombre de bodega, dueño, DNI y PIN.');
      }

      // A. Crear Bodega
      const { data: bodegaCreada, error: errBodega } = await supabase
        .from('bodegas')
        .insert([{ nombre: nombreBodega.trim() }])
        .select()
        .single();

      if (errBodega) throw errBodega;
      const bodegaId = bodegaCreada.id;

      // B. Crear Usuario con PIN en tabla `usuarios`
      const payloadUsuario = {
        bodega_id: bodegaId,
        nombre: nombreDueno.trim(),
        dni: dni.trim(),
        pin_acceso: String(pin).trim(),
        rol: 'dueno',
        activo: true
      };

      const { data: usuarioCreado, error: errUsuario } = await supabase
        .from('usuarios')
        .insert([payloadUsuario])
        .select()
        .single();

      if (errUsuario) throw errUsuario;

      // C. Crear también como Cajero en tabla `cajeros` para permitirle abrir turnos
      const payloadCajero = {
        bodega_id: bodegaId,
        nombre: nombreDueno.trim(),
        dni: dni.trim(),
        rol: 'dueno',
        activo: true
      };

      const { data: cajeroCreado, error: errCajero } = await supabase
        .from('cajeros')
        .insert([payloadCajero])
        .select()
        .single();

      if (errCajero) {
        console.warn('Aviso: error al registrar en cajeros:', errCajero.message);
      }

      // D. Crear cliente default
      await supabase
        .from('clientes')
        .insert([{
          bodega_id: bodegaId,
          dni: '99999999',
          nombre_completo: 'Desconocido',
          saldo_actual: 0.00
        }]);

      return {
        bodega: bodegaCreada,
        usuario: usuarioCreado,
        cajero: cajeroCreado || payloadCajero
      };
    } catch (error) {
      console.error('Error en registrarNuevaBodegaYDueno:', error);
      throw error;
    }
  },

  /**
   * 3. Registrar un nuevo cajero en la tabla `cajeros`.
   * @param {Object} params
   * @param {string} params.bodegaId - UUID de la bodega.
   * @param {string} params.nombre - Nombre del cajero.
   * @param {string} params.dni - DNI del cajero.
   * @param {string} [params.rol] - 'cajero' o 'dueno'.
   * @returns {Promise<Object>} Cajero creado en `cajeros`.
   */
  async registrarNuevoCajero({ bodegaId, nombre, dni, rol = 'cajero' }) {
    try {
      if (!bodegaId || !nombre?.trim() || !dni?.trim()) {
        throw new Error('Todos los campos son obligatorios: Nombre y DNI del cajero.');
      }

      const payload = {
        bodega_id: bodegaId,
        nombre: nombre.trim(),
        dni: dni.trim(),
        rol: rol || 'cajero',
        activo: true
      };

      const { data: cajeroCreado, error } = await supabase
        .from('cajeros')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return cajeroCreado;
    } catch (error) {
      console.error('Error en registrarNuevoCajero:', error);
      throw error;
    }
  },

  /**
   * 4. Listar todos los cajeros de la tabla `cajeros` para una bodega.
   * @param {string} bodegaId
   * @returns {Promise<Array>} Lista de cajeros.
   */
  async listarCajeros(bodegaId) {
    if (!bodegaId) return [];
    try {
      const { data, error } = await supabase
        .from('cajeros')
        .select('*')
        .eq('bodega_id', bodegaId)
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al listar cajeros:', error.message);
      return [];
    }
  }
};
