/**
 * Local-date helpers. Never use toISOString().slice(0,10) for day keys:
 * it is UTC and shifts the day for users in UTC+3 (Saudi Arabia) after 21:00.
 */

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** YYYY-MM-DD in the device's local timezone. */
export function toDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function startOfDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function shiftDateKey(key: string, days: number): string {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** Fraction of the local day elapsed at `now` (0..1). DST-safe. */
export function dayFraction(now: Date = new Date()): number {
  const s = startOfDay(now).getTime();
  const e = startOfDay(addDays(now, 1)).getTime();
  return Math.min(1, Math.max(0, (now.getTime() - s) / (e - s)));
}

const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function weekdayNameAr(weekday: number): string {
  return WEEKDAYS_AR[((weekday % 7) + 7) % 7];
}

export function formatDateAr(key: string): string {
  const d = fromDateKey(key);
  return `${weekdayNameAr(d.getDay())} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  return now.getFullYear() - birthYear;
}

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function monthNameAr(month: number): string {
  return MONTHS_AR[((month % 12) + 12) % 12];
}

/** Sunday-based week containing `key` → 7 date keys. */
export function weekKeys(key: string): string[] {
  const d = fromDateKey(key);
  const sunday = addDays(d, -d.getDay());
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(sunday, i)));
}

/** Month grid (weeks × 7, Sunday first); null for padding cells. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateKey(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** "اليوم" / "أمس" / weekday + date. */
export function relativeDayAr(key: string, today: string = toDateKey()): string {
  if (key === today) return 'اليوم';
  if (key === shiftDateKey(today, -1)) return 'أمس';
  return formatDateAr(key);
}
