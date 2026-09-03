(() => {
  if(window.__sirroClosedPuerperalContinuityLoaded)return;
  window.__sirroClosedPuerperalContinuityLoaded=true;
  const TZ='America/Tegucigalpa';
  const isClosed=t=>!!t&&['CERRADO','CIERRE_ADMINISTRATIVO_EXTERNO'].includes(t.estado_actual);
  const getTramo=id=>Array.isArray(window.tramos)?window.tramos.find(x=>String(x.id)===String(id)):null;
  const getCase=t=>t&&typeof window.caseOf==='function'?window.caseOf(t.caso_id):null;
  const authorizedClosedOrigin=t=>{const c=getCase(t),p=window.profile;return !!(t&&c&&p?.establecimiento_id&&isClosed(t)&&p.establecimiento_id===c.establecimiento_origen_inicial_id);};
  const originalComplete=window.completePuerperal;
  const originalSave=window.savePuerperalControl;
  const nowHN=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};};
  const hnStamp=(d,t)=>d&&t?`${d}T${t}:00-06:00`:null;

  window.completePuerperal=async function(id,numeroControl){
    const t=getTramo(id);
    if(!authorizedClosedOrigin(t))return typeof originalComplete==='function'?originalComplete.apply(this,arguments):undefined;
    let row=null;
    try{const {data,error}=await sb.from('seguimientos_postreferencia').select('estado,ventana_desde').eq('tramo_id',id).eq('tipo','PUERPERAL').eq('numero_control',numeroControl).maybeSingle();if(error)throw error;row=data;}catch(e){return alert(e?.message||'No fue posible validar el control puerperal.');}
    if(!row)return alert('No existe ese control puerperal.');
    if(row.estado==='COMPLETADA')return alert('Este control puerperal ya fue registrado.');
    if(!row.ventana_desde||Date.now()<new Date(row.ventana_desde).getTime())return alert(`Este control todavía no puede registrarse. Se habilitará a partir de ${new Date(row.ventana_desde).toLocaleString('es-HN',{timeZone:TZ,hour12:false})}.`);
    document.getElementById('sirroDateTimeModal')?.remove();
    const n=nowHN(),prefix=`control-${id}-${numeroControl}`,box=document.createElement('div');
    box.id='sirroDateTimeModal';box.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    box.innerHTML=`<div class="card" style="max-width:540px;width:100%"><h3>Control puerperal ${numeroControl}</h3><div class="notice"><small>La referencia ya está cerrada, pero el seguimiento puerperal continúa activo hasta completar los controles programados.</small></div><div class="actions" style="align-items:end;gap:8px;flex-wrap:wrap;margin-top:8px"><label style="margin:0">Fecha del control<input id="${prefix}-date" type="date" value="${n.date}"></label><label style="margin:0">Hora del control (24 h)<input id="${prefix}-time" type="time" step="60" value="${n.time}"></label></div><label>Observación (opcional)<textarea id="${prefix}-obs" rows="3"></textarea></label><div class="actions"><button class="primary" onclick="savePuerperalControl('${id}',${numeroControl},'${prefix}')">Registrar control</button><button class="ghost" onclick="document.getElementById('sirroDateTimeModal')?.remove()">Cancelar</button></div></div>`;
    document.body.appendChild(box);
  };

  window.savePuerperalControl=async function(id,numeroControl,prefix){
    const t=getTramo(id);
    if(!authorizedClosedOrigin(t))return typeof originalSave==='function'?originalSave.apply(this,arguments):undefined;
    const d=document.getElementById(`${prefix}-date`)?.value,tm=document.getElementById(`${prefix}-time`)?.value,value=hnStamp(d,tm);
    if(!value)return alert('Seleccione la fecha y hora real del control.');
    if(new Date(value).getTime()>Date.now()+60000)return alert('La fecha y hora del control no pueden estar en el futuro.');
    const obs=document.getElementById(`${prefix}-obs`)?.value.trim()||null;
    const {error}=await sb.rpc('sirro_completar_control_puerperal_v2',{p_tramo:id,p_numero_control:numeroControl,p_fecha_control:value,p_observacion:obs});
    if(error)return alert(error.message||'No se pudo registrar el control puerperal.');
    document.getElementById('sirroDateTimeModal')?.remove();
    if(typeof window.refreshAll==='function')await window.refreshAll();
    alert(`Control puerperal ${numeroControl} registrado. El cierre de la referencia se conserva.`);
  };
})();