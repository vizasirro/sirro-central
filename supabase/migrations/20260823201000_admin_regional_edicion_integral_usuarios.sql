CREATE OR REPLACE FUNCTION public.sirro_admin_update_user_profile_v2(
  p_usuario uuid,
  p_nombre text,
  p_identidad text,
  p_correo text,
  p_telefono text,
  p_cargo text,
  p_rol public.rol_usuario,
  p_ecor uuid DEFAULT NULL,
  p_municipio uuid DEFAULT NULL,
  p_establecimiento uuid DEFAULT NULL,
  p_tipo_usuario_hospital text DEFAULT NULL,
  p_especialidad text DEFAULT NULL,
  p_notificaciones_activas boolean DEFAULT true,
  p_reportes_habilitados boolean DEFAULT false,
  p_alcance_consulta text DEFAULT 'DEPARTAMENTO',
  p_permiso_centro_monitoria boolean DEFAULT false,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  me public.perfiles%rowtype;
  old public.perfiles%rowtype;
  est public.establecimientos%rowtype;
  ec public.ecor%rowtype;
  mun public.municipios%rowtype;
  v_tipo text;
  v_especialidad text;
  v_ecor uuid;
  v_municipio uuid;
  v_establecimiento uuid;
  v_alcance text;
  v_profile jsonb;
  v_admins integer;
BEGIN
  SELECT * INTO me FROM public.perfiles WHERE id=auth.uid();
  SELECT * INTO old FROM public.perfiles WHERE id=p_usuario;
  IF me.id IS NULL OR me.estado<>'ACTIVO' OR me.rol<>'ADMIN_REGIONAL' THEN RAISE EXCEPTION 'Solo el Administrador Regional activo puede editar usuarios'; END IF;
  IF old.id IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
  IF coalesce(length(trim(p_motivo)),0)=0 THEN RAISE EXCEPTION 'Motivo obligatorio'; END IF;
  IF coalesce(length(trim(p_nombre)),0)=0 OR coalesce(length(trim(p_identidad)),0)=0 OR coalesce(length(trim(p_correo)),0)=0 OR coalesce(length(trim(p_telefono)),0)=0 OR coalesce(length(trim(p_cargo)),0)=0 THEN RAISE EXCEPTION 'Nombre, identidad, correo, teléfono y cargo son obligatorios'; END IF;
  IF public.sirro_solo_digitos(p_identidad) !~ '^\d{13}$' THEN RAISE EXCEPTION 'La identidad debe tener 13 dígitos'; END IF;
  IF public.sirro_solo_digitos(p_telefono) !~ '^\d{8}$' THEN RAISE EXCEPTION 'El teléfono debe tener 8 dígitos'; END IF;
  IF trim(p_correo) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Correo inválido'; END IF;
  IF p_usuario=auth.uid() AND p_rol<>'ADMIN_REGIONAL' THEN RAISE EXCEPTION 'No puede quitarse a sí mismo el rol de Administrador Regional'; END IF;
  IF old.rol='ADMIN_REGIONAL' AND p_rol<>'ADMIN_REGIONAL' THEN SELECT count(*) INTO v_admins FROM public.perfiles WHERE rol='ADMIN_REGIONAL' AND estado='ACTIVO'; IF v_admins<=1 THEN RAISE EXCEPTION 'No puede cambiar el rol del último Administrador Regional activo'; END IF; END IF;
  IF p_establecimiento IS NOT NULL THEN SELECT * INTO est FROM public.establecimientos WHERE id=p_establecimiento AND activo=true; IF est.id IS NULL THEN RAISE EXCEPTION 'Establecimiento inexistente o inactivo'; END IF; END IF;
  IF p_ecor IS NOT NULL THEN SELECT * INTO ec FROM public.ecor WHERE id=p_ecor AND activo=true; IF ec.id IS NULL THEN RAISE EXCEPTION 'ECOR inexistente o inactivo'; END IF; END IF;
  IF p_municipio IS NOT NULL THEN SELECT * INTO mun FROM public.municipios WHERE id=p_municipio AND activo=true; IF mun.id IS NULL THEN RAISE EXCEPTION 'Municipio inexistente o inactivo'; END IF; END IF;
  v_ecor:=NULL; v_municipio:=NULL; v_establecimiento:=NULL;
  IF p_rol='ECOR' THEN IF ec.id IS NULL THEN RAISE EXCEPTION 'Seleccione un ECOR válido'; END IF; v_ecor:=p_ecor;
  ELSIF p_rol='JEFE_MUNICIPAL' THEN IF ec.id IS NULL OR mun.id IS NULL THEN RAISE EXCEPTION 'Seleccione ECOR y municipio válidos'; END IF; IF NOT EXISTS(SELECT 1 FROM public.establecimientos e WHERE e.activo=true AND e.tipo='US' AND e.ecor_id=p_ecor AND e.municipio_id=p_municipio) THEN RAISE EXCEPTION 'El municipio seleccionado no pertenece al ECOR indicado'; END IF; v_ecor:=p_ecor; v_municipio:=p_municipio;
  ELSIF p_rol='USUARIO_US' THEN IF est.id IS NULL OR est.tipo<>'US' OR est.es_externo_olancho THEN RAISE EXCEPTION 'Seleccione una Unidad de Salud válida'; END IF; v_ecor:=est.ecor_id; v_municipio:=est.municipio_id; v_establecimiento:=est.id;
  ELSIF p_rol='USUARIO_HOSPITAL' THEN IF est.id IS NULL OR est.tipo<>'HOSPITAL' OR est.es_externo_olancho THEN RAISE EXCEPTION 'Seleccione uno de los hospitales de Olancho'; END IF; v_municipio:=est.municipio_id; v_establecimiento:=est.id;
  ELSIF p_rol='AUDITOR_CONSULTA' THEN v_alcance:=coalesce(p_alcance_consulta,'DEPARTAMENTO'); IF v_alcance NOT IN ('ESTABLECIMIENTO','MUNICIPIO','ECOR','DEPARTAMENTO') THEN RAISE EXCEPTION 'Alcance de consulta inválido'; END IF; IF v_alcance='ESTABLECIMIENTO' THEN IF est.id IS NULL THEN RAISE EXCEPTION 'Seleccione un establecimiento válido para el alcance'; END IF; v_establecimiento:=est.id; ELSIF v_alcance='MUNICIPIO' THEN IF mun.id IS NULL THEN RAISE EXCEPTION 'Seleccione un municipio válido para el alcance'; END IF; v_municipio:=mun.id; ELSIF v_alcance='ECOR' THEN IF ec.id IS NULL THEN RAISE EXCEPTION 'Seleccione un ECOR válido para el alcance'; END IF; v_ecor:=ec.id; END IF;
  END IF;
  v_tipo:=NULL; v_especialidad:=NULL;
  IF p_rol='USUARIO_HOSPITAL' THEN v_tipo:=nullif(trim(coalesce(p_tipo_usuario_hospital,'')),''); IF v_tipo NOT IN ('MEDICO_ESPECIALISTA','MEDICO_GENERAL','LICENCIADA_ENFERMERIA','AUXILIAR_ENFERMERIA','ATENCION_PACIENTE_CITAS') THEN RAISE EXCEPTION 'Seleccione un tipo de usuario hospitalario válido'; END IF; IF v_tipo='MEDICO_ESPECIALISTA' THEN v_especialidad:=nullif(trim(coalesce(p_especialidad,'')),''); IF v_especialidad IS NULL THEN RAISE EXCEPTION 'La especialidad médica es obligatoria para Médico Especialista'; END IF; END IF; END IF;
  UPDATE public.perfiles SET nombre_completo=trim(p_nombre),identidad=public.sirro_solo_digitos(p_identidad),correo=lower(trim(p_correo)),telefono=public.sirro_solo_digitos(p_telefono),cargo_funcion=trim(p_cargo),rol=p_rol,ecor_id=v_ecor,municipio_id=v_municipio,establecimiento_id=v_establecimiento,tipo_usuario_hospital=v_tipo,especialidad=v_especialidad,notificaciones_activas=coalesce(p_notificaciones_activas,true),reportes_habilitados=coalesce(p_reportes_habilitados,false),alcance_consulta=CASE WHEN p_rol='AUDITOR_CONSULTA' THEN coalesce(v_alcance,'DEPARTAMENTO') ELSE 'DEPARTAMENTO' END,permiso_centro_monitoria=CASE WHEN p_rol='AUDITOR_CONSULTA' THEN coalesce(p_permiso_centro_monitoria,false) ELSE false END,actualizado_en=now() WHERE id=p_usuario;
  UPDATE public.jefe_municipal_ecor SET activo=false WHERE jefe_municipal_id=p_usuario AND activo=true;
  IF p_rol='JEFE_MUNICIPAL' THEN INSERT INTO public.jefe_municipal_ecor(jefe_municipal_id,ecor_id,activo,creado_por) VALUES(p_usuario,p_ecor,true,auth.uid()) ON CONFLICT (jefe_municipal_id,ecor_id) DO UPDATE SET activo=true,creado_por=excluded.creado_por,creado_en=now(); END IF;
  v_profile=jsonb_build_object('id',p_usuario,'name',trim(p_nombre),'role',p_rol,'level',p_rol,'active',old.estado='ACTIVO','ecor_id',v_ecor,'municipio_id',v_municipio,'establecimiento_id',v_establecimiento,'tipo_usuario_hospital',v_tipo,'especialidad',v_especialidad);
  UPDATE public.sirro_app_users SET profile=coalesce(profile,'{}'::jsonb)||v_profile,updated_at=now() WHERE auth_user_id=p_usuario;
  INSERT INTO public.auditoria(usuario_id,accion,tabla,registro_id,datos_anteriores,datos_nuevos,motivo) VALUES(auth.uid(),'EDITAR_USUARIO_INTEGRAL','perfiles',p_usuario::text,to_jsonb(old),jsonb_build_object('nombre_completo',trim(p_nombre),'identidad',public.sirro_solo_digitos(p_identidad),'correo',lower(trim(p_correo)),'telefono',public.sirro_solo_digitos(p_telefono),'cargo_funcion',trim(p_cargo),'rol',p_rol,'ecor_id',v_ecor,'municipio_id',v_municipio,'establecimiento_id',v_establecimiento,'tipo_usuario_hospital',v_tipo,'especialidad',v_especialidad,'notificaciones_activas',coalesce(p_notificaciones_activas,true),'reportes_habilitados',coalesce(p_reportes_habilitados,false),'alcance_consulta',CASE WHEN p_rol='AUDITOR_CONSULTA' THEN coalesce(v_alcance,'DEPARTAMENTO') ELSE 'DEPARTAMENTO' END,'permiso_centro_monitoria',CASE WHEN p_rol='AUDITOR_CONSULTA' THEN coalesce(p_permiso_centro_monitoria,false) ELSE false END),trim(p_motivo));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sirro_admin_update_user_profile_v2(uuid,text,text,text,text,text,public.rol_usuario,uuid,uuid,uuid,text,text,boolean,boolean,text,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sirro_admin_update_user_profile_v2(uuid,text,text,text,text,text,public.rol_usuario,uuid,uuid,uuid,text,text,boolean,boolean,text,boolean,text) TO authenticated;