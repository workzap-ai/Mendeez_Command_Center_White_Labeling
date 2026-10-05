'use client';

// Local/dev convenience only — creates a Supabase Auth user but NOT a tenant_memberships row
// (that requires a platform-admin decision, which Phase 3 gives a real UI to; for now, insert it
// by hand per apps/web/README.md "Local development"). Signing up here does not, by itself, grant
// access to anything — RLS has nothing to show a user with zero memberships.
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/lib/tenant/context';

export default function SignUpPage() {
  const tenant = useTenant();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      return;
    }
    setMessage(
      `Created ${data.user?.id ?? '(pending email confirmation)'}. Now give this user a ` +
        `tenant_memberships row for ${tenant.slug} — see apps/web/README.md.`
    );
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-lg font-semibold">Create a dev account on {tenant.name}</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <button
          type="submit"
          className="rounded px-3 py-2 text-sm font-medium text-[var(--brand-primary-foreground)]"
          style={{ background: 'var(--brand-primary)' }}
        >
          Sign up
        </button>
      </form>
    </main>
  );
}
