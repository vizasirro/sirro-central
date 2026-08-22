(() => {
  let postFollowups = [];

  const isDateInput = v => /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(String(v || '').trim());
  const hnTimestamp = v => String(v).trim().replace(' ', 'T') + ':00-06:00';
  const fmtFollowup = v => v ? new Date(v).toLocaleString('es-HN') : '';

  async function loadPostFollowups(){
    try{
      const {data,error}=await sb.from('seguimientos_postreferencia').select('*').order('creado_en',{ascending:false});
      if(error)throw error;
      postFollowups=data||[];
    }catch{
      postFollowups=[];
    }
  }

  function followupForTramo(id){
    return postFollowups.filter(x=>x.tramo_id===id);
  }

  function followupHtml(t){
    const rows=followupForTramo(t.id);
    if(!rows.length)return '';
    return rows.map(s=>{
      if(s.tipo==='PUERPERAL'){
        const done=s.estado==='COMPLETADA';
        const action=!done && profile?.establecimiento_id===caseOf(t.caso_id)?.establecimiento_origen_inicial_id
          ? `<div class="actions"><button class="ghost" onclick="completePuerperal('${t.id}')">Marcar control puerperal realizado</button></div>`:'';
        return `<div class="notice ${done?'ok':''}"><strong>Seguimiento puerperal</strong><br>${done?'Control registrado como realizado.':`Control obligatorio entre <strong>${esc(fmtFollowup(s.ventana_desde))}</strong> y <strong>${esc(fmtFollowup(s.ventana_hasta))}</strong> (24–48 horas después del alta).`} ${action}</div>`;
      }
      if(s.tipo==='CONSULTA_EXTERNA'){
        const pending=s.estado==='PENDIENTE_ASIGNACION';
        const ageHours=(Date.now()-new Date(s.creado_en).getTime())/3600000;
        const alertText=pending?(ageHours>=48?' · ALERTA ROJA: más de 48 h sin cita':ageHours>=24?' · ALERTA AMARILLA: más de 24 h sin cita':''):'';
        const action=pending && profile?.establecimiento_id===t.establecimiento_destino_id
          ? `<div class="actions"><button class="ghost" onclick="assignCeAppointment('${t.id}')">Asignar cita</button></div>`:'';
        return `<div class="notice"><strong>Consulta Externa</strong><br>${pending?`Cita pendiente de asignación${esc(alertText)}.`:`Cita programada para <strong>${esc(fmtFollowup(s.fecha_cita))}</strong>.`} ${action}</div>`;
      }
      return '';
    }).join('');
  }

  const baseTramoItem=tramoItem;
  tramoItem=function(t,withActions=true){
    const html=baseTramoItem(t,withActions);
    const extra=followupHtml(t);
    if(!extra)return html;
    const i=html.lastIndexOf('</div>');
    return i>=0?html.slice(0,i)+extra+html.slice(i):html+extra;
  };

  const baseRefreshAll=refreshAll;
  refreshAll=async function(){
    await loadPostFollowups();
    await baseRefreshAll();
  };

  answerTramo=async function(id){
    const detail=prompt('Escriba la respuesta / contrarreferencia:');
    if(!detail?.trim())return;
    const t=tramos.find(x=>x.id===id), c=caseOf(t?.caso_id);
    if(!t||!c)return;

    let parto=null, fechaAlta=null, citaEstado=null, fechaCita=null;

    if(c.motivo==='ATENCION_MATERNA'){
      parto=confirm('ATENCIÓN MATERNA\n\n¿La paciente tuvo parto durante esta atención?\n\nAceptar = Sí · Cancelar = No');
      if(parto){
        const alta=prompt('Fecha y hora del ALTA hospitalaria (AAAA-MM-DD HH:MM).\n\nEs obligatoria para calcular el control puerperal de 24–48 horas:');
        if(alta===null)return;
        if(!isDateInput(alta))return alert('Formato inválido. Use AAAA-MM-DD HH:MM, por ejemplo: 2026-08-22 14:30.');
        fechaAlta=hnTimestamp(alta);
      }
    }

    if(String(c.motivo||'').startsWith('CE_')){
      const cita=prompt('CONSULTA EXTERNA\n\nEscriba la fecha y hora de la cita (AAAA-MM-DD HH:MM).\nSi todavía no ha sido asignada, escriba: PENDIENTE');
      if(cita===null)return;
      if(String(cita).trim().toUpperCase()==='PENDIENTE'){
        citaEstado='PENDIENTE_ASIGNACION';
      }else{
        if(!isDateInput(cita))return alert('Formato inválido. Use AAAA-MM-DD HH:MM o escriba PENDIENTE.');
        citaEstado='PROGRAMADA';
        fechaCita=hnTimestamp(cita);
      }
    }

    const mode=t.parent_tramo_id&&confirm('¿Enviar la respuesta directamente al establecimiento que originó el caso?\nAceptar: respuesta directa.\nCancelar: respuesta por la cadena de referencia.')?'DIRECTO_ORIGINADOR':'ORIGEN_TRAMO';
    const {error}=await sb.rpc('sirro_enviar_respuesta_v3',{
      p_tramo:id,
      p_detalle:detail.trim(),
      p_modo:mode,
      p_parto:parto,
      p_fecha_alta:fechaAlta,
      p_cita_estado:citaEstado,
      p_fecha_cita:fechaCita
    });
    if(error)return alert(error.message);
    await refreshAll();
  };

  window.assignCeAppointment=async function(id){
    const cita=prompt('Fecha y hora de la cita de Consulta Externa (AAAA-MM-DD HH:MM):');
    if(cita===null)return;
    if(!isDateInput(cita))return alert('Formato inválido. Use AAAA-MM-DD HH:MM.');
    const {error}=await sb.rpc('sirro_asignar_cita_ce',{p_tramo:id,p_fecha_cita:hnTimestamp(cita)});
    if(error)return alert(error.message);
    await refreshAll();
  };

  window.completePuerperal=async function(id){
    const obs=prompt('Observación del control puerperal realizado (opcional):');
    if(obs===null)return;
    const {error}=await sb.rpc('sirro_completar_control_puerperal',{p_tramo:id,p_observacion:obs.trim()||null});
    if(error)return alert(error.message);
    await refreshAll();
  };

  const start=async()=>{
    await loadPostFollowups();
    try{renderTracking();renderReceived();}catch{}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
