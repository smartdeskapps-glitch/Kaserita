-- ============================================================
-- Kaserita: pasar las cuentas que entran con DNI + PIN a "Continuar con Google".
--
-- Por qué: esas cuentas tienen como contraseña "kst-" + PIN (desde 4
-- caracteres). Sabiendo el DNI, alguien puede probar PINs directo contra
-- Supabase. Con Google no hay contraseña que adivinar.
--
-- Cómo queda: la fila del usuario en "usuarios" se desvincula de la cuenta
-- con PIN y se le pone el correo de Google. La próxima vez que esa persona
-- toque "Continuar con Google" en el POS con ESE correo,
-- reclamar_cuenta_por_correo() la vincula sola y entra a su misma bodega,
-- con todos sus datos. La cuenta con PIN queda bloqueada (no se borra).
--
-- NO SUBIR AL REPO con DNIs ni correos reales: se completa directo en el
-- SQL Editor.
-- ============================================================


-- ------------------------------------------------------------
-- PASO 1 (solo lectura): quiénes entran todavía con PIN.
-- Ejecutar solo este bloque y anotar a quién hay que pedirle su Gmail.
-- ------------------------------------------------------------
select b.nombre as bodega,
       u.nombre as persona,
       u.rol,
       u.dni,
       a.last_sign_in_at::date as ultimo_ingreso,
       u.email as correo_guardado,
       exists (select 1 from auth.identities i where i.user_id = a.id and i.provider = 'google') as ya_tiene_google
from public.usuarios u
join auth.users a on a.id = u.auth_id
join public.bodegas b on b.id = u.bodega_id
where a.email like 'bodega\_%@kaserita.app'
order by a.last_sign_in_at desc nulls last;


-- ------------------------------------------------------------
-- PASO 2: pasar a Google. Completar la lista (DNI, Gmail) y ejecutar
-- solo este bloque. Se puede hacer de a una persona o todas juntas.
-- Si algún dato no cuadra, se detiene y no cambia nada.
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_usuario uuid;
  v_auth uuid;
  v_correo text;
begin
  for r in
    select * from (values
      ('00000000', 'correo.de.la.persona@gmail.com')   -- <- reemplazar; una línea por persona
    ) as t(dni, correo)
  loop
    v_correo := lower(trim(r.correo));
    if v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'El correo "%" no es válido.', r.correo;
    end if;

    v_usuario := null;
    select u.id, u.auth_id into v_usuario, v_auth
      from public.usuarios u
      join auth.users a on a.id = u.auth_id
      where u.dni = r.dni and a.email = 'bodega_' || r.dni || '@kaserita.app';
    if v_usuario is null then
      raise exception 'No hay una cuenta con PIN para el DNI %.', r.dni;
    end if;

    if exists (select 1 from public.usuarios where lower(email) = v_correo and id <> v_usuario) then
      raise exception 'El correo % ya está asignado a otra persona.', v_correo;
    end if;

    -- 1) Desvincular y dejar el correo de Google para que se reclame sola.
    update public.usuarios set email = v_correo, auth_id = null where id = v_usuario;

    -- 2) Bloquear la cuenta con PIN y cerrar sus sesiones abiertas.
    update auth.users set banned_until = '2999-12-31' where id = v_auth;
    delete from auth.sessions where user_id = v_auth;

    raise notice 'DNI %: listo. Debe entrar con "Continuar con Google" usando %.', r.dni, v_correo;
  end loop;
end $$;


-- ------------------------------------------------------------
-- PASO 3 (solo lectura): comprobar. Las personas pasadas a Google
-- aparecen con "esperando_google = true" hasta que entren por primera vez
-- con Google; después, con su cuenta nueva vinculada.
-- ------------------------------------------------------------
select b.nombre as bodega, u.nombre as persona, u.email,
       (u.auth_id is null) as esperando_google
from public.usuarios u
join public.bodegas b on b.id = u.bodega_id
where u.email is not null and (u.auth_id is null
   or u.auth_id in (select user_id from auth.identities where provider = 'google'))
order by b.nombre;
