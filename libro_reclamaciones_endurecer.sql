-- Kaserita: endurece el Libro de Reclamaciones contra spam y datos basura.
-- Ejecutar a mano en el SQL Editor de Supabase. No borra ni cambia reclamos
-- ya guardados (las restricciones se crean "not valid": solo se aplican a los
-- reclamos nuevos).
--
-- Cualquiera puede insertar sin sesión (es lo que pide un libro virtual), así
-- que el límite se pone en la base: el navegador solo puede ayudar un poco.

-- 1) Largos y formato mínimos (lo mismo que ya valida el formulario).
alter table public.libro_reclamaciones
  add constraint libro_reclamaciones_largos_chk check (
    char_length(nombre_completo) between 3 and 200
    and char_length(documento_identidad) between 8 and 20
    and char_length(email) between 5 and 200
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and char_length(detalle) between 5 and 5000
    and char_length(pedido) between 3 and 5000
    and char_length(codigo) between 8 and 30
    and (monto_reclamado is null or (monto_reclamado >= 0 and monto_reclamado <= 1000000))
  ) not valid;

-- 2) Límite de frecuencia: máximo 3 reclamos por correo cada 24 horas y
--    máximo 60 en total cada 10 minutos (corta una inundación de spam).
create or replace function public.libro_reclamaciones_limitar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.libro_reclamaciones
        where lower(email) = lower(new.email)
          and creado_en > now() - interval '24 hours') >= 3 then
    raise exception 'Ya registraste varios reclamos hoy. Escríbenos a smartdeskapps@smartdeskapps.com.'
      using errcode = 'P0001';
  end if;
  if (select count(*) from public.libro_reclamaciones
        where creado_en > now() - interval '10 minutes') >= 60 then
    raise exception 'Estamos recibiendo muchos envíos. Intenta de nuevo en unos minutos.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists libro_reclamaciones_limitar_trg on public.libro_reclamaciones;
create trigger libro_reclamaciones_limitar_trg
  before insert on public.libro_reclamaciones
  for each row execute function public.libro_reclamaciones_limitar();

-- La función solo la dispara el trigger: nadie debe poder llamarla suelta.
revoke execute on function public.libro_reclamaciones_limitar() from public, anon, authenticated;

notify pgrst, 'reload schema';
