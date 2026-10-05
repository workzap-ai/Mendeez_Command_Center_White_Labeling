'use server';

// Every action here starts with requirePlatformAdmin() and then uses the service-role admin
// client (lib/supabase/admin.ts) — the one deliberate, narrow bypass of RLS outside
// resolve_tenant_by_host(), because creating a tenant or listing all of them is definitionally a
// cross-tenant operation RLS would otherwise (correctly) refuse. Because that bypass is total,
// every write here is responsible for its own tenant-scoping discipline — RLS won't save a bug
// that forgets to filter by tenant_id (see removeDomainAction below for exactly that mistake,
// found and fixed in review).
import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { setModuleEnabled } from '@/modules/setEnabled';
import type { TenantBranding } from '@/lib/tenant/types';

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function createTenantAction(formData: FormData) {
  await requirePlatformAdmin();
  const name = String(formData.get('name') || '').trim();
  if (!name) throw new Error('Name is required');
  const baseSlug = slugify(name);
  if (!baseSlug) throw new Error('That name produces an empty slug (no letters or numbers) — pick something else');

  const admin = createAdminClient();

  // slugify() is lossy by design ("Acme Inc." and "Acme, Inc!!" both become "acme-inc"), so a
  // plain insert can hit tenants.slug's unique constraint and surface as a raw, unstyled Postgres
  // error. Check first and disambiguate with a short numeric suffix instead.
  let slug = baseSlug;
  for (let suffix = 2; suffix < 50; suffix++) {
    const { data: existing } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
  }

  const { error } = await admin.from('tenants').insert({ name, slug, status: 'active' });
  if (error) throw new Error(error.message);

  revalidatePath('/admin/tenants');
}

// A true toggle, not a blind set: reads the module's CURRENT state and flips that, rather than
// trusting a hidden form field computed from whatever the page last rendered. Found in review —
// the previous version re-applied `!enabled` from a potentially stale page load, which could
// silently revert a change made in another tab or by another admin since that load.
export async function toggleModuleAction(formData: FormData) {
  const adminUser = await requirePlatformAdmin();
  const tenantId = String(formData.get('tenantId'));
  const moduleKey = String(formData.get('moduleKey'));

  const admin = createAdminClient();
  const { data: current } = await admin
    .from('tenant_modules')
    .select('enabled')
    .eq('tenant_id', tenantId)
    .eq('module_key', moduleKey)
    .maybeSingle();

  await setModuleEnabled(tenantId, moduleKey, !current?.enabled, adminUser.id);
  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function assignPlanAction(formData: FormData) {
  const adminUser = await requirePlatformAdmin();
  const tenantId = String(formData.get('tenantId'));
  const planId = String(formData.get('planId'));

  const admin = createAdminClient();
  const { error } = await admin.from('tenants').update({ plan_id: planId || null }).eq('id', tenantId);
  if (error) throw new Error(error.message);

  // Mirrors what the Stripe webhook does on a real plan change (lib/billing/syncModulesFromPlan.ts)
  // — assigning a plan by hand in the admin UI should have the same effect as a paid upgrade, not
  // a weaker one. Additions are applied immediately; removals are left alone (see that file's
  // header comment for why) so this action never silently revokes something a previous manual
  // override granted. NOT transactional with the update above — if this throws, the tenant is left
  // pointing at the new plan_id with tenant_modules not yet synced; acceptable for an admin tool
  // used by one person at a time, but worth a retry-safe design if this grows multi-admin traffic.
  if (planId) {
    await syncModulesFromPlanLazy(tenantId, planId, adminUser.id);
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
}

async function syncModulesFromPlanLazy(tenantId: string, planId: string, actingUserId: string) {
  const { syncModulesFromPlan } = await import('@/lib/billing/syncModulesFromPlan');
  await syncModulesFromPlan(tenantId, planId, actingUserId);
}

export async function updateBrandingAction(formData: FormData) {
  await requirePlatformAdmin();
  const tenantId = String(formData.get('tenantId'));
  const displayName = String(formData.get('displayName') || '').trim();
  const primary = String(formData.get('primary') || '').trim();
  const primaryForeground = String(formData.get('primaryForeground') || '').trim();
  const accent = String(formData.get('accent') || '').trim();
  const logoUrl = String(formData.get('logoUrl') || '').trim();

  const admin = createAdminClient();

  // Merge onto the EXISTING branding rather than replacing the column outright — found in
  // review: this form only exposes 5 fields, and a blind `.update({ branding })` silently erased
  // any other field (faviconUrl, theme) already stored on the row, even if this save touched
  // none of them.
  const { data: tenant, error: readErr } = await admin.from('tenants').select('branding').eq('id', tenantId).maybeSingle();
  if (readErr) throw new Error(readErr.message);
  const current = (tenant?.branding ?? {}) as TenantBranding;

  const branding: TenantBranding = {
    ...current,
    ...(displayName ? { displayName } : {}),
    ...(logoUrl ? { logoUrl } : {}),
    colors: {
      ...current.colors,
      ...(primary ? { primary } : {}),
      ...(primaryForeground ? { primaryForeground } : {}),
      ...(accent ? { accent } : {}),
    },
  };

  const { error } = await admin.from('tenants').update({ branding }).eq('id', tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/tenants/${tenantId}/branding`);
}

export async function addDomainAction(formData: FormData) {
  await requirePlatformAdmin();
  const tenantId = String(formData.get('tenantId'));
  const domain = String(formData.get('domain') || '')
    .trim()
    .toLowerCase();
  if (!domain) throw new Error('Domain is required');

  const admin = createAdminClient();
  // NOT live-verified against Vercel (no Vercel API token available this session) — this just
  // records intent. See lib/domains/vercel.ts header comment for the real verification flow a
  // hosted deploy needs before this domain will actually route traffic.
  const { error } = await admin.from('tenant_domains').insert({ tenant_id: tenantId, domain });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/tenants/${tenantId}/branding`);
}

export async function removeDomainAction(formData: FormData) {
  await requirePlatformAdmin();
  const tenantId = String(formData.get('tenantId'));
  const domainId = String(formData.get('domainId'));

  const admin = createAdminClient();
  // Scoped by tenantId AND domainId — this client bypasses RLS entirely, so nothing else stops a
  // mismatched pair (stale tab, future UI bug) from deleting a different tenant's domain row.
  // Found in review: the previous version filtered on domainId alone.
  const { error } = await admin.from('tenant_domains').delete().eq('id', domainId).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/tenants/${tenantId}/branding`);
}
