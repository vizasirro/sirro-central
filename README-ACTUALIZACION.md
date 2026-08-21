# SIRRO Central — actualización Supabase

Archivos para reemplazar/agregar en el repositorio `vizasirro/sirro-central`.

## Archivos
- `index.html` — interfaz central.
- `app.js` — autenticación y lectura/escritura mediante Supabase.
- `config.js` — URL y clave pública (anon/publishable) de Supabase.
- `vercel.json` — configuración simple para Vercel.

## IMPORTANTE antes de publicar
Abra `config.js` y reemplace `PEGAR_AQUI_LA_ANON_KEY` por la **anon/public (publishable) key** del proyecto SIRRO.
Nunca coloque `service_role` ni una clave secreta en estos archivos.

La base actual ya contiene 191 establecimientos, perfiles, casos, tramos, movimientos y auditoría. La creación de una referencia usa la RPC `crear_referencia_sirro`; si esa función aún no está habilitada, la app NO guarda datos incompletos y muestra un aviso.

Este paquete elimina del flujo principal el uso de `localStorage` para usuarios y referencias.
# Revisión de punta a punta — 21 de agosto de 2026

- Se conserva íntegramente la funcionalidad existente conforme a la regla de oro.
- La referencia web utiliza `crear_referencia_v3` e incorpora contacto, servicio y diagnóstico.
- Se habilitan en la interfaz evaluación ambulatoria, rechazo, corrección y reenvío, respuesta directa o por cadena y notificaciones.
- Evaluación R/R usa movimientos históricos y la carga operativa deja de truncarse en 500/1,000 registros.
- El inicio de sesión resuelve el alias en el servidor; el correo del administrador deja de estar escrito en el código público.
- La creación de usuarios exige confirmar la contraseña.
- Se actualiza la caché PWA a `sirro-v020` sin eliminar archivos históricos del repositorio.
- Supabase: `sirro_enviar_respuesta_v2` dejó de ser ejecutable por usuarios anónimos y conserva acceso para usuarios autenticados.
- Se agrega recuperación de contraseña por correo desde “¿Olvidaste tu contraseña?” y formulario seguro para definir la nueva clave.
- Se incorpora el botón AYUDA con instrucciones paso a paso específicas para cada rol de SIRRO.
