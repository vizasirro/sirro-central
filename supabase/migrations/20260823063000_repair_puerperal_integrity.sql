-- SIRRO · Reparación de integridad puerperal
-- 1) Completa controles 2/3 faltantes desde la fecha/hora del parto.
-- 2) Normaliza ventanas: C1 48–72 h, C2 3–7 d, C3 40 d.
-- 3) Retira acceso a la RPC antigua que usaba now().
-- 4) Impide cambiar la fecha/hora del parto si ya existe un control completado.

begin;

with bases as (
  select distinct on (tramo_id)
         tramo_id, caso_id, fecha_base, responsable_establecimiento_id, creado_por
    from public.seguimientos_postreferencia
   where tipo='PUERPERAL' and fecha_base is not null
   order by tramo_id, numero_control nulls last, creado_en
)
insert into public.seguimientos_postreferencia
  (caso_id,tramo_id,tipo,numero_control,estado,fecha_base,ventana_desde,ventana_hasta,observacion,responsable_establecimiento_id,creado_por)
select b.caso_id,b.tramo_id,'PUERPERAL',2,'PENDIENTE_CONTROL',b.fecha_base,
       b.fecha_base+interval '3 days',b.fecha_base+interval '7 days',
       'Segundo control puerperal: entre los 3 y 7 días desde la fecha y hora del parto.',
       b.responsable_establecimiento_id,b.creado_por
  from bases b
 where not exists (
   select 1 from public.seguimientos_postreferencia s
    where s.tramo_id=b.tramo_id and s.tipo='PUERPERAL' and s.numero_control=2
 );

with bases as (
  select distinct on (tramo_id)
         tramo_id, caso_id, fecha_base, responsable_establecimiento_id, creado_por
    from public.seguimientos_postreferencia
   where tipo='PUERPERAL' and fecha_base is not null
   order by tramo_id, numero_control nulls last, creado_en
)
insert into public.seguimientos_postreferencia
  (caso_id,tramo_id,tipo,numero_control,estado,fecha_base,ventana_desde,ventana_hasta,observacion,responsable_establecimiento_id,creado_por)
select b.caso_id,b.tramo_id,'PUERPERAL',3,'PENDIENTE_CONTROL',b.fecha_base,
       b.fecha_base+interval '40 days',b.fecha_base+interval '40 days',
       'Tercer control puerperal: a los 40 días desde la fecha y hora del parto.',
       b.responsable_establecimiento_id,b.creado_por
  from bases b
 where not exists (
   select 1 from public.seguimientos_postreferencia s
    where s.tramo_id=b.tramo_id and s.tipo='PUERPERAL' and s.numero_control=3
 );

update public.seguimientos_postreferencia
   set ventana_desde = case numero_control
         when 1 then fecha_base + interval '48 hours'
         when 2 then fecha_base + interval '3 days'
         when 3 then fecha_base + interval '40 days'
       end,
       ventana_hasta = case numero_control
         when 1 then fecha_base + interval '72 hours'
         when 2 then fecha_base + interval '7 days'
         when 3 then fecha_base + interval '40 days'
       end,
       observacion = case
         when estado='COMPLETADA' then observacion
         when numero_control=1 then 'Primer control puerperal: entre 48 y 72 horas desde la fecha y hora del parto.'
         when numero_control=2 then 'Segundo control puerperal: entre los 3 y 7 días desde la fecha y hora del parto.'
         when numero_control=3 then 'Tercer control puerperal: a los 40 días desde la fecha y hora del parto.'
         else observacion end,
       actualizado_en = now()
 where tipo='PUERPERAL' and fecha_base is not null and numero_control in (1,2,3);

insert into public.auditoria(usuario_id,accion,tabla,registro_id,datos_nuevos,motivo)
values(null,'REPARACION_INTEGRIDAD_PUERPERAL','seguimientos_postreferencia',null,
       jsonb_build_object('controles','1=48-72h, 2=3-7d, 3=40d','fecha_base','fecha/hora del parto'),
       'Corrección administrativa de registros heredados; se preservan estados y fechas reales de controles ya completados.');

revoke execute on function public.sirro_completar_control_puerperal(uuid,text,integer) from public;
revoke execute on function public.sirro_completar_control_puerperal(uuid,text,integer) from anon;
revoke execute on function public.sirro_completar_control_puerperal(uuid,text,integer) from authenticated;

