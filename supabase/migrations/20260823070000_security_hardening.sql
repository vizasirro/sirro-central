-- SIRRO security hardening, 2026-08-23
-- 1) Remove implicit/public execution from SECURITY DEFINER functions.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS f
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.f);
  END LOOP;
END $$;

-- Intentional anonymous RPC required before authentication.
GRANT EXECUTE ON FUNCTION public.sirro_resolver_login_email(text) TO anon, authenticated;

-- New functions are private unless explicitly granted.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 2) Store the special reset key with bcrypt instead of MD5.
CREATE OR REPLACE FUNCTION public.sirro_configurar_clave_reinicio(p_clave text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE me public.perfiles;
BEGIN
  SELECT * INTO me FROM public.perfiles WHERE id=auth.uid();
  IF me.id IS NULL OR me.estado<>'ACTIVO' OR me.rol<>'ADMIN_REGIONAL' THEN
    RAISE EXCEPTION 'Solo el Administrador Regional activo puede configurar la clave de reinicio';
  END IF;
  IF coalesce(length(trim(p_clave)),0)<8 THEN
    RAISE EXCEPTION 'La clave especial debe tener al menos 8 caracteres';
  END IF;

  INSERT INTO public.configuracion_sirro(clave,valor_texto,descripcion,modificado_por,modificado_en)
  VALUES('clave_reinicio_pruebas',
         extensions.crypt(trim(p_clave),extensions.gen_salt('bf',12)),
         'Hash bcrypt de la clave especial para reinicio de datos de prueba SIRRO',
         auth.uid(),now())
  ON CONFLICT (clave) DO UPDATE
    SET valor_texto=excluded.valor_texto,
        descripcion=excluded.descripcion,
        modificado_por=auth.uid(),
        modificado_en=now();

  INSERT INTO public.auditoria(usuario_id,accion,tabla,registro_id,motivo,creado_en)
  VALUES(auth.uid(),'CONFIGURAR_CLAVE_REINICIO','configuracion_sirro','clave_reinicio_pruebas','Clave especial de reinicio configurada o cambiada con hash bcrypt',now());
END
$function$;

CREATE OR REPLACE FUNCTION public.sirro_reiniciar_datos_prueba(p_clave text)
RETURNS TABLE(casos_eliminados integer, tramos_eliminados integer, movimientos_eliminados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  me public.perfiles;
  v_hash text;
  v_casos integer;
  v_tramos integer;
  v_mov integer;
  v_users integer;
  v_ok boolean:=false;
BEGIN
  SELECT * INTO me FROM public.perfiles WHERE id=auth.uid();
  IF me.id IS NULL OR me.estado<>'ACTIVO' OR me.rol<>'ADMIN_REGIONAL' THEN
    RAISE EXCEPTION 'Solo el Administrador Regional activo puede reiniciar los datos de prueba';
  END IF;
  IF me.id <> 'e8e2f4c9-2bf1-4ade-82f0-2546b336fc9d'::uuid THEN
    RAISE EXCEPTION 'Solo el Administrador Regional principal puede ejecutar el reinicio general';
  END IF;

  SELECT valor_texto INTO v_hash FROM public.configuracion_sirro WHERE clave='clave_reinicio_pruebas';
  IF v_hash IS NULL THEN RAISE EXCEPTION 'Primero debe configurar la clave especial de reinicio'; END IF;

  IF v_hash LIKE '$2%' THEN
    v_ok := extensions.crypt(trim(coalesce(p_clave,'')),v_hash)=v_hash;
  ELSE
    -- One-time compatibility path for the historical MD5 hash.
    v_ok := md5(trim(coalesce(p_clave,'')))=v_hash;
    IF v_ok THEN
      UPDATE public.configuracion_sirro
         SET valor_texto=extensions.crypt(trim(p_clave),extensions.gen_salt('bf',12)),
             descripcion='Hash bcrypt de la clave especial para reinicio de datos de prueba SIRRO',
             modificado_por=auth.uid(),
             modificado_en=now()
       WHERE clave='clave_reinicio_pruebas';
    END IF;
  END IF;
  IF NOT v_ok THEN RAISE EXCEPTION 'Clave especial incorrecta'; END IF;

  SELECT count(*)::int INTO v_mov FROM public.movimientos_referencia;
  SELECT count(*)::int INTO v_tramos FROM public.tramos_referencia;
  SELECT count(*)::int INTO v_casos FROM public.casos_referencia;
  SELECT count(*)::int INTO v_users FROM auth.users WHERE id<>me.id;
  DELETE FROM public.notificaciones WHERE true;
  DELETE FROM public.movimientos_referencia WHERE true;
  DELETE FROM public.tramos_referencia WHERE true;
  DELETE FROM public.casos_referencia WHERE true;
  DELETE FROM public.jefaturas_unidad WHERE true;
  DELETE FROM public.jefe_municipal_ecor WHERE true;
  DELETE FROM public.sirro_app_users WHERE auth_user_id<>me.id;
  DELETE FROM public.login_aliases_sirro WHERE auth_email<>(SELECT email FROM auth.users WHERE id=me.id);
  UPDATE public.auditoria SET usuario_id=null WHERE usuario_id<>me.id;
  UPDATE public.ecor SET permiso_crear_usuarios_modificado_por=null WHERE permiso_crear_usuarios_modificado_por IS NOT NULL AND permiso_crear_usuarios_modificado_por<>me.id;
  UPDATE public.rutas_referencia SET creado_por=null WHERE creado_por IS NOT NULL AND creado_por<>me.id;
  UPDATE public.perfiles SET creado_por=null WHERE creado_por IS NOT NULL AND creado_por<>me.id;
  UPDATE public.configuracion_sirro SET modificado_por=me.id WHERE modificado_por IS NOT NULL AND modificado_por<>me.id;
  UPDATE public.configuracion_historial SET modificado_por=null WHERE modificado_por IS NOT NULL AND modificado_por<>me.id;
  DELETE FROM public.perfiles WHERE id<>me.id;
  DELETE FROM auth.users WHERE id<>me.id;

  INSERT INTO public.auditoria(usuario_id,accion,tabla,registro_id,motivo,datos_anteriores,creado_en)
  VALUES(me.id,'REINICIO_GENERAL_PRUEBAS','SIRRO','DATOS_PRUEBA','Se eliminaron referencias, tramos, movimientos, notificaciones y todos los usuarios excepto el Administrador Regional principal',jsonb_build_object('casos',v_casos,'tramos',v_tramos,'movimientos',v_mov,'usuarios',v_users),now());
  RETURN QUERY SELECT v_casos,v_tramos,v_mov;
END
$function$;

-- 3) Correct audit description for the current puerperal schedule.
CREATE OR REPLACE FUNCTION public.sirro_auditar_seguimiento_postreferencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.auditoria(usuario_id,accion,tabla,registro_id,datos_anteriores,datos_nuevos,motivo)
  VALUES(auth.uid(),tg_op,'seguimientos_postreferencia',coalesce(new.id,old.id)::text,
         CASE WHEN tg_op IN ('UPDATE','DELETE') THEN to_jsonb(old) ELSE null END,
         CASE WHEN tg_op IN ('INSERT','UPDATE') THEN to_jsonb(new) ELSE null END,
         CASE
           WHEN tg_op='INSERT' AND new.tipo='PUERPERAL' THEN 'Programación de control puerperal según ventana vigente (control 1: 48–72 horas; control 2: 3–7 días; control 3: 40 días)'
           WHEN tg_op='INSERT' AND new.tipo='CONSULTA_EXTERNA' THEN 'Registro de cita de Consulta Externa'
           WHEN tg_op='UPDATE' AND new.tipo='CONSULTA_EXTERNA' THEN 'Actualización de cita de Consulta Externa'
           WHEN tg_op='UPDATE' AND new.tipo='PUERPERAL' THEN 'Actualización de seguimiento puerperal'
           ELSE 'Seguimiento post-referencia'
         END);
  RETURN coalesce(new,old);
END
$function$;

-- Explicit access for replaced/exposed functions.
REVOKE EXECUTE ON FUNCTION public.sirro_configurar_clave_reinicio(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sirro_reiniciar_datos_prueba(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sirro_auditar_seguimiento_postreferencia() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sirro_configurar_clave_reinicio(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sirro_reiniciar_datos_prueba(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sirro_asignar_cita_ce(uuid,timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sirro_asignar_cita_ce(uuid,timestamp with time zone) TO authenticated;
