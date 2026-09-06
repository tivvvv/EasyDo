import type { Habit, ReminderDelivery, Task } from '@easydo/domain';
import { getPendingReminderEvents } from '@easydo/application';
import { useEffect, useRef } from 'react';

import {
  getPendingHabitReminders,
  hasReminderPermission,
  requestLocalReminderPermission,
  sendLocalReminder,
  syncScheduledHabitReminders,
  syncScheduledTaskReminders,
} from '../lib/notifications';
import { getErrorMessage } from '../lib/errors';
import { recordReminderDeliveries } from '../sharedStorage';

export function useTaskReminders(
  tasks: Task[],
  habits: Habit[] = [],
  reminderDeliveries: ReminderDelivery[] = [],
): void {
  const notifiedKeys = useRef(
    new Set([...loadNotifiedKeys(), ...reminderDeliveries.map((delivery) => delivery.key)]),
  );

  const lastError = useRef<string | null>(null);

  useEffect(() => {
    for (const delivery of reminderDeliveries) notifiedKeys.current.add(delivery.key);
  }, [reminderDeliveries]);

  useEffect(() => {
    let active = true;
    let interval: number | null = null;

    let permitted = false;
    let checking = false;
    let habitsScheduled = false;
    const reportError = (error: unknown) => {
      if (!active) return;
      const message = getErrorMessage(error);
      if (message === lastError.current) return;
      lastError.current = message;
      window.dispatchEvent(new CustomEvent('easydo:reminder-error', { detail: message }));
    };
    const check = async () => {
      if (!active || !permitted || checking) return;
      checking = true;
      try {
        const pending = getPendingReminderEvents(tasks, new Date(), notifiedKeys.current).map(
          (event) => ({
            key: event.key,
            title: event.subjectTitle,
            body:
              event.overdueMinutes > 1
                ? `提醒已延迟 ${event.overdueMinutes} 分钟, 请检查安排.`
                : event.subjectId === event.task.id
                  ? `计划时间 ${event.task.dueTime}.`
                  : `来自任务「${event.task.title}」的子任务提醒.`,
          }),
        );
        if (!habitsScheduled)
          pending.push(...getPendingHabitReminders(habits, new Date(), notifiedKeys.current));
        for (const event of pending) {
          if (!active) break;
          await sendLocalReminder({
            body: event.body,
            tag: `easydo-${event.key}`,
            title: event.title,
          });
          notifiedKeys.current.add(event.key);
          persistNotifiedKeys(notifiedKeys.current);
          await recordReminderDeliveries([
            { createdAt: new Date().toISOString(), key: event.key, status: 'delivered' },
          ]);
        }
      } catch (error) {
        reportError(error);
      } finally {
        checking = false;
      }
    };

    const start = async () => {
      permitted = await hasReminderPermission();
      if (!permitted || !active) return;
      try {
        await syncScheduledTaskReminders(tasks, async (keys) => {
          if (!active) return;
          const createdAt = new Date().toISOString();
          const newKeys = keys.filter((key) => !notifiedKeys.current.has(key));
          for (const key of newKeys) notifiedKeys.current.add(key);
          await recordReminderDeliveries(
            newKeys.map((key) => ({ createdAt, key, status: 'scheduled' })),
          );
        });
        if (!active) return;
        habitsScheduled = (await syncScheduledHabitReminders(habits)) > 0;
      } catch (error) {
        reportError(error);
      }
      if (!active) return;
      void check();
      interval = window.setInterval(() => void check(), 15_000);
    };
    const handleFocus = () => void check();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };
    void start().catch(reportError);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      if (interval !== null) window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
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
