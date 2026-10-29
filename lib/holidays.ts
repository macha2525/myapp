import { ymd } from './routine';
import { addDays, parseYmd } from './calendar';

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

// その月の第n月曜日の「日」を返す
function nthMonday(year: number, month: number, n: number): number {
  const firstDow = new Date(year, month - 1, 1).getDay();
  return 1 + ((8 - firstDow) % 7) + (n - 1) * 7;
}

// 春分の日・秋分の日(1980〜2099年に使える近似式)
function vernalEquinox(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}
function autumnalEquinox(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

const cache = new Map<number, Map<string, string>>();

// その年の祝日を { "2026-05-06": "振替休日" } の形で返す(2000〜2099年)
export function holidaysOfYear(year: number): Map<string, string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const map = new Map<string, string>();
  cache.set(year, map);
  if (year < 2000 || year > 2099) return map;

  const add = (m: number, d: number, name: string) => map.set(key(year, m, d), name);

  add(1, 1, '元日');
  add(1, nthMonday(year, 1, 2), '成人の日');
  add(2, 11, '建国記念の日');
  if (year >= 2020) add(2, 23, '天皇誕生日');
  add(3, vernalEquinox(year), '春分の日');
  add(4, 29, year >= 2007 ? '昭和の日' : 'みどりの日');
  add(5, 3, '憲法記念日');
  if (year >= 2007) add(5, 4, 'みどりの日');
  add(5, 5, 'こどもの日');

  // 海の日(2020・2021年は東京オリンピックの都合で移動)
  if (year === 2020) add(7, 23, '海の日');
  else if (year === 2021) add(7, 22, '海の日');
  else if (year >= 2003) add(7, nthMonday(year, 7, 3), '海の日');
  else add(7, 20, '海の日');

  // 山の日
  if (year === 2020) add(8, 10, '山の日');
  else if (year === 2021) add(8, 8, '山の日');
  else if (year >= 2016) add(8, 11, '山の日');

  add(9, year >= 2003 ? nthMonday(year, 9, 3) : 15, '敬老の日');
  add(9, autumnalEquinox(year), '秋分の日');

  // スポーツの日(2019年までは体育の日)
  if (year === 2020) add(7, 24, 'スポーツの日');
  else if (year === 2021) add(7, 23, 'スポーツの日');
  else add(10, nthMonday(year, 10, 2), year >= 2020 ? 'スポーツの日' : '体育の日');

  add(11, 3, '文化の日');
  add(11, 23, '勤労感謝の日');
  if (year <= 2018) add(12, 23, '天皇誕生日');
  if (year === 2019) {
    add(5, 1, '天皇の即位の日');
    add(10, 22, '即位礼正殿の儀の日');
  }

  const base = new Set(map.keys());

  // 振替休日: 日曜の祝日の次の、祝日でない日
  const subs: string[] = [];
  [...base].sort().forEach((k) => {
    const d = parseYmd(k);
    if (d.getDay() !== 0) return;
    let n = addDays(d, 1);
    while (map.has(ymd(n)) || subs.includes(ymd(n))) n = addDays(n, 1);
    subs.push(ymd(n));
  });
  subs.forEach((k) => map.set(k, '振替休日'));

  // 国民の休日: 前日と翌日が祝日で、日曜でも祝日でもない日
  for (let d = new Date(year, 0, 2); d.getFullYear() === year; d = addDays(d, 1)) {
    const k = ymd(d);
    if (map.has(k) || d.getDay() === 0) continue;
    if (base.has(ymd(addDays(d, -1))) && base.has(ymd(addDays(d, 1)))) {
      map.set(k, '国民の休日');
    }
  }

  return map;
}

// "2026-05-06" の形の日付から、祝日名を返す(祝日でなければ undefined)
export function holidayName(dateStr: string): string | undefined {
  return holidaysOfYear(Number(dateStr.slice(0, 4))).get(dateStr);
}