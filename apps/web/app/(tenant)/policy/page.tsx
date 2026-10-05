import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentTenantId } from '@/lib/tenant/current';
import { requireModule } from '@/modules/guard';

type Gap = { field: string; prompt: string; for: string; answer: string | null };

const STATUS_LABEL: Record<string, string> = {
  approved: 'LIVE',
  draft: 'DRAFT',
  needs_input: 'NOT WRITTEN YET',
};

export default async function PolicyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const tenantId = await getCurrentTenantId();
  await requireModule('policy', tenantId);

  const { data: policies } = await supabase
    .from('policies')
    .select('id, code, department, title, status, version, rule, detail, gaps, owner')
    .order('department')
    .order('code');

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-lg font-semibold">Policies &amp; SOPs</h1>
      <p className="mt-1 text-sm text-gray-500">
        One place for every rule this business runs on — seeded, filled by each department, then approved.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {(policies ?? []).map((p) => {
          const gaps = ((p.gaps as Gap[]) ?? []).filter((g) => g.answer == null);
          return (
            <div key={p.id} className="rounded border p-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{p.title}</h2>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
                <span className="ml-auto font-mono text-[10px] text-gray-400">
                  {p.code} &middot; v{p.version}
                </span>
              </div>
              <p className="mt-2 text-sm">{p.rule ?? <em className="text-gray-400">No rule written yet.</em>}</p>
              {gaps.length > 0 && (
                <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs">
                  <b className="text-amber-700">{gaps.length} blank(s) waiting on {p.department}</b>
                  <ul className="mt-1 list-disc pl-4">
                    {gaps.map((g, i) => (
                      <li key={i}>{g.field}: {g.prompt}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.owner && <p className="mt-2 text-xs text-gray-400">owner: {p.owner}</p>}
            </div>
          );
        })}
        {!policies?.length && <p className="text-sm text-gray-500">No policies recorded yet for this tenant.</p>}
      </div>
    </main>
  );
}
