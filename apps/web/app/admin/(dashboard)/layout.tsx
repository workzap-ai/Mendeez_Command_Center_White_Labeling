import { requirePlatformAdmin } from '@/lib/auth/platform-admin';

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div>
      <div className="border-b px-8 py-3 text-sm font-semibold">Commerce Center — Platform Admin</div>
      {children}
    </div>
  );
}
