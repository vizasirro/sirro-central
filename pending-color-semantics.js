(() => {
  if (window.SIRRO_PENDING_COLOR_SEMANTICS) return;

  const palette = {
    pending: { bg: '#fff1f2', border: '#dc2626', text: '#991b1b', label: 'PENDIENTE' },
    attention: { bg: '#fffbeb', border: '#d97706', text: '#92400e', label: 'REQUIERE MI ATENCIÓN' }
  };

  function classify(text) {
    const value = String(text || '').toUpperCase();
    if (value.includes('REQUIERE MI ATENCIÓN') || value.includes('REQUIERE ATENCIÓN')) return 'attention';
    if (value.includes('PENDIENTE') || value.includes('VENCIDO') || value.includes('RECHAZADA POR CORREGIR')) return 'pending';
    return null;
  }

  function applyToItem(item) {
    const kind = classify(item.textContent);
    if (!kind) return;
    const c = palette[kind];
    item.style.background = c.bg;
    item.style.border = `2px solid ${c.border}`;
    item.style.color = c.text;
    const badge = item.querySelector('.badge');
    if (badge) {
      badge.textContent = c.label;
      badge.style.borderColor = c.border;
      badge.style.color = c.text;
    }
  }

  function apply() {
    document.querySelectorAll('#sirroPendingList > div').forEach(applyToItem);
  }

  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  apply();

  window.SIRRO_PENDING_COLOR_SEMANTICS = Object.freeze({ version: 'pending-colors-1', apply });
})();