import type { Task } from '@easydo/domain';
import { getPendingReminderEvents } from '@easydo/application';
import { useEffect, useRef } from 'react';

export function useTaskReminders(tasks: Task[]): void {
  const notifiedKeys = useRef(loadNotifiedKeys());

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return undefined;
    }

    const check = () => {
      const pending = getPendingReminderEvents(tasks, new Date(), notifiedKeys.current);
      for (const event of pending) {
        notifiedKeys.current.add(event.key);
        persistNotifiedKeys(notifiedKeys.current);
        new Notification(event.task.title, {
          body: event.task.dueTime ? `计划时间 ${event.task.dueTime}.` : '任务即将开始.',
          icon: '/og.png',
          tag: `easydo-${event.key}`,
        });
      }
    };

    check();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    const interval = window.setInterval(check, 15_000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
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
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.requestPermission();
}
