-- Same reasoning as the core tables in 0002_rls_support.sql: FORCE closes the table-owner RLS
-- bypass that's otherwise on by default. Drizzle's pgPolicy/.enableRLS() cover ENABLE, not FORCE,
-- so every module's migration needs this one follow-up statement per table — worth folding into
-- a single project-wide lint later (tracked), but hand-added for now like 0002 was for core.
alter table public.finance_pl_lines    force row level security;
alter table public.finance_gst_entries force row level security;
alter table public.finance_cost_audit  force row level security;
