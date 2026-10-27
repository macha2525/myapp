import { ymd } from './routine';

export type Schedule = {
  id: string;
  title: string;
  location: string | null;
  kind: 'single' | 'weekly';
  all_day: boolean;
  start_date: string;          // "2026-10-28"
  end_date: string | null;
  weekdays: number[] | null;   // 0=日 ... 6=土
  start_time: string | null;   // "10:30:00"
  end_time: string | null;
};

export type ScheduleException = {
  schedule_id: string;
  occurrence_date: string;
  kind: 'cancelled' | 'modified';
  new_start_time: string | null;
  new_end_time: string | null;
  new_location: string | null;
};

// 「ある日に実際に起きる1回分の予定」
export type Occurrence = {
  key: string;
  scheduleId: string;
  title: string;
  date: string;
  allDay: boolean;
  start: string | null;
  end: string | null;
  location: string | null;
  kind: 'single' | 'weekly';
  cancelled: boolean;
  modified: boolean;
};

export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

// from〜to(両端を含む)の間に起きる予定を、日付ごとに展開して返す
export function occurrencesInRange(
  schedules: Schedule[],
  exceptions: ScheduleException[],
  from: Date,
  to: Date
): Occurrence[] {
  const exMap = new Map(exceptions.map((e) => [`${e.schedule_id}_${e.occurrence_date}`, e]));
  const result: Occurrence[] = [];

  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  while (d.getTime() <= last.getTime()) {
    const ds = ymd(d);
    const dow = d.getDay();

    for (const s of schedules) {
      const hit =
        s.kind === 'single'
          ? s.start_date === ds
          : ds >= s.start_date &&
            ds <= (s.end_date ?? s.start_date) &&
            (s.weekdays ?? []).includes(dow);
      if (!hit) continue;

      const ex = exMap.get(`${s.id}_${ds}`);
      const modified = ex?.kind === 'modified';

      result.push({
        key: `${s.id}_${ds}`,
        scheduleId: s.id,
        title: s.title,
        date: ds,
        allDay: s.all_day,
        start: hhmm(modified && ex?.new_start_time ? ex.new_start_time : s.start_time),
        end: hhmm(modified && ex?.new_end_time ? ex.new_end_time : s.end_time),
        location: modified && ex?.new_location ? ex.new_location : s.location,
        kind: s.kind,
        cancelled: ex?.kind === 'cancelled',
        modified,
      });
    }
    d.setDate(d.getDate() + 1);
  }

  return result.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(b.allDay) - Number(a.allDay) ||
      (a.start ?? '').localeCompare(b.start ?? '')
  );
}