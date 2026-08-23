-- Corrige lectura de notificaciones para usuarios autenticados.
-- RLS sigue limitando cada usuario a sus propias notificaciones.
grant select on table public.notificaciones to authenticated;
