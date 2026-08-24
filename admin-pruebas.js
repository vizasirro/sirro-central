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

  // Regla de asignación: un Usuario de Hospital solo puede pertenecer a
  // hospitales internos de Olancho; un Usuario de Establecimiento no puede
  // asignarse a un hospital ni a un establecimiento externo. Además, un
  // Jefe Municipal solo puede asignarse a un municipio perteneciente al ECOR
  // seleccionado. La validación se aplica tanto en la interfaz como al enviar.
  const isInternalHospital=f=>f?.tipo==='HOSPITAL'&&f?.es_externo_olancho!==true;
  const isInternalNonHospital=f=>f?.tipo!=='HOSPITAL'&&f?.es_externo_olancho!==true;
  const isInternalFacility=f=>f?.es_externo_olancho!==true;

  function municipiosForEcor(ecorId){
    if(!ecorId||typeof establishments==='undefined'||typeof municipios==='undefined')return [];
    const ids=new Set(
      establishments
        .filter(x=>isInternalFacility(x)&&x.ecor_id===ecorId&&x.municipio_id)
        .map(x=>x.municipio_id)
    );
    return municipios.filter(x=>ids.has(x.id));
  }

  function syncUserMunicipios(){
    const role=document.getElementById('newRole')?.value||'';
    const ecorId=document.getElementById('newEcor')?.value||'';
    const sel=document.getElementById('newMunicipio');
    if(!sel||typeof municipios==='undefined'||typeof establishments==='undefined')return;
    const previous=sel.value;

    if(role==='USUARIO_HOSPITAL'){
      const hospitalMunicipioIds=new Set(establishments.filter(isInternalHospital).map(x=>x.municipio_id).filter(Boolean));
      const options=municipios.filter(x=>hospitalMunicipioIds.has(x.id));
      sel.innerHTML='<option value="">Seleccione municipio del hospital</option>'+options.map(x=>`<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
      sel.value=options.some(x=>x.id===previous)?previous:'';
      return;
    }

    if(role==='JEFE_MUNICIPAL'){
      const options=municipiosForEcor(ecorId);
      const placeholder=ecorId
        ?(options.length?'Seleccione municipio del ECOR':'No hay municipios asignados a este ECOR')
        :'Seleccione primero un ECOR';
      sel.innerHTML=`<option value="">${placeholder}</option>`+options.map(x=>`<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
      sel.value=options.some(x=>x.id===previous)?previous:'';
      sel.disabled=!ecorId||!options.length;
      return;
    }

    sel.disabled=false;
    sel.innerHTML='<option value="">Seleccione municipio</option>'+municipios.map(x=>`<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
    if(municipios.some(x=>x.id===previous))sel.value=previous;
  }

  if(typeof fillUserEstablishments==='function'){
    fillUserEstablishments=function(){
      const role=document.getElementById('newRole')?.value||'';
      const municipioId=document.getElementById('newMunicipio')?.value||'';
      const sel=document.getElementById('newEst');
      if(!sel||typeof establishments==='undefined')return;

      let options=[];
      let placeholder='Seleccione primero un municipio';
      let disabled=true;

      if(role==='USUARIO_HOSPITAL'){
        options=municipioId?establishments.filter(x=>x.municipio_id===municipioId&&isInternalHospital(x)):[];
        placeholder=municipioId?(options.length?'Seleccione hospital':'No hay hospital autorizado en este municipio'):'Seleccione primero un municipio';
        disabled=!municipioId||!options.length;
      }else if(role==='USUARIO_US'){
        options=municipioId?establishments.filter(x=>x.municipio_id===municipioId&&isInternalNonHospital(x)):[];
        placeholder=municipioId?'Seleccione establecimiento':'Seleccione primero un municipio';
        disabled=!municipioId;
      }else{
        const guestEstablishment=role==='AUDITOR_CONSULTA'&&document.getElementById('newScope')?.value==='ESTABLECIMIENTO';
        if(guestEstablishment){
          options=municipioId?establishments.filter(x=>x.municipio_id===municipioId&&x.es_externo_olancho!==true):[];
          placeholder=municipioId?'Seleccione establecimiento':'Seleccione primero un municipio';
          disabled=!municipioId;
        }
      }

      sel.innerHTML=`<option value="">${placeholder}</option>`+options.map(x=>`<option value="${x.id}">${esc(x.nombre)} · RUPS ${esc(x.codigo_rups)}</option>`).join('');
      sel.disabled=disabled;
      if(role==='USUARIO_HOSPITAL'&&options.length===1)sel.value=options[0].id;
    };
  }

  const roleSelect=document.getElementById('newRole');
  const ecorSelect=document.getElementById('newEcor');
  const municipioSelect=document.getElementById('newMunicipio');
  const scopeSelect=document.getElementById('newScope');
  if(roleSelect)roleSelect.addEventListener('change',()=>{
    const sel=document.getElementById('newEst'); if(sel)sel.value='';
    syncUserMunicipios();
    if(typeof fillUserEstablishments==='function')fillUserEstablishments();
  });
  if(ecorSelect)ecorSelect.addEventListener('change',()=>{
    const sel=document.getElementById('newEst'); if(sel)sel.value='';
    syncUserMunicipios();
    if(typeof fillUserEstablishments==='function')fillUserEstablishments();
  });
  if(municipioSelect)municipioSelect.addEventListener('change',()=>{
    if(typeof fillUserEstablishments==='function')fillUserEstablishments();
  });
  if(scopeSelect)scopeSelect.addEventListener('change',()=>{
    if(typeof fillUserEstablishments==='function')fillUserEstablishments();
  });

  const userForm=document.getElementById('userForm');
  if(userForm)userForm.addEventListener('submit',e=>{
    const role=document.getElementById('newRole')?.value;
    const ecorId=document.getElementById('newEcor')?.value||'';
    const municipioId=document.getElementById('newMunicipio')?.value||'';
    const facilityId=document.getElementById('newEst')?.value;

    if(role==='JEFE_MUNICIPAL'){
      const validMunicipio=municipiosForEcor(ecorId).some(x=>x.id===municipioId);
      if(validMunicipio)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      showMsg('#userMsg','Seleccione primero el ECOR y luego un municipio que pertenezca a ese ECOR.','error');
      return;
    }

    if(!['USUARIO_HOSPITAL','USUARIO_US'].includes(role))return;
    const facility=typeof establishments!=='undefined'?establishments.find(x=>x.id===facilityId):null;
    const valid=role==='USUARIO_HOSPITAL'
      ?isInternalHospital(facility)&&!!municipioId&&facility?.municipio_id===municipioId
      :isInternalNonHospital(facility);
    if(valid)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showMsg('#userMsg',role==='USUARIO_HOSPITAL'?'Seleccione Juticalpa o Catacamas y el hospital autorizado correspondiente.':'Seleccione una unidad de salud válida; este rol no puede asignarse a un hospital.','error');
  },true);

  syncUserMunicipios();
  updateTestModeCopy();
  if(isAdmin()&&typeof renderUsers==='function')renderUsers();
})();