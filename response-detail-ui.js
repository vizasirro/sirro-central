(() => {
  if (window.SIRRO_RESPONSE_DETAIL_UI) return;

  const safeEsc = v => typeof esc === 'function' ? esc(v) : String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function latestResponseMovement(tramoId){
    if (typeof movements === 'undefined' || !Array.isArray(movements)) return null;
    return movements
      .filter(m => String(m.tramo_id) === String(tramoId) && m.tipo === 'RESPUESTA_ENVIADA' && String(m.detalle || '').trim())
      .sort((a,b) => new Date(b.creado_en || 0) - new Date(a.creado_en || 0))[0] || null;
  }

  function responseHtml(t){
    const m = latestResponseMovement(t?.id);
    if (!m) return '';
    const p = typeof profile !== 'undefined' ? profile : null;
    if (!p) return '';
    const involved = p.rol === 'ADMIN_REGIONAL' || p.rol === 'ADMINISTRADOR' ||
      p.establecimiento_id === t.establecimiento_origen_id ||
      p.establecimiento_id === t.establecimiento_destino_id;
    if (!involved) return '';
    return `<div class="notice ok sirro-response-detail" style="margin-top:10px"><strong>Respuesta / contrarreferencia recibida</strong><br><span>${safeEsc(m.detalle)}</span>${m.creado_en ? `<br><small>Enviada: ${typeof fmt === 'function' ? safeEsc(fmt(m.creado_en)) : safeEsc(m.creado_en)}</small>` : ''}</div>`;
  }

  function install(){
    if (typeof tramoItem !== 'function' || tramoItem.__sirroResponseDetailWrapped) return false;
    const base = tramoItem;
    const wrapped = function(t, withActions = true){
      const html = base.apply(this, arguments);
      const extra = responseHtml(t);
      if (!extra) return html;
      const i = html.lastIndexOf('</div>');
      return i >= 0 ? html.slice(0, i) + extra + html.slice(i) : html + extra;
    };
    wrapped.__sirroResponseDetailWrapped = true;
    tramoItem = wrapped;
    return true;
  }

  install();
  setTimeout(install, 300);
  setTimeout(install, 1200);

  const baseRefresh = typeof refreshAll === 'function' ? refreshAll : null;
  if (baseRefresh && !baseRefresh.__sirroResponseRefreshWrapped) {
    const wrappedRefresh = async function(){
      const r = await baseRefresh.apply(this, arguments);
      install();
      try { if (typeof renderTracking === 'function') renderTracking(); } catch {}
      return r;
    };
    wrappedRefresh.__sirroResponseRefreshWrapped = true;
    refreshAll = wrappedRefresh;
  }

  window.SIRRO_RESPONSE_DETAIL_UI = Object.freeze({version:'response-detail-ui-1', latestResponseMovement});
})();
