(() => {
  if (window.SIRRO_OBSTETRIC_HOSPITAL_GUARD) return;

  const maternalCase = t => {
    try {
      const c = typeof caseOf === 'function' ? caseOf(t?.caso_id) : null;
      return c?.motivo === 'ATENCION_MATERNA';
    } catch { return false; }
  };

  const isHospitalized = t => !!t && t.estado_actual === 'HOSPITALIZADO';

  function tramoById(id){
    try { return Array.isArray(tramos) ? tramos.find(x => String(x.id) === String(id)) : null; }
    catch { return null; }
  }

  function hidePrematureDeliveryControls(){
    document.querySelectorAll('button[onclick^="registerDelivery("]').forEach(btn => {
      const m = String(btn.getAttribute('onclick') || '').match(/registerDelivery\('([^']+)'\)/);
      if (!m) return;
      const t = tramoById(m[1]);
      if (!t || !maternalCase(t) || isHospitalized(t)) return;
      const notice = btn.closest('.notice');
      if (notice) notice.remove();
      else btn.remove();
    });
  }

  function installRegisterGuard(){
    const current = window.registerDelivery;
    if (typeof current !== 'function' || current.__sirroHospitalizationGuard) return false;
    const guarded = async function(id){
      const t = tramoById(id);
      if (!t) return alert('No se encontró la referencia. Actualice la pantalla e intente nuevamente.');
      if (maternalCase(t) && !isHospitalized(t)) {
        return alert('Primero debe seleccionar “Recibir hospitalizado”. El registro de fecha y hora del parto se habilita únicamente cuando la paciente ya consta hospitalizada.');
      }
      return current.apply(this, arguments);
    };
    guarded.__sirroHospitalizationGuard = true;
    window.registerDelivery = guarded;
    try { registerDelivery = guarded; } catch {}
    return true;
  }

  const observer = new MutationObserver(() => {
    installRegisterGuard();
    hidePrematureDeliveryControls();
  });
  observer.observe(document.documentElement, {subtree:true, childList:true});

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    installRegisterGuard();
    hidePrematureDeliveryControls();
    if (attempts >= 20) clearInterval(timer);
  }, 300);

  window.addEventListener('load', () => {
    installRegisterGuard();
    hidePrematureDeliveryControls();
  }, {once:true});

  window.SIRRO_OBSTETRIC_HOSPITAL_GUARD = Object.freeze({
    version: '1',
    isHospitalized,
    hidePrematureDeliveryControls
  });
})();
