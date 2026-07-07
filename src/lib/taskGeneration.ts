/**
 * Task generation & reconciliation — the correctness-critical core.
 *
 * Pure functions only: no storage, no React. `syncTasksForDates` never
 * mutates its inputs and always returns a NEW tasks array; surviving task
 * ids are preserved, and completed/past tasks are treated as immutable
 * history (never dropped or retimed).
 */

import {
  CREDIT,
  getParentId,
  parentIdField,
  type AppData,
  type Commitment,
  type Step,
  type Task,
  type TaskStatus,
} from '@/types';
import { compareKeys, dateKeyOfIso, weekdayOf } from '@/lib/dates';
import { newId } from '@/lib/ids';

/**
 * True if the commitment has an occurrence on `dateKey`.
 *
 * - Never before the commitment's createdAt date.
 * - Events occur only on their `targetEventDate`.
 * - Regimens run up to AND INCLUDING their `targetDate` deadline
 *   (indefinite when null/undefined), following routine scheduling.
 * - Routines/regimens: 'daily' (default) every day; 'weekly' only on
 *   the weekdays listed in `targetDays`.
 */
export function occursOnDate(c: Commitment, dateKey: string): boolean {
  // Occurrences never start before the day the commitment was created.
  if (compareKeys(dateKey, dateKeyOfIso(c.createdAt)) < 0) return false;

  if (c.type === 'event') {
    return !!c.targetEventDate && dateKey === c.targetEventDate;
  }

  if (c.type === 'regimen') {
    // Deadline is inclusive; null/undefined means indefinite.
    if (c.targetDate != null && compareKeys(dateKey, c.targetDate) > 0) {
      return false;
    }
  }

  // Routine + regimen scheduling.
  if (c.frequency === 'weekly') {
    return (c.targetDays ?? []).includes(weekdayOf(dateKey));
  }
  // 'daily' (or missing, which defaults to daily).
  return true;
}

/** True if a step is due on `dateKey` (daily, or weekly + targetDays match). */
export function stepDueOnDate(step: Step, dateKey: string): boolean {
  if (step.frequency === 'weekly') {
    return (step.targetDays ?? []).includes(weekdayOf(dateKey));
  }
  return true;
}

/** Occurrence count per day: events → 1; else clamp(dailyFrequency, 1, 10). */
export function instancesForDate(c: Commitment): number {
  if (c.type === 'event') return 1;
  const raw = Math.floor(c.dailyFrequency ?? 1);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(10, Math.max(1, raw));
}

/** 'HH:mm' for an instance: events → c.targetTime; else c.targetTimes?.[i] ?? null. */
export function targetTimeFor(
  c: Commitment,
  instanceIndex: number
): string | null {
  if (c.type === 'event') return c.targetTime ?? null;
  return c.targetTimes?.[instanceIndex] ?? null;
}

/** Composite identity of a task instance within its parent. */
function instanceKey(parentId: string, date: string, instanceIndex: number): string {
  return `${parentId}|${date}|${instanceIndex}`;
}

/** Duplicate-resolution priority: completed ideal > fallback > everything else. */
function duplicateRank(t: Task): number {
  if (t.status === 'completed_ideal') return 2;
  if (t.status === 'completed_fallback') return 1;
  return 0;
}

/**
 * Core reconciler. Pure — returns a NEW tasks array; `changed` is false iff
 * nothing was added, removed, or modified (so callers can avoid save loops).
 *
 * Rules, applied in this exact order:
 * 1. Drop orphans (any date): parent commitment no longer exists.
 * 2. De-duplicate (any date): for identical (parentId, date, instanceIndex),
 *    keep the completed one if any (ideal > fallback), else the first.
 * 3. Reconcile future/pending only (status 'pending' AND date >= today):
 *    drop if the parent no longer occurs that day or the instanceIndex is
 *    out of range; else re-sync targetTime from the parent when different.
 *    Completed/past tasks are history — never dropped or retimed here.
 * 4. Generate missing instances for every dateKey in `dateKeys` (never
 *    before the parent's createdAt date).
 * 5. Report `changed`; surviving task ids are preserved.
 */
export function syncTasksForDates(
  data: AppData,
  dateKeys: string[],
  today: string
): { tasks: Task[]; changed: boolean } {
  const byId = new Map<string, Commitment>();
  for (const c of data.commitments) byId.set(c.id, c);

  let changed = false;

  // ---- Rule 1 (drop orphans) + Rule 2 (de-duplicate) ----
  const deduped: Task[] = [];
  const keyToIndex = new Map<string, number>();

  for (const task of data.tasks) {
    const parentId = getParentId(task);
    if (!byId.has(parentId)) {
      changed = true; // orphan dropped
      continue;
    }
    const key = instanceKey(parentId, task.date, task.instanceIndex);
    const existingIndex = keyToIndex.get(key);
    if (existingIndex === undefined) {
      keyToIndex.set(key, deduped.length);
      deduped.push(task);
    } else {
      changed = true; // one of the duplicates is dropped either way
      const existing = deduped[existingIndex];
      // Strict '>' keeps the FIRST task among equal ranks.
      if (duplicateRank(task) > duplicateRank(existing)) {
        deduped[existingIndex] = task;
      }
    }
  }

  // ---- Rule 3: reconcile pending tasks dated today or later ----
  const tasks: Task[] = [];
  for (const task of deduped) {
    if (task.status !== 'pending' || compareKeys(task.date, today) < 0) {
      // Completed or past — untouchable history.
      tasks.push(task);
      continue;
    }
    const parent = byId.get(getParentId(task));
    if (!parent) continue; // unreachable: orphans already dropped
    if (
      !occursOnDate(parent, task.date) ||
      task.instanceIndex >= instancesForDate(parent)
    ) {
      changed = true; // schedule shrank / moved — drop the stale instance
      continue;
    }
    const nextTime = targetTimeFor(parent, task.instanceIndex);
    if ((task.targetTime ?? null) !== nextTime) {
      changed = true;
      tasks.push({ ...task, targetTime: nextTime });
    } else {
      tasks.push(task);
    }
  }

  // ---- Rule 4: generate missing instances for the requested dates ----
  const existingKeys = new Set<string>();
  for (const t of tasks) {
    existingKeys.add(instanceKey(getParentId(t), t.date, t.instanceIndex));
  }

  for (const dateKey of dateKeys) {
    for (const c of data.commitments) {
      if (!occursOnDate(c, dateKey)) continue;
      if (compareKeys(dateKey, dateKeyOfIso(c.createdAt)) < 0) continue;
      const count = instancesForDate(c);
      for (let i = 0; i < count; i++) {
        const key = instanceKey(c.id, dateKey, i);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        const task: Task = {
          id: newId('task'),
          date: dateKey,
          targetTime: targetTimeFor(c, i),
          instanceIndex: i,
          status: 'pending',
          completedSubtasks: [],
        };
        task[parentIdField(c.type)] = c.id;
        tasks.push(task);
        changed = true;
      }
    }
  }

  return { tasks, changed };
}

/** pending + date < today → 'missed'; otherwise the stored status. */
export function effectiveStatus(task: Task, today: string): TaskStatus {
  if (task.status === 'pending' && compareKeys(task.date, today) < 0) {
    return 'missed';
  }
  return task.status;
}

/** Credit earned by a task per its stored status. */
export function taskCredit(task: Task): number {
  return CREDIT[task.status];
}

/** All tasks whose date is `dateKey`. */
export function tasksOn(tasks: Task[], dateKey: string): Task[] {
  return tasks.filter((t) => t.date === dateKey);
}
