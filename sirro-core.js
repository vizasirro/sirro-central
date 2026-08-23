(() => {
  if (window.SIRRO) return;

  const ROLES = Object.freeze({
    ADMIN_REGIONAL: 'ADMIN_REGIONAL',
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
    rpc(name, params = {}) {
      return client().rpc(name, params);
    },
    invoke(name, body = {}) {
      return client().functions.invoke(name, { body });
    },
    table(name) {
      return client().from(name);
    }
  });

  const errors = Object.freeze({
    message(error, fallback = 'Ocurrió un error inesperado.') {
      return error?.message || error?.error_description || fallback;
    }
  });

  const authz = Object.freeze({
    isAdminRegional(profileValue) {
      return profileValue?.rol === ROLES.ADMIN_REGIONAL;
    },
    isHospital(profileValue) {
      return profileValue?.rol === ROLES.USUARIO_HOSPITAL;
    }
  });

  window.SIRRO = Object.freeze({
    version: 'core-3',
    constants: Object.freeze({ ROLES, TZ, PUERPERIO }),
    api,
    errors,
    authz
  });

  function loadModule(src, marker) {
    if (window[marker] || document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.sirroModule = marker;
    script.onerror = () => console.error(`No se pudo cargar el módulo ${src}`);
    document.head.appendChild(script);
  }

  loadModule('./auth-security.js', 'SIRRO_AUTH_SECURITY');
  loadModule('./data-resilience.js', 'SIRRO_DATA_RESILIENCE');
  loadModule('./pending-color-semantics.js', 'SIRRO_PENDING_COLOR_SEMANTICS');
})();