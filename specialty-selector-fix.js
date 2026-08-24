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

/* Regla de oro obstétrica: la auxiliar hospitalaria únicamente registra fecha y hora del parto,
   y solo después de que la paciente haya sido recibida como HOSPITALIZADA. */
(() => {
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  const isAuxiliar=()=>{
    if(profile?.rol!=='USUARIO_HOSPITAL')return false;
    const cargo=norm(profile?.cargo_funcion);
    return cargo==='AE'||cargo==='A.E.'||cargo==='AUX ENFERMERIA'||cargo==='AUX. ENFERMERIA'||(cargo.includes('AUXILIAR')&&cargo.includes('ENFERMER'));
  };
  const deny=()=>alert('Este perfil de Auxiliar de Enfermería únicamente puede registrar la fecha y la hora del parto de una paciente ya hospitalizada.');

  function guardAction(name){
    const original=window[name];
    if(typeof original!=='function'||original.__sirroAuxGuard)return;
    const wrapped=async function(...args){if(isAuxiliar())return deny();return original.apply(this,args);};
    wrapped.__sirroAuxGuard=true;window[name]=wrapped;
  }
  ['receiveTramo','rejectTramo','evaluateTramo','answerTramo','secondaryTramo','closeTramo','reorientTramo','completePuerperal','assignCeAppointment'].forEach(guardAction);

  const originalRegister=window.registerDelivery;
  if(typeof originalRegister==='function'){
    window.registerDelivery=async function(id){
      const t=Array.isArray(tramos)?tramos.find(x=>String(x.id)===String(id)):null;
      if(!t||t.estado_actual!=='HOSPITALIZADO')return alert('La fecha y hora del parto solo pueden registrarse después de que la paciente haya sido recibida como hospitalizada.');
      return originalRegister.apply(this,arguments);
    };
  }

  function cleanTramoHtml(t,html){
    if(!html)return html;
    const root=document.createElement('div');root.innerHTML=html;
    const delivery=[...root.querySelectorAll('.notice')].find(x=>x.querySelector(':scope > strong')?.textContent.trim()==='Fecha y hora del parto');
    if(delivery&&t?.estado_actual!=='HOSPITALIZADO')delivery.remove();
    if(isAuxiliar()){
      root.querySelectorAll('.actions button').forEach(btn=>{
        const oc=btn.getAttribute('onclick')||'';
        if(!oc.includes('registerDelivery')&&!oc.includes('setNowClinical'))btn.remove();
      });
      root.querySelectorAll('.notice').forEach(box=>{
        const title=box.querySelector(':scope > strong')?.textContent.trim()||'';
        if(/^Control puerperal\s+\d+/.test(title))box.remove();
      });
      if(delivery&&t?.estado_actual==='HOSPITALIZADO'){
        delivery.classList.add('sirro-delivery-only');
        const hint=delivery.querySelector('small');
        if(hint)hint.textContent='Auxiliar de Enfermería: únicamente registre la fecha y la hora del parto.';
      }
    }
    return root.innerHTML;
  }

  const previousTramoItem=typeof tramoItem==='function'?tramoItem:null;
  if(previousTramoItem){
    tramoItem=function(t,withActions=true){return cleanTramoHtml(t,previousTramoItem(t,withActions));};
  }

  function applyAuxiliarNavigation(){
    if(!isAuxiliar())return;
    ['nueva','seguimiento','monitoreo'].forEach(name=>document.querySelector(`#tabs button[data-tab="${name}"]`)?.classList.add('hidden'));
  }

  function applyDeliveryLayout(){
    applyAuxiliarNavigation();
    document.querySelectorAll('.notice').forEach(box=>{
      if(box.querySelector(':scope > strong')?.textContent.trim()!=='Fecha y hora del parto')return;
      const actions=[...box.querySelectorAll('.actions')];
      const fields=actions.find(a=>a.querySelector('input[type="date"]')&&a.querySelector('input[type="time"]'));
      if(fields){
        fields.style.display='grid';fields.style.gridTemplateColumns='minmax(0,1fr) minmax(0,1fr)';fields.style.gap='12px';fields.style.alignItems='end';
        fields.querySelectorAll('label').forEach(l=>{l.style.display='block';l.style.width='100%';l.style.minWidth='0';});
        const now=[...fields.querySelectorAll('button')].find(b=>b.textContent.includes('Usar fecha y hora actual'));
        if(now){now.style.gridColumn='1 / -1';now.style.justifySelf='start';now.style.marginTop='2px';}
      }
    });
  }
  const style=document.createElement('style');
  style.textContent='@media(max-width:560px){.sirro-delivery-only .actions:has(input[type="date"]){grid-template-columns:1fr!important}}';
  document.head.appendChild(style);
  const observer=new MutationObserver(()=>{clearTimeout(window.__sirroAuxDeliveryTimer);window.__sirroAuxDeliveryTimer=setTimeout(applyDeliveryLayout,40);});
  observer.observe(document.body,{childList:true,subtree:true});applyDeliveryLayout();
})();

