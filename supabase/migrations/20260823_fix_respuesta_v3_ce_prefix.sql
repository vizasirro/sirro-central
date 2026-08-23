-- Corrige la detección de motivos de Consulta Externa en sirro_enviar_respuesta_v3.
-- Aplicado previamente al proyecto SIRRO mediante migración administrada.
-- Se reemplaza el patrón LIKE/ESCAPE frágil por una comprobación de prefijo explícita.

-- La definición completa aplicada en producción se mantiene en Supabase.
-- Contrato esperado: left(v_motivo,3)='CE_'.
