// Reglas puras de la sesión guardada en el equipo (sin navegador ni Supabase,
// para poder probarlas). El arranque de la app está en src/main.jsx.

// Llave con la que supabase-js guarda la sesión: sb-<id del proyecto>-auth-token.
export const claveAuthSupabase = (supabaseUrl) => {
  try {
    return `sb-${new URL(String(supabaseUrl).trim()).hostname.split('.')[0]}-auth-token`;
  } catch (e) {
    return null;
  }
};

// Al abrir la app sin poder comprobar la sesión con internet (red que aún no
// despierta, conexión lenta), se puede abrir con la última sesión conocida de
// este equipo solo si:
//  - Supabase todavía guarda una sesión con su token de renovación, y
//  - esa sesión es de la MISMA cuenta que la copia guardada (no de otra persona).
export const puedeUsarSesionGuardada = (guardadaSupabase, copia) => {
  if (!guardadaSupabase || !guardadaSupabase.refresh_token) return false;
  if (!copia || !copia.usuario || !copia.usuario.auth_id) return false;
  return !!guardadaSupabase.user && guardadaSupabase.user.id === copia.usuario.auth_id;
};

// Pausas (ms) entre los intentos de restaurar la sesión al abrir. Sin internet
// no se reintenta: se pasa directo a la última sesión guardada.
export const PAUSAS_REINTENTO_SESION = [0, 700, 1800, 3500];
export const debeReintentar = (estado, enLinea) => estado === 'error' && enLinea !== false;
