(() => {
  const originalComplete = window.completePuerperal;
  const originalRegisterDelivery = window.registerDelivery;
  const getRow = async (id,n) => {
    try {
      const {data,error}=await sb.from('seguimientos_postreferencia').select('tramo_id,numero_control,estado,fecha_base,ventana_desde,ventana_hasta').eq('tramo_id',id).eq('tipo','PUERPERAL').eq('numero_control',n).maybeSingle();
      if(error) throw error; return data;
    } catch(e){ console.error('SIRRO puerperal guard',e); return null; }
  };
  const windowOpen = s => !!s?.ventana_desde && Date.now() >= new Date(s.ventana_desde).getTime();
  window.completePuerperal = async function(id,n){
    const s=await getRow(id,n);
    if(!s) return alert('No fue posible validar la ventana del control puerperal. Actualice e intente nuevamente.');
    if(s.estado==='COMPLETADA') return alert('Este control puerperal ya fue registrado.');
    if(!windowOpen(s)) return alert(`Este control todavía no puede registrarse. Se habilitará a partir de ${new Date(s.ventana_desde).toLocaleString('es-HN',{timeZone:'America/Tegucigalpa',hour12:false})}.`);
    if(typeof originalComplete==='function') return originalComplete(id,n);
  };

  // Regla de integridad: el primer registro del parto es directo; cualquier cambio posterior
  // queda bloqueado en la interfaz y también en el punto de entrada de la acción.
  window.registerDelivery = async function(id){
    const s=await getRow(id,1);
    if(s?.fecha_base) return alert('La fecha y hora del parto ya fueron registradas y están bloqueadas. Para modificarlas se requiere una corrección administrativa autorizada y auditada.');
    if(typeof originalRegisterDelivery==='function') return originalRegisterDelivery(id);
  };

  function lockRegisteredDeliveryBoxes(){
    document.querySelectorAll('.notice').forEach(box=>{
      const strong=box.querySelector(':scope > strong');
      if(!strong||strong.textContent.trim()!=='Fecha y hora del parto'||!box.textContent.includes('Registrada:'))return;
      box.querySelectorAll('input[id^="parto-"]').forEach(el=>{el.disabled=true;el.readOnly=true;});
      box.querySelectorAll('button').forEach(btn=>{
        const oc=btn.getAttribute('onclick')||'';
        if(oc.includes('setNowClinical')||oc.includes('registerDelivery'))btn.remove();
      });
      if(!box.querySelector('.sirro-delivery-lock')){
        const note=document.createElement('div');note.className='notice sirro-delivery-lock';
        note.innerHTML='<small><strong>Dato bloqueado después del registro.</strong> Cualquier cambio de fecha u hora del parto requiere gestión administrativa autorizada y auditada. La corrección deberá conservar el valor anterior, el nuevo valor, motivo, solicitante, autorizador y fecha/hora; los controles futuros se recalculan sin alterar controles ya realizados.</small>';
        box.appendChild(note);
      }
    });
  }

  async function applyGuard(){
    if(typeof sb==='undefined') return;
    let rows=[];
    try{const {data,error}=await sb.from('seguimientos_postreferencia').select('tramo_id,numero_control,estado,ventana_desde,ventana_hasta').eq('tipo','PUERPERAL');if(error)throw error;rows=data||[];}catch{return;}
    const map=new Map(rows.map(s=>[`${s.tramo_id}:${Number(s.numero_control||1)}`,s]));
    document.querySelectorAll('button[onclick*="completePuerperal("]').forEach(btn=>{
      const m=(btn.getAttribute('onclick')||'').match(/completePuerperal\('([^']+)',\s*(\d+)\)/);if(!m)return;
      const s=map.get(`${m[1]}:${Number(m[2])}`);if(!s)return;
      const open=windowOpen(s);btn.disabled=!open;
      if(!open){btn.textContent=`Disponible desde ${new Date(s.ventana_desde).toLocaleString('es-HN',{timeZone:'America/Tegucigalpa',hour12:false})}`;btn.title='El control se habilita únicamente al iniciar su ventana correspondiente.';}
    });
    document.querySelectorAll('.notice').forEach(box=>{
      const strong=box.querySelector(':scope > strong');if(!strong||!/^Control puerperal 3$/.test(strong.textContent.trim()))return;
      if(box.textContent.includes('Control registrado como realizado'))return;
      box.innerHTML=box.innerHTML.replace(/Responsable actual: hospital \(paciente continúa ingresada\)\.|Responsable actual: establecimiento de origen después del alta\./,'Responsable al llegar la fecha: se determinará según la situación de la paciente; hospital si continúa ingresada, establecimiento de origen si ya fue dada de alta.');
    });
    lockRegisteredDeliveryBoxes();
  }
  const observer=new MutationObserver(()=>{clearTimeout(window.__sirroPuerperalGuardTimer);window.__sirroPuerperalGuardTimer=setTimeout(applyGuard,60);});
  const start=()=>{observer.observe(document.body,{childList:true,subtree:true});applyGuard();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();