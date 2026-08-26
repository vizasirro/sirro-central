(() => {
  if (window.SIRRO_STARTUP_READY) return;

  let recoveryRunning = false;
  let recoveredUserId = null;

  const visible = el => el && !el.classList.contains('hidden');
  const loginView = () => document.getElementById('loginView');
  const appView = () => document.getElementById('appView');

  function normalizeCoreRoles(){
    try {
      if (typeof roleLabels !== 'undefined') roleLabels.ADMINISTRADOR = 'Administrador';
      if (typeof isAdmin === 'function') isAdmin = function(){ return ['ADMIN_REGIONAL','ADMINISTRADOR'].includes(profile?.rol); };
      if (typeof isAudit === 'function') isAudit = function(){ return ['ADMIN_REGIONAL','ADMINISTRADOR','AUDITOR_CONSULTA'].includes(profile?.rol); };
    } catch {}
  }

  function showStartupError(message){
    try {
      if (typeof showMsg === 'function' && visible(loginView())) {
        showMsg('#loginMsg', message || 'No se pudo completar el arranque de SIRRO. Recargue la página e intente nuevamente.', 'error');
      }
    } catch {}
  }

  async function recoverSession(){
    if (recoveryRunning || typeof sb === 'undefined' || typeof enter !== 'function') return;
    if (visible(appView())) return;
    recoveryRunning = true;
    try {
      const {data,error} = await sb.auth.getSession();
      if (error) throw error;
      const user = data?.session?.user;
      if (!user) return;
      if (recoveredUserId === user.id && visible(appView())) return;
      normalizeCoreRoles();
      await enter(user);
      recoveredUserId = user.id;
    } catch (e) {
      console.error('SIRRO startup recovery:', e);
      showStartupError('La sesión fue validada, pero SIRRO no pudo terminar de cargar. Recargue la página una vez.');
    } finally {
      recoveryRunning = false;
    }
  }

  function ensureSecurity(){
    try {
      if (window.SIRRO_AUTH_SECURITY?.mount) {
        window.SIRRO_AUTH_SECURITY.mount('login');
      }
    } catch {}
  }

  function updateServiceWorker(){
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then(reg => reg?.update?.()).catch(()=>{});
  }

  normalizeCoreRoles();
  setTimeout(normalizeCoreRoles, 100);
  setTimeout(normalizeCoreRoles, 700);

  // Reintentos limitados: recuperan una sesión válida si otro módulo terminó de cargar después.
  setTimeout(recoverSession, 500);
  setTimeout(recoverSession, 1800);
  setTimeout(recoverSession, 4500);

  // Turnstile nunca se omite; solo se reintenta su montaje si la red tardó en cargarlo.
  setTimeout(ensureSecurity, 700);
  setTimeout(ensureSecurity, 2500);

  window.addEventListener('load', () => {
    updateServiceWorker();
    setTimeout(recoverSession, 250);
    setTimeout(ensureSecurity, 400);
  }, {once:true});

  window.addEventListener('unhandledrejection', event => {
    console.error('SIRRO unhandled rejection:', event.reason);
    if (!visible(appView())) showStartupError('SIRRO encontró un problema al iniciar. Recargue la página e intente nuevamente.');
  });

  window.addEventListener('error', event => {
    console.error('SIRRO runtime error:', event.error || event.message);
  });

  window.SIRRO_STARTUP_READY = Object.freeze({ version:'startup-ready-1', recoverSession, normalizeCoreRoles });
})();