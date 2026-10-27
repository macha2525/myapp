'use client';
import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark' | 'system';

const MODES: { id: Mode; label: string }[] = [
  { id: 'light', label: 'ライト' },
  { id: 'dark', label: 'ダーク' },
  { id: 'system', label: '自動' },
];

const ACCENTS = [
  { id: 'indigo', label: 'インディゴ', color: '#3b4a7a' },
  { id: 'bordeaux', label: 'ボルドー', color: '#7a2e3f' },
  { id: 'moss', label: 'モス', color: '#3f5d4a' },
  { id: 'amber', label: 'アンバー', color: '#8a5a14' },
  { id: 'slate', label: 'スレート', color: '#2b2e36' },
];

function apply(mode: Mode, accent: string) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.accent = accent;
  try {
    localStorage.setItem('theme-mode', mode);
    localStorage.setItem('theme-accent', accent);
  } catch {}
}

export default function ThemeSwitcher() {
  const [mode, setMode] = useState<Mode>('system');
  const [accent, setAccent] = useState('slate');

  useEffect(() => {
    setMode((localStorage.getItem('theme-mode') as Mode) || 'system');
    setAccent(localStorage.getItem('theme-accent') || 'slate');
  }, []);

  // 「自動」のとき、端末側の設定変更にも追従する
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system', accent);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode, accent]);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); apply(m.id, accent); }}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              mode === m.id
                ? 'bg-accent text-accent-fg'
                : 'border border-border text-muted hover:text-text'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            aria-label={a.label}
            title={a.label}
            onClick={() => { setAccent(a.id); apply(mode, a.id); }}
            style={{ backgroundColor: a.color }}
            className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition ${
              accent === a.id ? 'ring-2 ring-text' : ''
            }`}
          />
        ))}
      </div>
    </div>
  );
}