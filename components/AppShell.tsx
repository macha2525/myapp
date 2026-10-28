'use client';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthGate';
import CalendarBoard from './CalendarBoard';
import EventBoard from './EventBoard';
import PushSettings from './PushSettings';
import RoutineBoard from './RoutineBoard';
import TaskBoard from './TaskBoard';
import ThemeSwitcher from './ThemeSwitcher';

type ViewId = 'calendar' | 'events' | 'routines' | 'tasks' | 'settings';

const VIEWS: { id: ViewId; no: string; ja: string; short: string; en: string; wide: boolean }[] = [
  { id: 'calendar', no: '01', ja: 'カレンダー', short: '暦', en: 'Calendar', wide: true },
  { id: 'events', no: '02', ja: '予定', short: '予定', en: 'Schedule', wide: false },
  { id: 'routines', no: '03', ja: '定期タスク', short: '定期', en: 'Routine', wide: false },
  { id: 'tasks', no: '04', ja: 'タスク', short: '課題', en: 'Tasks', wide: false },
  { id: 'settings', no: '05', ja: '設定', short: '設定', en: 'Settings', wide: false },
];

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pad = (n: number) => String(n).padStart(2, '0');

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">{children}</h2>
  );
}

export default function AppShell() {
  const { email, logout } = useAuth();
  const [view, setView] = useState<ViewId>('calendar');

  // URLの #xxx と画面を連動させる(再読み込みしても、同じ画面に戻る)
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace('#', '');
      const found = VIEWS.find((v) => v.id === h);
      if (found) setView(found.id);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  function go(id: ViewId) {
    setView(id);
    window.history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top: 0 });
  }

  const now = new Date();
  const cur = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const dateLine = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${
    WEEKDAYS[now.getDay()]
  }`;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* PC: 左のナビゲーション */}
      <aside className="hidden border-r border-border lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-border px-6 pb-6 pt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            Personal Index
          </p>
          <p className="mt-2 font-serif text-4xl italic tracking-tight">Life</p>
        </div>

        <div className="border-b border-border px-6 py-5">
          <p className="font-serif text-6xl leading-none">{pad(now.getDate())}</p>
          <p className="mt-3 font-mono text-[11px] tracking-[0.15em] text-muted">
            {now.getFullYear()}.{pad(now.getMonth() + 1)} / {WEEKDAYS[now.getDay()]}
          </p>
        </div>

        <nav className="flex-1 py-4">
          {VIEWS.map((v) => {
            const active = v.id === view;
            return (
              <button
                key={v.id}
                onClick={() => go(v.id)}
                className={`group flex w-full items-baseline gap-3 border-l-2 px-5 py-2.5 text-left transition ${
                  active
                    ? 'border-accent text-text'
                    : 'border-transparent text-muted hover:text-text'
                }`}
              >
                <span className="font-mono text-[10px] tracking-wider">{v.no}</span>
                <span className="font-serif text-base">{v.ja}</span>
                <span className="ml-auto font-serif text-xs italic opacity-0 transition group-hover:opacity-60">
                  {v.en}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border px-6 py-4">
          <p className="truncate font-mono text-[10px] text-muted" title={email}>
            {email}
          </p>
          <button
            onClick={logout}
            className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted underline underline-offset-4 transition hover:text-text"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* スマホ: 上の細いヘッダー */}
        <header className="flex items-end justify-between border-b border-border px-5 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:hidden">
          <p className="font-serif text-2xl italic">Life</p>
          <p className="font-mono text-[11px] tracking-[0.15em] text-muted">{dateLine}</p>
        </header>

        <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <div
            className={`px-5 py-8 lg:px-12 lg:py-12 ${
              cur.wide ? 'max-w-5xl' : 'max-w-2xl'
            }`}
          >
            <header className="mb-8 border-b border-border pb-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
                Nº {cur.no} — {cur.en}
              </p>
              <h1 className="mt-2 font-serif text-3xl tracking-tight lg:text-4xl">{cur.ja}</h1>
            </header>

            {view === 'calendar' && <CalendarBoard />}
            {view === 'events' && <EventBoard />}
            {view === 'routines' && <RoutineBoard />}
            {view === 'tasks' && <TaskBoard />}
            {view === 'settings' && (
              <div className="space-y-10">
                <section className="space-y-3">
                  <SectionLabel>Theme / テーマ</SectionLabel>
                  <ThemeSwitcher />
                </section>
                <section className="space-y-3">
                  <SectionLabel>Notifications / 通知</SectionLabel>
                  <PushSettings />
                </section>
                <section className="space-y-3">
                  <SectionLabel>Account / アカウント</SectionLabel>
                  <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                    <p className="break-all font-mono text-xs text-muted">{email}</p>
                    <button
                      onClick={logout}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-text"
                    >
                      ログアウト
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* スマホ: 下のタブバー */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {VIEWS.map((v) => {
          const active = v.id === view;
          return (
            <button
              key={v.id}
              onClick={() => go(v.id)}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 transition ${
                active ? 'text-text' : 'text-muted'
              }`}
            >
              {active && <span className="absolute inset-x-5 top-0 h-0.5 bg-accent" />}
              <span className="font-mono text-[9px] tracking-wider">{v.no}</span>
              <span className="font-serif text-[13px]">{v.short}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}