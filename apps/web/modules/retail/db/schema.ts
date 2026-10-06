// Third module — picked specifically because it was the owner's own example ("finance wale,
// retail jo bhi") and because the architecture plan called it out as the most complex module
// (stock, commission, targets, self-audit in the real Mendeez system), the better stress test of
// whether the pattern holds once a module needs MULTIPLE related tables with a real foreign key
// between them, not just one or three flat ones.
//
// Scoped deliberately small for this reference build: outlets (store locations) + a daily sales
// fact table per outlet. Modeled the same way Finance was — period dimension on the fact table
// (retail_daily_sales keyed by outlet + date), not a wide table with one column per day.
import { pgTable, uuid, text, date, integer, numeric, timestamp, unique } from 'drizzle-orm/pg-core';
import { tenants } from '@/db/schema/core';
import { tenantIsolation } from '@/db/schema/_shared';

export const retailOutlets = pgTable(
  'retail_outlets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: text('code').notNull(), // short stable id, e.g. 'DHA-01' — unique per tenant
    name: text('name').notNull(),
    city: text('city'),
    managerName: text('manager_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [tenantIsolation(table), unique('retail_outlets_tenant_code_unique').on(table.tenantId, table.code)]
).enableRLS();

export const retailDailySales = pgTable(
  'retail_daily_sales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => retailOutlets.id, { onDelete: 'cascade' }),
    saleDate: date('sale_date').notNull(),
    netSales: numeric('net_sales', { precision: 18, scale: 2 }).notNull(),
    transactions: integer('transactions').notNull().default(0),
    footfall: integer('footfall'),
    source: text('source').notNull().default('manual'), // pos | manual | legacy_json_migration
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    tenantIsolation(table),
    // One row per (outlet, day) — a second import for the same day should update, not duplicate.
    unique('retail_daily_sales_outlet_date_unique').on(table.outletId, table.saleDate),
  ]
).enableRLS();
