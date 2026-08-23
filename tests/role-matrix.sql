-- Matriz de comprobación de visibilidad por perfil SIRRO.
-- Ejecutar dentro de una transacción y terminar con ROLLBACK.
-- No deja datos de prueba persistentes.

begin;
create temp table _reps as
select distinct on (rol) rol::text as rol,id
from public.perfiles where estado='ACTIVO' order by rol,id;
create temp table _role_test(
  rol text, uid uuid, casos int, tramos int, perfiles int,
  puede_reportes boolean, puede_monitoria boolean
);
grant select on _reps to authenticated;
grant insert,select on _role_test to authenticated;
set local role authenticated;
do $$
declare r record;
begin
  for r in select * from _reps loop
    perform set_config('request.jwt.claim.sub',r.id::text,true);
    insert into _role_test
    select r.rol,r.id,
      (select count(*) from public.casos_referencia),
      (select count(*) from public.tramos_referencia),
      (select count(*) from public.perfiles),
      coalesce(public.sirro_puede_reportes(),false),
      coalesce(public.sirro_puede_centro_monitoria(),false);
  end loop;
end$$;
select * from _role_test order by rol;
rollback;
