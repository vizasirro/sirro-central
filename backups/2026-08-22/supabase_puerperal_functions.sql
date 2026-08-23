-- SIRRO · respaldo de funciones puerperales
-- Fecha: 2026-08-22
-- Punto de código asociado: 59793662d6b48eca0d75b88f8a7ac91ecf83f61d
-- Este archivo contiene solo definiciones de funciones; no incluye datos de pacientes.

CREATE OR REPLACE FUNCTION public.sirro_completar_control_puerperal_v2(p_tramo uuid, p_numero_control integer, p_fecha_control timestamp with time zone, p_observacion text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me public.perfiles;
  t public.tramos_referencia;
  c public.casos_referencia;
  s public.seguimientos_postreferencia;
  autorizado boolean:=false;
begin
  select * into me from public.perfiles where id=auth.uid();
  select * into t from public.tramos_referencia where id=p_tramo;
  if t.id is null then raise exception 'No se encontró el tramo'; end if;
  select * into c from public.casos_referencia where id=t.caso_id;
  if me.id is null or me.estado<>'ACTIVO' then raise exception 'No autorizado'; end if;
  if p_fecha_control is null or p_fecha_control > now() + interval '1 minute' then
    raise exception 'Fecha y hora del control inválidas';
  end if;

  if t.estado_actual::text='HOSPITALIZADO' then
    autorizado := me.rol::text='USUARIO_HOSPITAL' and me.establecimiento_id=t.establecimiento_destino_id;
  else
    autorizado := me.establecimiento_id=c.establecimiento_origen_inicial_id;
  end if;
  if not autorizado then raise exception 'Este control corresponde al establecimiento responsable actual'; end if;

  select * into s from public.seguimientos_postreferencia
   where tramo_id=p_tramo and tipo='PUERPERAL' and numero_control=p_numero_control for update;
  if s.id is null then raise exception 'No existe ese control puerperal para este tramo'; end if;
  if s.estado='COMPLETADA' then raise exception 'El control puerperal ya fue registrado'; end if;

  update public.seguimientos_postreferencia
     set estado='COMPLETADA',
         observacion=coalesce(nullif(trim(p_observacion),''),'Control puerperal realizado.'),
         responsable_establecimiento_id=me.establecimiento_id,
         completado_por=auth.uid(),
         completado_en=p_fecha_control,
         actualizado_en=now()
   where id=s.id;

  insert into public.auditoria(usuario_id,accion,tabla,registro_id,datos_nuevos,motivo)
  values(auth.uid(),'COMPLETAR_CONTROL_PUERPERAL','seguimientos_postreferencia',s.id::text,
         jsonb_build_object('numero_control',p_numero_control,'establecimiento_id',me.establecimiento_id,'fecha_hora_real_control',p_fecha_control,'registrado_en',now()),
         case when t.estado_actual::text='HOSPITALIZADO' then 'Paciente continúa hospitalizada: control realizado por el hospital.' else 'Control realizado por el establecimiento responsable posterior al alta.' end);
end;
$function$;

CREATE OR REPLACE FUNCTION public.sirro_registrar_parto(p_tramo uuid, p_fecha_parto timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me public.perfiles;
  t public.tramos_referencia;
  c public.casos_referencia;
  old_fecha timestamptz;
begin
  select * into me from public.perfiles where id=auth.uid();
  select * into t from public.tramos_referencia where id=p_tramo for update;
  if t.id is null then raise exception 'No se encontró el tramo'; end if;
  select * into c from public.casos_referencia where id=t.caso_id;
  if c.id is null then raise exception 'No se encontró el caso'; end if;
  if me.id is null or me.estado<>'ACTIVO' or me.rol::text<>'USUARIO_HOSPITAL' or me.establecimiento_id<>t.establecimiento_destino_id then
    raise exception 'No autorizado para registrar el parto';
  end if;
  if c.motivo::text<>'ATENCION_MATERNA' then raise exception 'El caso no corresponde a Atención Materna'; end if;
  if p_fecha_parto is null or p_fecha_parto > now() + interval '10 minutes' then raise exception 'Fecha y hora de parto inválidas'; end if;

  select fecha_base into old_fecha
  from public.seguimientos_postreferencia
  where tramo_id=p_tramo and tipo='PUERPERAL' and numero_control=1;

  insert into public.seguimientos_postreferencia
    (caso_id,tramo_id,tipo,numero_control,estado,fecha_base,ventana_desde,ventana_hasta,observacion,responsable_establecimiento_id,creado_por)
  values
    (c.id,p_tramo,'PUERPERAL',1,'PENDIENTE_CONTROL',p_fecha_parto,p_fecha_parto+interval '48 hours',p_fecha_parto+interval '72 hours',
     'Primer control puerperal: entre 48 y 72 horas desde la fecha y hora del parto.',t.establecimiento_destino_id,auth.uid())
  on conflict (tramo_id,tipo,(coalesce(numero_control,0))) do update
    set fecha_base=excluded.fecha_base,
        ventana_desde=excluded.ventana_desde,
        ventana_hasta=excluded.ventana_hasta,
        observacion=excluded.observacion,
        actualizado_en=now();

  insert into public.seguimientos_postreferencia
    (caso_id,tramo_id,tipo,numero_control,estado,fecha_base,ventana_desde,ventana_hasta,observacion,responsable_establecimiento_id,creado_por)
  values
    (c.id,p_tramo,'PUERPERAL',2,'PENDIENTE_CONTROL',p_fecha_parto,p_fecha_parto+interval '3 days',p_fecha_parto+interval '7 days',
     'Segundo control puerperal: entre los 3 y 7 días desde la fecha y hora del parto.',t.establecimiento_destino_id,auth.uid())
  on conflict (tramo_id,tipo,(coalesce(numero_control,0))) do update
    set fecha_base=excluded.fecha_base,
        ventana_desde=excluded.ventana_desde,
        ventana_hasta=excluded.ventana_hasta,
        observacion=excluded.observacion,
        actualizado_en=now();

  insert into public.seguimientos_postreferencia
    (caso_id,tramo_id,tipo,numero_control,estado,fecha_base,ventana_desde,ventana_hasta,observacion,responsable_establecimiento_id,creado_por)
  values
    (c.id,p_tramo,'PUERPERAL',3,'PENDIENTE_CONTROL',p_fecha_parto,p_fecha_parto+interval '40 days',p_fecha_parto+interval '40 days',
     'Tercer control puerperal: a los 40 días desde la fecha y hora del parto.',t.establecimiento_destino_id,auth.uid())
  on conflict (tramo_id,tipo,(coalesce(numero_control,0))) do update
    set fecha_base=excluded.fecha_base,
        ventana_desde=excluded.ventana_desde,
        ventana_hasta=excluded.ventana_hasta,
        observacion=excluded.observacion,
        actualizado_en=now();

  insert into public.auditoria(usuario_id,accion,tabla,registro_id,datos_anteriores,datos_nuevos,motivo)
  values(auth.uid(),case when old_fecha is null then 'REGISTRAR_PARTO' else 'MODIFICAR_FECHA_HORA_PARTO' end,
         'seguimientos_postreferencia',p_tramo::text,
         case when old_fecha is null then null else jsonb_build_object('fecha_hora_parto',old_fecha) end,
         jsonb_build_object(
           'fecha_hora_parto',p_fecha_parto,
           'control_1_desde',p_fecha_parto+interval '48 hours','control_1_hasta',p_fecha_parto+interval '72 hours',
           'control_2_desde',p_fecha_parto+interval '3 days','control_2_hasta',p_fecha_parto+interval '7 days',
           'control_3',p_fecha_parto+interval '40 days'),
         'Registro hospitalario de fecha y hora del parto; genera tres controles puerperales desde el parto.');
end;
$function$;
