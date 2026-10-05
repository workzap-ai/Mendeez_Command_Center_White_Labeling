import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { resolveTenantByHost, normalizeHost } from '@/lib/tenant/resolve';
import { MODULE_REGISTRY } from '@/modules/registry';

export default async function TenantHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const host = normalizeHost((await headers()).get('host'));
  const tenant = await resolveTenantByHost(host);

  // RLS-scoped: only returns a row if this user actually belongs to this tenant
  // (tenant_isolation policy on tenant_memberships via current_tenant_ids()).
  const { data: membership } = await supabase
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', tenant?.id ?? '')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-semibold">Not a member of {tenant?.name}</h1>
        <p className="mt-2 text-sm text-gray-500">
          You&apos;re signed in as {user.email}, but that account has no membership on this tenant.
          Ask a platform admin to add you.
        </p>
      </main>
    );
  }

  const { data: enabledRows } = await supabase
    .from('tenant_modules')
    .select('module_key')
    .eq('tenant_id', tenant?.id ?? '')
    .eq('enabled', true);
  const enabledModules = (enabledRows ?? [])
    .map((r) => MODULE_REGISTRY[r.module_key])
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
        {tenant?.name}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Signed in as {user.email} &middot; role: {membership.role}
      </p>
      {enabledModules.length ? (
        <ul className="mt-6 flex flex-col gap-1 text-sm">
          {enabledModules.map((m) => (
            <li key={m.key}>
              <a href={m.navEntries[0]?.href ?? '#'} className="underline">
                {m.name}
              </a>
              <span className="ml-2 text-gray-500">{m.description}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-gray-500">No modules are enabled for this tenant yet.</p>
      )}
    </main>
  );
}
