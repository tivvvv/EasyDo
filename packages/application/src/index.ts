import type { BackupPayload, RecurrenceRule, Task, TaskDraft } from '@easydo/domain';
import { createId, isBackupPayload } from '@easydo/domain';
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarWeeks,
  format,
  isAfter,
  parseISO,
  startOfWeek,
} from 'date-fns';

export type TaskRepository = {
  add(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<Task | undefined>;
  update(id: string, patch: Partial<Task>): Promise<void>;
};

export type CompletionResult = {
  advanced: boolean;
  taskId: string;
};

export class TaskApplicationService {
  constructor(private readonly repository: TaskRepository) {}

  async create(draft: TaskDraft): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      ...draft,
      completedAt: null,
      createdAt: now,
      deletedAt: null,
      id: createId('task'),
      title: draft.title.trim(),
      updatedAt: now,
    };

    if (!task.title) {
      throw new Error('任务标题不能为空.');
    }

    await this.repository.add(task);
    return task;
  }

  async update(id: string, patch: Partial<TaskDraft>): Promise<void> {
    await this.repository.update(id, { ...patch, updatedAt: new Date().toISOString() });
  }

  async complete(id: string): Promise<CompletionResult> {
    const task = await this.repository.get(id);

    if (!task) {
      throw new Error('任务不存在.');
    }

    const now = new Date().toISOString();
    if (task.completedAt) {
      await this.repository.update(id, { completedAt: null, updatedAt: now });
      return { advanced: false, taskId: id };
    }

    const nextDate =
      task.dueDate && task.recurrence ? nextRecurrenceDate(task.dueDate, task.recurrence) : null;

    if (!nextDate) {
      await this.repository.update(id, { completedAt: now, updatedAt: now });
      return { advanced: false, taskId: id };
    }

    const completedTask: Task = {
      ...task,
      completedAt: now,
      createdAt: now,
      id: createId('task'),
      recurrence: null,
      reminderMinutes: null,
      updatedAt: now,
    };
    await this.repository.add(completedTask);
    await this.repository.update(id, {
      dueDate: nextDate,
      subtasks: task.subtasks.map((subtask) => ({ ...subtask, completedAt: null })),
      updatedAt: now,
    });
    return { advanced: true, taskId: id };
  }

  async trash(id: string): Promise<void> {
    await this.repository.update(id, {
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async restore(id: string): Promise<void> {
    await this.repository.update(id, { deletedAt: null, updatedAt: new Date().toISOString() });
  }

  async purge(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async reschedule(id: string, dueDate: string | null, dueTime?: string | null): Promise<void> {
    const task = await this.repository.get(id);

    if (!task) {
      throw new Error('任务不存在.');
    }

    await this.repository.update(id, {
      dueDate,
      dueTime: dueDate ? (dueTime === undefined ? task.dueTime : dueTime) : null,
      updatedAt: new Date().toISOString(),
    });
  }

  async duplicate(id: string): Promise<Task> {
    const task = await this.repository.get(id);

    if (!task) {
      throw new Error('任务不存在.');
    }

    return this.create({
      categoryId: task.categoryId,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      duration: task.duration,
      notes: task.notes,
      priority: task.priority,
      recurrence: task.recurrence,
      reminderMinutes: task.reminderMinutes,
      subtasks: task.subtasks.map((subtask) => ({
        ...subtask,
        completedAt: null,
        id: createId('subtask'),
      })),
      tagIds: task.tagIds,
      title: `${task.title} 副本`,
    });
  }
}

export function nextRecurrenceDate(dateKey: string, rule: RecurrenceRule): string | null {
  const current = parseISO(`${dateKey}T12:00:00`);
  let next: Date;

  if (rule.frequency === 'daily') {
    next = addDays(current, rule.interval);
  } else if (rule.frequency === 'weekdays') {
    next = addDays(current, 1);
    while (next.getDay() === 0 || next.getDay() === 6) {
      next = addDays(next, 1);
    }
  } else if (rule.frequency === 'weekly') {
    next = findNextWeeklyDate(current, rule);
  } else if (rule.frequency === 'monthly') {
    next = addMonths(current, rule.interval);
  } else {
    next = addYears(current, rule.interval);
  }

  const nextKey = format(next, 'yyyy-MM-dd');
  return rule.endsOn && isAfter(next, parseISO(`${rule.endsOn}T23:59:59`)) ? null : nextKey;
}

function findNextWeeklyDate(current: Date, rule: RecurrenceRule): Date {
  const weekDays = rule.weekDays.length ? rule.weekDays : [current.getDay()];
  const baseWeek = startOfWeek(current, { weekStartsOn: 1 });
  let candidate = addDays(current, 1);

  for (let offset = 1; offset <= 3_660; offset += 1) {
    const weekDifference = differenceInCalendarWeeks(candidate, baseWeek, { weekStartsOn: 1 });
    if (weekDifference % rule.interval === 0 && weekDays.includes(candidate.getDay())) {
      return candidate;
    }
    candidate = addDays(candidate, 1);
  }

  return addDays(current, 7 * rule.interval);
}

export function getPendingReminders(
  tasks: readonly Task[],
  now: Date,
  notifiedTaskIds: ReadonlySet<string>,
): Task[] {
  const nowTime = now.getTime();
  return tasks.filter((task) => {
    if (
      task.completedAt ||
      task.deletedAt ||
      !task.dueDate ||
      !task.dueTime ||
      task.reminderMinutes === null ||
      notifiedTaskIds.has(task.id)
    ) {
      return false;
    }

    const scheduledAt = parseISO(`${task.dueDate}T${task.dueTime}:00`).getTime();
    const remindAt = scheduledAt - task.reminderMinutes * 60_000;
    return nowTime >= remindAt && nowTime <= scheduledAt + 300_000;
  });
}

export function parseBackup(text: string): BackupPayload {
  const value: unknown = JSON.parse(text);

  if (!isBackupPayload(value)) {
    throw new Error('备份文件格式不正确.');
  }

  return value;
}
