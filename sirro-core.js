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
  const SPECIALTIES = Object.freeze(['Pediatría','Gineco-Obstetricia','Medicina Interna','Cirugía','Ortopedia']);

  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  const specialtyLabel = caseValue => {
    const motive = normalize(caseValue?.motivo);
    if (motive === 'CE_PEDIATRIA') return SPECIALTIES[0];
    if (motive === 'CE_GINECOOBSTETRICIA') return SPECIALTIES[1];
    if (motive === 'CE_MEDICINA_INTERNA') return SPECIALTIES[2];
    if (motive === 'CE_CIRUGIA') return SPECIALTIES[3];
    if (motive === 'CE_ORTOPEDIA') return SPECIALTIES[4];
    return caseValue?.servicio_requerido || 'Consulta Externa';
  };
  const utils = Object.freeze({ normalize, specialtyLabel });

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

  try {
    if (typeof roleLabels !== 'undefined') roleLabels.ADMINISTRADOR = 'Administrador';
    if (typeof isAdmin === 'function') isAdmin = function(){ return ['ADMIN_REGIONAL','ADMINISTRADOR'].includes(profile?.rol); };
    if (typeof isAudit === 'function') isAudit = function(){ return ['ADMIN_REGIONAL','ADMINISTRADOR','AUDITOR_CONSULTA'].includes(profile?.rol); };
  } catch {}

  window.SIRRO = Object.freeze({ version: 'core-17', constants: Object.freeze({ ROLES, TZ, PUERPERIO, SPECIALTIES }), utils, api, errors, authz });

  function loadStyle(href, marker) {
    if (document.querySelector(`link[data-sirro-style="${marker}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.sirroStyle = marker;
    document.head.appendChild(link);
  }

  loadStyle('./sirro-theme.css', 'SIRRO_THEME');

  function renderPublicUpdate() {
    try {
      const loginView = document.getElementById('loginView');
      if (!loginView || document.getElementById('sirroPublicUpdate')) return;

      const panel = document.createElement('details');
      panel.id = 'sirroPublicUpdate';
      panel.style.cssText = 'margin-top:14px;text-align:left;border:1px solid #d7e4e0;border-radius:10px;background:#f7fbfa;padding:10px 12px;';
      panel.innerHTML = `
        <summary style="cursor:pointer;font-weight:800;color:#0b6b57;">Capacidades actuales de SIRRO · agosto 2026</summary>
        <div style="margin-top:9px;font-size:13px;line-height:1.45;color:#47665f;">
          <div>• Seguimiento por código de referencia y cierre administrativo del ciclo.</div>
          <div>• Gestión hospitalaria por especialidad: Pediatría, Gineco-Obstetricia, Medicina Interna, Cirugía, Ortopedia y otras.</div>
          <div>• Programación de citas con fecha y hora, respuesta al establecimiento de origen y notificaciones.</div>
          <div>• Transferencias entre especialidades conservando el mismo hilo de referencia.</div>
          <div>• Flujo obstétrico con hospitalización, fecha y hora de parto y seguimiento puerperal.</div>
          <div>• Perfiles y permisos diferenciados para personal hospitalario, unidades de salud, ECOR, municipios y consulta.</div>
          <div>• Recuperación de contraseña, AYUDA por rol y preferencias personales de notificación por correo.</div>
          <div>• Seguridad reforzada y trazabilidad de las acciones administrativas.</div>
        </div>`;

      const loginMsg = document.getElementById('loginMsg');
      if (loginMsg) loginView.insertBefore(panel, loginMsg);
      else loginView.appendChild(panel);
    } catch (error) {
      console.warn('No se pudo mostrar la actualización pública de SIRRO.', error);
    }
  }

  renderPublicUpdate();

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
  loadModule('./login-stable.js', 'SIRRO_LOGIN_STABLE');
  loadModule('./data-resilience.js', 'SIRRO_DATA_RESILIENCE');
  loadModule('./pending-color-semantics.js', 'SIRRO_PENDING_COLOR_SEMANTICS');
  loadModule('./specialty-filter.js', 'SIRRO_SPECIALTY_FILTER');
  loadModule('./specialty-transfers.js', 'SIRRO_SPECIALTY_TRANSFERS');
  loadModule('./appointment-role.js', 'SIRRO_APPOINTMENT_ROLE');
  loadModule('./ce-referral-hint.js', 'SIRRO_CE_REFERRAL_HINT');
  loadModule('./hospital-profile.js', 'SIRRO_HOSPITAL_PROFILE');
  loadModule('./obstetric-hospitalization-guard.js', 'SIRRO_OBSTETRIC_HOSPITAL_GUARD');
  loadModule('./gerencia-profile.js', 'SIRRO_GERENCIA_PROFILE');
  loadModule('./administrador-profile.js', 'SIRRO_ADMINISTRADOR_PROFILE');
  loadModule('./response-detail-ui.js', 'SIRRO_RESPONSE_DETAIL_UI');
  loadModule('./maternal-monitor.js', '__sirroMaternalMonitorLoaded');
  loadModule('./maternal-monitor-style.js', 'SIRRO_MATERNAL_MONITOR_STYLE');
  loadModule('./regression-guard.js', 'SIRRO_REGRESSION_GUARD');
})();