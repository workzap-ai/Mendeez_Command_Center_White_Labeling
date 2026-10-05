import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTenantAction } from '../actions';

export default async function AdminTenantsPage() {
  const admin = createAdminClient();
  const { data: tenants } = await admin
    .from('tenants')
    .select('id, slug, name, status, created_at')
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-lg font-semibold">Tenants</h1>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-1 pr-4">Name</th>
            <th className="py-1 pr-4">Slug</th>
            <th className="py-1 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {(tenants ?? []).map((t) => (
            <tr key={t.id} className="border-b">
              <td className="py-1 pr-4">
                <Link href={`/admin/tenants/${t.id}`} className="underline">
                  {t.name}
                </Link>
              </td>
              <td className="py-1 pr-4 font-mono text-xs">{t.slug}</td>
              <td className="py-1 pr-4">{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <form action={createTenantAction} className="mt-8 flex gap-2">
        <input name="name" required placeholder="New tenant name" className="rounded border px-3 py-2 text-sm" />
        <button type="submit" className="rounded bg-black px-3 py-2 text-sm font-medium text-white">
          Create tenant
        </button>
      </form>
    </main>
  );
}
