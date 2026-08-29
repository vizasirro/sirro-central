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
  function repaintSpecialistViews(){const key=specialistKey();if(!key)return;withSpecialistData(()=>{if(typeof renderStats==='function')renderStats();if(typeof renderReceived==='function')renderReceived();});window.dispatchEvent(new Event('sirro-specialty-filtered'));}
  const originalReceived=typeof window.renderReceived==='function'?window.renderReceived:(typeof renderReceived==='function'?renderReceived:null);
  if(originalReceived&&!originalReceived.__sirroSpecialtyFilter){const wrappedReceived=function(){return withSpecialistData(()=>originalReceived.apply(this,arguments));};wrappedReceived.__sirroSpecialtyFilter=true;window.renderReceived=wrappedReceived;try{renderReceived=wrappedReceived;}catch{}}
  const originalRefresh=typeof window.refreshAll==='function'?window.refreshAll:null;if(originalRefresh&&!originalRefresh.__sirroSpecialtyFilter){const wrapped=async function(){const result=await originalRefresh.apply(this,arguments);await loadProgrammedAppointments();repaintSpecialistViews();return result;};wrapped.__sirroSpecialtyFilter=true;window.refreshAll=wrapped;}
  window.SIRRO_SPECIALTY_FILTER=Object.freeze({canonical,specialistKey,caseSpecialty,tramoSpecialty,isCeCase,appointmentReady,belongsToCurrentSpecialist,repaintSpecialistViews,loadProgrammedAppointments});
  const start=async()=>{await loadProgrammedAppointments();repaintSpecialistViews();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
