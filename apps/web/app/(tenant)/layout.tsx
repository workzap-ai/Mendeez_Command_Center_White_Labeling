// Every page under this route group gets a resolved tenant. The host is already known-good here
// (proxy.ts already rewrote unknown/suspended hosts away before Next got this far), so this
// re-fetch is just "get the full row for rendering," not a second security check — resolveTenantByHost
// itself hits the same RLS-safe resolve_tenant_by_host() function as middleware (see lib/tenant/resolve.ts),
// so it works whether or not the visitor is signed in yet (e.g. on /sign-in).
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { resolveTenantByHost, normalizeHost } from '@/lib/tenant/resolve';
import { TenantProvider } from '@/lib/tenant/context';
import { brandingStyleTag } from '@/lib/tenant/branding';
import { ModuleNav } from '@/modules/ModuleNav';

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const host = normalizeHost(headerList.get('host'));
  const tenant = await resolveTenantByHost(host);

  // Belt-and-braces: middleware should already have redirected away from here if this were null,
  // but a layout must never assume a header/upstream check it didn't perform itself.
  if (!tenant) notFound();

  return (
    <TenantProvider tenant={tenant}>
      <style dangerouslySetInnerHTML={{ __html: brandingStyleTag(tenant.branding) }} />
      {/* Degrades to nothing for a signed-out visitor — RLS returns zero tenant_modules rows for
          the anon role, so there is no auth check to duplicate here. */}
      <ModuleNav tenantId={tenant.id} />
      {children}
    </TenantProvider>
  );
}
