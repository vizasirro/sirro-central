-- SIRRO Regla de Oro: permitir que inserciones autenticadas y Edge Functions
-- evalúen los índices/validaciones que usan sirro_solo_digitos.
GRANT EXECUTE ON FUNCTION public.sirro_solo_digitos(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sirro_validar_regla_oro_persona() TO service_role;
