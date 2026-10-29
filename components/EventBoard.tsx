'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { WEEKDAY_LABELS, ymd } from '@/lib/routine';
import {
  Occurrence,
  Schedule,
  ScheduleException,
  hhmm,
  occurrencesInRange,
} from '@/lib/schedule';
import { labelColor, useLabels } from '@/lib/labels';
import { LabelPicker, LabelTag } from './LabelUI';
import ScheduleForm from './ScheduleForm';

type ScheduleRow = Schedule & { label_slot: number | null };

const DAYS_AHEAD = 7;
const linkBtn = 'shrink-0 text-xs text-muted underline underline-offset-4 hover:text-text';

function timeLabel(o: Occurrence) {
  if (o.allDay) return '終日';
  return o.end ? `${o.start}〜${o.end}` : `${o.start}〜`;
}

function describeSchedule(s: Schedule) {
  if (s.kind === 'single') {
    return `単発 ${s.start_date}${s.all_day ? ' 終日' : ` ${hhmm(s.start_time)}`}`;
  }
  const days = [...(s.weekdays ?? [])]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((w) => WEEKDAY_LABELS[w])
    .join('・');
  return `毎週 ${days} ${hhmm(s.start_time)}〜${hhmm(s.end_time)} (${s.start_date} 〜 ${s.end_date})`;
}

export default function EventBoard() {
  const [supabase] = useState(() => createClient());
  const { nameOf } = useLabels();
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pickerId, setPickerId] = useState<string | null>(null);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_AHEAD }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d;
      }),
    [today]
  );

  const load = useCallback(async () => {
    const [s, e] = await Promise.all([
      supabase
        .from('schedules')
        .select('id,title,location,kind,all_day,start_date,end_date,weekdays,start_time,end_time,label_slot')
        .order('created_at', { ascending: true }),
      supabase
        .from('schedule_exceptions')
        .select('schedule_id,occurrence_date,kind,new_start_time,new_end_time,new_location'),
    ]);
    if (s.error || e.error) {
      setError('予定の読み込みに失敗しました。');
    } else {
      setSchedules(s.data as ScheduleRow[]);
      setExceptions(e.data as ScheduleException[]);
      setError(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const occurrences = useMemo(
    () => occurrencesInRange(schedules, exceptions, days[0], days[days.length - 1]),
    [schedules, exceptions, days]
  );

  const slotById = useMemo(
    () => new Map(schedules.map((s) => [s.id, s.label_slot] as const)),
    [schedules]
  );

  async function setCancelled(o: Occurrence, cancel: boolean) {
    const { error } = cancel
      ? await supabase
          .from('schedule_exceptions')
          .upsert(
            { schedule_id: o.scheduleId, occurrence_date: o.date, kind: 'cancelled' },
            { onConflict: 'schedule_id,occurrence_date' }
          )
      : await supabase
          .from('schedule_exceptions')
          .delete()
          .eq('schedule_id', o.scheduleId)
          .eq('occurrence_date', o.date);
    if (error) setError('更新に失敗しました。');
    else load();
  }

  async function changeLabel(id: string, slot: number | null) {
    setSchedules((prev) => prev.map((x) => (x.id === id ? { ...x, label_slot: slot } : x)));
    const { error } = await supabase.from('schedules').update({ label_slot: slot }).eq('id', id);
    if (error) {
      setError('ラベルの変更に失敗しました。');
      load();
    }
  }

  async function removeSchedule(s: Schedule) {
    const msg =
      s.kind === 'weekly'
        ? `「${s.title}」を、期間ぜんぶ削除する? 休講の記録も消えるよ。`
        : `「${s.title}」を削除する?`;
    if (!window.confirm(msg)) return;
    const { error } = await supabase.from('schedules').delete().eq('id', s.id);
    if (error) setError('削除に失敗しました。');
    else load();
  }

  if (loading) return <p className="text-sm text-muted">読み込み中…</p>;

  const shownDays = days.filter(
    (d) => ymd(d) === ymd(today) || occurrences.some((o) => o.date === ymd(d))
  );

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted">今日から{DAYS_AHEAD}日間</h3>

        {occurrences.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            この7日間に予定はありません。
          </p>
        )}

        {shownDays.map((d) => {
          const ds = ymd(d);
          const list = occurrences.filter((o) => o.date === ds);
          const isToday = ds === ymd(today);
          return (
            <div key={ds} className="space-y-2">
              <p className={`text-xs font-medium ${isToday ? 'text-text' : 'text-muted'}`}>
                {d.getMonth() + 1}/{d.getDate()}({WEEKDAY_LABELS[d.getDay()]}){isToday && ' ・今日'}
              </p>
              {list.length === 0 && <p className="px-1 text-xs text-muted">予定なし</p>}
              <ul className="space-y-2">
                {list.map((o) => {
                  const slot = slotById.get(o.scheduleId) ?? null;
                  return (
                    <li
                      key={o.key}
                      style={slot ? { borderLeft: `3px solid ${labelColor(slot)}` } : undefined}
                      className={`flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 ${
                        o.cancelled ? 'opacity-50' : ''
                      }`}
                    >
                      <span className="w-24 shrink-0 text-xs tabular-nums text-muted">{timeLabel(o)}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm ${o.cancelled ? 'line-through' : ''}`}>
                          {o.title}
                          {o.cancelled && <span className="ml-2 text-xs no-underline">休講</span>}
                        </p>
                        {(o.location || slot) && (
                          <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                            {o.location && <span className="truncate">{o.location}</span>}
                            {slot && <LabelTag slot={slot} name={nameOf(slot)} />}
                          </div>
                        )}
                      </div>
                      {o.kind === 'weekly' && (
                        <button onClick={() => setCancelled(o, !o.cancelled)} className={linkBtn}>
                          {o.cancelled ? '休講を取り消す' : '休講にする'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm text-muted underline underline-offset-4 hover:text-text"
        >
          {showForm ? '追加フォームを閉じる' : '予定を追加する'}
        </button>
        {showForm && <ScheduleForm onCreated={load} />}
      </section>

      {schedules.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted">登録済みの予定 ({schedules.length})</h3>
          <ul className="space-y-2">
            {schedules.map((s) => (
              <li
                key={s.id}
                style={s.label_slot ? { borderLeft: `3px solid ${labelColor(s.label_slot)}` } : undefined}
                className="rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm">{s.title}</p>
                    <p className="text-xs text-muted">{describeSchedule(s)}</p>
                    {s.label_slot && <LabelTag slot={s.label_slot} name={nameOf(s.label_slot)} />}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={() => setPickerId(pickerId === s.id ? null : s.id)}
                      className={linkBtn}
                    >
                      ラベル
                    </button>
                    <button onClick={() => removeSchedule(s)} className={linkBtn}>
                      削除
                    </button>
                  </div>
                </div>
                {pickerId === s.id && (
                  <div className="mt-3">
                    <LabelPicker
                      value={s.label_slot ?? null}
                      onChange={(v) => changeLabel(s.id, v)}
                      nameOf={nameOf}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}