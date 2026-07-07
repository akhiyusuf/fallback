/**
 * Shared types for Fallback.
 *
 * Every commitment carries two versions of its task: the "ideal" (full)
 * version worth 1.0 credit and the "fallback" (minimum backup) version
 * worth 0.5 credit. Per-day Task instances are generated on demand from
 * commitments and store completion state.
 */

export type CommitmentType = 'routine' | 'event' | 'regimen';

/** 'daily' = every day; 'weekly' = only on the weekdays in `targetDays`. */
export type Frequency = 'daily' | 'weekly';

/** Weekday index, 0 = Sunday … 6 = Saturday (matches Date.getDay()). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A subtask/step inside the ideal or fallback checklist. */
export interface Step {
  id: string;
  title: string;
  /** How often this step is due. Defaults to 'daily'. */
  frequency: Frequency;
  /** Weekdays the step is due when frequency === 'weekly'. */
  targetDays?: Weekday[];
  /** Optional short badge text shown next to the step (e.g. "5 min"). */
  badge?: string;
}

export interface Commitment {
  id: string;
  type: CommitmentType;
  name: string;
  /** Full version of the task. */
  idealTask: string;
  idealSubtasks: Step[];
  /** Minimum backup version of the task. */
  fallbackTask: string;
  fallbackSubtasks: Step[];
  /** Tag name — key into AppData.importanceMap. */
  importance: string;
  /** Tag name — key into AppData.necessityMap. */
  necessity: string;
  /** ISO datetime. Tasks are only generated on/after this date. */
  createdAt: string;

  // ---- Routine + regimen scheduling ----
  /** 'daily' or 'weekly' (specific weekdays). */
  frequency?: Frequency;
  /** Weekdays the commitment occurs when frequency === 'weekly'. */
  targetDays?: Weekday[];
  /** Occurrences per day, 1–10. Defaults to 1. */
  dailyFrequency?: number;
  /** Optional 'HH:mm' time per occurrence; index = instanceIndex. */
  targetTimes?: (string | null)[];

  // ---- Regimen ----
  /** Deadline 'YYYY-MM-DD', or null/undefined for an indefinite regimen. */
  targetDate?: string | null;

  // ---- Event ----
  /** The single date 'YYYY-MM-DD' of a one-off event. */
  targetEventDate?: string;
  /** Optional 'HH:mm' time of a one-off event. */
  targetTime?: string | null;
}

export type TaskStatus =
  | 'pending'
  | 'completed_ideal'
  | 'completed_fallback'
  | 'missed';

/** A generated per-day instance of a commitment. */
export interface Task {
  id: string;
  /** Parent id when the parent is a routine. */
  scheduleId?: string;
  /** Parent id when the parent is an event. */
  goalId?: string;
  /** Parent id when the parent is a regimen. */
  regimenId?: string;
  /** 'YYYY-MM-DD' local date this instance belongs to. */
  date: string;
  /** 'HH:mm' or null; kept in sync with the parent's times. */
  targetTime?: string | null;
  /** 0-based index for multiple-per-day occurrences. */
  instanceIndex: number;
  status: TaskStatus;
  /** Step ids (from ideal or fallback checklists) that are checked. */
  completedSubtasks: string[];
}

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface AppSettings {
  /** Master switch for local notifications. */
  remindersEnabled: boolean;
  /** Manual dark mode toggle. */
  darkMode: boolean;
  /** When on, checking every step in a group auto-completes the task. */
  autoCompleteSteps: boolean;
  /** Minutes before a timed task to send the heads-up reminder. */
  reminderLeadMinutes: number;
}

/** name → hex color. */
export type TagColorMap = Record<string, string>;

/** The whole app state, persisted as one JSON blob. */
export interface AppData {
  /** Schema version for migrations. */
  version: number;
  commitments: Commitment[];
  tasks: Task[];
  importanceMap: TagColorMap;
  necessityMap: TagColorMap;
  todoBucket: TodoItem[];
  hasCompletedOnboarding: boolean;
  settings: AppSettings;
}

export type TagKind = 'importance' | 'necessity';

/** Credit earned per task outcome. */
export const CREDIT: Record<TaskStatus, number> = {
  pending: 0,
  missed: 0,
  completed_fallback: 0.5,
  completed_ideal: 1,
};

/** Returns the parent commitment id of a task regardless of type. */
export function getParentId(task: Task): string {
  return task.scheduleId ?? task.goalId ?? task.regimenId ?? '';
}

/** Builds the parent-id field for a task from the commitment type. */
export function parentIdField(
  type: CommitmentType
): 'scheduleId' | 'goalId' | 'regimenId' {
  switch (type) {
    case 'routine':
      return 'scheduleId';
    case 'event':
      return 'goalId';
    case 'regimen':
      return 'regimenId';
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  remindersEnabled: true,
  darkMode: false,
  autoCompleteSteps: true,
  reminderLeadMinutes: 15,
};

export const DEFAULT_IMPORTANCE_MAP: TagColorMap = {
  High: '#E07856',
  Medium: '#E3A857',
  Low: '#8FB573',
};

export const DEFAULT_NECESSITY_MAP: TagColorMap = {
  Essential: '#6D8FC9',
  Helpful: '#9B85C4',
  Optional: '#8A9BA8',
};

export const SCHEMA_VERSION = 1;
