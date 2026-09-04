-- ============================================================
-- Kaserita: días de crédito por cliente (para saber cuándo una
-- deuda está vencida). Ejecutar en el SQL Editor de Supabase.
-- ============================================================

alter table clientes add column if not exists dias_credito integer not null default 30;

NOTIFY pgrst, 'reload schema';
