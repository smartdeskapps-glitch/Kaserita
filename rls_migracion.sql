-- ============================================================
-- Kaserita: RLS real por bodega usando Supabase Auth
-- Ejecutar todo este script de una sola vez en el SQL Editor de Supabase.
-- ============================================================

-- 1) Vincular cada fila de "usuarios" con su cuenta real de Supabase Auth.
alter table usuarios add column if not exists auth_id uuid references auth.users(id);
create unique index if not exists usuarios_auth_id_idx on usuarios(auth_id) where auth_id is not null;

-- 2) Helper: bodega del usuario autenticado actual (bypassa RLS internamente
--    para poder resolverlo sin recursión).
create or replace function public.mi_bodega_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select bodega_id from usuarios where auth_id = auth.uid() limit 1;
$$;

-- 3) Función de migración: verifica DNI+PIN contra la fila real (con
--    privilegios elevados, sin depender de que "usuarios" sea legible) y
--    vincula la cuenta de Auth recién creada por el cliente. Devuelve el
--    bodega_id si el DNI+PIN es correcto y la fila todavía no estaba
--    vinculada; NULL si no coincide.
create or replace function public.reclamar_cuenta_bodega(p_dni text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_bodega uuid;
begin
  select id, bodega_id into v_id, v_bodega from usuarios
    where dni = p_dni and pin_acceso = p_pin and auth_id is null
    limit 1;
  if v_id is null then
    return null;
  end if;
  update usuarios set auth_id = auth.uid() where id = v_id;
  return v_bodega;
end;
$$;

grant execute on function public.mi_bodega_id() to anon, authenticated;
grant execute on function public.reclamar_cuenta_bodega(text, text) to anon, authenticated;

-- 4) Activar RLS en todas las tablas y borrar cualquier política abierta
--    ("using (true)") que hubiera quedado de antes.
do $$
declare
  t text;
begin
  foreach t in array array['bodegas','usuarios','cajeros','categorias','clientes',
                            'productos','compras','compras_detalle','ventas',
                            'ventas_detalle','turnos_caja','mermas','pagos_credito']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

drop policy if exists "Lectura publica de categorias" on categorias;
drop policy if exists "Insertar categorias" on categorias;

-- 5) bodegas: cualquier usuario recién autenticado puede crear UNA bodega
--    (paso "Crear Bodega"); solo ve/edita la suya.
drop policy if exists "bodegas_insert" on bodegas;
drop policy if exists "bodegas_select" on bodegas;
drop policy if exists "bodegas_update" on bodegas;
create policy "bodegas_insert" on bodegas
  for insert with check (auth.uid() is not null);
create policy "bodegas_select" on bodegas
  for select using (
    id = mi_bodega_id()
    -- Al crear una bodega nueva, el INSERT usa RETURNING antes de que el
    -- dueño tenga fila en "usuarios" (mi_bodega_id() da NULL en ese
    -- instante) -- se permite ver una bodega sin usuarios todavía.
    or not exists (select 1 from usuarios where usuarios.bodega_id = bodegas.id)
  );
create policy "bodegas_update" on bodegas
  for update using (id = mi_bodega_id()) with check (id = mi_bodega_id());

-- 6) usuarios: cada quien ve su propia fila; el dueño/admin puede editar
--    (activar/desactivar, resetear PIN) a sus compañeros de bodega; el
--    insert permite tanto "fundar" una bodega nueva (todavía sin usuarios)
--    como agregar un compañero a la bodega propia.
drop policy if exists "usuarios_select_propia" on usuarios;
drop policy if exists "usuarios_insert" on usuarios;
drop policy if exists "usuarios_update_bodega" on usuarios;
create policy "usuarios_select_propia" on usuarios
  for select using (auth_id = auth.uid());
create policy "usuarios_insert" on usuarios
  for insert with check (
    bodega_id = mi_bodega_id()
    or not exists (select 1 from usuarios u2 where u2.bodega_id = usuarios.bodega_id)
  );
create policy "usuarios_update_bodega" on usuarios
  for update using (bodega_id = mi_bodega_id()) with check (bodega_id = mi_bodega_id());

-- 7) categorias: globales (bodega_id NULL) visibles para todos; las propias
--    de cada bodega solo las ve/crea esa bodega.
drop policy if exists "categorias_select" on categorias;
drop policy if exists "categorias_insert" on categorias;
create policy "categorias_select" on categorias
  for select using (bodega_id is null or bodega_id = mi_bodega_id());
create policy "categorias_insert" on categorias
  for insert with check (bodega_id = mi_bodega_id());

-- 8) Resto de tablas: todas quedan scoped 1:1 a la bodega del usuario
--    autenticado, tanto para leer como para escribir.
do $$
declare
  t text;
begin
  foreach t in array array['cajeros','clientes','productos','compras',
                            'compras_detalle','ventas','ventas_detalle',
                            'turnos_caja','mermas','pagos_credito']
  loop
    execute format('drop policy if exists "%1$s_select" on %1$I', t);
    execute format('drop policy if exists "%1$s_insert" on %1$I', t);
    execute format('drop policy if exists "%1$s_update" on %1$I', t);
    execute format('drop policy if exists "%1$s_delete" on %1$I', t);
    execute format('create policy "%1$s_select" on %1$I for select using (bodega_id = mi_bodega_id())', t);
    execute format('create policy "%1$s_insert" on %1$I for insert with check (bodega_id = mi_bodega_id())', t);
    execute format('create policy "%1$s_update" on %1$I for update using (bodega_id = mi_bodega_id()) with check (bodega_id = mi_bodega_id())', t);
    execute format('create policy "%1$s_delete" on %1$I for delete using (bodega_id = mi_bodega_id())', t);
  end loop;
end $$;
