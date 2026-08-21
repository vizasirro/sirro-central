-- SIRRO: corregir configuración de tiempos, permisos de reportes y endurecer EXECUTE

create or replace function public.sirro_admin_update_config(
  p_clave text,
  p_valor_numero numeric,
  p_valor_texto text default null,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  me public.perfiles;
  v_old public.configuracion_sirro%rowtype;
  v_allowed boolean := false;
  v_max numeric := 365;
begin
  select * into me from public.perfiles where id=auth.uid();
  if me.id is null or me.rol<>'ADMIN_REGIONAL' or me.estado<>'ACTIVO' then
    raise exception 'Solo Administrador Regional activo';
  end if;

  v_allowed := p_clave in (
    'dias_respuesta_ambulatoria','dias_cierre_referencia_externa',
    'URGENTE_ALERTA_AMARILLA_HORAS','URGENTE_ALERTA_ROJA_HORAS',
    'NO_URGENTE_ALERTA_AMARILLA_HORAS','NO_URGENTE_ALERTA_ROJA_HORAS',
    'LLEGADA_DECISION_ALERTA_AMARILLA_HORAS','LLEGADA_DECISION_ALERTA_ROJA_HORAS',
    'CE_CITA_ALERTA_AMARILLA_HORAS','CE_CITA_ALERTA_ROJA_HORAS',
    'EXAMEN_PROGRAMACION_ALERTA_AMARILLA_HORAS','EXAMEN_PROGRAMACION_ALERTA_ROJA_HORAS',
    'ALTA_CONTRARREFERENCIA_ALERTA_AMARILLA_HORAS','ALTA_CONTRARREFERENCIA_ALERTA_ROJA_HORAS',
    'CIERRE_EXTERNO_DIAS'
  );
  if not v_allowed then raise exception 'Configuración no permitida'; end if;
  if p_clave like '%_HORAS' then v_max := 720; else v_max := 365; end if;
  if p_valor_numero is null or p_valor_numero < 1 or p_valor_numero > v_max then
    raise exception 'Valor fuera de rango';
  end if;

  select * into v_old from public.configuracion_sirro where clave=p_clave;
  if v_old.clave is null then raise exception 'Configuración inexistente'; end if;

  update public.configuracion_sirro
  set valor_numero=p_valor_numero,
      valor_texto=coalesce(p_valor_texto,valor_texto),
      modificado_por=auth.uid(),
      modificado_en=now()
  where clave=p_clave;

  insert into public.auditoria(usuario_id,accion,tabla,registro_id,datos_anteriores,datos_nuevos,motivo)
  values(auth.uid(),'CAMBIO_CONFIGURACION','configuracion_sirro',p_clave,
    jsonb_build_object('valor_numero',v_old.valor_numero,'valor_texto',v_old.valor_texto),
    jsonb_build_object('valor_numero',p_valor_numero,'valor_texto',coalesce(p_valor_texto,v_old.valor_texto)),
    p_motivo);
end;
$function$;

create or replace function public.sirro_puede_reportes()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists(
    select 1 from public.perfiles p
    where p.id=auth.uid() and p.estado='ACTIVO'
      and (p.rol='ADMIN_REGIONAL' or (p.rol='AUDITOR_CONSULTA' and p.reportes_habilitados=true))
  );
$function$;

create or replace function public.sirro_admin_set_reportes(p_usuario uuid,p_habilitar boolean,p_motivo text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin public.perfiles%rowtype;
  v_target public.perfiles%rowtype;
begin
  select * into v_admin from public.perfiles where id=auth.uid();
  if v_admin.id is null or v_admin.rol<>'ADMIN_REGIONAL' or v_admin.estado<>'ACTIVO' then
    raise exception 'Solo el Administrador Regional activo puede cambiar este permiso';
  end if;
  select * into v_target from public.perfiles where id=p_usuario;
  if v_target.id is null then raise exception 'Usuario no encontrado'; end if;
  if v_target.rol<>'AUDITOR_CONSULTA' then raise exception 'Este permiso aplica únicamente a Auditor / Solo Consulta'; end if;

  update public.perfiles set reportes_habilitados=p_habilitar, actualizado_en=now() where id=p_usuario;
  insert into public.auditoria(usuario_id,accion,tabla,registro_id,datos_anteriores,datos_nuevos,motivo)
  values(auth.uid(),'CAMBIO_PERMISO_REPORTES','perfiles',p_usuario::text,
    jsonb_build_object('reportes_habilitados',v_target.reportes_habilitados),
    jsonb_build_object('reportes_habilitados',p_habilitar),
    coalesce(p_motivo,'Cambio de acceso a Reportes'));
end;
$function$;

create or replace function public.sirro_reporte_resumen(p_periodo text)
returns table(ecor_nombre text,total bigint,abiertas bigint,con_respuesta bigint,cerradas bigint,estancadas bigint)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz;
  me public.perfiles%rowtype;
begin
  select * into me from public.perfiles where id=auth.uid();
  if me.id is null or me.estado<>'ACTIVO' then raise exception 'Usuario no autorizado'; end if;
  if not public.sirro_puede_reportes() then raise exception 'Acceso no autorizado a reportes regionales SIRRO'; end if;

  v_inicio := case upper(p_periodo)
    when 'WEEK' then date_trunc('week',now())
    when 'MONTH' then date_trunc('month',now())
    when 'YTD' then date_trunc('year',now())
    else null end;
  if v_inicio is null then raise exception 'Periodo inválido. Use WEEK, MONTH o YTD'; end if;

  return query
  select coalesce(ec.nombre,'Sin ECOR')::text,
         count(*)::bigint,
         count(*) filter (where t.estado_actual not in ('CERRADO','CIERRE_ADMINISTRATIVO_EXTERNO','ANULADO','RECHAZADO'))::bigint,
         count(*) filter (where t.estado_actual in ('RESPUESTA_ENVIADA','RESPUESTA_RECIBIDA','CERRADO'))::bigint,
         count(*) filter (where t.estado_actual='CERRADO')::bigint,
         count(*) filter (where t.estado_actual not in ('CERRADO','CIERRE_ADMINISTRATIVO_EXTERNO','ANULADO','RECHAZADO','HOSPITALIZADO') and coalesce(t.fecha_limite_respuesta,coalesce(t.actualizado_en,t.creado_en)+interval '48 hours')<now())::bigint
  from public.tramos_referencia t
  join public.establecimientos eo on eo.id=t.establecimiento_origen_id
  join public.establecimientos ed on ed.id=t.establecimiento_destino_id
  left join public.ecor ec on ec.id=eo.ecor_id
  where t.creado_en>=v_inicio
    and (
      me.rol='ADMIN_REGIONAL'
      or (me.rol='AUDITOR_CONSULTA' and me.reportes_habilitados=true and (
        me.alcance_consulta='DEPARTAMENTO'
        or (me.alcance_consulta='ECOR' and (eo.ecor_id=me.ecor_id or ed.ecor_id=me.ecor_id))
        or (me.alcance_consulta='MUNICIPIO' and (eo.municipio_id=me.municipio_id or ed.municipio_id=me.municipio_id))
        or (me.alcance_consulta='ESTABLECIMIENTO' and (t.establecimiento_origen_id=me.establecimiento_id or t.establecimiento_destino_id=me.establecimiento_id))
      ))
    )
  group by coalesce(ec.nombre,'Sin ECOR')
  order by 1;
end;
$function$;

revoke all on function public.sirro_admin_update_config(text,numeric,text,text) from public, anon;
revoke all on function public.sirro_admin_set_reportes(uuid,boolean,text) from public, anon;
revoke all on function public.sirro_puede_reportes() from public, anon;
revoke all on function public.sirro_reporte_resumen(text) from public, anon;
grant execute on function public.sirro_admin_update_config(text,numeric,text,text) to authenticated;
grant execute on function public.sirro_admin_set_reportes(uuid,boolean,text) to authenticated;
grant execute on function public.sirro_puede_reportes() to authenticated;
grant execute on function public.sirro_reporte_resumen(text) to authenticated;

revoke all on function public.sirro_admin_configurar_invitado(uuid,text,uuid,uuid,uuid,boolean) from public, anon;
revoke all on function public.sirro_admin_reiniciar_datos_operativos(text) from public, anon;
revoke all on function public.sirro_admin_set_centro_monitoria(uuid,boolean) from public, anon;
revoke all on function public.sirro_admin_set_ecor_user_permission(uuid,boolean,text) from public, anon;
revoke all on function public.sirro_admin_set_user_estado(uuid,public.estado_usuario,text) from public, anon;
revoke all on function public.sirro_admin_update_user_profile(uuid,text,text,text,text,uuid,uuid,uuid,text) from public, anon;
grant execute on function public.sirro_admin_configurar_invitado(uuid,text,uuid,uuid,uuid,boolean) to authenticated;
grant execute on function public.sirro_admin_reiniciar_datos_operativos(text) to authenticated;
grant execute on function public.sirro_admin_set_centro_monitoria(uuid,boolean) to authenticated;
grant execute on function public.sirro_admin_set_ecor_user_permission(uuid,boolean,text) to authenticated;
grant execute on function public.sirro_admin_set_user_estado(uuid,public.estado_usuario,text) to authenticated;
grant execute on function public.sirro_admin_update_user_profile(uuid,text,text,text,text,uuid,uuid,uuid,text) to authenticated;
