
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const DEFAULT_USERS=[{
  id:'USR-ADMIN',username:'admin',password:'sirro2026',name:'Administrador Regional',
  level:'REGIONAL',role:'Administrador Regional',active:true,manageUsers:true
}];
let currentUser=null, selectedRef=null, deferredPrompt=null;
const isReadOnly=()=>currentUser?.level==='SOLO_LECTURA';
const isRegionalAdmin=()=>currentUser?.level==='REGIONAL'&&currentUser?.manageUsers!==false;
const canSeeAll=()=>['REGIONAL','SOLO_LECTURA'].includes(currentUser?.level);
const EXTERNAL_IDS=new Set(['EXT-HE','EXT-SF','EXT-OTRO']);
const isExternalId=id=>EXTERNAL_IDS.has(id);

const refs=()=>JSON.parse(localStorage.getItem('sirro_refs')||'[]');
const saveRefs=v=>localStorage.setItem('sirro_refs',JSON.stringify(v));
const audits=()=>JSON.parse(localStorage.getItem('sirro_audit')||'[]');
const saveAudits=v=>localStorage.setItem('sirro_audit',JSON.stringify(v));
const getUsers=()=>{
  let u=JSON.parse(localStorage.getItem('sirro_users')||'null');
  if(!Array.isArray(u)||!u.length){u=DEFAULT_USERS;localStorage.setItem('sirro_users',JSON.stringify(u));}
  return u;
};
const saveUsers=v=>localStorage.setItem('sirro_users',JSON.stringify(v));

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function audit(action,refCode='',detail=''){const a=audits();a.unshift({at:new Date().toISOString(),user:currentUser?.name||'Sistema',username:currentUser?.username||'',action,refCode,detail});saveAudits(a);}
const EXTERNAL_DESTS=[
  {id:'EXT-HE',name:'Hospital Escuela',municipality:'Tegucigalpa',ecor:'Fuera de Olancho',rups:'N/A',type:'Hospital',active:true,isHospital:true},
  {id:'EXT-SF',name:'Hospital San Felipe',municipality:'Tegucigalpa',ecor:'Fuera de Olancho',rups:'N/A',type:'Hospital',active:true,isHospital:true},
  {id:'EXT-OTRO',name:'Otro',municipality:'Fuera de Olancho',ecor:'Fuera de Olancho',rups:'N/A',type:'Otro',active:true,isHospital:true}
];
function facility(id){return facilities.find(f=>f.id===id)||EXTERNAL_DESTS.find(f=>f.id===id)}
function origin(){return facility(currentUser?.facilityId)}
function refFacilityIds(r){
  const ids=new Set([r.originId,r.destId,r.responseFromId]);
  (r.history||[]).forEach(h=>{if(h.facilityId)ids.add(h.facilityId);if(h.destinationId)ids.add(h.destinationId)});
  return ids;
}
function hasReferralToTegucigalpa(r){
  if(['EXT-HE','EXT-SF'].includes(r.destId))return true;
  return (r.history||[]).some(h=>['EXT-HE','EXT-SF'].includes(h.destinationId));
}
function hasResponse(r){
  return r.status==='RESPUESTA ENVIADA'||r.status==='CERRADA'||(r.history||[]).some(h=>h.status==='RESPUESTA ENVIADA');
}
function code(){
  const y=new Date().getFullYear();
  const key=`sirro_sequence_${y}`;
  const nums=refs().map(r=>{
    const m=String(r.code||'').match(new RegExp(`^RRO-${y}-(\\d{6})$`));
    return m?Number(m[1]):0;
  });
  const maxRef=nums.length?Math.max(...nums):0;
  const stored=Number(localStorage.getItem(key)||0);
  const n=Math.max(maxRef,stored)+1;
  localStorage.setItem(key,String(n));
  return `RRO-${y}-${String(n).padStart(6,'0')}`;
}
function fmt(x){return new Date(x).toLocaleString('es-HN')}
function ecorList(){return [...new Set(facilities.filter(f=>f.active&&!f.isHospital).map(f=>f.ecor))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'es'))}
function municipalityList(ecor=''){let fs=facilities.filter(f=>f.active&&!f.isHospital);if(ecor)fs=fs.filter(f=>f.ecor===ecor);return [...new Set(fs.map(f=>f.municipality))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'es'))}

function scopeFacilities(user=currentUser){
  if(!user)return [];
  if(['REGIONAL','SOLO_LECTURA'].includes(user.level)) return facilities.filter(f=>f.active);
  if(user.level==='ECOR') return facilities.filter(f=>f.active && f.ecor===user.ecor);
  if(user.level==='MUNICIPIO') return facilities.filter(f=>f.active && f.municipality===user.municipality);
  if(['ESTABLECIMIENTO','HOSPITAL'].includes(user.level)) return facilities.filter(f=>f.active && f.id===user.facilityId);
  return [];
}
function scopeIds(user=currentUser){return new Set(scopeFacilities(user).map(f=>f.id))}
function visibleRefs(user=currentUser){
  const ids=scopeIds(user);
  if(['REGIONAL','SOLO_LECTURA'].includes(user?.level))return refs();
  return refs().filter(r=>[...refFacilityIds(r)].some(id=>ids.has(id)));
}
function monitorRefs(user=currentUser){
  const ids=scopeIds(user);
  if(['REGIONAL','SOLO_LECTURA'].includes(user?.level))return refs();
  if(['ESTABLECIMIENTO','HOSPITAL'].includes(user?.level))return visibleRefs(user);
  return refs().filter(r=>ids.has(r.originId));
}
function canCreateReference(){return ['ESTABLECIMIENTO','HOSPITAL'].includes(currentUser?.level) && !!origin()}
function canRegisterExternalResponse(r){
  if(!r||!currentUser||currentUser.level!=='HOSPITAL'||!isExternalId(r.destId))return false;
  if(!['ENVIADA','REFERENCIA SECUNDARIA'].includes(r.status))return false;
  const lastOutbound=[...(r.history||[])].reverse().find(h=>h.destinationId===r.destId&&['ENVIADA','REFERENCIA SECUNDARIA'].includes(h.status));
  return lastOutbound?.facilityId===currentUser.facilityId;
}
function canManageRef(r){
  if(!r||!currentUser)return false;
  // Los perfiles Regional, ECOR y Municipio son de monitoreo/configuración, no clínicos.
  if(!['ESTABLECIMIENTO','HOSPITAL'].includes(currentUser.level))return false;
  return currentUser.facilityId===r.destId||canRegisterExternalResponse(r);
}

