(() => {
  const isCitas = () => typeof profile !== 'undefined' && profile?.rol === 'USUARIO_HOSPITAL' && profile?.tipo_usuario_hospital === 'ATENCION_PACIENTE_CITAS';
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();

  function specialtyLabel(c){
    const m=norm(c?.motivo);
    if(m==='CE_PEDIATRIA') return 'Pediatría';
    if(m==='CE_GINECOOBSTETRICIA') return 'Gineco-Obstetricia';
    if(m==='CE_MEDICINA_INTERNA') return 'Medicina Interna';
    if(m==='CE_CIRUGIA') return 'Cirugía';
    if(m==='CE_ORTOPEDIA') return 'Ortopedia';
    return c?.servicio_requerido || 'Consulta Externa';
  }

  function applyCitasUi(){
    if(!isCitas()) return;
    const nueva=document.querySelector('#tabs button[data-tab="nueva"]');
    if(nueva) nueva.classList.add('hidden');
    document.querySelectorAll('button[onclick]').forEach(b=>{
      const h=b.getAttribute('onclick')||'';
      if(/receiveTramo|rejectTramo|evaluateTramo|answerTramo|secondaryTramo|transferSpecialty|requestSpecialtyTransfer/i.test(h)) b.remove();
    });
  }

  function wrapBlocked(name,message){
    const fn=window[name];
    if(typeof fn!=='function'||fn.__sirroCitasBlocked)return;
    const wrapped=function(){ if(isCitas()) return alert(message); return fn.apply(this,arguments); };
    wrapped.__sirroCitasBlocked=true;
    window[name]=wrapped;
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
      if(!t||!c) return alert('No se encontró la referencia.');
      const label=specialtyLabel(c);
      document.getElementById('sirroDateTimeModal')?.remove();
      const box=document.createElement('div');
      box.id='sirroDateTimeModal';
      box.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
      box.innerHTML=`<div class="card" style="max-width:540px;width:100%"><h3>Programar cita de Consulta Externa</h3><div class="readonlybox"><strong>Especialidad solicitada:</strong> ${typeof esc==='function'?esc(label):label}</div><div class="actions" style="align-items:end;gap:8px;flex-wrap:wrap;margin-top:10px"><label style="margin:0">Fecha de la cita<input id="ce-${id}-date" type="date" required></label><label style="margin:0">Hora de la cita (24 h)<input id="ce-${id}-time" type="time" step="60" required></label></div><div class="actions"><button class="primary" onclick="saveCeDateTime('${id}')">Guardar cita</button><button class="ghost" onclick="closeClinicalDateTime()">Cancelar</button></div></div>`;
      document.body.appendChild(box);
    };
    wrapped.__sirroCitasSpecialty=true;
    window.assignCeAppointment=wrapped;
  }

  function patchRender(name){
    const fn=window[name];
    if(typeof fn!=='function'||fn.__sirroCitasPatched)return;
    const wrapped=function(){const r=fn.apply(this,arguments);queueMicrotask(applyCitasUi);return r;};
    wrapped.__sirroCitasPatched=true;
    window[name]=wrapped;
  }

  function install(){
    installGuards();
    patchRender('renderReceived');
    patchRender('renderTracking');
    patchRender('renderStats');
    installAppointmentModal();
    applyCitasUi();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
  window.addEventListener('pageshow',install);
  window.addEventListener('sirro-specialty-filtered',install);
  setInterval(install,1200);
  window.SIRRO_APPOINTMENT_ROLE=Object.freeze({isCitas,specialtyLabel,applyCitasUi});
})();
