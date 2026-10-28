export const SUN_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

// カレンダーに載せる1件分
export type CalItem = {
  key: string;
  type: 'schedule' | 'task' | 'routine';
  title: string;
  date: string;          // "2026-10-29"
  start: string | null;  // "10:30"
  end: string | null;
  allDay: boolean;       // 時間を持たない(終日・日付だけ)
  done?: boolean;
  cancelled?: boolean;
  overdue?: boolean;
  location?: string | null;
};

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

// その週の日曜日(日曜始まり)
export function startOfWeekSun(d: Date): Date {
  return addDays(d, -d.getDay());
}

// 月表示に並べる日付(日曜始まり。その月を含む週をすべて)
export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeekSun(first);
  const end = addDays(startOfWeekSun(last), 6);
  const days: Date[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) days.push(d);
  return days;
}

// "2026-10-29" を Date に戻す
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 保存してある日時を、日本時間の日付と時刻に分解する
export function jstParts(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

// "10:30" を分に直す(630)
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}