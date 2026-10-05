// Tenant resolution — the single chokepoint every request to a tenant host passes through before
// any page or route handler runs. Classifies the Host header, resolves it to a tenant (or not),
// and injects x-tenant-* headers for downstream Server Components/route handlers to read.
//
// SECURITY NOTE: these headers are a routing/rendering convenience, not the access-control
// boundary. A buggy future rewrite rule could in principle forward a stale/wrong header; the
// actual boundary is each user's Supabase JWT (carrying their real tenant_ids claim) enforced by
// Postgres RLS on every query (see db/schema/core.ts and supabase/migrations/0001_rls_support.sql
// current_tenant_ids()). Never authorize a write based on x-tenant-id alone.
import { NextResponse, type NextRequest } from 'next/server';
import { normalizeHost, resolveTenantByHost, isPlatformRootHost } from '@/lib/tenant/resolve';

export const config = {
  matcher: ['/((?!_next/|favicon.ico|tenant-not-found|tenant-suspended).*)'],
};

export default async function proxy(req: NextRequest) {
  const host = normalizeHost(req.headers.get('host'));

  // The bare platform/admin host (marketing site, future super-admin panel) carries no tenant
  // context — let Next.js route it normally.
  if (isPlatformRootHost(host)) return NextResponse.next();

  const tenant = await resolveTenantByHost(host);

  if (!tenant) {
    return NextResponse.rewrite(new URL('/tenant-not-found', req.url));
  }
  if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
    return NextResponse.rewrite(new URL('/tenant-suspended', req.url));
  }

  const headers = new Headers(req.headers);
  headers.set('x-tenant-id', tenant.id);
  headers.set('x-tenant-slug', tenant.slug);
  headers.set('x-tenant-status', tenant.status);

  return NextResponse.next({ request: { headers } });
}
