// Generic nav renderer — reads which modules are enabled for this tenant and renders their
// navEntries from MODULE_REGISTRY. This is the "UI" half of module enforcement; modules/guard.ts
// is the server-side half that makes hiding a link here actually matter (see its header comment).
// Works for any module without modification — nothing here names "finance" specifically.
import { createClient } from '@/lib/supabase/server';
import { MODULE_REGISTRY } from './registry';

export async function ModuleNav({ tenantId }: { tenantId: string }) {
  const supabase = await createClient();
  const { data: enabledRows } = await supabase
    .from('tenant_modules')
    .select('module_key')
    .eq('tenant_id', tenantId)
    .eq('enabled', true);

  const enabledKeys = new Set((enabledRows ?? []).map((r) => r.module_key as string));
  const entries = Object.values(MODULE_REGISTRY)
    .filter((mod) => enabledKeys.has(mod.key))
    .flatMap((mod) => mod.navEntries);

  if (entries.length === 0) return null;

  return (
    <nav className="flex gap-4 border-b px-8 py-3 text-sm">
      {entries.map((entry) => (
        <a key={entry.href} href={entry.href} className="hover:underline">
          {entry.label}
        </a>
      ))}
    </nav>
  );
}
