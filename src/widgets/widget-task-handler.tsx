/**
 * Background task handler for the Android home-screen widget.
 *
 * Loads the persisted app data, computes today's tasks read-only via
 * `syncTasksForDates` (nothing is written back), and renders TodayWidget.
 * Only ever evaluated behind the Android-only guards in the root index.ts
 * and `src/lib/widgets.ts`, and every step is wrapped in try/catch.
 */

import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { formatTime, todayKey } from '@/lib/dates';
import { dayCompletion, disciplineScore } from '@/lib/score';
import { loadAppData } from '@/lib/storage';
import { syncTasksForDates, tasksOn } from '@/lib/taskGeneration';
import type { AppData, Commitment, Task } from '@/types';
import { getParentId } from '@/types';
import type { TodayWidgetItem } from '@/widgets/TodayWidget';
import { TodayWidget } from '@/widgets/TodayWidget';

export const TODAY_WIDGET_NAME = 'FallbackToday';

/** Sorts a day's tasks by time (nulls last) then parent name. */
function sortDayTasks(
  tasks: Task[],
  byId: Map<string, Commitment>
): Task[] {
  const nameOf = (t: Task) => byId.get(getParentId(t))?.name ?? '';
  return [...tasks].sort((a, b) => {
    const ta = a.targetTime ?? null;
    const tb = b.targetTime ?? null;
    if (ta !== null && tb !== null && ta !== tb) return ta < tb ? -1 : 1;
    if (ta !== null && tb === null) return -1;
    if (ta === null && tb !== null) return 1;
    return nameOf(a).localeCompare(nameOf(b));
  });
}

/**
 * Pure compute + render of the widget tree for the given data.
 * Shared with `updateWidgets` in src/lib/widgets.ts.
 */
export function renderTodayWidget(data: AppData): React.JSX.Element {
  const today = todayKey();
  // Read-only reconciliation: the resulting tasks array is never persisted.
  const { tasks } = syncTasksForDates(data, [today], today);

  const byId = new Map<string, Commitment>();
  for (const c of data.commitments) byId.set(c.id, c);

  const dayTasks = sortDayTasks(
    tasksOn(tasks, today).filter((t) => byId.has(getParentId(t))),
    byId
  );

  const items: TodayWidgetItem[] = dayTasks.map((t) => ({
    name: byId.get(getParentId(t))?.name ?? '',
    time: t.targetTime ? formatTime(t.targetTime) : null,
    status: t.status,
  }));

  const { done, total } = dayCompletion(dayTasks);
  const score = disciplineScore(tasks, today);

  return (
    <TodayWidget
      done={done}
      total={total}
      score={score}
      items={items}
      dark={data.settings.darkMode}
    />
  );
}

export async function widgetTaskHandler(
  props: WidgetTaskHandlerProps
): Promise<void> {
  if (props.widgetInfo.widgetName !== TODAY_WIDGET_NAME) return;
  if (props.widgetAction === 'WIDGET_DELETED') return;
  try {
    const data = await loadAppData();
    props.renderWidget(renderTodayWidget(data));
  } catch {
    // Never crash the headless task — leave the widget as-is.
  }
}
