// Edge Function: reset-cajero-pin
//
// Resetea el PIN de acceso de un empleado que YA había iniciado sesión
// antes (su cuenta de Supabase Auth ya existe, así que solo cambiar
// usuarios.pin_acceso no alcanza -- la contraseña real de Auth queda
// desincronizada). Esto solo se puede hacer con privilegios de
// administrador (service role), por eso vive en una Edge Function y no
// en el código del navegador.
//
// Cómo desplegarla (una sola vez):
//   1. Panel de Supabase -> Edge Functions -> Create a new function.
//   2. Nombre: reset-cajero-pin
//   3. Pega este código completo y publica/despliega.
//   No hace falta configurar nada más: SUPABASE_URL, SUPABASE_ANON_KEY
//   y SUPABASE_SERVICE_ROLE_KEY ya están disponibles automáticamente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { dni, nuevo_pin } = await req.json();
    if (!dni || !nuevo_pin) {
      return new Response(JSON.stringify({ error: 'Falta dni o nuevo_pin' }), { status: 400, headers: cors });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: cors });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Cliente con el JWT de quien llama, solo para saber quién es.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401, headers: cors });
    }

    // Cliente con privilegios de administrador para las operaciones reales.
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: caller } = await adminClient
      .from('usuarios')
      .select('bodega_id, rol')
      .eq('auth_id', callerUser.id)
      .single();

    if (!caller || (caller.rol !== 'dueno' && caller.rol !== 'administrador')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: cors });
    }

    const { data: objetivo } = await adminClient
      .from('usuarios')
      .select('id, auth_id')
      .eq('dni', dni)
      .eq('bodega_id', caller.bodega_id)
      .single();

    if (!objetivo) {
      return new Response(JSON.stringify({ error: 'Empleado no encontrado en tu bodega' }), { status: 404, headers: cors });
    }

    const nuevaPassword = `kst-${String(nuevo_pin).trim()}`;

    if (objetivo.auth_id) {
      const { error: updErr } = await adminClient.auth.admin.updateUserById(objetivo.auth_id, {
        password: nuevaPassword,
      });
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: cors });
      }
    }

    await adminClient.from('usuarios').update({ pin_acceso: String(nuevo_pin).trim() }).eq('id', objetivo.id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
});
