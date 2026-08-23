-- Prueba transaccional del flujo US -> Hospital -> US.
-- Requiere sustituir los UUID por usuarios/establecimientos de prueba vigentes.
-- Debe ejecutarse siempre dentro de BEGIN/ROLLBACK para no persistir datos.
-- Cobertura: crear -> enviar -> recibir -> evaluar -> responder -> confirmar y cerrar.

-- La ejecución validada el 23-08-2026 finalizó con caso y tramo en CERRADO
-- antes del ROLLBACK.
