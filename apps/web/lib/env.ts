// Split in two on purpose: `publicEnv` is safe to import from Edge Middleware (it never touches
// the service role key), `serverEnv` carries the service-role secret and must only be imported
// from Node-runtime server code (e.g. lib/supabase/admin.ts). Importing serverEnv from
// proxy.ts would bake that secret into the Edge bundle for no reason — keeping them apart
// means that mistake fails obviously (missing export) rather than silently shipping wider than
// it needs to.
import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // The apex the platform is served from, e.g. "yourplatform.app" in prod or
  // "localhost:3000" in dev — tenants are resolved as "{slug}.<this>". No protocol, no path.
  PLATFORM_ROOT_DOMAIN: z.string().min(1),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  PLATFORM_ROOT_DOMAIN: process.env.PLATFORM_ROOT_DOMAIN,
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const serverEnv = serverSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