function statusOptions(){const sts=['ENVIADA','RECIBIDA','EVALUADA','REFERENCIA SECUNDARIA','RESPUESTA ENVIADA','CERRADA'];$('#statusFilter').innerHTML='<option value="">Todos los estados</option>'+sts.map(s=>`<option>${s}</option>`).join('')}
function referralHospitalForUS(o){
  if(!o)return null;
  const hermano=facilities.find(f=>f.isHospital&&f.name==='HOSPITAL HERMANO PEDRO');
  const sanFrancisco=facilities.find(f=>f.isHospital&&f.name==='HOSPITAL SAN FRANCISCO');
  if(['ECOR CATACAMAS 1','ECOR CATACAMAS 2','ECOR CULMI'].includes(o.ecor))return hermano||null;
  return sanFrancisco||null;
}
function hospitalNewReferralDestinations(){
  const sanFrancisco=facilities.find(f=>f.isHospital&&f.name==='HOSPITAL SAN FRANCISCO');
  const list=[];
  // Hospital Hermano Pedro puede escalar al Hospital San Francisco.
  if(sanFrancisco&&sanFrancisco.id!==currentUser?.facilityId)list.push(sanFrancisco);
  return list;
}
function fillDestination(){
  const o=origin();
  $('#destOtherWrap')?.classList.add('hidden'); if($('#destOther')) $('#destOther').value='';
  if(currentUser?.level==='ESTABLECIMIENTO'){
    const target=referralHospitalForUS(o);
    if(!target){
      $('#destMunicipality').innerHTML='<option value="">Sin ruta configurada</option>';
      $('#destFacility').innerHTML='<option value="">Sin hospital receptor configurado</option>';
      return;
    }
    $('#destMunicipality').innerHTML=`<option value="${esc(target.municipality)}" selected>${esc(target.municipality)}</option>`;
    $('#destFacility').innerHTML=`<option value="${target.id}" selected>${esc(target.name)} · ${esc(target.type)} · RUPS ${esc(target.rups)}</option>`;
    return;
  }
  if(currentUser?.level==='HOSPITAL'){
    const internal=hospitalNewReferralDestinations();
    const municipalities=[...new Set(internal.map(f=>f.municipality)), 'Tegucigalpa','Fuera de Olancho'];
    $('#destMunicipality').innerHTML='<option value="">Seleccione</option>'+municipalities.map(m=>`<option>${esc(m)}</option>`).join('');
    $('#destFacility').innerHTML='<option value="">Seleccione municipio</option>';
    return;
  }
  $('#destMunicipality').innerHTML='<option value="">Seleccione</option>';
  $('#destFacility').innerHTML='<option value="">Seleccione municipio</option>';
}
$('#destMunicipality').addEventListener('change',e=>{
  if(currentUser?.level==='ESTABLECIMIENTO')return fillDestination();
  let list=[];
  if(currentUser?.level==='HOSPITAL'){
    list=hospitalNewReferralDestinations().filter(f=>f.municipality===e.target.value);
    if(e.target.value==='Tegucigalpa') list=EXTERNAL_DESTS.filter(f=>f.id!=='EXT-OTRO');
    if(e.target.value==='Fuera de Olancho') list=[EXTERNAL_DESTS.find(f=>f.id==='EXT-OTRO')];
  }
  list=list.filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  $('#destFacility').innerHTML='<option value="">Seleccione</option>'+list.map(f=>`<option value="${f.id}">${esc(f.name)} · ${esc(f.type)}${f.rups!=='N/A'?' · RUPS '+esc(f.rups):''}</option>`).join('');
  $('#destOtherWrap')?.classList.add('hidden'); if($('#destOther')) $('#destOther').value='';
});
$('#destFacility')?.addEventListener('change',e=>{
  const isOther=e.target.value==='EXT-OTRO';
  $('#destOtherWrap')?.classList.toggle('hidden',!isOther);
  if($('#destOther')) $('#destOther').required=isOther;
});
$('#service')?.addEventListener('change',e=>{
  const isOther=e.target.value==='Otro';
  $('#serviceOtherWrap')?.classList.toggle('hidden',!isOther);
  if($('#serviceOther')) $('#serviceOther').required=isOther;
});

function userMeta(u){
  if(['REGIONAL','SOLO_LECTURA'].includes(u.level))return 'Acceso: Todo Olancho';
  if(u.level==='ECOR')return `Acceso: ${u.ecor}`;
  if(u.level==='MUNICIPIO')return `Acceso: Municipio ${u.municipality}`;
  const f=facility(u.facilityId);return `Acceso: ${f?.name||''} · ${f?.municipality||''} · RUPS ${f?.rups||''}`;
}
function configureUI(){
  $('#userName').textContent=currentUser.name;
  $('#userMeta').textContent=`${currentUser.role||currentUser.level} · ${userMeta(currentUser)}`;
  const o=origin();
  if(o){
    $('#originFacility').textContent=o.name;$('#originMunicipality').textContent=o.municipality;
    $('#originEcor').textContent=o.ecor;$('#originRups').textContent=o.rups;
  }
  const newBtn=$('#tabs button[data-tab="nueva"]');
  const recBtn=$('#tabs button[data-tab="recibidas"]');
  newBtn.classList.toggle('hidden',!canCreateReference());
  recBtn.classList.toggle('hidden',!['ESTABLECIMIENTO','HOSPITAL'].includes(currentUser.level));
  $('#usersTabBtn').classList.toggle('hidden',!isRegionalAdmin());
  $('#evaluationTabBtn')?.classList.toggle('hidden',!['REGIONAL','SOLO_LECTURA'].includes(currentUser.level));
  const monTitle=$('#tab-monitoreo h2');
  if(currentUser.level==='REGIONAL')monTitle.textContent='Monitoreo regional por ECOR';
  else if(currentUser.level==='SOLO_LECTURA')monTitle.textContent='Monitoreo regional — SOLO LECTURA';
  else if(currentUser.level==='ECOR')monTitle.textContent=`Monitoreo ${currentUser.ecor}`;
  else if(currentUser.level==='MUNICIPIO')monTitle.textContent=`Monitoreo municipio ${currentUser.municipality}`;
  else monTitle.textContent=`Monitoreo ${origin()?.name||''}`;
}

