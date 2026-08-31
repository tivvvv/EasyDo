import type {
  ActivityAction,
  ActivityRecord,
  BackupPayload,
  FilterCriteria,
  RecurrenceEditScope,
  RecurrenceRule,
  Task,
  TaskDraft,
} from '@easydo/domain';
import { createId, defaultAppSettings, isBackupPayload } from '@easydo/domain';
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
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

export type ActivityRepository = {
  add(activity: ActivityRecord): Promise<void>;
  delete(id: string): Promise<void>;
  getByGroup(groupId: string): Promise<ActivityRecord[]>;
  getLatest(): Promise<ActivityRecord | undefined>;
};

export type CompletionResult = {
  advanced: boolean;
  taskId: string;
};

export class TaskApplicationService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly activities?: ActivityRepository,
  ) {}

  async create(draft: TaskDraft): Promise<Task> {
    return this.createWithAction(draft, 'create');
  }

  private async createWithAction(
    draft: TaskDraft,
    action: ActivityAction,
    groupId = createId('group'),
  ): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      ...draft,
      completedAt: null,
      createdAt: now,
      deletedAt: null,
      id: createId('task'),
      order: Date.now(),
      title: draft.title.trim(),
      updatedAt: now,
    };

    if (!task.title) {
      throw new Error('任务标题不能为空.');
    }

    await this.repository.add(task);
    await this.record(action, null, task, groupId);
    return task;
  }

  async update(id: string, patch: Partial<TaskDraft>): Promise<ActivityRecord | undefined> {
    return this.updateWithGroup(id, patch, createId('group'));
  }

  private async updateWithGroup(
    id: string,
    patch: Partial<TaskDraft>,
    groupId: string,
  ): Promise<ActivityRecord | undefined> {
    const before = await this.requireTask(id);
    await this.repository.update(id, { ...patch, updatedAt: new Date().toISOString() });
    return this.record('update', before, await this.repository.get(id), groupId);
  }

  async complete(id: string): Promise<CompletionResult> {
    const task = await this.repository.get(id);

    if (!task) {
      throw new Error('任务不存在.');
    }

    const now = new Date().toISOString();
    if (task.completedAt) {
      await this.repository.update(id, { completedAt: null, updatedAt: now });
      await this.record('complete', task, await this.repository.get(id));
      return { advanced: false, taskId: id };
    }

    const nextDate =
      task.dueDate && task.recurrence ? nextRecurrenceDate(task.dueDate, task.recurrence) : null;

    if (!nextDate) {
      await this.repository.update(id, { completedAt: now, updatedAt: now });
      await this.record('complete', task, await this.repository.get(id));
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
    const groupId = createId('group');
    await this.repository.add(completedTask);
    await this.repository.update(id, {
      dueDate: nextDate,
      endDate: shiftEndDate(task.dueDate!, task.endDate, nextDate),
      subtasks: task.subtasks.map((subtask) => ({ ...subtask, completedAt: null })),
      updatedAt: now,
    });
    await this.record('complete', null, completedTask, groupId);
    await this.record('complete', task, await this.repository.get(id), groupId);
    return { advanced: true, taskId: id };
  }

  async trash(id: string): Promise<ActivityRecord | undefined> {
    const before = await this.requireTask(id);
    await this.repository.update(id, {
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return this.record('trash', before, await this.repository.get(id));
  }

  async restore(id: string): Promise<ActivityRecord | undefined> {
    const before = await this.requireTask(id);
    await this.repository.update(id, { deletedAt: null, updatedAt: new Date().toISOString() });
    return this.record('restore', before, await this.repository.get(id));
  }

  async purge(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async reschedule(id: string, dueDate: string | null, dueTime?: string | null): Promise<void> {
    const task = await this.repository.get(id);

    if (!task) {
      throw new Error('任务不存在.');
    }

    const daySpan =
      task.dueDate && task.endDate
        ? differenceInCalendarDays(parseISO(task.endDate), parseISO(task.dueDate))
        : 0;
    await this.repository.update(id, {
      dueDate,
      dueTime: dueDate ? (dueTime === undefined ? task.dueTime : dueTime) : null,
      endDate:
        dueDate && daySpan > 0 ? format(addDays(parseISO(dueDate), daySpan), 'yyyy-MM-dd') : null,
      updatedAt: new Date().toISOString(),
    });
    await this.record('update', task, await this.repository.get(id));
  }

  async duplicate(id: string): Promise<Task> {
    const task = await this.repository.get(id);

    if (!task) {
      throw new Error('任务不存在.');
    }

    return this.createWithAction(
      {
        categoryId: task.categoryId,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        duration: task.duration,
        endDate: task.endDate,
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
      },
      'duplicate',
    );
  }

  async updateRecurring(id: string, draft: TaskDraft, scope: RecurrenceEditScope): Promise<void> {
    const task = await this.requireTask(id);
    if (!task.recurrence || scope !== 'current' || !task.dueDate) {
      await this.update(id, draft);
      return;
    }

    const nextDate = nextRecurrenceDate(task.dueDate, task.recurrence);
    const groupId = createId('group');
    await this.updateWithGroup(id, { ...draft, recurrence: null }, groupId);
    if (nextDate) {
      await this.createWithAction(
        {
          categoryId: task.categoryId,
          dueDate: nextDate,
          dueTime: task.dueTime,
          duration: task.duration,
          endDate: shiftEndDate(task.dueDate, task.endDate, nextDate),
          notes: task.notes,
          priority: task.priority,
          recurrence: task.recurrence,
          reminderMinutes: task.reminderMinutes,
          subtasks: task.subtasks.map((subtask) => ({ ...subtask, completedAt: null })),
          tagIds: task.tagIds,
          title: task.title,
        },
        'create',
        groupId,
      );
    }
  }

  async batchUpdate(ids: string[], patch: Partial<TaskDraft>): Promise<void> {
    const groupId = createId('group');
    await Promise.all(
      ids.map(async (id) => {
        const before = await this.requireTask(id);
        await this.repository.update(id, { ...patch, updatedAt: new Date().toISOString() });
        await this.record('update', before, await this.repository.get(id), groupId);
      }),
    );
  }

  async undoLatest(): Promise<boolean> {
    const latest = await this.activities?.getLatest();
    if (!latest || !this.activities) return false;

    const activities = await this.activities.getByGroup(latest.groupId);
    for (const activity of activities) {
      if (activity.before) {
        const current = await this.repository.get(activity.taskId);
        if (current) await this.repository.update(activity.taskId, activity.before);
        else await this.repository.add(activity.before);
      } else {
        await this.repository.delete(activity.taskId);
      }
      await this.activities.delete(activity.id);
    }
    return true;
  }

  private async requireTask(id: string): Promise<Task> {
    const task = await this.repository.get(id);
    if (!task) throw new Error('任务不存在.');
    return task;
  }

  private async record(
    action: ActivityAction,
    before: Task | null,
    after: Task | undefined | null,
    groupId = createId('group'),
  ): Promise<ActivityRecord | undefined> {
    if (!this.activities) return undefined;
    const activity: ActivityRecord = {
      action,
      after: after ?? null,
      before,
      createdAt: new Date().toISOString(),
      groupId,
      id: createId('activity'),
      taskId: after?.id ?? before?.id ?? '',
    };
    await this.activities.add(activity);
    return activity;
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

export function matchesFilter(task: Task, criteria: FilterCriteria, todayKey: string): boolean {
  if (criteria.categoryId && task.categoryId !== criteria.categoryId) return false;
  if (criteria.priority !== 'all' && task.priority !== criteria.priority) return false;
  if (criteria.tagIds.some((tagId) => !task.tagIds.includes(tagId))) return false;
  if (criteria.status === 'active' && task.completedAt) return false;
  if (criteria.status === 'completed' && !task.completedAt) return false;

  const rangeEnd = (days: number) => format(addDays(parseISO(todayKey), days), 'yyyy-MM-dd');
  if (criteria.dateRange === 'today' && task.dueDate !== todayKey) return false;
  if (criteria.dateRange === 'unscheduled' && task.dueDate) return false;
  if (criteria.dateRange === 'overdue' && (!task.dueDate || task.dueDate >= todayKey)) return false;
  if (
    criteria.dateRange === 'next7' &&
    (!task.dueDate || task.dueDate < todayKey || task.dueDate > rangeEnd(6))
  )
    return false;
  if (
    criteria.dateRange === 'next30' &&
    (!task.dueDate || task.dueDate < todayKey || task.dueDate > rangeEnd(29))
  )
    return false;
  return true;
}

export function taskHasConflict(task: Task, tasks: readonly Task[]): boolean {
  if (!task.dueDate || !task.dueTime || task.completedAt || task.deletedAt) return false;
  const start = parseISO(`${task.dueDate}T${task.dueTime}:00`).getTime();
  const end = start + task.duration * 60_000;
  return tasks.some((candidate) => {
    if (
      candidate.id === task.id ||
      candidate.dueDate !== task.dueDate ||
      !candidate.dueTime ||
      candidate.completedAt ||
      candidate.deletedAt
    )
      return false;
    const candidateStart = parseISO(`${candidate.dueDate}T${candidate.dueTime}:00`).getTime();
    return start < candidateStart + candidate.duration * 60_000 && candidateStart < end;
  });
}

function shiftEndDate(dueDate: string, endDate: string | null, nextDueDate: string): string | null {
  if (!endDate) return null;
  const span = differenceInCalendarDays(parseISO(endDate), parseISO(dueDate));
  return span > 0 ? format(addDays(parseISO(nextDueDate), span), 'yyyy-MM-dd') : null;
}

export function parseBackup(text: string): BackupPayload {
  const value: unknown = JSON.parse(text);

  if (isBackupPayload(value)) return value;

  if (isLegacyBackup(value)) {
    const normalized: BackupPayload = {
      activities: [],
      categories: value.categories,
      exportedAt: value.exportedAt,
      filters: [],
      settings: { ...defaultAppSettings },
      tags: value.tags,
      tasks: value.tasks.map((task, order) => ({ ...task, endDate: null, order })),
      templates: [],
      version: 2,
    };
    if (isBackupPayload(normalized)) return normalized;
  }

  throw new Error('备份文件格式不正确.');
}

function isLegacyBackup(value: unknown): value is {
  categories: BackupPayload['categories'];
  exportedAt: string;
  tags: BackupPayload['tags'];
  tasks: Omit<Task, 'endDate' | 'order'>[];
  version: 1;
} {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    typeof candidate.exportedAt === 'string' &&
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.tags) &&
    Array.isArray(candidate.tasks) &&
    candidate.tasks.every((value) => {
      if (!value || typeof value !== 'object') return false;
      const task = value as Record<string, unknown>;
      return (
        typeof task.id === 'string' &&
        typeof task.title === 'string' &&
        typeof task.categoryId === 'string' &&
        typeof task.duration === 'number' &&
        Array.isArray(task.tagIds) &&
        Array.isArray(task.subtasks)
      );
    })
  );
}
