(() => {
  const core=()=>window.SIRRO||null;
  const currentProfile=()=>typeof profile!=='undefined'?profile:null;
  const currentUsers=()=>typeof users!=='undefined'?users:[];
  const isAdmin=()=>core()?.authz?.isAdminRegional(currentProfile())??currentProfile()?.rol==='ADMIN_REGIONAL';
  const rpc=(name,params)=>core()?.api?.rpc(name,params)??sb.rpc(name,params);
  const invoke=(name,body)=>core()?.api?.invoke(name,body)??sb.functions.invoke(name,{body});
  const errorMessage=(error,fallback)=>core()?.errors?.message(error,fallback)??error?.message??fallback;

  function updateTestModeCopy(){
    const resetBtn=document.getElementById('resetAllBtn');
    const card=resetBtn?.closest('.user-form-extra');
    if(card){
      const p=card.querySelector('p.muted');
      if(p)p.textContent='Modo de pruebas: elimina todas las referencias y todos los usuarios de prueba. Se conservan únicamente los Administradores Regionales, establecimientos, municipios, ECOR, rutas, configuración y auditoría.';
      resetBtn.textContent='Borrar referencias y usuarios de prueba';
    }
  }

  async function deleteTestUser(id){
    if(!isAdmin())return alert('Solo el Administrador Regional puede borrar usuarios.');
    const u=currentUsers().find(x=>x.id===id);
    if(!u)return alert('Usuario no encontrado.');
    if(u.rol==='ADMIN_REGIONAL')return alert('Los Administradores Regionales están protegidos y no pueden borrarse.');
    if(!confirm(`¿Borrar definitivamente al usuario de prueba ${u.nombre_completo}?\n\nEsta acción elimina su acceso, pero conserva la trazabilidad histórica de las operaciones realizadas.`))return;
    const phrase=prompt('Para confirmar, escriba exactamente: BORRAR USUARIO');
    if(phrase!=='BORRAR USUARIO')return alert('Borrado cancelado.');
    const {data,error}=await invoke('sirro-delete-user',{user_id:id,confirmacion:'BORRAR USUARIO'});
    if(error)return alert(errorMessage(error,'No se pudo borrar el usuario.'));
    if(data?.error)return alert(data.error);
    if(typeof loadUsers==='function')await loadUsers();
    if(typeof renderUsers==='function')renderUsers();
    alert('Usuario de prueba eliminado correctamente.');
  }
  window.deleteTestUser=deleteTestUser;

  const baseRenderUsers=typeof renderUsers==='function'?renderUsers:null;
  if(baseRenderUsers){
    renderUsers=function(){
      baseRenderUsers();
      if(!isAdmin())return;
      const list=document.getElementById('usersList');
      if(!list)return;
      const rows=[...list.children];
      currentUsers().forEach((u,i)=>{
        if(u.rol==='ADMIN_REGIONAL')return;
        const row=rows[i]; if(!row)return;
        const actions=row.querySelector('.actions'); if(!actions||actions.querySelector(`[data-delete-user="${u.id}"]`))return;
        const b=document.createElement('button');
        b.type='button'; b.className='danger'; b.dataset.deleteUser=u.id; b.textContent='Borrar usuario';
        b.onclick=()=>deleteTestUser(u.id);
        actions.appendChild(b);
      });
      updateTestModeCopy();
    };
  }

  if(typeof resetAllTestData==='function'){
    resetAllTestData=async function(){
      if(!isAdmin())return;
      const first=confirm('MODO DE PRUEBAS\n\nEsta acción borrará TODAS las referencias y TODOS los usuarios de prueba. Se conservarán únicamente los Administradores Regionales y la configuración estructural de SIRRO. ¿Desea continuar?');
      if(!first)return;
      const phrase=prompt('Para confirmar, escriba exactamente: BORRAR PRUEBAS SIRRO');
      if(phrase!=='BORRAR PRUEBAS SIRRO')return alert('Confirmación cancelada.');
      const key=prompt('Escriba la clave especial de reinicio:');
      if(!key)return;
      showMsg('#resetMsg','Eliminando referencias y usuarios de prueba…');
      const {data,error}=await rpc('sirro_reiniciar_datos_prueba',{p_clave:key});
      if(error)return showMsg('#resetMsg',errorMessage(error,'No se pudo reiniciar los datos de prueba.'),'error');
      const r=Array.isArray(data)?data[0]:data;
      showMsg('#resetMsg',`Reinicio completado. Casos: ${r?.casos_eliminados??0}, tramos: ${r?.tramos_eliminados??0}, movimientos: ${r?.movimientos_eliminados??0}. Los Administradores Regionales fueron conservados.`,'ok');
      if(typeof refreshAll==='function')await refreshAll();
    };
    const btn=document.getElementById('resetAllBtn');
    if(btn)btn.onclick=resetAllTestData;
  }

  updateTestModeCopy();
  if(isAdmin()&&typeof renderUsers==='function')renderUsers();
})();