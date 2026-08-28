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

/* Auxiliares de Enfermería: diferenciación por ámbito y designación de Responsable de US.
   - USUARIO_US + Auxiliar de Enfermería: puede ser designada Responsable de US.
   - USUARIO_HOSPITAL + Auxiliar de Enfermería: conserva únicamente su ámbito hospitalario.
   - La designación la gestiona el Jefe Municipal de su municipio; Administrador Regional puede supervisar/revocar. */
(() => {
  if (window.__sirroAuxResponsableUsLoaded) return;
  window.__sirroAuxResponsableUsLoaded = true;

  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  const isAux = u => {
    const cargo = norm(u?.cargo_funcion);
    return cargo === 'AE' || cargo === 'A.E.' || cargo === 'AUX ENFERMERIA' || cargo === 'AUX. ENFERMERIA' || (cargo.includes('AUXILIAR') && cargo.includes('ENFERMER'));
  };
  const canManage = () => typeof profile !== 'undefined' && ['JEFE_MUNICIPAL','ADMIN_REGIONAL'].includes(profile?.rol) && profile?.estado === 'ACTIVO';
  const isJefeMunicipal = () => typeof profile !== 'undefined' && profile?.rol === 'JEFE_MUNICIPAL';
  const facilityName = id => typeof fac === 'function' ? (fac(id)?.nombre || 'Unidad de Salud') : 'Unidad de Salud';

  const previousConfigureTabs = typeof configureTabs === 'function' ? configureTabs : null;
  if (previousConfigureTabs) {
    configureTabs = function() {
      previousConfigureTabs();
      const userTab = document.querySelector('button[data-tab="usuarios"]');
      if (userTab && isJefeMunicipal()) userTab.classList.remove('hidden');
      applyAuxUserView();
    };
  }

  const previousLoadUsers = typeof loadUsers === 'function' ? loadUsers : null;
  if (previousLoadUsers) {
    loadUsers = async function() {
      if (!isJefeMunicipal()) return previousLoadUsers();
      if (!profile?.municipio_id) { users = []; return; }
      const { data, error } = await sb.from('perfiles')
        .select('*')
        .eq('municipio_id', profile.municipio_id)
        .order('nombre_completo');
      users = error ? [] : (data || []);
    };
  }

  function applyAuxUserView() {
    if (!isJefeMunicipal()) return;
    const userForm = document.getElementById('userForm');
    if (userForm) userForm.classList.add('hidden');
    const resetBox = document.querySelector('#tab-usuarios .user-form-extra');
    if (resetBox) resetBox.classList.add('hidden');
    const title = document.querySelector('#tab-usuarios h2');
    if (title) title.textContent = 'Auxiliares de Enfermería · Responsable de US';
  }

  function auxScopeUsers() {
    const list = Array.isArray(users) ? users : [];
    return list.filter(u => u?.rol === 'USUARIO_US' && isAux(u) && (!isJefeMunicipal() || u.municipio_id === profile?.municipio_id));
  }

  function renderAuxPanel() {
    if (!canManage()) return;
    const host = document.getElementById('usersList');
    if (!host) return;
    applyAuxUserView();

    let panel = document.getElementById('auxResponsableUsPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'auxResponsableUsPanel';
      panel.className = 'user-form-extra';
      host.parentElement?.insertBefore(panel, host);
    }

    const aux = auxScopeUsers();
    const explanation = isJefeMunicipal()
      ? 'Puede designar o retirar a la Auxiliar responsable de una Unidad de Salud de su municipio. Esta condición amplía únicamente funciones operativas de SIRRO; no modifica competencias clínicas profesionales.'
      : 'Supervisión regional de Auxiliares responsables de US. La Auxiliar hospitalaria permanece separada y no puede recibir esta designación.';

    panel.innerHTML = `<h3>Responsabilidad de Unidad de Salud</h3><p class="muted">${esc(explanation)}</p>` +
      (aux.length ? aux.map(u => {
        const assigned = !!u.responsable_us;
        return `<div class="item"><div class="row"><div><strong>${esc(u.nombre_completo)}</strong><br><small>Auxiliar de Enfermería – US · ${esc(facilityName(u.establecimiento_id))}</small><br><small>${assigned ? 'Designada como Responsable de US' : 'Sin designación de Responsable de US'}</small></div><span class="badge">${assigned ? 'RESPONSABLE US' : 'AUXILIAR US'}</span></div><div class="actions"><button type="button" class="${assigned ? 'ghost' : ''}" onclick="sirroSetAuxResponsableUs('${u.id}',${assigned ? 'false' : 'true'})">${assigned ? 'Retirar responsabilidad' : 'Designar Responsable de US'}</button></div></div>`;
      }).join('') : '<p class="muted">No se encontraron Auxiliares de Enfermería de US dentro de este alcance.</p>');

    if (isJefeMunicipal()) host.innerHTML = '';
  }

  const previousRenderUsers = typeof renderUsers === 'function' ? renderUsers : null;
  if (previousRenderUsers) {
    renderUsers = function() {
      if (!isJefeMunicipal()) previousRenderUsers();
      renderAuxPanel();
    };
  }

  window.sirroSetAuxResponsableUs = async function(userId, responsible) {
    if (!canManage()) return alert('No tiene permiso para gestionar esta designación.');
    const u = (Array.isArray(users) ? users : []).find(x => String(x.id) === String(userId));
    if (!u || u.rol !== 'USUARIO_US' || !isAux(u)) return alert('La designación solo aplica a Auxiliares de Enfermería de Unidad de Salud.');
    if (isJefeMunicipal() && u.municipio_id !== profile?.municipio_id) return alert('Solo puede gestionar auxiliares de su municipio.');

    const action = responsible ? 'designar como Responsable de US' : 'retirar la responsabilidad de US';
    const motivo = prompt(`Motivo para ${action} a ${u.nombre_completo}:`, responsible ? 'Unidad de Salud atendida por personal auxiliar de enfermería' : 'Cambio de responsable de la Unidad de Salud');
    if (motivo === null) return;
    if (!motivo.trim()) return alert('Debe registrar un motivo.');
    if (!confirm(`¿Confirma ${action} a ${u.nombre_completo} en ${facilityName(u.establecimiento_id)}?`)) return;

    const { error } = await sb.rpc('sirro_gestionar_responsable_us', {
      p_usuario: userId,
      p_responsable: !!responsible,
      p_motivo: motivo.trim()
    });
    if (error) return alert(error.message || 'No se pudo guardar la designación.');

    if (typeof loadUsers === 'function') await loadUsers();
    if (typeof renderUsers === 'function') renderUsers();
    alert(responsible ? 'Auxiliar designada como Responsable de US.' : 'Responsabilidad de US retirada correctamente.');
  };

  const css = document.createElement('style');
  css.textContent = '#auxResponsableUsPanel .badge{white-space:nowrap}#auxResponsableUsPanel .item{background:#fbfdfc}';
  document.head.appendChild(css);

  setTimeout(() => { applyAuxUserView(); if (canManage() && typeof renderUsers === 'function') renderUsers(); }, 0);
})();
