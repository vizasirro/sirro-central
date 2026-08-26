(() => {
  if (window.SIRRO_ADMINISTRADOR_PROFILE) return;
  const isOperational=()=>typeof profile!=='undefined'&&profile?.rol==='ADMINISTRADOR';
  const isRegional=()=>typeof profile!=='undefined'&&profile?.rol==='ADMIN_REGIONAL';

  try{ if(typeof roleLabels!=='undefined') roleLabels.ADMINISTRADOR='Administrador'; }catch{}
  try{
    if(typeof helpGuides!=='undefined') helpGuides.ADMINISTRADOR={title:'Administrador',sections:[
      ['Supervisión operativa',['Revise Inicio, Seguimiento, Monitoreo, Monitoreo materno y Evaluación R/R para todo Olancho.','Puede gestionar usuarios operativos, pero no Administradores Regionales ni otros Administradores.']],
      ['Seguridad',['No tiene acceso a reinicios, borrados de prueba, claves especiales ni configuración estructural sensible de SIRRO.','Las acciones permitidas continúan auditadas.']]
    ]};
  }catch{}

  try{isAdmin=function(){return ['ADMIN_REGIONAL','ADMINISTRADOR'].includes(profile?.rol);};}catch{}
  try{isAudit=function(){return ['ADMIN_REGIONAL','ADMINISTRADOR','AUDITOR_CONSULTA'].includes(profile?.rol);};}catch{}

  function addRoleOption(){
    const sel=document.getElementById('newRole');if(!sel)return;
    if(![...sel.options].some(o=>o.value==='ADMINISTRADOR')){
      const opt=document.createElement('option');opt.value='ADMINISTRADOR';opt.textContent='Administrador';
      const adminRegional=[...sel.options].find(o=>o.value==='ADMIN_REGIONAL');
      adminRegional?.insertAdjacentElement('afterend',opt);
    }
    if(isOperational()){
      [...sel.options].forEach(o=>{if(['ADMIN_REGIONAL','ADMINISTRADOR'].includes(o.value))o.hidden=true;});
    }
  }

  function protectUI(){
    addRoleOption();
    if(!isOperational())return;
    document.querySelector('.user-form-extra')?.classList.add('hidden');
    document.querySelectorAll('[data-delete-user],#setResetKeyBtn,#resetAllBtn').forEach(x=>x.remove());
    document.querySelector('button[data-tab="usuarios"]')?.classList.remove('hidden');
    document.querySelector('button[data-tab="auditoria"]')?.classList.remove('hidden');
    document.querySelector('button[data-tab="evaluacion"]')?.classList.remove('hidden');
    const meta=document.getElementById('userMeta');if(meta&&profile)meta.textContent=['Administrador',profile.cargo_funcion].filter(Boolean).join(' · ');
  }

  const baseRenderUsers=typeof renderUsers==='function'?renderUsers:null;
  if(baseRenderUsers){
    renderUsers=function(){
      const r=baseRenderUsers.apply(this,arguments);protectUI();
      if(isOperational()&&Array.isArray(users)){
        const list=document.getElementById('usersList');
        [...(list?.children||[])].forEach((row,i)=>{
          const u=users[i];if(!u)return;
          if(['ADMIN_REGIONAL','ADMINISTRADOR'].includes(u.rol))row.querySelector('.actions')?.remove();
          row.querySelectorAll('[data-delete-user]').forEach(x=>x.remove());
        });
      }
      return r;
    };
  }

  const baseConfigure=typeof configureTabs==='function'?configureTabs:null;
  if(baseConfigure){configureTabs=function(){const r=baseConfigure.apply(this,arguments);protectUI();return r;};}
  const obs=new MutationObserver(()=>protectUI());
  if(document.body)obs.observe(document.body,{childList:true,subtree:true});
  else document.addEventListener('DOMContentLoaded',()=>obs.observe(document.body,{childList:true,subtree:true}),{once:true});
  addRoleOption();protectUI();
  window.SIRRO_ADMINISTRADOR_PROFILE=Object.freeze({isOperational,isRegional});
})();