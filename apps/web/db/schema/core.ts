// Core platform schema — tenants, identity, module catalog, billing.
// Every tenant-scoped table enables RLS and carries a policy built on current_tenant_ids(),
// a Postgres function defined by hand in supabase/migrations/0000_prereqs.sql — it has to exist
// BEFORE this schema's generated migration runs, since CREATE POLICY validates the function
// reference immediately, so it could not live in db/schema/core.ts itself (Drizzle would emit it
// in the same migration as the tables and policies, too late). The auth hook that actually
// populates the tenant_ids claim this function reads lives in
// supabase/migrations/0002_rls_support.sql, which has to run AFTER these tables exist instead.
// tenant_id is NOT NULL with no default everywhere on purpose: every insert must name its tenant
// explicitly, which combined with the policy's WITH CHECK blocks a buggy write from ever landing
// in another tenant's rows.
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  primaryKey,
  unique,
  pgPolicy,
} from 'drizzle-orm/pg-core';
import { tenantIsolation } from './_shared';

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    status: text('status').notNull().default('trialing'), // trialing | active | suspended | cancelled
    planId: uuid('plan_id').references(() => plans.id),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id'),
    branding: jsonb('branding').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Every authenticated user may SELECT the tenants they belong to (needed to resolve
    // branding/name for rendering); writes go through the service-role admin path instead, so
    // there is no separate write policy here — RLS defaults to deny when none matches.
    pgPolicy('tenants_member_read', {
      for: 'select',
      using: sql`${table.id} in (select current_tenant_ids())`,
    }),
  ]
).enableRLS();

export const tenantDomains = pgTable(
  'tenant_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull().unique(),
    isPrimary: boolean('is_primary').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [tenantIsolation(table)]
).enableRLS();

// Platform-level profile. auth.users itself is Supabase-managed and lives outside this schema.
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(), // == auth.users.id, no FK declared here (cross-schema)
    email: text('email').notNull(),
    fullName: text('full_name'),
    // Super-admin flag — NOT tenant-scoped. Gates the platform-owner admin surface, checked
    // explicitly in that one code path; everywhere else RLS is the boundary, not this flag.
    isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A user may read their own row (needed client-side for "who am I"). Membership rows (not
    // this table) are what actually drive tenant-scoped visibility of OTHER users.
    pgPolicy('users_self_read', {
      for: 'select',
      using: sql`${table.id} = auth.uid()`,
    }),
  ]
).enableRLS();

export const tenantMemberships = pgTable(
  'tenant_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // owner | admin | member | viewer
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    tenantIsolation(table),
    // One membership row per (tenant, user) — a user can still belong to several tenants.
    unique('tenant_memberships_tenant_user_unique').on(table.tenantId, table.userId),
  ]
).enableRLS();

// Module catalog — code-defined (see apps/web/modules/registry.ts), mirrored into the DB so
// tenant_modules can foreign-key against a known set of keys. Readable by everyone signed in
// (it's just a catalog, no tenant secrets), written only by migrations/seed scripts.
export const modules = pgTable(
  'modules',
  {
    key: text('key').primaryKey(), // 'finance', 'retail', ...
    name: text('name').notNull(),
    description: text('description'),
    minPlanTier: text('min_plan_tier'),
    isBeta: boolean('is_beta').notNull().default(false),
  },
  () => [
    pgPolicy('modules_public_read', {
      for: 'select',
      using: sql`true`,
    }),
  ]
).enableRLS();

export const tenantModules = pgTable(
  'tenant_modules',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    moduleKey: text('module_key')
      .notNull()
      .references(() => modules.key),
    enabled: boolean('enabled').notNull().default(false),
    config: jsonb('config').notNull().default({}),
    enabledAt: timestamp('enabled_at', { withTimezone: true }),
    enabledBy: uuid('enabled_by').references(() => users.id),
  },
  (table) => [
    tenantIsolation(table),
    primaryKey({ columns: [table.tenantId, table.moduleKey] }),
  ]
).enableRLS();

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(), // 'starter' | 'pro' | 'enterprise'
    name: text('name').notNull(),
    stripePriceId: text('stripe_price_id'),
    includedModules: text('included_modules').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy('plans_public_read', {
      for: 'select',
      using: sql`true`,
    }),
  ]
).enableRLS();
