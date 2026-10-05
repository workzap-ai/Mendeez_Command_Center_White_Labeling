import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateBrandingAction, addDomainAction, removeDomainAction } from '../../../actions';
import type { TenantBranding } from '@/lib/tenant/types';

export default async function AdminTenantBrandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: tenant } = await admin.from('tenants').select('id, name, slug, branding').eq('id', id).maybeSingle();
  if (!tenant) notFound();
  const branding = (tenant.branding ?? {}) as TenantBranding;

  const { data: domains } = await admin
    .from('tenant_domains')
    .select('id, domain, is_primary, verified_at')
    .eq('tenant_id', id)
    .order('created_at');

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href={`/admin/tenants/${id}`} className="text-xs text-gray-500 underline">
        &larr; {tenant.name}
      </Link>
      <h1 className="mt-2 text-lg font-semibold">Branding &amp; domains</h1>

      <h2 className="mt-8 text-sm font-semibold text-gray-500 uppercase tracking-wide">White-label branding</h2>
      <form action={updateBrandingAction} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="tenantId" value={tenant.id} />
        <label className="text-xs text-gray-500">
          Display name (overrides &quot;{tenant.name}&quot; in the UI if set)
          <input
            name="displayName"
            defaultValue={branding.displayName ?? ''}
            placeholder={tenant.name}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-gray-500">
          Logo URL
          <input
            name="logoUrl"
            defaultValue={branding.logoUrl ?? ''}
            placeholder="https://.../logo.svg"
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        <div className="flex gap-3">
          <label className="flex-1 text-xs text-gray-500">
            Primary color
            <input
              name="primary"
              type="color"
              defaultValue={branding.colors?.primary ?? '#4f46e5'}
              className="mt-1 h-9 w-full rounded border"
            />
          </label>
          <label className="flex-1 text-xs text-gray-500">
            Primary text color
            <input
              name="primaryForeground"
              type="color"
              defaultValue={branding.colors?.primaryForeground ?? '#ffffff'}
              className="mt-1 h-9 w-full rounded border"
            />
          </label>
          <label className="flex-1 text-xs text-gray-500">
            Accent color
            <input
              name="accent"
              type="color"
              defaultValue={branding.colors?.accent ?? '#f59e0b'}
              className="mt-1 h-9 w-full rounded border"
            />
          </label>
        </div>
        <button type="submit" className="self-start rounded bg-black px-3 py-2 text-xs font-semibold text-white">
          Save branding
        </button>
      </form>
      <p className="mt-2 text-xs text-gray-500">
        Rendered live, per request, from this row — no rebuild needed. See lib/tenant/branding.ts.
      </p>

      <h2 className="mt-10 text-sm font-semibold text-gray-500 uppercase tracking-wide">Custom domains</h2>
      <p className="mt-1 text-xs text-amber-600">
        Not wired to Vercel yet (no Vercel project connected this session) — adding a domain here records
        intent only. See lib/domains/vercel.ts for what&apos;s still needed before it actually routes traffic.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {(domains ?? []).map((d) => (
          <form key={d.id} action={removeDomainAction} className="flex items-center justify-between rounded border px-4 py-2 text-sm">
            <span className="font-mono">
              {d.domain} {d.is_primary && <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px]">primary</span>}
            </span>
            <span className="flex items-center gap-3">
              <span className={`text-[10px] ${d.verified_at ? 'text-green-700' : 'text-amber-600'}`}>
                {d.verified_at ? 'verified' : 'not verified'}
              </span>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <input type="hidden" name="domainId" value={d.id} />
              <button type="submit" className="text-xs text-red-600 underline">
                remove
              </button>
            </span>
          </form>
        ))}
        {!domains?.length && <p className="text-xs text-gray-500">No custom domains yet — tenant is reachable at {tenant.slug}.&lt;platform root&gt; only.</p>}
      </div>
      <form action={addDomainAction} className="mt-3 flex gap-2">
        <input type="hidden" name="tenantId" value={tenant.id} />
        <input name="domain" required placeholder="shop.example.com" className="rounded border px-3 py-2 text-sm" />
        <button type="submit" className="rounded bg-black px-3 py-2 text-xs font-semibold text-white">
          Add domain
        </button>
      </form>
    </main>
  );
}
