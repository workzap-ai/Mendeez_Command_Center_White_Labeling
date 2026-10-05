'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/lib/tenant/context';

export default function SignInPage() {
  const tenant = useTenant();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-lg font-semibold">Sign in to {tenant.name}</h1>
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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded px-3 py-2 text-sm font-medium text-[var(--brand-primary-foreground)]"
          style={{ background: 'var(--brand-primary)' }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-xs text-gray-500">
        No account yet? <a href="/sign-up" className="underline">Sign up</a> (local/dev only — a
        platform admin provisions real tenant users in production).
      </p>
    </main>
  );
}
