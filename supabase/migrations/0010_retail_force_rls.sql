-- Same FORCE-RLS follow-up every module's migration needs (see 0004_finance_force_rls.sql,
-- 0007_policy_force_rls.sql) — Drizzle's .enableRLS() covers ENABLE, not FORCE.
alter table public.retail_outlets      force row level security;
alter table public.retail_daily_sales  force row level security;
