'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Routine, isRoutineDue, ymd } from '@/lib/routine';
import { Schedule, ScheduleException, occurrencesInRange } from '@/lib/schedule';
import {
  CalItem,
  SUN_LABELS,
  addDays,
  jstParts,
  monthGrid,
  parseYmd,
  startOfWeekSun,
  toMin,
} from '@/lib/calendar';
import { holidayName } from '@/lib/holidays';

type TaskRow = {
  id: string;
  title: string;
  due_at: string | null;
  due_has_time: boolean;
  status: 'todo' | 'doing' | 'done';
};
type Log = { routine_id: string; log_date: string };
type View = 'month' | 'week';
type Block = CalItem & { startMin: number; endMin: number; lane: number; lanes: number };

// 週表示の時間軸(7:00〜23:00)と、1時間あたりの高さ(px)
const START_H = 7;
const END_H = 23;
const HOUR_H = 44;

const TYPE_ORDER = { schedule: 0, task: 1, routine: 2 } as const;
const TYPE_STYLE = {
  schedule: { dot: 'bg-accent', chip: 'bg-accent/15 text-text border-accent', label: '予定' },
  task: { dot: 'bg-amber-500', chip: 'bg-amber-500/15 text-text border-amber-500', label: 'タスク期限' },
  routine: { dot: 'bg-muted', chip: 'bg-muted/15 text-text border-muted', label: '定期タスク' },
} as const;

function compare(a: CalItem, b: CalItem) {
  if (a.type !== b.type) return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  if (a.allDay !== b.allDay) return a.allDay ? 1 : -1;
  return (a.start ?? '').localeCompare(b.start ?? '');
}

function timeText(it: CalItem) {
  if (it.start) {
    if (it.type === 'task') return `${it.start} まで`;
    return it.end ? `${it.start}〜${it.end}` : `${it.start}〜`;
  }
  if (it.type === 'schedule') return '終日';
  if (it.type === 'task') return 'その日中';
  return '定期';
}

// 1日分の予定を、時間軸に置くブロックと、置けないもの(終日など)に分ける
function layoutDay(items: CalItem[]): { blocks: Block[]; loose: CalItem[] } {
  const loose: CalItem[] = [];
  const blocks: Block[] = [];

  for (const it of items) {
    if (it.start) {
      const s = toMin(it.start);
      const e = it.end ? toMin(it.end) : s + (it.type === 'task' ? 30 : 60);
      if (s < END_H * 60 && e > START_H * 60) {
        blocks.push({
          ...it,
          startMin: Math.max(s, START_H * 60),
          endMin: Math.min(Math.max(e, s + 15), END_H * 60),
          lane: 0,
          lanes: 1,
        });
        continue;
      }
    }
    loose.push(it);
  }

  // 時間が重なるものを横に並べる
  blocks.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  let cluster: Block[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];
  const flush = () => {
    cluster.forEach((b) => (b.lanes = laneEnds.length || 1));
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };
  for (const b of blocks) {
    if (cluster.length && b.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= b.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.endMin);
    } else {
      laneEnds[lane] = b.endMin;
    }
    b.lane = lane;
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.endMin);
  }
  flush();

  return { blocks, loose };
}

function chip(active: boolean) {
  return `rounded-lg px-3 py-1.5 text-sm transition ${
    active ? 'bg-accent text-accent-fg' : 'border border-border text-muted hover:text-text'
  }`;
}

// 曜日の色(日曜は赤、土曜は青)
function weekdayColor(dow: number) {
  if (dow === 0) return 'text-red-500/80';
  if (dow === 6) return 'text-sky-500/80';
  return 'text-muted';
}

// 日付の色(祝日は日曜と同じ赤)
function dayColor(d: Date, holiday?: string) {
  return holiday ? 'text-red-500/80' : weekdayColor(d.getDay());
}

