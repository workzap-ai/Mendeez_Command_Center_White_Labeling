// Browser client, for Client Components (sign-in form, interactive widgets). Same RLS-as-the-
// signed-in-user behaviour as server.ts, just wired to document.cookie instead of the request's.
import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

export function createClient() {
  return createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