function login(){
  const u=getUsers().find(x=>x.username.toLowerCase()===$('#loginUser').value.trim().toLowerCase()&&x.password===$('#loginPass').value&&x.active!==false);
  if(!u)return alert('Usuario o contraseña incorrectos, o usuario inactivo');
  currentUser=u;$('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');
  configureUI();fillDestination();statusOptions();setupUserForm();audit('Inicio de sesión','',userMeta(u));renderAll()
}
$('#loginBtn').onclick=login;
$('#logoEnterBtn').onclick=()=>{
  if($('#loginUser').value.trim()&&$('#loginPass').value)login();
  else $('#loginUser').focus();
}; $('#loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
$('#logoutBtn').onclick=()=>{audit('Cierre de sesión');location.reload()};

$('#changePasswordBtn').onclick=()=>{
  const next=prompt('Nueva contraseña (mínimo 8 caracteres):');
  if(next===null)return;
  if(next.length<8)return alert('La contraseña debe tener al menos 8 caracteres.');
  const confirmNext=prompt('Confirme la nueva contraseña:');
  if(confirmNext===null)return;
  if(next!==confirmNext)return alert('Las contraseñas no coinciden. No se realizó ningún cambio.');
  const arr=getUsers(),i=arr.findIndex(u=>u.id===currentUser.id);
  if(i<0)return;
  arr[i].password=next;saveUsers(arr);currentUser=arr[i];audit('Contraseña cambiada');alert('Contraseña actualizada en este dispositivo.');
};
$('#backupFile')?.addEventListener('change',e=>{importBackupFile(e.target.files?.[0]);e.target.value='';});

async function sha256Text(value){
  const data=new TextEncoder().encode(value);
  const hash=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
$('#setResetKeyBtn')?.addEventListener('click',async()=>{
  if(!isRegionalAdmin())return alert('Solo el Administrador Regional puede configurar la clave de reinicio.');
  const current=prompt('Escriba su contraseña actual de Administrador Regional:');
  if(current===null)return;
  if(current!==currentUser.password)return alert('Contraseña de administrador incorrecta.');
  const next=prompt('Defina la clave especial para LIMPIAR REFERENCIAS Y RESPUESTAS (mínimo 8 caracteres):');
  if(next===null)return;
  if(next.length<8)return alert('La clave especial debe tener al menos 8 caracteres.');
  const confirmNext=prompt('Confirme la clave especial de reinicio:');
  if(confirmNext===null)return;
  if(next!==confirmNext)return alert('Las claves no coinciden.');
  localStorage.setItem('sirro_reset_key_hash',await sha256Text(next));
  audit('Clave especial de reinicio configurada');
  alert('Clave especial de reinicio configurada correctamente.');
});
$('#resetTestBtn')?.addEventListener('click',async()=>{
  if(!isRegionalAdmin())return alert('Solo el Administrador Regional puede realizar esta acción.');
  const savedHash=localStorage.getItem('sirro_reset_key_hash');
  if(!savedHash)return alert('Primero configure la clave especial de reinicio en Control de pruebas.');
  const key=prompt('Escriba la CLAVE ESPECIAL para limpiar únicamente las referencias y respuestas de prueba:');
  if(key===null)return;
  if(await sha256Text(key)!==savedHash)return alert('Clave especial incorrecta. Operación cancelada.');
  const phrase=prompt('Esta acción eliminará referencias, respuestas, contrarreferencias, referencias secundarias, cierres y movimientos asociados. Usuarios, perfiles, establecimientos y configuración se conservarán.\n\nPara confirmar escriba: LIMPIAR REFERENCIAS');
  if(phrase!=='LIMPIAR REFERENCIAS')return alert('Operación cancelada.');
  const keptAudits=audits().filter(a=>!a.refCode);
  localStorage.removeItem('sirro_refs');
  saveAudits(keptAudits);
  Object.keys(localStorage).filter(k=>k.startsWith('sirro_sequence_')).forEach(k=>localStorage.removeItem(k));
  audit('Base de referencias de prueba limpiada','',`Se eliminaron referencias/respuestas y sus movimientos asociados. Se conservaron usuarios, catálogo, configuración y ${keptAudits.length} registros administrativos sin código RRO.`);
  alert('Referencias y respuestas de prueba eliminadas. Usuarios, establecimientos, perfiles y configuración permanecen intactos. El consecutivo local fue reiniciado.');
  renderAll();
});


$$('#tabs button').forEach(b=>b.onclick=()=>{
  if(b.classList.contains('hidden'))return;
  $$('#tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  $$('.tabpane').forEach(p=>p.classList.add('hidden'));$(`#tab-${b.dataset.tab}`).classList.remove('hidden');renderAll()
});

$('#refForm').addEventListener('submit',e=>{
  e.preventDefault();if(!canCreateReference())return alert('Este perfil es únicamente de monitoreo.');
  const o=origin(),d=facility($('#destFacility').value);if(!o||!d)return alert('Seleccione establecimiento de destino');
  const pid=$('#patientId').value.trim(), phone=$('#patientPhone').value.trim();
  if(!/^\d{13}$/.test(pid))return alert('La identidad debe contener exactamente 13 números.');
  if(!/^\d{8}$/.test(phone))return alert('El número de celular debe contener exactamente 8 números.');
  const serviceBase=$('#service').value;
  const serviceOther=$('#serviceOther')?.value.trim()||'';
  const destOther=$('#destOther')?.value.trim()||'';
  if(serviceBase==='Otro'&&!serviceOther)return alert('Especifique el servicio/procedimiento requerido.');
  if(d.id==='EXT-OTRO'&&!destOther)return alert('Especifique el establecimiento de destino.');
  const service=serviceBase==='Otro'?`Otro: ${serviceOther}`:serviceBase;
  const r={code:code(),patientName:$('#patientName').value.trim(),patientId:pid,patientPhone:phone,reason:$('#reason').value.trim(),service,serviceOther:serviceBase==='Otro'?serviceOther:'',originId:o.id,destId:d.id,destOther:d.id==='EXT-OTRO'?destOther:'',status:'ENVIADA',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:currentUser.username,history:[]};
  r.history.push({status:'ENVIADA',at:r.createdAt,user:currentUser.name,username:currentUser.username,facilityId:o.id,destinationId:d.id,destinationOther:r.destOther});
  const arr=refs();arr.unshift(r);saveRefs(arr);audit('Referencia enviada',r.code,`${o.name} → ${d.id==='EXT-OTRO'?destOther:d.name}`);e.target.reset();fillDestination();$('#serviceOtherWrap')?.classList.add('hidden');alert(`Referencia ${r.code} enviada`);renderAll()
});

function item(r,withAction=false){
  const o=facility(r.originId),d=facility(r.destId);
  const dName=d?.id==='EXT-OTRO'?(r.destOther||'Otro'):d?.name||'';
  return `<div class="listitem"><div class="row"><div><strong>${esc(r.code)}</strong> <span class="badge">${esc(r.status)}</span><br>${esc(r.patientName)}<div class="muted">${esc(o?.name||'')} → ${esc(dName)} · ${fmt(r.updatedAt)}</div></div><div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end"><button class="ghost" onclick="viewRef('${r.code}')">Ver detalle</button>${withAction&&canManageRef(r)?`<button onclick="manage('${r.code}')">Gestionar</button>`:''}</div></div><div class="muted">Servicio: ${esc(r.service)} · Celular: ${esc(r.patientPhone)}</div></div>`
}
function renderReceived(){
  if(!['ESTABLECIMIENTO','HOSPITAL'].includes(currentUser.level)){
    $('#receivedList').innerHTML='<p class="muted">Este perfil es de monitoreo. Use Seguimiento o Monitoreo.</p>';return;
  }
  const list=refs().filter(r=>r.destId===currentUser.facilityId&&r.status!=='CERRADA');
  $('#receivedList').innerHTML=list.length?list.map(r=>item(r,true)).join(''):'<p class="muted">No hay referencias pendientes.</p>'
}
function renderTracking(){
  let list=visibleRefs();const s=$('#statusFilter').value,q=$('#searchRef').value.toLowerCase();
  if(s)list=list.filter(r=>r.status===s);if(q)list=list.filter(r=>r.code.toLowerCase().includes(q)||r.patientName.toLowerCase().includes(q));
  $('#trackingList').innerHTML=list.length?list.map(r=>item(r,true)).join(''):'<p class="muted">Sin resultados.</p>'
}
$('#statusFilter').onchange=renderTracking;$('#searchRef').oninput=renderTracking;

function renderAudit(){
  let list=audits();
  if(!['REGIONAL','SOLO_LECTURA'].includes(currentUser.level)) list=list.filter(a=>a.username===currentUser.username || visibleRefs().some(r=>r.code===a.refCode));
  $('#auditList').innerHTML=list.length?list.map(a=>`<div class="listitem"><strong>${esc(a.action)}</strong> · ${esc(a.refCode||'')}<div class="muted">${fmt(a.at)} · ${esc(a.user)}${a.detail?' · '+esc(a.detail):''}</div></div>`).join(''):'<p class="muted">Sin movimientos registrados.</p>'
}
function stats(){
  const a=visibleRefs();
  $('#statPendientes').textContent=a.filter(r=>['ENVIADA','RECIBIDA','EVALUADA','REFERENCIA SECUNDARIA'].includes(r.status)).length;
  $('#statRespuesta').textContent=a.filter(hasResponse).length;
  $('#statTegus').textContent=a.filter(hasReferralToTegucigalpa).length;
  $('#statCerradas').textContent=a.filter(r=>r.status==='CERRADA').length
}
function metricSet(list){return {enviadas:list.length,pendientes:list.filter(r=>['ENVIADA','RECIBIDA','EVALUADA','REFERENCIA SECUNDARIA'].includes(r.status)).length,respondidas:list.filter(hasResponse).length,tegus:list.filter(hasReferralToTegucigalpa).length,cerradas:list.filter(r=>r.status==='CERRADA').length}}
function metricHtml(m){return `<span><b>${m.enviadas}</b> total</span><span><b>${m.pendientes}</b> pendientes</span><span><b>${m.respondidas}</b> respondidas</span><span><b>${m.tegus}</b> a Tegucigalpa</span><span><b>${m.cerradas}</b> cerradas</span>`}
function facilityRows(fs,list){
  return fs.sort((a,b)=>a.name.localeCompare(b.name,'es')).map(f=>{
    const fr=list.filter(r=>r.originId===f.id);
    return `<div class="facility-row"><div><strong>${esc(f.name)}</strong><div class="muted">${esc(f.type)} · RUPS ${esc(f.rups)}</div></div><div class="monitor-metrics">${metricHtml(metricSet(fr))}</div></div>`;
  }).join('')
}
function renderMonitoring(){
  const all=monitorRefs(), total=metricSet(all);
  $('#regionalSummary').innerHTML=`
    <article class="card"><span>Total referencias</span><strong>${total.enviadas}</strong></article>
    <article class="card"><span>Pendientes</span><strong>${total.pendientes}</strong></article>
    <article class="card"><span>Respondidas</span><strong>${total.respondidas}</strong></article>
    <article class="card"><span>A Tegucigalpa / tercer nivel</span><strong>${total.tegus}</strong></article>
    <article class="card"><span>Cerradas</span><strong>${total.cerradas}</strong></article>`;

  let fs=scopeFacilities().filter(f=>!f.isHospital);
  if(['ESTABLECIMIENTO','HOSPITAL'].includes(currentUser.level)){
    $('#ecorMonitoring').innerHTML=facilityRows(scopeFacilities(),all);return;
  }
  const hospitalFs=scopeFacilities().filter(f=>f.isHospital);
  const hospitalHtml=(['REGIONAL','SOLO_LECTURA'].includes(currentUser.level)&&hospitalFs.length)
    ? `<details class="monitor-group" open><summary><strong>Hospitales</strong></summary><div class="monitor-body facility-monitor">${facilityRows(hospitalFs,all)}</div></details>` : '';
  const ecors=[...new Set(fs.map(f=>f.ecor))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'es'));
  $('#ecorMonitoring').innerHTML=hospitalHtml+ecors.map(ecor=>{
    const eFacilities=fs.filter(f=>f.ecor===ecor), ids=new Set(eFacilities.map(f=>f.id)), eRefs=all.filter(r=>ids.has(r.originId));
    const municipalities=[...new Set(eFacilities.map(f=>f.municipality))].sort((a,b)=>a.localeCompare(b,'es'));
    return `<details class="monitor-group" ${currentUser.level==='ECOR'?'open':''}><summary><strong>${esc(ecor)}</strong><span class="monitor-metrics">${metricHtml(metricSet(eRefs))}</span></summary>
      <div class="monitor-body">${municipalities.map(m=>{
        const mf=eFacilities.filter(f=>f.municipality===m), mids=new Set(mf.map(f=>f.id)), mr=eRefs.filter(r=>mids.has(r.originId));
        return `<details class="monitor-municipality" ${currentUser.level==='MUNICIPIO'?'open':''}><summary><strong>${esc(m)}</strong><span class="monitor-metrics">${metricHtml(metricSet(mr))}</span></summary><div class="facility-monitor">${facilityRows(mf,mr)}</div></details>`;
      }).join('')}</div></details>`;
  }).join('');
}


function rrHospitals(){return facilities.filter(f=>f.active&&f.isHospital).sort((a,b)=>a.name.localeCompare(b.name,'es'))}
function rrPeriodStart(period){
  const n=new Date();
  if(period==='today')return new Date(n.getFullYear(),n.getMonth(),n.getDate());
  if(period==='month')return new Date(n.getFullYear(),n.getMonth(),1);
  if(period==='year')return new Date(n.getFullYear(),0,1);
  return null;
}
function rrInPeriod(at,period){const start=rrPeriodStart(period);return !start||new Date(at)>=start}
function rrEventMatches(h,status,hid,period){
  return h.status===status&&h.facilityId===hid&&rrInPeriod(h.at,period);
}
function rrMetricForHospital(hid,period='month'){
  const now=Date.now(), list=refs();
  let received=0,evaluated=0,responded=0,secondary=0,pending24=0,pending48=0,cohortResponded=0;
  const recvTimes=[],evalTimes=[],respTimes=[];
  for(const r of list){
    const hist=(r.history||[]).slice().sort((a,b)=>new Date(a.at)-new Date(b.at));
    // Cada indicador se atribuye al período de SU PROPIO evento.
    for(let i=0;i<hist.length;i++){
      const h=hist[i];
      if(rrEventMatches(h,'RECIBIDA',hid,period)){
        received++;
        const arrival=[...hist.slice(0,i)].reverse().find(x=>['ENVIADA','REFERENCIA SECUNDARIA'].includes(x.status)&&x.destinationId===hid);
        if(arrival)recvTimes.push((new Date(h.at)-new Date(arrival.at))/36e5);
      }
      if(rrEventMatches(h,'EVALUADA',hid,period)){
        evaluated++;
        const rec=[...hist.slice(0,i)].reverse().find(x=>x.status==='RECIBIDA'&&x.facilityId===hid);
        if(rec)evalTimes.push((new Date(h.at)-new Date(rec.at))/36e5);
        const later=hist.slice(i+1);
        if(later.some(x=>x.status==='RESPUESTA ENVIADA'&&x.facilityId===hid))cohortResponded++;
      }
      if(rrEventMatches(h,'RESPUESTA ENVIADA',hid,period)){
        responded++;
        const eva=[...hist.slice(0,i)].reverse().find(x=>x.status==='EVALUADA'&&x.facilityId===hid);
        if(eva)respTimes.push((new Date(h.at)-new Date(eva.at))/36e5);
      }
      if(rrEventMatches(h,'REFERENCIA SECUNDARIA',hid,period))secondary++;
    }
    // Pendientes actuales del hospital cuyo último movimiento hospitalario cae en el período seleccionado.
    if(r.destId===hid&&['ENVIADA','RECIBIDA','EVALUADA','REFERENCIA SECUNDARIA'].includes(r.status)){
      const relevant=[...hist].reverse().find(h=>h.facilityId===hid||h.destinationId===hid);
      const baseAt=relevant?.at||r.createdAt;
      if(rrInPeriod(baseAt,period)){
        const age=(now-new Date(baseAt))/36e5;
        if(age>=24)pending24++;
        if(age>=48)pending48++;
      }
    }
  }
  const sum=a=>a.reduce((x,y)=>x+y,0), avg=a=>a.length?sum(a)/a.length:null;
  return {received,evaluated,responded,secondary,pending24,pending48,
    responseRate:evaluated?cohortResponded/evaluated*100:0,cohortResponded,
    avgReceive:avg(recvTimes),avgEval:avg(evalTimes),avgResponse:avg(respTimes),
    receiveHoursTotal:sum(recvTimes),receiveHoursN:recvTimes.length,
    evalHoursTotal:sum(evalTimes),evalHoursN:evalTimes.length,
    responseHoursTotal:sum(respTimes),responseHoursN:respTimes.length};
}
function rrHours(v){return v==null?'—':v<1?`${Math.round(v*60)} min`:`${v.toFixed(1)} h`}
function rrPct(v){return `${v.toFixed(1)}%`}
function rrLevel(rate){if(rate>=90)return 'ALTO';if(rate>=75)return 'MEDIO';return 'BAJO'}
function renderEvaluation(){
  const sel=$('#rrHospital'); if(!sel||!currentUser)return;
  const hs=rrHospitals();
  if(!sel.options.length)sel.innerHTML='<option value="ALL">Todos los hospitales</option>'+hs.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join('');
  const period=$('#rrPeriod')?.value||'month', chosen=sel.value||'ALL';
  const metrics=chosen==='ALL'?hs.map(h=>({h,m:rrMetricForHospital(h.id,period)})):hs.filter(h=>h.id===chosen).map(h=>({h,m:rrMetricForHospital(h.id,period)}));
  const sum=metrics.reduce((a,x)=>{for(const k of ['received','evaluated','responded','cohortResponded','secondary','pending24','pending48','receiveHoursTotal','receiveHoursN','evalHoursTotal','evalHoursN','responseHoursTotal','responseHoursN'])a[k]+=x.m[k];return a},{received:0,evaluated:0,responded:0,cohortResponded:0,secondary:0,pending24:0,pending48:0,receiveHoursTotal:0,receiveHoursN:0,evalHoursTotal:0,evalHoursN:0,responseHoursTotal:0,responseHoursN:0});
  const rate=sum.evaluated?sum.cohortResponded/sum.evaluated*100:0;
  $('#rrSummary').innerHTML=`<article class="card"><span>Recibidas</span><strong>${sum.received}</strong></article><article class="card"><span>Evaluadas</span><strong>${sum.evaluated}</strong></article><article class="card"><span>Respondidas</span><strong>${sum.responded}</strong></article><article class="card"><span>Nivel R/R</span><strong>${rrPct(rate)}</strong><small>${rrLevel(rate)}</small></article><article class="card"><span>Ref. secundarias</span><strong>${sum.secondary}</strong></article><article class="card"><span>Pendientes ≥24 h</span><strong>${sum.pending24}</strong></article><article class="card"><span>Pendientes ≥48 h</span><strong>${sum.pending48}</strong></article>`;
  const weighted=(totalKey,nKey)=>sum[nKey]?sum[totalKey]/sum[nKey]:null;
  $('#rrTiming').innerHTML=`<article class="card"><span>Prom. envío → recepción</span><strong>${rrHours(weighted('receiveHoursTotal','receiveHoursN'))}</strong></article><article class="card"><span>Prom. recepción → evaluación</span><strong>${rrHours(weighted('evalHoursTotal','evalHoursN'))}</strong></article><article class="card"><span>Prom. evaluación → respuesta</span><strong>${rrHours(weighted('responseHoursTotal','responseHoursN'))}</strong></article>`;
  $('#rrHospitalComparison').innerHTML=metrics.map(({h,m})=>`<div class="listitem rr-hospital"><div class="row"><div><strong>${esc(h.name)}</strong><div class="muted">${m.received} recibidas · ${m.evaluated} evaluadas · ${m.responded} respondidas · ${m.secondary} secundarias</div></div><div class="rr-rate"><strong>${rrPct(m.responseRate)}</strong><span>${rrLevel(m.responseRate)}</span></div></div><div class="monitor-metrics"><span><b>${rrHours(m.avgReceive)}</b> recepción</span><span><b>${rrHours(m.avgEval)}</b> evaluación</span><span><b>${rrHours(m.avgResponse)}</b> respuesta</span><span><b>${m.pending24}</b> ≥24 h</span><span><b>${m.pending48}</b> ≥48 h</span></div></div>`).join('')||'<p class="muted">Sin datos hospitalarios en el período seleccionado.</p>';
}$('#rrHospital')?.addEventListener('change',renderEvaluation);
$('#rrPeriod')?.addEventListener('change',renderEvaluation);

function setupUserForm(){
  if(!$('#newUserLevel'))return;
  $('#newUserEcor').innerHTML='<option value="">Seleccione</option>'+ecorList().map(x=>`<option>${esc(x)}</option>`).join('');
  $('#newUserMunicipality').innerHTML='<option value="">Seleccione</option>'+municipalityList().map(x=>`<option>${esc(x)}</option>`).join('');
  $('#newUserFacilityMunicipality').innerHTML='<option value="">Seleccione</option>'+municipalityList().map(x=>`<option>${esc(x)}</option>`).join('');
  $('#newUserFacility').innerHTML='<option value="">Seleccione municipio primero</option>';
}
function updateUserScopeFields(){
  const lvl=$('#newUserLevel').value;
  $('#ecorUserWrap').classList.toggle('hidden',lvl!=='ECOR');
  $('#municipalityUserWrap').classList.toggle('hidden',lvl!=='MUNICIPIO');
  $('#facilityMunicipalityWrap').classList.toggle('hidden',lvl!=='ESTABLECIMIENTO');
  $('#facilityUserWrap').classList.toggle('hidden',!['ESTABLECIMIENTO','HOSPITAL'].includes(lvl));
  if(lvl==='ESTABLECIMIENTO'){
    $('#newUserFacilityMunicipality').innerHTML='<option value="">Seleccione</option>'+municipalityList().map(x=>`<option>${esc(x)}</option>`).join('');
    $('#newUserFacility').innerHTML='<option value="">Seleccione municipio primero</option>';
  } else if(lvl==='HOSPITAL'){
    const fs=facilities.filter(f=>f.active&&f.isHospital).sort((a,b)=>a.name.localeCompare(b.name,'es'));
    $('#newUserFacility').innerHTML='<option value="">Seleccione</option>'+fs.map(f=>`<option value="${f.id}">${esc(f.name)} · ${esc(f.municipality)} · RUPS ${esc(f.rups)}</option>`).join('');
  }
}
$('#newUserLevel')?.addEventListener('change',updateUserScopeFields);
$('#newUserEcor')?.addEventListener('change',e=>{
  if($('#newUserLevel').value==='MUNICIPIO')$('#newUserMunicipality').innerHTML='<option value="">Seleccione</option>'+municipalityList(e.target.value).map(x=>`<option>${esc(x)}</option>`).join('')
});
$('#newUserFacilityMunicipality')?.addEventListener('change',e=>{
  if($('#newUserLevel').value!=='ESTABLECIMIENTO')return;
  const fs=facilities.filter(f=>f.active&&!f.isHospital&&f.municipality===e.target.value).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  $('#newUserFacility').innerHTML='<option value="">Seleccione</option>'+fs.map(f=>`<option value="${f.id}">${esc(f.name)} · ${esc(f.type)} · RUPS ${esc(f.rups)}</option>`).join('');
});

$('#userForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  if(!isRegionalAdmin())return alert('No tiene permiso para crear usuarios');
  const arr=getUsers(), username=$('#newUsername').value.trim();
  const password=$('#newPassword').value, confirmPassword=$('#confirmPassword').value;
  if(password.length<8)return alert('La contraseña debe tener al menos 8 caracteres.');
  if(password!==confirmPassword)return alert('La contraseña y su confirmación no coinciden.');
  if(arr.some(u=>u.username.toLowerCase()===username.toLowerCase()))return alert('Ese nombre de usuario ya existe');
  const level=$('#newUserLevel').value;
  const u={id:'USR-'+Date.now(),name:$('#newUserName').value.trim(),username,password,level,active:true,manageUsers:level==='REGIONAL'};
  if(level==='REGIONAL')u.role='Administrador Regional';
  if(level==='SOLO_LECTURA'){u.role='SOLO LECTURA · Auditor / Consulta';u.manageUsers=false;}
  if(level==='ECOR'){u.ecor=$('#newUserEcor').value;u.role='Usuario ECOR';if(!u.ecor)return alert('Seleccione ECOR')}
  if(level==='MUNICIPIO'){u.municipality=$('#newUserMunicipality').value;u.role='Usuario Municipal';if(!u.municipality)return alert('Seleccione municipio')}
  if(['ESTABLECIMIENTO','HOSPITAL'].includes(level)){u.facilityId=$('#newUserFacility').value;u.role=level==='HOSPITAL'?'Usuario Hospital':'Usuario Unidad de Salud';if(!u.facilityId)return alert('Seleccione establecimiento')}
  arr.push(u);saveUsers(arr);audit('Usuario creado','',`${u.username} · ${userMeta(u)}`);e.target.reset();updateUserScopeFields();renderUsers();alert(`Usuario ${u.username} creado`)
});
function userHasActivity(u){
  return refs().some(r=>r.createdBy===u.username||(r.history||[]).some(h=>h.username===u.username)) || audits().some(a=>a.username===u.username);
}
function renderUsers(){
  if(!$('#usersList')||!isRegionalAdmin())return;
  const arr=getUsers().filter(u=>u.deleted!==true);
  $('#usersList').innerHTML=arr.map(u=>`<div class="listitem"><div class="row"><div style="display:flex;gap:.6rem;align-items:flex-start"><input type="checkbox" class="user-select" value="${esc(u.id)}" ${u.id==='USR-ADMIN'?'disabled':''}><div><strong>${esc(u.name)}</strong> · ${esc(u.username)} <span class="badge">${u.active!==false?'ACTIVO':'INACTIVO'}</span><div class="muted">${esc(u.role||u.level)} · ${esc(userMeta(u))}</div></div></div>${u.id!=='USR-ADMIN'?`<button class="ghost" onclick="toggleUser('${u.id}')">${u.active!==false?'Desactivar':'Activar'}</button>`:''}</div></div>`).join('')
}
window.toggleUser=id=>{
  if(!isRegionalAdmin())return;
  const arr=getUsers(),i=arr.findIndex(u=>u.id===id);if(i<0)return;arr[i].active=arr[i].active===false?true:false;saveUsers(arr);audit(arr[i].active?'Usuario activado':'Usuario desactivado','',arr[i].username);renderUsers()
}
window.bulkUserAction=action=>{
  if(!isRegionalAdmin())return;
  const ids=$$('.user-select:checked').map(x=>x.value).filter(id=>id!=='USR-ADMIN');
  if(!ids.length)return alert('Seleccione uno o varios usuarios.');
  const arr=getUsers();
  if(action==='delete'&&!confirm(`¿Eliminar ${ids.length} usuario(s) seleccionado(s)? Los usuarios con actividad conservarán su identidad histórica para auditoría.`))return;
  ids.forEach(id=>{
    const i=arr.findIndex(u=>u.id===id);if(i<0)return;
    const u=arr[i];
    if(action==='activate'){u.active=true;audit('Usuario activado','',u.username)}
    if(action==='deactivate'){u.active=false;audit('Usuario desactivado','',u.username)}
    if(action==='delete'){
      if(userHasActivity(u)){u.active=false;u.deleted=true;u.deletedAt=new Date().toISOString();audit('Usuario eliminado/inactivado','',u.username)}
      else {audit('Usuario eliminado','',u.username);arr.splice(i,1)}
    }
  });
  saveUsers(arr);renderUsers();alert('Acción aplicada a los usuarios seleccionados.');
}


function exportBackup(){
  if(!isRegionalAdmin())return;
  const payload={sirroVersion:'0.14',exportedAt:new Date().toISOString(),users:getUsers(),references:refs(),audit:audits()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`SIRRO_respaldo_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  audit('Respaldo exportado');
}
function validateBackupData(data){
  if(!data||typeof data!=='object')throw new Error('El archivo no contiene un objeto de respaldo válido.');
  if(!Array.isArray(data.users)||!Array.isArray(data.references)||!Array.isArray(data.audit))throw new Error('Faltan las colecciones users, references o audit.');
  const userIds=new Set(), usernames=new Set();
  const validLevels=new Set(['REGIONAL','SOLO_LECTURA','ECOR','MUNICIPIO','ESTABLECIMIENTO','HOSPITAL']);
  for(const u of data.users){
    if(!u||!u.id||!u.username||!u.name||!u.level||typeof u.password!=='string'||u.password.length<8)throw new Error('Existe un usuario sin campos obligatorios o con contraseña inválida.');
    if(!/^USR-[A-Za-z0-9_-]+$/.test(String(u.id)))throw new Error(`ID de usuario inválido: ${u.id}`);
    if(!/^[A-Za-z0-9._@+-]{3,80}$/.test(String(u.username)))throw new Error(`Nombre de usuario inválido: ${u.username}`);
    if(!validLevels.has(u.level))throw new Error(`Nivel de usuario inválido: ${u.level}`);
    if(u.level==='ECOR'&&!ecorList().includes(u.ecor))throw new Error(`ECOR inválido para ${u.username}`);
    if(u.level==='MUNICIPIO'&&!municipalityList().includes(u.municipality))throw new Error(`Municipio inválido para ${u.username}`);
    if(['ESTABLECIMIENTO','HOSPITAL'].includes(u.level)){
      const uf=facility(u.facilityId);
      if(!uf||isExternalId(u.facilityId))throw new Error(`Establecimiento inválido para ${u.username}`);
      if(u.level==='HOSPITAL'&&!uf.isHospital)throw new Error(`El usuario ${u.username} no está asignado a un hospital.`);
      if(u.level==='ESTABLECIMIENTO'&&uf.isHospital)throw new Error(`El usuario ${u.username} no está asignado a una unidad de salud.`);
    }
    const uname=String(u.username).trim().toLowerCase();
    if(userIds.has(u.id))throw new Error(`ID de usuario duplicado: ${u.id}`);
    if(usernames.has(uname))throw new Error(`Nombre de usuario duplicado: ${u.username}`);
    userIds.add(u.id);usernames.add(uname);
  }
  if(!data.users.some(u=>u.level==='REGIONAL'&&u.manageUsers!==false&&u.deleted!==true&&u.active!==false))throw new Error('El respaldo no contiene un Administrador Regional activo como perfil administrativo.');
  const codes=new Set(), validStatuses=new Set(['ENVIADA','RECIBIDA','EVALUADA','REFERENCIA SECUNDARIA','RESPUESTA ENVIADA','CERRADA']);
  for(const r of data.references){
    if(!r||!r.code||!r.patientName||!r.patientId||!r.patientPhone||!r.reason||!r.service||!r.originId||!r.destId||!r.status||!r.createdAt||!Array.isArray(r.history)||!r.history.length)throw new Error(`Referencia incompleta: ${r?.code||'sin código'}`);
    if(codes.has(r.code))throw new Error(`Código de referencia duplicado: ${r.code}`);
    if(!/^RRO-\d{4}-\d{6}$/.test(r.code))throw new Error(`Formato de código inválido: ${r.code}`);
    if(!/^\d{13}$/.test(String(r.patientId)))throw new Error(`Identidad inválida en ${r.code}`);
    if(!/^\d{8}$/.test(String(r.patientPhone)))throw new Error(`Celular inválido en ${r.code}`);
    if(!validStatuses.has(r.status))throw new Error(`Estado inválido en ${r.code}: ${r.status}`);
    if(!facility(r.originId)||isExternalId(r.originId))throw new Error(`Origen desconocido o externo en ${r.code}: ${r.originId}`);
    if(!facility(r.destId))throw new Error(`Destino desconocido en ${r.code}: ${r.destId}`);
    if(Number.isNaN(Date.parse(r.createdAt)))throw new Error(`Fecha de creación inválida en ${r.code}`);
    let previousAt=0;
    for(const h of r.history){
      if(!h||!h.status||!h.at)throw new Error(`Historial incompleto en ${r.code}`);
      if(!validStatuses.has(h.status))throw new Error(`Estado de historial inválido en ${r.code}: ${h.status}`);
      const hat=Date.parse(h.at);if(Number.isNaN(hat))throw new Error(`Fecha inválida en historial de ${r.code}`);
      if(hat<previousAt)throw new Error(`Historial fuera de orden cronológico en ${r.code}`);previousAt=hat;
      if(h.facilityId&&!facility(h.facilityId))throw new Error(`Establecimiento desconocido en historial de ${r.code}: ${h.facilityId}`);
      if(h.destinationId&&!facility(h.destinationId))throw new Error(`Destino desconocido en historial de ${r.code}: ${h.destinationId}`);
    }
    if(r.history[0].status!=='ENVIADA')throw new Error(`El historial de ${r.code} no inicia en ENVIADA.`);
    if(r.history[r.history.length-1].status!==r.status)throw new Error(`El estado actual de ${r.code} no coincide con su último movimiento.`);
    codes.add(r.code);
  }
  return true;
}
function importBackupFile(file){
  if(!isRegionalAdmin()||!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      validateBackupData(data);
      if(!confirm('El respaldo fue validado. Esto reemplazará los usuarios, referencias y auditoría locales de este dispositivo. ¿Continuar?'))return;
      saveUsers(data.users);saveRefs(data.references);saveAudits(data.audit);
      audit('Respaldo importado','',`Versión ${data.sirroVersion||'desconocida'} · validación interna superada`);
      alert('Respaldo importado correctamente.');renderAll();
    }catch(e){alert('No se pudo importar el respaldo: '+e.message)}
  };
  reader.readAsText(file);
}
window.exportBackup=exportBackup;

function historyDestinationName(h){
  const f=facility(h.destinationId);
  if(h.destinationId==='EXT-OTRO')return h.destinationOther||'Otro';
  return f?.name||'';
}
window.viewRef=refCode=>{
  const r=visibleRefs().find(x=>x.code===refCode);if(!r)return alert('Referencia no disponible para este usuario.');
  const o=facility(r.originId),d=facility(r.destId);
  const destName=d?.id==='EXT-OTRO'?(r.destOther||'Otro'):d?.name||'';
  const hist=(r.history||[]).map(h=>{
    const f=facility(h.facilityId), to=historyDestinationName(h);
    const recorded=h.externalResponse&&h.recordedByFacilityId?`<div class="muted">Respuesta externa registrada en SIRRO por ${esc(facility(h.recordedByFacilityId)?.name||h.recordedByUsername||'')}</div>`:'';
    return `<div class="listitem"><strong>${esc(h.status||'Movimiento')}</strong><div class="muted">${fmt(h.at)} · ${esc(h.user||'')} ${f?'· '+esc(h.externalOther||f.name):''}${to?' → '+esc(to):''}</div>${h.service?`<div>Servicio/procedimiento: ${esc(h.service)}</div>`:''}${h.notes?`<div>Nota / respuesta: ${esc(h.notes)}</div>`:''}${recorded}</div>`;
  }).join('');
  $('#detailContent').innerHTML=`<div class="readonlybox"><strong>Código:</strong> ${esc(r.code)}<br><strong>Paciente:</strong> ${esc(r.patientName)}<br><strong>Identidad:</strong> ${esc(r.patientId)}<br><strong>Celular:</strong> ${esc(r.patientPhone)}<br><strong>Origen:</strong> ${esc(o?.name||'')}<br><strong>Destino actual:</strong> ${esc(destName)}<br><strong>Motivo / Diagnóstico:</strong> ${esc(r.reason)}<br><strong>Servicio requerido:</strong> ${esc(r.service)}<br><strong>Estado:</strong> ${esc(r.status)}<br><strong>Creada:</strong> ${fmt(r.createdAt)}</div><h4>Historial y trazabilidad</h4>${hist||'<p class="muted">Sin movimientos.</p>'}`;
  $('#detailDialog').showModal();
};
$('#closeDetailBtn')?.addEventListener('click',()=>$('#detailDialog').close());

function renderAll(){if(!currentUser)return;stats();renderReceived();renderTracking();renderMonitoring();renderEvaluation();renderUsers();renderAudit()}
window.manage=refCode=>{
  selectedRef=refCode;const r=refs().find(x=>x.code===refCode);if(!canManageRef(r))return alert('No tiene permiso para gestionar esta referencia');
  $('#dialogInfo').textContent=`${r.code} · ${r.patientName} · Estado: ${r.status}`;$('#actionNotes').value='';
  const allowed=allowedActions(r);
  $$('#receiveActions button').forEach(b=>b.classList.toggle('hidden',!allowed.includes(b.dataset.action)));
  $('#actionDialog').showModal()
}
function allowedActions(r){
  if(!r||!currentUser)return [];
  if(canRegisterExternalResponse(r))return ['externalResponse'];
  if(r.status==='ENVIADA'||r.status==='REFERENCIA SECUNDARIA')return ['receive'];
  if(r.status==='RECIBIDA')return ['evaluate'];
  if(r.status==='EVALUADA'){
    const a=['answer'];
    if(currentUser.level==='HOSPITAL')a.push('secondary');
    return a;
  }
  if(r.status==='RESPUESTA ENVIADA'&&currentUser.facilityId===r.originId)return ['close'];
  return [];
}
function chooseSecondaryDestination(r){
  const hsf=facilities.find(f=>f.isHospital&&f.name==='HOSPITAL SAN FRANCISCO');
  const options=[];
  if(hsf&&hsf.id!==currentUser.facilityId)options.push({key:'1',id:hsf.id,name:hsf.name});
  options.push({key:String(options.length+1),id:'EXT-HE',name:'Hospital Escuela'});
  options.push({key:String(options.length+1),id:'EXT-SF',name:'Hospital San Felipe'});
  options.push({key:String(options.length+1),id:'EXT-OTRO',name:'Otro'});
  const text=options.map(o=>`${o.key}. ${o.name}`).join('\n');
  const choice=prompt(`Destino de la referencia secundaria:\n${text}\n\nEscriba el número de la opción:`);
  if(choice===null)return null;
  const selected=options.find(o=>o.key===choice.trim());
  if(!selected){alert('Seleccione una opción válida.');return null;}
  let other='';
  if(selected.id==='EXT-OTRO'){
    other=(prompt('Especifique el establecimiento de destino:')||'').trim();
    if(!other){alert('Debe especificar el establecimiento de destino.');return null;}
  }
  return {...selected,other};
}
function chooseSecondaryService(){
  const options=['Ortopedia','Tomografía','Resonancia magnética','Medicina interna','Cirugía','Pediatría','Gineco-obstetricia','Otro'];
  const text=options.map((x,i)=>`${i+1}. ${x}`).join('\n');
  const choice=prompt(`Servicio/procedimiento requerido:\n${text}\n\nEscriba el número de la opción:`);
  if(choice===null)return null;
  const n=Number(choice);if(!Number.isInteger(n)||n<1||n>options.length){alert('Seleccione una opción válida.');return null;}
  let service=options[n-1];
  if(service==='Otro'){
    const other=(prompt('Especifique el servicio/procedimiento requerido:')||'').trim();
    if(!other){alert('Debe especificar el servicio/procedimiento.');return null;}
    service=`Otro: ${other}`;
  }
  return service;
}
$$('#receiveActions button').forEach(b=>b.onclick=e=>{
  e.preventDefault();
  const action=b.dataset.action;
  let arr=refs();const i=arr.findIndex(r=>r.code===selectedRef);if(i<0||!canManageRef(arr[i]))return;
  const r=arr[i], allowed=allowedActions(r);if(!allowed.includes(action))return alert('Esta acción no corresponde al estado actual de la referencia.');
  const notes=$('#actionNotes').value.trim();
  if(action==='secondary'){
    if(!notes)return alert('Escriba una justificación clínica breve para la referencia secundaria.');
    const destination=chooseSecondaryDestination(r);if(!destination)return;
    const service=chooseSecondaryService();if(!service)return;
    const at=new Date().toISOString(), fromId=currentUser.facilityId;
    r.status='REFERENCIA SECUNDARIA';r.updatedAt=at;r.destId=destination.id;r.destOther=destination.id==='EXT-OTRO'?destination.other:'';
    r.service=service;r.serviceOther=service.startsWith('Otro: ')?service.slice(6):'';
    r.secondaryReferral={destination:destination.name,destinationId:destination.id,destinationOther:destination.other,service,at,user:currentUser.name,username:currentUser.username,parentCode:r.code,fromId};
    r.history.push({status:'REFERENCIA SECUNDARIA',at,user:currentUser.name,username:currentUser.username,facilityId:fromId,destinationId:destination.id,destinationOther:destination.other,notes,service});
    saveRefs(arr);audit('Referencia secundaria',r.code,`${facility(fromId)?.name||''} → ${destination.other||destination.name} · ${service}`);$('#actionDialog').close();renderAll();return;
  }
  const at=new Date().toISOString();
  if(action==='externalResponse'){
    if(!notes)return alert('Escriba la respuesta/contrarreferencia recibida del establecimiento externo.');
    if(!canRegisterExternalResponse(r))return alert('Esta respuesta externa no puede ser registrada por este usuario.');
    const externalId=r.destId, externalOther=r.destOther||'', recorderId=currentUser.facilityId;
    r.status='RESPUESTA ENVIADA';r.updatedAt=at;r.responseFromId=externalId;r.destId=r.originId;r.destOther='';
    r.history.push({status:'RESPUESTA ENVIADA',at,user:'Respuesta externa',username:'',facilityId:externalId,destinationId:r.originId,notes,externalResponse:true,recordedByFacilityId:recorderId,recordedByUsername:currentUser.username,externalOther});
    saveRefs(arr);audit('Respuesta externa registrada',r.code,`${externalOther||facility(externalId)?.name||'Establecimiento externo'} → ${facility(r.originId)?.name||''} · registrada por ${facility(recorderId)?.name||currentUser.name}`);$('#actionDialog').close();renderAll();return;
  }
  if(action==='receive'){
    r.status='RECIBIDA';r.updatedAt=at;r.history.push({status:'RECIBIDA',at,user:currentUser.name,username:currentUser.username,facilityId:currentUser.facilityId,notes});
  } else if(action==='evaluate'){
    r.status='EVALUADA';r.updatedAt=at;r.history.push({status:'EVALUADA',at,user:currentUser.name,username:currentUser.username,facilityId:currentUser.facilityId,notes});
  } else if(action==='answer'){
    if(!notes)return alert('Escriba la respuesta o contrarreferencia antes de enviarla.');
    const fromId=currentUser.facilityId;
    r.status='RESPUESTA ENVIADA';r.updatedAt=at;r.responseFromId=fromId;r.destId=r.originId;r.destOther='';
    r.history.push({status:'RESPUESTA ENVIADA',at,user:currentUser.name,username:currentUser.username,facilityId:fromId,destinationId:r.originId,notes});
  } else if(action==='close'){
    r.status='CERRADA';r.updatedAt=at;r.history.push({status:'CERRADA',at,user:currentUser.name,username:currentUser.username,facilityId:currentUser.facilityId,notes});
  }
  saveRefs(arr);audit(`Cambio a ${r.status}`,r.code,notes);$('#actionDialog').close();renderAll()
})
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});
$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
