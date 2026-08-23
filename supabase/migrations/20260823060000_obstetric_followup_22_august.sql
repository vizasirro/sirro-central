-- SIRRO · Cierre de pendientes obstétricos autorizados el 22-08-2026
-- Mantiene la fecha/hora del parto como única fecha base de los tres controles puerperales.

create or replace function public.sirro_enviar_respuesta_v3(
  p_tramo uuid,
  p_detalle text,
  p_modo text default 'ORIGEN_TRAMO'::text,
  p_parto boolean default null::boolean,
  p_fecha_alta timestamp with time zone default null::timestamp with time zone,
  p_cita_estado text default null::text,
  p_fecha_cita timestamp with time zone default null::timestamp with time zone
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  t public.tramos_referencia;
  c public.casos_referencia;
  v_motivo text;
  v_estado_cita text;
begin
  select * into t from public.tramos_referencia where id=p_tramo;
  if t.id is null then raise exception 'No se encontró el tramo'; end if;
  select * into c from public.casos_referencia where id=t.caso_id;
  if c.id is null then raise exception 'No se encontró el caso'; end if;
  v_motivo:=c.motivo::text;

  -- Atención materna: desde el 22-08-2026 la programación puerperal NO se calcula
  -- desde el alta. La fecha/hora del parto se registra explícitamente mediante
  -- sirro_registrar_parto() y es la única fecha base para los controles 1, 2 y 3.
  if v_motivo='ATENCION_MATERNA' and p_parto is true then
    raise exception 'Registre primero la fecha y hora del parto en el módulo obstétrico. Los controles puerperales se calculan desde el parto, no desde el alta.';
  end if;

  if v_motivo like 'CE\\_%' escape '\\' then
    v_estado_cita:=upper(trim(coalesce(p_cita_estado,'')));
    if v_estado_cita not in ('PROGRAMADA','PENDIENTE_ASIGNACION') then
      raise exception 'Debe indicar si la cita de Consulta Externa está PROGRAMADA o PENDIENTE_ASIGNACION';
    end if;
    if v_estado_cita='PROGRAMADA' and p_fecha_cita is null then
      raise exception 'Debe registrar la fecha y hora de la cita de Consulta Externa';
    end if;
  end if;

  perform public.sirro_enviar_respuesta_v2(p_tramo,p_detalle,p_modo);

  if v_motivo like 'CE\\_%' escape '\\' then
    insert into public.seguimientos_postreferencia(caso_id,tramo_id,tipo,estado,fecha_cita,observacion,creado_por)
    values(c.id,p_tramo,'CONSULTA_EXTERNA',case when v_estado_cita='PROGRAMADA' then 'PROGRAMADA' else 'PENDIENTE_ASIGNACION' end,p_fecha_cita,
      case when v_estado_cita='PROGRAMADA' then 'Cita de Consulta Externa asignada en la respuesta.' else 'Cita de Consulta Externa pendiente de asignación.' end,auth.uid())
    on conflict (tramo_id,tipo) do update
      set estado=excluded.estado,fecha_cita=excluded.fecha_cita,observacion=excluded.observacion,actualizado_en=now();

    insert into public.notificaciones(usuario_id,caso_id,tramo_id,titulo,mensaje,critica)
    select p.id,c.id,p_tramo,
           case when v_estado_cita='PROGRAMADA' then 'Cita de Consulta Externa asignada' else 'Cita de Consulta Externa pendiente' end,
           case when v_estado_cita='PROGRAMADA'
             then 'Cita programada para '||to_char(p_fecha_cita at time zone 'America/Tegucigalpa','DD/MM/YYYY HH24:MI')||'.'
             else 'La referencia fue respondida, pero la cita de Consulta Externa quedó pendiente de asignación.' end,
           case when v_estado_cita='PENDIENTE_ASIGNACION' then true else false end
      from public.perfiles p
     where p.establecimiento_id=c.establecimiento_origen_inicial_id
       and p.estado='ACTIVO' and p.notificaciones_activas=true;
  end if;
end;
$function$;

revoke execute on function public.sirro_enviar_respuesta_v3(uuid,text,text,boolean,timestamptz,text,timestamptz) from public;
grant execute on function public.sirro_enviar_respuesta_v3(uuid,text,text,boolean,timestamptz,text,timestamptz) to authenticated;
