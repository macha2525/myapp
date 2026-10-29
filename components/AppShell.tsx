'use client';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthGate';
import CalendarBoard from './CalendarBoard';
import EventBoard from './EventBoard';
import LabelsBoard from './LabelsBoard';
import PushSettings from './PushSettings';
import RoutineBoard from './RoutineBoard';
import TaskBoard from './TaskBoard';
import ThemeSwitcher from './ThemeSwitcher';
import { COPY } from '@/lib/copy';

type MainId = 'calendar' | 'events' | 'tasks';
type MoreId = 'appearance' | 'labels' | 'notifications' | 'account';
type ViewId = MainId | 'more' | MoreId;

// ── 主なタブ(ここは増やさない方針) ──
const MAIN = [
  { id: 'calendar', no: '01', en: 'Calendar', wide: true },
  { id: 'events', no: '02', en: 'Schedule', wide: false },
  { id: 'tasks', no: '03', en: 'Tasks', wide: false },
] as const;

// ── 「その他」の中身(カテゴリが増えたら、ここに足す) ──
const MORE_NO = '04';
const MORE_ITEMS = [
  { id: 'appearance', en: 'Appearance', desc: 'ライト/ダークと、アクセント色' },
  { id: 'labels', en: 'Labels', desc: '予定やタスクの色分けと、ラベルの名前' },
  { id: 'notifications', en: 'Notifications', desc: 'この端末への通知の許可、テスト送信' },
  { id: 'account', en: 'Account', desc: 'ログイン中のメールアドレス、ログアウト' },
] as const;

const MORE_IDS: string[] = MORE_ITEMS.map((m) => m.id);
const ALL_IDS: string[] = [...MAIN.map((m) => m.id), 'more', ...MORE_IDS];

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pad = (n: number) => String(n).padStart(2, '0');

function isMoreView(v: ViewId) {
  return v === 'more' || MORE_IDS.includes(v);
}

function metaOf(v: ViewId): { no: string; en: string; wide: boolean } {
  const main = MAIN.find((m) => m.id === v);
  if (main) return { no: main.no, en: main.en, wide: main.wide };
  if (v === 'more') return { no: MORE_NO, en: 'More', wide: false };
  const item = MORE_ITEMS.find((m) => m.id === v);
  if (item) return { no: MORE_NO, en: item.en, wide: false };
  return { no: MAIN[0].no, en: MAIN[0].en, wide: MAIN[0].wide };
}

function NavRow(props: { no: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className={`flex w-full items-baseline gap-3 border-l-2 px-5 py-2.5 text-left transition ${
        props.active ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
      }`}
    >
      <span className="font-mono text-[10px] tracking-wider">{props.no}</span>
      <span className="font-serif text-lg">{props.label}</span>
    </button>
  );
}

function SubRow(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className={`flex w-full items-baseline border-l-2 py-1.5 pl-11 pr-5 text-left transition ${
        props.active ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
      }`}
    >
      <span className="font-serif text-base">{props.label}</span>
    </button>
  );
}

// 「タスク」画面: 通常 / 定期 の切り替え
function TasksView() {
  const [mode, setMode] = useState<'normal' | 'routine'>('normal');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tasks-mode');
      if (saved === 'normal' || saved === 'routine') setMode(saved);
    } catch {}
  }, []);

  function change(m: 'normal' | 'routine') {
    setMode(m);
    try {
      localStorage.setItem('tasks-mode', m);
    } catch {}
  }

  const seg = (active: boolean) =>
    `flex-1 px-4 py-2 text-sm transition ${
      active ? 'bg-accent text-accent-fg' : 'text-muted hover:text-text'
    }`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex overflow-hidden rounded-xl border border-border">
          <button onClick={() => change('normal')} className={seg(mode === 'normal')}>
            通常
          </button>
          <button
            onClick={() => change('routine')}
            className={`${seg(mode === 'routine')} border-l border-border`}
          >
            定期
          </button>
        </div>
        <p className="font-mono text-[11px] tracking-wide text-muted">
          {mode === 'normal' ? '期限のある、単発のタスク' : '毎週・毎月くり返す、決まったタスク'}
        </p>
      </div>

      {mode === 'normal' ? <TaskBoard /> : <RoutineBoard />}
    </div>
  );
}

