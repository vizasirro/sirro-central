import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "https://sirro-central.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  if (req.method !== "POST") return respond({ error: "Metodo no permitido" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return respond({ error: "No autorizado" }, 401);

  const { data: profile } = await userClient
    .from("perfiles")
    .select("rol,estado")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.rol !== "ADMIN_REGIONAL" || profile?.estado !== "ACTIVO") {
    return respond({ error: "Acceso reservado al Administrador Regional activo" }, 403);
  }

  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const recipient = Deno.env.get("WHATSAPP_TEST_RECIPIENT") ?? "";

  if (!accessToken || !/^\d+$/.test(phoneNumberId) || !/^\d{8,15}$/.test(recipient)) {
    return respond({ error: "Configuracion de WhatsApp incompleta" }, 503);
  }

  const metaResponse = await fetch(
    "https://graph.facebook.com/v25.0/" + phoneNumberId + "/messages",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: "hello_world",
          language: { code: "en_US" },
        },
      }),
    },
  );

  const metaBody = await metaResponse.json().catch(() => ({}));
  if (!metaResponse.ok) {
    console.error("Meta WhatsApp test failed", metaResponse.status, metaBody);
    return respond({
      error: "Meta no acepto el mensaje de prueba",
      provider_status: metaResponse.status,
      provider_code: metaBody?.error?.code ?? null,
    }, 502);
  }

  return respond({
    ok: true,
    message_id: metaBody?.messages?.[0]?.id ?? null,
    note: "Prueba sin datos de pacientes",
  });
});
