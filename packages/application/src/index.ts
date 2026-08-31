import type {
  ActivityAction,
  ActivityRecord,
  BackupPayload,
  Category,
  FilterCriteria,
  Folder,
  Reminder,
  RecurrenceEditScope,
  RecurrenceRule,
  Task,
  TaskDraft,
} from '@easydo/domain';
import {
  createId,
  createRecurrenceRule,
  createReminder,
  createSubtask,
  defaultAppSettings,
  getLocalTimeZone,
  isBackupPayload,
} from '@easydo/domain';
import {
  addDays,
  addMinutes,
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  format,
  getDaysInMonth,
  isAfter,
  parseISO,
  startOfWeek,
} from 'date-fns';

export type TaskRepository = {
  add(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<Task | undefined>;
  getBySeries?(seriesId: string): Promise<Task[]>;
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
    seriesId?: string | null,
  ): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      ...draft,
      completedAt: null,
      createdAt: now,
      deletedAt: null,
      id: createId('task'),
      order: Date.now(),
      seriesId: draft.recurrence ? (seriesId ?? createId('series')) : null,
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
      reminders: [],
      updatedAt: now,
    };
    const groupId = createId('group');
    await this.repository.add(completedTask);
    await this.repository.update(id, {
      dueDate: nextDate,
      endDate: shiftEndDate(task.dueDate!, task.endDate, nextDate),
      recurrence: task.recurrence
        ? { ...task.recurrence, completedCount: task.recurrence.completedCount + 1 }
        : null,
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
        allDay: task.allDay,
        categoryId: task.categoryId,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        duration: task.duration,
        endDate: task.endDate,
        endTime: task.endTime,
        kind: task.kind,
        notes: task.notes,
        parentId: task.parentId,
        priority: task.priority,
        recurrence: task.recurrence,
        reminderMinutes: task.reminderMinutes,
        reminders: task.reminders.map((reminder) => ({ ...reminder, id: createId('reminder') })),
        subtasks: task.subtasks.map((subtask) => ({
          ...subtask,
          completedAt: null,
          id: createId('subtask'),
        })),
        tagIds: task.tagIds,
        timeZone: task.timeZone,
        title: `${task.title} 副本`,
      },
      'duplicate',
    );
  }

  async updateRecurring(id: string, draft: TaskDraft, scope: RecurrenceEditScope): Promise<void> {
    const task = await this.requireTask(id);
    if (!task.recurrence || !task.dueDate) {
      await this.update(id, draft);
      return;
    }

    if (scope === 'all' && task.seriesId && this.repository.getBySeries) {
      const instances = await this.repository.getBySeries(task.seriesId);
      const groupId = createId('group');
      await Promise.all(
        instances.map((instance) =>
          this.updateWithGroup(
            instance.id,
            {
              ...draft,
              dueDate: instance.dueDate,
              endDate: instance.endDate,
              recurrence: instance.recurrence ? draft.recurrence : null,
            },
            groupId,
          ),
        ),
      );
      return;
    }

    if (scope === 'future') {
      await this.update(id, draft);
      return;
    }

    const nextDate = nextRecurrenceDate(task.dueDate, task.recurrence);
    const groupId = createId('group');
    await this.updateWithGroup(id, { ...draft, recurrence: null }, groupId);
    if (nextDate) {
      await this.createWithAction(
        {
          allDay: task.allDay,
          categoryId: task.categoryId,
          dueDate: nextDate,
          dueTime: task.dueTime,
          duration: task.duration,
          endDate: shiftEndDate(task.dueDate, task.endDate, nextDate),
          endTime: task.endTime,
          kind: task.kind,
          notes: task.notes,
          parentId: task.parentId,
          priority: task.priority,
          recurrence: task.recurrence,
          reminderMinutes: task.reminderMinutes,
          reminders: task.reminders,
          subtasks: task.subtasks.map((subtask) => ({ ...subtask, completedAt: null })),
          tagIds: task.tagIds,
          timeZone: task.timeZone,
          title: task.title,
        },
        'create',
        groupId,
        task.seriesId,
      );
    }
  }

  async skipRecurrence(id: string): Promise<boolean> {
    const task = await this.requireTask(id);
    if (!task.dueDate || !task.recurrence) return false;
    const nextDate = nextRecurrenceDate(task.dueDate, task.recurrence);
    if (!nextDate) return false;
    await this.update(id, {
      dueDate: nextDate,
      endDate: shiftEndDate(task.dueDate, task.endDate, nextDate),
      recurrence: {
        ...task.recurrence,
        excludedDates: [...new Set([...task.recurrence.excludedDates, task.dueDate])],
      },
    });
    return true;
  }

  async postpone(ids: string[], minutes: number): Promise<void> {
    const groupId = createId('group');
    await Promise.all(
      ids.map(async (id) => {
        const task = await this.requireTask(id);
        if (!task.dueDate) return;
        const base = parseISO(`${task.dueDate}T${task.dueTime ?? '09:00'}:00`);
        const shifted = addMinutes(base, minutes);
        await this.updateWithGroup(
          id,
          {
            dueDate: format(shifted, 'yyyy-MM-dd'),
            dueTime: task.dueTime ? format(shifted, 'HH:mm') : null,
          },
          groupId,
        );
      }),
    );
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
  if (rule.endAfterOccurrences !== null && rule.completedCount + 1 >= rule.endAfterOccurrences) {
    return null;
  }
  const current = parseISO(`${dateKey}T12:00:00`);
  let next = calculateNextRecurrence(current, rule);

  while (rule.excludedDates.includes(format(next, 'yyyy-MM-dd'))) {
    next = calculateNextRecurrence(next, rule);
  }

  const nextKey = format(next, 'yyyy-MM-dd');
  return rule.endsOn && isAfter(next, parseISO(`${rule.endsOn}T23:59:59`)) ? null : nextKey;
}

