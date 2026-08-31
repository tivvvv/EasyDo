import type { Task } from '@easydo/domain';
import { getPendingReminders } from '@easydo/application';
import { useEffect, useRef } from 'react';

export function useTaskReminders(tasks: Task[]): void {
  const notifiedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return undefined;
    }

    const check = () => {
      const pending = getPendingReminders(tasks, new Date(), notifiedIds.current);
      for (const task of pending) {
        notifiedIds.current.add(task.id);
        new Notification(task.title, {
          body: task.dueTime ? `计划时间 ${task.dueTime}.` : '任务即将开始.',
          icon: '/og.png',
          tag: `easydo-${task.id}`,
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
