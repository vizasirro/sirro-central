(() => {
  const REPORTS = [
    ['Referencias emitidas','origen'],['Referencias recibidas','destino'],['Referencias por motivo','motivo'],['Referencias por establecimiento','origen'],['Referencias por período','mes'],['Referencias por destino','destino'],['Escalamientos','escalamiento'],['Aceptadas y rechazadas','estado'],['Tiempos de respuesta','tiempos'],['Contrarreferencias','estado'],['Casos hospitalizados','hospitalizado'],['Altas hospitalarias','alta'],['Referencias externas','externa'],['Consulta externa','consulta_externa'],['Casos pendientes','pendiente'],['Casos vencidos/alertas','alerta'],['Casos cerrados','cerrado'],['Productividad por establecimiento','origen'],['Productividad por municipio y ECOR','ecor'],['Desempeño hospitalario','destino'],['Atención materna','materna'],['Partos registrados','parto'],['Primer control puerperal','control1'],['Segundo control puerperal','control2'],['Tercer control puerperal','control3'],['Cumplimiento puerperal completo','puerperal'],['Oportunidad del control puerperal','oportunidad'],['Puérperas hospitalizadas durante el control','puerpera_hospital'],['Continuidad hospital → US','continuidad'],['Pérdidas de seguimiento puerperal','perdida'],['Cobertura puerperal','cobertura'],['Auditoría administrativa','auditoria'],['Usuarios y actividad','usuarios'],['Reporte regional consolidado','ecor']
  ];

  let followups=[];
  const byId=(arr,id)=>arr?.find(x=>x.id===id);
  const nameFac=id=>byId(establishments,id)?.nombre||'';
  const nameMun=id=>byId(municipios,id)?.nombre||'';
  const nameEcor=id=>byId(ecors,id)?.nombre||'';
  const iso=v=>v?new Date(v).toISOString():'';
  const hrs=(a,b)=>a&&b?Math.round(((new Date(b)-new Date(a))/3600000)*100)/100:'';
  const follow=(tramoId,n)=>followups.find(x=>x.tramo_id===tramoId&&x.tipo==='PUERPERAL'&&Number(x.numero_control||0)===n);
  const ce=(tramoId)=>followups.find(x=>x.tramo_id===tramoId&&x.tipo==='CONSULTA_EXTERNA');
  const mov=(tramoId,tipo)=>movements.find(x=>x.tramo_id===tramoId&&x.tipo===tipo);
  const within=(s)=>s?.completado_en&&s?.ventana_desde&&s?.ventana_hasta?(new Date(s.completado_en)>=new Date(s.ventana_desde)&&new Date(s.completado_en)<=new Date(s.ventana_hasta)?'DENTRO':'FUERA'):s?.estado==='COMPLETADA'?'REGISTRADO':'PENDIENTE';

  async function canReports(){
    try{const {data,error}=await sb.rpc('sirro_puede_reportes');if(error)return isAudit();return !!data;}catch{return isAudit();}
  }
  async function loadFollowups(){try{followups=await fetchAll('seguimientos_postreferencia')}catch{followups=[]}}

  function buildBase(){
    return tramos.map(t=>{
      const c=caseOf(t.caso_id)||{};
      const o=byId(establishments,t.establecimiento_origen_id)||{};
      const d=byId(establishments,t.establecimiento_destino_id)||{};
      const f1=follow(t.id,1),f2=follow(t.id,2),f3=follow(t.id,3), cita=ce(t.id);
      const recibido=mov(t.id,'RECIBIDO')||mov(t.id,'TRAMO_RECIBIDO');
      const respondido=mov(t.id,'RESPUESTA_ENVIADA');
      const cerrado=mov(t.id,'TRAMO_CERRADO');
      const hospitalizado=t.estado_actual==='HOSPITALIZADO'||movements.some(m=>m.tramo_id===t.id&&String(m.tipo).includes('HOSPITAL'));
      const parto=f1?.fecha_base||f2?.fecha_base||f3?.fecha_base||'';
      const cumplidos=[f1,f2,f3].filter(x=>x?.estado==='COMPLETADA').length;
      return {
        codigo_referencia:c.codigo_visible||'',numero_tramo:t.numero_tramo||'',fecha_referencia:iso(t.creado_en),anio:t.creado_en?new Date(t.creado_en).getFullYear():'',mes:t.creado_en?new Date(t.creado_en).toISOString().slice(0,7):'',
        tipo_referencia:c.tipo||'',motivo:c.motivo||'',servicio:c.servicio_solicitado||c.servicio||'',estado_caso:c.estado_actual||'',estado_tramo:t.estado_actual||'',
        origen:o.nombre||'',rups_origen:o.codigo_rups||'',municipio_origen:nameMun(o.municipio_id),ecor_origen:nameEcor(o.ecor_id),destino:d.nombre||'',rups_destino:d.codigo_rups||'',municipio_destino:nameMun(d.municipio_id),ecor_destino:nameEcor(d.ecor_id),
        escalamiento:t.parent_tramo_id?'SI':'NO',hospitalizado:hospitalizado?'SI':'NO',fecha_recepcion:iso(recibido?.creado_en),fecha_respuesta:iso(respondido?.creado_en),fecha_cierre:iso(cerrado?.creado_en),horas_emision_recepcion:hrs(t.creado_en,recibido?.creado_en),horas_recepcion_respuesta:hrs(recibido?.creado_en,respondido?.creado_en),horas_totales_cierre:hrs(t.creado_en,cerrado?.creado_en),
        atencion_materna:c.motivo==='ATENCION_MATERNA'?'SI':'NO',fecha_hora_parto:iso(parto),
        control1_desde:iso(f1?.ventana_desde),control1_hasta:iso(f1?.ventana_hasta),control1_estado:f1?.estado||'',control1_realizado:iso(f1?.completado_en),control1_oportunidad:within(f1),
        control2_desde:iso(f2?.ventana_desde),control2_hasta:iso(f2?.ventana_hasta),control2_estado:f2?.estado||'',control2_realizado:iso(f2?.completado_en),control2_oportunidad:within(f2),
        control3_fecha:iso(f3?.ventana_desde),control3_estado:f3?.estado||'',control3_realizado:iso(f3?.completado_en),control3_oportunidad:within(f3),controles_puerperales_cumplidos:cumplidos,seguimiento_puerperal_completo:cumplidos===3?'SI':'NO',
        cita_ce_estado:cita?.estado||'',fecha_cita_ce:iso(cita?.fecha_cita)
      };
    });
  }

  const countBy=(rows,key)=>Object.entries(rows.reduce((a,r)=>{const k=r[key]||'Sin dato';a[k]=(a[k]||0)+1;return a;},{})).sort((a,b)=>b[1]-a[1]).map(([categoria,total])=>({categoria,total}));
  function currentReportRows(base,type){
    const f={
      escalamiento:r=>r.escalamiento==='SI',hospitalizado:r=>r.hospitalizado==='SI',externa:r=>String(r.rups_destino||'').startsWith('EXT-'),consulta_externa:r=>!!r.cita_ce_estado,pendiente:r=>!['CERRADO','CIERRE_ADMINISTRATIVO_EXTERNO','ANULADO'].includes(r.estado_tramo),cerrado:r=>r.estado_tramo==='CERRADO',materna:r=>r.atencion_materna==='SI',parto:r=>!!r.fecha_hora_parto,control1:r=>!!r.control1_estado,control2:r=>!!r.control2_estado,control3:r=>!!r.control3_estado,puerperal:r=>r.atencion_materna==='SI',perdida:r=>r.atencion_materna==='SI'&&r.seguimiento_puerperal_completo!=='SI',cobertura:r=>r.atencion_materna==='SI',continuidad:r=>r.atencion_materna==='SI',puerpera_hospital:r=>r.atencion_materna==='SI'&&r.hospitalizado==='SI'
    }[type];
    return f?base.filter(f):base;
  }
  function summaryFor(base,type){
    const rows=currentReportRows(base,type);
    if(['origen','destino','motivo','mes','ecor','estado'].includes(type))return countBy(rows,{origen:'origen',destino:'destino',motivo:'motivo',mes:'mes',ecor:'ecor_origen',estado:'estado_tramo'}[type]);
    if(type==='control1')return countBy(rows,'control1_oportunidad');
    if(type==='control2')return countBy(rows,'control2_oportunidad');
    if(type==='control3')return countBy(rows,'control3_oportunidad');
    if(type==='puerperal'||type==='cobertura'||type==='perdida'||type==='continuidad'||type==='puerpera_hospital')return countBy(rows,'controles_puerperales_cumplidos');
    if(type==='consulta_externa')return countBy(rows,'cita_ce_estado');
    if(type==='tiempos')return [{categoria:'Promedio emisión→recepción (h)',total:avg(rows,'horas_emision_recepcion')},{categoria:'Promedio recepción→respuesta (h)',total:avg(rows,'horas_recepcion_respuesta')},{categoria:'Promedio hasta cierre (h)',total:avg(rows,'horas_totales_cierre')}];
    return [{categoria:'Total',total:rows.length}];
  }
  const avg=(rows,key)=>{const v=rows.map(r=>Number(r[key])).filter(Number.isFinite);return v.length?Math.round(v.reduce((a,b)=>a+b,0)*100/v.length)/100:0};

  function ensureUI(){
    if(document.querySelector('[data-tab="reportes"]'))return;
    const nav=document.getElementById('tabs'); if(!nav)return;
    const b=document.createElement('button');b.dataset.tab='reportes';b.textContent='Reportes';nav.appendChild(b);
    const app=document.getElementById('appView');const s=document.createElement('section');s.id='tab-reportes';s.className='tabpane hidden';
    s.innerHTML=`<article class="card"><h2>Reportes SIRRO</h2><p class="muted">Reportes administrativos y obstétricos. La exportación analítica usa una fila por tramo y una variable por columna para facilitar filtros, tablas dinámicas y cruces.</p><div class="filters"><select id="sirroReportSelect"></select><button id="sirroRunReport" type="button">Generar reporte</button><button id="sirroExportExcel" type="button">Exportar base analítica Excel</button></div><div id="sirroReportResult" class="monitor" style="margin-top:12px"></div></article>`;
    app.appendChild(s);
    document.getElementById('sirroReportSelect').innerHTML=REPORTS.map((r,i)=>`<option value="${i}">${i+1}. ${r[0]}</option>`).join('');
    document.getElementById('sirroRunReport').onclick=renderSelected;
    document.getElementById('sirroExportExcel').onclick=exportExcel;
  }
  function renderSelected(){
    const i=Number(document.getElementById('sirroReportSelect')?.value||0),def=REPORTS[i],base=buildBase(),summary=summaryFor(base,def[1]);
    const table=`<div class="item"><strong>${def[0]}</strong><table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr><th style="text-align:left;border-bottom:1px solid #ddd;padding:6px">Categoría</th><th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">Total</th></tr></thead><tbody>${summary.map(x=>`<tr><td style="padding:6px;border-bottom:1px solid #eee">${esc(String(x.categoria))}</td><td style="padding:6px;text-align:right;border-bottom:1px solid #eee">${esc(String(x.total))}</td></tr>`).join('')}</tbody></table></div>`;
    document.getElementById('sirroReportResult').innerHTML=table;
  }

  async function ensureXLSX(){if(window.XLSX)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
  function dictRows(){return [
    ['codigo_referencia','Código SIRRO de la referencia'],['numero_tramo','Número de tramo dentro del caso'],['fecha_referencia','Fecha/hora de emisión'],['motivo','Motivo de referencia'],['origen','Establecimiento de origen'],['municipio_origen','Municipio de origen'],['ecor_origen','ECOR de origen'],['destino','Establecimiento destino'],['estado_tramo','Estado administrativo del tramo'],['hospitalizado','Paciente hospitalizada en el tramo'],['fecha_hora_parto','Fecha/hora del parto'],['control1_desde','Inicio ventana primer control (48 h)'],['control1_hasta','Fin ventana primer control (72 h)'],['control2_desde','Inicio segundo control (3 días)'],['control2_hasta','Fin segundo control (7 días)'],['control3_fecha','Tercer control (40 días)'],['control1_oportunidad','Cumplimiento de ventana del primer control'],['control2_oportunidad','Cumplimiento de ventana del segundo control'],['control3_oportunidad','Cumplimiento del tercer control'],['controles_puerperales_cumplidos','Número de controles puerperales completados'],['seguimiento_puerperal_completo','Tres controles completados'],['horas_emision_recepcion','Horas desde emisión hasta recepción'],['horas_recepcion_respuesta','Horas desde recepción hasta respuesta'],['horas_totales_cierre','Horas desde emisión hasta cierre']
  ].map(([variable,descripcion])=>({variable,descripcion}));}
  async function exportExcel(){
    try{
      await loadFollowups();await ensureXLSX();const base=buildBase();const wb=XLSX.utils.book_new();
      const add=(name,rows)=>{const ws=XLSX.utils.json_to_sheet(rows);ws['!autofilter']={ref:ws['!ref']||'A1:A1'};ws['!freeze']={xSplit:0,ySplit:1};XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));};
      add('BASE_ANALITICA',base);
      add('RESUMEN',[{indicador:'Referencias/tramos visibles',valor:base.length},{indicador:'Cerrados',valor:base.filter(r=>r.estado_tramo==='CERRADO').length},{indicador:'Atención materna',valor:base.filter(r=>r.atencion_materna==='SI').length},{indicador:'Seguimiento puerperal completo',valor:base.filter(r=>r.seguimiento_puerperal_completo==='SI').length}]);
      add('OBSTETRICIA',base.filter(r=>r.atencion_materna==='SI'));
      add('TIEMPOS',base.map(r=>({codigo_referencia:r.codigo_referencia,origen:r.origen,destino:r.destino,horas_emision_recepcion:r.horas_emision_recepcion,horas_recepcion_respuesta:r.horas_recepcion_respuesta,horas_totales_cierre:r.horas_totales_cierre})));
      add('ESTABLECIMIENTOS',countBy(base,'origen').map(x=>({establecimiento:x.categoria,total_referencias:x.total})));
      add('DICCIONARIO_VARIABLES',dictRows());
      XLSX.writeFile(wb,`SIRRO_base_analitica_${new Date().toISOString().slice(0,10)}.xlsx`);
    }catch(e){alert('No se pudo generar el Excel: '+(e?.message||e));}
  }

  async function start(){
    if(!await canReports())return;
    await loadFollowups();ensureUI();
    const original=window.refreshAll;
    if(original)window.refreshAll=async function(){await original();await loadFollowups();};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();