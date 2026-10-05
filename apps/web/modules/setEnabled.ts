// Shared by every write path that flips a tenant's module on/off (the admin toggle button and
// lib/billing/syncModulesFromPlan.ts's additions), so the upsert shape — including enabled_by,
// the one audit column every write path used to forget to set — lives in exactly one place.
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export async function setModuleEnabled(
  tenantId: string,
  moduleKey: string,
  enabled: boolean,
  actingUserId: string | null
) {
  const admin = createAdminClient();
  const { error } = await admin.from('tenant_modules').upsert(
    {
      tenant_id: tenantId,
      module_key: moduleKey,
      enabled,
      enabled_at: enabled ? new Date().toISOString() : null,
      enabled_by: enabled ? actingUserId : null,
    },
    { onConflict: 'tenant_id,module_key' }
  );
  if (error) throw new Error(error.message);
}
