// Shared by every tenant-scoped table across core and module schemas — one definition of "what
// tenant isolation means" so a module author copies a function call, not a policy expression they
// could get subtly wrong. See modules/finance/db/schema.ts for how a module schema uses this.
import { sql } from 'drizzle-orm';
import { pgPolicy, type PgColumn } from 'drizzle-orm/pg-core';

export const tenantIsolation = (table: { tenantId: PgColumn }) =>
  pgPolicy('tenant_isolation', {
    for: 'all',
    using: sql`${table.tenantId} in (select current_tenant_ids())`,
    withCheck: sql`${table.tenantId} in (select current_tenant_ids())`,
  });
