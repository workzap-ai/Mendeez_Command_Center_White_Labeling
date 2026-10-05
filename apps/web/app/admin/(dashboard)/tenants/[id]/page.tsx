import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { MODULE_REGISTRY } from '@/modules/registry';
import { toggleModuleAction, assignPlanAction } from '../../actions';

export default async function AdminTenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  // Independent queries, fetched in parallel — all three only depend on the route's `id` param,
  // not on each other's results, so there's no reason to pay three sequential round-trips.
  const [{ data: tenant }, { data: enabledRows }, { data: plans }] = await Promise.all([
    admin.from('tenants').select('id, name, slug, status, plan_id').eq('id', id).maybeSingle(),
    admin.from('tenant_modules').select('module_key, enabled').eq('tenant_id', id),
    admin.from('plans').select('id, key, name, included_modules').order('name'),
  ]);
  if (!tenant) notFound();

  const enabledMap = new Map((enabledRows ?? []).map((r) => [r.module_key, r.enabled]));

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{tenant.name}</h1>
        <Link href={`/admin/tenants/${tenant.id}/branding`} className="text-xs underline">
          Branding &amp; domains
        </Link>
      </div>
      <p className="mt-1 text-xs text-gray-500 font-mono">
        {tenant.slug} &middot; {tenant.status}
      </p>

      <h2 className="mt-8 text-sm font-semibold text-gray-500 uppercase tracking-wide">Plan</h2>
      <form action={assignPlanAction} className="mt-3 flex gap-2">
        <input type="hidden" name="tenantId" value={tenant.id} />
        <select name="planId" defaultValue={tenant.plan_id ?? ''} className="rounded border px-3 py-2 text-sm">
          <option value="">— none —</option>
          {(plans ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({(p.included_modules ?? []).join(', ') || 'no modules'})
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-black px-3 py-2 text-xs font-semibold text-white">
          Assign
        </button>
      </form>
      <p className="mt-1 text-xs text-gray-500">
        Assigning a plan enables any module it includes that isn&apos;t already on — it never turns one off (manual overrides below stay yours to undo).
      </p>

      <h2 className="mt-8 text-sm font-semibold text-gray-500 uppercase tracking-wide">Modules</h2>
      <div className="mt-3 flex flex-col gap-2">
        {Object.values(MODULE_REGISTRY).map((mod) => {
          const enabled = enabledMap.get(mod.key) ?? false;
          return (
            <form key={mod.key} action={toggleModuleAction} className="flex items-center justify-between rounded border px-4 py-3">
              <div>
                <div className="text-sm font-medium">{mod.name}</div>
                <div className="text-xs text-gray-500">{mod.description}</div>
              </div>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <input type="hidden" name="moduleKey" value={mod.key} />
              <button
                type="submit"
                className={`rounded px-3 py-1.5 text-xs font-semibold ${enabled ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                {enabled ? 'ON — click to disable' : 'OFF — click to enable'}
              </button>
            </form>
          );
        })}
      </div>
    </main>
  );
}
