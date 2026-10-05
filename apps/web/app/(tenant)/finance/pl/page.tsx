// The Phase 2 reference page: a tenant without the Finance module enabled gets notFound() here
// even if they type this URL directly (requireModule does a real DB check, not a nav-hiding
// trick) — see modules/guard.ts. Rows beyond that are scoped by RLS automatically; this page never
// adds its own `.eq('tenant_id', ...)` filter for authorization, only (optionally) for query shape.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentTenantId } from '@/lib/tenant/current';
import { requireModule } from '@/modules/guard';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default async function FinancePlPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const tenantId = await getCurrentTenantId();
  await requireModule('finance', tenantId);

  const { data: lines } = await supabase
    .from('finance_pl_lines')
    .select('fiscal_year, fiscal_month, line_item, amount, source')
    .order('fiscal_year', { ascending: false })
    .order('fiscal_month', { ascending: false });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-lg font-semibold">P&amp;L</h1>
      {!lines?.length ? (
        <p className="mt-4 text-sm text-gray-500">No P&amp;L lines recorded yet.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1 pr-4">Period</th>
              <th className="py-1 pr-4">Line item</th>
              <th className="py-1 pr-4 text-right">Amount</th>
              <th className="py-1 pr-4">Source</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((row, i) => (
              <tr key={i} className="border-b">
                <td className="py-1 pr-4">
                  {MONTHS[row.fiscal_month - 1]} {row.fiscal_year}
                </td>
                <td className="py-1 pr-4">{row.line_item}</td>
                <td className="py-1 pr-4 text-right font-mono">{row.amount}</td>
                <td className="py-1 pr-4 text-xs text-gray-500">{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
