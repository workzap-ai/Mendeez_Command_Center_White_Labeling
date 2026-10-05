// Server Component / Route Handler client — carries the signed-in user's own session (cookies),
// so every query through this client is subject to RLS as that user. This is the client almost
// all app code should use; see admin.ts for the one deliberate exception.
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component that can't set cookies (no response to attach to).
          // Harmless as long as middleware is also refreshing the session — see proxy.ts.
        }
      },
    },
  });
}
