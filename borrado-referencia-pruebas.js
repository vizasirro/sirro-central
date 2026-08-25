(() => {
  if (window.__sirroDeleteReferenceTestLoaded) return;
  window.__sirroDeleteReferenceTestLoaded = true;

  const isAdminRegional = () => typeof profile !== 'undefined' && profile?.rol === 'ADMIN_REGIONAL' && profile?.estado === 'ACTIVO';
  const originalTramoItem = typeof tramoItem === 'function' ? tramoItem : null;
  const originalRenderTracking = typeof renderTracking === 'function' ? renderTracking : null;

  if (originalTramoItem) {
    tramoItem = function(t, withActions = true) {
      const html = originalTramoItem(t, withActions);
      if (!window.__sirroRenderingTracking || !isAdminRegional() || !t?.caso_id) return html;
      const c = typeof caseOf === 'function' ? caseOf(t.caso_id) : null;
      if (!c) return html;
      const action = `<div class="actions"><button type="button" class="danger" onclick="sirroDeleteReferenceTest('${c.id}')">Borrar referencia de prueba</button></div>`;
      const i = html.lastIndexOf('</div>');
      return i >= 0 ? html.slice(0, i) + action + html.slice(i) : html + action;
    };
  }

  if (originalRenderTracking) {
    renderTracking = function() {
      window.__sirroRenderingTracking = true;
      try {
        return originalRenderTracking();
      } finally {
        window.__sirroRenderingTracking = false;
      }
    };
  }

  window.sirroDeleteReferenceTest = async function(casoId) {
    if (!isAdminRegional()) return alert('Solo el Administrador Regional puede borrar completamente una referencia de prueba.');
    const c = typeof cases !== 'undefined' ? cases.find(x => x.id === casoId) : null;
    if (!c) return alert('Referencia no encontrada. Actualice Seguimiento e inténtelo nuevamente.');

    const codigo = c.codigo_visible || casoId;
    const first = confirm(`MODO DE PRUEBAS\n\nSe borrará por completo la referencia ${codigo}, incluyendo tramos, movimientos, notificaciones, seguimientos postreferencia y todo rastro relacionado en Auditoría.\n\nEsta acción no se puede deshacer. ¿Desea continuar?`);
    if (!first) return;

    const phrase = prompt(`Para confirmar el borrado integral de ${codigo}, escriba exactamente:\n\nBORRAR REFERENCIA`);
    if (phrase !== 'BORRAR REFERENCIA') return alert('Borrado cancelado.');

    const { data, error } = await sb.rpc('sirro_borrar_referencia_prueba', {
      p_caso: casoId,
      p_confirmacion: 'BORRAR REFERENCIA'
    });
    if (error) return alert(error.message || 'No se pudo borrar la referencia.');

    if (typeof refreshAll === 'function') await refreshAll();
    const r = data || {};
    alert(`Referencia ${codigo} eliminada completamente.\n\nTramos: ${r.tramos_eliminados ?? 0}\nMovimientos: ${r.movimientos_eliminados ?? 0}\nSeguimientos: ${r.seguimientos_eliminados ?? 0}\nNotificaciones: ${r.notificaciones_eliminadas ?? 0}\nRegistros de auditoría eliminados: ${r.auditoria_eliminada ?? 0}`);
  };
})();
