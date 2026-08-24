import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const usernameToAuthEmail=(username:string)=>{const u=username.trim().toLowerCase();if(u.includes("@"))return u;return `${u.replace(/[^a-z0-9._+-]/g,"_")}@users.sirro.net`;};

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Método no permitido"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey=Deno.env.get("RESEND_API_KEY");
    const from=Deno.env.get("SIRRO_EMAIL_FROM");
    if(!resendKey||!from)return json({error:"Servicio de correo pendiente de configuración"},503);
    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    if(!token)return json({error:"No autorizado"},401);
    const authClient=createClient(url,anon,{auth:{persistSession:false}});
    const {data:userData,error:userErr}=await authClient.auth.getUser(token);
    if(userErr||!userData.user)return json({error:"Sesión inválida"},401);
    const admin=createClient(url,service,{auth:{persistSession:false}});
    const {data:actor}=await admin.from("perfiles").select("id,rol,estado").eq("id",userData.user.id).maybeSingle();
    if(!actor||actor.rol!=="ADMIN_REGIONAL"||actor.estado!=="ACTIVO")return json({error:"Solo el Administrador Regional activo puede restablecer accesos"},403);
    const body=await req.json();
    const targetId=String(body.user_id||"");
    const {data:target}=await admin.from("perfiles").select("id,nombre_completo,correo").eq("id",targetId).maybeSingle();
    if(!target)return json({error:"Usuario no encontrado"},404);
    const {data:appUser}=await admin.from("sirro_app_users").select("username").eq("auth_user_id",targetId).maybeSingle();
    if(!appUser?.username)return json({error:"El usuario no tiene nombre de acceso configurado"},400);
    const authEmail=usernameToAuthEmail(appUser.username);
    const {data:linkData,error:linkErr}=await admin.auth.admin.generateLink({type:"recovery",email:authEmail,options:{redirectTo:"https://sirro-central.vercel.app"}});
    if(linkErr||!linkData?.properties?.action_link)return json({error:"No se pudo generar el enlace de recuperación"},500);
    const safeName=String(target.nombre_completo||"Usuario").replace(/[<>&]/g,"");
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${resendKey}`},body:JSON.stringify({from,to:[target.correo],subject:"SIRRO · Restablecimiento de acceso",html:`<div style="font-family:Arial,sans-serif;color:#17312b"><h2>Restablecimiento de acceso SIRRO</h2><p>Hola ${safeName}.</p><p>El Administrador Regional solicitó restablecer su acceso a SIRRO.</p><p><a href="${linkData.properties.action_link}" style="background:#0b6b57;color:white;padding:10px 16px;border-radius:8px;text-decoration:none">Crear nueva contraseña</a></p><p style="color:#607a74;font-size:12px">El Administrador Regional no puede ver ni conocer su nueva contraseña.</p><p style="color:#607a74;font-size:12px"><strong>Este es un mensaje automático. No contestar este correo.</strong></p></div>`})});
    if(!response.ok)return json({error:`No se pudo enviar el correo de recuperación (${response.status})`},502);
    await admin.from("auditoria").insert({usuario_id:actor.id,accion:"SOLICITAR_RESTABLECIMIENTO_ACCESO",tabla:"perfiles",registro_id:targetId,datos_anteriores:null,datos_nuevos:{destinatario:target.correo},motivo:"Restablecimiento administrativo de acceso solicitado"});
    return json({ok:true});
  }catch(e){return json({error:e instanceof Error?e.message:"No se pudo restablecer el acceso"},500);}
});