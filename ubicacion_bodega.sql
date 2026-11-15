-- Punto exacto (latitud y longitud) del negocio, elegido con el pin del mapa en Mi link.
-- Ejecutar una sola vez en el SQL Editor de Supabase. Es seguro repetirlo.
--
-- Mientras no se ejecute, la app sigue funcionando: guarda la direccion escrita y avisa que
-- el punto exacto todavia no se pudo guardar.

alter table public.bodegas
  add column if not exists latitud  numeric(9,6),
  add column if not exists longitud numeric(9,6);

alter table public.bodegas drop constraint if exists bodegas_ubicacion_valida;
alter table public.bodegas add constraint bodegas_ubicacion_valida check (
  (latitud is null and longitud is null)
  or (latitud between -90 and 90 and longitud between -180 and 180)
);

-- El dueno no puede actualizar bodegas directo (RLS): igual que el resto de Mi link,
-- el unico camino es una funcion security definer limitada a SU bodega.
create or replace function public.actualizar_mi_ubicacion(
  p_latitud numeric,
  p_longitud numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bodega_id uuid := public.mi_bodega_id();
begin
  if v_bodega_id is null then
    raise exception 'No autorizado.';
  end if;
  if (p_latitud is null) <> (p_longitud is null) then
    raise exception 'La ubicacion necesita latitud y longitud.';
  end if;
  if p_latitud is not null and (p_latitud not between -90 and 90 or p_longitud not between -180 and 180) then
    raise exception 'La ubicacion no es valida.';
  end if;
  update bodegas
    set latitud = round(p_latitud, 6),
        longitud = round(p_longitud, 6)
    where id = v_bodega_id;
end;
$$;

revoke execute on function public.actualizar_mi_ubicacion(numeric, numeric) from public, anon;
grant execute on function public.actualizar_mi_ubicacion(numeric, numeric) to authenticated;

-- Aviso a PostgREST para que vea la funcion nueva sin reiniciar.
notify pgrst, 'reload schema';
