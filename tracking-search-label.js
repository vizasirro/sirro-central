(() => {
  if (window.SIRRO_TRACKING_SEARCH_LABEL) return;
  window.SIRRO_TRACKING_SEARCH_LABEL = true;

  const apply = () => {
    const input = document.getElementById('searchRef');
    if (input) input.placeholder = 'Buscar por DNI, nombre o código SIRRO';
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();

  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();