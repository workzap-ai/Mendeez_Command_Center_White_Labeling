// Drizzle is this project's schema/migration source of truth (db/schema/core.ts), chosen
// specifically because it can define RLS policies next to column definitions. It is NOT the
// query runtime for ordinary, RLS-scoped application reads/writes — those go through
// lib/supabase/server.ts / client.ts (PostgREST), which already forwards the signed-in user's
// JWT correctly so current_tenant_ids() sees the right claims with no extra plumbing. Hand-rolling
// that JWT-forwarding for a raw Postgres connection (via `set_config('request.jwt.claims', ...)`)
// is easy to get subtly wrong (transaction scoping, connection pooling) and was deliberately left
// out of Phase 1 rather than shipped half-correct.
//
// This client exists for the one place that legitimately needs to bypass RLS outright: the
// super-admin backend (Phase 3) and one-off scripts (migrations, seeding). DATABASE_URL must
// point at a Postgres role with BYPASSRLS (Supabase's `postgres` role, or the pooler connection
// string Supabase calls "service role" for direct DB access) — never wire this into a route that
// serves an ordinary tenant user.
import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema/core';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

// 'require': a hosted Supabase direct connection refuses a plain-TCP handshake outright (verified
// 2026-10-05 — connection hung until this was set), while local `supabase start` Postgres has no
// SSL configured at all. 'prefer' negotiates SSL when the server offers it and falls back to
// plaintext when it doesn't, so one setting works against both without an env-specific branch.
const client = postgres(connectionString, { prepare: false, ssl: 'prefer' });
export const adminDb = drizzle(client, { schema });
