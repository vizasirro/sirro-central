(() => {
  if (window.__sirroObservacionObstetricaLoaded) return;
  window.__sirroObservacionObstetricaLoaded = true;

  const TZ = 'America/Tegucigalpa';
  let obsRows = [];

  const fmtObs = v => v ? new Date(v).toLocaleString('es-HN',{timeZone:TZ,hour12:false}) : '';
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  const isMaternal = t => {
    const c = typeof caseOf === 'function' ? caseOf(t?.caso_id) : null;
    return c?.motivo === 'ATENCION_MATERNA';
  };
  const isHospitalDestination = t => profile?.rol === 'USUARIO_HOSPITAL' && profile?.establecimiento_id === t?.establecimiento_destino_id;
  const isClosed = t => !!t && ['CERRADO','CIERRE_ADMINISTRATIVO_EXTERNO'].includes(t.estado_actual);
  const rowsFor = id => obsRows.filter(x => x.tramo_id === id).sort((a,b)=>Number(a.numero_valoracion||0)-Number(b.numero_valoracion||0));

  async function loadObs(){
    if(typeof sb === 'undefined') return;
    try{
      const {data,error}=await sb.from('observaciones_obstetricas').select('*').order('creado_en',{ascending:true});
      if(error) throw error;
      obsRows=data||[];
    }catch(e){
      console.error('SIRRO observación obstétrica',e);
      obsRows=[];
    }
  }

  function statusLabel(v){
    return ({
      EN_OBSERVACION:'Continúa en observación',
      REEVALUADA:'Reevaluada',
      INGRESO:'Se decide ingreso',
      LABOR_PARTO:'Pasa a labor y parto',
      ALTA:'Alta',
      REFERENCIA:'Referencia/traslado'
    })[v] || v || '';
  }

  function obsHtml(t){
    if(!isMaternal(t) || !isHospitalDestination(t)) return '';
    const rows=rowsFor(t.id), last=rows[rows.length-1], closed=isClosed(t);
    const next=last?.proxima_valoracion ? new Date(last.proxima_valoracion) : null;
    const due=next && Date.now() >= next.getTime();
    const title=rows.length ? 'Observación obstétrica preparto' : 'Valoración obstétrica preparto';
    let detail='';
    if(!rows.length){
      detail='Registre la hora de la primera valoración y, si corresponde, programe la próxima reevaluación. SIRRO solo registra tiempos y estado administrativo; los hallazgos clínicos permanecen en el expediente.';
    }else{
      detail=`Última valoración: <strong>${esc(fmtObs(last.fecha_valoracion))}</strong> · ${esc(statusLabel(last.resultado))}.`;
      if(next) detail += `<br>${due?'<strong>REEVALUACIÓN PENDIENTE:</strong>':'Próxima reevaluación:'} <strong>${esc(fmtObs(last.proxima_valoracion))}</strong>.`;
      else detail += '<br>Sin próxima reevaluación programada.';
    }
    const action=closed?'':`<div class="actions"><button type="button" class="ghost" onclick="sirroOpenObsObstetrica('${t.id}')">${rows.length?'Registrar reevaluación':'Registrar primera valoración'}</button></div>`;
    return `<div class="notice ${due?'error':''}"><strong>${title}</strong><br>${detail}${action}<small>Puede registrarlo personal autorizado del servicio obstétrico: Auxiliar de Enfermería, Licenciada de Enfermería o médico del servicio.</small></div>`;
  }

  const previousTramoItem = typeof tramoItem === 'function' ? tramoItem : null;
  if(previousTramoItem){
    tramoItem=function(t,withActions=true){
      const html=previousTramoItem(t,withActions), extra=obsHtml(t);
      if(!extra) return html;
      const i=html.lastIndexOf('</div>');
      return i>=0?html.slice(0,i)+extra+html.slice(i):html+extra;
    };
  }

  const previousRefresh = typeof refreshAll === 'function' ? refreshAll : null;
  if(previousRefresh){
    refreshAll=async function(){
      await loadObs();
      return previousRefresh.apply(this,arguments);
    };
  }

  function hnNow(){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
  }
  function toHN(dateId,timeId){
    const d=document.getElementById(dateId)?.value,t=document.getElementById(timeId)?.value;
    return d&&t?`${d}T${t}:00-06:00`:null;
  }
  function setNextHours(hours){
    const base=toHN('obs-current-date','obs-current-time') || new Date().toISOString();
    const d=new Date(new Date(base).getTime()+hours*3600000);
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    const dd=document.getElementById('obs-next-date'),tt=document.getElementById('obs-next-time');
    if(dd)dd.value=`${p.year}-${p.month}-${p.day}`;
    if(tt)tt.value=`${p.hour}:${p.minute}`;
  }

  window.sirroOpenObsObstetrica=function(id){
    const t=Array.isArray(tramos)?tramos.find(x=>String(x.id)===String(id)):null;
    if(!t||!isMaternal(t)||!isHospitalDestination(t)||isClosed(t)) return alert('Esta valoración obstétrica no está disponible para este caso.');
    document.getElementById('sirroObsObModal')?.remove();
    const n=hnNow(), rows=rowsFor(id), num=rows.length+1;
    const box=document.createElement('div');
    box.id='sirroObsObModal';
    box.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    box.innerHTML=`<div class="card" style="max-width:620px;width:100%;max-height:92vh;overflow:auto"><h3>${num===1?'Primera valoración obstétrica':'Reevaluación obstétrica '+num}</h3><p class="muted">Registre únicamente fecha/hora y decisión administrativa. Tacto vaginal, foco fetal y demás hallazgos clínicos deben quedar en el expediente.</p><div class="formgrid"><label>Fecha de valoración<input id="obs-current-date" type="date" value="${n.date}"></label><label>Hora de valoración (24 h)<input id="obs-current-time" type="time" value="${n.time}"></label><label>Resultado<select id="obs-result"><option value="EN_OBSERVACION">Continúa en observación</option><option value="REEVALUADA">Reevaluada</option><option value="INGRESO">Se decide ingreso</option><option value="LABOR_PARTO">Pasa a labor y parto</option><option value="ALTA">Alta</option><option value="REFERENCIA">Referencia / traslado</option></select></label></div><h4>Próxima reevaluación (si corresponde)</h4><div class="formgrid"><label>Fecha<input id="obs-next-date" type="date"></label><label>Hora (24 h)<input id="obs-next-time" type="time"></label></div><div class="actions"><button type="button" class="ghost" onclick="sirroObsQuick(4)">+4 h</button><button type="button" class="ghost" onclick="sirroObsQuick(6)">+6 h</button><button type="button" class="ghost" onclick="sirroObsQuick(12)">+12 h</button><button type="button" class="ghost" onclick="sirroObsQuick(24)">+24 h</button></div><div class="notice"><small>Los accesos rápidos son solo una ayuda de programación; la hora real de reevaluación la determina el personal clínico según la condición materno-fetal.</small></div><div class="actions"><button type="button" class="primary" onclick="sirroSaveObsObstetrica('${id}')">Guardar</button><button type="button" class="ghost" onclick="document.getElementById('sirroObsObModal')?.remove()">Cancelar</button></div></div>`;
    document.body.appendChild(box);
  };
  window.sirroObsQuick=setNextHours;

  window.sirroSaveObsObstetrica=async function(id){
    const current=toHN('obs-current-date','obs-current-time');
    if(!current) return alert('Seleccione fecha y hora de la valoración.');
    const nd=document.getElementById('obs-next-date')?.value, nt=document.getElementById('obs-next-time')?.value;
    if((nd&&!nt)||(!nd&&nt)) return alert('Para programar la próxima reevaluación seleccione fecha y hora.');
    const next=nd&&nt?`${nd}T${nt}:00-06:00`:null;
    if(next && new Date(next)<=new Date(current)) return alert('La próxima reevaluación debe ser posterior a la valoración actual.');
    const result=document.getElementById('obs-result')?.value||'EN_OBSERVACION';
    const {error}=await sb.rpc('sirro_registrar_valoracion_obstetrica',{p_tramo:id,p_fecha_valoracion:current,p_proxima_valoracion:next,p_resultado:result});
    if(error) return alert(error.message||'No se pudo registrar la valoración obstétrica.');
    document.getElementById('sirroObsObModal')?.remove();
    if(typeof refreshAll==='function') await refreshAll();
    alert(next?'Valoración registrada. SIRRO mostrará la próxima reevaluación programada.':'Valoración registrada.');
  };

  loadObs().then(()=>{if(typeof renderReceived==='function')renderReceived();if(typeof renderTracking==='function')renderTracking();});
})();
