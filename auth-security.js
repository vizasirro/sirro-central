(() => {
  if (window.SIRRO_AUTH_SECURITY) return;

  const SITE_KEY = '0x4AAAAAAEZUsW_95JDOEt40';
  const tokens = { login: '', recovery: '' };
  const widgets = { login: null, recovery: null };

  function ensureTurnstileScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (window.__sirroTurnstilePromise) return window.__sirroTurnstilePromise;
    window.__sirroTurnstilePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-sirro-turnstile]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
        existing.addEventListener('error', () => reject(new Error('No se pudo cargar la verificación de seguridad.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.sirroTurnstile = 'true';
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error('No se pudo cargar la verificación de seguridad.'));
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
        callback: token => { tokens[kind] = token || ''; },
        'expired-callback': () => { tokens[kind] = ''; },
        'error-callback': () => { tokens[kind] = ''; },
        theme: 'auto'
      });
    } catch (error) {
      const target = kind === 'login' ? '#loginMsg' : '#recoveryMsg';
      if (typeof showMsg === 'function') showMsg(target, error.message, 'error');
    }
  }

  async function secureLogin() {
    if (typeof showMsg !== 'function') return;
    showMsg('#loginMsg', 'Ingresando…');
    const u = document.getElementById('loginUser')?.value.trim() || '';
    const p = document.getElementById('loginPass')?.value || '';
    if (!u || !p) return showMsg('#loginMsg', 'Escriba usuario y contraseña.', 'error');
    if (!tokens.login) return showMsg('#loginMsg', 'Complete la verificación de seguridad.', 'error');
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
    if (!tokens.recovery) return showMsg('#recoveryMsg', 'Complete la verificación de seguridad.', 'error');
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
  window.SIRRO_AUTH_SECURITY = Object.freeze({ version: 'auth-security-1', reset, mount });

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