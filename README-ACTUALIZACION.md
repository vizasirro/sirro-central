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
