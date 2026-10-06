-- ============================================================
-- Kaserita: registro de errores de la aplicación (monitoreo propio).
--
-- Ejecutar a mano en el SQL Editor de Supabase. Es ADITIVO: crea una tabla y
-- dos funciones nuevas, no cambia nada existente.
--
-- Qué guarda: el mensaje del error, dónde ocurrió (pantalla/ruta), el último
-- botón que se tocó, el navegador y la fecha. NO guarda IP, correo, nombres ni
-- números largos (la app los quita antes de enviar). Se ve en el panel de
-- superadmin, pestaña "Errores".
--
-- Seguridad: cualquiera puede insertar (la app lo hace aunque no haya sesión),
-- pero con límites de largo y de origen; nadie puede leer la tabla directo: solo
-- el superadmin, a través de admin_listar_errores().
-- ============================================================

create table if not exists public.errores_app (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  bodega_id uuid,
  origen text not null default 'js',
  mensaje text not null,
  detalle text,
  accion text,
  ruta text,
  navegador text
);

create index if not exists errores_app_fecha_idx on public.errores_app (creado_en desc);

alter table public.errores_app enable row level security;

drop policy if exists "errores_app_insertar" on public.errores_app;
create policy "errores_app_insertar" on public.errores_app
  for insert to anon, authenticated
  with check (
    origen in ('js', 'promesa', 'render')
    and length(mensaje) between 1 and 400
    and (detalle is null or length(detalle) <= 1600)
    and (accion is null or length(accion) <= 80)
    and (ruta is null or length(ruta) <= 160)
    and (navegador is null or length(navegador) <= 160)
  );

revoke all on public.errores_app from anon, authenticated;
grant insert on public.errores_app to anon, authenticated;

-- El negocio lo pone el servidor (no lo manda el navegador, así nadie puede
-- atribuir un error a otro negocio).
create or replace function public.errores_app_poner_bodega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.bodega_id := mi_bodega_id();
  return new;
end;
$$;

drop trigger if exists errores_app_bodega on public.errores_app;
create trigger errores_app_bodega
  before insert on public.errores_app
  for each row execute function public.errores_app_poner_bodega();

-- Lista agrupada: un mismo error repetido aparece una vez, con cuántas veces y
-- cuándo fue la última. Solo superadmin.
create or replace function public.admin_listar_errores(p_dias integer default 14)
returns table(
  mensaje text, origen text, accion text, ruta text, navegador text, detalle text,
  veces bigint, negocios bigint, ultima timestamptz, primera timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_superadmin() then
    raise exception 'No autorizado.';
  end if;
  if p_dias is null or p_dias < 1 or p_dias > 90 then
    p_dias := 14;
  end if;
  return query
    select e.mensaje, e.origen,
           (array_agg(e.accion order by e.creado_en desc))[1],
           (array_agg(e.ruta order by e.creado_en desc))[1],
           (array_agg(e.navegador order by e.creado_en desc))[1],
           (array_agg(e.detalle order by e.creado_en desc))[1],
           count(*), count(distinct e.bodega_id),
           max(e.creado_en), min(e.creado_en)
    from public.errores_app e
    where e.creado_en >= now() - (p_dias || ' days')::interval
    group by e.mensaje, e.origen
    order by max(e.creado_en) desc
    limit 100;
end;
$$;

-- Borra los errores ya revisados (todos, o los de más de N días). Solo superadmin.
create or replace function public.admin_limpiar_errores(p_mas_de_dias integer default 0)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not es_superadmin() then
    raise exception 'No autorizado.';
  end if;
  delete from public.errores_app
   where creado_en < now() - (greatest(coalesce(p_mas_de_dias, 0), 0) || ' days')::interval;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.admin_listar_errores(integer) from public, anon;
revoke all on function public.admin_limpiar_errores(integer) from public, anon;
grant execute on function public.admin_listar_errores(integer) to authenticated;
grant execute on function public.admin_limpiar_errores(integer) to authenticated;

NOTIFY pgrst, 'reload schema';

-- Verificación: debe devolver 0 filas y no dar error (eres superadmin).
-- select * from public.admin_listar_errores(14);
