// Host -> tenant resolution, called from proxy.ts on (nearly) every request, so it has to be
// cheap and Edge-runtime-safe. Postgres isn't reachable directly from the Edge runtime, so this
// calls Supabase's REST RPC endpoint (a plain fetch, which Edge supports) rather than opening a
// `postgres` driver connection — db/index.ts's Drizzle client is for Node-runtime route handlers
// and Server Components, not for this file.
//
// PHASE 1 CACHE: an in-memory Map, scoped to one Edge isolate, with a short TTL. This is an
// intentional placeholder, not the final design — per the architecture plan this should become
// Vercel Edge Config or Upstash Redis with write-through invalidation when a tenant's status/
// domain changes, so every edge location agrees immediately instead of up to TTL-stale. Tracked
// as a Phase 1 follow-up; do not mistake this Map for that.
import { publicEnv } from '@/lib/env';
import type { TenantLookup } from './types';

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: TenantLookup | null; expiresAt: number }>();

export function normalizeHost(rawHost: string | null): string {
  const raw = (rawHost || '').toLowerCase().trim();
  let host = raw;
  try {
    host = new URL(`http://${raw}`).hostname;
  } catch {
    // keep raw — an unparseable Host can't match anything below either way
  }
  return host.replace(/\.$/, '');
}

export async function resolveTenantByHost(host: string): Promise<TenantLookup | null> {
  const cached = cache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const resp = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/resolve_tenant_by_host`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_host: host, p_root_domain: publicEnv.PLATFORM_ROOT_DOMAIN }),
    // Edge fetch caching is a separate layer from our Map above; disable it explicitly so a stale
    // CDN-cached RPC response can't outlive even our own short TTL.
    cache: 'no-store',
  });

  let value: TenantLookup | null = null;
  if (resp.ok) {
    const rows = (await resp.json()) as TenantLookup[];
    value = rows[0] ?? null;
  }

  cache.set(host, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export function isPlatformRootHost(host: string): boolean {
  return host === publicEnv.PLATFORM_ROOT_DOMAIN || host === `www.${publicEnv.PLATFORM_ROOT_DOMAIN}`;
}
