const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cfg=window.SIRRO_CONFIG||{};
let sb=null,currentUser=null,profile=null,establishments=[],municipios=[],ecors=[];
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmt=x=>x?new Date(x).toLocaleString('es-HN'):'';
function msg(id,t,bad=false){const e=$(id); if(e){e.textContent=t;e.style.color=bad?'#a12626':''}}
function emailForUsername(u){return u.includes('@')?u:`${u.toLowerCase()}@sirro.local`;}
async function init(){
 if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_ANON_KEY.includes('PEGAR_AQUI')){msg('#loginMsg','Falta colocar la clave pública de Supabase en config.js.',true);return;}
 sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 const {data:{session}}=await sb.auth.getSession(); if(session) await enter(session.user);
}
async function login(){
 msg('#loginMsg','Ingresando…'); const username=$('#loginUser').value.trim(),password=$('#loginPass').value;
 if(!username||!password)return msg('#loginMsg','Escriba usuario y contraseña.',true);
 const {data,error}=await sb.auth.signInWithPassword({email:emailForUsername(username),password});
 if(error)return msg('#loginMsg','Usuario o contraseña incorrectos.',true); await enter(data.user);
}
async function enter(user){
 currentUser=user; const {data,error}=await sb.from('perfiles').select('*').eq('id',user.id).single();
 if(error||!data){await sb.auth.signOut();return msg('#loginMsg','El usuario no tiene perfil SIRRO activo.',true)}
 profile=data; if(profile.estado!=='ACTIVO'){await sb.auth.signOut();return msg('#loginMsg','Usuario no activo: '+profile.estado,true)}
 $('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');$('#logoutBtn').classList.remove('hidden');
 $('#userName').textContent=profile.nombre_completo;$('#userMeta').textContent=profile.rol;
 await loadCatalogs(); configureTabs(); installUniversalReferenceSearch(); await refreshAll();
}
async function loadCatalogs(){
 let r=await sb.from('establecimientos').select('*').eq('activo',true).order('nombre');establishments=r.data||[];
 r=await sb.from('municipios').select('*').eq('activo',true);municipios=r.data||[];
 r=await sb.from('ecor').select('*').eq('activo',true);ecors=r.data||[];
}
function configureTabs(){
 const clinical=['USUARIO_US','USUARIO_HOSPITAL'].includes(profile.rol);
 $('button[data-tab="nueva"]').classList.toggle('hidden',!clinical||!profile.establecimiento_id);
 $('button[data-tab="usuarios"]').classList.toggle('hidden',profile.rol!=='ADMIN_REGIONAL');
 $('button[data-tab="auditoria"]').classList.toggle('hidden',!['ADMIN_REGIONAL','AUDITOR_CONSULTA'].includes(profile.rol));
 const o=establishments.find(x=>x.id===profile.establecimiento_id);
 $('#originBox').innerHTML=o?`<strong>Origen:</strong> ${esc(o.nombre)} · RUPS ${esc(o.codigo_rups)}`:''; fillDestinations();
}
function fillDestinations(){
 const sel=$('#destFacility');if(!sel)return;let list=establishments.filter(x=>x.id!==profile.establecimiento_id);
 sel.innerHTML='<option value="">Seleccione</option>'+list.map(x=>`<option value="${x.id}">${esc(x.nombre)} · RUPS ${esc(x.codigo_rups)}</option>`).join('');
}
function installUniversalReferenceSearch(){
 const home=$('#tab-inicio'); if(!home||$('#sirroUniversalSearch'))return;
 const card=document.createElement('article');card.id='sirroUniversalSearch';card.className='card';
 card.innerHTML=`<h2>Buscar referencia SIRRO</h2><p class="muted">Ingrese el número de referencia para localizarla rápidamente. La información y las acciones disponibles respetan los permisos de su usuario.</p><div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end"><label style="margin:0">Número de referencia<input id="universalRefNumber" placeholder="Ej. 6769-2026-00001" autocomplete="off" style="font-size:18px;padding:14px"></label><button id="universalRefSearchBtn" type="button" style="padding:14px 22px">BUSCAR</button></div><div id="universalRefResult" style="margin-top:12px"></div>`;
 const first=home.firstElementChild; if(first)home.insertBefore(card,first);else home.appendChild(card);
 $('#universalRefSearchBtn').onclick=searchUniversalReference;
 $('#universalRefNumber').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchUniversalReference();}});
}
async function searchUniversalReference(){
 const input=$('#universalRefNumber'),box=$('#universalRefResult'); if(!input||!box)return;
 const code=input.value.trim(); if(!code){box.innerHTML='<div class="notice error">Escriba el número de referencia.</div>';return;}
 box.innerHTML='<div class="notice">Buscando referencia…</div>';
 const {data,error}=await sb.from('casos_referencia').select('id,codigo_visible,paciente_nombre,paciente_identidad,tipo,motivo,estado_actual,creado_en,establecimiento_origen_inicial_id').ilike('codigo_visible',code).limit(2);
 if(error){box.innerHTML='<div class="notice error">No fue posible consultar la referencia con los permisos de este usuario.</div>';return;}
 const r=(data||[]).find(x=>String(x.codigo_visible).toLowerCase()===code.toLowerCase())||(data||[])[0];
 if(!r){box.innerHTML='<div class="notice">No se encontró una referencia accesible con ese número.</div>';return;}
 const o=establishments.find(x=>x.id===r.establecimiento_origen_inicial_id);
 box.innerHTML=`<div class="item"><div class="row"><div><strong style="font-size:18px">${esc(r.codigo_visible)}</strong><br>${esc(r.paciente_nombre)}<br><small>${esc(o?.nombre||'')} · ${esc(r.tipo)} · ${esc(r.motivo)} · ${esc(r.estado_actual)} · ${fmt(r.creado_en)}</small></div><span class="badge">${esc(r.estado_actual)}</span></div></div>`;
}
async function refreshAll(){await Promise.all([stats(),refs(),users(),audit()]);}
async function stats(){
 const a=await sb.from('establecimientos').select('*',{count:'exact',head:true});const c=await sb.from('casos_referencia').select('estado_actual');
 const rows=c.data||[];$('#statEst').textContent=a.count??'—';$('#statCasos').textContent=rows.length;
 $('#statAbiertos').textContent=rows.filter(x=>['ABIERTO','EN_PROCESO'].includes(x.estado_actual)).length;$('#statCerrados').textContent=rows.filter(x=>String(x.estado_actual).startsWith('CERRADO')).length;
}
async function refs(){
 const {data,error}=await sb.from('casos_referencia').select('id,codigo_visible,paciente_nombre,paciente_identidad,tipo,motivo,estado_actual,creado_en,establecimiento_origen_inicial_id').order('creado_en',{ascending:false}).limit(100);
 const box=$('#refsList');if(error){if(box)box.innerHTML='<p>No se pudieron cargar las referencias.</p>';return} if(!box)return;
 box.innerHTML=(data||[]).map(r=>{const o=establishments.find(x=>x.id===r.establecimiento_origen_inicial_id);return `<div class="item"><strong>${esc(r.codigo_visible)}</strong> · ${esc(r.paciente_nombre)}<br><small>${esc(o?.nombre||'')} · ${esc(r.tipo)} · ${esc(r.estado_actual)} · ${fmt(r.creado_en)}</small></div>`}).join('')||'<p class="muted">Sin referencias registradas.</p>';
}
async function users(){
 if(profile?.rol!=='ADMIN_REGIONAL')return;const {data}=await sb.from('perfiles').select('nombre_completo,rol,estado,correo,telefono').order('nombre_completo');
 const box=$('#usersList');if(box)box.innerHTML=(data||[]).map(u=>`<div class="item"><strong>${esc(u.nombre_completo)}</strong><br><small>${esc(u.rol)} · ${esc(u.estado)} · ${esc(u.correo)} · ${esc(u.telefono)}</small></div>`).join('');
}
async function audit(){
 if(!['ADMIN_REGIONAL','AUDITOR_CONSULTA'].includes(profile?.rol))return;const {data}=await sb.from('auditoria').select('accion,tabla,registro_id,motivo,creado_en').order('creado_en',{ascending:false}).limit(100);
 const box=$('#auditList');if(box)box.innerHTML=(data||[]).map(a=>`<div class="item"><strong>${esc(a.accion)}</strong> · ${esc(a.tabla)}<br><small>${fmt(a.creado_en)} ${a.motivo?'· '+esc(a.motivo):''}</small></div>`).join('');
}
async function createRef(e){
 e.preventDefault();msg('#refMsg','Registrando…');if(!profile.establecimiento_id)return msg('#refMsg','Su perfil no tiene establecimiento asignado.',true);
 const dest=$('#destFacility').value;if(!dest)return msg('#refMsg','Seleccione destino.',true);
 const payload={p_establecimiento_origen_id:profile.establecimiento_id,p_establecimiento_destino_id:dest,p_paciente_identidad:$('#patientId').value.trim(),p_paciente_nombre:$('#patientName').value.trim(),p_tipo:$('#refType').value,p_motivo:$('#refReason').value,p_observacion:$('#observation').value.trim()};
 const {data,error}=await sb.rpc('crear_referencia_sirro',payload);if(error)return msg('#refMsg','La base central aún necesita habilitar la función crear_referencia_sirro. No se guardó ningún dato.',true);
 msg('#refMsg','Referencia registrada correctamente: '+(data?.codigo_visible||data||''));e.target.reset();fillDestinations();await refreshAll();
}
$$('.tabs button').forEach(b=>b.onclick=()=>{$$('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.tabpane').forEach(x=>x.classList.add('hidden'));$('#tab-'+b.dataset.tab).classList.remove('hidden')});
$('#loginBtn').onclick=login;$('#loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
$('#logoutBtn').onclick=async()=>{if(sb)await sb.auth.signOut();location.reload()};
$('#refForm').addEventListener('submit',createRef);
init();
