# CANDADO SIRRO

Contrato permanente de seguridad para SIRRO.

## Principio
Ninguna persona no autenticada puede acceder a información clínica, administrativa u operaciones protegidas de SIRRO. Ningún usuario autenticado puede superar los permisos de su perfil aunque manipule el navegador, JavaScript, URL o llamadas directas a Supabase.

## Reglas obligatorias
1. El frontend es público por naturaleza y nunca se considera frontera de seguridad.
2. Nunca se almacenan `service_role`, contraseñas de base de datos, tokens administrativos ni secretos privilegiados en HTML, JavaScript, PWA o repositorio público.
3. Toda escritura sensible debe validarse en servidor con identidad autenticada y, según corresponda, rol, estado, establecimiento y alcance.
4. Ocultar un botón no constituye autorización. La RPC, política RLS o función de servidor debe rechazar la operación no autorizada.
5. Las operaciones administrativas de Auth se ejecutan únicamente en servidor.
6. Las funciones `SECURITY DEFINER` deben usar `search_path` seguro, permisos EXECUTE mínimos y comprobaciones explícitas de autorización cuando procesen información protegida.
7. Las tablas con información protegida deben mantener RLS y políticas de mínimo privilegio.
8. El Administrador Regional no puede ser eliminado mediante el borrado individual de usuarios de prueba.
9. Las reglas clínicas y operativas existentes no se debilitan para implementar seguridad.
10. Todo cambio futuro debe superar las comprobaciones automáticas CANDADO SIRRO antes de integrarse en `main`.

## Excepción pública controlada
La resolución de alias de inicio de sesión puede ser accesible antes de autenticación únicamente para traducir un nombre de usuario a su identificador técnico de autenticación. No debe devolver contraseña, token, rol, datos clínicos ni privilegios.

## Verificación recomendada
Después de cambios de seguridad o permisos se debe comprobar, como mínimo, que un usuario US, Hospital, ECOR, Jefe Municipal y Auditor/Consulta no pueda ejecutar operaciones reservadas al Administrador Regional ni leer información fuera de su alcance autorizado.
