/**
 * Persistence layer for Fallback.
 *
 * The whole app state is stored as a single JSON blob in AsyncStorage.
 * `migrateAppData` is the defensive gate: it accepts ANY input (null,
 * strings, half-formed legacy objects, corrupt JSON shapes) and always
 * returns a valid `AppData` without ever throwing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { TAG_COLOR_CHOICES } from '@/constants/theme';
import { parseDateKey } from '@/lib/dates';
import { newId } from '@/lib/ids';
import {
  AppData,
  AppSettings,
  Commitment,
  CommitmentType,
  DEFAULT_IMPORTANCE_MAP,
  DEFAULT_NECESSITY_MAP,
  DEFAULT_SETTINGS,
  Frequency,
  SCHEMA_VERSION,
  Step,
  TagColorMap,
  Task,
  TaskStatus,
  TodoItem,
  Weekday,
} from '@/types';

export const STORAGE_KEY = 'fallback.appData.v1';

const DEFAULT_IMPORTANCE_TAG = 'Medium';
const DEFAULT_NECESSITY_TAG = 'Helpful';

// ---------------------------------------------------------------------------
// Small guards / coercers
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function nonEmptyString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valid 'YYYY-MM-DD' key or null. */
function sanitizeDateKey(v: unknown): string | null {
  if (typeof v !== 'string' || !DATE_KEY_RE.test(v)) return null;
  const d = parseDateKey(v);
  return isNaN(d.getTime()) ? null : v;
}

