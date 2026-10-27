'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError('メールアドレスかパスワードが間違っています');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Life App</h1>
        <p className="text-sm text-muted">ログインしてね。</p>
      </header>

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg transition disabled:opacity-50"
        >
          {loading ? '確認中…' : 'ログイン'}
        </button>
      </form>
    </main>
  );
}