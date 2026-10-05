// Server-side enforcement that a tenant's module access is real, not just hidden from nav. Call
// this at the top of every module route's layout/page and every module API route handler — a
// tenant without Finance enabled must get blocked here even if they guess the URL directly, not
// merely fail to see a nav link for it.
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function requireModule(moduleKey: string, tenantId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tenant_modules')
    .select('enabled')
    .eq('tenant_id', tenantId)
    .eq('module_key', moduleKey)
    .maybeSingle();

  // RLS already restricts this query to the caller's own tenant(s); a missing row or an explicit
  // enabled=false both mean "not entitled" and are treated identically — there is no case where
  // absence of a row should be more permissive than an explicit false.
  if (error || !data?.enabled) notFound();
}