function calculateNextRecurrence(current: Date, rule: RecurrenceRule): Date {
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
    if (rule.monthMode === 'lastDay') {
      next.setDate(getDaysInMonth(next));
    }
  } else {
    next = addYears(current, rule.interval);
  }

  return next;
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

export type ReminderEvent = {
  key: string;
  reminder: Reminder;
  task: Task;
};

export function getPendingReminderEvents(
  tasks: readonly Task[],
  now: Date,
  notifiedKeys: ReadonlySet<string>,
): ReminderEvent[] {
  const nowTime = now.getTime();
  return tasks.flatMap((task) => {
    if (task.completedAt || task.deletedAt || !task.dueDate || !task.dueTime) return [];
    const reminders = task.reminders.length
      ? task.reminders
      : task.reminderMinutes === null
        ? []
        : [createReminder(task.reminderMinutes)];
    return reminders.flatMap((reminder) => {
      const key = `${task.id}:${reminder.id}:${task.dueDate}:${task.dueTime}`;
      if (notifiedKeys.has(key)) return [];
      const referenceTime =
        reminder.reference === 'end' && task.endTime ? task.endTime : task.dueTime;
      const referenceDate =
        reminder.reference === 'end' ? (task.endDate ?? task.dueDate) : task.dueDate;
      const scheduledAt = parseISO(`${referenceDate}T${referenceTime}:00`).getTime();
      const remindAt = scheduledAt - reminder.offsetMinutes * 60_000;
      return nowTime >= remindAt && nowTime <= scheduledAt + 300_000
        ? [{ key, reminder, task }]
        : [];
    });
  });
}

export function getPendingReminders(
  tasks: readonly Task[],
  now: Date,
  notifiedTaskIds: ReadonlySet<string>,
): Task[] {
  return getPendingReminderEvents(tasks, now, new Set()).flatMap((event) =>
    notifiedTaskIds.has(event.task.id) ? [] : [event.task],
  );
}

