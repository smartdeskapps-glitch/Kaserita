-- ============================================================
-- Kaserita: numero de boleta distinto por bodega (2026-09-28)
-- Ejecutar a mano en el SQL Editor de Supabase. Aditivo: no borra nada.
--
-- Hoy TODAS las bodegas arman su boleta con la serie fija "B001" (ver
-- siguiente_correlativo en concurrencia_ronda2.sql) -- el conteo YA es
-- independiente por bodega (tabla correlativos_bodega, llave bodega_id +
-- serie), pero como la serie es siempre la misma letra/numero, dos bodegas
-- distintas emiten boletas que se VEN identicas ("B001-00000001" en ambas).
--
-- Este script agrega una serie propia por bodega (bodegas.serie_boleta):
--   1) La bodega mas antigua se queda con "B001" (no le cambia nada a sus
--      boletas ya emitidas).
--   2) Las demas bodegas existentes reciben B002, B003, ... en orden de
--      antiguedad.
--   3) Las bodegas nuevas reciben la siguiente serie libre automaticamente
--      (trigger), sin que el admin tenga que hacer nada.
--   4) Un unique constraint evita que dos bodegas terminen con la misma
--      serie por error.
--
-- El frontend (checkout) ya se actualizo en el commit correspondiente para
-- mandar bodega.serie_boleta en vez de la serie fija "B001".
-- ============================================================

alter table public.bodegas add column if not exists serie_boleta text;

-- Backfill: asigna series en orden de antiguedad, sin pisar una serie que
-- ya se haya puesto a mano.
with orden as (
  select id, row_number() over (order by creado_en, id) as n
  from public.bodegas
  where serie_boleta is null
)
update public.bodegas b
set serie_boleta = 'B' || lpad(o.n::text, 3, '0')
from orden o
where b.id = o.id;

alter table public.bodegas alter column serie_boleta set not null;
alter table public.bodegas alter column serie_boleta set default 'B001';

do $$
begin
  alter table public.bodegas add constraint bodegas_serie_boleta_check check (serie_boleta ~ '^[A-Z0-9]{2,6}$');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.bodegas add constraint bodegas_serie_boleta_uniq unique (serie_boleta);
exception
  when duplicate_object then null;
end $$;

-- Bodegas nuevas: si se crean sin serie_boleta explicita (o la default
-- "B001" ya esta tomada por otra), le asigna la siguiente libre sola.
create or replace function public.bodega_asignar_serie_boleta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  if new.serie_boleta is null or new.serie_boleta = ''
     or exists (select 1 from public.bodegas where serie_boleta = new.serie_boleta and id <> new.id) then
    select coalesce(max(substring(serie_boleta from '[0-9]+')::int), 0) into v_max from public.bodegas;
    new.serie_boleta := 'B' || lpad((v_max + 1)::text, 3, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bodega_asignar_serie_boleta on public.bodegas;
create trigger trg_bodega_asignar_serie_boleta
before insert on public.bodegas
for each row execute function public.bodega_asignar_serie_boleta();

NOTIFY pgrst, 'reload schema';

-- Verificacion: cada bodega con su serie (chequea que no se repita ninguna)
select id, nombre, serie_boleta, creado_en from public.bodegas order by creado_en, id;
