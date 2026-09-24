-- ============================================================
-- Kaserita: cierra los huecos que mostró auditoria_seguridad_supabase.sql
-- (resultado del 2026-09-23). Ejecutar todo de una sola vez en el SQL
-- Editor de Supabase. Idempotente: se puede volver a correr.
--
-- 1) bodegas: seguían vivas "bodegas_insert" (cualquier usuario con sesión
--    podía crear bodegas) y "bodegas_update" (el dueño podía editar su
--    propia fila: activa, activa_hasta, delivery_permitido... o sea, darse
--    meses gratis). Vienen de rls_migracion.sql -- ese script las vuelve a
--    crear cada vez que se corre, y los scripts de cierre anteriores
--    borraban políticas con OTRO nombre ("bodegas_insert_autenticado",
--    "bodegas_update_propia"), por eso nunca quedaron cerradas. Ninguna
--    pantalla del POS las necesita: solo el panel de superadmin escribe en
--    "bodegas" (política bodegas_admin_todo, que no se toca) y el alta
--    pasa por admin_crear_bodega / crear_bodega_post_pago.
--
-- 2) usuarios_insert: seguía con la segunda condición "o la bodega no
--    tiene ningún usuario todavía", que dejaba insertar un usuario dueño
--    en cualquier bodega sin usuarios, incluso sin sesión (anon tiene el
--    GRANT de INSERT). Combinada con el punto 1 permitía crearse una
--    bodega propia sin pagar. Queda solo "bodega_id = mi_bodega_id()".
--    (Es lo mismo que intentaba cerrar_huecos_criticos_auth.sql.)
--
-- 3) Funciones que PostgreSQL deja ejecutar a PUBLIC por defecto aunque el
--    script solo las otorgue a "authenticated". Validan sesión por dentro
--    (probado: responden "No autorizado"), pero no hay motivo para que
--    anon pueda ni llamarlas. Las funciones que la vitrina de Delivery sí
--    usa sin sesión (obtener_*, bodega_admite_pedido_delivery,
--    puede_reclamar_bodega, reclamar_cuenta_bodega, mi_bodega_id,
--    es_superadmin, etc.) NO se tocan.
--
-- 4) libro_reclamaciones: el INSERT público es intencional (requisito
--    legal), pero no tenía límites: cualquiera podía mandar textos
--    gigantes, miles de filas, o incluso una "respuesta" ya cargada como
--    si la hubiera escrito la empresa. Ahora el trigger pisa
--    respuesta/respondido_en/creado_en, limita el largo de cada campo y
--    permite 5 reclamos por hora por conexión.
-- ============================================================

-- ------------------------------------------------------------
-- 1) bodegas
-- ------------------------------------------------------------
drop policy if exists "bodegas_insert" on public.bodegas;
drop policy if exists "bodegas_insert_autenticado" on public.bodegas;
drop policy if exists "bodegas_update" on public.bodegas;
drop policy if exists "bodegas_update_propia" on public.bodegas;

-- ------------------------------------------------------------
-- 2) usuarios
-- ------------------------------------------------------------
drop policy if exists "usuarios_insert" on public.usuarios;
create policy "usuarios_insert" on public.usuarios
  for insert with check (bodega_id = mi_bodega_id());

-- ------------------------------------------------------------
-- 3) EXECUTE: se busca por nombre (sin depender de la firma exacta)
-- ------------------------------------------------------------
do $$
declare
  f record;
begin
  -- RPC que solo usa gente con sesión.
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in (
        'admin_crear_bodega', 'admin_eliminar_bodega', 'admin_resetear_pin_bodega',
        'admin_vincular_producto_maestro', 'actualizar_mi_delivery',
        'cancelar_seguimiento_pedido', 'crear_bodega_post_pago',
        'marcar_pedido_listo', 'marcar_pedido_retirado'
      )
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;

  -- Funciones de trigger: el motor las dispara solo, nadie las llama.
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in ('crear_seguimiento_pedido', 'validar_pedido_delivery')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 4) libro_reclamaciones
-- ------------------------------------------------------------
alter table public.libro_reclamaciones add column if not exists ip_origen text;

create or replace function public.validar_reclamo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers json;
  v_ip text;
  v_recientes int;
begin
  -- Nada de esto lo decide quien envía el formulario.
  new.respuesta := null;
  new.respondido_en := null;
  new.creado_en := now();

  if char_length(coalesce(new.codigo, '')) > 40
     or char_length(coalesce(new.nombre_completo, '')) > 200
     or char_length(coalesce(new.documento_identidad, '')) > 30
     or char_length(coalesce(new.domicilio, '')) > 300
     or char_length(coalesce(new.telefono, '')) > 30
     or char_length(coalesce(new.email, '')) > 200
     or char_length(coalesce(new.bien_contratado, '')) > 300
     or char_length(coalesce(new.detalle, '')) > 5000
     or char_length(coalesce(new.pedido, '')) > 5000 then
    raise exception 'Alguno de los campos es demasiado largo.';
  end if;

  v_headers := coalesce(current_setting('request.headers', true), '{}')::json;
  v_ip := coalesce(
    nullif(trim(v_headers->>'cf-connecting-ip'), ''),
    nullif(trim(split_part(v_headers->>'x-forwarded-for', ',', -1)), ''),
    'desconocida'
  );

  select count(*) into v_recientes
    from libro_reclamaciones
    where ip_origen = v_ip and creado_en > now() - interval '1 hour';

  if v_recientes >= 5 then
    raise exception 'Enviaste varios reclamos seguidos. Intenta de nuevo en un rato.';
  end if;

  new.ip_origen := v_ip;
  return new;
end;
$$;

revoke execute on function public.validar_reclamo() from public, anon, authenticated;

drop trigger if exists validar_reclamo_trigger on public.libro_reclamaciones;
create trigger validar_reclamo_trigger
  before insert on public.libro_reclamaciones
  for each row execute function public.validar_reclamo();

-- ------------------------------------------------------------
-- Verificación 1: en "bodegas" solo deberían quedar SELECT propio y la
-- política de superadmin (ninguna de INSERT/UPDATE para dueños).
-- Verificación 2: usuarios_insert ya sin la rama "bodega sin usuarios".
-- ------------------------------------------------------------
select tablename, policyname, cmd, roles::text as roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and ((tablename = 'bodegas') or (tablename = 'usuarios' and cmd = 'INSERT'))
order by tablename, cmd, policyname;

NOTIFY pgrst, 'reload schema';
