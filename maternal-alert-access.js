(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const loginView = () => byId('loginView');
  const accessView = () => byId('maternalAlertAccessView');
  const codeInput = () => byId('maternalAlertCode');
  const message = () => byId('maternalAlertAccessMsg');

  function showMessage(text, type = '') {
    const target = message();
    if (!target) return;
    target.textContent = text;
    target.className = text ? `notice ${type}`.trim() : '';
  }

  function openAccess() {
    loginView()?.classList.add('hidden');
    accessView()?.classList.remove('hidden');
    showMessage('');
    if (codeInput()) codeInput().value = '';
    window.setTimeout(() => codeInput()?.focus(), 0);
  }

  function backToLogin() {
    accessView()?.classList.add('hidden');
    loginView()?.classList.remove('hidden');
    showMessage('');
    try { window.SIRRO_AUTH_SECURITY?.mount?.('login'); } catch {}
    window.setTimeout(() => byId('loginUser')?.focus(), 0);
  }

  function continueAccess() {
    const code = String(codeInput()?.value || '').replace(/\D/g, '').slice(0, 4);
    if (codeInput()) codeInput().value = code;
    if (code.length !== 4) {
      showMessage('Ingrese los cuatro dígitos de autorización.', 'error');
      codeInput()?.focus();
      return;
    }

    // Regla de Oro: no validar una autorización sensible en el navegador.
    // La siguiente etapa conectará este formulario con la validación segura del servidor.
    showMessage('El acceso seguro de Alerta Materna se habilitará en la siguiente etapa.', 'notice');
  }

  function install() {
    byId('openMaternalAlertBtn')?.addEventListener('click', openAccess);
    byId('backFromMaternalAlertBtn')?.addEventListener('click', backToLogin);
    byId('maternalAlertContinueBtn')?.addEventListener('click', continueAccess);
    codeInput()?.addEventListener('input', event => {
      event.target.value = String(event.target.value || '').replace(/\D/g, '').slice(0, 4);
      showMessage('');
    });
    codeInput()?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        continueAccess();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        backToLogin();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
