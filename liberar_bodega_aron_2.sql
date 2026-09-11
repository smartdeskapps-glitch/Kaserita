-- ============================================================
-- Kaserita: desatasca de nuevo el DNI 49021764 -- la "Bodega Aron"
-- vieja se borró, pero como nunca llegó a reclamarse (login fallido
-- antes de aquel arreglo), su cuenta huérfana en Auth no se limpiaba
-- todavía (admin_eliminar_bodega solo borraba por auth_id vinculado).
-- Eso bloqueaba a la bodega "Aron" nueva, creada con el mismo DNI.
--
-- Seguro: solo borra la cuenta de ese correo si ningún usuario real
-- (bodega actual) la tiene vinculada todavía.
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

delete from auth.users au
where au.email = 'bodega_49021764@kaserita.app'
  and not exists (select 1 from usuarios u where u.auth_id = au.id);

select count(*) as cuentas_restantes from auth.users where email = 'bodega_49021764@kaserita.app';
