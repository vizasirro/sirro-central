(() => {
  if (window.SIRRO_GERENCIA_PROFILE) return;
  const LEVELS=Object.freeze({REGION:'REGIONAL',HOSPITAL:'HOSPITAL',ECOR:'ECOR',MUNICIPIO:'MUNICIPAL'});
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  const isGerencia=p=>p?.rol==='AUDITOR_CONSULTA'&&norm(p?.cargo_funcion).startsWith('GERENCIA');
  const gerenciaLevel=p=>{const c=norm(p?.cargo_funcion);if(c.includes('REGIONAL'))return'REGIONAL';if(c.includes('HOSPITAL'))return'HOSPITAL';if(c.includes('ECOR'))return'ECOR';if(c.includes('MUNIC'))return'MUNICIPAL';return'';};

  function addGerenciaControls(){
    const role=document.getElementById('newRole'),job=document.getElementById('newJob'),form=document.getElementById('userForm');
    if(!role||!job||!form||document.getElementById('newGerenciaLevel'))return;
    if(![...role.options].some(o=>o.value==='GERENCIA')){
      const opt=document.createElement('option');opt.value='GERENCIA';opt.textContent='GERENCIA';role.appendChild(opt);
    }
    const levelWrap=document.createElement('label');levelWrap.id='newGerenciaLevelWrap';levelWrap.className='hidden';levelWrap.innerHTML='Tipo de gerencia<select id="newGerenciaLevel"><option value="">Seleccione</option><option value="REGION">Región</option><option value="HOSPITAL">Hospital</option><option value="ECOR">ECOR</option><option value="MUNICIPIO">Municipio</option></select>';
    const entityWrap=document.createElement('label');entityWrap.id='newGerenciaEntityWrap';entityWrap.className='hidden';entityWrap.innerHTML='<span id="newGerenciaEntityLabel">Ámbito</span><select id="newGerenciaEntity"></select>';
    job.closest('label')?.insertAdjacentElement('afterend',levelWrap);levelWrap.insertAdjacentElement('afterend',entityWrap);
    const level=document.getElementById('newGerenciaLevel'),entity=document.getElementById('newGerenciaEntity'),entityLabel=document.getElementById('newGerenciaEntityLabel');

    function fillEntity(){
      const v=level.value;entity.innerHTML='<option value="">Seleccione</option>';entityWrap.classList.toggle('hidden',!v||v==='REGION');
      if(v==='ECOR'){entityLabel.textContent='ECOR';entity.innerHTML+=[...(window.ecors||[])].map(x=>`<option value="${x.id}">${esc(x.nombre)}</option>`).join('');}
      if(v==='MUNICIPIO'){entityLabel.textContent='Municipio';entity.innerHTML+=[...(window.municipios||[])].map(x=>`<option value="${x.id}">${esc(x.nombre)}</option>`).join('');}
      if(v==='HOSPITAL'){entityLabel.textContent='Hospital';entity.innerHTML+=[...(window.establishments||[])].filter(x=>x.tipo==='HOSPITAL'&&!x.es_externo_olancho).map(x=>`<option value="${x.id}">${esc(x.nombre)}</option>`).join('');}
      job.value=v?`GERENCIA · ${LEVELS[v]||v}`:'';
    }
    function updateUI(){
      const on=role.value==='GERENCIA';levelWrap.classList.toggle('hidden',!on);if(!on){entityWrap.classList.add('hidden');job.readOnly=false;return;}job.readOnly=true;job.placeholder='Se completa según el tipo de gerencia';fillEntity();
      ['newScopeWrap','newMonitorWrap','newEcorWrap','newMunicipioWrap','newEstWrap'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
    }
    role.addEventListener('change',()=>setTimeout(updateUI,0));level.addEventListener('change',fillEntity);updateUI();

    form.addEventListener('submit',e=>{
      if(role.value!=='GERENCIA')return;
      const v=level.value;if(!v){e.preventDefault();e.stopImmediatePropagation();showMsg('#userMsg','Seleccione el tipo de gerencia.','error');return;}
      if(v!=='REGION'&&!entity.value){e.preventDefault();e.stopImmediatePropagation();showMsg('#userMsg','Seleccione el ámbito de la gerencia.','error');return;}
      const hiddenScope=document.getElementById('newScope'),hiddenMonitor=document.getElementById('newMonitorPermission'),hiddenEcor=document.getElementById('newEcor'),hiddenMun=document.getElementById('newMunicipio'),hiddenEst=document.getElementById('newEst');
      hiddenMonitor.value='true';hiddenEcor.value='';hiddenMun.value='';
      if(v==='REGION'){hiddenScope.value='DEPARTAMENTO';}
      if(v==='ECOR'){hiddenScope.value='ECOR';hiddenEcor.value=entity.value;}
      if(v==='MUNICIPIO'){hiddenScope.value='MUNICIPIO';hiddenMun.value=entity.value;}
      if(v==='HOSPITAL'){
        hiddenScope.value='ESTABLECIMIENTO';const h=(window.establishments||[]).find(x=>String(x.id)===String(entity.value));if(h){hiddenMun.value=h.municipio_id||'';if(typeof fillUserEstablishments==='function')fillUserEstablishments();hiddenEst.value=h.id;}
      }
      job.value=`GERENCIA · ${LEVELS[v]||v}`;
      role.value='AUDITOR_CONSULTA';
    },true);
  }

  function applyGerenciaIdentity(){
    if(typeof profile==='undefined'||!isGerencia(profile))return;
    const meta=document.getElementById('userMeta');if(meta)meta.textContent=`Gerencia · ${gerenciaLevel(profile)}${profile.cargo_funcion?' · '+profile.cargo_funcion.replace(/^GERENCIA\s*·\s*/i,''):''}`;
  }

  const previousRender=typeof renderUsers==='function'?renderUsers:null;
  if(previousRender){renderUsers=function(){const r=previousRender.apply(this,arguments);const list=document.getElementById('usersList');if(list&&Array.isArray(users)){[...list.children].forEach((item,i)=>{const u=users[i];if(!isGerencia(u))return;const s=item.querySelector('small');if(s)s.innerHTML=s.innerHTML.replace(/^Auditor \/ Consulta/,`GERENCIA · ${gerenciaLevel(u)}`);});}return r;};}
  const previousRefresh=typeof refreshAll==='function'?refreshAll:null;
  if(previousRefresh){refreshAll=async function(){const r=await previousRefresh.apply(this,arguments);applyGerenciaIdentity();return r;};}

  window.SIRRO_GERENCIA_PROFILE=Object.freeze({LEVELS,isGerencia,gerenciaLevel});
  addGerenciaControls();applyGerenciaIdentity();
})();
