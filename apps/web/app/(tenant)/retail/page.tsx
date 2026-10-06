import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentTenantId } from '@/lib/tenant/current';
import { requireModule } from '@/modules/guard';

export default async function RetailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const tenantId = await getCurrentTenantId();
  await requireModule('retail', tenantId);

  const { data: outlets } = await supabase.from('retail_outlets').select('id, code, name, city, manager_name').order('code');

  const { data: sales } = await supabase
    .from('retail_daily_sales')
    .select('outlet_id, sale_date, net_sales, transactions')
    .order('sale_date', { ascending: false });

  const salesByOutlet = new Map<string, { total: number; days: number; latestDate: string | null }>();
  for (const row of sales ?? []) {
    const agg = salesByOutlet.get(row.outlet_id) ?? { total: 0, days: 0, latestDate: null };
    agg.total += Number(row.net_sales);
    agg.days += 1;
    if (!agg.latestDate || row.sale_date > agg.latestDate) agg.latestDate = row.sale_date;
    salesByOutlet.set(row.outlet_id, agg);
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-lg font-semibold">Retail / Outlets</h1>
      {!outlets?.length ? (
        <p className="mt-4 text-sm text-gray-500">No outlets recorded yet for this tenant.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1 pr-4">Code</th>
              <th className="py-1 pr-4">Outlet</th>
              <th className="py-1 pr-4">City</th>
              <th className="py-1 pr-4">Manager</th>
              <th className="py-1 pr-4 text-right">Net sales (recorded days)</th>
            </tr>
          </thead>
          <tbody>
            {outlets.map((o) => {
              const agg = salesByOutlet.get(o.id);
              return (
                <tr key={o.id} className="border-b">
                  <td className="py-1 pr-4 font-mono text-xs">{o.code}</td>
                  <td className="py-1 pr-4">{o.name}</td>
                  <td className="py-1 pr-4 text-xs text-gray-500">{o.city ?? '—'}</td>
                  <td className="py-1 pr-4 text-xs text-gray-500">{o.manager_name ?? '—'}</td>
                  <td className="py-1 pr-4 text-right font-mono">
                    {agg ? `${agg.total.toLocaleString()} (${agg.days}d)` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
