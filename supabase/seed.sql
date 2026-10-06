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

-- Second module (Policy & SOPs), on for acme only — proves the module pattern generalizes without
-- touching proxy.ts, the admin panel, or ModuleNav: registering it here is the whole job.
insert into public.modules (key, name, description, min_plan_tier)
values ('policy', 'Policies & SOPs', 'One place for every rule the business runs on', 'starter')
on conflict (key) do nothing;

insert into public.tenant_modules (tenant_id, module_key, enabled)
select id, 'policy', true from public.tenants where slug = 'acme'
on conflict (tenant_id, module_key) do nothing;

insert into public.policies (tenant_id, code, department, title, status, version, rule, detail, gaps, owner, source)
select id, 'FIN-GST-01', 'finance', 'GST recording basis', 'approved', 1,
  'Output and input GST are entered manually each month; not derived from a fixed ratio.',
  '["Input GST varies month to month.", "Targets are set GST-inclusive."]'::jsonb,
  '[{"field": "Historical basis", "prompt": "Were older months recorded ex-GST or inclusive?", "for": "finance", "answer": null}]'::jsonb,
  'Finance Lead', 'seed fixture'
from public.tenants where slug = 'acme';

-- Third module (Retail / Outlets) — on for acme only, same proof-of-pattern reasoning as Policy.
-- Two outlets and a few days of sales so /retail has something to show.
insert into public.modules (key, name, description, min_plan_tier)
values ('retail', 'Retail / Outlets', 'Store locations and daily sales, per outlet', 'pro')
on conflict (key) do nothing;

insert into public.tenant_modules (tenant_id, module_key, enabled)
select id, 'retail', true from public.tenants where slug = 'acme'
on conflict (tenant_id, module_key) do nothing;

insert into public.retail_outlets (tenant_id, code, name, city, manager_name)
select id, o.code, o.name, o.city, o.manager_name
from public.tenants,
     (values ('DHA-01', 'DHA Phase 5', 'Karachi', 'Bilal Ahmed'), ('LHE-01', 'MM Alam Road', 'Lahore', 'Sara Khan'))
       as o(code, name, city, manager_name)
where slug = 'acme'
on conflict (tenant_id, code) do nothing;

insert into public.retail_daily_sales (tenant_id, outlet_id, sale_date, net_sales, transactions, footfall, source)
select ro.tenant_id, ro.id, d.sale_date, d.net_sales, d.transactions, d.footfall, 'manual'
from public.retail_outlets ro
join (
  values
    ('DHA-01', date '2026-09-01', 160000::numeric, 21, 85),
    ('DHA-01', date '2026-09-02', 170000::numeric, 22, 90),
    ('DHA-01', date '2026-09-03', 180000::numeric, 23, 95),
    ('LHE-01', date '2026-09-01', 180000::numeric, 21, 85),
    ('LHE-01', date '2026-09-02', 190000::numeric, 22, 90),
    ('LHE-01', date '2026-09-03', 200000::numeric, 23, 95)
) as d(code, sale_date, net_sales, transactions, footfall) on d.code = ro.code
on conflict (outlet_id, sale_date) do nothing;
