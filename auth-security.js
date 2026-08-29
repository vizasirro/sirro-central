(() => {
  if (window.SIRRO_AUTH_SECURITY) return;

  const SITE_KEY = '0x4AAAAAAEZUsW_95JDOEt40';
  const AUTH_TIMEOUT_MS = 20000;
  const PROFILE_TIMEOUT_MS = 12000;
  const tokens = { login: '', recovery: '' };
  const widgets = { login: null, recovery: null };
  const retryCount = { login: 0, recovery: 0 };
  const MAX_RETRIES = 4;

  function withTimeout(promise, ms, code='TIMEOUT') {
    let timer;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(code)), ms); })
    ]).finally(() => clearTimeout(timer));
  }

  function setLoginBusy(busy) {
    const btn = document.getElementById('loginBtn');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? 'Ingresando…' : 'Ingresar';
  }

  function targetFor(kind) { return kind === 'login' ? '#loginMsg' : '#recoveryMsg'; }

  function normalizeLoginIdentifier(value) {
    const u = String(value || '').trim().toLowerCase();
    const match = u.match(/^([^@]+)@sirro\.net$/i);
    return match ? match[1] : u;
  }

  function captchaBoxId(kind) {
    return kind === 'login' ? 'sirroTurnstileLogin' : 'sirroTurnstileRecovery';
  }

  function readCaptchaToken(kind) {
    if (tokens[kind]) return tokens[kind];
    const box = document.getElementById(captchaBoxId(kind));
    const field = box?.querySelector('input[name="cf-turnstile-response"],textarea[name="cf-turnstile-response"]') ||
      document.querySelector('input[name="cf-turnstile-response"],textarea[name="cf-turnstile-response"]');
    const value = String(field?.value || '').trim();
    if (value) tokens[kind] = value;
    return value;
  }

  function clearTurnstileLoader() {
    try { document.querySelector('script[data-sirro-turnstile]')?.remove(); } catch {}
    window.__sirroTurnstilePromise = null;
  }

  function ensureTurnstileScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (window.__sirroTurnstilePromise) return window.__sirroTurnstilePromise;
    window.__sirroTurnstilePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.sirroTurnstile = 'true';
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => { clearTurnstileLoader(); reject(new Error('TURNSTILE_LOAD')); };
      document.head.appendChild(script);
    });
    return window.__sirroTurnstilePromise;
  }

  function reset(kind) {
    tokens[kind] = '';
    try { if (window.turnstile && widgets[kind] !== null) window.turnstile.reset(widgets[kind]); } catch {}
  }

  function removeWidget(kind) {
    tokens[kind] = '';
    try { if (window.turnstile && widgets[kind] !== null) window.turnstile.remove(widgets[kind]); } catch {}
    widgets[kind] = null;
    const box = document.getElementById(captchaBoxId(kind));
    if (box) box.innerHTML = '';
  }

  function scheduleRetry(kind, code='') {
    if (retryCount[kind] >= MAX_RETRIES) {
      if (typeof showMsg === 'function') showMsg(targetFor(kind), `La verificación de seguridad no pudo conectarse en ${location.hostname}.${code ? ` Código Cloudflare: ${code}.` : ''}`, 'error');
      return;
    }
    retryCount[kind] += 1;
    setTimeout(() => { removeWidget(kind); mount(kind); }, 1200 * retryCount[kind]);
  }

  async function mount(kind) {
    const view = kind === 'login' ? document.getElementById('loginView') : document.getElementById('forgotPasswordView');
    if (!view) return;
    const id = captchaBoxId(kind);
    let box = document.getElementById(id);
    if (!box) {
      box = document.createElement('div');
      box.id = id;
      box.style.cssText = 'display:flex;justify-content:center;margin:12px 0;min-height:65px';
      const anchor = kind === 'login' ? document.getElementById('forgotPasswordBtn') : document.getElementById('sendRecoveryBtn');
      view.insertBefore(box, anchor || view.lastElementChild);
    }
    if (widgets[kind] !== null) return;
    try {
      const turnstile = await ensureTurnstileScript();
      widgets[kind] = turnstile.render(box, {
        sitekey: SITE_KEY,
        callback: token => { tokens[kind] = token || ''; retryCount[kind] = 0; if (token && typeof showMsg === 'function') showMsg(targetFor(kind), ''); },
        'expired-callback': () => { tokens[kind] = ''; },
        'timeout-callback': () => { tokens[kind] = ''; scheduleRetry(kind, 'timeout'); },
        'error-callback': code => { tokens[kind] = ''; scheduleRetry(kind, code || 'desconocido'); return true; },
        retry: 'auto',
        'retry-interval': 2000,
        'refresh-expired': 'auto',
        'refresh-timeout': 'auto',
        theme: 'auto'
      });
    } catch {
      clearTurnstileLoader();
      if (typeof showMsg === 'function') showMsg(targetFor(kind), `No se pudo cargar Cloudflare Turnstile en ${location.hostname}.`, 'error');
      scheduleRetry(kind, 'script');
    }
  }

  async function fetchProfileDirect(userId, accessToken) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);
    try {
      const url = `${SUPABASE_URL}/rest/v1/perfiles?id=eq.${encodeURIComponent(userId)}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      });
      if (!response.ok) throw new Error(`PROFILE_HTTP_${response.status}`);
      const rows = await response.json();
      return Array.isArray(rows) ? rows[0] || null : null;
    } finally { clearTimeout(timer); }
  }

  async function safeEnter(user, session) {
    if (!user || !session?.access_token) throw new Error('SESSION_MISSING');
    currentUser = user;
    let p = null;
    try { p = await fetchProfileDirect(user.id, session.access_token); }
    catch {
      try {
        const result = await withTimeout(sb.from('perfiles').select('*').eq('id', user.id).maybeSingle(), PROFILE_TIMEOUT_MS, 'PROFILE_TIMEOUT');
        if (!result?.error) p = result?.data || null;
      } catch {}
    }
    if (!p) {
      sb.auth.signOut().catch?.(() => {});
      throw new Error('PROFILE_NOT_FOUND');
    }
    profile = p;
    if (profile.estado !== 'ACTIVO') {
      sb.auth.signOut().catch?.(() => {});
      throw new Error(`PROFILE_${profile.estado || 'INACTIVO'}`);
    }

    document.getElementById('loginView')?.classList.add('hidden');
    document.getElementById('forgotPasswordView')?.classList.add('hidden');
    document.getElementById('updatePasswordView')?.classList.add('hidden');
    document.getElementById('appView')?.classList.remove('hidden');
    document.getElementById('logoutBtn')?.classList.remove('hidden');
    document.getElementById('helpBtn')?.classList.remove('hidden');
    const name = document.getElementById('userName');
    const meta = document.getElementById('userMeta');
    if (name) name.textContent = profile.nombre_completo || '';
    if (meta) meta.textContent = [typeof roleLabel === 'function' ? roleLabel(profile.rol) : profile.rol, profile.cargo_funcion].filter(Boolean).join(' · ');

    try { if (typeof configureTabs === 'function') configureTabs(); } catch {}

    setTimeout(async () => {
      try {
        if (typeof loadCatalogs === 'function') await withTimeout(loadCatalogs(), 25000, 'CATALOG_TIMEOUT');
        if (typeof configureTabs === 'function') configureTabs();
        if (typeof refreshAll === 'function') await withTimeout(refreshAll(), 35000, 'REFRESH_TIMEOUT');
      } catch (e) {
        console.error('SIRRO carga posterior al ingreso:', e);
        try {
          const app = document.getElementById('appView');
          if (app && !document.getElementById('sirroLoadWarning')) {
            const n = document.createElement('div');
            n.id = 'sirroLoadWarning';
            n.className = 'notice error';
            n.textContent = 'SIRRO inició sesión, pero algunos datos tardaron en cargar. Use Actualizar si algún módulo aparece incompleto.';
            app.prepend(n);
          }
        } catch {}
      }
    }, 0);
  }

  async function secureLogin() {
    if (typeof showMsg !== 'function') return;
    const rawUser = document.getElementById('loginUser')?.value.trim() || '';
    const u = normalizeLoginIdentifier(rawUser);
    const p = document.getElementById('loginPass')?.value || '';
    if (!u || !p) return showMsg('#loginMsg', 'Escriba usuario y contraseña.', 'error');

    const captchaToken = readCaptchaToken('login');
    if (!captchaToken) {
      removeWidget('login');
      await mount('login');
      return showMsg('#loginMsg', 'Complete nuevamente la verificación de seguridad y pulse Ingresar.', 'error');
    }

    setLoginBusy(true);
    showMsg('#loginMsg', 'Ingresando…');
    try {
      let email;
      try { email = await withTimeout(authEmail(u), AUTH_TIMEOUT_MS, 'EMAIL_TIMEOUT'); }
      catch { return showMsg('#loginMsg', 'No se pudo validar el usuario. Intente nuevamente.', 'error'); }

      const result = await withTimeout(
        sb.auth.signInWithPassword({ email, password: p, options: { captchaToken } }),
        AUTH_TIMEOUT_MS,
        'SIGNIN_TIMEOUT'
      );
      const { data, error } = result || {};
      reset('login');
      if (error) {
        if (String(error.message || '').toLowerCase().includes('captcha')) {
          removeWidget('login');
          await mount('login');
          return showMsg('#loginMsg', 'La verificación de seguridad debe completarse nuevamente.', 'error');
        }
        return showMsg('#loginMsg', 'Usuario o contraseña incorrectos.', 'error');
      }
      await safeEnter(data?.user, data?.session);
    } catch (error) {
      reset('login');
      mount('login');
      const msg = String(error?.message || '');
      if (msg === 'PROFILE_NOT_FOUND') showMsg('#loginMsg', 'El usuario no tiene perfil SIRRO.', 'error');
      else if (msg.startsWith('PROFILE_')) showMsg('#loginMsg', 'Usuario no activo.', 'error');
      else if (msg.includes('TIMEOUT')) showMsg('#loginMsg', 'La conexión tardó demasiado. Intente ingresar nuevamente.', 'error');
      else showMsg('#loginMsg', 'No fue posible completar el ingreso. Intente nuevamente.', 'error');
    } finally { setLoginBusy(false); }
  }

  async function secureSendRecovery() {
    const rawUser = document.getElementById('recoveryUser')?.value.trim() || '';
    const user = normalizeLoginIdentifier(rawUser);
    if (!user) return showMsg('#recoveryMsg', 'Escriba su usuario o correo.', 'error');
    const captchaToken = readCaptchaToken('recovery');
    if (!captchaToken) {
      removeWidget('recovery');
      await mount('recovery');
      return showMsg('#recoveryMsg', 'Complete la verificación de seguridad antes de continuar.', 'error');
    }
    showMsg('#recoveryMsg', 'Procesando solicitud…');
    try {
      const email = await withTimeout(authEmail(user), AUTH_TIMEOUT_MS, 'EMAIL_TIMEOUT');
      await withTimeout(sb.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname,
        captchaToken
      }), AUTH_TIMEOUT_MS, 'RECOVERY_TIMEOUT');
    } catch {}
    reset('recovery');
    showMsg('#recoveryMsg', 'Si la cuenta existe y tiene correo habilitado, recibirá un enlace de recuperación. Revise también correo no deseado.', 'ok');
  }

  const originalShowForgot = typeof showForgotPassword === 'function' ? showForgotPassword : null;
  const originalShowLogin = typeof showLogin === 'function' ? showLogin : null;
  function secureShowForgotPassword() { originalShowForgot?.(); mount('recovery'); }
  function secureShowLogin() { originalShowLogin?.(); mount('login'); }

  window.login = secureLogin;
  window.sendRecovery = secureSendRecovery;
  window.showForgotPassword = secureShowForgotPassword;
  window.showLogin = secureShowLogin;
  window.SIRRO_AUTH_SECURITY = Object.freeze({ version: 'auth-security-7', reset, mount, login: secureLogin });

  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.onclick = secureLogin;
    loginBtn.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); secureLogin(); }, true);
  }
  document.getElementById('loginPass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); secureLogin(); }
  }, true);
  document.getElementById('forgotPasswordBtn')?.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); secureShowForgotPassword(); }, true);
  document.getElementById('sendRecoveryBtn')?.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); secureSendRecovery(); }, true);
  document.getElementById('backToLoginBtn')?.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); secureShowLogin(); }, true);

  mount('login');
})();