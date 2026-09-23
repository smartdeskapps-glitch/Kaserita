-- ============================================================
-- Kaserita: Libro de Reclamaciones virtual (requisito legal, Código de
-- Protección y Defensa del Consumidor / INDECOPI). Vive en reclamos.html,
-- fuera del POS -- cualquiera puede registrar un reclamo sin login.
--
-- Solo permite INSERT público (anon) -- nadie puede leer los reclamos de
-- otra persona desde el navegador. Para revisarlos, entra directo a esta
-- tabla desde el Table Editor de Supabase (con tu sesión de dueño del
-- proyecto), no hace falta una pantalla aparte por ahora.
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.libro_reclamaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre_completo text not null,
  documento_identidad text not null,
  domicilio text,
  telefono text,
  email text not null,
  es_menor_edad boolean not null default false,
  bien_contratado text,
  monto_reclamado numeric,
  tipo text not null check (tipo in ('reclamo', 'queja')),
  detalle text not null,
  pedido text not null,
  respuesta text,
  respondido_en timestamptz,
  creado_en timestamptz not null default now()
);

alter table public.libro_reclamaciones enable row level security;

-- Cualquiera (sin login) puede registrar un reclamo.
create policy libro_reclamaciones_insert_publico
  on public.libro_reclamaciones for insert
  to anon, authenticated
  with check (true);

-- Nadie puede leer, editar ni borrar reclamos desde el navegador (ni
-- siquiera el propio autor) -- solo se revisan desde el Table Editor de
-- Supabase con tu cuenta de dueño del proyecto.

NOTIFY pgrst, 'reload schema';
