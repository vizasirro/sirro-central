(() => {
  if (window.SIRRO_LOGIN_STABLE) return;
  window.SIRRO_LOGIN_STABLE = true;

  const AUTH_TIMEOUT = 15000;
  const PROFILE_TIMEOUT = 10000;
  let busy = false;

  const withTimeout = (promise, ms, code) => {
    let timer;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(code)), ms); })
    ]).finally(() => clearTimeout(timer));
  };

  const msg = (text, type='') => {
    try { if (typeof showMsg === 'function') showMsg('#loginMsg', text, type); } catch {}
  };

  const captchaToken = () => String(
    document.querySelector('#sirroTurnstileLogin input[name="cf-turnstile-response"],#sirroTurnstileLogin textarea[name="cf-turnstile-response"],input[name="cf-turnstile-response"],textarea[name="cf-turnstile-response"]')?.value || ''
  ).trim();

  async function resolveEmail(value){
    const u=String(value||'').trim().toLowerCase();
    if(!u) throw new Error('USER_REQUIRED');
    if(u.includes('@')){
      const m=u.match(/^([^@]+)@sirro\.net$/i);
      if(!m) return u;
      return withTimeout(authEmail(m[1]),AUTH_TIMEOUT,'EMAIL_TIMEOUT');
    }
    return withTimeout(authEmail(u),AUTH_TIMEOUT,'EMAIL_TIMEOUT');
  }

  async function getProfile(userId, accessToken){
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),PROFILE_TIMEOUT);
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/perfiles?id=eq.${encodeURIComponent(userId)}&select=*`,{
        cache:'no-store',signal:ctl.signal,
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`,Accept:'application/json'}
      });
      if(!r.ok) throw new Error(`PROFILE_${r.status}`);
      const rows=await r.json();
      return Array.isArray(rows)?rows[0]||null:null;
    } finally { clearTimeout(timer); }
  }

  function enterImmediately(user,p,sessionReady){
    currentUser=user;
    profile=p;
    document.getElementById('loginView')?.classList.add('hidden');
    document.getElementById('forgotPasswordView')?.classList.add('hidden');
    document.getElementById('updatePasswordView')?.classList.add('hidden');
    document.getElementById('appView')?.classList.remove('hidden');
    document.getElementById('logoutBtn')?.classList.remove('hidden');
    document.getElementById('helpBtn')?.classList.remove('hidden');
    const n=document.getElementById('userName');
    const m=document.getElementById('userMeta');
    if(n)n.textContent=p.nombre_completo||'';
    if(m)m.textContent=[typeof roleLabel==='function'?roleLabel(p.rol):p.rol,p.cargo_funcion].filter(Boolean).join(' · ');
    try{ if(typeof configureTabs==='function') configureTabs(); }catch{}
    setTimeout(async()=>{
      try{
        if(sessionReady) await sessionReady;
        if(typeof loadCatalogs==='function') await loadCatalogs();
        if(typeof configureTabs==='function') configureTabs();
        if(typeof refreshAll==='function') await refreshAll();
      }catch(e){
        console.error('SIRRO carga posterior:',e);
      }
    },0);
  }

  async function stableLogin(){
    if(busy) return;
    const raw=document.getElementById('loginUser')?.value||'';
    const password=document.getElementById('loginPass')?.value||'';
    if(!String(raw).trim()||!password){msg('Escriba usuario y contraseña.','error');return;}
    const token=captchaToken();
    if(!token){
      msg('Complete nuevamente la verificación de seguridad y pulse Ingresar.','error');
      try{window.SIRRO_AUTH_SECURITY?.reset?.('login');window.SIRRO_AUTH_SECURITY?.mount?.('login');}catch{}
      return;
    }
    busy=true;
    const btn=document.getElementById('loginBtn');
    if(btn){btn.disabled=true;btn.textContent='Ingresando…';}
    msg('Ingresando…');
    try{
      const email=await resolveEmail(raw);
      const r=await withTimeout(fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
        method:'POST',cache:'no-store',
        headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({email,password,gotrue_meta_security:{captcha_token:token}})
      }),AUTH_TIMEOUT,'SIGNIN_TIMEOUT');
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data?.error_code==='captcha_failed'?'CAPTCHA_FAILED':data?.error_description||data?.msg||'INVALID_LOGIN');
      if(!data?.access_token||!data?.refresh_token||!data?.user) throw new Error('SESSION_MISSING');
      const p=await getProfile(data.user.id,data.access_token);
      if(!p) throw new Error('PROFILE_NOT_FOUND');
      if(p.estado!=='ACTIVO') throw new Error(`PROFILE_${p.estado||'INACTIVO'}`);

      const sessionReady=withTimeout(
        sb.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token}),
        AUTH_TIMEOUT,
        'SESSION_SYNC_TIMEOUT'
      ).then(result=>{
        if(result?.error) throw new Error('SESSION_SYNC_FAILED');
        return true;
      });

      enterImmediately(data.user,p,sessionReady);
      msg('');
    }catch(e){
      console.error('SIRRO login estable:',e);
      const code=String(e?.message||'');
      if(code==='CAPTCHA_FAILED') msg('La verificación de seguridad venció. Complétela nuevamente.','error');
      else if(code==='PROFILE_NOT_FOUND') msg('El usuario no tiene perfil SIRRO.','error');
      else if(code.startsWith('PROFILE_')) msg('Usuario no activo.','error');
      else if(code.includes('TIMEOUT')) msg('La conexión tardó demasiado. Intente nuevamente.','error');
      else msg('Usuario o contraseña incorrectos.','error');
      try{window.SIRRO_AUTH_SECURITY?.reset?.('login');window.SIRRO_AUTH_SECURITY?.mount?.('login');}catch{}
    }finally{
      busy=false;
      if(btn){btn.disabled=false;btn.textContent='Ingresar';}
    }
  }

  function install(){
    const oldBtn=document.getElementById('loginBtn');
    if(oldBtn && !oldBtn.dataset.stableLogin){
      const fresh=oldBtn.cloneNode(true);
      fresh.dataset.stableLogin='1';
      fresh.onclick=null;
      oldBtn.replaceWith(fresh);
      fresh.addEventListener('click',e=>{e.preventDefault();stableLogin();});
    }
    const oldPass=document.getElementById('loginPass');
    if(oldPass && !oldPass.dataset.stableLogin){
      const freshPass=oldPass.cloneNode(true);
      freshPass.dataset.stableLogin='1';
      freshPass.value=oldPass.value;
      oldPass.replaceWith(freshPass);
      freshPass.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();stableLogin();}});
    }
    window.login=stableLogin;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
  setTimeout(install,500);
})();