import { getScheduledReminderEvents } from '@easydo/application';
import type { Habit, Task } from '@easydo/domain';
import { addDays, format } from 'date-fns';

import { getErrorMessage } from './errors';

export type ReminderPermission = NotificationPermission | 'unsupported';

export function isTauriRuntime(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

export async function hasReminderPermission(): Promise<boolean> {
  if (isTauriRuntime()) {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
    return isPermissionGranted();
  }
  return 'Notification' in window && Notification.permission === 'granted';
}

export async function requestLocalReminderPermission(): Promise<ReminderPermission> {
  if (isTauriRuntime()) {
    const { isPermissionGranted, requestPermission } =
      await import('@tauri-apps/plugin-notification');
    if (await isPermissionGranted()) return 'granted';
    const permission = await requestPermission();
    if (permission === 'granted' || permission === 'denied') return permission;
    return 'default';
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

export async function sendLocalReminder(options: {
  body: string;
  tag: string;
  title: string;
}): Promise<void> {
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('plugin:notification|notify', {
      options: { body: options.body, title: options.title },
    });
    return;
  }
  new Notification(options.title, {
    body: options.body,
    icon: '/og.png',
    tag: options.tag,
  });
}

let nativeSchedulingUnsupported = false;

async function pendingNativeNotifications() {
  if (nativeSchedulingUnsupported) return null;
  const { pending } = await import('@tauri-apps/plugin-notification');
  try {
    return await pending();
  } catch (error) {
    // 桌面插件未实现调度接口时使用运行期提醒, 不能将其误报成设置保存失败.
    if (/get_pending.*not found|not supported|unsupported/i.test(getErrorMessage(error))) {
      nativeSchedulingUnsupported = true;
      return null;
    }
    throw error;
  }
}

export async function syncScheduledTaskReminders(
  tasks: readonly Task[],
  onScheduled?: (keys: string[]) => Promise<void>,
): Promise<number> {
  if (!isTauriRuntime()) return 0;
  const { cancel, isPermissionGranted, Schedule, sendNotification } =
    await import('@tauri-apps/plugin-notification');
  if (!(await isPermissionGranted())) return 0;

  const existing = await pendingNativeNotifications();
  if (existing === null) return 0;
  const taskNotificationIds = existing
    .map((notification) => notification.id)
    .filter((id) => id > 0 && id < 1_000_000_000);
  if (taskNotificationIds.length > 0) await cancel(taskNotificationIds);

  const now = new Date();
  const events = getScheduledReminderEvents(tasks, now, addDays(now, 90));
  const usedIds = new Set<number>();
  for (const event of events) {
    let id = stableNotificationId(event.key);
    while (usedIds.has(id)) id = (id % 999_999_999) + 1;
    usedIds.add(id);
    sendNotification({
      body:
        event.subjectId === event.task.id
          ? `计划时间 ${event.task.dueTime}.`
          : `来自任务「${event.task.title}」的子任务提醒.`,
      id,
      schedule: Schedule.at(event.notifyAt),
      title: event.subjectTitle,
    });
  }
  await onScheduled?.(events.map((event) => event.key));
  return events.length;
}

function stableNotificationId(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (Math.abs(hash) % 999_999_999) + 1;
}

export async function syncScheduledHabitReminders(habits: readonly Habit[]): Promise<number> {
  if (!isTauriRuntime()) return 0;
  const { cancel, isPermissionGranted, Schedule, sendNotification } =
    await import('@tauri-apps/plugin-notification');
  if (!(await isPermissionGranted())) return 0;
  const existing = await pendingNativeNotifications();
  if (existing === null) return 0;
  const habitIds = existing
    .map((notification) => notification.id)
    .filter((id) => id >= 1_000_000_000 && id < 2_000_000_000);
  if (habitIds.length > 0) await cancel(habitIds);

  const now = new Date();
  let count = 0;
  for (const habit of habits) {
    if (!habit.reminderTime || habit.pausedAt || habit.archivedAt) continue;
    const [hours, minutes] = habit.reminderTime.split(':').map(Number);
    for (let offset = 0; offset <= 30; offset += 1) {
      const date = addDays(now, offset);
      const key = format(date, 'yyyy-MM-dd');
      const scheduledAt = new Date(date);
      scheduledAt.setHours(hours ?? 0, minutes ?? 0, 0, 0);
      const activeDay =
        habit.frequency === 'daily' ||
        habit.weekDays.length === 0 ||
        habit.weekDays.includes(date.getDay());
      if (
        !activeDay ||
        scheduledAt <= now ||
        habit.logs.includes(key) ||
        (habit.skippedDates ?? []).includes(key)
      )
        continue;
      sendNotification({
        body: '今天的小步积累, 现在开始正合适.',
        id: 1_000_000_000 + stableNotificationId(`${habit.id}:${key}`),
        schedule: Schedule.at(scheduledAt),
        title: habit.name,
      });
      count += 1;
    }
  }
  return count;
}

export function getPendingHabitReminders(
  habits: readonly Habit[],
  now: Date,
  notifiedKeys: ReadonlySet<string>,
): { key: string; title: string; body: string }[] {
  return habits.flatMap((habit) => {
    if (!habit.reminderTime || habit.pausedAt || habit.archivedAt) return [];
    const [hours = 0, minutes = 0] = habit.reminderTime.split(':').map(Number);
    for (const offset of [0, -1]) {
      const scheduledAt = addDays(now, offset);
      scheduledAt.setHours(hours, minutes, 0, 0);
      const date = format(scheduledAt, 'yyyy-MM-dd');
      const key = `habit:${habit.id}:${date}:${habit.reminderTime}`;
      const elapsed = now.getTime() - scheduledAt.getTime();
      if (
        elapsed < 0 ||
        elapsed >= 86_400_000 ||
        notifiedKeys.has(key) ||
        habit.logs.includes(date) ||
        (habit.skippedDates ?? []).includes(date) ||
        (habit.frequency !== 'daily' &&
          habit.weekDays.length > 0 &&
          !habit.weekDays.includes(scheduledAt.getDay()))
      )
        continue;
      return [{ key, title: habit.name, body: '今天的小步积累, 现在开始正合适.' }];
    }
    return [];
  });
}