export function matchesFilter(task: Task, criteria: FilterCriteria, todayKey: string): boolean {
  if (criteria.categoryId && task.categoryId !== criteria.categoryId) return false;
  if (criteria.kind !== 'all' && task.kind !== criteria.kind) return false;
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

export type QuickTaskParseResult = {
  draft: Partial<TaskDraft> & Pick<TaskDraft, 'title'>;
  tagNames: string[];
};

export function parseQuickTask(input: string, now = new Date()): QuickTaskParseResult {
  let title = input.trim();
  const draft: QuickTaskParseResult['draft'] = { title };
  const tags = [...title.matchAll(/#([^\s#!]+)/g)].flatMap((match) => (match[1] ? [match[1]] : []));
  title = title.replace(/#([^\s#!]+)/g, '').trim();

  const priorityMatch = title.match(/(?:!|！)(高|中|低|\bhigh\b|\bmedium\b|\blow\b)/i);
  if (priorityMatch) {
    const priorityMap = {
      high: 'high',
      low: 'low',
      medium: 'medium',
      中: 'medium',
      低: 'low',
      高: 'high',
    } as const;
    const priorityKey = priorityMatch[1]?.toLowerCase() as keyof typeof priorityMap;
    draft.priority = priorityMap[priorityKey];
    title = title.replace(priorityMatch[0], '').trim();
  }

  const dayTokens: Array<[RegExp, number]> = [
    [/(?:今天|\btoday\b)/i, 0],
    [/(?:明天|\btomorrow\b)/i, 1],
    [/(?:后天)/i, 2],
  ];
  for (const [pattern, offset] of dayTokens) {
    if (pattern.test(title)) {
      draft.dueDate = format(addDays(now, offset), 'yyyy-MM-dd');
      title = title.replace(pattern, '').trim();
      break;
    }
  }

  const dateMatch = title.match(/\b(\d{4}-\d{1,2}-\d{1,2})\b/);
  if (dateMatch) {
    const parsed = parseISO(dateMatch[1]!);
    if (!Number.isNaN(parsed.getTime())) draft.dueDate = format(parsed, 'yyyy-MM-dd');
    title = title.replace(dateMatch[0], '').trim();
  }

  const timeMatch = title.match(/(?:上午|下午|晚上)?\s*(\d{1,2})(?::|点)(\d{1,2})?/);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    if (/下午|晚上/.test(timeMatch[0]) && hour < 12) hour += 12;
    if (/上午/.test(timeMatch[0]) && hour === 12) hour = 0;
    if (hour <= 23) {
      draft.dueTime = `${String(hour).padStart(2, '0')}:${String(Number(timeMatch[2] ?? 0)).padStart(2, '0')}`;
      draft.allDay = false;
      title = title.replace(timeMatch[0], '').trim();
    }
  }

  const durationMatch = title.match(/(?:持续|时长)\s*(\d+(?:\.\d+)?)\s*(分钟|小时)/);
  if (durationMatch) {
    draft.duration = Math.max(
      5,
      Math.round(Number(durationMatch[1]) * (durationMatch[2] === '小时' ? 60 : 1)),
    );
    title = title.replace(durationMatch[0], '').trim();
  }

  const reminderMatch = title.match(/(?:提前|提醒)\s*(\d+)\s*(分钟|小时)/);
  if (reminderMatch) {
    const offset = Number(reminderMatch[1]) * (reminderMatch[2] === '小时' ? 60 : 1);
    draft.reminderMinutes = offset;
    draft.reminders = [createReminder(offset)];
    title = title.replace(reminderMatch[0], '').trim();
  }

  return { draft: { ...draft, title: title.replace(/\s{2,}/g, ' ').trim() }, tagNames: tags };
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
    const candidate = value as Record<string, unknown>;
    const categories = (candidate.categories as Partial<Category>[]).map((category, order) => ({
      color: category.color ?? '#64748b',
      createdAt: category.createdAt ?? new Date().toISOString(),
      folderId: category.folderId ?? null,
      id: category.id ?? createId('category'),
      name: category.name ?? '未命名清单',
      order: category.order ?? order,
    }));
    const tasks = (candidate.tasks as Partial<Task>[]).map((task, order) =>
      normalizeBackupTask(task, order, categories[0]?.id ?? ''),
    );
    const folders = Array.isArray(candidate.folders) ? (candidate.folders as Folder[]) : [];
    const normalized: BackupPayload = {
      activities: [],
      categories,
      exportedAt: String(candidate.exportedAt),
      filters: [],
      folders,
      settings: { ...defaultAppSettings, ...(candidate.settings as object | undefined) },
      tags: candidate.tags as BackupPayload['tags'],
      tasks,
      templates: [],
      version: 3,
    };
    if (isBackupPayload(normalized)) return normalized;
  }

  throw new Error('备份文件格式不正确.');
}

function isLegacyBackup(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.version === 1 || candidate.version === 2) &&
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

function normalizeBackupTask(task: Partial<Task>, order: number, categoryId: string): Task {
  const dueTime = task.dueTime ?? null;
  const duration = task.duration ?? 30;
  const reminderMinutes = task.reminderMinutes ?? null;
  return {
    allDay: task.allDay ?? !dueTime,
    categoryId: task.categoryId ?? categoryId,
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt ?? new Date().toISOString(),
    deletedAt: task.deletedAt ?? null,
    dueDate: task.dueDate ?? null,
    dueTime,
    duration,
    endDate: task.endDate ?? null,
    endTime:
      task.endTime ??
      (dueTime
        ? format(addMinutes(parseISO(`2000-01-01T${dueTime}:00`), duration), 'HH:mm')
        : null),
    id: task.id ?? createId('task'),
    kind: task.kind ?? 'task',
    notes: task.notes ?? '',
    order: task.order ?? order,
    parentId: task.parentId ?? null,
    priority: task.priority ?? 'none',
    recurrence: task.recurrence
      ? {
          ...createRecurrenceRule(task.recurrence.frequency),
          ...task.recurrence,
          excludedDates: task.recurrence.excludedDates ?? [],
        }
      : null,
    reminderMinutes,
    reminders:
      task.reminders ?? (reminderMinutes === null ? [] : [createReminder(reminderMinutes)]),
    seriesId: task.seriesId ?? (task.recurrence ? createId('series') : null),
    subtasks: (task.subtasks ?? []).map((subtask) => ({
      ...createSubtask(subtask.title),
      ...subtask,
      tagIds: subtask.tagIds ?? [],
    })),
    tagIds: task.tagIds ?? [],
    timeZone: task.timeZone ?? getLocalTimeZone(),
    title: task.title ?? '未命名任务',
    updatedAt: task.updatedAt ?? task.createdAt ?? new Date().toISOString(),
  };
}
