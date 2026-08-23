(() => {
  if (window.SIRRO_DATA_RESILIENCE) return;

  const failures = new Map();
  const labels = {
    casos_referencia: 'casos',
    tramos_referencia: 'tramos',
    movimientos_referencia: 'movimientos',
    notificaciones: 'notificaciones'
  };

  function renderStatus() {
    const inicio = document.getElementById('tab-inicio');
    if (!inicio) return;
    let box = document.getElementById('sirroDataLoadStatus');
    if (!failures.size) {
      box?.remove();
      return;
    }
    if (!box) {
      box = document.createElement('div');
      box.id = 'sirroDataLoadStatus';
      box.className = 'notice error';
      inicio.prepend(box);
    }
    const names = [...failures.keys()].map(k => labels[k] || k).join(', ');
    box.innerHTML = `<strong>No fue posible actualizar completamente SIRRO.</strong><br>Se conservaron los últimos datos válidos disponibles. Revise la conexión e intente actualizar nuevamente. Áreas afectadas: ${esc(names)}.`;
  }

  async function safeLoad(table, current, order = 'creado_en') {
    try {
      const next = await fetchAll(table, order);
      failures.delete(table);
      renderStatus();
      return next;
    } catch (error) {
      failures.set(table, error?.message || 'Error de conexión');
      renderStatus();
      return current;
    }
  }

  if (typeof loadCases === 'function') {
    loadCases = async function() { cases = await safeLoad('casos_referencia', cases); };
  }
  if (typeof loadTramos === 'function') {
    loadTramos = async function() { tramos = await safeLoad('tramos_referencia', tramos); };
  }
  if (typeof loadMovements === 'function') {
    loadMovements = async function() { movements = await safeLoad('movimientos_referencia', movements); };
  }
  if (typeof loadNotifications === 'function') {
    loadNotifications = async function() { notifications = await safeLoad('notificaciones', notifications, 'creada_en'); };
  }

  window.SIRRO_DATA_RESILIENCE = Object.freeze({ version: 'data-resilience-1', failures });
})();