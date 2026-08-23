import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const usernameToAuthEmail=(username:string)=>{const u=username.trim().toLowerCase();if(u.includes("@")) return u;return `${u.replace(/[^a-z0-9._+-]/g,"_")}@users.sirro.net`;};
const strongPassword=(v:string)=>v.length>=12&&/[a-z]/.test(v)&&/[A-Z]/.test(v)&&/[0-9]/.test(v)&&/[^A-Za-z0-9]/.test(v);

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
    const adminClient=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false}});
    const {data:actor,error:actorErr}=await adminClient.from("perfiles").select("id,rol,estado,ecor_id,municipio_id").eq("id",userData.user.id).maybeSingle();
    if(actorErr) return json({error:"No se pudo validar el perfil del usuario"},403);
    if(!actor||actor.estado!=="ACTIVO") return json({error:"Usuario no autorizado"},403);

    const body=await req.json();
    const username=String(body.username||"").trim();
    const password=String(body.password||"");
    const p=body.profile||{};
    if(!/^[A-Za-z0-9._+@-]{3,80}$/.test(username)) throw new Error("Usuario inválido");
    if(!strongPassword(password)) throw new Error("La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo");
    if(!String(p.nombre_completo||"").trim()) throw new Error("Nombre completo obligatorio");
    if(!/^\d{13}$/.test(String(p.identidad||"").trim())) throw new Error("La identidad debe tener 13 dígitos");
    if(!/^\d{8}$/.test(String(p.telefono||"").trim())) throw new Error("El teléfono debe tener 8 dígitos");
    if(!/^\S+@\S+\.\S+$/.test(String(p.correo||"").trim())) throw new Error("Correo inválido");
    if(!String(p.cargo_funcion||"").trim()) throw new Error("Cargo o función obligatorio");
    const allowed=new Set(["ADMIN_REGIONAL","ECOR","JEFE_MUNICIPAL","USUARIO_US","USUARIO_HOSPITAL","AUDITOR_CONSULTA"]);
    if(!allowed.has(String(p.rol||""))) throw new Error("Rol inválido");

    const {data:existingUsername}=await adminClient.from("sirro_app_users").select("auth_user_id").eq("username",username.toLowerCase()).maybeSingle();
    if(existingUsername) throw new Error("Ese nombre de usuario ya existe");

    let est:any=null;
    if(p.establecimiento_id){const {data:estData,error:estErr}=await adminClient.from("establecimientos").select("id,tipo,activo,ecor_id,municipio_id,es_externo_olancho").eq("id",p.establecimiento_id).maybeSingle();if(estErr||!estData||!estData.activo) throw new Error("Establecimiento inexistente o inactivo");est=estData;}
    let ec:any=null;
    if(p.ecor_id){const {data:ecData}=await adminClient.from("ecor").select("id,activo").eq("id",p.ecor_id).maybeSingle();if(!ecData||!ecData.activo) throw new Error("ECOR inexistente o inactivo");ec=ecData;}
    let mun:any=null;
    if(p.municipio_id){const {data:munData}=await adminClient.from("municipios").select("id,activo").eq("id",p.municipio_id).maybeSingle();if(!munData||!munData.activo) throw new Error("Municipio inexistente o inactivo");mun=munData;}

    if(p.rol==="ECOR"&&!ec) throw new Error("Seleccione ECOR");
    if(p.rol==="JEFE_MUNICIPAL"){if(!ec||!mun) throw new Error("Seleccione municipio y ECOR");const {count}=await adminClient.from("establecimientos").select("id",{count:"exact",head:true}).eq("activo",true).eq("tipo","US").eq("ecor_id",p.ecor_id).eq("municipio_id",p.municipio_id);if(!count) throw new Error("El municipio seleccionado no pertenece al ECOR indicado");}
    if(p.rol==="USUARIO_US"){if(!p.ecor_id||!p.municipio_id||!p.establecimiento_id) throw new Error("Seleccione ECOR, municipio y establecimiento");if(!est||est.tipo!=="US") throw new Error("Seleccione una Unidad de Salud válida");if(est.ecor_id!==p.ecor_id||est.municipio_id!==p.municipio_id) throw new Error("La Unidad de Salud no pertenece al ECOR y municipio seleccionados");}
    if(p.rol==="USUARIO_HOSPITAL"){if(!p.establecimiento_id) throw new Error("Seleccione hospital");if(!est||est.tipo!=="HOSPITAL"||est.es_externo_olancho===true) throw new Error("Seleccione uno de los dos hospitales de Olancho");}

    if(actor.rol==="ECOR"){
      const {data:actorEc}=await adminClient.from("ecor").select("puede_crear_usuarios").eq("id",actor.ecor_id).maybeSingle();
      if(!actorEc?.puede_crear_usuarios) return json({error:"La creación de usuarios por este ECOR está deshabilitada"},403);
      if(p.rol!=="USUARIO_US") return json({error:"El ECOR solo puede crear usuarios de Unidad de Salud"},403);
      if(p.ecor_id!==actor.ecor_id) return json({error:"El usuario debe pertenecer al mismo ECOR"},403);
      if(!est||est.ecor_id!==actor.ecor_id) return json({error:"El establecimiento debe pertenecer al mismo ECOR"},403);
    } else if(actor.rol!=="ADMIN_REGIONAL") return json({error:"No autorizado para crear usuarios"},403);

    const authEmail=usernameToAuthEmail(username);
    const {data:created,error:createErr}=await adminClient.auth.admin.createUser({email:authEmail,password,email_confirm:true,user_metadata:{sirro_username:username}});
    if(createErr||!created.user){if(createErr?.message?.toLowerCase().includes("already")) throw new Error("Ese nombre de usuario ya existe");throw createErr||new Error("No se pudo crear el usuario");}
    const uid=created.user.id;
    try{
      const perfil:any={id:uid,nombre_completo:String(p.nombre_completo).trim(),identidad:String(p.identidad).trim(),correo:String(p.correo).trim().toLowerCase(),telefono:String(p.telefono).trim(),cargo_funcion:String(p.cargo_funcion).trim(),rol:p.rol,estado:"ACTIVO",ecor_id:null,municipio_id:null,establecimiento_id:null,notificaciones_activas:p.notificaciones_activas!==false,creado_por:actor.id};
      if(p.rol==="ECOR") perfil.ecor_id=p.ecor_id;
      if(p.rol==="JEFE_MUNICIPAL") perfil.municipio_id=p.municipio_id;
      if(p.rol==="USUARIO_US"){perfil.ecor_id=est.ecor_id;perfil.municipio_id=est.municipio_id;perfil.establecimiento_id=p.establecimiento_id;}
      if(p.rol==="USUARIO_HOSPITAL"){perfil.ecor_id=null;perfil.municipio_id=est.municipio_id;perfil.establecimiento_id=p.establecimiento_id;}
      const {error:profileErr}=await adminClient.from("perfiles").insert(perfil);if(profileErr) throw profileErr;
      if(p.rol==="JEFE_MUNICIPAL"){const {error:jmErr}=await adminClient.from("jefe_municipal_ecor").insert({jefe_municipal_id:uid,ecor_id:p.ecor_id,activo:true,creado_por:actor.id});if(jmErr) throw jmErr;}
      const compat={id:uid,username:username.toLowerCase(),name:perfil.nombre_completo,role:perfil.rol,level:perfil.rol,active:true,ecor_id:p.rol==="ECOR"?p.ecor_id:(p.rol==="JEFE_MUNICIPAL"?p.ecor_id:(p.rol==="USUARIO_US"?est?.ecor_id:null)),municipio_id:p.rol==="JEFE_MUNICIPAL"?p.municipio_id:(p.rol==="USUARIO_US"?est?.municipio_id:(p.rol==="USUARIO_HOSPITAL"?est?.municipio_id:null)),establecimiento_id:perfil.establecimiento_id};
      const {error:appErr}=await adminClient.from("sirro_app_users").insert({auth_user_id:uid,username:username.toLowerCase(),profile:compat,active:true});if(appErr) throw appErr;
      await adminClient.from("login_aliases_sirro").upsert({username:username.toLowerCase(),auth_email:authEmail,activo:true,actualizado_en:new Date().toISOString()},{onConflict:"username"});
      return json({user:{id:uid,username,...perfil}});
    }catch(inner){
      await adminClient.from("jefe_municipal_ecor").delete().eq("jefe_municipal_id",uid);
      await adminClient.from("perfiles").delete().eq("id",uid);
      await adminClient.from("sirro_app_users").delete().eq("auth_user_id",uid);
      await adminClient.from("login_aliases_sirro").delete().eq("username",username.toLowerCase());
      await adminClient.auth.admin.deleteUser(uid);
      throw inner;
    }
  }catch(e){return json({error:e instanceof Error?e.message:String(e)},400);}
});
