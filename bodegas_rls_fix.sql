-- ============================================================
-- Kaserita: cierra el hueco de RLS en "bodegas" -- hoy cualquiera sin
-- sesión puede leer id + nombre de TODAS las bodegas (lo probamos con
-- la clave anon pública, sin login: devolvió la lista completa).
-- No expone ventas, clientes ni plata, pero sí el nombre de todos tus
-- clientes (bodegas) -- no debería ser público.
--
-- El login/registro de la app SIEMPRE consulta o crea "bodegas" DESPUÉS
-- de autenticarse (signIn/signUp ya resuelto), así que restringir esto
-- a "solo tu propia bodega, si ya iniciaste sesión" no rompe nada.
--
-- Ejecutar todo este script de una sola vez en el SQL Editor de Supabase.
-- ============================================================

do $$
begin
  raise exception 'SCRIPT HISTORICO BLOQUEADO: no correr bodegas_rls_fix.sql. Pisa mi_bodega_id() (vuelve a permitir acceso a bodegas vencidas) y reabre politicas de bodegas/usuarios. Estado correcto: seguridad_ronda3_restaurar_y_blindar.sql. Para usarlo en una base nueva, borra este bloque a mano.';
end $$;


-- Paso 1: diagnóstico -- mira esta lista ANTES de seguir. Si ves una
-- política con qual = "true" (o sin qual, aplicando a "public"/"anon"),
-- esa es la que deja pasar a cualquiera.
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'bodegas';

-- Paso 2: quita cualquier política abierta heredada (nombres típicos del
-- schema.sql original). El "if exists" no falla aunque ya no exista.
drop policy if exists "Permitir todo a anon en bodegas" on public.bodegas;
drop policy if exists "Enable read access for all users" on public.bodegas;
drop policy if exists "bodegas_select_publica" on public.bodegas;

-- Paso 3: política real -- solo puedes ver tu propia bodega, y solo si
-- iniciaste sesión (nada de acceso anónimo).
drop policy if exists "bodegas_select_propia" on public.bodegas;
create policy "bodegas_select_propia"
  on public.bodegas
  for select
  to authenticated
  using (id = mi_bodega_id());

-- Paso 4: crear una bodega nueva (registro) sigue abierto a cualquier
-- usuario ya autenticado -- en ese momento todavía no tiene fila en
-- "usuarios", así que mi_bodega_id() no aplica acá.
drop policy if exists "bodegas_insert_autenticado" on public.bodegas;
create policy "bodegas_insert_autenticado"
  on public.bodegas
  for insert
  to authenticated
  with check (true);

-- Paso 5: verifica que ya no exista ninguna política "using (true)" o
-- abierta a "anon"/"public" en esta tabla -- debería devolver 0 filas.
select policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'bodegas'
  and (qual = 'true' or 'anon' = any(roles) or 'public' = any(roles));

NOTIFY pgrst, 'reload schema';
