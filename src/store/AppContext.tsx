/**
 * Single state provider for Fallback.
 *
 * Owns the whole AppData blob: loads it on mount, exposes every mutation the
 * UI needs, debounces persistence (250ms, flushed when the app backgrounds),
 * reloads + re-syncs tasks when the app foregrounds (the date may have rolled
 * over), and fans out debounced fire-and-forget side effects (notifications
 * rescheduling + widget refresh) after every data change.
 *
 * A ref mirror of `data` guarantees debounced callbacks never persist stale
 * state.
 */

import * as Haptics from 'expo-haptics';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { Theme, getTheme } from '@/constants/theme';
import { addDays, dateKeysBetween, todayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';
import {
  ensurePermissions,
  rescheduleAllNotifications,
} from '@/lib/notifications';
import { disciplineScore } from '@/lib/score';
import {
  clearAppData,
  createDefaultAppData,
  loadAppData,
  loadAppDataStrict,
  saveAppData,
} from '@/lib/storage';
import { stepDueOnDate, syncTasksForDates } from '@/lib/taskGeneration';
import { updateWidgets } from '@/lib/widgets';
import type {
  AppData,
  AppSettings,
  Commitment,
  Step,
  TagKind,
  TaskStatus,
} from '@/types';
import { getParentId } from '@/types';

export type NewCommitmentInput = Omit<Commitment, 'id' | 'createdAt'>;

export interface AppStore {
  ready: boolean;
  data: AppData;
  theme: Theme;
  score30: number | null;
  /** Today's 'YYYY-MM-DD' key, kept current across midnight rollovers. */
  today: string;

  addCommitment(input: NewCommitmentInput): void;
  updateCommitment(id: string, patch: Partial<Commitment>): void;
  deleteCommitment(id: string): void;
  duplicateCommitment(id: string): void;
  getCommitment(id: string): Commitment | undefined;

  ensureTasksFor(dateKey: string): void;
  completeTask(taskId: string, level: 'ideal' | 'fallback'): void;
  reopenTask(taskId: string): void;
  toggleSubtask(taskId: string, stepId: string, group: 'ideal' | 'fallback'): void;

  addTodo(title: string): void;
  toggleTodo(id: string): void;
  deleteTodo(id: string): void;

  addTag(kind: TagKind, name: string, color: string): void;
  setTagColor(kind: TagKind, name: string, color: string): void;

  setSettings(patch: Partial<AppSettings>): void;
  completeOnboarding(): void;
  wipeAll(): Promise<void>;
  exportBackup(): string;
}

const AppContext = createContext<AppStore | null>(null);

const SAVE_DEBOUNCE_MS = 250;
const SIDE_EFFECT_DEBOUNCE_MS = 1000;

/** Light impact haptic; no-op on web and on any native failure. */
function lightHaptic(): void {
  if (Platform.OS === 'web') return;
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    // native module unavailable — ignore
  }
}

/** Deep copy of a steps array with fresh step ids. */
function copySteps(steps: Step[]): Step[] {
  return steps.map((s) => ({
    ...s,
    id: newId('step'),
    targetDays: s.targetDays ? [...s.targetDays] : undefined,
  }));
}

/** ms until just past the next local midnight. */
function msUntilNextMidnight(): number {
  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    2
  );
  return Math.max(1000, next.getTime() - now.getTime());
}

