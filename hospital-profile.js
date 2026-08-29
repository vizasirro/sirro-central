(() => {
  if (window.SIRRO_HOSPITAL_PROFILE) return;

  const TYPES = Object.freeze({
    DIRECCION_HOSPITAL:'DIRECCIÓN HOSPITAL',
    MEDICO_ESPECIALISTA:'MÉDICO ESPECIALISTA',
    LIC_ENFERMERIA:'LICENCIADA EN ENFERMERÍA',
    AUX_ENFERMERIA:'AUXILIAR DE ENFERMERÍA',
    GESTION_CITAS:'GESTIÓN DE CITAS'
  });
  const SPECIALTIES=window.SIRRO?.constants?.SPECIALTIES || ['Pediatría','Gineco-Obstetricia','Medicina Interna','Cirugía','Ortopedia'];
  const norm=window.SIRRO?.utils?.normalize || (v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase());
  // Compatibilidad: usuarios antiguos con DIRECCIÓN HOSPITAL conservan su acceso de solo supervisión.
  const isDirection=p=>p?.rol==='USUARIO_HOSPITAL'&&norm(p?.cargo_funcion)==='DIRECCION HOSPITAL';

  function ensureCreateControls(){
    const role=document.getElementById('newRole'), job=document.getElementById('newJob');
    if(!role||!job||document.getElementById('newHospitalUserType'))return;
    const wrap=document.createElement('label');
    wrap.id='newHospitalUserTypeWrap';
    wrap.className='hidden';
    wrap.innerHTML=`Tipo de usuario hospitalario<select id="newHospitalUserType">
      <option value="">Seleccione</option>
      <option value="MEDICO_ESPECIALISTA">Médico especialista</option>
      <option value="LIC_ENFERMERIA">Licenciada en Enfermería</option>
      <option value="AUX_ENFERMERIA">Auxiliar de Enfermería</option>
      <option value="GESTION_CITAS">Gestión de Citas</option>
    </select>`;
    job.closest('label')?.insertAdjacentElement('afterend',wrap);

    const spec=document.createElement('label');
    spec.id='newHospitalSpecialtyWrap';
    spec.className='hidden';
    spec.innerHTML=`Especialidad médica<select id="newHospitalSpecialty"><option value="">Seleccione especialidad</option>${SPECIALTIES.map(x=>`<option value="${x}">${x}</option>`).join('')}<option value="OTRO">Otro</option></select>`;
    wrap.insertAdjacentElement('afterend',spec);

    const type=document.getElementById('newHospitalUserType');
    const specialty=document.getElementById('newHospitalSpecialty');
    const update=()=>{
      const hospital=role.value==='USUARIO_HOSPITAL';
      wrap.classList.toggle('hidden',!hospital);
      if(!hospital){type.value='';spec.classList.add('hidden');job.readOnly=false;return;}
      const specialist=type.value==='MEDICO_ESPECIALISTA';
      spec.classList.toggle('hidden',!specialist);
      job.readOnly=true;
      job.placeholder='Se completa según el tipo de usuario hospitalario';
      if(type.value==='LIC_ENFERMERIA')job.value=TYPES.LIC_ENFERMERIA;
      else if(type.value==='AUX_ENFERMERIA')job.value=TYPES.AUX_ENFERMERIA;
      else if(type.value==='GESTION_CITAS')job.value=TYPES.GESTION_CITAS;
      else if(type.value==='MEDICO_ESPECIALISTA')job.value=specialty.value&&specialty.value!=='OTRO'?`${TYPES.MEDICO_ESPECIALISTA} · ${specialty.value}`:'';
      else job.value='';
    };
    role.addEventListener('change',update);
    type.addEventListener('change',update);
    specialty.addEventListener('change',()=>{
      if(specialty.value==='OTRO'){
        const other=prompt('Especifique otra especialidad:','');
        if(!other?.trim()){specialty.value='';update();return;}
        const option=document.createElement('option');option.value=other.trim();option.textContent=other.trim();specialty.insertBefore(option,specialty.lastElementChild);specialty.value=other.trim();
      }
      update();
    });
    update();

    const form=document.getElementById('userForm');
    form?.addEventListener('submit',e=>{
      if(role.value!=='USUARIO_HOSPITAL')return;
      if(!type.value){e.preventDefault();e.stopImmediatePropagation();if(typeof showMsg==='function')showMsg('#userMsg','Seleccione el tipo de usuario hospitalario.','error');return;}
      if(type.value==='MEDICO_ESPECIALISTA'&&!specialty.value){e.preventDefault();e.stopImmediatePropagation();if(typeof showMsg==='function')showMsg('#userMsg','Seleccione la especialidad médica.','error');return;}
      update();
    },true);
  }

  function applyDirectionNavigation(){
    if(typeof profile==='undefined'||!profile||!isDirection(profile))return;
    ['nueva','recibidas'].forEach(tab=>document.querySelector(`#tabs button[data-tab="${tab}"]`)?.classList.add('hidden'));
  }
  function removeDirectionClinicalActions(){
    if(typeof profile==='undefined'||!isDirection(profile))return;
    document.querySelectorAll('#trackingList .actions button, #receivedList .actions button').forEach(b=>b.remove());
  }

  const previousConfigure=typeof configureTabs==='function'?configureTabs:null;
  if(previousConfigure){configureTabs=function(){const r=previousConfigure.apply(this,arguments);applyDirectionNavigation();return r;};}
  const previousTracking=typeof renderTracking==='function'?renderTracking:null;
  if(previousTracking){renderTracking=function(){const r=previousTracking.apply(this,arguments);removeDirectionClinicalActions();return r;};}
  const previousReceived=typeof renderReceived==='function'?renderReceived:null;
  if(previousReceived){renderReceived=function(){const r=previousReceived.apply(this,arguments);removeDirectionClinicalActions();return r;};}

  window.SIRRO_HOSPITAL_PROFILE=Object.freeze({TYPES,isDirection});
  ensureCreateControls();applyDirectionNavigation();removeDirectionClinicalActions();
})();