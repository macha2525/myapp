'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type AuthInfo = { email: string; logout: () => Promise<void> };

const AuthContext = createContext<AuthInfo | null>(null);

export function useAuth(): AuthInfo {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth は AuthGate の中で使ってね');
  return ctx;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">Loading</p>
      </div>
    );
  }

  return <AuthContext.Provider value={{ email, logout }}>{children}</AuthContext.Provider>;
}