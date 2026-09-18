// Supabase Edge Function: cobrar-plan-culqi
//
// La llama el frontend de /registro (Kaserita/index.html) DESPUÉS de que
// el cliente ya inició sesión con Google -- nunca antes. Cobra con la
// secret key de Culqi (nunca en el navegador) y registra el pago en
// pagos_registro. NO crea la bodega acá -- eso lo hace la función SQL
// crear_bodega_post_pago, en el paso siguiente ("Tu bodega"), ya con el
// nombre/DNI/celular reales.
//
// El monto SIEMPRE se calcula acá adentro, a partir de planes_kaserita y
// del historial real de pagos_registro de esta cuenta -- nunca se confía
// en un monto que mande el navegador (evita que alguien manipule el pago
// y pague de menos).
//
// Deploy manual (mismo mecanismo que enviar-notificacion-pedido-listo,
// ver INSTRUCCIONES_PUSH.md en el repo Kaserita_Delivery):
//   1. Dashboard de Supabase -> Edge Functions -> New Function.
//   2. Nombre exacto: cobrar-plan-culqi
//   3. Pegar el contenido completo de este archivo.
//   4. Deploy.
//   5. Dashboard de Supabase -> Edge Functions -> Secrets -> agregar
//      CULQI_SECRET_KEY con tu secret key de Culqi (la que empieza con
//      sk_test_... o sk_live_...). SUPABASE_URL y
//      SUPABASE_SERVICE_ROLE_KEY ya los da Supabase automáticamente.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CULQI_SECRET_KEY = Deno.env.get("CULQI_SECRET_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respuesta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    // El navegador manda el access token del login con Google en
    // Authorization -- lo usamos para saber quién es, nunca confiamos en
    // un id que venga suelto en el body.
    const authHeader = req.headers.get("Authorization") || "";
    const clienteComoUsuario = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: errUser } = await clienteComoUsuario.auth.getUser();
    if (errUser || !userData?.user) {
      return respuesta({ error: "Iniciá sesión con Google antes de pagar." }, 401);
    }
    const authId = userData.user.id;
    const email = userData.user.email;

    const { culqi_token, plan_id } = await req.json();
    if (!culqi_token || !plan_id) {
      return respuesta({ error: "Faltan datos del pago." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: plan } = await admin
      .from("planes_kaserita")
      .select("*")
      .eq("id", plan_id)
      .eq("activo", true)
      .maybeSingle();
    if (!plan) return respuesta({ error: "Ese plan no existe o ya no está disponible." }, 400);

    if (
      await admin
        .from("usuarios")
        .select("id")
        .eq("auth_id", authId)
        .maybeSingle()
        .then((r) => r.data)
    ) {
      return respuesta({ error: "Esta cuenta ya tiene una bodega creada." }, 400);
    }

    // Precio: si el plan tiene promo y esta cuenta nunca pagó ESTE plan
    // antes, usa el precio promo. No depende de una fecha de calendario
    // -- son los primeros pagos DE ESA CUENTA, no del negocio.
    const { count: pagosPrevios } = await admin
      .from("pagos_registro")
      .select("id", { count: "exact", head: true })
      .eq("auth_id", authId)
      .eq("plan_id", plan_id);

    const usaPromo = plan.precio_soles_promo != null && (pagosPrevios || 0) < (plan.meses_promo || 0);
    const monto = usaPromo ? Number(plan.precio_soles_promo) : Number(plan.precio_soles);
    const montoCentavos = Math.round(monto * 100);

    const culqiResp = await fetch("https://api.culqi.com/v2/charges", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CULQI_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: montoCentavos,
        currency_code: "PEN",
        email,
        source_id: culqi_token,
        description: `Kaserita - ${plan.nombre}`,
      }),
    });
    const culqiData = await culqiResp.json();

    if (!culqiResp.ok) {
      return respuesta(
        { error: culqiData?.user_message || culqiData?.merchant_message || "No se pudo procesar el pago." },
        402
      );
    }

    const { error: errInsert } = await admin.from("pagos_registro").insert({
      auth_id: authId,
      plan_id,
      monto_cobrado: monto,
      culqi_charge_id: culqiData.id,
      estado: "pagado",
    });
    if (errInsert) throw errInsert;

    return respuesta({ ok: true, monto });
  } catch (err) {
    console.error(err);
    return respuesta({ error: "No se pudo procesar el pago. Intentá de nuevo en un momento." }, 500);
  }
});
