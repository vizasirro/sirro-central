-- SIRRO modo de pruebas: borrado de usuarios individuales y reinicio general.
-- La función de reinicio conserva todos los perfiles ADMIN_REGIONAL y elimina
-- referencias/tramos/movimientos y usuarios de prueba.

create or replace function public.sirro_reiniciar_datos_prueba(p_clave text)
returns table(casos_eliminados integer, tramos_eliminados integer, movimientos_eliminados integer)
language plpgsql
security definer
set search_path=''
as $function$
declare
  me public.perfiles;
  v_hash text;
  v_casos integer;
  v_tramos integer;
  v_mov integer;
  v_users integer;
  v_user_ids uuid[];
begin
  select * into me from public.perfiles where id=auth.uid();
  if me.id is null or me.estado<>'ACTIVO' or me.rol<>'ADMIN_REGIONAL' then
    raise exception 'Solo el Administrador Regional activo puede reiniciar los datos de prueba';
  end if;

  select valor_texto into v_hash from public.configuracion_sirro where clave='clave_reinicio_pruebas';
  if v_hash is null then raise exception 'Primero debe configurar la clave especial de reinicio'; end if;
  if left(v_hash,4) in ('$2a$','$2b$','$2y$') then
    if extensions.crypt(trim(coalesce(p_clave,'')),v_hash)<>v_hash then raise exception 'Clave especial incorrecta'; end if;
  else
    if md5(trim(coalesce(p_clave,'')))<>v_hash then raise exception 'Clave especial incorrecta'; end if;
    update public.configuracion_sirro
       set valor_texto=extensions.crypt(trim(p_clave),extensions.gen_salt('bf',12)),
           descripcion='Clave especial para reinicio de datos de prueba SIRRO (bcrypt)',
           modificado_por=me.id,modificado_en=now()
     where clave='clave_reinicio_pruebas';
  end if;

  select array_agg(id),count(*)::int into v_user_ids,v_users from public.perfiles where rol<>'ADMIN_REGIONAL';
  select count(*)::int into v_mov from public.movimientos_referencia;
  select count(*)::int into v_tramos from public.tramos_referencia;
  select count(*)::int into v_casos from public.casos_referencia;

  delete from public.notificaciones;
  delete from public.movimientos_referencia;
  delete from public.tramos_referencia;
  delete from public.casos_referencia;
  delete from public.correlativos_caso;
  delete from public.jefaturas_unidad;
  delete from public.jefe_municipal_ecor;

  if coalesce(array_length(v_user_ids,1),0)>0 then
    delete from public.preferencias_notificacion_email where usuario_id=any(v_user_ids);
    delete from public.cola_notificaciones_email where usuario_id=any(v_user_ids);
    update public.auditoria set usuario_id=null where usuario_id=any(v_user_ids);
    update public.ecor set permiso_crear_usuarios_modificado_por=null where permiso_crear_usuarios_modificado_por=any(v_user_ids);
    update public.rutas_referencia set creado_por=null where creado_por=any(v_user_ids);
    update public.perfiles set creado_por=null where creado_por=any(v_user_ids);
    update public.configuracion_sirro set modificado_por=me.id where modificado_por=any(v_user_ids);
    update public.configuracion_historial set modificado_por=null where modificado_por=any(v_user_ids);
    delete from public.login_aliases_sirro where auth_email in (select email from auth.users where id=any(v_user_ids));
    delete from public.sirro_app_users where auth_user_id=any(v_user_ids);
    delete from public.perfiles where id=any(v_user_ids);
    delete from auth.users where id=any(v_user_ids);
  end if;

  insert into public.auditoria(usuario_id,accion,tabla,registro_id,motivo,datos_anteriores,creado_en)
  values(me.id,'REINICIO_GENERAL_PRUEBAS','SIRRO','DATOS_PRUEBA',
         'Se eliminaron referencias y todos los usuarios de prueba; se conservaron todos los Administradores Regionales.',
         jsonb_build_object('casos',v_casos,'tramos',v_tramos,'movimientos',v_mov,'usuarios_eliminados',coalesce(v_users,0)),now());

  return query select v_casos,v_tramos,v_mov;
end
$function$;

revoke execute on function public.sirro_reiniciar_datos_prueba(text) from public, anon;
grant execute on function public.sirro_reiniciar_datos_prueba(text) to authenticated;
