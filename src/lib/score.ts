/**
 * Discipline score & per-day summaries. Pure functions — no storage, no React.
 *
 * Credit: ideal 1.0 · fallback 0.5 · pending/missed 0 (see CREDIT in @/types).
 */

import { CREDIT, type Task } from '@/types';
import { addDays, compareKeys } from '@/lib/dates';
import { effectiveStatus } from '@/lib/taskGeneration';

/**
 * Rolling-window discipline score over [today-(windowDays-1) .. today],
 * inclusive. Returns null when no tasks fall in the window.
 *
 * Score = round(100 * Σ CREDIT[status] / count). Pending past tasks count 0
 * (CREDIT.pending === CREDIT.missed === 0), but they are part of the count.
 */
export function disciplineScore(
  tasks: Task[],
  today: string,
  windowDays = 30
): number | null {
  const start = addDays(today, -(windowDays - 1));
  let count = 0;
  let credit = 0;
  for (const t of tasks) {
    if (compareKeys(t.date, start) < 0 || compareKeys(t.date, today) > 0) {
      continue;
    }
    count += 1;
    credit += CREDIT[t.status];
  }
  if (count === 0) return null;
  return Math.round((100 * credit) / count);
}

/** done = ideal + fallback completed; total = all tasks that day. */
export function dayCompletion(dayTasks: Task[]): { done: number; total: number } {
  let done = 0;
  for (const t of dayTasks) {
    if (t.status === 'completed_ideal' || t.status === 'completed_fallback') {
      done += 1;
    }
  }
  return { done, total: dayTasks.length };
}

export type DayDot = 'none' | 'pending' | 'ideal' | 'fallback' | 'missed';

/**
 * Calendar dot for a day's tasks:
 * - 'none' if the day has no tasks;
 * - 'ideal' if every task is completed_ideal;
 * - 'fallback' if every task is completed (mixed levels ok);
 * - 'missed' if any task's effective status is missed;
 * - else 'pending'.
 */
export function dayDot(dayTasks: Task[], today: string): DayDot {
  if (dayTasks.length === 0) return 'none';
  if (dayTasks.every((t) => t.status === 'completed_ideal')) return 'ideal';
  if (
    dayTasks.every(
      (t) =>
        t.status === 'completed_ideal' || t.status === 'completed_fallback'
    )
  ) {
    return 'fallback';
  }
  if (dayTasks.some((t) => effectiveStatus(t, today) === 'missed')) {
    return 'missed';
  }
  return 'pending';
}
