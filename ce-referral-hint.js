(() => {
  if (window.SIRRO_CE_REFERRAL_HINT) return;
  window.SIRRO_CE_REFERRAL_HINT = true;

  const isCe = () => String(document.getElementById('refReason')?.value || '').startsWith('CE_');

  function ensureHint() {
    const reason = document.getElementById('refReason');
    const form = document.getElementById('refForm');
    if (!reason || !form) return;

    let hint = document.getElementById('ceReferralSchedulingHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'ceReferralSchedulingHint';
      hint.className = 'notice full hidden';
      hint.setAttribute('role', 'status');
      hint.innerHTML = '<strong>Consulta Externa</strong><br>Esta referencia requerirá programación de cita por el hospital receptor. La Unidad de Salud solicita la atención; el hospital asignará la fecha y la hora de la cita con la especialidad seleccionada.';
      const service = document.getElementById('requestedService')?.closest('label');
      if (service) service.insertAdjacentElement('afterend', hint);
      else reason.closest('label')?.insertAdjacentElement('afterend', hint);
    }

    const update = () => hint.classList.toggle('hidden', !isCe());
    if (!reason.dataset.ceHintBound) {
      reason.addEventListener('change', update);
      reason.dataset.ceHintBound = '1';
    }
    update();
  }

  document.addEventListener('DOMContentLoaded', ensureHint);
  const observer = new MutationObserver(ensureHint);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  ensureHint();
})();
