import { defineConfig } from 'drizzle-kit';

// Migrations are generated into supabase/migrations at the repo root so the Supabase CLI
// (which only looks there) and Drizzle agree on one migration history — no second copy to
// drift out of sync.
export default defineConfig({
  // Every module's db/schema.ts is picked up automatically — adding a module never means editing
  // this config, only adding the file at the conventional path (see modules/registry.ts).
  schema: ['./db/schema/core.ts', './modules/*/db/schema.ts'],
  out: '../../supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres',
  },
});
