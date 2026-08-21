-- SIRRO: tiempos administrativos, reportes y puerperio
-- Cambio aditivo conforme a la regla de oro.

alter table public.perfiles
  add column if not exists tipo_usuario_hospital text,
  add column if not exists especialidad text,
  add column if not exists reportes_habilitados boolean not null default false;

alter table public.perfiles
  drop constraint if exists perfiles_tipo_usuario_hospital_check;
alter table public.perfiles
  add constraint perfiles_tipo_usuario_hospital_check
  check (tipo_usuario_hospital is null or tipo_usuario_hospital in ('MEDICO_ESPECIALISTA','MEDICO_GENERAL','LIC_ENFERMERIA','ATENCION_PACIENTE_CITAS'));

alter table public.perfiles
  drop constraint if exists perfiles_especialidad_coherencia_check;
alter table public.perfiles
  add constraint perfiles_especialidad_coherencia_check
  check (
    (tipo_usuario_hospital = 'MEDICO_ESPECIALISTA' and especialidad is not null and btrim(especialidad) <> '')
    or
    (tipo_usuario_hospital is distinct from 'MEDICO_ESPECIALISTA' and especialidad is null)
  );

insert into public.configuracion_sirro (clave, valor_numero, valor_texto, descripcion, modificado_por, modificado_en)
values
 ('URGENTE_ALERTA_AMARILLA_HORAS',1,null,'Referencia urgente sin confirmación de recepción: alerta amarilla en horas.',null,now()),
 ('URGENTE_ALERTA_ROJA_HORAS',2,null,'Referencia urgente sin confirmación de recepción: alerta roja/atrasada en horas.',null,now()),
 ('NO_URGENTE_ALERTA_AMARILLA_HORAS',12,null,'Referencia no urgente sin confirmación de recepción: alerta amarilla en horas.',null,now()),
 ('NO_URGENTE_ALERTA_ROJA_HORAS',24,null,'Referencia no urgente sin confirmación de recepción: alerta roja/atrasada en horas.',null,now()),
 ('LLEGADA_DECISION_ALERTA_AMARILLA_HORAS',2,null,'Paciente con llegada registrada pendiente de decisión médica: alerta amarilla en horas.',null,now()),
 ('LLEGADA_DECISION_ALERTA_ROJA_HORAS',4,null,'Paciente con llegada registrada pendiente de decisión médica: alerta roja/atrasada en horas.',null,now()),
 ('CE_CITA_ALERTA_AMARILLA_HORAS',24,null,'Consulta Externa pendiente de asignación de cita: alerta amarilla en horas.',null,now()),
 ('CE_CITA_ALERTA_ROJA_HORAS',48,null,'Consulta Externa pendiente de asignación de cita: alerta roja/atrasada en horas.',null,now()),
 ('EXAMEN_PROGRAMACION_ALERTA_AMARILLA_HORAS',24,null,'Examen/procedimiento pendiente de realizar o programar: alerta amarilla en horas.',null,now()),
 ('EXAMEN_PROGRAMACION_ALERTA_ROJA_HORAS',48,null,'Examen/procedimiento pendiente de realizar o programar: alerta roja/atrasada en horas.',null,now()),
 ('ALTA_CONTRARREFERENCIA_ALERTA_AMARILLA_HORAS',12,null,'Alta hospitalaria pendiente de contrarreferencia: alerta amarilla en horas.',null,now()),
 ('ALTA_CONTRARREFERENCIA_ALERTA_ROJA_HORAS',24,null,'Alta hospitalaria pendiente de contrarreferencia: alerta roja/atrasada en horas.',null,now()),
 ('CIERRE_EXTERNO_DIAS',30,null,'Plazo administrativo para cierre de referencia externa, en días.',null,now())
on conflict (clave) do update set
  valor_numero=excluded.valor_numero,
  descripcion=excluded.descripcion,
  modificado_en=now();

create table if not exists public.reglas_puerperales (
  codigo text primary key,
  orden smallint not null unique,
  nombre text not null,
  desde_horas integer,
  hasta_horas integer,
  dia_objetivo integer,
  descripcion text not null,
  constraint reglas_puerperales_ventana_check check (
    (desde_horas is not null and hasta_horas is not null and dia_objetivo is null and desde_horas <= hasta_horas)
    or
    (desde_horas is null and hasta_horas is null and dia_objetivo is not null)
  )
);

insert into public.reglas_puerperales (codigo,orden,nombre,desde_horas,hasta_horas,dia_objetivo,descripcion)
values
 ('PUERPERIO_CONTACTO_1',1,'Primer contacto puerperal',48,72,null,'Primer contacto puerperal entre 48 y 72 horas.'),
 ('PUERPERIO_CONTACTO_2',2,'Segundo contacto puerperal',72,168,null,'Segundo contacto puerperal entre 3 y 7 días.'),
 ('PUERPERIO_CONTACTO_3',3,'Tercer contacto puerperal',null,null,40,'Tercer contacto puerperal al día 40.')
on conflict (codigo) do update set
  orden=excluded.orden,
  nombre=excluded.nombre,
  desde_horas=excluded.desde_horas,
  hasta_horas=excluded.hasta_horas,
  dia_objetivo=excluded.dia_objetivo,
  descripcion=excluded.descripcion;

alter table public.reglas_puerperales enable row level security;
revoke all on public.reglas_puerperales from anon, authenticated;
grant select on public.reglas_puerperales to authenticated;

drop policy if exists reglas_puerperales_lectura_autenticados on public.reglas_puerperales;
create policy reglas_puerperales_lectura_autenticados
on public.reglas_puerperales for select
to authenticated
using (true);