create or replace function public.sirro_registrar_parto(p_tramo uuid, p_fecha_parto timestamp with time zone)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  me public.perfiles;
  t public.tramos_referencia;
  c public.casos_referencia;
  old_fecha timestamptz;
  tiene_completados boolean;
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

  select exists(
    select 1 from public.seguimientos_postreferencia
     where tramo_id=p_tramo and tipo='PUERPERAL' and estado='COMPLETADA'
  ) into tiene_completados;

  if old_fecha is not null and old_fecha is distinct from p_fecha_parto and tiene_completados then
    raise exception 'No se puede cambiar la fecha/hora del parto porque ya existe al menos un control puerperal completado. Solicite una corrección administrativa auditada.';
  end if;

  insert into public.seguimientos_postreferencia
    (caso_id,tramo_id,tipo,numero_control,estado,fecha_base,ventana_desde,ventana_hasta,observacion,responsable_establecimiento_id,creado_por)
  values
    (c.id,p_tramo,'PUERPERAL',1,'PENDIENTE_CONTROL',p_fecha_parto,p_fecha_parto+interval '48 hours',p_fecha_parto+interval '72 hours',
     'Primer control puerperal: entre 48 y 72 horas desde la fecha y hora del parto.',t.establecimiento_destino_id,auth.uid())
  on conflict (tramo_id,tipo,(coalesce(numero_control,0))) do update
    set fecha_base=excluded.fecha_base, ventana_desde=excluded.ventana_desde, ventana_hasta=excluded.ventana_hasta,
        observacion=case when public.seguimientos_postreferencia.estado='COMPLETADA' then public.seguimientos_postreferencia.observacion else excluded.observacion end,
        actualizado_en=now();

  insert into public.seguimientos_postreferencia
    (caso_id,tramo_id,tipo,numero_control,estado,fecha_base,ventana_desde,ventana_hasta,observacion,responsable_establecimiento_id,creado_por)
  values
    (c.id,p_tramo,'PUERPERAL',2,'PENDIENTE_CONTROL',p_fecha_parto,p_fecha_parto+interval '3 days',p_fecha_parto+interval '7 days',
     'Segundo control puerperal: entre los 3 y 7 días desde la fecha y hora del parto.',t.establecimiento_destino_id,auth.uid())
  on conflict (tramo_id,tipo,(coalesce(numero_control,0))) do update
    set fecha_base=excluded.fecha_base, ventana_desde=excluded.ventana_desde, ventana_hasta=excluded.ventana_hasta,
        observacion=case when public.seguimientos_postreferencia.estado='COMPLETADA' then public.seguimientos_postreferencia.observacion else excluded.observacion end,
        actualizado_en=now();

  insert into public.seguimientos_postreferencia
    (caso_id,tramo_id,tipo,numero_control,estado,fecha_base,ventana_desde,ventana_hasta,observacion,responsable_establecimiento_id,creado_por)
  values
    (c.id,p_tramo,'PUERPERAL',3,'PENDIENTE_CONTROL',p_fecha_parto,p_fecha_parto+interval '40 days',p_fecha_parto+interval '40 days',
     'Tercer control puerperal: a los 40 días desde la fecha y hora del parto.',t.establecimiento_destino_id,auth.uid())
  on conflict (tramo_id,tipo,(coalesce(numero_control,0))) do update
    set fecha_base=excluded.fecha_base, ventana_desde=excluded.ventana_desde, ventana_hasta=excluded.ventana_hasta,
        observacion=case when public.seguimientos_postreferencia.estado='COMPLETADA' then public.seguimientos_postreferencia.observacion else excluded.observacion end,
        actualizado_en=now();

  insert into public.auditoria(usuario_id,accion,tabla,registro_id,datos_anteriores,datos_nuevos,motivo)
  values(auth.uid(),case when old_fecha is null then 'REGISTRAR_PARTO' else 'MODIFICAR_FECHA_HORA_PARTO' end,
         'seguimientos_postreferencia',p_tramo::text,
         case when old_fecha is null then null else jsonb_build_object('fecha_hora_parto',old_fecha) end,
         jsonb_build_object('fecha_hora_parto',p_fecha_parto,
           'control_1_desde',p_fecha_parto+interval '48 hours','control_1_hasta',p_fecha_parto+interval '72 hours',
           'control_2_desde',p_fecha_parto+interval '3 days','control_2_hasta',p_fecha_parto+interval '7 days',
           'control_3',p_fecha_parto+interval '40 days'),
         'Registro hospitalario de fecha y hora del parto; genera tres controles puerperales desde el parto.');
end;
$function$;

revoke execute on function public.sirro_registrar_parto(uuid,timestamptz) from public;
revoke execute on function public.sirro_registrar_parto(uuid,timestamptz) from anon;
grant execute on function public.sirro_registrar_parto(uuid,timestamptz) to authenticated;

commit;
