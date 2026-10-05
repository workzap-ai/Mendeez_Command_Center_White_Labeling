// Gate for the /admin surface — the platform owner's panel, not a tenant's. Checked via the
// RLS-scoped client (users_self_read policy in db/schema/core.ts lets a user read their OWN row,
// which is all this needs), not the admin/service-role client — there is no reason to bypass RLS
// just to answer "is the CURRENT user a platform admin."
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Not /sign-in — that page lives under app/(tenant)/ and requires a resolved tenant, which the
  // bare platform-admin host never has (resolveTenantByHost legitimately returns null for it).
  if (!user) redirect('/admin/sign-in');

  const { data: profile } = await supabase.from('users').select('is_platform_admin').eq('id', user.id).maybeSingle();

  if (!profile?.is_platform_admin) redirect('/');
  return user;
}
