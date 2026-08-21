-- Preferencias individuales y cola segura para notificaciones por correo de SIRRO.
create table if not exists public.preferencias_notificacion_email (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  correo_activo boolean not null default false,
  nueva_referencia boolean not null default true,
  referencia_urgente boolean not null default true,
  respuesta_disponible boolean not null default true,
  referencia_rechazada boolean not null default true,
  referencia_secundaria boolean not null default true,
  cierre_administrativo boolean not null default true,
  alerta_amarilla boolean not null default true,
  alerta_roja boolean not null default true,
  actualizado_en timestamptz not null default now()
);

alter table public.preferencias_notificacion_email enable row level security;
revoke all on public.preferencias_notificacion_email from anon, authenticated;

create table if not exists public.cola_notificaciones_email (
  id uuid primary key default gen_random_uuid(),
  notificacion_id uuid not null unique references public.notificaciones(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  destinatario text not null,
  tipo text not null check (tipo in (
    'NUEVA_REFERENCIA','REFERENCIA_URGENTE','RESPUESTA_DISPONIBLE','REFERENCIA_RECHAZADA',
    'REFERENCIA_SECUNDARIA','CIERRE_ADMINISTRATIVO','ALERTA_AMARILLA','ALERTA_ROJA'
  )),
  asunto text not null,
  codigo_referencia text,
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','PROCESANDO','ENVIADO','ERROR')),
  intentos integer not null default 0,
  ultimo_error text,
  creada_en timestamptz not null default now(),
  procesada_en timestamptz,
  proximo_intento_en timestamptz not null default now()
);

create index if not exists idx_cola_email_pendiente
  on public.cola_notificaciones_email (estado, proximo_intento_en, creada_en);

alter table public.cola_notificaciones_email enable row level security;
revoke all on public.cola_notificaciones_email from anon, authenticated;

create or replace function public.sirro_mis_preferencias_email()
returns table (
  correo_activo boolean,
  nueva_referencia boolean,
  referencia_urgente boolean,
  respuesta_disponible boolean,
  referencia_rechazada boolean,
  referencia_secundaria boolean,
  cierre_administrativo boolean,
  alerta_amarilla boolean,
  alerta_roja boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  insert into public.preferencias_notificacion_email(usuario_id)
  values (auth.uid()) on conflict (usuario_id) do nothing;
  return query
  select p.correo_activo,p.nueva_referencia,p.referencia_urgente,p.respuesta_disponible,
         p.referencia_rechazada,p.referencia_secundaria,p.cierre_administrativo,
         p.alerta_amarilla,p.alerta_roja
  from public.preferencias_notificacion_email p where p.usuario_id=auth.uid();
end;
$$;

create or replace function public.sirro_actualizar_mis_preferencias_email(
  p_correo_activo boolean,
  p_nueva_referencia boolean,
  p_referencia_urgente boolean,
  p_respuesta_disponible boolean,
  p_referencia_rechazada boolean,
  p_referencia_secundaria boolean,
  p_cierre_administrativo boolean,
  p_alerta_amarilla boolean,
  p_alerta_roja boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not exists(select 1 from public.perfiles where id=auth.uid() and estado='ACTIVO') then
    raise exception 'Usuario inactivo o inexistente';
  end if;
  insert into public.preferencias_notificacion_email(
    usuario_id,correo_activo,nueva_referencia,referencia_urgente,respuesta_disponible,
    referencia_rechazada,referencia_secundaria,cierre_administrativo,alerta_amarilla,alerta_roja,actualizado_en
  ) values (
    auth.uid(),coalesce(p_correo_activo,false),coalesce(p_nueva_referencia,false),coalesce(p_referencia_urgente,false),
    coalesce(p_respuesta_disponible,false),coalesce(p_referencia_rechazada,false),coalesce(p_referencia_secundaria,false),
    coalesce(p_cierre_administrativo,false),coalesce(p_alerta_amarilla,false),coalesce(p_alerta_roja,false),now()
  )
  on conflict (usuario_id) do update set
    correo_activo=excluded.correo_activo,nueva_referencia=excluded.nueva_referencia,
    referencia_urgente=excluded.referencia_urgente,respuesta_disponible=excluded.respuesta_disponible,
    referencia_rechazada=excluded.referencia_rechazada,referencia_secundaria=excluded.referencia_secundaria,
    cierre_administrativo=excluded.cierre_administrativo,alerta_amarilla=excluded.alerta_amarilla,
    alerta_roja=excluded.alerta_roja,actualizado_en=now();
  insert into public.auditoria(usuario_id,accion,tabla,registro_id,motivo,datos_nuevos)
  values(auth.uid(),'ACTUALIZAR_PREFERENCIAS_CORREO','preferencias_notificacion_email',auth.uid()::text,
    'El usuario actualizó sus preferencias personales de correo',
    jsonb_build_object('correo_activo',coalesce(p_correo_activo,false)));
end;
$$;

revoke all on function public.sirro_mis_preferencias_email() from public, anon;
grant execute on function public.sirro_mis_preferencias_email() to authenticated;
revoke all on function public.sirro_actualizar_mis_preferencias_email(boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function public.sirro_actualizar_mis_preferencias_email(boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

create or replace function public.sirro_tipo_notificacion_email(p_titulo text, p_critica boolean)
returns text language sql immutable set search_path='' as $$
  select case
    when p_titulo ilike '%URGENTE%' then 'REFERENCIA_URGENTE'
    when p_titulo ilike '%rechaz%' then 'REFERENCIA_RECHAZADA'
    when p_titulo ilike '%secundaria%' or p_titulo ilike '%nivel superior%' then 'REFERENCIA_SECUNDARIA'
    when p_titulo ilike '%respuesta%' then 'RESPUESTA_DISPONIBLE'
    when p_titulo ilike '%cierre administrativo%' then 'CIERRE_ADMINISTRATIVO'
    when p_titulo ilike '%amarilla%' then 'ALERTA_AMARILLA'
    when p_titulo ilike '%roja%' then 'ALERTA_ROJA'
    else 'NUEVA_REFERENCIA'
  end
$$;

create or replace function public.sirro_encolar_notificacion_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_tipo text;
  v_pref public.preferencias_notificacion_email;
  v_correo text;
  v_codigo text;
  v_habilitada boolean;
begin
  select * into v_pref from public.preferencias_notificacion_email where usuario_id=new.usuario_id;
  if v_pref.usuario_id is null or not v_pref.correo_activo then return new; end if;
  select correo into v_correo from public.perfiles where id=new.usuario_id and estado='ACTIVO';
  if coalesce(trim(v_correo),'')='' then return new; end if;
  v_tipo:=public.sirro_tipo_notificacion_email(new.titulo,new.critica);
  v_habilitada:=case v_tipo
    when 'NUEVA_REFERENCIA' then v_pref.nueva_referencia
    when 'REFERENCIA_URGENTE' then v_pref.referencia_urgente
    when 'RESPUESTA_DISPONIBLE' then v_pref.respuesta_disponible
    when 'REFERENCIA_RECHAZADA' then v_pref.referencia_rechazada
    when 'REFERENCIA_SECUNDARIA' then v_pref.referencia_secundaria
    when 'CIERRE_ADMINISTRATIVO' then v_pref.cierre_administrativo
    when 'ALERTA_AMARILLA' then v_pref.alerta_amarilla
    when 'ALERTA_ROJA' then v_pref.alerta_roja
    else false end;
  if not v_habilitada then return new; end if;
  select codigo_visible into v_codigo from public.casos_referencia where id=new.caso_id;
  insert into public.cola_notificaciones_email(notificacion_id,usuario_id,destinatario,tipo,asunto,codigo_referencia)
  values(new.id,new.usuario_id,lower(trim(v_correo)),v_tipo,'SIRRO · '||new.titulo,v_codigo)
  on conflict (notificacion_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_encolar_notificacion_email on public.notificaciones;
create trigger trg_encolar_notificacion_email after insert on public.notificaciones
for each row execute function public.sirro_encolar_notificacion_email();
revoke all on function public.sirro_encolar_notificacion_email() from public, anon, authenticated;

create or replace function public.sirro_reclamar_correos_pendientes(p_limite integer default 25)
returns setof public.cola_notificaciones_email
language plpgsql security definer set search_path='' as $$
begin
  return query
  with elegidos as (
    select q.id from public.cola_notificaciones_email q
    where (q.estado in ('PENDIENTE','ERROR') and q.proximo_intento_en<=now())
       or (q.estado='PROCESANDO' and q.procesada_en<now()-interval '10 minutes')
    order by q.creada_en for update skip locked limit least(greatest(p_limite,1),100)
  )
  update public.cola_notificaciones_email q set estado='PROCESANDO',intentos=q.intentos+1,procesada_en=now()
  from elegidos e where q.id=e.id returning q.*;
end;
$$;
revoke all on function public.sirro_reclamar_correos_pendientes(integer) from public, anon, authenticated;
grant execute on function public.sirro_reclamar_correos_pendientes(integer) to service_role;

create or replace function public.sirro_resultado_correo(p_id uuid,p_enviado boolean,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.cola_notificaciones_email set
    estado=case when p_enviado then 'ENVIADO' else 'ERROR' end,
    ultimo_error=case when p_enviado then null else left(coalesce(p_error,'Error no especificado'),500) end,
    procesada_en=now(),
    proximo_intento_en=case when p_enviado then now() else now()+make_interval(mins=>least(60,greatest(5,intentos*5))) end
  where id=p_id;
end;
$$;
revoke all on function public.sirro_resultado_correo(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.sirro_resultado_correo(uuid,boolean,text) to service_role;
