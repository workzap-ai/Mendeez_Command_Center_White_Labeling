# Commerce Center Platform

A multi-tenant, white-label SaaS platform: one deployment serves every customer (tenant),
identified by subdomain or custom domain, with per-tenant branding and per-tenant module
on/off switches controlled by a platform-owner super-admin. This is a **new, separate codebase**
— it does not touch the existing single-tenant Mendeez dashboard repo, which keeps running in
production untouched. Mendeez becomes "tenant #1" here in a later migration phase.

Stack: **Next.js (App Router) + Supabase (Postgres + Auth + Storage) + Drizzle** (schema/migrations
only, chosen specifically for colocating RLS policies with table definitions) + Stripe (Phase 3+).

## Status: Phase 1–4 built and live-verified end to end, plus a second module (Policy) proving the pattern generalizes. Phase 5 (Mendeez migration) deliberately not started. Pushed to GitHub: `workzap-ai/Mendeez_Command_Center_White_Labeling`.

**Phase 1 — platform skeleton**: tenant resolution (`proxy.ts`), core DB schema + RLS
(`db/schema/core.ts`), Supabase Auth wiring (custom JWT claim hook), module registry/guard
scaffolding, bare sign-in/sign-up, tenant-not-found/suspended status pages.

**Phase 2 — Finance module (the reference implementation)**: `modules/finance/` — manifest, three
tenant-scoped tables (`finance_pl_lines`, `finance_gst_entries`, `finance_cost_audit`, modeled as
fact tables with a period dimension rather than the old dashboard's parallel-arrays-by-year JSON
shape — see the schema file's own comment for why), a P&L page at `/finance/pl` gated by
`requireModule()`, and a generic `ModuleNav` that renders only a tenant's enabled modules. Also
added: `scripts/check-rls-coverage.mjs` (`npm run check:rls`) — fails the build if any tenant-
scoped table is missing its RLS policy or FORCE RLS anywhere in the migration history, the one
safeguard the architecture plan called out as highest-leverage against an accidental cross-tenant
leak. Seed data (`supabase/seed.sql`) now turns Finance ON for `acme` and OFF for `zenith`, with a
few P&L rows for acme, specifically to exercise Phase 2's "done when": toggling
`tenant_modules.enabled` makes `/finance/*` 404/restore with no redeploy.

**Phase 3 — super-admin + billing**: `/admin` (bare platform host, gated by `requirePlatformAdmin()`
in `lib/auth/platform-admin.ts`, checking `users.is_platform_admin` — separate sign-in at
`/admin/sign-in` since the tenant one requires a resolved tenant the bare admin host never has).
`/admin/tenants` lists every tenant and can create one; `/admin/tenants/[id]` has the module
on/off grid (same `tenant_modules` the tenant side reads) and a plan-assignment dropdown. Server
actions (`app/admin/(dashboard)/actions.ts`) all go through the service-role admin client — the
one deliberate cross-tenant RLS bypass outside `resolve_tenant_by_host()`, gated on
`is_platform_admin` in code, not a DB role. `lib/billing/syncModulesFromPlan.ts` is the shared
logic a plan change runs (additions apply immediately, removals are deliberately left alone — see
its header comment for the reasoning) — called from both the admin UI's plan-assign action and the
Stripe webhook, so a manual override and a paid upgrade behave the same way.
`app/api/webhooks/stripe/route.ts` handles `customer.subscription.created|updated|deleted` and
`invoice.payment_failed`. **Not live-tested** — no Stripe account/test keys were available this
session; run it against `stripe listen --forward-to localhost:3000/api/webhooks/stripe` before
trusting it. One real bug found and fixed while wiring this up: `lib/billing/stripe.ts` used to
throw at import time if `STRIPE_SECRET_KEY` was unset, which broke the *entire app's* build
(Next.js evaluates every route's imports during page-data collection) — it's lazy now
(`getStripe()`), so billing being unconfigured no longer takes down pages that have nothing to do
with it.

**Phase 4 — branding + custom domains**: `supabase/migrations/0005_tenant_assets_storage.sql` adds
a public-read, member-write `tenant-assets` Storage bucket (for logos — RLS mirrors the Postgres
`current_tenant_ids()` pattern, scoped by the object path's first folder segment). Admin UI at
`/admin/tenants/[id]/branding`: edit display name / logo URL / primary / primary-foreground /
accent colors (writes straight to `tenants.branding`, rendered live per-request — no rebuild,
confirmed below), and add/remove `tenant_domains` rows. **Vercel wiring is NOT live** —
`lib/domains/vercel.ts` is a documented scaffold against Vercel's Domains API, never called
against a real project (none was connected this session); `addDomainAction` today only records the
row, so a domain added through the admin UI will not actually route traffic until that function is
wired in and the result's verification status feeds `tenant_domains.verified_at`.

**Second module built to prove the pattern generalizes**: `modules/policy/` (Policies & SOPs — one
`policies` table, jsonb columns for the genuinely variable-shape parts: `gaps`, `settings`,
`history`). Registering it was exactly the five steps the architecture promised: a `modules/policy/`
folder, `manifest.ts`, `db/schema.ts`, one line in `registry.ts`, a seed row in `modules` — **zero
changes to `proxy.ts`, the admin panel, `ModuleNav`, or billing**. Live-verified: acme (Finance +
Policy both enabled) sees both in nav and both pages render real data; zenith (neither enabled)
sees neither, and `/policy` 404s there same as `/finance/pl` does; the admin module-toggle grid at
`/admin/tenants/[id]` showed "Policies & SOPs" automatically, with no admin-code change, the moment
the module row existed.

Not built yet: the Mendeez migration (Phase 5) — deliberately not started without a separate,
explicit go-ahead, since it touches a live production system serving 9 real shops (DNS cutover,
retiring Cloudflare Access, migrating real staff accounts). See this repo's chat history / the
owner directly before touching anything there.

**Live-verified against a real hosted Supabase project** (2026-10-05, project ref
`btyvrnmjvnqvqparyofg` — no Docker was available in that session, so this bypassed local dev
entirely): all 6 migrations applied cleanly in order (two of them, `0000_prereqs.sql` and
`0005_tenant_assets_storage.sql`, only went through on a 2nd/3rd retry — the hosted project's
direct-connection host is IPv6-only and that route was intermittently slow/unreachable from this
network; see `.env.example`'s `DATABASE_URL` comment for the Session Pooler fallback if this bites
again); direct-SQL RLS test confirmed a user with
acme's tenant_ids claim sees only acme's `tenant_memberships` row and all 6 seeded
`finance_pl_lines` rows, a user with zenith's claim sees zenith's membership and zero P&L rows, and
a request with no claim sees nothing (default-deny); `tenant_modules` correctly shows Finance
on/off per tenant; `proxy.ts` correctly resolves `acme.<root>`/`zenith.<root>` to their tenants and
rewrites an unregistered subdomain to `/tenant-not-found`; the sign-in page renders the resolved
tenant's name. Phase 3 verified the same way, with real cookie-based sessions this time (signed in
via the Supabase Auth API, reconstructed the `sb-<ref>-auth-token` cookie `@supabase/ssr` expects —
`base64-` prefix + base64url(JSON.stringify(session)) — rather than driving a browser): an
unauthenticated request to `/admin` or `/admin/tenants` redirects to `/admin/sign-in`; signed in as
a `users.is_platform_admin = true` test account, `/admin/tenants` lists both seeded tenants, and
`/admin/tenants/[id]` shows Finance correctly as ON for acme and OFF for zenith — i.e. the exact
state `supabase/seed.sql` set, read back through the real admin-client + RLS path, not asserted
from the DB directly.

**The auth-hook gap is now closed and the full tenant-side loop is verified end to end.** Enabling
the hook via the Management API (`PATCH /v1/projects/{ref}/config/auth`,
`hook_custom_access_token_enabled`/`hook_custom_access_token_uri`) surfaced a second real bug: a
real sign-in's JWT got the `tenant_ids` claim key, but it came back **empty** — because
`custom_access_token_hook` runs as `supabase_auth_admin` with no JWT in scope, and
`tenant_memberships`' own `FORCE ROW LEVEL SECURITY` policy (which calls `current_tenant_ids()`,
which reads `auth.jwt()`) blocked the hook's own read of the table it exists to bootstrap from — a
chicken-and-egg problem. Fixed by marking the function `SECURITY DEFINER` (same pattern as
`resolve_tenant_by_host()`), which was missing from the original design. After the fix: signed in
as the real `acme-owner@test.dev` account through the actual app (not simulated), `/` showed
"Finance — P&L, GST reporting, cost audit" (previously-broken stale copy — "no modules enabled" —
was also fixed in `app/(tenant)/page.tsx`, which now queries `tenant_modules` for real instead of
hardcoding Phase-1-era text), and `/finance/pl` rendered the real seeded rows
(`net_sales`/`cogs`/`admin_expense`). Signed in as `zenith-owner@test.dev` in the same session:
`/` correctly showed no modules, and `/finance/pl` 404'd — proving `requireModule()` blocks by
server-side check, not merely by a hidden nav link. **Every layer of the Phase 1–4 design is now
proven against a real deployment, not just reasoned about.**

Also found while chasing this: the hosted project's **direct** Postgres connection
(`db.<ref>.supabase.co:5432`) was intermittently unreachable from this session's network (IPv6
routing, timed out roughly half the time across ~10 attempts); the **Session Pooler** connection
(`aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<ref>`) connected reliably every time —
`.env.local` now uses the pooler. If direct connections are flaky for you too, switch to it (see
`.env.example`'s `DATABASE_URL` comment).

Phase 4 verified the same way: set a distinctive test `branding` (`#ff00aa` primary / `#00ffcc`
accent) on acme via the admin client, reloaded `acme.<root>/sign-in` with no restart and no
rebuild, and the new colors appeared as `--brand-primary`/`--brand-accent` CSS variables in the
rendered HTML; reloaded `zenith.<root>/sign-in` in the same request batch and confirmed zenith's
page had neither color — i.e. one running deployment rendering two tenants visibly differently,
which is the actual point of white-labeling. Branding was reset back to `{}` afterwards so the
seed state stays clean for the next person's testing.

## Repo layout

```
apps/web/              Next.js app (the only app for now)
  proxy.ts         tenant resolution — the one chokepoint, see its own header comment
  db/schema/core.ts      Drizzle schema: tenants, users, tenant_memberships, modules,
                          tenant_modules, plans — RLS policies defined inline
  lib/tenant/            host normalization, resolveTenantByHost (Edge-safe), React context,
                          branding CSS-variable rendering
  lib/supabase/          server.ts/client.ts (RLS-as-the-signed-in-user) + admin.ts (service role,
                          bypasses RLS — gate every call site on platform-admin)
  lib/db/admin.ts        Drizzle connection for scripts / future super-admin backend (also bypasses
                          RLS — same rule as above)
  modules/                the module system: registry.ts (finance, policy), guard.ts
                          (requireModule, server-side enablement check), ModuleNav.tsx
                          (renders only a tenant's enabled modules), types.ts
  modules/finance/        reference module #1: manifest.ts, db/schema.ts (3 tables)
  modules/policy/         reference module #2: manifest.ts, db/schema.ts (1 table) — added purely
                          to prove the pattern generalizes with zero changes elsewhere
  app/(tenant)/           everything that needs a resolved tenant (layout.tsx loads it + renders
                          branding + nav), sign-in/sign-up, the dashboard home page, finance/pl/,
                          policy/
  app/tenant-not-found/, app/tenant-suspended/   what proxy.ts rewrites to on failure
  lib/auth/platform-admin.ts   requirePlatformAdmin() — the /admin gate, checks
                          users.is_platform_admin via the RLS-scoped client (not admin.ts)
  app/admin/sign-in/      separate from app/(tenant)/sign-in — the bare platform host has no
                          resolved tenant to render branding for
  app/admin/(dashboard)/  gated by platform-admin.ts: tenants/ (list + create),
                          tenants/[id]/ (module toggle grid, plan assignment),
                          tenants/[id]/branding/ (colors/logo, custom domains), actions.ts (server
                          actions, all admin-client + requirePlatformAdmin())
  lib/billing/            stripe.ts (lazy getStripe(), see README Status for why),
                          syncModulesFromPlan.ts (shared by the admin UI and the webhook)
  app/api/webhooks/stripe/route.ts   subscription + payment-failed handling, not live-tested
  lib/domains/vercel.ts   Vercel Domains API scaffold, NOT wired up (no Vercel project connected)
supabase/
  config.toml             local dev config, incl. the custom_access_token auth hook wiring
  migrations/             0000_prereqs.sql (current_tenant_ids(), must precede the policies*
                          below) -> 0001_core_schema.sql (drizzle-kit) -> 0002_rls_support.sql
                          (FORCE RLS, auth hook [SECURITY DEFINER — see Status], resolve_tenant_by_host(),
                          needs 0001's tables) -> 0003_finance_module.sql (drizzle-kit) ->
                          0004_finance_force_rls.sql -> 0005_tenant_assets_storage.sql (Storage
                          bucket + RLS for logos) -> 0006_policy_module.sql (drizzle-kit, the
                          `policies` *table*, unrelated to RLS "policies" above) ->
                          0007_policy_force_rls.sql. Every module after Finance follows this same
                          <module>.sql + <module>_force_rls.sql two-file pattern.
  seed.sql                two local-dev tenants (acme with Finance + Policy on, zenith with both
                          off) plus a few P&L rows and one policy for acme
scripts/
  check-rls-coverage.mjs  `npm run check:rls` — fails if any tenant-scoped table across the whole
                          migration history is missing its RLS policy or FORCE RLS
```

## Local development

Requires Docker Desktop running (the Supabase CLI's local stack uses it).

1. `npm install` at the repo root (installs both workspaces).
2. `npm run supabase:start` — first run pulls images and takes a few minutes; prints a Postgres
   URL, API URL, anon key and service_role key. Copy `apps/web/.env.example` to
   `apps/web/.env.local` and fill those in (`PLATFORM_ROOT_DOMAIN=localhost:3000` is already
   correct for local dev).
3. `npm run supabase:reset` — applies all migrations and `supabase/seed.sql` (creates the `acme`
   and `zenith` tenants, turns Finance on for acme/off for zenith, seeds a few P&L rows for acme).
   Re-run this any time you change a migration. `npm run check:rls` first if you added a table.
4. `npm run dev` — starts Next.js on :3000.
5. Visit `http://acme.localhost:3000` and `http://zenith.localhost:3000` directly — most modern
   browsers/OSes resolve any `*.localhost` subdomain to 127.0.0.1 with no hosts-file edit needed
   (RFC 6761). If yours doesn't, add `127.0.0.1 acme.localhost` / `127.0.0.1 zenith.localhost` to
   your hosts file instead.
6. On each, go to `/sign-up` and create an account (any email/password — local Supabase doesn't
   send real confirmation emails; check `npm run supabase:status` for the local Inbucket URL if
   email confirmation is required).
7. Give that user a membership — there's no UI for this yet (Phase 3 builds one), so insert it
   directly: open the local Supabase Studio (URL from `supabase:status`, usually
   `http://127.0.0.1:54323`), find the new row in `auth.users` to get its `id`, then insert into
   `public.users` (id, email) and `public.tenant_memberships` (tenant_id from the `tenants` table,
   user_id, role — e.g. `'owner'`).
8. Reload `http://acme.localhost:3000` signed in as that user — you should see the tenant name
   rendered in `--brand-primary` (indigo by default; edit the `tenants.branding` jsonb column in
   Studio to see it change live), a "Finance" nav link (acme has it enabled in the seed), and the
   P&L page at `/finance/pl` showing the seeded rows.
9. Flip it off and on without redeploying: in Studio, `update tenant_modules set enabled = false
   where module_key = 'finance' and tenant_id = (select id from tenants where slug = 'acme')`,
   reload `/finance/pl` — it 404s. Set it back to `true` and it comes back. This is Phase 2's
   actual "done when": module access is a data change, not a code change.
10. Repeat 6–8 for `zenith.localhost:3000` with a second user — zenith has Finance OFF in the seed,
    so that user should see no Finance nav link, and `/finance/pl` should 404 even if they type the
    URL directly (that's `requireModule()` in modules/guard.ts, not just a hidden link).

## Verifying tenant isolation (the actual point of Phase 1)

In Supabase Studio's SQL editor, run a query **as the acme user's role** (Studio's "RLS" test
feature, or `set role
authenticated; select set_config('request.jwt.claims', '{"sub":"<acme-user-id>","tenant_ids":["<acme-tenant-id>"]}', true);`)
and confirm `select * from tenant_memberships` returns only the acme row, never zenith's — that's
the concrete proof isolation is enforced by Postgres, not just by what the UI happens to show.

## Deploying

Not done in this session (no hosted Supabase project / Vercel project was created). To go live:
create a Supabase project, run `supabase link` + `supabase db push` (or re-run the migrations
against it directly), register the same `custom_access_token` hook under Authentication -> Hooks
in the dashboard (the `[auth.hook.*]` block in `config.toml` only applies to local dev), set the
same env vars (with real values) on Vercel, and point a wildcard domain
(`*.yourplatform.app`) at the Vercel project per Vercel's wildcard domain docs.
