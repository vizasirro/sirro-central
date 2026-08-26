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
    const extra=document.querySelector('.user-form-extra');
    if(extra&&!extra.classList.contains('hidden'))extra.classList.add('hidden');
    document.querySelectorAll('[data-delete-user],#setResetKeyBtn,#resetAllBtn').forEach(x=>x.remove());
    ['usuarios','auditoria','evaluacion'].forEach(tab=>document.querySelector(`button[data-tab="${tab}"]`)?.classList.remove('hidden'));
    const meta=document.getElementById('userMeta');
    if(meta&&profile){const text=['Administrador',profile.cargo_funcion].filter(Boolean).join(' · ');if(meta.textContent!==text)meta.textContent=text;}
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

  addRoleOption();protectUI();
  document.addEventListener('DOMContentLoaded',protectUI,{once:true});
  setTimeout(protectUI,250);
  setTimeout(protectUI,1200);
  window.SIRRO_ADMINISTRADOR_PROFILE=Object.freeze({isOperational,isRegional});
})();