export function AppProvider(props: {
  children: React.ReactNode;
}): React.ReactElement {
  const [data, setDataState] = useState<AppData>(() => createDefaultAppData());
  const [ready, setReady] = useState(false);
  // Held in state (not read ad hoc) so a midnight rollover re-renders every
  // consumer and the 30-day score window shifts without an app restart.
  const [today, setToday] = useState<string>(() => todayKey());

  // Ref mirrors so debounced callbacks never see stale state.
  const dataRef = useRef<AppData>(data);
  const readyRef = useRef(false);
  const todayRef = useRef(today);
  // The most recently viewed/ensured date — commitment mutations re-sync this
  // window too, so edits made while viewing a far-future day show up there.
  const lastEnsuredRef = useRef<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Re-runs the task reconciler over [today .. today+6] plus, when the user
   * has viewed a date outside that window, [viewed .. viewed+6].
   */
  const syncWindows = useCallback((prev: AppData): AppData => {
    const t = todayRef.current;
    const keys = new Set(dateKeysBetween(t, addDays(t, 6)));
    const ensured = lastEnsuredRef.current;
    if (ensured && !keys.has(ensured)) {
      for (const k of dateKeysBetween(ensured, addDays(ensured, 6))) {
        keys.add(k);
      }
    }
    const { tasks, changed } = syncTasksForDates(prev, [...keys], t);
    return changed ? { ...prev, tasks } : prev;
  }, []);

  // ---------- persistence & side effects ----------

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void saveAppData(dataRef.current).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  }, []);

  /** Saves immediately if a debounced save is pending. */
  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void saveAppData(dataRef.current).catch(() => {});
    }
  }, []);

  /** Cancels a pending save without writing (used by wipeAll). */
  const cancelSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  const scheduleSideEffects = useCallback(() => {
    if (fxTimer.current) clearTimeout(fxTimer.current);
    fxTimer.current = setTimeout(() => {
      fxTimer.current = null;
      const current = dataRef.current;
      void rescheduleAllNotifications(current).catch(() => {});
      void updateWidgets(current).catch(() => {});
    }, SIDE_EFFECT_DEBOUNCE_MS);
  }, []);

  /**
   * Central mutation entry point. The updater runs against the ref mirror
   * (never stale); returning the same reference means "no change" and skips
   * the save/side-effect pipeline.
   */
  const setData = useCallback(
    (updater: (prev: AppData) => AppData) => {
      const prev = dataRef.current;
      const next = updater(prev);
      if (next === prev) return;
      dataRef.current = next;
      setDataState(next);
      scheduleSave();
      scheduleSideEffects();
    },
    [scheduleSave, scheduleSideEffects]
  );

  // ---------- load / foreground / background ----------

  const reloadFromDisk = useCallback(async () => {
    // Persist anything still pending before re-reading disk.
    flushSave();
    const before = dataRef.current;
    try {
      const loaded = await loadAppDataStrict();
      // A mutation landed while the read was in flight — keep the newer
      // in-memory state (its save is already scheduled) instead of silently
      // reverting the user's action to the older disk snapshot.
      if (dataRef.current !== before) return;
      // Never adopt an empty-default blob over real in-memory data: this app
      // is the only writer, so "disk empty, memory populated" can only mean
      // a bad read — adopting it (and then saving) would wipe everything.
      const cur = dataRef.current;
      const loadedEmpty =
        loaded.commitments.length === 0 &&
        loaded.tasks.length === 0 &&
        loaded.todoBucket.length === 0 &&
        !loaded.hasCompletedOnboarding;
      const curHasContent =
        cur.commitments.length > 0 ||
        cur.tasks.length > 0 ||
        cur.todoBucket.length > 0 ||
        cur.hasCompletedOnboarding;
      if (loadedEmpty && curHasContent) return;
      const synced = syncWindows(loaded);
      dataRef.current = synced;
      setDataState(synced);
      if (synced !== loaded) scheduleSave();
      scheduleSideEffects();
    } catch {
      // read failed — keep the known-good in-memory state
    }
  }, [flushSave, scheduleSave, scheduleSideEffects, syncWindows]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadAppData();
      if (cancelled) return;
      const synced = syncWindows(loaded);
      dataRef.current = synced;
      setDataState(synced);
      readyRef.current = true;
      setReady(true);
      if (synced !== loaded) scheduleSave();
      // Refresh notifications/widgets on every cold start (date rollover).
      scheduleSideEffects();
      // Reminders default ON: returning users must get the OS permission
      // prompt without ever touching the toggle (fresh installs get it from
      // completeOnboarding instead, after the intro screen).
      if (synced.settings.remindersEnabled && synced.hasCompletedOnboarding) {
        try {
          void ensurePermissions().catch(() => {});
        } catch {
          // permissions are best-effort
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (!readyRef.current) return;
      if (state === 'background' || state === 'inactive') {
        flushSave();
      } else if (state === 'active') {
        setToday(todayKey());
        void reloadFromDisk();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [flushSave, reloadFromDisk]);

  // Keep `today` current while the app stays in the foreground: fire just
  // past each local midnight, then re-sync windows and side effects.
  useEffect(() => {
    todayRef.current = today;
    const timer = setTimeout(() => setToday(todayKey()), msUntilNextMidnight());
    return () => clearTimeout(timer);
  }, [today]);

  useEffect(() => {
    if (!readyRef.current) return;
    setData((prev) => syncWindows(prev));
    scheduleSideEffects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  // Flush any pending save if the provider ever unmounts.
  useEffect(() => {
    return () => {
      flushSave();
      if (fxTimer.current) clearTimeout(fxTimer.current);
    };
  }, [flushSave]);

  // ---------- commitments ----------

  const addCommitment = useCallback(
    (input: NewCommitmentInput) => {
      setData((prev) => {
        const commitment: Commitment = {
          ...input,
          id: newId('commitment'),
          createdAt: new Date().toISOString(),
        };
        return syncWindows({
          ...prev,
          commitments: [...prev.commitments, commitment],
        });
      });
    },
    [setData]
  );

  const updateCommitment = useCallback(
    (id: string, patch: Partial<Commitment>) => {
      setData((prev) => {
        const idx = prev.commitments.findIndex((c) => c.id === id);
        if (idx < 0) return prev;
        const commitments = prev.commitments.slice();
        commitments[idx] = { ...commitments[idx], ...patch, id };
        return syncWindows({ ...prev, commitments });
      });
    },
    [setData]
  );

  const deleteCommitment = useCallback(
    (id: string) => {
      setData((prev) => {
        if (!prev.commitments.some((c) => c.id === id)) return prev;
        return syncWindows({
          ...prev,
          commitments: prev.commitments.filter((c) => c.id !== id),
        });
      });
    },
    [setData]
  );

  const duplicateCommitment = useCallback(
    (id: string) => {
      setData((prev) => {
        const src = prev.commitments.find((c) => c.id === id);
        if (!src) return prev;
        const copy: Commitment = {
          ...src,
          id: newId('commitment'),
          name: `${src.name} copy`,
          createdAt: new Date().toISOString(),
          idealSubtasks: copySteps(src.idealSubtasks),
          fallbackSubtasks: copySteps(src.fallbackSubtasks),
          targetDays: src.targetDays ? [...src.targetDays] : undefined,
          targetTimes: src.targetTimes ? [...src.targetTimes] : undefined,
        };
        return syncWindows({
          ...prev,
          commitments: [...prev.commitments, copy],
        });
      });
    },
    [setData]
  );

  const getCommitment = useCallback(
    (id: string): Commitment | undefined =>
      dataRef.current.commitments.find((c) => c.id === id),
    []
  );

  // ---------- tasks ----------

  const ensureTasksFor = useCallback(
    (dateKey: string) => {
      lastEnsuredRef.current = dateKey;
      setData((prev) => {
        const keys = dateKeysBetween(dateKey, addDays(dateKey, 6));
        const { tasks, changed } = syncTasksForDates(
          prev,
          keys,
          todayRef.current
        );
        return changed ? { ...prev, tasks } : prev;
      });
    },
    [setData]
  );

  const completeTask = useCallback(
    (taskId: string, level: 'ideal' | 'fallback') => {
      const status: TaskStatus =
        level === 'ideal' ? 'completed_ideal' : 'completed_fallback';
      let found = false;
      setData((prev) => {
        const idx = prev.tasks.findIndex((t) => t.id === taskId);
        if (idx < 0) return prev;
        found = true;
        const task = prev.tasks[idx];
        if (task.status === status) return prev;
        const tasks = prev.tasks.slice();
        tasks[idx] = { ...task, status };
        return { ...prev, tasks };
      });
      if (found) lightHaptic();
    },
    [setData]
  );

  const reopenTask = useCallback(
    (taskId: string) => {
      let found = false;
      setData((prev) => {
        const idx = prev.tasks.findIndex((t) => t.id === taskId);
        if (idx < 0) return prev;
        found = true;
        const task = prev.tasks[idx];
        if (task.status === 'pending') return prev;
        const tasks = prev.tasks.slice();
        // Checked steps are kept — only the status resets.
        tasks[idx] = { ...task, status: 'pending' };
        return { ...prev, tasks };
      });
      if (found) lightHaptic();
    },
    [setData]
  );

  const toggleSubtask = useCallback(
    (taskId: string, stepId: string, group: 'ideal' | 'fallback') => {
      let found = false;
      setData((prev) => {
        const idx = prev.tasks.findIndex((t) => t.id === taskId);
        if (idx < 0) return prev;
        found = true;
        const task = prev.tasks[idx];

        const wasChecked = task.completedSubtasks.includes(stepId);
        const completedSubtasks = wasChecked
          ? task.completedSubtasks.filter((s) => s !== stepId)
          : [...task.completedSubtasks, stepId];

        let status: TaskStatus = task.status;
        if (prev.settings.autoCompleteSteps) {
          const parent = prev.commitments.find(
            (c) => c.id === getParentId(task)
          );
          if (parent) {
            const checked = new Set(completedSubtasks);
            const dueIdeal = parent.idealSubtasks.filter((s) =>
              stepDueOnDate(s, task.date)
            );
            const dueFallback = parent.fallbackSubtasks.filter((s) =>
              stepDueOnDate(s, task.date)
            );
            const allIdeal =
              dueIdeal.length > 0 && dueIdeal.every((s) => checked.has(s.id));
            const allFallback =
              dueFallback.length > 0 &&
              dueFallback.every((s) => checked.has(s.id));

            if (allIdeal) {
              status = 'completed_ideal';
            } else if (allFallback && task.status !== 'completed_ideal') {
              status = 'completed_fallback';
            }
            // Unchecking a step of the group the task was completed at
            // downgrades it back to pending.
            if (
              wasChecked &&
              ((group === 'ideal' && task.status === 'completed_ideal') ||
                (group === 'fallback' && task.status === 'completed_fallback'))
            ) {
              status = 'pending';
            }
          }
        }

        const tasks = prev.tasks.slice();
        tasks[idx] = { ...task, completedSubtasks, status };
        return { ...prev, tasks };
      });
      if (found) lightHaptic();
    },
    [setData]
  );

  // ---------- todos ----------

  const addTodo = useCallback(
    (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      setData((prev) => ({
        ...prev,
        todoBucket: [
          ...prev.todoBucket,
          { id: newId('todo'), title: trimmed, completed: false },
        ],
      }));
    },
    [setData]
  );

  const toggleTodo = useCallback(
    (id: string) => {
      setData((prev) => {
        const idx = prev.todoBucket.findIndex((t) => t.id === id);
        if (idx < 0) return prev;
        const todoBucket = prev.todoBucket.slice();
        const todo = todoBucket[idx];
        todoBucket[idx] = { ...todo, completed: !todo.completed };
        return { ...prev, todoBucket };
      });
    },
    [setData]
  );

  const deleteTodo = useCallback(
    (id: string) => {
      setData((prev) => {
        if (!prev.todoBucket.some((t) => t.id === id)) return prev;
        return {
          ...prev,
          todoBucket: prev.todoBucket.filter((t) => t.id !== id),
        };
      });
    },
    [setData]
  );

  // ---------- tags ----------

  const setTag = useCallback(
    (kind: TagKind, name: string, color: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setData((prev) => {
        const field = kind === 'importance' ? 'importanceMap' : 'necessityMap';
        if (prev[field][trimmed] === color) return prev;
        return { ...prev, [field]: { ...prev[field], [trimmed]: color } };
      });
    },
    [setData]
  );

  const addTag = useCallback(
    (kind: TagKind, name: string, color: string) => {
      setTag(kind, name, color);
    },
    [setTag]
  );

  const setTagColor = useCallback(
    (kind: TagKind, name: string, color: string) => {
      setTag(kind, name, color);
    },
    [setTag]
  );

  // ---------- settings / lifecycle ----------

  const setSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setData((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
      }));
      if (patch.remindersEnabled === true) {
        try {
          void ensurePermissions().catch(() => {});
        } catch {
          // ignore — permissions are best-effort
        }
      }
    },
    [setData]
  );

  const completeOnboarding = useCallback(() => {
    setData((prev) =>
      prev.hasCompletedOnboarding
        ? prev
        : { ...prev, hasCompletedOnboarding: true }
    );
    // First entry into the app: reminders default ON, so this is the moment
    // to surface the OS notification-permission prompt.
    if (dataRef.current.settings.remindersEnabled) {
      try {
        void ensurePermissions().catch(() => {});
      } catch {
        // permissions are best-effort
      }
    }
  }, [setData]);

  const wipeAll = useCallback(async () => {
    // Never let a pending save resurrect the old data after the wipe.
    cancelSave();
    try {
      await clearAppData();
    } catch {
      // storage failure — still reset in-memory state
    }
    const fresh = createDefaultAppData();
    dataRef.current = fresh;
    setDataState(fresh);
    // Cancel notifications / clear the widget for the now-empty dataset.
    scheduleSideEffects();
  }, [cancelSave, scheduleSideEffects]);

  const exportBackup = useCallback(
    (): string => JSON.stringify(dataRef.current, null, 2),
    []
  );

  // ---------- derived ----------

  const theme = useMemo(
    () => getTheme(data.settings.darkMode),
    [data.settings.darkMode]
  );

  const score30 = useMemo(
    () => disciplineScore(data.tasks, today),
    [data.tasks, today]
  );

  const store = useMemo<AppStore>(
    () => ({
      ready,
      data,
      theme,
      score30,
      today,
      addCommitment,
      updateCommitment,
      deleteCommitment,
      duplicateCommitment,
      getCommitment,
      ensureTasksFor,
      completeTask,
      reopenTask,
      toggleSubtask,
      addTodo,
      toggleTodo,
      deleteTodo,
      addTag,
      setTagColor,
      setSettings,
      completeOnboarding,
      wipeAll,
      exportBackup,
    }),
    [
      ready,
      data,
      theme,
      score30,
      today,
      addCommitment,
      updateCommitment,
      deleteCommitment,
      duplicateCommitment,
      getCommitment,
      ensureTasksFor,
      completeTask,
      reopenTask,
      toggleSubtask,
      addTodo,
      toggleTodo,
      deleteTodo,
      addTag,
      setTagColor,
      setSettings,
      completeOnboarding,
      wipeAll,
      exportBackup,
    ]
  );

  return (
    <AppContext.Provider value={store}>{props.children}</AppContext.Provider>
  );
}

export function useApp(): AppStore {
  const store = useContext(AppContext);
  if (!store) {
    throw new Error('useApp must be used inside <AppProvider>');
  }
  return store;
}

export function useTheme(): Theme {
  return useApp().theme;
}
