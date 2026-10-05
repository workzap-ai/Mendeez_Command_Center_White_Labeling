-- Phase 4: white-label branding assets. One Storage bucket, tenant-id-prefixed paths
-- (tenant-assets/<tenant_id>/...), with a storage.objects RLS policy mirroring the same
-- current_tenant_ids() check every Postgres table uses — kept public-readable because a logo has
-- to render on a public sign-in page nobody is authenticated on yet (same reasoning as
-- resolve_tenant_by_host() in 0002_rls_support.sql: a visitor needs to see branding before they
-- can prove tenant membership). Writes stay member-gated.
insert into storage.buckets (id, name, public)
values ('tenant-assets', 'tenant-assets', true)
on conflict (id) do nothing;

-- storage.foldername(name) splits the object path on '/'; [1] is the first segment, i.e. the
-- tenant_id folder, for an object path like '<tenant_id>/logo.svg'.
create policy "tenant_assets_public_read" on storage.objects
  for select using (bucket_id = 'tenant-assets');

create policy "tenant_assets_member_write" on storage.objects
  for insert with check (
    bucket_id = 'tenant-assets'
    and (storage.foldername(name))[1]::uuid in (select current_tenant_ids())
  );

create policy "tenant_assets_member_update" on storage.objects
  for update using (
    bucket_id = 'tenant-assets'
    and (storage.foldername(name))[1]::uuid in (select current_tenant_ids())
  );

create policy "tenant_assets_member_delete" on storage.objects
  for delete using (
    bucket_id = 'tenant-assets'
    and (storage.foldername(name))[1]::uuid in (select current_tenant_ids())
  );
