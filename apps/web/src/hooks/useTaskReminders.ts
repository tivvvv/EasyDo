import type { Habit, ReminderDelivery, Task } from '@easydo/domain';
import { getPendingReminderEvents } from '@easydo/application';
import { useEffect, useRef } from 'react';

import {
  hasReminderPermission,
  requestLocalReminderPermission,
  sendLocalReminder,
  syncScheduledHabitReminders,
  syncScheduledTaskReminders,
} from '../lib/notifications';
import { recordReminderDeliveries } from '../sharedStorage';

export function useTaskReminders(
  tasks: Task[],
  habits: Habit[] = [],
  reminderDeliveries: ReminderDelivery[] = [],
): void {
  const notifiedKeys = useRef(
    new Set([...loadNotifiedKeys(), ...reminderDeliveries.map((delivery) => delivery.key)]),
  );

  useEffect(() => {
    for (const delivery of reminderDeliveries) notifiedKeys.current.add(delivery.key);
  }, [reminderDeliveries]);

  useEffect(() => {
    let active = true;
    let interval: number | null = null;

    const check = () => {
      const pending = getPendingReminderEvents(tasks, new Date(), notifiedKeys.current);
      for (const event of pending) {
        notifiedKeys.current.add(event.key);
        persistNotifiedKeys(notifiedKeys.current);
        void recordReminderDeliveries([
          { createdAt: new Date().toISOString(), key: event.key, status: 'delivered' },
        ]);
        void sendLocalReminder({
          body:
            event.overdueMinutes > 1
              ? `提醒已延迟 ${event.overdueMinutes} 分钟, 请检查安排.`
              : event.subjectId === event.task.id
                ? `计划时间 ${event.task.dueTime}.`
                : `来自任务「${event.task.title}」的子任务提醒.`,
          tag: `easydo-${event.key}`,
          title: event.subjectTitle,
        });
      }
    };

    const start = async () => {
      if (!(await hasReminderPermission()) || !active) return;
      await syncScheduledTaskReminders(tasks, async (keys) => {
        const createdAt = new Date().toISOString();
        const newKeys = keys.filter((key) => !notifiedKeys.current.has(key));
        for (const key of newKeys) notifiedKeys.current.add(key);
        await recordReminderDeliveries(
          newKeys.map((key) => ({ createdAt, key, status: 'scheduled' })),
        );
      });
      await syncScheduledHabitReminders(habits);
      check();
      interval = window.setInterval(check, 15_000);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    void start();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      if (interval !== null) window.clearInterval(interval);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [habits, tasks]);
}

const reminderStorageKey = 'easydo-notified-reminders';

function loadNotifiedKeys(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(reminderStorageKey) ?? '[]');
    return new Set(
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

function persistNotifiedKeys(keys: Set<string>): void {
  const recent = [...keys].slice(-500);
  localStorage.setItem(reminderStorageKey, JSON.stringify(recent));
}

export async function requestReminderPermission(): Promise<NotificationPermission | 'unsupported'> {
  return requestLocalReminderPermission();
}
