'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Routine,
  WEEKDAY_LABELS,
  describeRoutine,
  isRoutineDue,
  startOfWeek,
  ymd,
} from '@/lib/routine';
import { COPY } from '@/lib/copy';
import { labelColor, useLabels } from '@/lib/labels';
import { LabelPicker, LabelTag } from './LabelUI';
import RoutineForm from './RoutineForm';

type Log = { routine_id: string; log_date: string };
type RoutineRow = Routine & { label_slot: number | null };

const linkBtn = 'text-xs text-muted underline underline-offset-4 hover:text-text';

export default function RoutineBoard() {
  const [supabase] = useState(() => createClient());
  const { nameOf } = useLabels();
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pickerId, setPickerId] = useState<string | null>(null);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);
  const todayStr = ymd(today);

  const weekStart = useMemo(() => {
    const s = startOfWeek(today);
    s.setDate(s.getDate() + weekOffset * 7);
    return s;
  }, [today, weekOffset]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  // 「今日」と「表示中の週」の両方の記録を読み込む範囲
  const thisWeekStart = startOfWeek(today);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
  const rangeFrom = ymd(weekStart.getTime() < thisWeekStart.getTime() ? weekStart : thisWeekStart);
  const rangeTo = ymd(days[6].getTime() > thisWeekEnd.getTime() ? days[6] : thisWeekEnd);

  const loadRoutines = useCallback(async () => {
    const { data, error } = await supabase
      .from('routine_tasks')
      .select(
        'id,title,recurrence,weekdays,month_mode,month_days,nth_week,clamp_to_month_end,is_active,label_slot'
      )
      .order('created_at', { ascending: true });
    if (error) setError('定期タスクの読み込みに失敗しました。');
    else setRoutines(data as RoutineRow[]);
  }, [supabase]);

  const loadLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('routine_logs')
      .select('routine_id,log_date')
      .gte('log_date', rangeFrom)
      .lte('log_date', rangeTo);
    if (error) setError('記録の読み込みに失敗しました。');
    else setLogs(data as Log[]);
  }, [supabase, rangeFrom, rangeTo]);

  useEffect(() => {
    loadRoutines().then(() => setLoading(false));
  }, [loadRoutines]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const doneSet = useMemo(
    () => new Set(logs.map((l) => `${l.routine_id}_${l.log_date}`)),
    [logs]
  );

  async function toggleLog(routineId: string, date: string) {
    const isDone = doneSet.has(`${routineId}_${date}`);
    // 先に画面を更新して、体感を速くする
    setLogs((prev) =>
      isDone
        ? prev.filter((l) => !(l.routine_id === routineId && l.log_date === date))
        : [...prev, { routine_id: routineId, log_date: date }]
    );
    const { error } = isDone
      ? await supabase.from('routine_logs').delete().eq('routine_id', routineId).eq('log_date', date)
      : await supabase.from('routine_logs').insert({ routine_id: routineId, log_date: date });
    if (error) {
      setError('更新に失敗しました。');
      loadLogs();
    }
  }

  async function changeLabel(id: string, slot: number | null) {
    setRoutines((prev) => prev.map((x) => (x.id === id ? { ...x, label_slot: slot } : x)));
    const { error } = await supabase.from('routine_tasks').update({ label_slot: slot }).eq('id', id);
    if (error) {
      setError('ラベルの変更に失敗しました。');
      loadRoutines();
    }
  }

  async function removeRoutine(r: Routine) {
    if (!window.confirm(`「${r.title}」を削除する? 記録も一緒に消えるよ。`)) return;
    const { error } = await supabase.from('routine_tasks').delete().eq('id', r.id);
    if (error) return setError('削除に失敗しました。');
    setRoutines((prev) => prev.filter((x) => x.id !== r.id));
  }

  const active = routines.filter((r) => r.is_active);
  const todays = active.filter((r) => isRoutineDue(r, today));
  const rangeLabel = `${days[0].getMonth() + 1}/${days[0].getDate()} - ${days[6].getMonth() + 1}/${days[6].getDate()}`;

  if (loading) return <p className="text-sm text-muted">読み込み中…</p>;

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* 今日やる定期タスク */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted">
          今日の定期タスク ({todays.filter((r) => doneSet.has(`${r.id}_${todayStr}`)).length}/{todays.length})
        </h3>
        {todays.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            {COPY.routines.emptyToday}
          </p>
        ) : (
          <ul className="space-y-2">
            {todays.map((r) => {
              const done = doneSet.has(`${r.id}_${todayStr}`);
              return (
                <li
                  key={r.id}
                  style={r.label_slot ? { borderLeft: `3px solid ${labelColor(r.label_slot)}` } : undefined}
                  className={`flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 ${
                    done ? 'opacity-60' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleLog(r.id, todayStr)}
                    aria-label={done ? '未完了に戻す' : '完了にする'}
                    className={`h-5 w-5 shrink-0 rounded-full border transition ${
                      done ? 'border-accent bg-accent' : 'border-muted hover:border-accent'
                    }`}
                  />
                  <p className={`min-w-0 flex-1 truncate text-sm ${done ? 'line-through' : ''}`}>{r.title}</p>
                  {r.label_slot && <LabelTag slot={r.label_slot} name={nameOf(r.label_slot)} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 週ビュー */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted">週ビュー {rangeLabel}</h3>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="rounded-md border border-border px-2 py-1 text-muted hover:text-text"
            >
              前の週
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-md border border-border px-2 py-1 text-muted hover:text-text"
            >
              今週
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="rounded-md border border-border px-2 py-1 text-muted hover:text-text"
            >
              次の週
            </button>
          </div>
        </div>

        {active.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            {COPY.routines.emptyAll}
          </p>
        )}

        <ul className="space-y-3">
          {active.map((r) => {
            let due = 0;
            let done = 0;
            days.forEach((d) => {
              if (isRoutineDue(r, d)) {
                due++;
                if (doneSet.has(`${r.id}_${ymd(d)}`)) done++;
              }
            });

            return (
              <li
                key={r.id}
                style={r.label_slot ? { borderLeft: `3px solid ${labelColor(r.label_slot)}` } : undefined}
                className="space-y-3 rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm">{r.title}</p>
                    <p className="text-xs text-muted">{describeRoutine(r)}</p>
                    {r.label_slot && <LabelTag slot={r.label_slot} name={nameOf(r.label_slot)} />}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted">
                      {done}/{due}
                    </span>
                    <button
                      onClick={() => setPickerId(pickerId === r.id ? null : r.id)}
                      className={linkBtn}
                    >
                      ラベル
                    </button>
                    <button onClick={() => removeRoutine(r)} className={linkBtn}>
                      削除
                    </button>
                  </div>
                </div>

                {pickerId === r.id && (
                  <LabelPicker
                    value={r.label_slot ?? null}
                    onChange={(v) => changeLabel(r.id, v)}
                    nameOf={nameOf}
                  />
                )}

                <div className="grid grid-cols-7 gap-1">
                  {days.map((d) => {
                    const ds = ymd(d);
                    const isDue = isRoutineDue(r, d);
                    const isDone = doneSet.has(`${r.id}_${ds}`);
                    const isFuture = d.getTime() > today.getTime();
                    const isToday = ds === todayStr;

                    let style = 'border-transparent text-muted opacity-30'; // 対象外の日
                    if (isDue && isDone) style = 'border-accent bg-accent text-accent-fg';
                    else if (isDue) style = 'border-border text-text hover:border-accent';

                    return (
                      <button
                        key={ds}
                        disabled={!isDue || isFuture}
                        onClick={() => toggleLog(r.id, ds)}
                        className={`flex flex-col items-center rounded-lg border py-1.5 transition disabled:cursor-default ${style} ${
                          isToday ? 'ring-1 ring-accent ring-offset-1 ring-offset-surface' : ''
                        }`}
                      >
                        <span className="text-[10px] leading-none opacity-70">{WEEKDAY_LABELS[d.getDay()]}</span>
                        <span className="mt-1 text-sm leading-none">{d.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 追加 */}
      <section className="space-y-3">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm text-muted underline underline-offset-4 hover:text-text"
        >
          {showForm ? '追加フォームを閉じる' : '定期タスクを追加する'}
        </button>
        {showForm && <RoutineForm onCreated={loadRoutines} />}
      </section>
    </div>
  );
}