export default function AppShell() {
  const { email, logout } = useAuth();
  const [view, setView] = useState<ViewId>('calendar');

  // URLの #xxx と画面を連動させる(再読み込みしても、同じ画面に戻る)
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace('#', '');
      if (ALL_IDS.includes(h)) setView(h as ViewId);
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
  const meta = metaOf(view);
  const moreActive = isMoreView(view);
  const isSubView = moreActive && view !== 'more';
  const dateLine = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${
    WEEKDAYS[now.getDay()]
  }`;

  const tabs = [
    ...MAIN.map((m) => ({ id: m.id as ViewId, no: m.no, label: m.en, active: view === m.id })),
    { id: 'more' as ViewId, no: MORE_NO, label: 'More', active: moreActive },
  ];

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

        <nav className="flex-1 overflow-y-auto py-4">
          {MAIN.map((v) => (
            <NavRow
              key={v.id}
              no={v.no}
              label={v.en}
              active={view === v.id}
              onClick={() => go(v.id)}
            />
          ))}

          <NavRow no={MORE_NO} label="More" active={moreActive} onClick={() => go('more')} />
          {moreActive && (
            <div className="mb-1 mt-0.5">
              {MORE_ITEMS.map((m) => (
                <SubRow
                  key={m.id}
                  label={m.en}
                  active={view === m.id}
                  onClick={() => go(m.id)}
                />
              ))}
            </div>
          )}
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
          <div className={`px-5 py-8 lg:px-12 lg:py-12 ${meta.wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
            <header className="mb-8 border-b border-border pb-4">
              {isSubView && (
                <button
                  onClick={() => go('more')}
                  className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-muted transition hover:text-text lg:hidden"
                >
                  ← More
                </button>
              )}
              <p className="font-mono text-[11px] tracking-[0.22em] text-muted">Nº {meta.no}</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <h1 className="font-serif text-4xl tracking-tight lg:text-5xl">{meta.en}</h1>
                {(view === 'events' || view === 'tasks') && (
                  <button
                    onClick={() => go('labels')}
                    className="shrink-0 pb-1 text-xs text-muted underline underline-offset-4 transition hover:text-text"
                  >
                    {COPY.labels.openLink}
                  </button>
                )}
              </div>
            </header>

            {view === 'calendar' && <CalendarBoard />}
            {view === 'events' && <EventBoard />}
            {view === 'tasks' && <TasksView />}

            {view === 'more' && (
              <ul className="border-t border-border">
                {MORE_ITEMS.map((m) => (
                  <li key={m.id} className="border-b border-border">
                    <button
                      onClick={() => go(m.id)}
                      className="flex w-full items-baseline gap-4 px-1 py-4 text-left transition hover:bg-accent/5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-serif text-xl">{m.en}</span>
                        <span className="block text-xs text-muted">{m.desc}</span>
                      </span>
                      <span className="font-mono text-xs text-muted">→</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {view === 'appearance' && <ThemeSwitcher />}
            {view === 'labels' && <LabelsBoard />}
            {view === 'notifications' && <PushSettings />}
            {view === 'account' && (
              <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                <p className="break-all font-mono text-xs text-muted">{email}</p>
                <button
                  onClick={logout}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-text"
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* スマホ: 下のタブバー(4つ) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            className={`relative flex flex-col items-center gap-0.5 py-2.5 transition ${
              t.active ? 'text-text' : 'text-muted'
            }`}
          >
            {t.active && <span className="absolute inset-x-6 top-0 h-0.5 bg-accent" />}
            <span className="font-mono text-[9px] tracking-wider">{t.no}</span>
            <span className="font-serif text-[15px]">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}