// Finance module tables — the Phase 2 reference implementation of the module pattern (see
// modules/types.ts). Three tables, each tenant-scoped via the shared tenantIsolation() policy
// (db/schema/_shared.ts), modeled per the architecture plan's §6 migration sanity-check rather
// than copying the old Mendeez dashboard's parallel-arrays-by-year JSON shape:
//   - finance_pl_lines / finance_gst_entries: fact tables with a period dimension, so "add a
//     month" is a row insert, not a schema change, and the eventual Mendeez import is a
//     straightforward one-row-per-(period, line item) ETL.
//   - finance_cost_audit: keeps a `raw_import jsonb` escape hatch, because some of what the old
//     dashboard called "cost audit" (e.g. a GTech-vs-sheet barcode reconciliation diff) is closer
//     to a point-in-time report than a queryable fact, and forcing it into columns now would be
//     premature normalization of data that may never need to be queried relationally.
// Every row carries a `source` column ('gtech' | 'shopify' | 'manual' | 'legacy_json_migration')
// so manually-corrected figures stay distinguishable from system-of-record data — the old
// dashboard only had this as a free-text note, which the new schema makes a first-class, queryable
// field instead.
import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, integer, numeric, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from '@/db/schema/core';
import { tenantIsolation } from '@/db/schema/_shared';

const sourceColumn = () => text('source').notNull().default('manual'); // gtech | shopify | manual | legacy_json_migration

export const financePlLines = pgTable(
  'finance_pl_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    fiscalYear: integer('fiscal_year').notNull(),
    fiscalMonth: integer('fiscal_month').notNull(), // 1-12
    lineItem: text('line_item').notNull(), // e.g. 'net_sales', 'admin_expense', 'cogs'
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    source: sourceColumn(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [tenantIsolation(table)]
).enableRLS();

export const financeGstEntries = pgTable(
  'finance_gst_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    fiscalYear: integer('fiscal_year').notNull(),
    fiscalMonth: integer('fiscal_month').notNull(),
    gstType: text('gst_type').notNull(), // 'output' | 'input'
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    source: sourceColumn(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [tenantIsolation(table)]
).enableRLS();

export const financeCostAudit = pgTable(
  'finance_cost_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    periodLabel: text('period_label'), // free-form, e.g. 'FY26 Q2' — audits don't always align to a month
    rawImport: jsonb('raw_import').notNull().default(sql`'{}'::jsonb`),
    source: sourceColumn(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [tenantIsolation(table)]
).enableRLS();
