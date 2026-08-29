(() => {
  if (window.SIRRO_AUTH_SECURITY) return;

  const SITE_KEY = '0x4AAAAAAEZUsW_95JDOEt40';
  const tokens = { login: '', recovery: '' };
  const widgets = { login: null, recovery: null };
  const retryCount = { login: 0, recovery: 0 };
  const MAX_RETRIES = 4;

  function clearTurnstileLoader() {
    try {
      const existing = document.querySelector('script[data-sirro-turnstile]');
      if (existing) existing.remove();
    } catch {}
    window.__sirroTurnstilePromise = null;
  }

  function ensureTurnstileScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (window.__sirroTurnstilePromise) return window.__sirroTurnstilePromise;
    window.__sirroTurnstilePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-sirro-turnstile]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
        existing.addEventListener('error', () => { clearTurnstileLoader(); reject(new Error('No se pudo cargar la verificación de seguridad.')); }, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.sirroTurnstile = 'true';
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => { clearTurnstileLoader(); reject(new Error('No se pudo cargar la verificación de seguridad.')); };
      document.head.appendChild(script);
    });
    return window.__sirroTurnstilePromise;
  }

  function reset(kind) {
    tokens[kind] = '';
    try {
      if (window.turnstile && widgets[kind] !== null) window.turnstile.reset(widgets[kind]);
    } catch {}
  }

  function removeWidget(kind) {
    tokens[kind] = '';
    try {
      if (window.turnstile && widgets[kind] !== null) window.turnstile.remove(widgets[kind]);
    } catch {}
    widgets[kind] = null;
    const id = kind === 'login' ? 'sirroTurnstileLogin' : 'sirroTurnstileRecovery';
    const box = document.getElementById(id);
    if (box) box.innerHTML = '';
  }

  function targetFor(kind){
    return kind === 'login' ? '#loginMsg' : '#recoveryMsg';
  }

  function scheduleRetry(kind, errorCode = '') {
    const target = targetFor(kind);
    if (retryCount[kind] >= MAX_RETRIES) {
      if (typeof showMsg === 'function') {
        const code = errorCode ? ` Código Cloudflare: ${errorCode}.` : '';
        showMsg(target, `La verificación de seguridad no pudo conectarse en ${location.hostname}.${code}`, 'error');
      }
      return;
    }
    retryCount[kind] += 1;
    setTimeout(() => {
      removeWidget(kind);
      mount(kind);
    }, 1500 * retryCount[kind]);
  }

  async function mount(kind) {
    const view = kind === 'login' ? document.getElementById('loginView') : document.getElementById('forgotPasswordView');
    if (!view) return;
    const id = kind === 'login' ? 'sirroTurnstileLogin' : 'sirroTurnstileRecovery';
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
      if (!turnstile || widgets[kind] !== null) return;
      widgets[kind] = turnstile.render(box, {
        sitekey: SITE_KEY,
        callback: token => {
          tokens[kind] = token || '';
          retryCount[kind] = 0;
          const target = targetFor(kind);
          if (typeof showMsg === 'function' && token) showMsg(target, '');
        },
        'expired-callback': () => { tokens[kind] = ''; },
        'timeout-callback': () => { tokens[kind] = ''; scheduleRetry(kind, 'timeout'); },
        'error-callback': errorCode => {
          tokens[kind] = '';
          const target = targetFor(kind);
          if (typeof showMsg === 'function' && errorCode) {
            showMsg(target, `Error de verificación Cloudflare ${errorCode} en ${location.hostname}.`, 'error');
          }
          scheduleRetry(kind, errorCode || 'desconocido');
          return true;
        },
        retry: 'auto',
        'retry-interval': 2000,
        'refresh-expired': 'auto',
        'refresh-timeout': 'auto',
        theme: 'auto'
      });
    } catch (error) {
      clearTurnstileLoader();
      const target = targetFor(kind);
      if (typeof showMsg === 'function') showMsg(target, `No se pudo cargar Cloudflare Turnstile en ${location.hostname}.`, 'error');
      scheduleRetry(kind, 'script');
    }
  }

  async function secureLogin() {
    if (typeof showMsg !== 'function') return;
    showMsg('#loginMsg', 'Ingresando…');
    const u = document.getElementById('loginUser')?.value.trim() || '';
    const p = document.getElementById('loginPass')?.value || '';
    if (!u || !p) return showMsg('#loginMsg', 'Escriba usuario y contraseña.', 'error');
    if (!tokens.login) {
      mount('login');
      return showMsg('#loginMsg', 'Espere un momento mientras se completa la verificación de seguridad.', 'error');
    }
    let email;
    try { email = await authEmail(u); }
    catch { return showMsg('#loginMsg', 'No se pudo validar el usuario. Intente nuevamente.', 'error'); }
    const captchaToken = tokens.login;
    const { data, error } = await sb.auth.signInWithPassword({ email, password: p, options: { captchaToken } });
    reset('login');
    if (error) return showMsg('#loginMsg', 'Usuario o contraseña incorrectos.', 'error');
    await enter(data.user);
  }

  async function secureSendRecovery() {
    const user = document.getElementById('recoveryUser')?.value.trim() || '';
    if (!user) return showMsg('#recoveryMsg', 'Escriba su usuario o correo.', 'error');
    if (!tokens.recovery) {
      mount('recovery');
      return showMsg('#recoveryMsg', 'Espere un momento mientras se completa la verificación de seguridad.', 'error');
    }
    showMsg('#recoveryMsg', 'Procesando solicitud…');
    const captchaToken = tokens.recovery;
    try {
      const email = await authEmail(user);
      await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname, captchaToken });
    } catch {}
    reset('recovery');
    showMsg('#recoveryMsg', 'Si la cuenta existe y tiene correo habilitado, recibirá un enlace de recuperación. Revise también correo no deseado.', 'ok');
  }

  const originalShowForgot = typeof showForgotPassword === 'function' ? showForgotPassword : null;
  function secureShowForgotPassword() {
    originalShowForgot?.();
    mount('recovery');
  }

  const originalShowLogin = typeof showLogin === 'function' ? showLogin : null;
  function secureShowLogin() {
    originalShowLogin?.();
    mount('login');
  }

  window.login = secureLogin;
  window.sendRecovery = secureSendRecovery;
  window.showForgotPassword = secureShowForgotPassword;
  window.showLogin = secureShowLogin;
  window.SIRRO_AUTH_SECURITY = Object.freeze({ version: 'auth-security-3', reset, mount });

  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.onclick = secureLogin;
  const forgotBtn = document.getElementById('forgotPasswordBtn');
  if (forgotBtn) forgotBtn.onclick = secureShowForgotPassword;
  const recoveryBtn = document.getElementById('sendRecoveryBtn');
  if (recoveryBtn) recoveryBtn.onclick = secureSendRecovery;
  const backBtn = document.getElementById('backToLoginBtn');
  if (backBtn) backBtn.onclick = secureShowLogin;

  mount('login');
})();