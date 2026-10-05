-- Same FORCE-RLS follow-up every module's migration needs (see 0004_finance_force_rls.sql) —
-- Drizzle's .enableRLS() covers ENABLE, not FORCE.
alter table public.policies force row level security;
