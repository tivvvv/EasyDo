import type { Task } from '@easydo/domain';
import { getPendingReminderEvents } from '@easydo/application';
import { useEffect, useRef } from 'react';

import {
  hasReminderPermission,
  requestLocalReminderPermission,
  sendLocalReminder,
} from '../lib/notifications';

export function useTaskReminders(tasks: Task[]): void {
  const notifiedKeys = useRef(loadNotifiedKeys());

  useEffect(() => {
    let active = true;
    let interval: number | null = null;

    const check = () => {
      const pending = getPendingReminderEvents(tasks, new Date(), notifiedKeys.current);
      for (const event of pending) {
        notifiedKeys.current.add(event.key);
        persistNotifiedKeys(notifiedKeys.current);
        void sendLocalReminder({
          body: event.task.dueTime ? `计划时间 ${event.task.dueTime}.` : '任务即将开始.',
          tag: `easydo-${event.key}`,
          title: event.task.title,
        });
      }
    };

    const start = async () => {
      if (!(await hasReminderPermission()) || !active) return;
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
  }, [tasks]);
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
