(() => {
  if (window.__sirroMaternalMonitorLoaded) return;
  window.__sirroMaternalMonitorLoaded = true;

  const CLOSED = new Set(['CERRADO','CIERRE_ADMINISTRATIVO_EXTERNO','ANULADO']);
  let maternalFollowups = [];
  let maternalLoadError = '';
  let activeFilter = 'TODAS';

  const maternalCase = c => c?.motivo === 'ATENCION_MATERNA';
  const caseForTramo = t => (typeof caseOf === 'function' ? caseOf(t?.caso_id) : null);
  const isMaternalTramo = t => maternalCase(caseForTramo(t));
  const facilityFor = id => (typeof fac === 'function' ? fac(id) : null);
  const municipioFor = id => (typeof mun === 'function' ? mun(id) : null);
  const ecorFor = id => (typeof ecor === 'function' ? ecor(id) : null);
  const fmtMaternal = v => v ? new Date(v).toLocaleString('es-HN',{timeZone:'America/Tegucigalpa',hour12:false}) : '';

  function canSeeMaternalMonitor(){
    if (!profile) return false;
    if (profile.rol === 'AUDITOR_CONSULTA') return !!profile.permiso_centro_monitoria;
    return ['ADMIN_REGIONAL','ECOR','JEFE_MUNICIPAL','USUARIO_US','USUARIO_HOSPITAL'].includes(profile.rol);
  }

  function inScope(t){
    if (!isMaternalTramo(t) || !profile) return false;
    const c = caseForTramo(t);
    const origin = facilityFor(c?.establecimiento_origen_inicial_id || t.establecimiento_origen_id);
    if (profile.rol === 'ADMIN_REGIONAL') return true;
    if (profile.rol === 'USUARIO_HOSPITAL') return profile.establecimiento_id === t.establecimiento_destino_id || profile.establecimiento_id === t.establecimiento_origen_id;
    if (profile.rol === 'USUARIO_US') return profile.establecimiento_id === c?.establecimiento_origen_inicial_id;
    if (profile.rol === 'ECOR') return !!origin && origin.ecor_id === profile.ecor_id;
    if (profile.rol === 'JEFE_MUNICIPAL') return !!origin && origin.municipio_id === profile.municipio_id;
    if (profile.rol === 'AUDITOR_CONSULTA') {
      const scope = profile.alcance_consulta || 'DEPARTAMENTO';
      if (scope === 'DEPARTAMENTO') return true;
      if (scope === 'ECOR') return !!origin && origin.ecor_id === profile.ecor_id;
      if (scope === 'MUNICIPIO') return !!origin && origin.municipio_id === profile.municipio_id;
      if (scope === 'ESTABLECIMIENTO') return c?.establecimiento_origen_inicial_id === profile.establecimiento_id || t.establecimiento_destino_id === profile.establecimiento_id;
    }
    return false;
  }

  function ensureUI(){
    const tabs = document.getElementById('tabs');
    if (!tabs) return;
    let btn = document.getElementById('maternalMonitorTabBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'maternalMonitorTabBtn';
      btn.type = 'button';
      btn.dataset.tab = 'materno';
      btn.innerHTML = 'Monitoreo materno <span id="maternalMonitorCount"></span>';
      const monitoringBtn = tabs.querySelector('button[data-tab="monitoreo"]');
      monitoringBtn?.insertAdjacentElement('afterend',btn);
    }
    let pane = document.getElementById('tab-materno');
    if (!pane) {
      pane = document.createElement('section');
      pane.id = 'tab-materno';
      pane.className = 'tabpane hidden';
      pane.innerHTML = `
        <article class="card">
          <div class="sirro-maternal-head">
            <div><h2>Monitoreo materno</h2><p class="muted" id="maternalScopeText">Seguimiento administrativo de referencias maternas dentro de su alcance autorizado.</p></div>
            <button type="button" class="ghost" id="maternalRefreshBtn">Actualizar</button>
          </div>
          <div id="maternalLoadStatus"></div>
          <div class="grid stats sirro-maternal-stats" id="maternalStats"></div>
          <div class="sirro-maternal-filters" id="maternalFilters"></div>
          <div id="maternalList"></div>
        </article>`;
      document.getElementById('appView')?.appendChild(pane);
      document.getElementById('maternalRefreshBtn')?.addEventListener('click',()=>refreshAll());
    }
    btn.classList.toggle('hidden',!canSeeMaternalMonitor());
  }

  const style = document.createElement('style');
  style.textContent = `
    .sirro-maternal-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}
    .sirro-maternal-head h2{margin-top:0}
    .sirro-maternal-stats{margin:14px 0;grid-template-columns:repeat(4,minmax(0,1fr))}
    .sirro-maternal-stat{border:1px solid #d7e4e0;box-shadow:none!important;margin:0!important;cursor:pointer;text-align:left;background:#fff;color:#17312b;min-height:92px}
    .sirro-maternal-stat.active{outline:3px solid #0b6b57;outline-offset:1px}
    .sirro-maternal-stat span{font-size:13px;color:#607a74}.sirro-maternal-stat strong{display:block;font-size:28px;margin-top:5px}
    .sirro-maternal-filters{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.sirro-maternal-filter{background:#e9f1ef;color:#24584d}.sirro-maternal-filter.active{background:#0b6b57;color:#fff}
    .sirro-maternal-row{border-left:4px solid #b9cbc5}.sirro-maternal-row.alert{border-left-color:#9b2c2c}.sirro-maternal-row.today{border-left-color:#9a6a00}
    .sirro-maternal-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:7px}.sirro-maternal-tag{font-size:12px;border-radius:999px;padding:3px 8px;background:#eef4f2;color:#315f55;font-weight:750}
    @media(max-width:760px){.sirro-maternal-stats{grid-template-columns:1fr 1fr}.sirro-maternal-stat{min-height:84px}}
    @media(max-width:390px){.sirro-maternal-stats{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  async function loadMaternalFollowups(){
    if (typeof sb === 'undefined') return;
    try {
      const {data,error}=await sb.from('seguimientos_postreferencia').select('*').order('creado_en',{ascending:false});
      if (error) throw error;
      maternalFollowups = data || [];
      maternalLoadError = '';
    } catch (e) {
      maternalFollowups = [];
      maternalLoadError = e?.message || 'No se pudo cargar el seguimiento materno.';
    }
  }

  function followupsFor(id){return maternalFollowups.filter(x=>String(x.tramo_id)===String(id));}
  function deliveryFor(t){return followupsFor(t.id).find(x=>x.tipo==='PUERPERAL'&&Number(x.numero_control||1)===1)?.fecha_base || null;}
  function pendingPuerperals(t){return followupsFor(t.id).filter(x=>x.tipo==='PUERPERAL'&&x.estado!=='COMPLETADA');}
  function dueClass(t){
    if (CLOSED.has(t.estado_actual)) return '';
    const pending=pendingPuerperals(t); if(!pending.length)return '';
    const now=Date.now();
    if(pending.some(x=>x.ventana_hasta&&new Date(x.ventana_hasta).getTime()<now))return 'VENCIDO';
    if(pending.some(x=>x.ventana_desde&&new Date(x.ventana_desde).getTime()<=now&&( !x.ventana_hasta || new Date(x.ventana_hasta).getTime()>=now)))return 'HOY';
    if(pending.some(x=>x.ventana_desde&&new Date(x.ventana_desde).getTime()>now))return 'PROXIMO';
    return '';
  }
  function needsResponse(t){return !CLOSED.has(t.estado_actual)&&['EN_ATENCION','EVALUADO','HOSPITALIZADO'].includes(t.estado_actual);}
  function awaitingClosure(t){return !CLOSED.has(t.estado_actual)&&['RESPUESTA_ENVIADA','RESPUESTA_RECIBIDA'].includes(t.estado_actual);}
  function statusFor(t){
    const due=dueClass(t);
    if(due==='VENCIDO')return 'CONTROL_VENCIDO';
    if(due==='HOY')return 'CONTROL_HOY';
    if(t.estado_actual==='HOSPITALIZADO')return 'HOSPITALIZADA';
    if(needsResponse(t))return 'RESPUESTA_PENDIENTE';
    if(awaitingClosure(t))return 'CIERRE_PENDIENTE';
    if(deliveryFor(t))return 'PARTO_REGISTRADO';
    return 'ACTIVA';
  }

  function scopeText(){
    if(!profile)return '';
    if(profile.rol==='ADMIN_REGIONAL')return 'Alcance: todo el departamento de Olancho.';
    if(profile.rol==='ECOR')return `Alcance: ECOR ${ecorFor(profile.ecor_id)?.nombre||''}.`;
    if(profile.rol==='JEFE_MUNICIPAL')return `Alcance: municipio ${municipioFor(profile.municipio_id)?.nombre||''}.`;
    if(profile.rol==='USUARIO_HOSPITAL')return `Alcance: pacientes atendidas por ${facilityFor(profile.establecimiento_id)?.nombre||'este hospital'}.`;
    if(profile.rol==='USUARIO_US')return `Alcance: referencias maternas originadas en ${facilityFor(profile.establecimiento_id)?.nombre||'este establecimiento'}.`;
    if(profile.rol==='AUDITOR_CONSULTA')return `Alcance de consulta: ${profile.alcance_consulta||'DEPARTAMENTO'}. Solo lectura.`;
    return '';
  }

  function renderMaternalMonitor(){
    ensureUI();
    if(!canSeeMaternalMonitor())return;
    const rows=(Array.isArray(tramos)?tramos:[]).filter(inScope);
    const active=rows.filter(t=>!CLOSED.has(t.estado_actual));
    const hospital=active.filter(t=>t.estado_actual==='HOSPITALIZADO');
    const deliveries=rows.filter(t=>!!deliveryFor(t));
    const overdue=active.filter(t=>dueClass(t)==='VENCIDO');
    const today=active.filter(t=>dueClass(t)==='HOY');
    const responsePending=active.filter(needsResponse);
    const closurePending=active.filter(awaitingClosure);
    const actionable=new Set([...overdue,...today,...responsePending,...closurePending].map(t=>t.id)).size;
    const count=document.getElementById('maternalMonitorCount'); if(count)count.textContent=actionable?`(${actionable})`:'';
    const scope=document.getElementById('maternalScopeText'); if(scope)scope.textContent=`Seguimiento administrativo materno. ${scopeText()}`;
    const load=document.getElementById('maternalLoadStatus'); if(load)load.innerHTML=maternalLoadError?`<div class="notice error">No fue posible cargar los controles puerperales. Los conteos relacionados pueden estar incompletos.</div>`:'';

    const stats=document.getElementById('maternalStats');
    if(stats)stats.innerHTML=[
      ['ACTIVAS','Referencias activas',active.length],
      ['HOSPITALIZADA','Hospitalizadas',hospital.length],
      ['PARTO_REGISTRADO','Partos registrados',deliveries.length],
      ['CONTROL_VENCIDO','Controles vencidos',overdue.length],
      ['CONTROL_HOY','Controles corresponden hoy',today.length],
      ['RESPUESTA_PENDIENTE','Respuesta pendiente',responsePending.length],
      ['CIERRE_PENDIENTE','Cierre pendiente en origen',closurePending.length]
    ].map(([key,label,value])=>`<button type="button" class="card sirro-maternal-stat ${activeFilter===key?'active':''}" data-maternal-filter="${key}"><span>${esc(label)}</span><strong>${value}</strong></button>`).join('');

    const filters=document.getElementById('maternalFilters');
    if(filters)filters.innerHTML=`<button type="button" class="sirro-maternal-filter ${activeFilter==='TODAS'?'active':''}" data-maternal-filter="TODAS">Todas</button><button type="button" class="sirro-maternal-filter ${activeFilter==='CONTROL_VENCIDO'?'active':''}" data-maternal-filter="CONTROL_VENCIDO">Vencidos</button><button type="button" class="sirro-maternal-filter ${activeFilter==='CONTROL_HOY'?'active':''}" data-maternal-filter="CONTROL_HOY">Corresponden hoy</button><button type="button" class="sirro-maternal-filter ${activeFilter==='RESPUESTA_PENDIENTE'?'active':''}" data-maternal-filter="RESPUESTA_PENDIENTE">Respuesta pendiente</button><button type="button" class="sirro-maternal-filter ${activeFilter==='CIERRE_PENDIENTE'?'active':''}" data-maternal-filter="CIERRE_PENDIENTE">Cierre pendiente</button>`;

    let shown=rows;
    if(activeFilter==='ACTIVAS')shown=active;
    else if(activeFilter!=='TODAS')shown=rows.filter(t=>statusFor(t)===activeFilter || (activeFilter==='PARTO_REGISTRADO'&&!!deliveryFor(t)));
    shown=shown.sort((a,b)=>new Date(b.creado_en||0)-new Date(a.creado_en||0));
    const list=document.getElementById('maternalList');
    if(list)list.innerHTML=shown.map(t=>{
      const c=caseForTramo(t), origin=facilityFor(c?.establecimiento_origen_inicial_id||t.establecimiento_origen_id), dest=facilityFor(t.establecimiento_destino_id), due=dueClass(t), delivery=deliveryFor(t), pending=pendingPuerperals(t).sort((a,b)=>Number(a.numero_control||0)-Number(b.numero_control||0))[0];
      const tags=[];
      if(t.estado_actual==='HOSPITALIZADO')tags.push('Hospitalizada');
      if(delivery)tags.push('Parto: '+fmtMaternal(delivery));
      if(due==='VENCIDO')tags.push('Control puerperal vencido');
      if(due==='HOY')tags.push('Control puerperal corresponde hoy');
      if(due==='PROXIMO'&&pending?.ventana_desde)tags.push('Próximo control: '+fmtMaternal(pending.ventana_desde));
      if(needsResponse(t))tags.push('Respuesta/contrarreferencia pendiente');
      if(awaitingClosure(t))tags.push('US de origen debe cerrar ciclo');
      return `<div class="item sirro-maternal-row ${due==='VENCIDO'?'alert':due==='HOY'?'today':''}"><div class="row"><div><strong>${esc(c?.codigo_visible||'Referencia materna')}</strong> · ${esc(c?.paciente_nombre||'Paciente')}<br><small>${esc(origin?.nombre||'Origen')} → ${esc(dest?.nombre||'Destino')}</small></div><span class="badge">${esc(t.estado_actual||'')}</span></div><div class="sirro-maternal-meta">${tags.map(x=>`<span class="sirro-maternal-tag">${esc(x)}</span>`).join('')}</div></div>`;
    }).join('')||'<p class="muted">No hay referencias maternas en este filtro.</p>';
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-maternal-filter]');
    if(!b)return;
    activeFilter=b.dataset.maternalFilter||'TODAS';
    renderMaternalMonitor();
  });

  const baseConfigureTabs=typeof configureTabs==='function'?configureTabs:null;
  if(baseConfigureTabs){configureTabs=function(){const r=baseConfigureTabs.apply(this,arguments);ensureUI();return r;};}
  const baseRefreshAll=typeof refreshAll==='function'?refreshAll:null;
  if(baseRefreshAll){refreshAll=async function(){await loadMaternalFollowups();const r=await baseRefreshAll.apply(this,arguments);renderMaternalMonitor();return r;};}

  ensureUI();
  loadMaternalFollowups().then(renderMaternalMonitor);
})();