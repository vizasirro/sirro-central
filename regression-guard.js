(() => {
  if (window.SIRRO_REGRESSION_GUARD) return;
  window.SIRRO_REGRESSION_GUARD = true;

  if(!document.querySelector('script[src="./login-stable.js"]')){
    const ls=document.createElement('script'); ls.src='./login-stable.js'; ls.async=false; document.head.appendChild(ls);
  }

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  const currentProfile=()=>typeof profile!=='undefined'?profile:null;
  const isAdminRole=()=>['ADMIN_REGIONAL','ADMINISTRADOR'].includes(currentProfile()?.rol);
  const isClinicalRole=()=>['USUARIO_HOSPITAL','USUARIO_US'].includes(currentProfile()?.rol);
  const isAppointmentRole=()=>currentProfile()?.rol==='USUARIO_HOSPITAL'&&currentProfile()?.tipo_usuario_hospital==='ATENCION_PACIENTE_CITAS';
  const allTramos=()=>typeof tramos!=='undefined'&&Array.isArray(tramos)?tramos:[];
  const allNotifications=()=>typeof notifications!=='undefined'&&Array.isArray(notifications)?notifications:[];

  function enforceRoleUI(){
    const p=currentProfile(); if(!p)return;
    if(!isAdminRole()){
      document.querySelector('button[data-tab="usuarios"]')?.classList.add('hidden');
      document.getElementById('tab-usuarios')?.classList.add('hidden');
      document.getElementById('userForm')?.classList.add('hidden');
      document.querySelector('.user-form-extra')?.classList.add('hidden');
      document.querySelectorAll('button,a').forEach(el=>{
        const t=norm(el.textContent);
        if(['EDITAR USUARIO','ACTIVAR','AUSENCIA','SUSPENDER','INACTIVAR','BORRAR USUARIO','RESTABLECER ACCESO'].includes(t)){
          const row=el.closest('#usersList .item, #usersList > *, .sirro-user-row');
          if(row||el.closest('#tab-usuarios'))el.remove();
        }
      });
    }
  }

  function requiresAttentionCount(){
    const p=currentProfile();
    if(!p||!isClinicalRole()||!p.establecimiento_id)return 0;
    if(isAppointmentRole()){
      return allNotifications().filter(n=>!n.leida&&(()=>{const x=norm(`${n.titulo||''} ${n.mensaje||''}`);return x.includes('CITA')||x.includes('CONSULTA EXTERNA');})()).length;
    }
    const est=String(p.establecimiento_id), hospital=p.rol==='USUARIO_HOSPITAL';
    /* La atención se deriva del estado operativo del tramo. Una notificación antigua no mantiene el banner después de responder. */
    const statesDest=hospital?new Set(['ENVIADO','EN_ATENCION','EVALUADO','HOSPITALIZADO']):new Set(['ENVIADO','EN_ATENCION','EVALUADO','HOSPITALIZADO']);
    const statesOrigin=new Set(['RESPUESTA_ENVIADA','RECHAZADO']);
    let count=0;
    for(const t of allTramos()){
      const state=norm(t?.estado_actual);
      if(!t||['CERRADO','CIERRE_ADMINISTRATIVO_EXTERNO','RESPUESTA_ENVIADA','RESPONDIDO'].includes(state)&&String(t.establecimiento_destino_id||'')===est)continue;
      if(String(t.establecimiento_destino_id||'')===est&&statesDest.has(state))count++;
      else if(String(t.establecimiento_origen_id||'')===est&&statesOrigin.has(state))count++;
    }
    return count;
  }

  function openPending(){
    document.querySelector('#tabs button[data-tab="inicio"]')?.click();
    setTimeout(()=>{if(typeof window.openSirroPending==='function')window.openSirroPending('attention');document.getElementById('sirroPendingCard')?.scrollIntoView({behavior:'smooth',block:'start'});},60);
  }
  function renderAttentionBanner(){
    const app=document.getElementById('appView'),userbar=app?.querySelector('.userbar');
    if(!app||!userbar||!currentProfile())return;
    let banner=document.getElementById('sirroRequiresAttentionBanner'); const count=requiresAttentionCount();
    if(!count){banner?.remove();return;}
    if(!banner){banner=document.createElement('button');banner.id='sirroRequiresAttentionBanner';banner.type='button';banner.style.cssText='width:100%;margin:0 0 14px;padding:12px 14px;border:2px solid #d97706;border-radius:12px;background:#fffbeb;color:#92400e;font-weight:900;text-align:left;cursor:pointer';banner.addEventListener('click',openPending);userbar.insertAdjacentElement('afterend',banner);}
    const text=`REQUIERE MI ATENCIÓN · ${count}`;if(banner.textContent!==text)banner.textContent=text;
  }
  let applying=false;
  function apply(){if(applying)return;applying=true;try{enforceRoleUI();renderAttentionBanner();}finally{applying=false;}}
  const prevConfigure=typeof configureTabs==='function'?configureTabs:null;
  if(prevConfigure)configureTabs=function(){const r=prevConfigure.apply(this,arguments);setTimeout(apply,0);return r;};
  const prevRefresh=typeof refreshAll==='function'?refreshAll:null;
  if(prevRefresh)refreshAll=async function(){const r=await prevRefresh.apply(this,arguments);apply();return r;};
  const observer=new MutationObserver(m=>{if(applying)return;const only=m.length>0&&m.every(x=>x.target?.id==='sirroRequiresAttentionBanner'||x.target?.parentElement?.id==='sirroRequiresAttentionBanner');if(only)return;clearTimeout(window.__sirroRegressionGuardTimer);window.__sirroRegressionGuardTimer=setTimeout(apply,80);});
  const start=()=>{observer.observe(document.body,{childList:true,subtree:true});apply();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();