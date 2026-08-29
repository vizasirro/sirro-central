(() => {
  if (window.SIRRO_MATERNAL_MONITOR_STYLE) return;
  window.SIRRO_MATERNAL_MONITOR_STYLE = true;
  const style=document.createElement('style');
  style.textContent=`
    #tabs #maternalMonitorTabBtn{
      background:#8a3d78!important;
      color:#fff!important;
      border:1px solid #743164!important;
      box-shadow:0 1px 3px #0002!important;
    }
    #tabs #maternalMonitorTabBtn:hover,
    #tabs #maternalMonitorTabBtn:focus{
      background:#753366!important;
      color:#fff!important;
    }
    #tabs #maternalMonitorTabBtn.active{
      background:#6a2b5d!important;
      color:#fff!important;
      outline:2px solid #d9b8cf!important;
      outline-offset:2px!important;
    }
  `;
  document.head.appendChild(style);

  function resetSirroUiAfterLogout(){
    try{ if(typeof currentUser!=='undefined') currentUser=null; }catch{}
    try{ if(typeof profile!=='undefined') profile=null; }catch{}
    const app=document.getElementById('appView');
    const help=document.getElementById('helpView');
    const forgot=document.getElementById('forgotPasswordView');
    const update=document.getElementById('updatePasswordView');
    const login=document.getElementById('loginView');
    const logout=document.getElementById('logoutBtn');
    const helpBtn=document.getElementById('helpBtn');
    if(app) app.classList.add('hidden');
    if(help) help.classList.add('hidden');
    if(forgot) forgot.classList.add('hidden');
    if(update) update.classList.add('hidden');
    if(login) login.classList.remove('hidden');
    if(logout) logout.classList.add('hidden');
    if(helpBtn) helpBtn.classList.add('hidden');
    const pass=document.getElementById('loginPass');
    if(pass) pass.value='';
    const msg=document.getElementById('loginMsg');
    if(msg){msg.textContent='Sesión cerrada correctamente.';msg.className='notice ok';msg.style.display='block';}
    window.scrollTo({top:0,behavior:'auto'});
  }

  function installLogoutFix(){
    const btn=document.getElementById('logoutBtn');
    if(!btn||btn.dataset.sirroLogoutFixed==='1') return;
    btn.dataset.sirroLogoutFixed='1';
    btn.onclick=null;
    btn.addEventListener('click',async e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      btn.disabled=true;
      btn.textContent='Saliendo…';
      try{
        if(typeof sb!=='undefined'&&sb?.auth){
          await Promise.race([
            sb.auth.signOut({scope:'local'}).catch(()=>sb.auth.signOut().catch(()=>{})),
            new Promise(resolve=>setTimeout(resolve,2500))
          ]);
        }
      }catch{}
      try{
        Object.keys(localStorage).filter(k=>k.startsWith('sb-')||k.toLowerCase().includes('supabase')).forEach(k=>localStorage.removeItem(k));
        Object.keys(sessionStorage).filter(k=>k.startsWith('sb-')||k.toLowerCase().includes('supabase')).forEach(k=>sessionStorage.removeItem(k));
      }catch{}
      resetSirroUiAfterLogout();
      btn.disabled=false;
      btn.textContent='Salir';
      try{history.replaceState(null,'',location.pathname+location.search);}catch{}
    },true);
  }

  installLogoutFix();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',installLogoutFix,{once:true});
})();