export default function CalendarBoard() {
  const [supabase] = useState(() => createClient());

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);
  const todayStr = ymd(today);

  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState<Date>(today);
  const [selected, setSelected] = useState<string>(todayStr);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 画面に出す日付(月表示は5〜6週ぶん、週表示は7日)
  const days = useMemo(() => {
    if (view === 'month') return monthGrid(anchor);
    const s = startOfWeekSun(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [view, anchor]);
  const rangeFrom = ymd(days[0]);
  const rangeTo = ymd(days[days.length - 1]);

  const loadBase = useCallback(async () => {
    const [s, e, t, r] = await Promise.all([
      supabase
        .from('schedules')
        .select('id,title,location,kind,all_day,start_date,end_date,weekdays,start_time,end_time'),
      supabase
        .from('schedule_exceptions')
        .select('schedule_id,occurrence_date,kind,new_start_time,new_end_time,new_location'),
      supabase.from('tasks').select('id,title,due_at,due_has_time,status'),
      supabase
        .from('routine_tasks')
        .select('id,title,recurrence,weekdays,month_mode,month_days,nth_week,clamp_to_month_end,is_active'),
    ]);
    if (s.error || e.error || t.error || r.error) {
      setError('カレンダーのデータの読み込みに失敗しました。');
    } else {
      setSchedules(s.data as Schedule[]);
      setExceptions(e.data as ScheduleException[]);
      setTasks(t.data as TaskRow[]);
      setRoutines(r.data as Routine[]);
      setError(null);
    }
    setLoading(false);
  }, [supabase]);

  const loadLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('routine_logs')
      .select('routine_id,log_date')
      .gte('log_date', rangeFrom)
      .lte('log_date', rangeTo);
    if (!error) setLogs(data as Log[]);
  }, [supabase, rangeFrom, rangeTo]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // 別の画面で追加した内容を、戻ってきたときに反映する
  useEffect(() => {
    const onFocus = () => {
      loadBase();
      loadLogs();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadBase, loadLogs]);

  // 日付ごとに、全部の種類の予定をまとめる
  const byDate = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    const push = (it: CalItem) => {
      const list = map.get(it.date);
      if (list) list.push(it);
      else map.set(it.date, [it]);
    };
    const nowMs = Date.now();
    const doneSet = new Set(logs.map((l) => `${l.routine_id}_${l.log_date}`));

    occurrencesInRange(schedules, exceptions, days[0], days[days.length - 1]).forEach((o) => {
      const timed = !o.allDay && !!o.start;
      push({
        key: `s_${o.key}`,
        type: 'schedule',
        title: o.title,
        date: o.date,
        start: timed ? o.start : null,
        end: timed ? o.end : null,
        allDay: !timed,
        cancelled: o.cancelled,
        location: o.location,
      });
    });

    tasks.forEach((t) => {
      if (!t.due_at) return;
      const p = jstParts(t.due_at);
      if (p.date < rangeFrom || p.date > rangeTo) return;
      const done = t.status === 'done';
      push({
        key: `t_${t.id}`,
        type: 'task',
        title: t.title,
        date: p.date,
        start: t.due_has_time ? p.time : null,
        end: null,
        allDay: !t.due_has_time,
        done,
        overdue: !done && new Date(t.due_at).getTime() < nowMs,
      });
    });

    routines
      .filter((r) => r.is_active)
      .forEach((r) => {
        days.forEach((d) => {
          if (!isRoutineDue(r, d)) return;
          const ds = ymd(d);
          push({
            key: `r_${r.id}_${ds}`,
            type: 'routine',
            title: r.title,
            date: ds,
            start: null,
            end: null,
            allDay: true,
            done: doneSet.has(`${r.id}_${ds}`),
          });
        });
      });

    map.forEach((list) => list.sort(compare));
    return map;
  }, [schedules, exceptions, tasks, routines, logs, days, rangeFrom, rangeTo]);

  function move(delta: number) {
    if (view === 'month') {
      const next = new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
      setAnchor(next);
      const isThisMonth =
        next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth();
      setSelected(isThisMonth ? todayStr : ymd(next));
    } else {
      setAnchor(addDays(anchor, 7 * delta));
      setSelected(ymd(addDays(parseYmd(selected), 7 * delta)));
    }
  }

  function goToday() {
    setAnchor(today);
    setSelected(todayStr);
  }

  function changeView(v: View) {
    if (v === view) return;
    setAnchor(parseYmd(selected));
    setView(v);
  }

  function refresh() {
    loadBase();
    loadLogs();
  }

  const title =
    view === 'month'
      ? `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`
      : `${days[0].getFullYear()}年 ${days[0].getMonth() + 1}/${days[0].getDate()} 〜 ${
          days[6].getMonth() + 1
        }/${days[6].getDate()}`;

  const selectedDate = parseYmd(selected);
  const selectedHoliday = holidayName(selected);
  const selectedItems = byDate.get(selected) ?? [];
  const groups = (['schedule', 'task', 'routine'] as const)
    .map((t) => ({ type: t, list: selectedItems.filter((i) => i.type === t) }))
    .filter((g) => g.list.length > 0);

  if (loading) return <p className="text-sm text-muted">読み込み中…</p>;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const bodyHeight = (END_H - START_H) * HOUR_H;
  const gridCols = 'grid grid-cols-[2.5rem_repeat(7,minmax(0,1fr))]';
  const hourLines = {
    height: bodyHeight,
    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_H - 1}px, var(--border) ${
      HOUR_H - 1
    }px, var(--border) ${HOUR_H}px)`,
  };

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* 操作バー */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => move(-1)}
            aria-label="前へ"
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-text"
          >
            ‹
          </button>
          <h3
            className={`text-center font-serif font-medium tracking-tight ${
              view === 'month'
                ? 'min-w-[9.5rem] text-3xl sm:min-w-[13rem] sm:text-4xl'
                : 'text-xl sm:text-3xl'
            }`}
          >
            {title}
          </h3>
          <button
            onClick={() => move(1)}
            aria-label="次へ"
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-text"
          >
            ›
          </button>
          <button
            onClick={goToday}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-text"
          >
            今日
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeView('month')} className={chip(view === 'month')}>
            月
          </button>
          <button onClick={() => changeView('week')} className={chip(view === 'week')}>
            週
          </button>
          <button
            onClick={refresh}
            className="px-2 text-xs text-muted underline underline-offset-4 hover:text-text"
          >
            更新
          </button>
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        {(['schedule', 'task', 'routine'] as const).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${TYPE_STYLE[t].dot}`} />
            {TYPE_STYLE[t].label}
          </span>
        ))}
      </div>

      {/* 月表示 */}
      {view === 'month' && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface/40">
          <div className="grid grid-cols-7 border-b border-border text-center text-xs">
            {SUN_LABELS.map((w, i) => (
              <div key={w} className={`py-2 ${weekdayColor(i)}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const ds = ymd(d);
              const list = byDate.get(ds) ?? [];
              const hol = holidayName(ds);
              const inMonth = d.getMonth() === anchor.getMonth();
              const isToday = ds === todayStr;
              const isSel = ds === selected;
              return (
                <button
                  key={ds}
                  onClick={() => setSelected(ds)}
                  className={`flex min-h-[4.25rem] flex-col items-stretch border-b border-r border-border p-1 transition sm:min-h-[6.5rem] sm:p-1.5 [&:nth-child(7n)]:border-r-0 ${
                    inMonth ? '' : 'opacity-40'
                  } ${isSel ? 'bg-accent/10' : 'hover:bg-accent/5'}`}
                >
                  {/* 日付は、枠の上の中央 */}
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center self-center rounded-full text-xs ${
                      isToday ? 'bg-accent text-accent-fg' : dayColor(d, hol)
                    }`}
                  >
                    {d.getDate()}
                  </span>

                  {/* PC: 祝日名 */}
                  {hol && (
                    <span className="mt-0.5 hidden truncate text-center text-[10px] leading-tight text-red-500/80 sm:block">
                      {hol}
                    </span>
                  )}

                  {/* スマホ: 点で表示 */}
                  <div className="mt-1 flex flex-wrap justify-center gap-0.5 sm:hidden">
                    {list.slice(0, 6).map((it) => (
                      <span
                        key={it.key}
                        className={`h-1.5 w-1.5 rounded-full ${TYPE_STYLE[it.type].dot} ${
                          it.cancelled || it.done ? 'opacity-30' : ''
                        }`}
                      />
                    ))}
                  </div>

                  {/* PC: 題名つきで表示 */}
                  <div className="mt-1 hidden w-full space-y-0.5 text-left sm:block">
                    {list.slice(0, 3).map((it) => (
                      <div
                        key={it.key}
                        className={`truncate rounded border-l-2 px-1 text-[11px] leading-5 ${
                          TYPE_STYLE[it.type].chip
                        } ${it.cancelled || it.done ? 'line-through opacity-50' : ''}`}
                      >
                        {it.start && <span className="mr-1 text-muted">{it.start}</span>}
                        {it.title}
                      </div>
                    ))}
                    {list.length > 3 && (
                      <div className="px-1 text-[11px] text-muted">他 {list.length - 3} 件</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 週表示 */}
      {view === 'week' && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface/40">
          <div className="min-w-[640px]">
            {/* 曜日と日付 */}
            <div className={`${gridCols} border-b border-border`}>
              <div />
              {days.map((d) => {
                const ds = ymd(d);
                const hol = holidayName(ds);
                const isToday = ds === todayStr;
                return (
                  <button
                    key={ds}
                    onClick={() => setSelected(ds)}
                    className={`border-l border-border py-2 text-center transition ${
                      ds === selected ? 'bg-accent/10' : 'hover:bg-accent/5'
                    }`}
                  >
                    <span className={`block text-[10px] ${dayColor(d, hol)}`}>
                      {SUN_LABELS[d.getDay()]}
                    </span>
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                        isToday
                          ? 'bg-accent text-accent-fg'
                          : hol || d.getDay() === 0
                            ? 'text-red-500/80'
                            : d.getDay() === 6
                              ? 'text-sky-500/80'
                              : ''
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    <span className="block h-3 truncate px-0.5 text-[9px] leading-3 text-red-500/80">
                      {hol ?? ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 終日・時間なしの行 */}
            <div className={`${gridCols} border-b border-border`}>
              <div className="px-1 py-1 text-[10px] text-muted">終日</div>
              {days.map((d) => {
                const { loose } = layoutDay(byDate.get(ymd(d)) ?? []);
                return (
                  <div key={ymd(d)} className="min-h-[1.75rem] space-y-1 border-l border-border p-1">
                    {loose.map((it) => (
                      <div
                        key={it.key}
                        className={`truncate rounded border-l-2 px-1 text-[10px] leading-4 ${
                          TYPE_STYLE[it.type].chip
                        } ${it.cancelled || it.done ? 'line-through opacity-50' : ''}`}
                      >
                        {it.start && <span className="mr-1 text-muted">{it.start}</span>}
                        {it.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* 時間軸 */}
            <div className={gridCols}>
              <div className="relative" style={{ height: bodyHeight }}>
                {Array.from({ length: END_H - START_H }, (_, i) => (
                  <span
                    key={i}
                    className="absolute right-1 text-[10px] tabular-nums text-muted"
                    style={{ top: i * HOUR_H - 6 }}
                  >
                    {START_H + i}:00
                  </span>
                ))}
              </div>

              {days.map((d) => {
                const ds = ymd(d);
                const { blocks } = layoutDay(byDate.get(ds) ?? []);
                const isToday = ds === todayStr;
                return (
                  <div key={ds} className="relative border-l border-border" style={hourLines}>
                    {blocks.map((b) => {
                      const top = ((b.startMin - START_H * 60) * HOUR_H) / 60;
                      const height = Math.max(((b.endMin - b.startMin) * HOUR_H) / 60, 20);
                      return (
                        <div
                          key={b.key}
                          title={`${timeText(b)} ${b.title}`}
                          className={`absolute overflow-hidden rounded-md border-l-2 px-1 py-0.5 text-[11px] leading-tight ${
                            TYPE_STYLE[b.type].chip
                          } ${b.cancelled || b.done ? 'line-through opacity-50' : ''}`}
                          style={{
                            top,
                            height,
                            left: `calc(${(b.lane / b.lanes) * 100}% + 1px)`,
                            width: `calc(${100 / b.lanes}% - 2px)`,
                          }}
                        >
                          <p className="truncate font-medium">{b.title}</p>
                          {height >= 34 && (
                            <p className="truncate text-muted">
                              {b.start}
                              {b.end ? `〜${b.end}` : ''}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {isToday && nowMin >= START_H * 60 && nowMin <= END_H * 60 && (
                      <div
                        className="absolute inset-x-0 z-10 h-px bg-red-500"
                        style={{ top: ((nowMin - START_H * 60) * HOUR_H) / 60 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 選んだ日の詳細 */}
      <section className="space-y-3">
        <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-muted">
          <span>
            {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日({SUN_LABELS[selectedDate.getDay()]})
          </span>
          {selected === todayStr && <span>・今日</span>}
          {selectedHoliday && <span className="text-red-500/80">・{selectedHoliday}</span>}
        </h3>

        {groups.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            この日の予定はありません。
          </p>
        )}

        {groups.map((g) => (
          <div key={g.type} className="space-y-2">
            <p className="text-xs text-muted">{TYPE_STYLE[g.type].label}</p>
            <ul className="space-y-2">
              {g.list.map((it) => (
                <li
                  key={it.key}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 px-4 py-2.5"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_STYLE[it.type].dot}`} />
                  <span className="w-24 shrink-0 text-xs tabular-nums text-muted">{timeText(it)}</span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${
                        it.cancelled || it.done ? 'line-through opacity-60' : ''
                      }`}
                    >
                      {it.title}
                    </p>
                    {it.location && <p className="truncate text-xs text-muted">{it.location}</p>}
                  </div>
                  {it.cancelled && <span className="shrink-0 text-xs text-muted">休講</span>}
                  {it.overdue && <span className="shrink-0 text-xs text-red-500">期限切れ</span>}
                  {it.done && <span className="shrink-0 text-xs text-muted">完了</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}