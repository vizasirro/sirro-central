# Arquitectura de SIRRO

## Regla de oro para cambios

1. No retirar una función operativa sin confirmar su reemplazo.
2. No cambiar reglas clínicas, roles, permisos o tiempos como efecto colateral de una refactorización.
3. Toda operación nueva de Supabase debe pasar por `SIRRO.api` cuando el módulo ya use `sirro-core.js`.
4. Toda constante compartida debe definirse en `sirro-core.js` en lugar de duplicarse.
5. Las funciones `SECURITY DEFINER` deben validar identidad/rol en servidor y tener permisos mínimos.
6. Después de cada cambio: revisión estática, prueba de permisos y prueba del flujo afectado.

## Módulos actuales

- `index.html`: shell visual, formularios y carga explícita de módulos. Ya no contiene el bloque JavaScript principal en línea.
- `app-main.js`: autenticación, catálogos, referencias, usuarios, navegación y renderizado principal heredado de `index.html`.
- `sirro-core.js`: núcleo compartido. Roles, zona horaria, reglas constantes, acceso común a Supabase y normalización de errores.
- `followup.js`: seguimiento postreferencia, consulta externa y controles puerperales.
- `pendientes.js`: lista priorizada de acciones pendientes.
- `reportes.js`: reportes y vistas consolidadas.
- `admin-pruebas.js`: funciones exclusivas del modo de pruebas, incluido borrado individual de usuarios y reinicio general.
- `sw.js`: PWA/cache únicamente; no debe contener lógica de negocio.
- `tests/`: pruebas transaccionales y matrices de permisos por perfil.
- `supabase/migrations/`: historial reproducible de cambios de base.
- `supabase/functions/`: Edge Functions de servidor.

## Dirección de refactorización

La migración continúa de forma incremental, no como reescritura:

1. Mantener constantes compartidas en `sirro-core.js`.
2. Migrar llamadas directas `sb.rpc`, `sb.from` y `sb.functions.invoke` hacia `SIRRO.api` módulo por módulo.
3. Extraer de `app-main.js`, cuando exista cobertura de pruebas suficiente, autenticación, catálogos, referencias, usuarios y auditoría en archivos independientes.
4. Retirar RPC antiguas solo después de comprobar que no hay consumidores activos.

## Contratos que no deben romperse

- Zona horaria: `America/Tegucigalpa`.
- Controles puerperales: 48–72 horas, 3–7 días y 40 días desde fecha/hora del parto.
- `ADMIN_REGIONAL` no se elimina en modo de pruebas.
- La auditoría histórica se conserva aun cuando se elimine un usuario de prueba.
- La clave `service_role` nunca se expone en frontend.
- El frontend usa únicamente clave publishable.
- Supabase JS del navegador debe estar fijado a una versión exacta y validado por CI.

## Convenciones

- Roles: usar `SIRRO.constants.ROLES` en módulos migrados.
- Errores: usar `SIRRO.errors.message`.
- RPC: usar `SIRRO.api.rpc`.
- Edge Functions: usar `SIRRO.api.invoke`.
- Tablas: usar `SIRRO.api.table`.
- No capturar errores silenciosamente en flujos clínicos o administrativos.
- No introducir nuevas funciones globales salvo adaptadores temporales claramente documentados.
