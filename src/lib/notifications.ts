/**
 * Local notification scheduling for timed tasks.
 *
 * Reminders fire for PENDING tasks with a targetTime within the next 7 days
 * ([today .. today+6]) — one notification at the task time plus a heads-up
 * `reminderLeadMinutes` earlier. Everything is wrapped in try/catch and
 * no-ops on web or when the native module / permissions are unavailable.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, compareKeys, dateAtTime, todayKey } from '@/lib/dates';
import type { AppData, Commitment } from '@/types';
import { getParentId } from '@/types';

const CHANNEL_ID = 'reminders';
const MAX_SCHEDULED = 50;

/** Sets the foreground notification handler + Android channel. Safe on web. */
export function initNotifications(): void {
  if (Platform.OS === 'web') return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Notifications module unavailable — ignore.
  }
  if (Platform.OS === 'android') {
    try {
      Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
      }).catch(() => undefined);
    } catch {
      // ignore
    }
  }
}

/**
 * Ensures notification permissions, requesting them when needed.
 * Resolves false on web, on denial, or on any error.
 */
export async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/** True when permission is already granted (never prompts). */
async function hasPermissions(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    return current.granted;
  } catch {
    return false;
  }
}

interface PlannedNotification {
  title: string;
  body: string;
  date: Date;
}

/** Builds the (unsorted) list of notifications the data currently calls for. */
function planNotifications(data: AppData, now: Date): PlannedNotification[] {
  const today = todayKey();
  const windowEnd = addDays(today, 6);
  const lead = Math.round(data.settings.reminderLeadMinutes);

  const byId = new Map<string, Commitment>();
  for (const c of data.commitments) byId.set(c.id, c);

  const planned: PlannedNotification[] = [];
  for (const task of data.tasks) {
    if (task.status !== 'pending') continue;
    if (!task.targetTime) continue;
    if (compareKeys(task.date, today) < 0) continue;
    if (compareKeys(task.date, windowEnd) > 0) continue;

    const parent = byId.get(getParentId(task));
    if (!parent) continue;

    const body = `Ideal: ${parent.idealTask} · Fallback: ${parent.fallbackTask}`;
    const atTime = dateAtTime(task.date, task.targetTime);
    if (atTime.getTime() > now.getTime()) {
      planned.push({ title: parent.name, body, date: atTime });
    }
    if (lead > 0) {
      const leadDate = new Date(atTime.getTime() - lead * 60_000);
      if (leadDate.getTime() > now.getTime()) {
        planned.push({
          title: `${parent.name} in ${lead} min`,
          body,
          date: leadDate,
        });
      }
    }
  }
  return planned;
}

/**
 * Cancels every scheduled notification, then (when reminders are enabled and
 * permission is granted) schedules at-time + lead-time reminders for every
 * pending timed task in the next 7 days. Soonest-first, capped at 50.
 * Never throws; no-ops on web.
 */
export async function rescheduleAllNotifications(data: AppData): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    return; // module unavailable — nothing more to do
  }
  if (!data.settings.remindersEnabled) return;
  if (!(await hasPermissions())) return;

  try {
    const planned = planNotifications(data, new Date())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, MAX_SCHEDULED);

    for (const item of planned) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: { title: item.title, body: item.body },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: item.date,
            channelId: CHANNEL_ID,
          },
        });
      } catch {
        // One failed schedule shouldn't stop the rest.
      }
    }
  } catch {
    // Never let notification errors surface to callers.
  }
}
