(() => {
  'use strict';

  // Compatibilidad de arranque: este archivo se conserva porque index.html lo carga
  // explícitamente. La lógica vigente de especialidades hospitalarias está dividida
  // entre specialty-filter.js, specialty-transfers.js y specialty-selector-fix.js.
  // No se redefine ninguna función ni permiso desde este adaptador.
  if (window.SIRRO_HOSPITAL_REFERRAL_SPECIALTIES) return;
  window.SIRRO_HOSPITAL_REFERRAL_SPECIALTIES = Object.freeze({
    version: 'compat-1',
    active: true
  });
})();
