-- Reduce authenticated API surface by revoking legacy RPCs that have been superseded.
REVOKE EXECUTE ON FUNCTION public.actualizar_mis_preferencias(text,boolean) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crear_referencia(uuid,text,text,public.tipo_referencia,public.motivo_referencia,text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sirro_enviar_respuesta(uuid,text) FROM authenticated, anon, PUBLIC;
