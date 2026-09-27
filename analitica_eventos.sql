-- ============================================================
-- Kaserita: conteo anónimo de visitas a las páginas públicas (inicio y
-- registro) y de los dos clics que importan para saber si la landing
-- convierte: "Crear mi cuenta" y "Continuar por WhatsApp".
--
-- Ejecutar a mano en el SQL Editor de Supabase. Es ADITIVO: crea una
-- tabla y una función nuevas, no cambia nada existente.
--
-- Qué NO hace (a propósito, para que siga siendo cierto lo que dice
-- privacidad.html): no usa cookies, no arma un identificador por
-- visitante, no guarda IP ni user-agent, y no cruza visitas de la
-- misma persona entre páginas o visitas. Cada fila es solo "se abrió
-- esta página" o "se tocó este botón", con la fecha -- un conteo, no
-- un perfil. Cualquiera puede insertar (hace falta para que funcione
-- sin sesión), pero nadie puede leer la tabla directo: solo el
-- super-admin, a través de admin_resumen_analitica(), y siempre ya
-- agrupado por día (nunca fila por fila).
-- ============================================================

create table if not exists public.analitica_eventos (
  id bigint generated always as identity primary key,
  pagina text not null,
  evento text not null default 'vista',
  dato text,
  creado_en timestamptz not null default now()
);

create index if not exists analitica_eventos_pagina_fecha_idx
  on public.analitica_eventos (pagina, creado_en);

alter table public.analitica_eventos enable row level security;

-- Solo puede anotar páginas y eventos de una lista cerrada, y el dato
-- opcional (por ejemplo, qué plan eligió antes de escribir por
-- WhatsApp) no puede ser un texto largo -- evita que alguien use esto
-- para meter basura o algo distinto a lo pensado.
drop policy if exists "analitica_insertar" on public.analitica_eventos;
create policy "analitica_insertar" on public.analitica_eventos
  for insert to anon, authenticated
  with check (
    pagina in ('inicio', 'registro')
    and evento in ('vista', 'click_crear_cuenta', 'click_whatsapp')
    and (dato is null or length(dato) <= 60)
  );

revoke select, update, delete on public.analitica_eventos from anon, authenticated;

-- Resumen agrupado por día, página y evento -- lo que consume el panel
-- de administrador. Nunca devuelve filas individuales.
create or replace function public.admin_resumen_analitica(p_dias integer default 30)
returns table(fecha date, pagina text, evento text, total bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_superadmin() then
    raise exception 'No autorizado.';
  end if;
  if p_dias is null or p_dias < 1 or p_dias > 180 then
    p_dias := 30;
  end if;
  return query
    select date(e.creado_en) as fecha, e.pagina, e.evento, count(*) as total
    from public.analitica_eventos e
    where e.creado_en >= now() - (p_dias || ' days')::interval
    group by 1, 2, 3
    order by 1 desc, 2, 3;
end;
$$;

revoke all on function public.admin_resumen_analitica(integer) from public, anon;
grant execute on function public.admin_resumen_analitica(integer) to authenticated;

NOTIFY pgrst, 'reload schema';
