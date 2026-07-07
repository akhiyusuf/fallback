/**
 * Local-time date helpers. All persisted dates use 'YYYY-MM-DD' keys and
 * all times use 'HH:mm' 24h strings. Weekdays follow Date.getDay():
 * 0 = Sunday … 6 = Saturday.
 */

import type { Weekday } from '@/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Formats a Date as a local 'YYYY-MM-DD' key. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local 'YYYY-MM-DD' key. */
export function todayKey(): string {
  return toDateKey(new Date());
}

/** Parses a 'YYYY-MM-DD' key to a Date at local midnight. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Returns the key `days` days after (or before, if negative) `key`. */
export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Weekday (0=Sun…6=Sat) of a date key. */
export function weekdayOf(key: string): Weekday {
  return parseDateKey(key).getDay() as Weekday;
}

/** Lexicographic compare works for 'YYYY-MM-DD'; negative when a < b. */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const ms = parseDateKey(b).getTime() - parseDateKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Inclusive list of keys from `start` to `end`. Empty if end < start. */
export function dateKeysBetween(start: string, end: string): string[] {
  const keys: string[] = [];
  let k = start;
  while (compareKeys(k, end) <= 0) {
    keys.push(k);
    k = addDays(k, 1);
    if (keys.length > 400) break; // safety valve
  }
  return keys;
}

/** The 'YYYY-MM-DD' date part of an ISO datetime (local). */
export function dateKeyOfIso(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? todayKey() : toDateKey(d);
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** e.g. "Mon, Jul 7". */
export function formatDisplayDate(key: string): string {
  const d = parseDateKey(key);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** e.g. "Jul 7" — short, no weekday. */
export function formatShortDate(key: string): string {
  const d = parseDateKey(key);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** e.g. "Jul 7, 2026". */
export function formatMediumDate(key: string): string {
  const d = parseDateKey(key);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** e.g. "July 2026" for a calendar header. */
export function formatMonthYear(year: number, month0: number): string {
  return `${MONTH_LONG[month0]} ${year}`;
}

/** 'Mon' for a weekday index. */
export function weekdayShort(day: Weekday): string {
  return WEEKDAY_SHORT[day];
}

/** '07:30' → '7:30 AM'. Returns '' for null/invalid. */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return '';
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

/** Date → 'HH:mm'. */
export function toTimeString(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 'HH:mm' on a date key → local Date. */
export function dateAtTime(key: string, hhmm: string): Date {
  const d = parseDateKey(key);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** Days in a month (month0 is 0-based). */
export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Weekday (0=Sun) of the 1st of a month. */
export function firstWeekdayOfMonth(year: number, month0: number): Weekday {
  return new Date(year, month0, 1).getDay() as Weekday;
}

/** Builds a date key from parts (month0 is 0-based). */
export function makeDateKey(year: number, month0: number, day: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}
