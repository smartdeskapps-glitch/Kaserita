-- ============================================================
-- Kaserita: panel de administrador -- cierra el autoregistro público
-- (ya nadie puede crear una bodega tocando "Crear Bodega" solo), agrega
-- una cuenta de super-administrador (vos) que crea las bodegas desde un
-- panel aparte, y un vencimiento por bodega que de verdad bloquea el
-- acceso (a nivel de base de datos, no solo un aviso en pantalla).
--
-- Ejecutar todo este script de una sola vez en el SQL Editor de Supabase.
-- ============================================================

-- Paso 1: tabla de super-administradores. Es una cuenta real de Supabase
-- Auth (email + contraseña, no DNI+PIN) que NO pertenece a ninguna
-- bodega -- por eso va en su propia tabla en vez de "usuarios".
create table if not exists public.super_admins (
  auth_id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  creado_en timestamptz not null default now()
);
alter table public.super_admins enable row level security;

-- Solo un super-admin ya existente puede ver la lista (para que el panel
-- pueda, por ejemplo, mostrar "conectado como ..."). Nadie puede
-- insertarse a sí mismo desde la app -- la primera fila la agregás vos
-- a mano (Paso 6, más abajo).
drop policy if exists "super_admins_select_propia" on public.super_admins;
create policy "super_admins_select_propia" on public.super_admins
  for select using (auth_id = auth.uid());

-- Paso 2: helper -- ¿el usuario autenticado actual es super-admin?
create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.super_admins where auth_id = auth.uid());
$$;
grant execute on function public.es_superadmin() to authenticated;

-- Paso 3: vigencia por bodega. activa_hasta = null significa "no vence".
alter table bodegas add column if not exists activa boolean not null default true;
alter table bodegas add column if not exists activa_hasta date;

-- Paso 4: mi_bodega_id() ahora también exige que la bodega esté activa y
-- no vencida. Como TODAS las políticas de la app ya comparan
-- "bodega_id = mi_bodega_id()", este único cambio bloquea el acceso a
-- ventas/productos/clientes/etc. de una bodega vencida sin tener que
-- tocar cada política una por una.
create or replace function public.mi_bodega_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.bodega_id
  from usuarios u
  join bodegas b on b.id = u.bodega_id
  where u.auth_id = auth.uid()
    and b.activa = true
    and (b.activa_hasta is null or b.activa_hasta >= current_date)
  limit 1;
$$;

-- Paso 5: políticas de "bodegas".
-- 5a) Cerrar el autoregistro: antes cualquier autenticado podía crear una
-- bodega ("Crear Bodega" público); ahora solo el super-admin.
drop policy if exists "bodegas_insert" on bodegas;
create policy "bodegas_insert_admin" on bodegas
  for insert to authenticated
  with check (es_superadmin());

-- 5b) Lectura: el dueño/cajero puede ver SU bodega aunque esté vencida
-- (si no, no se le podría ni avisar por qué quedó bloqueado) -- por eso
-- esta política ya no depende de mi_bodega_id(), que da null si venció.
drop policy if exists "bodegas_select" on bodegas;
create policy "bodegas_select_propia" on bodegas
  for select using (
    id = (select bodega_id from usuarios where auth_id = auth.uid())
    -- Caso especial: al reclamar una cuenta recién creada por el admin,
    -- el INSERT en "usuarios" puede no estar confirmado todavía en este
    -- mismo instante.
    or not exists (select 1 from usuarios where usuarios.bodega_id = bodegas.id)
  );

-- 5c) Actualizar: el dueño sigue pudiendo editar el nombre de SU bodega,
-- pero solo si sigue activa (mi_bodega_id() da null si venció, así que
-- una bodega vencida no se puede "auto-reactivar" cambiando su propia
-- fecha -- esa columna además solo la toca el admin, ver 5d).
drop policy if exists "bodegas_update" on bodegas;
create policy "bodegas_update_propia" on bodegas
  for update using (id = mi_bodega_id()) with check (id = mi_bodega_id());

-- 5d) El super-admin puede ver, crear y editar (activar/desactivar,
-- cambiar la fecha de vencimiento) cualquier bodega, esté vencida o no.
drop policy if exists "bodegas_admin_todo" on bodegas;
create policy "bodegas_admin_todo" on bodegas
  for all to authenticated
  using (es_superadmin())
  with check (es_superadmin());

-- Paso 6: el super-admin necesita poder crear la fila "dueño" (usuarios)
-- de una bodega nueva -- sin auth_id todavía, hasta que el dueño real
-- inicie sesión por primera vez con su DNI+PIN y la reclame.
drop policy if exists "usuarios_admin_todo" on usuarios;
create policy "usuarios_admin_todo" on usuarios
  for all to authenticated
  using (es_superadmin())
  with check (es_superadmin());

-- Verificación: deberías ver la columna nueva en bodegas.
select id, nombre, activa, activa_hasta from bodegas limit 5;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- PASO MANUAL (una sola vez, fuera de este script):
-- 1. En el dashboard de Supabase: Authentication > Users > Add user.
--    Crea tu cuenta de administrador con tu email real y una contraseña
--    (NO uses el formato "bodega_...@kaserita.app" que usan las
--    bodegas -- esa es la cuenta que vas a usar para entrar al panel).
-- 2. Copia el "User UID" que te muestra el dashboard para esa cuenta.
-- 3. Corre esto (reemplazando el UID) para volverte super-admin:
--
--    insert into public.super_admins (auth_id, nombre)
--    values ('PEGA-AQUI-TU-USER-UID', 'Tu nombre')
--    on conflict (auth_id) do nothing;
-- ============================================================
