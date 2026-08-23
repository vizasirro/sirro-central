(() => {
  let pendientesFollowups=[];
  let started=false;
  const now=()=>Date.now();
  const byCase=id=>typeof caseOf==='function'?(caseOf(id)||{}):{};
  const safeFmt=v=>v&&typeof fmt==='function'?fmt(v):'';
  const tramoById=id=>(typeof tramos!=='undefined'&&Array.isArray(tramos))?tramos.find(x=>x.id===id):null;
  const getProfile=()=>typeof profile!=='undefined'?profile:null;
  const getTramos=()=>typeof tramos!=='undefined'&&Array.isArray(tramos)?tramos:[];
  const getNotifications=()=>typeof notifications!=='undefined'&&Array.isArray(notifications)?notifications:[];

  function showTab(name){
    const b=document.querySelector(`#tabs button[data-tab="${name}"]`); if(!b)return;
    document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    document.querySelectorAll('.tabpane').forEach(x=>x.classList.add('hidden')); document.getElementById(`tab-${name}`)?.classList.remove('hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  async function loadPendientesFollowups(){try{if(typeof fetchAll!=='function')return;const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),5000));pendientesFollowups=await Promise.race([fetchAll('seguimientos_postreferencia'),timeout]);if(!Array.isArray(pendientesFollowups))pendientesFollowups=[];}catch{pendientesFollowups=[]}}
  function responsablePuerperal(t,c){const p=getProfile();if(!p?.establecimiento_id)return false;if(t.estado_actual==='HOSPITALIZADO')return p.rol==='USUARIO_HOSPITAL'&&p.establecimiento_id===t.establecimiento_destino_id;return p.establecimiento_id===c.establecimiento_origen_inicial_id;}
  function priorityForWindow(s){if(!s?.ventana_desde)return {rank:3,label:'PENDIENTE'};const n=now(),desde=new Date(s.ventana_desde).getTime(),hasta=s.ventana_hasta?new Date(s.ventana_hasta).getTime():desde;if(n>hasta)return {rank:0,label:'VENCIDO'};if(n>=desde)return {rank:1,label:'REQUIERE ATENCIÓN'};if(desde-n<=24*3600000)return {rank:2,label:'PRÓXIMO'};return {rank:3,label:'PENDIENTE'};}

  function actionPending(){
    const out=[],p=getProfile();if(!p)return out;
    for(const t of getTramos()){
      const c=byCase(t.caso_id);
      if(p.establecimiento_id===t.establecimiento_destino_id){
        if(t.estado_actual==='ENVIADO')out.push({rank:1,type:'accion',title:'Referencia por recibir',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>showTab('recibidas'),button:'Abrir referencia',tramo:t.id});
        if(t.estado_actual==='EN_ATENCION')out.push({rank:2,type:'accion',title:'Evaluación pendiente',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>typeof evaluateTramo==='function'&&evaluateTramo(t.id),button:'Registrar evaluación',tramo:t.id});
        if(['EVALUADO','HOSPITALIZADO'].includes(t.estado_actual))out.push({rank:1,type:'accion',title:'Respuesta / contrarreferencia pendiente',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>typeof answerTramo==='function'&&answerTramo(t.id),button:'Responder',tramo:t.id});
      }
      if(p.establecimiento_id===t.establecimiento_origen_id){
        if(t.estado_actual==='RESPUESTA_ENVIADA')out.push({rank:1,type:'accion',title:'Respuesta lista para confirmar',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>typeof closeTramo==='function'&&closeTramo(t.id),button:'Revisar y cerrar',tramo:t.id});
        if(t.estado_actual==='RECHAZADO')out.push({rank:0,type:'accion',title:'Referencia rechazada por corregir',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>typeof reorientTramo==='function'&&reorientTramo(t.id),button:'Corregir y reenviar',tramo:t.id});
      }
    }
    for(const s of pendientesFollowups){
      if(s.estado==='COMPLETADA')continue;const t=tramoById(s.tramo_id);if(!t)continue;const c=byCase(t.caso_id);
      if(s.tipo==='PUERPERAL'&&responsablePuerperal(t,c)){const n=Number(s.numero_control||1),pri=priorityForWindow(s);out.push({rank:pri.rank,type:'accion',title:`Control puerperal ${n} · ${pri.label}`,detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}${s.ventana_desde?` · ${safeFmt(s.ventana_desde)}`:''}`,action:()=>window.completePuerperal?.(t.id,n),button:'Registrar control',tramo:t.id});}
      if(s.tipo==='CONSULTA_EXTERNA'&&s.estado==='PENDIENTE_ASIGNACION'&&p.establecimiento_id===t.establecimiento_destino_id){const age=(now()-new Date(s.creado_en).getTime())/3600000;out.push({rank:age>=48?0:age>=24?1:2,type:'accion',title:'Cita de consulta externa pendiente',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>window.assignCeAppointment?.(t.id),button:'Asignar cita',tramo:t.id});}
    }
    return out;
  }
  function informationalPending(actionRows){const actionTramos=new Set(actionRows.map(x=>x.tramo).filter(Boolean));return getNotifications().filter(n=>!n.leida&&!actionTramos.has(n.tramo_id)).map(n=>({rank:n.critica?1:3,type:'info',title:n.titulo||'Aviso',detail:n.mensaje||'',button:'Revisado',notificationId:n.id,fecha:n.creada_en}));}
  function buildPending(){const actions=actionPending();return [...actions,...informationalPending(actions)].sort((a,b)=>a.rank-b.rank);}
  const group=x=>x.rank===0?'pending':x.rank===1?'attention':'upcoming';
  const colors={pending:{bg:'#fff1f2',border:'#dc2626',text:'#991b1b',label:'PENDIENTE'},attention:{bg:'#fffbeb',border:'#d97706',text:'#92400e',label:'REQUIERE MI ATENCIÓN'},upcoming:{bg:'#f8fafc',border:'#94a3b8',text:'#475569',label:'PRÓXIMO / INFORMATIVO'}};
  const coloredButton=(kind,html)=>{const c=colors[kind];return `<button type="button" data-pending-group="${kind}" style="background:${c.bg};border:2px solid ${c.border};color:${c.text};padding:12px 16px;border-radius:12px;font:inherit;cursor:pointer;text-align:left">${html}</button>`;};

  function ensureUI(){
    if(document.getElementById('sirroPendingCard'))return true;const inicio=document.getElementById('tab-inicio');if(!inicio)return false;
    const card=document.createElement('article');card.id='sirroPendingCard';card.className='card';
    card.innerHTML=`<div class="row" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><h2 style="margin:0">LO QUE TENGO PENDIENTE</h2><p class="muted" style="margin:6px 0 0">Rojo = pendiente/vencido · Amarillo = requiere mi atención.</p></div><button id="sirroPendingOpen" type="button">LO PENDIENTE · <span id="sirroPendingCount">0</span></button></div><div id="sirroPendingPreview" style="margin-top:10px"><div class="notice">Cargando pendientes…</div></div>`;
    const flow=[...inicio.querySelectorAll(':scope > article.card')].find(x=>x.querySelector('h2')?.textContent?.includes('Flujo SIRRO'));if(flow)inicio.insertBefore(card,flow);else inicio.appendChild(card);document.getElementById('sirroPendingOpen').onclick=()=>openPending();return true;
  }
  function renderHomePending(){
    if(!ensureUI())return;const p=getProfile(),box=document.getElementById('sirroPendingPreview');if(!box)return;if(!p){box.innerHTML='<div class="notice">Cargando pendientes…</div>';return;}
    const rows=buildPending(),count=rows.length,c=document.getElementById('sirroPendingCount');if(c)c.textContent=count;if(!count){box.innerHTML='<div class="notice ok"><strong>Sin pendientes.</strong> No tiene acciones pendientes en este momento.</div>';return;}
    const red=rows.filter(x=>group(x)==='pending').length,yellow=rows.filter(x=>group(x)==='attention').length,other=count-red-yellow;
    box.innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap">${coloredButton('pending',`<strong>${red}</strong> PENDIENTE${red===1?'':'S'}`)}${coloredButton('attention',`<strong>${yellow}</strong> REQUIERE${yellow===1?'':'N'} MI ATENCIÓN`)}${other?coloredButton('upcoming',`<strong>${other}</strong> PRÓXIMO${other===1?'':'S'} / AVISO${other===1?'':'S'}`):''}</div>`;
    box.querySelectorAll('[data-pending-group]').forEach(b=>b.onclick=()=>openPending(b.dataset.pendingGroup));
  }
  function pendingItem(x,i){
    const escapeFn=typeof esc==='function'?esc:(v=>String(v??'')),kind=group(x),c=colors[kind];
    return `<div style="padding:12px;margin:9px 0;border-radius:10px;background:${c.bg};border:2px solid ${c.border};color:${c.text}"><div class="row"><div><strong>${escapeFn(x.title)}</strong><br><small>${escapeFn(x.detail||'')}</small>${x.fecha?`<br><small>${escapeFn(safeFmt(x.fecha))}</small>`:''}</div><span class="badge" style="border-color:${c.border};color:${c.text}">${c.label}</span></div><div class="actions"><button type="button" data-pending-index="${i}">${escapeFn(x.button||'Abrir')}</button></div></div>`;
  }
  function openPending(filterGroup=null){
    document.getElementById('sirroPendingModal')?.remove();const allRows=buildPending(),rows=filterGroup?allRows.filter(x=>group(x)===filterGroup):allRows,modal=document.createElement('div');modal.id='sirroPendingModal';modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;overflow:auto;padding:16px';
    const filterTitle=filterGroup==='pending'?'PENDIENTES / VENCIDOS':filterGroup==='attention'?'REQUIERE MI ATENCIÓN':filterGroup==='upcoming'?'PRÓXIMOS / INFORMATIVOS':'LO PENDIENTE';
    modal.innerHTML=`<div class="card" style="max-width:760px;margin:20px auto"><div class="row"><div><h2 style="margin:0">${filterTitle}</h2><p class="muted">Rojo = pendiente/vencido · Amarillo = requiere mi atención · Gris = próximo/informativo.</p></div><button class="ghost" id="sirroPendingClose" type="button">Cerrar</button></div><div id="sirroPendingList">${rows.length?rows.map(pendingItem).join(''):'<div class="notice ok"><strong>No hay elementos en esta categoría.</strong></div>'}</div><details style="margin-top:14px"><summary><strong>Revisados</strong></summary><div id="sirroReviewedList" style="margin-top:8px"></div></details></div>`;document.body.appendChild(modal);document.getElementById('sirroPendingClose').onclick=()=>modal.remove();
    modal.querySelectorAll('[data-pending-index]').forEach(b=>b.onclick=async()=>{const x=rows[Number(b.dataset.pendingIndex)];if(!x)return;if(x.type==='info'){const {error}=await sb.rpc('sirro_marcar_notificacion_leida',{p_notificacion:x.notificationId});if(error)return alert(error.message);if(typeof loadNotifications==='function')await loadNotifications();if(typeof renderNotifications==='function')renderNotifications();renderHomePending();openPending(filterGroup);return;}modal.remove();if(typeof x.action==='function')await x.action();});renderReviewed();
  }
  function renderReviewed(){const box=document.getElementById('sirroReviewedList');if(!box)return;const escapeFn=typeof esc==='function'?esc:(v=>String(v??'')),rows=getNotifications().filter(n=>n.leida).slice(0,20);box.innerHTML=rows.length?rows.map(n=>`<div class="item"><strong>${escapeFn(n.titulo||'Aviso')}</strong><br><small>${escapeFn(n.mensaje||'')}</small>${n.creada_en?`<br><small>${escapeFn(safeFmt(n.creada_en))}</small>`:''}</div>`).join(''):'<p class="muted">Aún no hay avisos revisados.</p>';}
  const baseRefresh=typeof window.refreshAll==='function'?window.refreshAll:null;if(baseRefresh)window.refreshAll=async function(){await baseRefresh();renderHomePending();await loadPendientesFollowups();renderHomePending();};
  async function start(){if(started)return;started=true;ensureUI();renderHomePending();await loadPendientesFollowups();renderHomePending();let tries=0;const timer=setInterval(async()=>{tries++;ensureUI();renderHomePending();if(getProfile()){await loadPendientesFollowups();renderHomePending();clearInterval(timer);}else if(tries>=20)clearInterval(timer);},500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();window.addEventListener('pageshow',()=>{ensureUI();renderHomePending();});
})();