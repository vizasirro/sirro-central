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

  const originalAlert=window.alert.bind(window);
  const isNetworkError=value=>/load failed|failed to fetch|networkerror|network request failed|fetch failed|typeerror.*fetch|typeerror.*load/i.test(String(value||''));
  let networkNoticeShown=false;

  function showNetworkNotice(){
    if(networkNoticeShown)return;
    networkNoticeShown=true;
    originalAlert('No fue posible completar la comunicación con SIRRO. Verifique la conexión y pulse Actualizar. No repita una acción clínica hasta confirmar en pantalla si el estado cambió.');
    setTimeout(()=>{networkNoticeShown=false;},800);
  }

  function wrapNetworkAction(name){
    const original=window[name];
    if(typeof original!=='function'||original.__sirroNetworkGuard)return;
    const wrapped=async function(...args){
      let intercepted=false;
      const savedAlert=window.alert;
      window.alert=function(message){
        if(isNetworkError(message)){intercepted=true;return;}
        return savedAlert(message);
      };
      try{
        return await original.apply(this,args);
      }catch(error){
        if(isNetworkError(error?.message||error)){intercepted=true;return;}
        throw error;
      }finally{
        window.alert=savedAlert;
        if(intercepted)showNetworkNotice();
      }
    };
    wrapped.__sirroNetworkGuard=true;
    window[name]=wrapped;
  }

  ['receiveTramo','evaluateTramo','rejectTramo','answerTramo','secondaryTramo','reorientTramo','markNotificationRead','closeTramo','registerDelivery','completePuerperal','assignCeAppointment','saveCeDateTime'].forEach(wrapNetworkAction);

  window.addEventListener('unhandledrejection',event=>{
    const reason=event?.reason;
    if(isNetworkError(reason?.message||reason)){
      event.preventDefault();
      showNetworkNotice();
    }
  });

  window.SIRRO_DATA_RESILIENCE = Object.freeze({ version: 'data-resilience-2', failures, isNetworkError });
})();