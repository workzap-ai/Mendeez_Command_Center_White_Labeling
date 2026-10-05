-- Local-dev fixtures only. Applied automatically by `supabase db reset`, never run against a
-- hosted project. Two tenants to exercise the Phase 1 "done when": sign up two users through the
-- app, then manually insert a tenant_memberships row for each (one per tenant) to finish wiring
-- them up for a cross-tenant isolation test — see apps/web/README (Local development) for the
-- exact steps, since a user row only exists after Supabase Auth creates it.

insert into public.tenants (slug, name, status)
values
  ('acme', 'Acme Retail', 'active'),
  ('zenith', 'Zenith Stores', 'active')
on conflict (slug) do nothing;

-- Module catalog + a plan that includes Finance — mirrors what Phase 3's Stripe sync will
-- eventually drive from a real subscription; for now it just lets the seed below enable the
-- module directly.
insert into public.modules (key, name, description, min_plan_tier)
values ('finance', 'Finance', 'P&L, GST reporting, cost audit', 'starter')
on conflict (key) do nothing;

insert into public.plans (key, name, included_modules)
values ('starter', 'Starter', array['finance'])
on conflict (key) do nothing;

-- Finance ON for acme, deliberately OFF for zenith — the concrete fixture for "flipping
-- tenant_modules.enabled makes /finance/* 404/restore with no redeploy" (Phase 2 "done when").
insert into public.tenant_modules (tenant_id, module_key, enabled)
select id, 'finance', true from public.tenants where slug = 'acme'
on conflict (tenant_id, module_key) do nothing;

insert into public.tenant_modules (tenant_id, module_key, enabled)
select id, 'finance', false from public.tenants where slug = 'zenith'
on conflict (tenant_id, module_key) do nothing;

-- A handful of P&L rows for acme so /finance/pl has something to show once a user is wired up.
insert into public.finance_pl_lines (tenant_id, fiscal_year, fiscal_month, line_item, amount, source)
select id, 2026, m.month, li.item, li.amount, 'manual'
from public.tenants,
     (values (8), (9)) as m(month),
     (values ('net_sales', 4200000::numeric), ('cogs', 1850000::numeric), ('admin_expense', 620000::numeric)) as li(item, amount)
where slug = 'acme';
