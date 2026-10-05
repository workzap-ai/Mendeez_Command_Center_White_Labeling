-- Must run BEFORE 0001_core_schema.sql: Postgres validates a CREATE POLICY's USING/WITH CHECK
-- expression (including that any function it calls already exists) at the moment the policy is
-- created, not lazily at first use. Every tenant-scoped table's RLS policy
-- (db/schema/core.ts tenantIsolation()) calls current_tenant_ids(), so that function has to exist
-- before the table-creation migration runs, even though it was designed and is documented
-- alongside the rest of the RLS support in 0002_rls_support.sql.
create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
as $$
  select jsonb_array_elements_text(
    coalesce(auth.jwt() -> 'tenant_ids', '[]'::jsonb)
  )::uuid
$$;
