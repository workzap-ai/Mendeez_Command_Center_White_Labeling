#!/usr/bin/env node
// The single highest-leverage safeguard in the multi-tenant design (architecture plan §2): a
// forgotten RLS policy on one new tenant-scoped table is a cross-tenant data leak, not a bug that
// shows up as a failing test — it shows up as tenant A reading tenant B's data. This script makes
// "every tenant-scoped table is isolated" an enforced fact instead of a hope, by scanning every
// migration (not just the one that created a table — 0002/0004 add FORCE RLS to tables created in
// earlier files, so this has to look at the cumulative migration history, not one file at a time)
// and failing if any table with a tenant_id column lacks either a CREATE POLICY or a FORCE ROW
// LEVEL SECURITY statement somewhere in that history.
//
// Run via `npm run check:rls` before every commit that touches supabase/migrations/ or a module's
// db/schema.ts — wire it into CI once this repo has CI.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const allSql = files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n');

// Table name -> has a tenant_id column (from its CREATE TABLE block).
const tenantScopedTables = new Set();
const createTableRe = /CREATE TABLE "(\w+)" \(([\s\S]*?)\n\);/g;
for (const match of allSql.matchAll(createTableRe)) {
  const [, tableName, body] = match;
  if (/"tenant_id"/.test(body)) tenantScopedTables.add(tableName);
}

const tablesWithPolicy = new Set();
const policyRe = /CREATE POLICY "[^"]+" ON "(\w+)"/g;
for (const match of allSql.matchAll(policyRe)) tablesWithPolicy.add(match[1]);

const tablesWithForce = new Set();
const forceRe = /ALTER TABLE (?:public\.)?"?(\w+)"?\s+force row level security/gi;
for (const match of allSql.matchAll(forceRe)) tablesWithForce.add(match[1]);

const missingPolicy = [...tenantScopedTables].filter((t) => !tablesWithPolicy.has(t));
const missingForce = [...tenantScopedTables].filter((t) => !tablesWithForce.has(t));

if (missingPolicy.length || missingForce.length) {
  console.error(`RLS coverage check FAILED across ${files.length} migration file(s):\n`);
  if (missingPolicy.length) {
    console.error(`  Missing CREATE POLICY for tenant-scoped table(s): ${missingPolicy.join(', ')}`);
  }
  if (missingForce.length) {
    console.error(`  Missing FORCE ROW LEVEL SECURITY for tenant-scoped table(s): ${missingForce.join(', ')}`);
  }
  console.error('\nEvery table with a tenant_id column must have both. See db/schema/_shared.ts'
    + ' (tenantIsolation policy) and supabase/migrations/0002_rls_support.sql / 0004_finance_force_rls.sql'
    + ' (FORCE pattern) for the two pieces every new module needs to add.');
  process.exit(1);
}

console.log(`RLS coverage OK — ${tenantScopedTables.size} tenant-scoped table(s) across ${files.length} migration file(s), all policy'd and forced.`);
