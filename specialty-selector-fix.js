(() => {
  const specialties=['Pediatría','Gineco-Obstetricia','Medicina Interna','Cirugía','Ortopedia'];

  function upgradeCreateSpecialtyField(){
    const current=document.getElementById('newSpecialty');
    if(!current||current.tagName==='SELECT')return;
    const select=document.createElement('select');
    select.id='newSpecialty';
    select.innerHTML='<option value="">Seleccione especialidad</option>'+specialties.map(x=>`<option value="${x}">${x}</option>`).join('')+'<option value="__OTRO__">Otro</option>';
    current.replaceWith(select);
    select.addEventListener('change',()=>{
      if(select.value!=='__OTRO__')return;
      const detail=window.prompt('Especifique otra especialidad:','');
      if(!detail?.trim()){select.value='';return;}
      const value=detail.trim();
      const option=document.createElement('option');
      option.value=value;option.textContent=value;option.dataset.customSpecialty='true';
      select.insertBefore(option,select.lastElementChild);
      select.value=value;
    });
  }

  function selectedSpecialtyPrompt(originalPrompt,current=''){
    const currentIndex=specialties.findIndex(x=>x===current);
    const defaultChoice=currentIndex>=0?String(currentIndex+1):'6';
    const raw=originalPrompt('Seleccione especialidad médica:\n1. Pediatría\n2. Gineco-Obstetricia\n3. Medicina Interna\n4. Cirugía\n5. Ortopedia\n6. Otro',defaultChoice);
    if(raw===null)return null;
    const n=Number(raw);
    if(n>=1&&n<=5)return specialties[n-1];
    if(n===6){
      const detail=originalPrompt('Especifique otra especialidad:',currentIndex>=0?'':current||'');
      if(detail===null)return null;
      return detail.trim();
    }
    return '';
  }

  const previousRender=typeof renderUsers==='function'?renderUsers:null;
  if(previousRender){
    renderUsers=function(){
      previousRender();
      if(typeof profile==='undefined'||profile?.rol!=='ADMIN_REGIONAL')return;
      const list=document.getElementById('usersList');
      if(!list||typeof users==='undefined')return;
      users.forEach(u=>{
        const button=list.querySelector(`[data-edit-user="${u.id}"]`);
        if(!button||button.dataset.specialtySelectorFixed==='1')return;
        button.dataset.specialtySelectorFixed='1';
        button.onclick=async()=>{
          const originalPrompt=window.prompt;
          window.prompt=(message,defaultValue)=>{
            if(message==='Especialidad médica:')return selectedSpecialtyPrompt(originalPrompt,defaultValue||'');
            return originalPrompt(message,defaultValue);
          };
          try{await window.editUser(u.id);}finally{window.prompt=originalPrompt;}
        };
      });
      // El Administrador Regional no gestiona el restablecimiento de su propia cuenta.
      // Para su acceso personal utiliza el flujo ¿Olvidaste tu contraseña? del inicio de sesión.
      const ownId=profile?.id||profile?.usuario_id||profile?.user_id;
      if(ownId){
        const ownReset=list.querySelector(`[data-reset-user="${ownId}"]`);
        if(ownReset)ownReset.remove();
      }
    };
  }

  upgradeCreateSpecialtyField();
  if(typeof profile!=='undefined'&&profile?.rol==='ADMIN_REGIONAL'&&typeof renderUsers==='function')renderUsers();
})();
