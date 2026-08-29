(() => {
  const isCitas = () => typeof profile !== 'undefined' && profile?.rol === 'USUARIO_HOSPITAL' && profile?.tipo_usuario_hospital === 'ATENCION_PACIENTE_CITAS';
  const norm = window.SIRRO?.utils?.normalize || (v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase());
  const sharedSpecialtyLabel = window.SIRRO?.utils?.specialtyLabel;
  const isCeCase = c => norm(c?.motivo).startsWith('CE_');
  const ceRowsFor = id => (typeof followups!=='undefined'&&Array.isArray(followups)?followups:[]).filter(s=>String(s.tramo_id)===String(id)&&s.tipo==='CONSULTA_EXTERNA');
  const hasScheduledCe = (id,html='') => ceRowsFor(id).some(s=>s.estado==='PROGRAMADA'&&s.fecha_cita) || /Cita programada para/i.test(String(html));

  function specialtyLabel(c){
    if (typeof sharedSpecialtyLabel === 'function') return sharedSpecialtyLabel(c);
    const m=norm(c?.motivo);
    if(m==='CE_PEDIATRIA') return 'Pediatría';
    if(m==='CE_GINECOOBSTETRICIA') return 'Gineco-Obstetricia';
    if(m==='CE_MEDICINA_INTERNA') return 'Medicina Interna';
    if(m==='CE_CIRUGIA') return 'Cirugía';
    if(m==='CE_ORTOPEDIA') return 'Ortopedia';
    return c?.servicio_requerido || 'Consulta Externa';
  }

  function citasRows(){
    if(!isCitas() || typeof tramos==='undefined' || !Array.isArray(tramos)) return [];
    return tramos.filter(t=>{
      if(String(t?.establecimiento_destino_id||'')!==String(profile?.establecimiento_id||'')) return false;
      if(['CERRADO','CIERRE_ADMINISTRATIVO_EXTERNO','ANULADO','RECHAZADO'].includes(String(t?.estado_actual||''))) return false;
      const c=typeof caseOf==='function'?caseOf(t?.caso_id):null;
      if(!c || !isCeCase(c)) return false;
      // Las urgentes van directamente al especialista; Gestión de Citas maneja CE no urgentes.
      return norm(c?.tipo)!=='URGENTE';
    });
  }

  function renderCitasReceived(){
    if(!isCitas()) return;
    const box=document.getElementById('receivedList');
    if(!box) return;
    const rows=citasRows();
    box.innerHTML=rows.map(t=>typeof tramoItem==='function'?tramoItem(t,true):'').join('')||'<p class="muted">No hay referencias de Consulta Externa pendientes de gestión.</p>';
    queueMicrotask(applyCitasUi);
  }

  function installTramoAppointmentButton(){
    const fn=window.tramoItem;
    if(typeof fn!=='function'||fn.__sirroCitasButton)return;
    const wrapped=function(t,withActions=true){
      let html=fn.apply(this,arguments);
      if(!isCitas()||!withActions) return html;
      const c=typeof caseOf==='function'?caseOf(t?.caso_id):null;
      const eligible=!!c&&isCeCase(c)&&norm(c?.tipo)!=='URGENTE'&&profile?.establecimiento_id===t?.establecimiento_destino_id&&!['CERRADO','CIERRE_ADMINISTRATIVO_EXTERNO','ANULADO','RECHAZADO'].includes(String(t?.estado_actual||''));
      if(!eligible) return html;
      if(html.includes(`assignCeAppointment('${t.id}')`)) return html;
      const scheduled=hasScheduledCe(t.id,html);
      const pos=html.lastIndexOf('</div>');
      const action=`<div class="actions"><button type="button" class="primary" onclick="assignCeAppointment('${t.id}')">${scheduled?'REPROGRAMAR CITA':'ASIGNAR CITA'}</button></div>`;
      return pos>=0?html.slice(0,pos)+action+html.slice(pos):html+action;
    };
    wrapped.__sirroCitasButton=true;
    window.tramoItem=wrapped;
    try{tramoItem=wrapped;}catch{}
  }

  function hasPendingCeAction(){
    if(!isCitas()) return false;
    return citasRows().some(t=>ceRowsFor(t.id).some(s=>s.estado==='PENDIENTE_ASIGNACION'));
  }

  function sanitizePendingUi(){
    if(!isCitas()) return;
    const forbidden=['RESPUESTA / CONTRARREFERENCIA PENDIENTE','EVALUACION PENDIENTE','REFERENCIA POR RECIBIR','REGISTRAR FECHA Y HORA DEL PARTO','RESPUESTA LISTA PARA CONFIRMAR','REFERENCIA RECHAZADA POR CORREGIR'];
    const details=document.getElementById('sirroPendingDetails');
    if(details){
      [...details.children].forEach(row=>{
        const text=norm(row.textContent);
        if(forbidden.some(x=>text.includes(x))) row.remove();
      });
      const actionable=[...details.children].filter(x=>x.querySelector('button') && !norm(x.textContent).startsWith('REQUIERE MI ATENCION') && !norm(x.textContent).startsWith('LO PENDIENTE'));
      if(!actionable.length && details.textContent.trim()) details.innerHTML='<div class="notice ok">No hay acciones pendientes para Gestión de Citas.</div>';
    }
    if(!hasPendingCeAction()){
      const preview=document.getElementById('sirroPendingPreview');
      const count=document.getElementById('sirroPendingCount');
      if(count) count.textContent='0';
      document.getElementById('sirroRequiresAttentionBanner')?.remove();
      if(preview) preview.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" style="background:#fff1f2;border:2px solid #dc2626;color:#991b1b;padding:12px 16px;border-radius:12px;font:inherit;font-weight:750;cursor:default">0 PENDIENTES</button><button type="button" style="background:#fffbeb;border:2px solid #d97706;color:#92400e;padding:12px 16px;border-radius:12px;font:inherit;font-weight:750;cursor:default">0 REQUIERE MI ATENCIÓN</button></div><div class="notice ok" style="margin-top:10px">No hay acciones pendientes para Gestión de Citas.</div>';
      if(details) details.innerHTML='';
    }
  }

  function applyCitasUi(){
    if(!isCitas()) return;
    const nueva=document.querySelector('#tabs button[data-tab="nueva"]');
    if(nueva) nueva.classList.add('hidden');
    const nuevaPane=document.getElementById('tab-nueva');
    if(nuevaPane && !nuevaPane.classList.contains('hidden')){
      nuevaPane.classList.add('hidden');
      document.getElementById('tab-inicio')?.classList.remove('hidden');
      document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active'));
      document.querySelector('#tabs button[data-tab="inicio"]')?.classList.add('active');
    }
    const transfers=document.getElementById('sirroTransfersCard');
    if(transfers) transfers.classList.add('hidden');
    document.querySelectorAll('button[onclick]').forEach(b=>{
      const h=b.getAttribute('onclick')||'';
      if(/receiveTramo|rejectTramo|evaluateTramo|answerTramo|secondaryTramo|sirroTransferSpecialty|requestSpecialtyTransfer/i.test(h)) b.remove();
      if(/assignCeAppointment/i.test(h)){
        const card=b.closest('.item,.card')||b.parentElement?.parentElement;
        if(card&&/Cita programada para/i.test(card.textContent||'')) b.textContent='REPROGRAMAR CITA';
      }
    });
    sanitizePendingUi();
  }

  function wrapBlocked(name,message){
    const fn=window[name];
    if(typeof fn!=='function'||fn.__sirroCitasBlocked)return;
    const wrapped=function(){ if(isCitas()) return alert(message); return fn.apply(this,arguments); };
    wrapped.__sirroCitasBlocked=true;
    window[name]=wrapped;
    try{globalThis[name]=wrapped;}catch{}
  }

  function installGuards(){
    wrapBlocked('createRef','Gestión de Citas no puede crear nuevas referencias.');
    wrapBlocked('receiveTramo','Gestión de Citas no puede recibir clínicamente una referencia.');
    wrapBlocked('rejectTramo','Gestión de Citas no puede rechazar clínicamente una referencia.');
    wrapBlocked('evaluateTramo','Gestión de Citas no puede registrar evaluación clínica.');
    wrapBlocked('answerTramo','Gestión de Citas no puede emitir respuesta o contrarreferencia.');
    wrapBlocked('secondaryTramo','Gestión de Citas no puede emitir referencia secundaria.');
  }

  function installAppointmentModal(){
    if(!isCitas() || typeof window.assignCeAppointment!=='function' || window.assignCeAppointment.__sirroCitasSpecialty) return;
    const wrapped=async function(id){
      const t=(typeof tramos!=='undefined'?tramos:[]).find(x=>String(x.id)===String(id));
      const c=t&&typeof caseOf==='function'?caseOf(t.caso_id):null;
      if(!t||!c||!isCeCase(c)||norm(c?.tipo)==='URGENTE') return alert('No se encontró una referencia de Consulta Externa válida para Gestión de Citas.');
      const label=specialtyLabel(c), reprogram=hasScheduledCe(id,document.body?.innerText||'');
      document.getElementById('sirroDateTimeModal')?.remove();
      const box=document.createElement('div');
      box.id='sirroDateTimeModal';
      box.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
      box.innerHTML=`<div class="card" style="max-width:540px;width:100%"><h3>${reprogram?'Reprogramar':'Programar'} cita de Consulta Externa</h3><div class="readonlybox"><strong>Especialidad solicitada:</strong> ${typeof esc==='function'?esc(label):label}</div>${reprogram?'<div class="notice"><small>La cita ya está programada. Esta acción modificará su fecha y/o hora y conservará el registro administrativo correspondiente.</small></div>':''}<div class="actions" style="align-items:end;gap:8px;flex-wrap:wrap;margin-top:10px"><label style="margin:0">Fecha de la cita<input id="ce-${id}-date" type="date" required></label><label style="margin:0">Hora de la cita (24 h)<input id="ce-${id}-time" type="time" step="60" required></label></div><div class="actions"><button class="primary" onclick="saveCeDateTime('${id}')">${reprogram?'Guardar reprogramación':'Guardar cita'}</button><button class="ghost" onclick="closeClinicalDateTime()">Cancelar</button></div></div>`;
      document.body.appendChild(box);
    };
    wrapped.__sirroCitasSpecialty=true;
    window.assignCeAppointment=wrapped;
  }

  function patchRender(name){
    const fn=window[name];
    if(typeof fn!=='function'||fn.__sirroCitasPatched)return;
    const wrapped=function(){const r=fn.apply(this,arguments);queueMicrotask(()=>{if(name==='renderReceived')renderCitasReceived();applyCitasUi();});return r;};
    wrapped.__sirroCitasPatched=true;
    window[name]=wrapped;
    try{globalThis[name]=wrapped;}catch{}
  }

  function loadCeNotificationUi(){
    if(document.querySelector('script[src="./ce-notification-ui.js"]'))return;
    const s=document.createElement('script');s.src='./ce-notification-ui.js';s.defer=true;document.head.appendChild(s);
  }

  function install(){
    loadCeNotificationUi();installGuards();installTramoAppointmentButton();patchRender('renderReceived');patchRender('renderTracking');patchRender('renderStats');installAppointmentModal();applyCitasUi();renderCitasReceived();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
  window.addEventListener('pageshow',install);window.addEventListener('sirro-specialty-filtered',install);setInterval(install,1200);
  window.SIRRO_APPOINTMENT_ROLE=Object.freeze({isCitas,specialtyLabel,isCeCase,applyCitasUi,sanitizePendingUi,renderCitasReceived,citasRows});
})();
