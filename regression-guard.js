(() => {
  if (window.SIRRO_REGRESSION_GUARD) return;
  window.SIRRO_REGRESSION_GUARD = true;

  if(!document.querySelector('script[src="./login-stable.js"]')){
    const ls=document.createElement('script');
    ls.src='./login-stable.js';
    ls.async=false;
    document.head.appendChild(ls);
  }

  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  const currentProfile = () => typeof profile !== 'undefined' ? profile : null;
  const isAdminRole = () => ['ADMIN_REGIONAL','ADMINISTRADOR'].includes(currentProfile()?.rol);
  const isClinicalRole = () => ['USUARIO_HOSPITAL','USUARIO_US'].includes(currentProfile()?.rol);
  const isAppointmentRole = () => currentProfile()?.rol === 'USUARIO_HOSPITAL' && currentProfile()?.tipo_usuario_hospital === 'ATENCION_PACIENTE_CITAS';
  const allTramos = () => typeof tramos !== 'undefined' && Array.isArray(tramos) ? tramos : [];
  const allNotifications = () => typeof notifications !== 'undefined' && Array.isArray(notifications) ? notifications : [];

  function enforceRoleUI(){
    const p=currentProfile();
    if(!p) return;
    if(!isAdminRole()){
      document.querySelector('button[data-tab="usuarios"]')?.classList.add('hidden');
      document.getElementById('tab-usuarios')?.classList.add('hidden');
      document.getElementById('userForm')?.classList.add('hidden');
      document.querySelector('.user-form-extra')?.classList.add('hidden');
      document.querySelectorAll('button,a').forEach(el=>{
        const t=norm(el.textContent);
        if(['EDITAR USUARIO','ACTIVAR','AUSENCIA','SUSPENDER','INACTIVAR','BORRAR USUARIO','RESTABLECER ACCESO'].includes(t)){
          const userRow=el.closest('#usersList .item, #usersList > *, .sirro-user-row');
          if(userRow || el.closest('#tab-usuarios')) el.remove();
        }
      });
      document.querySelectorAll('h1,h2,h3,strong').forEach(h=>{
        const t=norm(h.textContent);
        if(t.includes('AUXILIARES DE ENFERMERIA') && t.includes('RESPONSABLE DE US')){
          const panel=h.closest('section,article,.card,div');
          if(panel) panel.remove();
        }
      });
    }
  }

  function requiresAttentionCount(){
    const p=currentProfile();
    if(!p || !isClinicalRole() || !p.establecimiento_id) return 0;
    if(isAppointmentRole()){
      return allNotifications().filter(n=>{
        if(n.leida) return false;
        const text=norm(`${n.titulo||''} ${n.mensaje||''}`);
        return text.includes('CITA') || text.includes('CONSULTA EXTERNA');
      }).length;
    }
    const est=String(p.establecimiento_id);
    const statesDest=new Set(['ENVIADO','EN_ATENCION','EVALUADO','HOSPITALIZADO']);
    const statesOrigin=new Set(['RESPUESTA_ENVIADA','RECHAZADO']);
    let count=0;
    for(const t of allTramos()){
      if(!t || ['CERRADO','CIERRE_ADMINISTRATIVO_EXTERNO'].includes(t.estado_actual)) continue;
      if(String(t.establecimiento_destino_id||'')===est && statesDest.has(t.estado_actual)) count++;
      else if(String(t.establecimiento_origen_id||'')===est && statesOrigin.has(t.estado_actual)) count++;
    }
    const criticalUnread=allNotifications().filter(n=>!n.leida && n.critica).length;
    return Math.max(count, criticalUnread);
  }

  function openPending(){
    const inicioBtn=document.querySelector('#tabs button[data-tab="inicio"]');
    if(inicioBtn) inicioBtn.click();
    setTimeout(()=>{
      if(typeof window.openSirroPending==='function') window.openSirroPending('attention');
      document.getElementById('sirroPendingCard')?.scrollIntoView({behavior:'smooth',block:'start'});
    },60);
  }

  function renderAttentionBanner(){
    const app=document.getElementById('appView');
    const userbar=app?.querySelector('.userbar');
    if(!app || !userbar || !currentProfile()) return;
    let banner=document.getElementById('sirroRequiresAttentionBanner');
    const count=requiresAttentionCount();
    if(!count){ if(banner) banner.remove(); return; }
    if(!banner){
      banner=document.createElement('button');
      banner.id='sirroRequiresAttentionBanner';
      banner.type='button';
      banner.style.cssText='width:100%;margin:0 0 14px;padding:12px 14px;border:2px solid #d97706;border-radius:12px;background:#fffbeb;color:#92400e;font-weight:900;text-align:left;cursor:pointer';
      banner.addEventListener('click',openPending);
      userbar.insertAdjacentElement('afterend',banner);
    }
    const nextText=`REQUIERE MI ATENCIÓN · ${count}`;
    if(banner.textContent!==nextText) banner.textContent=nextText;
  }

  let applying=false;
  function apply(){
    if(applying) return;
    applying=true;
    try { enforceRoleUI(); renderAttentionBanner(); }
    finally { applying=false; }
  }

  const prevConfigure=typeof configureTabs==='function'?configureTabs:null;
  if(prevConfigure){
    configureTabs=function(){ const r=prevConfigure.apply(this,arguments); setTimeout(apply,0); return r; };
  }
  const prevRefresh=typeof refreshAll==='function'?refreshAll:null;
  if(prevRefresh){
    refreshAll=async function(){ const r=await prevRefresh.apply(this,arguments); apply(); return r; };
  }

  const observer=new MutationObserver(mutations=>{
    if(applying) return;
    const onlyBanner=mutations.length>0 && mutations.every(m=>m.target?.id==='sirroRequiresAttentionBanner' || m.target?.parentElement?.id==='sirroRequiresAttentionBanner');
    if(onlyBanner) return;
    clearTimeout(window.__sirroRegressionGuardTimer);
    window.__sirroRegressionGuardTimer=setTimeout(apply,80);
  });
  const start=()=>{observer.observe(document.body,{childList:true,subtree:true});apply();};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
