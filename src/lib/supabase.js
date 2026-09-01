import { createClient } from '@supabase/supabase-js';

// Obtener las variables de entorno de Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'ADVERTENCIA: Las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no están definidas. Revisa tu archivo .env'
  );
}

// Inicialización del cliente de Supabase
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
