// Called from two places: the Stripe webhook on a real subscription change, and the admin UI's
// "assign plan" action (so a manual assignment behaves the same as a paid one). Architecture plan
// §5's judgment call, now actually encoded: ADDITIONS apply immediately (a tenant should get a
// module the moment they're entitled to it), REMOVALS are deliberately left alone rather than
// auto-disabled — a payment-driven plan change landing mid-task should not yank a module with no
// warning. Today "left alone" means exactly that: the row keeps whatever enabled state it had.
// Phase 3+ follow-up (not built): a `needs_review` flag so the admin panel can surface "this
// tenant has modules outside their current plan" instead of that state being invisible.
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

// actingUserId: the admin who triggered this via the UI, or null for a Stripe-webhook-driven
// sync (no human to attribute it to) — populates tenant_modules.enabled_by.
export async function syncModulesFromPlan(tenantId: string, planId: string, actingUserId: string | null = null) {
  const admin = createAdminClient();

  const { data: plan, error: planErr } = await admin
    .from('plans')
    .select('included_modules')
    .eq('id', planId)
    .maybeSingle();
  if (planErr) throw new Error(planErr.message);
  if (!plan) return; // plan_id cleared or unknown — nothing to grant

  const included: string[] = plan.included_modules ?? [];
  if (!included.length) return;

  const { data: existing } = await admin
    .from('tenant_modules')
    .select('module_key, enabled')
    .eq('tenant_id', tenantId)
    .in('module_key', included);

  const alreadyEnabled = new Set((existing ?? []).filter((r) => r.enabled).map((r) => r.module_key));
  const toEnable = included.filter((key) => !alreadyEnabled.has(key));
  if (!toEnable.length) return;

  const rows = toEnable.map((moduleKey) => ({
    tenant_id: tenantId,
    module_key: moduleKey,
    enabled: true,
    enabled_at: new Date().toISOString(),
    enabled_by: actingUserId,
  }));
  const { error: upsertErr } = await admin.from('tenant_modules').upsert(rows, { onConflict: 'tenant_id,module_key' });
  if (upsertErr) throw new Error(upsertErr.message);
}
