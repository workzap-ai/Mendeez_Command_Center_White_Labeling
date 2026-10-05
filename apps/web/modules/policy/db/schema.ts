// Second module, built specifically to prove the pattern from modules/finance/ generalizes: new
// folder, manifest, schema with tenant_id + the shared tenantIsolation() policy, one line in
// registry.ts, a seed row in `modules` — nothing about proxy.ts, the admin panel, billing, or
// ModuleNav had to change to support this.
//
// Modeled after a real policy/SOP system (seed/fill/audit/amend lifecycle): a policy starts as a
// named blank ("needs_input"), departments fill it in ("draft"), and Ata-equivalent approval makes
// it "approved" — version bumps and the change is appended to `history`. `gaps` (open questions),
// `settings` (the actual numbers engines run on), and `history` stay jsonb: they're inherently
// variable-shape per policy, not relational facts the way Finance's P&L lines are.
import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, integer, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { tenants } from '@/db/schema/core';
import { tenantIsolation } from '@/db/schema/_shared';

export const policies = pgTable(
  'policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: text('code').notNull(), // stable short id, e.g. 'FIN-GST-01' — unique per tenant, not globally
    department: text('department').notNull(),
    title: text('title').notNull(),
    status: text('status').notNull().default('needs_input'), // needs_input | draft | approved
    version: integer('version').notNull().default(0),
    rule: text('rule'),
    detail: jsonb('detail').notNull().default(sql`'[]'::jsonb`), // string[]
    gaps: jsonb('gaps').notNull().default(sql`'[]'::jsonb`), // {field, prompt, for, answer}[]
    settings: jsonb('settings').notNull().default(sql`'[]'::jsonb`), // {name, value, unit?, where?}[]
    owner: text('owner'),
    source: text('source'),
    history: jsonb('history').notNull().default(sql`'[]'::jsonb`), // {version, date, change, by}[]
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    tenantIsolation(table),
    // The `code` comment above promises "unique per tenant" — found in review that nothing
    // actually enforced it (unlike tenant_memberships' analogous constraint). Two inserts for the
    // same tenant + code (a retry, or two admins seeding concurrently) used to both silently
    // succeed.
    unique('policies_tenant_code_unique').on(table.tenantId, table.code),
  ]
).enableRLS();
