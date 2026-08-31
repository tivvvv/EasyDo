import type { Task } from '@easydo/domain';
import { getPendingReminderEvents } from '@easydo/application';
import { useEffect, useRef } from 'react';

export function useTaskReminders(tasks: Task[]): void {
  const notifiedKeys = useRef(new Set<string>());

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return undefined;
    }

    const check = () => {
      const pending = getPendingReminderEvents(tasks, new Date(), notifiedKeys.current);
      for (const event of pending) {
        notifiedKeys.current.add(event.key);
        new Notification(event.task.title, {
          body: event.task.dueTime ? `计划时间 ${event.task.dueTime}.` : '任务即将开始.',
          icon: '/og.png',
          tag: `easydo-${event.key}`,
        });
      }
    };

    check();
    const interval = window.setInterval(check, 30_000);
    return () => window.clearInterval(interval);
  }, [tasks]);
}

export async function requestReminderPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.requestPermission();
}
