(() => {
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  let ceProgramadas=new Set();
  function canonical(v){const s=norm(v);if(!s)return null;if(s==='GO'||s.includes('GINECO')||s.includes('OBSTET'))return'GINECOOBSTETRICIA';if(s.includes('ORTOP'))return'ORTOPEDIA';if(s.includes('PEDIATR'))return'PEDIATRIA';if(s.includes('MEDICINA INTERNA')||s==='MI'||s.includes('INTERNISTA'))return'MEDICINA_INTERNA';if(s.includes('CIRUG')||s.includes('CIRUJ'))return'CIRUGIA';return null;}
  function specialistKey(){if(typeof profile==='undefined'||profile?.rol!=='USUARIO_HOSPITAL')return null;return canonical(profile?.especialidad||profile?.cargo_funcion);}
  function caseSpecialty(c){const motivo=norm(c?.motivo),servicio=norm(c?.servicio_requerido||c?.servicio||'');if(motivo==='ATENCION_MATERNA'||motivo==='CE_GINECOOBSTETRICIA')return'GINECOOBSTETRICIA';if(motivo==='CE_ORTOPEDIA')return'ORTOPEDIA';if(motivo==='CE_PEDIATRIA')return'PEDIATRIA';if(motivo==='CE_MEDICINA_INTERNA')return'MEDICINA_INTERNA';if(motivo==='CE_CIRUGIA')return'CIRUGIA';return canonical(servicio);}
  function isCeCase(c){return norm(c?.motivo).startsWith('CE_');}
  function tramoSpecialty(t){if(t?.especialidad_responsable)return canonical(t.especialidad_responsable)||t.especialidad_responsable;const c=typeof caseOf==='function'?caseOf(t?.caso_id):null;return caseSpecialty(c);}
  async function loadProgrammedAppointments(){
    if(typeof sb==='undefined'){ceProgramadas=new Set();return;}
    try{
      const {data,error}=await sb.from('seguimientos_postreferencia').select('tramo_id,estado').eq('tipo','CONSULTA_EXTERNA').eq('estado','PROGRAMADA');
      if(error) throw error;
      ceProgramadas=new Set((data||[]).map(x=>String(x.tramo_id)));
    }catch(e){console.error('SIRRO filtro de citas',e);ceProgramadas=new Set();}
  }
  function appointmentReady(t){const c=typeof caseOf==='function'?caseOf(t?.caso_id):null;if(!isCeCase(c))return true;return ceProgramadas.has(String(t?.id));}
  function belongsToCurrentSpecialist(t){const key=specialistKey();if(!key)return true;if(!appointmentReady(t))return false;const target=tramoSpecialty(t);return !target||target===key;}
  function visibleCaseIds(){const key=specialistKey();if(!key||typeof tramos==='undefined')return null;return new Set(tramos.filter(belongsToCurrentSpecialist).map(t=>String(t.caso_id)));}
  function withSpecialistData(render){const key=specialistKey();if(!key||typeof tramos==='undefined'||typeof cases==='undefined')return render();const allTramos=tramos,allCases=cases,ids=visibleCaseIds();tramos=allTramos.filter(belongsToCurrentSpecialist);cases=allCases.filter(c=>ids.has(String(c.id)));try{return render();}finally{tramos=allTramos;cases=allCases;}}
  function renderSpecialistReceived(){
    const key=specialistKey();
    if(!key||typeof tramos==='undefined'||!Array.isArray(tramos)||typeof profile==='undefined')return;
    const box=document.getElementById('receivedList');
    if(!box||typeof tramoItem!=='function')return;
    const rows=tramos.filter(t=>String(t.establecimiento_destino_id||'')===String(profile.establecimiento_id||'')&&['ENVIADO','RECIBIDO','EN_ATENCION','EVALUADO','HOSPITALIZADO'].includes(String(t.estado_actual||''))&&belongsToCurrentSpecialist(t));
    box.innerHTML=rows.map(t=>tramoItem(t,true)).join('')||'<p class="muted">No hay referencias pendientes.</p>';
  }
  function applySpecialistNavigation(){
    const key=specialistKey();
    if(!key)return;
    const maternal=document.getElementById('maternalMonitorTabBtn');
    if(maternal) maternal.classList.toggle('hidden',key!=='GINECOOBSTETRICIA');
    if(key!=='GINECOOBSTETRICIA'){
      const pane=document.getElementById('tab-materno');
      if(pane&&!pane.classList.contains('hidden')){
        pane.classList.add('hidden');
        document.getElementById('tab-inicio')?.classList.remove('hidden');
        document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active'));
        document.querySelector('#tabs button[data-tab="inicio"]')?.classList.add('active');
      }
    }
  }
  function repaintSpecialistViews(){const key=specialistKey();if(!key)return;withSpecialistData(()=>{if(typeof renderStats==='function')renderStats();});renderSpecialistReceived();applySpecialistNavigation();window.dispatchEvent(new Event('sirro-specialty-filtered'));}
  const originalReceived=typeof window.renderReceived==='function'?window.renderReceived:(typeof renderReceived==='function'?renderReceived:null);
  if(originalReceived&&!originalReceived.__sirroSpecialtyFilter){const wrappedReceived=function(){const r=originalReceived.apply(this,arguments);renderSpecialistReceived();return r;};wrappedReceived.__sirroSpecialtyFilter=true;window.renderReceived=wrappedReceived;try{renderReceived=wrappedReceived;}catch{}}
  document.addEventListener('click',e=>{const b=e.target.closest?.('#tabs button[data-tab="recibidas"],button[onclick*="recibidas"]');if(b){setTimeout(renderSpecialistReceived,0);setTimeout(renderSpecialistReceived,150);}setTimeout(applySpecialistNavigation,0);});
  const tabs=document.getElementById('tabs');if(tabs)new MutationObserver(()=>applySpecialistNavigation()).observe(tabs,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  const originalRefresh=typeof window.refreshAll==='function'?window.refreshAll:null;if(originalRefresh&&!originalRefresh.__sirroSpecialtyFilter){const wrapped=async function(){const result=await originalRefresh.apply(this,arguments);await loadProgrammedAppointments();repaintSpecialistViews();return result;};wrapped.__sirroSpecialtyFilter=true;window.refreshAll=wrapped;}
  window.SIRRO_SPECIALTY_FILTER=Object.freeze({canonical,specialistKey,caseSpecialty,tramoSpecialty,isCeCase,appointmentReady,belongsToCurrentSpecialist,repaintSpecialistViews,loadProgrammedAppointments,renderSpecialistReceived,applySpecialistNavigation});
  const start=async()=>{await loadProgrammedAppointments();repaintSpecialistViews();setTimeout(renderSpecialistReceived,300);setTimeout(applySpecialistNavigation,700);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
