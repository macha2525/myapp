'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login');
        return;
      }
      setEmail(data.user.email ?? '');
      setChecked(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function logout() {
    await createClient().auth.signOut();
    router.replace('/login');
  }

  if (!checked) {
    return <p className="p-6 text-sm text-muted">読み込み中…</p>;
  }

  return (
    <>
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-4 text-xs text-muted">
        <span>{email}</span>
        <button onClick={logout} className="underline underline-offset-4 hover:text-text">
          ログアウト
        </button>
      </div>
      {children}
    </>
  );
}