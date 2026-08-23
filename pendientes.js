(() => {
  let pendientesFollowups=[];
  const now=()=>Date.now();
  const byCase=id=>caseOf(id)||{};
  const safeFmt=v=>v?fmt(v):'';
  const tramoById=id=>tramos.find(x=>x.id===id);

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
    try{pendientesFollowups=await fetchAll('seguimientos_postreferencia')}catch{pendientesFollowups=[]}
  }

  function responsablePuerperal(t,c){
    if(!profile?.establecimiento_id)return false;
    if(t.estado_actual==='HOSPITALIZADO')return profile.rol==='USUARIO_HOSPITAL'&&profile.establecimiento_id===t.establecimiento_destino_id;
    return profile.establecimiento_id===c.establecimiento_origen_inicial_id;
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
    const out=[];
    for(const t of tramos){
      const c=byCase(t.caso_id);
      if(profile?.establecimiento_id===t.establecimiento_destino_id){
        if(t.estado_actual==='ENVIADO')out.push({rank:1,type:'accion',title:'Referencia por recibir',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>showTab('recibidas'),button:'Abrir referencia',tramo:t.id});
        if(t.estado_actual==='EN_ATENCION')out.push({rank:2,type:'accion',title:'Evaluación pendiente',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>evaluateTramo(t.id),button:'Registrar evaluación',tramo:t.id});
        if(['EVALUADO','HOSPITALIZADO'].includes(t.estado_actual))out.push({rank:1,type:'accion',title:'Respuesta / contrarreferencia pendiente',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>answerTramo(t.id),button:'Responder',tramo:t.id});
      }
      if(profile?.establecimiento_id===t.establecimiento_origen_id){
        if(t.estado_actual==='RESPUESTA_ENVIADA')out.push({rank:1,type:'accion',title:'Respuesta lista para confirmar',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>closeTramo(t.id),button:'Revisar y cerrar',tramo:t.id});
        if(t.estado_actual==='RECHAZADO')out.push({rank:1,type:'accion',title:'Referencia rechazada por corregir',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>reorientTramo(t.id),button:'Corregir y reenviar',tramo:t.id});
      }
    }
    for(const s of pendientesFollowups){
      if(s.estado==='COMPLETADA')continue;
      const t=tramoById(s.tramo_id); if(!t)continue;
      const c=byCase(t.caso_id);
      if(s.tipo==='PUERPERAL'&&responsablePuerperal(t,c)){
        const n=Number(s.numero_control||1), p=priorityForWindow(s);
        out.push({rank:p.rank,type:'accion',title:`Control puerperal ${n} · ${p.label}`,detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}${s.ventana_desde?` · ${safeFmt(s.ventana_desde)}`:''}`,action:()=>window.completePuerperal?.(t.id,n),button:'Registrar control',tramo:t.id});
      }
      if(s.tipo==='CONSULTA_EXTERNA'&&s.estado==='PENDIENTE_ASIGNACION'&&profile?.establecimiento_id===t.establecimiento_destino_id){
        out.push({rank:2,type:'accion',title:'Cita de consulta externa pendiente',detail:`${c.codigo_visible||''} · ${c.paciente_nombre||''}`,action:()=>window.assignCeAppointment?.(t.id),button:'Asignar cita',tramo:t.id});
      }
    }
    return out;
  }

  function informationalPending(actionRows){
    const actionTramos=new Set(actionRows.map(x=>x.tramo).filter(Boolean));
    return (notifications||[]).filter(n=>!n.leida&&!actionTramos.has(n.tramo_id)).map(n=>({
      rank:n.critica?1:3,type:'info',title:n.titulo||'Aviso',detail:n.mensaje||'',button:'Revisado',notificationId:n.id,fecha:n.creada_en
    }));
  }

  function buildPending(){
    const actions=actionPending();
    return [...actions,...informationalPending(actions)].sort((a,b)=>a.rank-b.rank);
  }

  function ensureUI(){
    if(document.getElementById('sirroPendingCard'))return;
    const inicio=document.getElementById('tab-inicio'); if(!inicio)return;
    const card=document.createElement('article');
    card.id='sirroPendingCard'; card.className='card';
    card.innerHTML=`<div class="row" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><h2 style="margin:0">LO QUE TENGO PENDIENTE</h2><p class="muted" style="margin:6px 0 0">Solo muestra lo que requiere su atención. Los avisos informativos desaparecen al revisarlos.</p></div><button id="sirroPendingOpen" type="button">LO PENDIENTE · <span id="sirroPendingCount">0</span></button></div><div id="sirroPendingPreview" style="margin-top:10px"></div>`;
    const flow=inicio.querySelector('article.card');
    if(flow)inicio.insertBefore(card,flow); else inicio.appendChild(card);
    document.getElementById('sirroPendingOpen').onclick=openPending;
  }

  function renderHomePending(){
    ensureUI();
    const rows=buildPending(), count=rows.length;
    const c=document.getElementById('sirroPendingCount'); if(c)c.textContent=count;
    const p=document.getElementById('sirroPendingPreview'); if(!p)return;
    if(!count){p.innerHTML='<div class="notice ok"><strong>Sin pendientes.</strong> No tiene acciones pendientes en este momento.</div>';return;}
    const urgent=rows.filter(x=>x.rank<=1).length, soon=rows.filter(x=>x.rank===2).length;
    p.innerHTML=`<span class="badge">${urgent} requieren atención</span> <span class="badge">${soon} próximos</span> <span class="badge">${count} total</span>`;
  }

  function pendingItem(x,i){
    const cls=x.rank===0?'error':x.rank===1?'notice':'item';
    const pri=x.rank===0?'VENCIDO':x.rank===1?'ATENCIÓN':x.rank===2?'PRÓXIMO':'PENDIENTE';
    return `<div class="${cls}" style="padding:12px;margin:9px 0;border-radius:10px"><div class="row"><div><strong>${esc(x.title)}</strong><br><small>${esc(x.detail||'')}</small>${x.fecha?`<br><small>${esc(safeFmt(x.fecha))}</small>`:''}</div><span class="badge">${pri}</span></div><div class="actions"><button type="button" data-pending-index="${i}">${esc(x.button||'Abrir')}</button></div></div>`;
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
        await loadNotifications(); renderNotifications(); renderHomePending(); openPending(); return;
      }
      modal.remove();
      if(typeof x.action==='function')await x.action();
    });
    renderReviewed();
  }

  function renderReviewed(){
    const box=document.getElementById('sirroReviewedList'); if(!box)return;
    const rows=(notifications||[]).filter(n=>n.leida).slice(0,20);
    box.innerHTML=rows.length?rows.map(n=>`<div class="item"><strong>${esc(n.titulo||'Aviso')}</strong><br><small>${esc(n.mensaje||'')}</small>${n.creada_en?`<br><small>${esc(safeFmt(n.creada_en))}</small>`:''}</div>`).join(''):'<p class="muted">Aún no hay avisos revisados.</p>';
  }

  const baseRefresh=window.refreshAll;
  if(baseRefresh)window.refreshAll=async function(){await baseRefresh();await loadPendientesFollowups();renderHomePending();};

  async function start(){
    await loadPendientesFollowups();
    ensureUI(); renderHomePending();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();