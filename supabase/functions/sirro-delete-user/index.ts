import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"Método no permitido"},405);
  const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try{
    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    if(!token) return json({error:"No autorizado"},401);
    const authClient=createClient(supabaseUrl,anonKey,{auth:{persistSession:false}});
    const {data:userData,error:userErr}=await authClient.auth.getUser(token);
    if(userErr||!userData.user) return json({error:"Sesión inválida"},401);
    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false}});
    const {data:actor}=await admin.from("perfiles").select("id,rol,estado").eq("id",userData.user.id).maybeSingle();
    if(!actor||actor.estado!=="ACTIVO"||actor.rol!=="ADMIN_REGIONAL") return json({error:"Solo el Administrador Regional puede borrar usuarios"},403);

    const body=await req.json();
    const target=String(body.user_id||"").trim();
    const confirmacion=String(body.confirmacion||"").trim();
    if(!target) throw new Error("Usuario objetivo obligatorio");
    if(confirmacion!=="BORRAR USUARIO") throw new Error("Confirmación inválida");
    if(target===actor.id) throw new Error("No puede borrar su propia cuenta de Administrador Regional");

    const {data:perfil,error:perfilErr}=await admin.from("perfiles").select("id,nombre_completo,rol,correo").eq("id",target).maybeSingle();
    if(perfilErr||!perfil) throw new Error("Usuario no encontrado");
    if(perfil.rol==="ADMIN_REGIONAL") throw new Error("Los usuarios Administrador Regional están protegidos y no pueden borrarse");

    const {data:appRows}=await admin.from("sirro_app_users").select("username").eq("auth_user_id",target);
    const usernames=(appRows||[]).map((r:any)=>r.username).filter(Boolean);
    const {data:authTarget}=await admin.auth.admin.getUserById(target);
    const authEmail=authTarget?.user?.email||null;

    const nullRefs:[string,string][]=[
      ["casos_referencia","creado_por"],["casos_referencia","anulado_por"],
      ["movimientos_referencia","usuario_id"],["notificaciones","usuario_id"],
      ["tramos_referencia","creado_por"],["jefaturas_unidad","usuario_id"],
      ["jefaturas_unidad","autorizado_por"]
    ];
    for(const [table,col] of nullRefs){
      const {error}=await admin.from(table).update({[col]:null}).eq(col,target);
      if(error) throw new Error(`No se pudo liberar ${table}.${col}: ${error.message}`);
    }

    await admin.from("jefe_municipal_ecor").delete().eq("jefe_municipal_id",target);
    await admin.from("preferencias_notificacion_email").delete().eq("usuario_id",target);
    await admin.from("cola_notificaciones_email").delete().eq("usuario_id",target);
    await admin.from("sirro_app_users").delete().eq("auth_user_id",target);
    for(const username of usernames) await admin.from("login_aliases_sirro").delete().eq("username",username);
    if(authEmail) await admin.from("login_aliases_sirro").delete().eq("auth_email",authEmail);

    await admin.from("auditoria").update({usuario_id:null}).eq("usuario_id",target);
    const {error:profileDeleteError}=await admin.from("perfiles").delete().eq("id",target);
    if(profileDeleteError) throw new Error(`No se pudo borrar el perfil: ${profileDeleteError.message}`);
    const {error:delAuthErr}=await admin.auth.admin.deleteUser(target);
    if(delAuthErr) throw delAuthErr;

    await admin.from("auditoria").insert({usuario_id:actor.id,accion:"BORRAR_USUARIO_PRUEBA",tabla:"perfiles",registro_id:target,motivo:`Usuario de prueba eliminado: ${perfil.nombre_completo} (${perfil.rol})`});
    return json({ok:true,user_id:target,nombre:perfil.nombre_completo});
  }catch(e){return json({error:e instanceof Error?e.message:String(e)},400);}
});
