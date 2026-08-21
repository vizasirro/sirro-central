import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const jsonHeaders = { "Content-Type": "application/json" };
const appUrl = "https://sirro-central.vercel.app";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: jsonHeaders });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("SIRRO_EMAIL_FROM");
  if (!resendKey || !from) return new Response(JSON.stringify({ error: "Servicio de correo pendiente de configuración" }), { status: 503, headers: jsonHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: jobs, error } = await admin.rpc("sirro_reclamar_correos_pendientes", { p_limite: 25 });
  if (error) return new Response(JSON.stringify({ error: "No se pudo procesar la cola" }), { status: 500, headers: jsonHeaders });

  let sent = 0;
  for (const job of jobs ?? []) {
    const code = job.codigo_referencia ? `<p><strong>Código de referencia:</strong> ${String(job.codigo_referencia).replace(/[<>&]/g, "")}</p>` : "";
    const html = `<div style="font-family:Arial,sans-serif;color:#17312b"><h2>${job.asunto}</h2>${code}<p>Tiene un aviso administrativo pendiente en SIRRO.</p><p><a href="${appUrl}" style="background:#0b6b57;color:white;padding:10px 16px;border-radius:8px;text-decoration:none">Abrir SIRRO</a></p><p style="color:#607a74;font-size:12px">Por seguridad, este correo no contiene nombres, identidad, diagnóstico ni información clínica.</p><p style="color:#607a74;font-size:12px"><strong>Este es un mensaje automático. No contestar este correo.</strong></p></div>`;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from, to: [job.destinatario], subject: job.asunto, html }),
      });
      if (!response.ok) throw new Error(`Proveedor de correo: ${response.status}`);
      await admin.rpc("sirro_resultado_correo", { p_id: job.id, p_enviado: true, p_error: null });
      sent++;
    } catch (e) {
      await admin.rpc("sirro_resultado_correo", { p_id: job.id, p_enviado: false, p_error: e instanceof Error ? e.message : "Error de envío" });
    }
  }
  return new Response(JSON.stringify({ processed: jobs?.length ?? 0, sent }), { headers: jsonHeaders });
});
