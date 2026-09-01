import { getScheduledReminderEvents } from '@easydo/application';
import type { Habit, Task } from '@easydo/domain';
import { addDays, format } from 'date-fns';

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
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    sendNotification({ body: options.body, title: options.title });
    return;
  }
  new Notification(options.title, {
    body: options.body,
    icon: '/og.png',
    tag: options.tag,
  });
}

export async function syncScheduledTaskReminders(tasks: readonly Task[]): Promise<number> {
  if (!isTauriRuntime()) return 0;
  const { cancel, isPermissionGranted, pending, Schedule, sendNotification } =
    await import('@tauri-apps/plugin-notification');
  if (!(await isPermissionGranted())) return 0;

  const existing = await pending();
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
      body: event.task.dueTime ? `计划时间 ${event.task.dueTime}.` : '任务即将开始.',
      id,
      schedule: Schedule.at(event.notifyAt),
      title: event.task.title,
    });
  }
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
  const { cancel, isPermissionGranted, pending, Schedule, sendNotification } =
    await import('@tauri-apps/plugin-notification');
  if (!(await isPermissionGranted())) return 0;
  const existing = await pending();
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
