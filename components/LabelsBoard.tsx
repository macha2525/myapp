'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LABEL_SLOTS, PIGMENTS, useLabels } from '@/lib/labels';
import { COPY } from '@/lib/copy';
import { LabelSwatch } from './LabelUI';

export default function LabelsBoard() {
  const [supabase] = useState(() => createClient());
  const { loading, saved, reload } = useLabels();
  const [names, setNames] = useState<string[]>(['', '', '', '', '', '']);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 保存済みの名前を、入力欄に読み込む(最初の1回だけ)
  useEffect(() => {
    if (loading || ready) return;
    setNames(LABEL_SLOTS.map((s) => saved[s] ?? ''));
    setReady(true);
  }, [loading, ready, saved]);

  function setName(slot: number, value: string) {
    setNames((prev) => prev.map((n, i) => (i === slot - 1 ? value : n)));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const rows = LABEL_SLOTS.map((s) => ({ slot: s, name: names[s - 1].trim() }));
    const { error } = await supabase.from('labels').upsert(rows, { onConflict: 'user_id,slot' });
    setSaving(false);
    if (error) {
      setMessage(COPY.labels.saveFailed);
      return;
    }
    setMessage(COPY.labels.saved);
    reload();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-muted">{COPY.labels.intro}</p>

      <ul className="border-t border-border">
        {LABEL_SLOTS.map((s) => (
          <li key={s} className="flex items-center gap-4 border-b border-border py-3">
            <LabelSwatch slot={s} size={28} />
            <span className="w-24 shrink-0 font-serif text-lg italic text-muted">{PIGMENTS[s - 1]}</span>
            <input
              value={names[s - 1]}
              onChange={(e) => setName(s, e.target.value)}
              maxLength={20}
              placeholder={COPY.labels.placeholder}
              className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !ready}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
        >
          {COPY.labels.save}
        </button>
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>
    </div>
  );
}