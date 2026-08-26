(() => {
  let transferencias=[];
  const specialties=['GINECOOBSTETRICIA','ORTOPEDIA','PEDIATRIA','MEDICINA_INTERNA','CIRUGIA'];
  const labels={GINECOOBSTETRICIA:'Gineco-Obstetricia',ORTOPEDIA:'Ortopedia',PEDIATRIA:'Pediatría',MEDICINA_INTERNA:'Medicina Interna',CIRUGIA:'Cirugía'};
  const api=()=>window.SIRRO_SPECIALTY_FILTER;
  const mySpecialty=()=>api()?.specialistKey?.()||null;
  const caseFor=t=>typeof caseOf==='function'?caseOf(t?.caso_id):null;
  const maternal=t=>String(caseFor(t)?.motivo||'')==='ATENCION_MATERNA';
  const pendingFor=id=>transferencias.find(x=>String(x.tramo_id)===String(id)&&x.estado==='PENDIENTE');
  function canTransfer(t){const s=mySpecialty();return !!s&&profile?.rol==='USUARIO_HOSPITAL'&&profile?.establecimiento_id===t?.establecimiento_destino_id&&['EN_ATENCION','EVALUADO','HOSPITALIZADO'].includes(t?.estado_actual)&&api()?.tramoSpecialty?.(t)===s&&!maternal(t)&&!pendingFor(t.id);}

  function hasTransferButton(html,id){
    const marker=`sirroTransferSpecialty('${id}')`;
    return String(html||'').includes(marker)||String(html||'').includes('>Transferir especialidad</button>');
  }
  function installTramoButton(){
    const original=window.tramoItem;
    if(typeof original!=='function'||original.__sirroTransfer)return;
    const wrapped=function(t,withActions=true){
      let html=original.apply(this,arguments);
      if(withActions&&canTransfer(t)&&!hasTransferButton(html,t.id)){
        const pos=html.lastIndexOf('</div>');
        if(pos>=0)html=html.slice(0,pos)+`<div class="actions sirro-specialty-transfer-action"><button class="ghost" type="button" onclick="window.sirroTransferSpecialty('${t.id}')">Transferir especialidad</button></div>`+html.slice(pos);
      }
      return html;
    };
    wrapped.__sirroTransfer=true;
    window.tramoItem=wrapped;
  }

  function removeDuplicateTransferButtons(){
    document.querySelectorAll('.item').forEach(card=>{
      const buttons=[...card.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Transferir especialidad'||(b.getAttribute('onclick')||'').includes('sirroTransferSpecialty'));
      buttons.slice(1).forEach(btn=>{const actions=btn.closest('.actions');if(actions&&actions.children.length===1)actions.remove();else btn.remove();});
    });
  }

  async function loadTransfers(){try{const {data,error}=await sb.from('transferencias_especialidad').select('*').order('solicitada_en',{ascending:false});if(error)throw error;transferencias=data||[];}catch{transferencias=[];}}
  function ensurePanel(){const tab=document.getElementById('tab-recibidas');if(!tab||document.getElementById('sirroTransfersCard'))return;const card=document.createElement('article');card.id='sirroTransfersCard';card.className='card';card.innerHTML='<h2>Transferencias de especialidad</h2><div id="sirroTransfersList"></div>';tab.appendChild(card);}
  function esc2(v){return typeof esc==='function'?esc(v):String(v??'');}
  function detail(x){const t=(typeof tramos!=='undefined'?tramos:[]).find(z=>String(z.id)===String(x.tramo_id)),c=caseFor(t);return `${esc2(c?.codigo_visible||'')} · ${esc2(c?.paciente_nombre||'')}`;}
  function renderTransfers(){ensurePanel();const box=document.getElementById('sirroTransfersList');if(!box)return;const mine=mySpecialty();if(!mine){box.innerHTML='<p class="muted">Disponible para médicos especialistas del hospital.</p>';return;}const rows=transferencias.filter(x=>x.especialidad_origen===mine||x.especialidad_destino===mine);if(!rows.length){box.innerHTML='<p class="muted">No hay transferencias de especialidad para este usuario.</p>';return;}box.innerHTML=rows.slice(0,20).map(x=>{const incoming=x.estado==='PENDIENTE'&&x.especialidad_destino===mine;const actions=incoming?`<div class="actions"><button type="button" onclick="window.sirroAnswerTransfer('${x.id}',true)">Aceptar transferencia</button><button class="danger" type="button" onclick="window.sirroAnswerTransfer('${x.id}',false)">Rechazar</button></div>`:'';const reject=x.motivo_rechazo?`<br><small>Motivo de rechazo: ${esc2(x.motivo_rechazo)}</small>`:'';return `<div class="item"><strong>${labels[x.especialidad_origen]||x.especialidad_origen} → ${labels[x.especialidad_destino]||x.especialidad_destino}</strong> · <span class="badge">${esc2(x.estado)}</span><br><small>${detail(x)}</small><br><small>Motivo: ${esc2(x.motivo)}</small>${reject}${actions}</div>`;}).join('');}

  window.sirroTransferSpecialty=async function(id){const t=(typeof tramos!=='undefined'?tramos:[]).find(x=>String(x.id)===String(id));if(!t||!canTransfer(t))return alert('Esta referencia no está disponible para transferencia por su especialidad.');const current=mySpecialty(),opts=specialties.filter(x=>x!==current);const n=Number(prompt('Seleccione la especialidad de destino:\n'+opts.map((x,i)=>`${i+1}. ${labels[x]}`).join('\n')));if(!n||!opts[n-1])return;const reason=prompt('Motivo de la transferencia de especialidad:');if(!reason?.trim())return;const {error}=await sb.rpc('sirro_solicitar_transferencia_especialidad',{p_tramo:id,p_especialidad_destino:opts[n-1],p_motivo:reason.trim()});if(error)return alert(error.message);alert('Transferencia enviada a '+labels[opts[n-1]]+'. La especialidad actual conserva la responsabilidad hasta que sea aceptada.');await refreshAll();};
  window.sirroAnswerTransfer=async function(id,accept){let reason=null;if(!accept){reason=prompt('Motivo obligatorio del rechazo:');if(!reason?.trim())return;}const {error}=await sb.rpc('sirro_responder_transferencia_especialidad',{p_transferencia:id,p_aceptar:!!accept,p_motivo_rechazo:reason?.trim()||null});if(error)return alert(error.message);alert(accept?'Transferencia aceptada. Ahora esta especialidad es responsable del caso.':'Transferencia rechazada. La especialidad original continúa responsable.');await refreshAll();};

  installTramoButton();ensurePanel();
  const base=window.refreshAll;if(typeof base==='function'&&!base.__sirroTransfers){const wrapped=async function(){const r=await base.apply(this,arguments);await loadTransfers();installTramoButton();if(typeof renderReceived==='function')renderReceived();api()?.repaintSpecialistViews?.();renderTransfers();setTimeout(removeDuplicateTransferButtons,0);return r;};wrapped.__sirroTransfers=true;window.refreshAll=wrapped;}
  const observer=new MutationObserver(()=>{clearTimeout(window.__sirroTransferDedupeTimer);window.__sirroTransferDedupeTimer=setTimeout(removeDuplicateTransferButtons,40);});
  const startObserver=()=>{observer.observe(document.body,{childList:true,subtree:true});removeDuplicateTransferButtons();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',async()=>{await loadTransfers();installTramoButton();renderTransfers();startObserver();},{once:true});else loadTransfers().then(()=>{installTramoButton();renderTransfers();startObserver();});
  window.SIRRO_SPECIALTY_TRANSFERS=Object.freeze({loadTransfers,renderTransfers});
})();
