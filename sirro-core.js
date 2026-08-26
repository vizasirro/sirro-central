(() => {
  if (window.SIRRO) return;

  const ROLES = Object.freeze({
    ADMIN_REGIONAL: 'ADMIN_REGIONAL',
    ADMINISTRADOR: 'ADMINISTRADOR',
    ECOR: 'ECOR',
    JEFE_MUNICIPAL: 'JEFE_MUNICIPAL',
    USUARIO_US: 'USUARIO_US',
    USUARIO_HOSPITAL: 'USUARIO_HOSPITAL',
    AUDITOR_CONSULTA: 'AUDITOR_CONSULTA'
  });

  const TZ = 'America/Tegucigalpa';
  const PUERPERIO = Object.freeze({
    CONTROL_1: Object.freeze({ numero: 1, desdeHoras: 48, hastaHoras: 72 }),
    CONTROL_2: Object.freeze({ numero: 2, desdeDias: 3, hastaDias: 7 }),
    CONTROL_3: Object.freeze({ numero: 3, dia: 40 })
  });

  const client = () => {
    if (typeof sb === 'undefined' || !sb) throw new Error('Cliente Supabase no disponible');
    return sb;
  };

  const api = Object.freeze({
    rpc(name, params = {}) { return client().rpc(name, params); },
    invoke(name, body = {}) { return client().functions.invoke(name, { body }); },
    table(name) { return client().from(name); }
  });

  const errors = Object.freeze({
    message(error, fallback = 'Ocurrió un error inesperado.') { return error?.message || error?.error_description || fallback; }
  });

  const authz = Object.freeze({
    isAdminRegional(profileValue) { return profileValue?.rol === ROLES.ADMIN_REGIONAL; },
    isAdministrador(profileValue) { return profileValue?.rol === ROLES.ADMINISTRADOR; },
    isHospital(profileValue) { return profileValue?.rol === ROLES.USUARIO_HOSPITAL; }
  });

  // Regla de oro: el Administrador operativo se reconoce desde el núcleo,
  // sin esperar a que cargue un módulo posterior. Esto evita carreras al iniciar sesión.
  try {
    if (typeof roleLabels !== 'undefined') roleLabels.ADMINISTRADOR = 'Administrador';
    if (typeof isAdmin === 'function') isAdmin = function(){ return ['ADMIN_REGIONAL','ADMINISTRADOR'].includes(profile?.rol); };
    if (typeof isAudit === 'function') isAudit = function(){ return ['ADMIN_REGIONAL','ADMINISTRADOR','AUDITOR_CONSULTA'].includes(profile?.rol); };
  } catch {}

  window.SIRRO = Object.freeze({ version: 'core-5', constants: Object.freeze({ ROLES, TZ, PUERPERIO }), api, errors, authz });

  function loadModule(src, marker) {
    if (window[marker] || document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.sirroModule = marker;
    script.onerror = () => console.error(`No se pudo cargar el módulo ${src}`);
    document.head.appendChild(script);
  }

  loadModule('./startup-ready.js', 'SIRRO_STARTUP_READY');
  loadModule('./auth-security.js', 'SIRRO_AUTH_SECURITY');
  loadModule('./data-resilience.js', 'SIRRO_DATA_RESILIENCE');
  loadModule('./pending-color-semantics.js', 'SIRRO_PENDING_COLOR_SEMANTICS');
  loadModule('./specialty-filter.js', 'SIRRO_SPECIALTY_FILTER');
  loadModule('./specialty-transfers.js', 'SIRRO_SPECIALTY_TRANSFERS');
  loadModule('./appointment-role.js', 'SIRRO_APPOINTMENT_ROLE');
  loadModule('./ce-referral-hint.js', 'SIRRO_CE_REFERRAL_HINT');
  loadModule('./hospital-profile.js', 'SIRRO_HOSPITAL_PROFILE');
  loadModule('./gerencia-profile.js', 'SIRRO_GERENCIA_PROFILE');
  loadModule('./administrador-profile.js', 'SIRRO_ADMINISTRADOR_PROFILE');
  loadModule('./maternal-monitor.js', '__sirroMaternalMonitorLoaded');
  loadModule('./maternal-monitor-style.js', 'SIRRO_MATERNAL_MONITOR_STYLE');
})();