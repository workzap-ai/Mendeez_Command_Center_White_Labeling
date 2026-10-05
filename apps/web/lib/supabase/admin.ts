// Service-role client — BYPASSES every RLS policy on every tenant. This is the one deliberate
// hole in "every tenant table is isolated by default" (see db/schema/core.ts), and it exists only
// for the super-admin backend (tenant create/list across all tenants, plan assignment, billing
// sync). Every call site MUST gate on `isPlatformAdmin` (lib/auth/platform-admin.ts) before doing
// anything with this client — never import it from a tenant-scoped route or Server Component.
// Node runtime only: never import this from proxy.ts or any Edge-runtime code.
import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from '@/lib/env';

export function createAdminClient() {
  return createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
