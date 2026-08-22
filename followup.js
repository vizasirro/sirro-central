(() => {
  let postFollowups = [];

  const isDateInput = v => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(v || '').trim()) || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(v || '').trim());
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
    return postFollowups.filter(x=>x.tramo_id===id).sort((a,b)=>(a.numero_control||0)-(b.numero_control||0));
  }

  function canCompletePuerperal(t){
    const c=caseOf(t.caso_id);
    if(!profile?.establecimiento_id||!c)return false;
    if(t.estado_actual==='HOSPITALIZADO'){
      return profile.rol==='USUARIO_HOSPITAL' && profile.establecimiento_id===t.establecimiento_destino_id;
    }
    return profile.establecimiento_id===c.establecimiento_origen_inicial_id;
  }

  function deliveryRegistrationHtml(t){
    const c=caseOf(t.caso_id);
    if(!c || c.motivo!=='ATENCION_MATERNA')return '';
    const hospitalUser=profile?.rol==='USUARIO_HOSPITAL' && profile?.establecimiento_id===t.establecimiento_destino_id;
    if(!hospitalUser)return '';
    const control1=followupForTramo(t.id).find(x=>x.tipo==='PUERPERAL' && Number(x.numero_control||1)===1);
    const parto=control1?.fecha_base;
    const inputId=`parto-${t.id}`;
    return `<div class="notice ${parto?'ok':''}">
      <strong>Fecha y hora del parto</strong><br>
      ${parto?`Registrada: <strong>${esc(fmtFollowup(parto))}</strong><br>`:'Debe registrarse para iniciar automáticamente los controles puerperales.<br>'}
      <div class="actions" style="align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px">
        <input id="${inputId}" type="datetime-local" aria-label="Fecha y hora del parto" style="max-width:230px">
        <button class="ghost" onclick="registerDelivery('${t.id}')">${parto?'Actualizar fecha/hora':'Registrar parto'}</button>
      </div>
      <small>Puede registrarlo un usuario hospitalario autorizado, incluida auxiliar de enfermería con perfil hospitalario.</small>
    </div>`;
  }

  function followupHtml(t){
    const rows=followupForTramo(t.id);
    if(!rows.length)return '';
    return rows.map(s=>{
      if(s.tipo==='PUERPERAL'){
        const done=s.estado==='COMPLETADA';
        const n=Number(s.numero_control||1);
        const action=!done && canCompletePuerperal(t)
          ? `<div class="actions"><button class="ghost" onclick="completePuerperal('${t.id}',${n})">Marcar control ${n} realizado</button></div>`:'';
        let schedule='';
        if(n===1){
          schedule=`Primer control: <strong>a las 48 horas del parto</strong> · ${esc(fmtFollowup(s.ventana_desde))}.`;
        }else if(n===2){
          schedule=`Segundo control: entre <strong>${esc(fmtFollowup(s.ventana_desde))}</strong> y <strong>${esc(fmtFollowup(s.ventana_hasta))}</strong> (3–7 días después del parto).`;
        }else{
          schedule=`Control puerperal ${n}.`;
        }
        const responsible=t.estado_actual==='HOSPITALIZADO'?'Responsable actual: hospital (paciente continúa ingresada).':'Responsable actual: establecimiento de origen después del alta.';
        return `<div class="notice ${done?'ok':''}"><strong>Control puerperal ${n}</strong><br>${done?`Control registrado como realizado${s.completado_en?` el <strong>${esc(fmtFollowup(s.completado_en))}</strong>`:''}.`:`${schedule}<br>${responsible}`} ${action}</div>`;
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
    const extra=deliveryRegistrationHtml(t)+followupHtml(t);
    if(!extra)return html;
    const i=html.lastIndexOf('</div>');
    return i>=0?html.slice(0,i)+extra+html.slice(i):html+extra;
  };

  const baseRefreshAll=refreshAll;
  refreshAll=async function(){
    await loadPostFollowups();
    await baseRefreshAll();
  };

  window.registerDelivery=async function(id){
    const el=document.getElementById(`parto-${id}`);
    const value=el?.value;
    if(!isDateInput(value))return alert('Seleccione la fecha y la hora del parto.');
    const existing=followupForTramo(id).find(x=>x.tipo==='PUERPERAL' && Number(x.numero_control||1)===1)?.fecha_base;
    if(existing && !confirm('Ya existe una fecha y hora de parto. ¿Desea actualizarla? El cambio quedará auditado y recalculará los controles puerperales.'))return;
    const {error}=await sb.rpc('sirro_registrar_parto',{p_tramo:id,p_fecha_parto:hnTimestamp(value)});
    if(error)return alert(error.message);
    await refreshAll();
    alert('Fecha y hora del parto registradas. Los controles puerperales fueron calculados automáticamente.');
  };

  answerTramo=async function(id){
    const detail=prompt('Escriba la respuesta / contrarreferencia:');
    if(!detail?.trim())return;
    const t=tramos.find(x=>x.id===id), c=caseOf(t?.caso_id);
    if(!t||!c)return;

    let citaEstado=null, fechaCita=null;

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
      p_parto:null,
      p_fecha_alta:null,
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

  window.completePuerperal=async function(id,numeroControl){
    const obs=prompt(`Observación del control puerperal ${numeroControl} realizado (opcional):`);
    if(obs===null)return;
    const {error}=await sb.rpc('sirro_completar_control_puerperal',{p_tramo:id,p_observacion:obs.trim()||null,p_numero_control:numeroControl});
    if(error)return alert(error.message);
    await refreshAll();
  };

  const start=async()=>{
    await loadPostFollowups();
    try{renderTracking();renderReceived();}catch{}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
