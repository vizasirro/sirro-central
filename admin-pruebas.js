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

// Extensión aditiva: gestión integral de usuarios por Administrador Regional.
(() => {
  const isAdmin=()=>typeof profile!=='undefined'&&profile?.rol==='ADMIN_REGIONAL';
  const hospitalTypes={MEDICO_ESPECIALISTA:'Médico especialista',MEDICO_GENERAL:'Médico general',LICENCIADA_ENFERMERIA:'Licenciada(o) en Enfermería',AUXILIAR_ENFERMERIA:'Auxiliar de Enfermería',ATENCION_PACIENTE_CITAS:'Atención al Paciente / Citas'};
  const roles=['ADMIN_REGIONAL','ECOR','JEFE_MUNICIPAL','USUARIO_US','USUARIO_HOSPITAL','AUDITOR_CONSULTA'];
  const roleText=r=>typeof roleLabel==='function'?roleLabel(r):r;
  const choose=(title,items,current,label=x=>x.nombre||x)=>{const idx=Math.max(0,items.findIndex(x=>(x.id??x)===current));const raw=prompt(title+'\n'+items.map((x,i)=>`${i+1}. ${label(x)}`).join('\n'),String(idx+1));if(raw===null)return {cancel:true};const item=items[Number(raw)-1];return item?{value:item}:{error:true};};

  function addHospitalFields(){
    const form=document.getElementById('userForm'),role=document.getElementById('newRole');
    if(!form||!role||document.getElementById('newHospitalType'))return;
    const a=document.createElement('label');a.id='newHospitalTypeWrap';a.className='hidden';a.innerHTML='<span>Tipo de usuario hospitalario</span><select id="newHospitalType"><option value="">Seleccione</option>'+Object.entries(hospitalTypes).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')+'</select>';
    const b=document.createElement('label');b.id='newSpecialtyWrap';b.className='hidden';b.innerHTML='<span>Especialidad médica</span><input id="newSpecialty" placeholder="Ej. Gineco-Obstetricia">';
    role.closest('label').insertAdjacentElement('afterend',a);a.insertAdjacentElement('afterend',b);
    const sync=()=>{const h=role.value==='USUARIO_HOSPITAL',t=document.getElementById('newHospitalType'),s=document.getElementById('newSpecialty');a.classList.toggle('hidden',!h);t.required=h;const sp=h&&t.value==='MEDICO_ESPECIALISTA';b.classList.toggle('hidden',!sp);s.required=sp;if(!sp)s.value='';};
    role.addEventListener('change',sync);document.getElementById('newHospitalType').addEventListener('change',sync);sync();
  }

  async function saveNewHospitalMetadata(result,body){
    if(body?.profile?.rol!=='USUARIO_HOSPITAL'||!result?.data?.user?.id)return result;
    const type=document.getElementById('newHospitalType')?.value||'',specialty=document.getElementById('newSpecialty')?.value.trim()||null,p=body.profile;
    if(!type)return result;
    const {error}=await sb.rpc('sirro_admin_update_user_profile_v2',{p_usuario:result.data.user.id,p_nombre:p.nombre_completo,p_identidad:p.identidad,p_correo:p.correo,p_telefono:p.telefono,p_cargo:p.cargo_funcion,p_rol:p.rol,p_ecor:p.ecor_id||null,p_municipio:p.municipio_id||null,p_establecimiento:p.establecimiento_id||null,p_tipo_usuario_hospital:type,p_especialidad:specialty,p_notificaciones_activas:p.notificaciones_activas!==false,p_reportes_habilitados:false,p_alcance_consulta:'DEPARTAMENTO',p_permiso_centro_monitoria:false,p_motivo:'Configuración inicial del usuario hospitalario'});
    if(error)return {data:{error:'Usuario creado, pero no se pudo guardar el tipo hospitalario: '+error.message},error:null};
    return result;
  }

  if(typeof sb!=='undefined'&&sb?.functions?.invoke&&!sb.functions.__sirroAdminWrapped){
    const original=sb.functions.invoke.bind(sb.functions);
    sb.functions.invoke=async(name,options)=>{const result=await original(name,options);return name==='sirro-create-user'?saveNewHospitalMetadata(result,options?.body):result;};
    sb.functions.__sirroAdminWrapped=true;
  }

  async function editUser(id){
    if(!isAdmin())return alert('Solo el Administrador Regional puede editar usuarios.');
    const u=users.find(x=>x.id===id);if(!u)return alert('Usuario no encontrado.');
    const nombre=prompt('Nombre completo:',u.nombre_completo||'');if(nombre===null)return;
    const identidad=prompt('Identidad (13 dígitos):',u.identidad||'');if(identidad===null)return;
    const correo=prompt('Correo personal/institucional:',u.correo||'');if(correo===null)return;
    const telefono=prompt('Teléfono (8 dígitos):',u.telefono||'');if(telefono===null)return;
    const cargo=prompt('Cargo / función:',u.cargo_funcion||'');if(cargo===null)return;
    const rp=choose('Seleccione el rol:',roles,u.rol,x=>roleText(x));if(rp.cancel)return;if(rp.error)return alert('Rol inválido.');const newRole=rp.value;
    let ecorId=null,municipioId=null,estId=null,type=null,specialty=null,scope='DEPARTAMENTO',monitor=false;
    if(['ECOR','JEFE_MUNICIPAL'].includes(newRole)){const p=choose('Seleccione ECOR:',ecors,u.ecor_id);if(p.cancel)return;if(p.error)return alert('ECOR inválido.');ecorId=p.value.id;}
    if(newRole==='JEFE_MUNICIPAL'){const valid=municipios.filter(m=>establishments.some(e=>e.tipo==='US'&&e.ecor_id===ecorId&&e.municipio_id===m.id));const p=choose('Seleccione municipio:',valid,u.municipio_id);if(p.cancel)return;if(p.error)return alert('Municipio inválido.');municipioId=p.value.id;}
    if(['USUARIO_US','USUARIO_HOSPITAL'].includes(newRole)){const valid=establishments.filter(e=>newRole==='USUARIO_HOSPITAL'?(e.tipo==='HOSPITAL'&&e.es_externo_olancho!==true):(e.tipo==='US'&&e.es_externo_olancho!==true));const p=choose(newRole==='USUARIO_HOSPITAL'?'Seleccione hospital:':'Seleccione establecimiento:',valid,u.establecimiento_id,x=>`${x.nombre} · RUPS ${x.codigo_rups||''}`);if(p.cancel)return;if(p.error)return alert('Establecimiento inválido.');estId=p.value.id;municipioId=p.value.municipio_id||null;ecorId=newRole==='USUARIO_US'?(p.value.ecor_id||null):null;}
    if(newRole==='USUARIO_HOSPITAL'){const p=choose('Seleccione tipo de usuario hospitalario:',Object.keys(hospitalTypes),u.tipo_usuario_hospital||'',x=>hospitalTypes[x]);if(p.cancel)return;if(p.error)return alert('Tipo hospitalario inválido.');type=p.value;if(type==='MEDICO_ESPECIALISTA'){specialty=prompt('Especialidad médica:',u.especialidad||'');if(specialty===null)return;if(!specialty.trim())return alert('La especialidad es obligatoria.');specialty=specialty.trim();}}
    if(newRole==='AUDITOR_CONSULTA'){const scopes=['ESTABLECIMIENTO','MUNICIPIO','ECOR','DEPARTAMENTO'];const p=choose('Alcance de consulta:',scopes,u.alcance_consulta||'DEPARTAMENTO',x=>({ESTABLECIMIENTO:'Establecimiento',MUNICIPIO:'Municipio',ECOR:'ECOR',DEPARTAMENTO:'Todo Olancho'})[x]);if(p.cancel)return;if(p.error)return alert('Alcance inválido.');scope=p.value;if(scope==='ECOR'){const q=choose('Seleccione ECOR:',ecors,u.ecor_id);if(q.cancel)return;if(q.error)return alert('ECOR inválido.');ecorId=q.value.id;}if(scope==='MUNICIPIO'){const q=choose('Seleccione municipio:',municipios,u.municipio_id);if(q.cancel)return;if(q.error)return alert('Municipio inválido.');municipioId=q.value.id;}if(scope==='ESTABLECIMIENTO'){const q=choose('Seleccione establecimiento:',establishments.filter(e=>e.es_externo_olancho!==true),u.establecimiento_id,x=>`${x.nombre} · RUPS ${x.codigo_rups||''}`);if(q.cancel)return;if(q.error)return alert('Establecimiento inválido.');estId=q.value.id;}monitor=confirm('¿Habilitar Centro Regional de Monitoría?');}
    const notifications=confirm('¿Mantener activadas las notificaciones generales?');
    const reports=confirm('¿Habilitar reportes para este usuario?');
    const reason=prompt('Motivo obligatorio del cambio:');if(!reason?.trim())return alert('El motivo es obligatorio.');
    if(!confirm(`¿Guardar cambios de ${u.nombre_completo}?\n\nRol: ${roleText(u.rol)} → ${roleText(newRole)}\nQuedará registrado en Auditoría.`))return;
    const {error}=await sb.rpc('sirro_admin_update_user_profile_v2',{p_usuario:id,p_nombre:nombre.trim(),p_identidad:identidad.trim(),p_correo:correo.trim(),p_telefono:telefono.trim(),p_cargo:cargo.trim(),p_rol:newRole,p_ecor:ecorId,p_municipio:municipioId,p_establecimiento:estId,p_tipo_usuario_hospital:type,p_especialidad:specialty,p_notificaciones_activas:notifications,p_reportes_habilitados:reports,p_alcance_consulta:scope,p_permiso_centro_monitoria:monitor,p_motivo:reason.trim()});
    if(error)return alert(error.message);await loadUsers();renderUsers();alert('Usuario actualizado correctamente.');
  }

  async function secureReset(id){
    if(!isAdmin())return alert('Solo el Administrador Regional puede gestionar accesos.');
    const u=users.find(x=>x.id===id);if(!u?.correo)return alert('El usuario no tiene correo registrado.');
    if(!confirm(`¿Enviar enlace de restablecimiento a ${u.correo}?`))return;
    const {data,error}=await sb.functions.invoke('sirro-admin-password-reset',{body:{user_id:id}});
    if(error)return alert('No se pudo solicitar el restablecimiento: '+error.message);if(data?.error)return alert(data.error);
    alert('Enlace enviado al correo registrado. El Administrador Regional no ve ni conoce la nueva contraseña.');
  }

  const prior=typeof renderUsers==='function'?renderUsers:null;
  if(prior){renderUsers=function(){prior();if(!isAdmin())return;const rows=[...document.getElementById('usersList').children];users.forEach((u,i)=>{const actions=rows[i]?.querySelector('.actions');if(!actions)return;if(!actions.querySelector(`[data-edit-user="${u.id}"]`)){const b=document.createElement('button');b.type='button';b.className='ghost';b.dataset.editUser=u.id;b.textContent='Editar usuario';b.onclick=()=>editUser(u.id);actions.prepend(b);}if(!actions.querySelector(`[data-reset-user="${u.id}"]`)){const b=document.createElement('button');b.type='button';b.className='ghost';b.dataset.resetUser=u.id;b.textContent='Restablecer acceso';b.onclick=()=>secureReset(u.id);actions.appendChild(b);}if(u.rol==='USUARIO_HOSPITAL'&&u.tipo_usuario_hospital&&!rows[i].querySelector('[data-hospital-type]')){const d=document.createElement('small');d.dataset.hospitalType='1';d.style.display='block';d.textContent=`Hospital: ${hospitalTypes[u.tipo_usuario_hospital]||u.tipo_usuario_hospital}${u.especialidad?' · '+u.especialidad:''}`;rows[i].querySelector('small')?.insertAdjacentElement('afterend',d);}});};}

  window.editUser=editUser;window.sendPasswordReset=secureReset;
  addHospitalFields();if(isAdmin()&&typeof renderUsers==='function')renderUsers();
})();