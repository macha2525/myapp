'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { WEEKDAY_LABELS } from '@/lib/routine';
import { useLabels } from '@/lib/labels';
import { LabelPicker } from './LabelUI';

type Props = { onCreated: () => void };

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 月曜始まりの並び

function chip(active: boolean) {
  return `rounded-lg px-3 py-1.5 text-sm transition ${
    active
      ? 'bg-accent text-accent-fg'
      : 'border border-border text-muted hover:text-text'
  }`;
}

export default function RoutineForm({ onCreated }: Props) {
  const [supabase] = useState(() => createClient());
  const [title, setTitle] = useState('');
  const [recurrence, setRecurrence] = useState<'weekly' | 'monthly'>('weekly');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [monthMode, setMonthMode] = useState<'day' | 'last_day' | 'nth_weekday'>('day');
  const [monthDays, setMonthDays] = useState<number[]>([]);
  const [nthWeek, setNthWeek] = useState(1);
  const [nthWeekday, setNthWeekday] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
    const { nameOf } = useLabels();
  const [labelSlot, setLabelSlot] = useState<number | null>(null);

  function toggle(list: number[], v: number) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError('名前を入力してね。');

    let payload: Record<string, unknown> = { title: t, recurrence };

    if (recurrence === 'weekly') {
      if (weekdays.length === 0) return setError('曜日を1つ以上選んでね。');
      payload = { ...payload, weekdays };
    } else if (monthMode === 'day') {
      if (monthDays.length === 0) return setError('日付を1つ以上選んでね。');
      payload = { ...payload, month_mode: 'day', month_days: monthDays, clamp_to_month_end: true };
    } else if (monthMode === 'last_day') {
      payload = { ...payload, month_mode: 'last_day' };
    } else {
      payload = { ...payload, month_mode: 'nth_weekday', weekdays: [nthWeekday], nth_week: nthWeek };
    }

    setSaving(true);
    setError(null);
    const { error } = await supabase.from('routine_tasks').insert({ ...payload, label_slot: labelSlot });

    if (error) return setError('追加に失敗しました。');

    setTitle('');
    setWeekdays([]);
    setMonthDays([]);
    setLabelSlot(null);
    onCreated();
  }

  const selectClass =
    'rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent';

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="定期タスクの名前(例: ゴミ出し)"
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
      />

      <div className="flex gap-2">
        <button type="button" onClick={() => setRecurrence('weekly')} className={chip(recurrence === 'weekly')}>
          毎週
        </button>
        <button type="button" onClick={() => setRecurrence('monthly')} className={chip(recurrence === 'monthly')}>
          毎月
        </button>
      </div>

      {recurrence === 'weekly' && (
        <div className="flex flex-wrap gap-2">
          {WEEK_ORDER.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWeekdays(toggle(weekdays, w))}
              className={chip(weekdays.includes(w))}
            >
              {WEEKDAY_LABELS[w]}
            </button>
          ))}
        </div>
      )}

      {recurrence === 'monthly' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setMonthMode('day')} className={chip(monthMode === 'day')}>
              日付で指定
            </button>
            <button type="button" onClick={() => setMonthMode('last_day')} className={chip(monthMode === 'last_day')}>
              月末
            </button>
            <button type="button" onClick={() => setMonthMode('nth_weekday')} className={chip(monthMode === 'nth_weekday')}>
              第N曜日
            </button>
          </div>

          {monthMode === 'day' && (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMonthDays(toggle(monthDays, n))}
                    className={`rounded-md py-1.5 text-xs transition ${
                      monthDays.includes(n)
                        ? 'bg-accent text-accent-fg'
                        : 'border border-border text-muted hover:text-text'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">
                29〜31日を選んで、その日がない月は、その月の末日に実施する扱いになるよ。
              </p>
            </div>
          )}

          {monthMode === 'nth_weekday' && (
            <div className="flex gap-2">
              <select value={nthWeek} onChange={(e) => setNthWeek(Number(e.target.value))} className={selectClass}>
                <option value={1}>第1</option>
                <option value={2}>第2</option>
                <option value={3}>第3</option>
                <option value={4}>第4</option>
                <option value={-1}>最終</option>
              </select>
              <select value={nthWeekday} onChange={(e) => setNthWeekday(Number(e.target.value))} className={selectClass}>
                {WEEK_ORDER.map((w) => (
                  <option key={w} value={w}>
                    {WEEKDAY_LABELS[w]}曜日
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

     <LabelPicker value={labelSlot} onChange={setLabelSlot} nameOf={nameOf} />
      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? '追加中…' : '定期タスクを追加'}
      </button>
    </form>
  );
}