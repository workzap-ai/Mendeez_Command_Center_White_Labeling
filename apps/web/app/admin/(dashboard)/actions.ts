'use server';

// Every action here starts with requirePlatformAdmin() and then uses the service-role admin
// client (lib/supabase/admin.ts) — the one deliberate, narrow bypass of RLS outside
// resolve_tenant_by_host(), because creating a tenant or listing all of them is definitionally a
// cross-tenant operation RLS would otherwise (correctly) refuse.
import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { createAdminClient } from '@/lib/supabase/admin';

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
  const slug = slugify(name);

  const admin = createAdminClient();
  const { error } = await admin.from('tenants').insert({ name, slug, status: 'active' });
  if (error) throw new Error(error.message);

  revalidatePath('/admin/tenants');
}

export async function toggleModuleAction(formData: FormData) {
  await requirePlatformAdmin();
  const tenantId = String(formData.get('tenantId'));
  const moduleKey = String(formData.get('moduleKey'));
  const enabled = formData.get('enabled') === 'true';

  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_modules')
    .upsert(
      { tenant_id: tenantId, module_key: moduleKey, enabled, enabled_at: enabled ? new Date().toISOString() : null },
      { onConflict: 'tenant_id,module_key' }
    );
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function assignPlanAction(formData: FormData) {
  await requirePlatformAdmin();
  const tenantId = String(formData.get('tenantId'));
  const planId = String(formData.get('planId'));

  const admin = createAdminClient();
  const { error } = await admin.from('tenants').update({ plan_id: planId || null }).eq('id', tenantId);
  if (error) throw new Error(error.message);

  // Mirrors what the Stripe webhook does on a real plan change (lib/billing/syncModulesFromPlan.ts)
  // — assigning a plan by hand in the admin UI should have the same effect as a paid upgrade, not
  // a weaker one. Additions are applied immediately; removals are left alone (see that file's
  // header comment for why) so this action never silently revokes something a previous manual
  // override granted.
  if (planId) {
    const { syncModulesFromPlan } = await import('@/lib/billing/syncModulesFromPlan');
    await syncModulesFromPlan(tenantId, planId);
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function updateBrandingAction(formData: FormData) {
  await requirePlatformAdmin();
  const tenantId = String(formData.get('tenantId'));
  const displayName = String(formData.get('displayName') || '').trim();
  const primary = String(formData.get('primary') || '').trim();
  const primaryForeground = String(formData.get('primaryForeground') || '').trim();
  const accent = String(formData.get('accent') || '').trim();
  const logoUrl = String(formData.get('logoUrl') || '').trim();

  const branding = {
    ...(displayName ? { displayName } : {}),
    ...(logoUrl ? { logoUrl } : {}),
    colors: {
      ...(primary ? { primary } : {}),
      ...(primaryForeground ? { primaryForeground } : {}),
      ...(accent ? { accent } : {}),
    },
  };

  const admin = createAdminClient();
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
  const { error } = await admin.from('tenant_domains').delete().eq('id', domainId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/tenants/${tenantId}/branding`);
}
