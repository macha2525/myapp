export type Routine = {
  id: string;
  title: string;
  recurrence: 'weekly' | 'monthly';
  weekdays: number[] | null;          // 0=日 ... 6=土
  month_mode: 'day' | 'last_day' | 'nth_weekday' | null;
  month_days: number[] | null;        // 1〜31
  nth_week: number | null;            // 1〜5、-1 は「最終」
  clamp_to_month_end: boolean;
  is_active: boolean;
};

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

// 日付を「2026-10-27」の形にする(ブラウザの現地時間のまま。UTCにずれない)
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// その週の月曜日を返す(月曜始まり)
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// その日が、この定期タスクの対象日かどうか
export function isRoutineDue(r: Routine, d: Date): boolean {
  const dow = d.getDay();
  const dom = d.getDate();
  const lastDom = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

  if (r.recurrence === 'weekly') {
    return r.weekdays?.includes(dow) ?? false;
  }

  switch (r.month_mode) {
    case 'last_day':
      return dom === lastDom;
    case 'day':
      return (r.month_days ?? []).some(
        (x) => x === dom || (r.clamp_to_month_end && x > lastDom && dom === lastDom)
      );
    case 'nth_weekday': {
      if (!r.weekdays?.includes(dow) || r.nth_week == null) return false;
      if (r.nth_week === -1) return dom + 7 > lastDom; // その月の最後のその曜日
      return Math.ceil(dom / 7) === r.nth_week;
    }
    default:
      return false;
  }
}

// 画面に出す説明文(「毎週 月・水」など)
export function describeRoutine(r: Routine): string {
  if (r.recurrence === 'weekly') {
    const days = [...(r.weekdays ?? [])]
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      .map((w) => WEEKDAY_LABELS[w]);
    return `毎週 ${days.join('・')}`;
  }
  if (r.month_mode === 'last_day') return '毎月末';
  if (r.month_mode === 'day') {
    const days = [...(r.month_days ?? [])].sort((a, b) => a - b).map((x) => `${x}日`);
    return `毎月 ${days.join('・')}`;
  }
  if (r.month_mode === 'nth_weekday') {
    const nth = r.nth_week === -1 ? '最終' : `第${r.nth_week}`;
    const w = WEEKDAY_LABELS[r.weekdays?.[0] ?? 0];
    return `毎月 ${nth}${w}曜日`;
  }
  return '';
}