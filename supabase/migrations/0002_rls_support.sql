-- RLS support that can't be expressed as a Drizzle column/table and that (unlike
-- current_tenant_ids() in 0000_prereqs.sql) depends on the tables from 0001_core_schema.sql
-- already existing: FORCE RLS, the Supabase Auth Hook that populates the tenant_ids claim
-- current_tenant_ids() reads, and the one deliberate pre-auth RLS bypass for tenant lookup.

-- Table owner can normally bypass its own RLS policies; FORCE closes that so the only
-- deliberate bypass is the service role used by the super-admin backend (service_role carries
-- BYPASSRLS and ignores FORCE too, which is correct — that is the one code path allowed to see
-- across tenants, gated on users.is_platform_admin in application code, not on a DB role alone).
alter table public.tenants             force row level security;
alter table public.tenant_domains      force row level security;
alter table public.tenant_memberships  force row level security;
alter table public.tenant_modules      force row level security;

-- Custom Access Token Hook (Supabase Auth): runs server-side at token-mint time, embeds the
-- caller's tenant memberships into the JWT as `tenant_ids`. Must additionally be enabled as the
-- project's Auth Hook — supabase/config.toml wires this for local dev; a hosted Supabase project
-- needs the same hook selected under Authentication -> Hooks in the dashboard (not something a
-- migration can do, since it's project configuration rather than schema).
--
-- SECURITY DEFINER is required, not optional (found 2026-10-05: without it, every signed-in user's
-- tenant_ids claim came back empty). The hook runs as supabase_auth_admin with no JWT in scope yet
-- — it IS the thing computing the claim current_tenant_ids() will later read — so tenant_memberships'
-- own FORCE ROW LEVEL SECURITY policy (which calls current_tenant_ids()) blocks the hook's read of
-- itself: a chicken-and-egg problem. SECURITY DEFINER runs the query as this function's owner
-- instead, bypassing that policy for exactly this one bootstrapping read, the same pattern as
-- resolve_tenant_by_host() below.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  tenant_ids jsonb;
begin
  select coalesce(jsonb_agg(tenant_id), '[]'::jsonb)
  into tenant_ids
  from public.tenant_memberships
  where user_id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{tenant_ids}', tenant_ids);
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Per Supabase's documented hook contract: the auth service (supabase_auth_admin) must be able
-- to call the function and read the table it queries; no one else should be able to invoke it
-- directly (it would let a client ask "what would my claims be" out of band, which is harmless
-- today but is not a path worth leaving open).
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant select on public.tenant_memberships to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- Tenant resolution (proxy.ts -> lib/tenant/resolve.ts, called directly as a Supabase REST RPC
-- fetch — no separate internal API route) has to work for a signed-OUT visitor hitting a login
-- page, i.e. before any JWT with tenant_ids exists — the tenants_member_read RLS policy on
-- `tenants` deliberately does not cover this case. Rather than relaxing that policy (which would
-- expose stripe_customer_id / stripe_subscription_id to anon), this SECURITY DEFINER function
-- returns only the columns a pre-auth request needs (id, slug, name, status, branding) for exactly
-- one host, looked up as either {slug}.<root domain> or a row in tenant_domains. It is the one
-- deliberate, narrow bypass of RLS outside the super-admin service-role path, and it leaks no more
-- than what every visitor already needs to see to render a branded login page.
create or replace function public.resolve_tenant_by_host(p_host text, p_root_domain text)
returns table (
  id uuid,
  slug text,
  name text,
  status text,
  branding jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.slug, t.name, t.status, t.branding
  from public.tenants t
  where p_host = t.slug || '.' || p_root_domain
  union all
  select t.id, t.slug, t.name, t.status, t.branding
  from public.tenants t
  join public.tenant_domains d on d.tenant_id = t.id
  where d.domain = p_host
  limit 1;
$$;

grant execute on function public.resolve_tenant_by_host(text, text) to anon, authenticated;
