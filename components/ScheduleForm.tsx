'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { WEEKDAY_LABELS, ymd } from '@/lib/routine';

type Props = { onCreated: () => void };

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 月曜始まりの並び

function chip(active: boolean) {
  return `rounded-lg px-3 py-1.5 text-sm transition ${
    active ? 'bg-accent text-accent-fg' : 'border border-border text-muted hover:text-text'
  }`;
}

const inputClass =
  'rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent';

export default function ScheduleForm({ onCreated }: Props) {
  const [supabase] = useState(() => createClient());
  const todayStr = ymd(new Date());

  const [kind, setKind] = useState<'single' | 'weekly'>('weekly');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');

  // 単発
  const [date, setDate] = useState(todayStr);
  const [allDay, setAllDay] = useState(false);

  // 毎週
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [periodStart, setPeriodStart] = useState(todayStr);
  const [periodEnd, setPeriodEnd] = useState('');

  // 共通
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleDay(w: number) {
    setWeekdays((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError('名前を入力してね。');

    const needTime = kind === 'weekly' || !allDay;
    if (needTime && !startTime) return setError('開始時刻を入力してね。');
    if (kind === 'weekly' && !endTime) return setError('終了時刻を入力してね。');
    if (startTime && endTime && endTime <= startTime) {
      return setError('終了時刻は、開始時刻より後にしてね。');
    }

    let payload: Record<string, unknown> = {
      title: t,
      location: location.trim() || null,
      kind,
    };

    if (kind === 'single') {
      if (!date) return setError('日付を選んでね。');
      payload = {
        ...payload,
        all_day: allDay,
        start_date: date,
        start_time: allDay ? null : startTime,
        end_time: allDay ? null : endTime || null,
      };
    } else {
      if (weekdays.length === 0) return setError('曜日を1つ以上選んでね。');
      if (!periodStart || !periodEnd) return setError('期間の開始日と終了日を入れてね。');
      if (periodEnd < periodStart) return setError('終了日は、開始日より後にしてね。');
      payload = {
        ...payload,
        all_day: false,
        start_date: periodStart,
        end_date: periodEnd,
        weekdays,
        start_time: startTime,
        end_time: endTime,
      };
    }

    setSaving(true);
    setError(null);
    const { error } = await supabase.from('schedules').insert(payload);
    setSaving(false);

    if (error) return setError('追加に失敗しました。');

    setTitle('');
    setLocation('');
    setStartTime('');
    setEndTime('');
    setWeekdays([]);
    onCreated();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setKind('weekly')} className={chip(kind === 'weekly')}>
          毎週(授業など)
        </button>
        <button type="button" onClick={() => setKind('single')} className={chip(kind === 'single')}>
          単発
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={kind === 'weekly' ? '名前(例: 線形代数)' : '名前(例: バイト)'}
        className={`w-full ${inputClass}`}
      />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="場所・教室(任意)"
        className={`w-full ${inputClass}`}
      />

      {kind === 'weekly' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {WEEK_ORDER.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => toggleDay(w)}
                className={chip(weekdays.includes(w))}
              >
                {WEEKDAY_LABELS[w]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
            <span className="text-muted">〜</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted">期間(学期の開始日〜終了日)</p>
            <div className="flex items-center gap-2">
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={`min-w-0 flex-1 ${inputClass}`} />
              <span className="text-muted">〜</span>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={`min-w-0 flex-1 ${inputClass}`} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`w-full ${inputClass}`} />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            終日
          </label>
          {!allDay && (
            <div className="flex items-center gap-2">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
              <span className="text-muted">〜</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? '追加中…' : '予定を追加'}
      </button>
    </form>
  );
}