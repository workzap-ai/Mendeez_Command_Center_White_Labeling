import { headers } from 'next/headers';

/** The tenant id proxy.ts already resolved for this request. Safe to use for routing/queries —
 * RLS is what actually enforces access, so a spoofed value here can only ever produce "not found,"
 * never a cross-tenant leak (see proxy.ts's header comment). Throws if used outside a (tenant)
 * route, where proxy.ts guarantees this header is set. */
export async function getCurrentTenantId(): Promise<string> {
  const id = (await headers()).get('x-tenant-id');
  if (!id) throw new Error('getCurrentTenantId() called outside a resolved tenant request');
  return id;
}