/* Identificación primaria del paciente: ID primero, Código SIRRO como apoyo y trazabilidad. */
(() => {
  const isHospital=()=>typeof profile!=='undefined'&&profile?.rol==='USUARIO_HOSPITAL';
  const patientCase=t=>typeof caseOf==='function'?caseOf(t?.caso_id):null;
  const normalize=v=>String(v||'').trim().toLowerCase();

  function identityFirstHtml(t,html){
    if(!html)return html;
    const c=patientCase(t);if(!c)return html;
    const root=document.createElement('div');root.innerHTML=html;
    const item=root.querySelector('.item');if(!item)return html;
    item.dataset.patientId=String(c.paciente_identidad||'');
    item.dataset.sirroCode=String(c.codigo_visible||'');
    item.dataset.patientName=String(c.paciente_nombre||'');
    const main=item.querySelector('.row > div');
    if(main){
      const route=main.querySelector('small')?.outerHTML||'';
      main.innerHTML=`<div class="sirro-primary-id"><strong>ID:</strong> <strong>${esc(c.paciente_identidad||'Sin ID')}</strong></div><div><strong>Paciente:</strong> ${esc(c.paciente_nombre||'')}</div><div class="muted"><strong>Código SIRRO:</strong> ${esc(c.codigo_visible||'')}</div>${route}`;
    }
    return root.innerHTML;
  }

  const previousTramoItem=typeof tramoItem==='function'?tramoItem:null;
  if(previousTramoItem){
    tramoItem=function(t,withActions=true){return identityFirstHtml(t,previousTramoItem(t,withActions));};
  }

  function ensureHospitalSearch(){
    const list=document.getElementById('receivedList');
    if(!list||!isHospital())return;
    let box=document.getElementById('hospitalPatientSearchBox');
    if(!box){
      box=document.createElement('div');box.id='hospitalPatientSearchBox';box.className='readonlybox';box.style.marginBottom='12px';
      box.innerHTML='<label style="margin:0"><strong>Buscar por ID / número de identidad</strong><input id="hospitalPatientSearch" inputmode="numeric" autocomplete="off" placeholder="Escriba el ID del paciente"></label><div class="hint" style="margin-top:6px">Búsqueda principal por ID. También puede buscar por Código SIRRO como alternativa.</div>';
      list.parentElement?.insertBefore(box,list);
      box.querySelector('#hospitalPatientSearch')?.addEventListener('input',filterHospitalReceived);
    }
  }

  function filterHospitalReceived(){
    const q=normalize(document.getElementById('hospitalPatientSearch')?.value);
    const list=document.getElementById('receivedList');if(!list)return;
    list.querySelectorAll(':scope > .item').forEach(item=>{
      const id=normalize(item.dataset.patientId),code=normalize(item.dataset.sirroCode);
      item.style.display=!q||id.includes(q)||code.includes(q)?'':'none';
    });
  }

  const previousRenderReceived=typeof renderReceived==='function'?renderReceived:null;
  if(previousRenderReceived){
    renderReceived=function(){
      previousRenderReceived();
      ensureHospitalSearch();
      filterHospitalReceived();
    };
  }

  const previousRenderTracking=typeof renderTracking==='function'?renderTracking:null;
  if(previousRenderTracking){
    renderTracking=function(){
      const search=document.getElementById('searchRef');
      if(search&&isHospital())search.placeholder='Buscar por ID / identidad (también Código SIRRO o paciente)';
      previousRenderTracking();
    };
  }

  const css=document.createElement('style');
  css.textContent='.sirro-primary-id{font-size:1.04em;margin-bottom:2px}.sirro-primary-id strong:first-child{letter-spacing:.02em}';
  document.head.appendChild(css);

  if(typeof renderReceived==='function')renderReceived();
})();

/* Resiliencia de red: evita exponer errores técnicos como "TypeError: Load failed" al usuario. */
(() => {
  const originalAlert=window.alert.bind(window);
  const isNetworkError=v=>/load failed|failed to fetch|networkerror|network request failed|fetch failed|typeerror.*fetch|typeerror.*load/i.test(String(v||''));
  let networkNoticeShown=false;

  function showNetworkNotice(){
    if(networkNoticeShown)return;
    networkNoticeShown=true;
    originalAlert('No fue posible completar la comunicación con SIRRO. Verifique la conexión y pulse Actualizar. No repita una acción clínica hasta confirmar en pantalla si el estado cambió.');
    setTimeout(()=>{networkNoticeShown=false;},800);
  }

  function wrapAction(name){
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

  ['receiveTramo','evaluateTramo','rejectTramo','answerTramo','secondaryTramo','reorientTramo','markNotificationRead','closeTramo','registerDelivery','completePuerperal','assignCeAppointment','saveCeDateTime'].forEach(wrapAction);

  window.addEventListener('unhandledrejection',event=>{
    const reason=event?.reason;
    if(isNetworkError(reason?.message||reason)){
      event.preventDefault();
      showNetworkNotice();
    }
  });
})();
