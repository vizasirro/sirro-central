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
    const b=document.querySelector(`#tabs button[data-tab="${name}"]`);
    if(!b)return;
    document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.querySelectorAll('.tabpane').forEach(x=>x.classList.add('hidden'));
    document.getElementById(`tab-${name}`)?.classList.remove('hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function loadPendientesFollowups(){
    try{
      if(typeof fetchAll!=='function')return;
      const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),5000));
      pendientesFollowups=await Promise.race([fetchAll('seguimientos_postreferencia'),timeout]);
      if(!Array.isArray(pendientesFollowups))pendientesFollowups=[];
    }catch{pendientesFollowups=[]}
  }

  function responsablePuerperal(t,c){
    const p=getProfile();
    if(!p?.establecimiento_id)return false;
    if(t.estado_actual==='HOSPITALIZADO')return p.rol==='USUARIO_HOSPITAL'&&p.establecimiento_id===t.establecimiento_destino_id;
    return p.establecimiento_id===c.establecimiento_origen_inicial_id;
  }

  function priorityForWindow(s){
    if(!s?.ventana_desde)return {rank:3,label:'PENDIENTE'};
    const n=now(), desde=new Date(s.ventana_desde).getTime(), hasta=s.ventana_hasta?new Date(s.ventana_hasta).getTime():desde;
    if(n>hasta)return {rank:0,label:'VENCIDO'};
    if(n>=desde)return {rank:1,label:'REQUIERE ATENCIÓN'};
    if(desde-n<=24*3600000)return {rank:2,label:'PRÓXIMO'};
    return {rank:3,label:'PENDIENTE'};
  }

  function actionPending(){
    const out=[], p=getProfile();
    if(!p)return out;
    for(const t of getTramos()){
      const c=byCase(t.caso_id);
      if(p.establecimiento_id===t.establecimiento_destino_id){
        if(t.estado_actual==='ENVIADO')out.push({rank:1,type:'accion',title:'Referencia por recibir',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>showTab('recibidas'),button:'Abrir referencia',tramo:t.id});
        if(t.estado_actual==='EN_ATENCION')out.push({rank:2,type:'accion',title:'Evaluación pendiente',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>typeof evaluateTramo==='function'&&evaluateTramo(t.id),button:'Registrar evaluación',tramo:t.id});
        if(['EVALUADO','HOSPITALIZADO'].includes(t.estado_actual))out.push({rank:1,type:'accion',title:'Respuesta / contrarreferencia pendiente',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>typeof answerTramo==='function'&&answerTramo(t.id),button:'Responder',tramo:t.id});
      }
      if(p.establecimiento_id===t.establecimiento_origen_id){
        if(t.estado_actual==='RESPUESTA_ENVIADA')out.push({rank:1,type:'accion',title:'Respuesta lista para confirmar',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>typeof closeTramo==='function'&&closeTramo(t.id),button:'Revisar y cerrar',tramo:t.id});
        if(t.estado_actual==='RECHAZADO')out.push({rank:1,type:'accion',title:'Referencia rechazada por corregir',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>typeof reorientTramo==='function'&&reorientTramo(t.id),button:'Corregir y reenviar',tramo:t.id});
      }
    }
    for(const s of pendientesFollowups){
      if(s.estado==='COMPLETADA')continue;
      const t=tramoById(s.tramo_id); if(!t)continue;
      const c=byCase(t.caso_id);
      if(s.tipo==='PUERPERAL'&&responsablePuerperal(t,c)){
        const n=Number(s.numero_control||1), pri=priorityForWindow(s);
        out.push({rank:pri.rank,type:'accion',title:`Control puerperal ${n} · ${pri.label}`,detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}${s.ventana_desde?` · ${safeFmt(s.ventana_desde)}`:''}`,action:()=>window.completePuerperal?.(t.id,n),button:'Registrar control',tramo:t.id});
      }
      if(s.tipo==='CONSULTA_EXTERNA'&&s.estado==='PENDIENTE_ASIGNACION'&&p.establecimiento_id===t.establecimiento_destino_id){
        out.push({rank:2,type:'accion',title:'Cita de consulta externa pendiente',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>window.assignCeAppointment?.(t.id),button:'Asignar cita',tramo:t.id});
      }
    }
    return out;
  }

  function informationalPending(actionRows){
    const actionTramos=new Set(actionRows.map(x=>x.tramo).filter(Boolean));
    return getNotifications().filter(n=>!n.leida&&!actionTramos.has(n.tramo_id)).map(n=>({rank:n.critica?1:3,type:'info',title:n.titulo||'Aviso',detail:n.mensaje||'',button:'Revisado',notificationId:n.id,fecha:n.creada_en}));
  }

  function buildPending(){
    const actions=actionPending();
    return [...actions,...informationalPending(actions)].sort((a,b)=>a.rank-b.rank);
  }

  function ensureUI(){
    if(document.getElementById('sirroPendingCard'))return true;
    const inicio=document.getElementById('tab-inicio'); if(!inicio)return false;
    const card=document.createElement('article');
    card.id='sirroPendingCard'; card.className='card';
    card.innerHTML=`<div class="row" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><h2 style="margin:0">LO QUE TENGO PENDIENTE</h2><p class="muted" style="margin:6px 0 0">Solo muestra lo que requiere su atención. Los avisos informativos desaparecen al revisarlos.</p></div><button id="sirroPendingOpen" type="button">LO PENDIENTE · <span id="sirroPendingCount">0</span></button></div><div id="sirroPendingPreview" style="margin-top:10px"><div class="notice">Cargando pendientes…</div></div>`;
    const flow=[...inicio.querySelectorAll(':scope > article.card')].find(x=>x.querySelector('h2')?.textContent?.includes('Flujo SIRRO'));
    if(flow)inicio.insertBefore(card,flow); else inicio.appendChild(card);
    document.getElementById('sirroPendingOpen').onclick=openPending;
    return true;
  }

  function renderHomePending(){
    if(!ensureUI())return;
    const p=getProfile();
    const box=document.getElementById('sirroPendingPreview');
    if(!box)return;
    if(!p){box.innerHTML='<div class="notice">Cargando pendientes…</div>';return;}
    const rows=buildPending(), count=rows.length;
    const c=document.getElementById('sirroPendingCount'); if(c)c.textContent=count;
    if(!count){box.innerHTML='<div class="notice ok"><strong>Sin pendientes.</strong> No tiene acciones pendientes en este momento.</div>';return;}
    const urgent=rows.filter(x=>x.rank<=1).length, soon=rows.filter(x=>x.rank===2).length;
    box.innerHTML=`<span class="badge">${urgent} requieren atención</span> <span class="badge">${soon} próximos</span> <span class="badge">${count} total</span>`;
  }

  function pendingItem(x,i){
    const escapeFn=typeof esc==='function'?esc:(v=>String(v??''));
    const cls=x.rank===0?'error':x.rank===1?'notice':'item';
    const pri=x.rank===0?'VENCIDO':x.rank===1?'ATENCIÓN':x.rank===2?'PRÓXIMO':'PENDIENTE';
    return `<div class="${cls}" style="padding:12px;margin:9px 0;border-radius:10px"><div class="row"><div><strong>${escapeFn(x.title)}</strong><br><small>${escapeFn(x.detail||'')}</small>${x.fecha?`<br><small>${escapeFn(safeFmt(x.fecha))}</small>`:''}</div><span class="badge">${pri}</span></div><div class="actions"><button type="button" data-pending-index="${i}">${escapeFn(x.button||'Abrir')}</button></div></div>`;
  }

  function openPending(){
    const old=document.getElementById('sirroPendingModal'); if(old)old.remove();
    const rows=buildPending();
    const modal=document.createElement('div'); modal.id='sirroPendingModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;overflow:auto;padding:16px';
    modal.innerHTML=`<div class="card" style="max-width:760px;margin:20px auto"><div class="row"><div><h2 style="margin:0">LO PENDIENTE</h2><p class="muted">Vencidos → requieren atención → próximos → pendientes.</p></div><button class="ghost" id="sirroPendingClose" type="button">Cerrar</button></div><div id="sirroPendingList">${rows.length?rows.map(pendingItem).join(''):'<div class="notice ok"><strong>Sin pendientes.</strong></div>'}</div><details style="margin-top:14px"><summary><strong>Revisados</strong></summary><div id="sirroReviewedList" style="margin-top:8px"></div></details></div>`;
    document.body.appendChild(modal);
    document.getElementById('sirroPendingClose').onclick=()=>modal.remove();
    modal.querySelectorAll('[data-pending-index]').forEach(b=>b.onclick=async()=>{
      const x=rows[Number(b.dataset.pendingIndex)]; if(!x)return;
      if(x.type==='info'){
        const {error}=await sb.rpc('sirro_marcar_notificacion_leida',{p_notificacion:x.notificationId});
        if(error)return alert(error.message);
        if(typeof loadNotifications==='function')await loadNotifications();
        if(typeof renderNotifications==='function')renderNotifications();
        renderHomePending(); openPending(); return;
      }
      modal.remove();
      if(typeof x.action==='function')await x.action();
    });
    renderReviewed();
  }

  function renderReviewed(){
    const box=document.getElementById('sirroReviewedList'); if(!box)return;
    const escapeFn=typeof esc==='function'?esc:(v=>String(v??''));
    const rows=getNotifications().filter(n=>n.leida).slice(0,20);
    box.innerHTML=rows.length?rows.map(n=>`<div class="item"><strong>${escapeFn(n.titulo||'Aviso')}</strong><br><small>${escapeFn(n.mensaje||'')}</small>${n.creada_en?`<br><small>${escapeFn(safeFmt(n.creada_en))}</small>`:''}</div>`).join(''):'<p class="muted">Aún no hay avisos revisados.</p>';
  }

  const baseRefresh=typeof window.refreshAll==='function'?window.refreshAll:null;
  if(baseRefresh)window.refreshAll=async function(){await baseRefresh();renderHomePending();await loadPendientesFollowups();renderHomePending();};

  async function start(){
    if(started)return; started=true;
    ensureUI();
    renderHomePending();
    await loadPendientesFollowups();
    renderHomePending();
    let tries=0;
    const timer=setInterval(async()=>{
      tries++;
      ensureUI(); renderHomePending();
      if(getProfile()){
        await loadPendientesFollowups();
        renderHomePending();
        clearInterval(timer);
      }else if(tries>=20)clearInterval(timer);
    },500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('pageshow',()=>{ensureUI();renderHomePending();});
})();