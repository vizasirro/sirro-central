(() => {
  if (window.__sirroCeNotificationUiLoaded) return;
  window.__sirroCeNotificationUiLoaded = true;

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmtDate=v=>{try{return new Date(v).toLocaleDateString('es-HN',{timeZone:'America/Tegucigalpa',day:'2-digit',month:'2-digit',year:'numeric'});}catch{return'';}};
  const fmtTime=v=>{try{return new Date(v).toLocaleTimeString('es-HN',{timeZone:'America/Tegucigalpa',hour:'2-digit',minute:'2-digit',hour12:false});}catch{return'';}};
  const getTramos=()=>typeof tramos!=='undefined'&&Array.isArray(tramos)?tramos:[];
  const getNotifications=()=>typeof notifications!=='undefined'&&Array.isArray(notifications)?notifications:[];
  const getCases=()=>typeof cases!=='undefined'&&Array.isArray(cases)?cases:[];
  const getFacilities=()=>typeof establecimientos!=='undefined'&&Array.isArray(establecimientos)?establecimientos:(typeof facilities!=='undefined'&&Array.isArray(facilities)?facilities:[]);
  const caseOfSafe=id=>typeof caseOf==='function'?(caseOf(id)||{}):(getCases().find(c=>String(c.id)===String(id))||{});
  const tramoOf=id=>getTramos().find(t=>String(t.id)===String(id));
  const facilityName=id=>{const f=getFacilities().find(x=>String(x.id)===String(id));return f?.nombre||f?.nombre_establecimiento||f?.establecimiento||'';};
  function specialtyFromMessage(msg=''){const m=String(msg).match(/Especialidad:\s*([^\.]+)\./i);return m?.[1]?.trim()||'Consulta Externa';}
  function appointmentFromMessage(msg=''){const m=String(msg).match(/(?:programada|asignada)\s+para\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})/i);return m?{date:m[1],time:m[2]}:{date:'',time:''};}
  function latestAppointmentForTramo(id){const arr=(typeof followups!=='undefined'&&Array.isArray(followups)?followups:[]).filter(s=>String(s.tramo_id)===String(id)&&s.tipo==='CONSULTA_EXTERNA'&&s.estado==='PROGRAMADA'&&s.fecha_cita).sort((a,b)=>new Date(b.actualizado_en||b.creado_en||0)-new Date(a.actualizado_en||a.creado_en||0));return arr[0]||null;}
  function findNotificationForCard(card){const txt=card.textContent||'';const ce=getNotifications().filter(n=>/Cita de Consulta Externa asignada|Cita de Consulta Externa reprogramada/i.test(n.titulo||''));if(!ce.length)return null;const hit=ce.find(n=>txt.includes((n.mensaje||'').slice(0,32)));return hit||ce.sort((a,b)=>new Date(b.creada_en||0)-new Date(a.creada_en||0))[0];}
  function canOriginClose(t,c){return !!t&&!!c&&String(t.estado_actual)==='RESPUESTA_ENVIADA'&&typeof profile!=='undefined'&&profile?.rol==='USUARIO_US'&&String(profile?.establecimiento_id||'')===String(t.establecimiento_origen_id||'')&&String(c?.motivo||'').startsWith('CE_');}
  async function closeCeReference(id){
    if(!confirm('¿Confirma que recibió la cita y desea cerrar esta referencia?'))return;
    const {error}=await sb.rpc('confirmar_respuesta_y_cerrar',{p_tramo:id});
    if(error)return alert(error.message||'No fue posible cerrar la referencia.');
    alert('Cita confirmada y referencia cerrada correctamente.');
    if(typeof refreshAll==='function')await refreshAll();
  }
  window.sirroCloseCeReference=closeCeReference;

  function enhanceCard(card){
    if(card.dataset.sirroCeEnhanced==='1')return;
    const text=card.textContent||'';
    if(!/Cita de Consulta Externa asignada|Cita de Consulta Externa reprogramada/i.test(text))return;
    const n=findNotificationForCard(card),t=n?.tramo_id?tramoOf(n.tramo_id):null,c=n?.caso_id?caseOfSafe(n.caso_id):(t?caseOfSafe(t.caso_id):{}),fup=t?latestAppointmentForTramo(t.id):null;
    const msg=n?.mensaje||text,specialty=specialtyFromMessage(msg),parsed=appointmentFromMessage(msg);
    const date=fup?.fecha_cita?fmtDate(fup.fecha_cita):parsed.date,time=fup?.fecha_cita?fmtTime(fup.fecha_cita):parsed.time;
    const patient=c?.paciente_nombre||c?.nombre_paciente||'',code=c?.codigo_visible||c?.codigo_sirro||'',dest=facilityName(t?.establecimiento_destino_id)||t?.establecimiento_destino_nombre||'';
    const isReprogram=/reprogram/i.test(n?.titulo||'')||/reprogram/i.test(n?.mensaje||'');
    const closeAction=canOriginClose(t,c)?`<div class="sirro-ce-close"><strong>Respuesta del hospital recibida.</strong><span>Confirme la cita para cerrar el ciclo administrativo de esta referencia.</span><button type="button" onclick="sirroCloseCeReference('${t.id}')">CONFIRMAR CITA Y CERRAR REFERENCIA</button></div>`:'';
    card.dataset.sirroCeEnhanced='1';
    card.classList.add('sirro-ce-appointment-card');
    card.innerHTML=`<div class="sirro-ce-head"><strong>${isReprogram?'CITA REPROGRAMADA':'CITA PROGRAMADA'} – CONSULTA EXTERNA</strong></div>
      <div class="sirro-ce-grid">
        ${patient?`<div><span>Paciente</span><b>${esc(patient)}</b></div>`:''}
        <div><span>Especialidad</span><b>${esc(specialty)}</b></div>
        <div class="sirro-ce-date"><span>Fecha</span><b>${esc(date||'—')}</b></div>
        <div class="sirro-ce-time"><span>Hora</span><b>${esc(time||'—')}</b></div>
        ${dest?`<div><span>Hospital de destino</span><b>${esc(dest)}</b></div>`:''}
        ${code?`<div><span>Código SIRRO</span><b>${esc(code)}</b></div>`:''}
      </div>
      <div class="sirro-ce-instruction">Informar al paciente que debe presentarse en la fecha y hora indicadas.</div>${closeAction}`;
  }
  function scan(){document.querySelectorAll('#sirroPendingDetails > div, #sirroPendingDetails .notice, #sirroPendingDetails div[style*="border"]').forEach(enhanceCard);}
  const style=document.createElement('style');style.textContent=`.sirro-ce-appointment-card{background:#f8fbff!important;border:2px solid #4f6b8a!important;color:#203040!important;padding:16px!important}.sirro-ce-head{font-size:18px;margin-bottom:12px;color:#1f4f7a}.sirro-ce-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px}.sirro-ce-grid div{background:#fff;border:1px solid #d7e2ec;border-radius:9px;padding:10px}.sirro-ce-grid span{display:block;font-size:12px;color:#60758a;margin-bottom:3px}.sirro-ce-grid b{font-size:15px}.sirro-ce-date b,.sirro-ce-time b{font-size:22px;color:#173f63}.sirro-ce-instruction{margin-top:12px;padding:10px 12px;border-radius:9px;background:#fff8db;border:1px solid #e8c85a;color:#5f4b00;font-weight:700}.sirro-ce-close{margin-top:14px;padding:13px;border-radius:10px;background:#fff7e6;border:2px solid #d97706;color:#7c3f00}.sirro-ce-close strong,.sirro-ce-close span{display:block}.sirro-ce-close span{margin:5px 0 10px;font-size:13px}.sirro-ce-close button{background:#0b6b57;color:#fff;font-size:14px;padding:10px 14px}@media(max-width:620px){.sirro-ce-grid{grid-template-columns:1fr}.sirro-ce-close button{width:100%}}`;document.head.appendChild(style);
  const obs=new MutationObserver(()=>{clearTimeout(window.__sirroCeNotifTimer);window.__sirroCeNotifTimer=setTimeout(scan,40);});
  const start=()=>{obs.observe(document.body,{childList:true,subtree:true});scan();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