/** Valid 'HH:mm' (normalized, zero-padded) or null. */
function sanitizeTime(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** ISO datetime string or "now" when missing/unparseable. */
function sanitizeIso(v: unknown): string {
  if (typeof v === 'string' && !isNaN(new Date(v).getTime())) return v;
  return new Date().toISOString();
}

function sanitizeFrequency(v: unknown): Frequency {
  return v === 'daily' || v === 'weekly' ? v : 'daily';
}

/** Filters to integers 0–6; undefined when not an array. */
function sanitizeTargetDays(v: unknown): Weekday[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter(
    (d): d is Weekday => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6
  );
}

/** Clamps to a 1–10 integer; defaults to 1. */
function sanitizeDailyFrequency(v: unknown): number {
  if (typeof v !== 'number' || !isFinite(v)) return 1;
  return Math.min(10, Math.max(1, Math.round(v)));
}

function sanitizeTargetTimes(v: unknown): (string | null)[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((t) => sanitizeTime(t));
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** Coerces a single stored step (legacy plain string or object) to a Step. */
function sanitizeStep(v: unknown): Step | null {
  if (typeof v === 'string') {
    // Legacy shape: steps were stored as plain title strings.
    return { id: newId('step'), title: v, frequency: 'daily' };
  }
  if (!isRecord(v)) return null;
  const step: Step = {
    id: nonEmptyString(v.id) ?? newId('step'),
    title: asString(v.title),
    frequency: sanitizeFrequency(v.frequency),
  };
  const targetDays = sanitizeTargetDays(v.targetDays);
  if (targetDays !== undefined) step.targetDays = targetDays;
  const badge = nonEmptyString(v.badge);
  if (badge !== null) step.badge = badge;
  return step;
}

function sanitizeSteps(v: unknown): Step[] {
  if (!Array.isArray(v)) return [];
  return v.map(sanitizeStep).filter((s): s is Step => s !== null);
}

// ---------------------------------------------------------------------------
// Commitments
// ---------------------------------------------------------------------------

function isCommitmentType(v: unknown): v is CommitmentType {
  return v === 'routine' || v === 'event' || v === 'regimen';
}

/** Infers a missing/invalid commitment type from the fields present. */
function inferType(obj: Record<string, unknown>): CommitmentType {
  if (nonEmptyString(obj.targetEventDate) !== null) return 'event';
  if (obj.targetDate !== undefined) return 'regimen';
  return 'routine';
}

function sanitizeCommitment(v: unknown): Commitment | null {
  if (!isRecord(v)) return null;

  const type = isCommitmentType(v.type) ? v.type : inferType(v);

  // Legacy field names: task → idealTask, subtasks → idealSubtasks,
  // fallback → fallbackTask, fallbackSteps → fallbackSubtasks.
  const idealTask = asString(v.idealTask, asString(v.task));
  const fallbackTask = asString(v.fallbackTask, asString(v.fallback));
  const idealSubtasks = sanitizeSteps(v.idealSubtasks !== undefined ? v.idealSubtasks : v.subtasks);
  const fallbackSubtasks = sanitizeSteps(
    v.fallbackSubtasks !== undefined ? v.fallbackSubtasks : v.fallbackSteps
  );

  const c: Commitment = {
    id: nonEmptyString(v.id) ?? newId('commitment'),
    type,
    name: asString(v.name),
    idealTask,
    idealSubtasks,
    fallbackTask,
    fallbackSubtasks,
    importance: nonEmptyString(v.importance) ?? DEFAULT_IMPORTANCE_TAG,
    necessity: nonEmptyString(v.necessity) ?? DEFAULT_NECESSITY_TAG,
    createdAt: sanitizeIso(v.createdAt),
  };

  if (type === 'event') {
    const eventDate = sanitizeDateKey(v.targetEventDate);
    if (eventDate !== null) c.targetEventDate = eventDate;
    c.targetTime = sanitizeTime(v.targetTime);
  } else {
    // routine + regimen scheduling
    c.frequency = sanitizeFrequency(v.frequency);
    const targetDays = sanitizeTargetDays(v.targetDays);
    if (targetDays !== undefined) c.targetDays = targetDays;
    c.dailyFrequency = sanitizeDailyFrequency(v.dailyFrequency);
    const targetTimes = sanitizeTargetTimes(v.targetTimes);
    if (targetTimes !== undefined) c.targetTimes = targetTimes;
    if (type === 'regimen') {
      c.targetDate = sanitizeDateKey(v.targetDate);
    }
  }

  return c;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

function isTaskStatus(v: unknown): v is TaskStatus {
  return (
    v === 'pending' ||
    v === 'completed_ideal' ||
    v === 'completed_fallback' ||
    v === 'missed'
  );
}

/** Returns null for tasks without a parseable date or any parent id. */
function sanitizeTask(v: unknown): Task | null {
  if (!isRecord(v)) return null;

  const date = sanitizeDateKey(v.date);
  if (date === null) return null;

  const scheduleId = nonEmptyString(v.scheduleId);
  const goalId = nonEmptyString(v.goalId);
  const regimenId = nonEmptyString(v.regimenId);
  if (scheduleId === null && goalId === null && regimenId === null) return null;

  const instanceIndexRaw = v.instanceIndex;
  const instanceIndex =
    typeof instanceIndexRaw === 'number' && isFinite(instanceIndexRaw)
      ? Math.max(0, Math.floor(instanceIndexRaw))
      : 0;

  const completedSubtasks = Array.isArray(v.completedSubtasks)
    ? v.completedSubtasks.filter((s): s is string => typeof s === 'string')
    : [];

  const task: Task = {
    id: nonEmptyString(v.id) ?? newId('task'),
    date,
    targetTime: sanitizeTime(v.targetTime),
    instanceIndex,
    status: isTaskStatus(v.status) ? v.status : 'pending',
    completedSubtasks,
  };
  if (scheduleId !== null) task.scheduleId = scheduleId;
  if (goalId !== null) task.goalId = goalId;
  if (regimenId !== null) task.regimenId = regimenId;
  return task;
}

// ---------------------------------------------------------------------------
// Todos, tag maps, settings
// ---------------------------------------------------------------------------

function sanitizeTodo(v: unknown): TodoItem | null {
  if (typeof v === 'string') {
    return { id: newId('todo'), title: v, completed: false };
  }
  if (!isRecord(v)) return null;
  const title = nonEmptyString(v.title);
  if (title === null) return null;
  return {
    id: nonEmptyString(v.id) ?? newId('todo'),
    title,
    completed: Boolean(v.completed),
  };
}

/** Merges stored string→string entries over the defaults. */
function mergeTagMap(defaults: TagColorMap, stored: unknown): TagColorMap {
  const map: TagColorMap = { ...defaults };
  if (isRecord(stored)) {
    for (const [name, color] of Object.entries(stored)) {
      if (name.length > 0 && typeof color === 'string' && color.length > 0) {
        map[name] = color;
      }
    }
  }
  return map;
}

/** Adds a referenced-but-missing tag with a palette color. */
function ensureTag(map: TagColorMap, name: string): void {
  if (name.length === 0 || map[name] !== undefined) return;
  const color = TAG_COLOR_CHOICES[Object.keys(map).length % TAG_COLOR_CHOICES.length];
  map[name] = color;
}

function mergeSettings(stored: unknown): AppSettings {
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  if (isRecord(stored)) {
    if (typeof stored.remindersEnabled === 'boolean') {
      settings.remindersEnabled = stored.remindersEnabled;
    }
    if (typeof stored.darkMode === 'boolean') {
      settings.darkMode = stored.darkMode;
    }
    if (typeof stored.autoCompleteSteps === 'boolean') {
      settings.autoCompleteSteps = stored.autoCompleteSteps;
    }
    if (
      typeof stored.reminderLeadMinutes === 'number' &&
      isFinite(stored.reminderLeadMinutes) &&
      stored.reminderLeadMinutes > 0
    ) {
      settings.reminderLeadMinutes = Math.round(stored.reminderLeadMinutes);
    }
  }
  return settings;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createDefaultAppData(): AppData {
  return {
    version: SCHEMA_VERSION,
    commitments: [],
    tasks: [],
    importanceMap: { ...DEFAULT_IMPORTANCE_MAP },
    necessityMap: { ...DEFAULT_NECESSITY_MAP },
    todoBucket: [],
    hasCompletedOnboarding: false,
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Never throws; coerces any legacy/corrupt shape into a valid AppData. */
export function migrateAppData(raw: unknown): AppData {
  try {
    if (!isRecord(raw)) return createDefaultAppData();

    const commitments = Array.isArray(raw.commitments)
      ? raw.commitments
          .map(sanitizeCommitment)
          .filter((c): c is Commitment => c !== null)
      : [];

    const tasks = Array.isArray(raw.tasks)
      ? raw.tasks.map(sanitizeTask).filter((t): t is Task => t !== null)
      : [];

    const importanceMap = mergeTagMap(DEFAULT_IMPORTANCE_MAP, raw.importanceMap);
    const necessityMap = mergeTagMap(DEFAULT_NECESSITY_MAP, raw.necessityMap);
    for (const c of commitments) {
      ensureTag(importanceMap, c.importance);
      ensureTag(necessityMap, c.necessity);
    }

    const todoBucket = Array.isArray(raw.todoBucket)
      ? raw.todoBucket.map(sanitizeTodo).filter((t): t is TodoItem => t !== null)
      : [];

    return {
      version: SCHEMA_VERSION,
      commitments,
      tasks,
      importanceMap,
      necessityMap,
      todoBucket,
      hasCompletedOnboarding: Boolean(raw.hasCompletedOnboarding),
      settings: mergeSettings(raw.settings),
    };
  } catch {
    // Absolute backstop — migration must never take the app down.
    return createDefaultAppData();
  }
}

/** Loads and migrates the persisted blob; defaults on missing/corrupt. */
export async function loadAppData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return createDefaultAppData();
    return migrateAppData(JSON.parse(raw));
  } catch {
    return createDefaultAppData();
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Best-effort persistence; a failed write must not crash the app.
  }
}

export async function clearAppData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing actionable if the store is unavailable.
  }
}
