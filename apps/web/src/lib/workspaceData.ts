import type { BackupPayload, Task } from '@easydo/domain';
import {
  createId,
  createRecurrenceRule,
  createReminder,
  createSubtask,
  defaultAppSettings,
  getLocalTimeZone,
} from '@easydo/domain';

function timestampOf(value: { createdAt?: string; updatedAt?: string }): string {
  return value.updatedAt ?? value.createdAt ?? '';
}

function mergeById<T extends { createdAt?: string; id: string; updatedAt?: string }>(
  primary: T[],
  secondary: T[],
  resolve: (primary: T, secondary: T) => T = (primaryValue, secondaryValue) =>
    timestampOf(secondaryValue) > timestampOf(primaryValue) ? secondaryValue : primaryValue,
): T[] {
  const merged = new Map(primary.map((item) => [item.id, structuredClone(item)]));
  for (const item of secondary) {
    const current = merged.get(item.id);
    merged.set(item.id, current ? resolve(current, item) : structuredClone(item));
  }
  return [...merged.values()];
}

function mergeGoalHistory<T extends { changedAt: string }>(primary: T[], secondary: T[]): T[] {
  return [
    ...new Map([...primary, ...secondary].map((item) => [item.changedAt, item])).values(),
  ].sort((left, right) => left.changedAt.localeCompare(right.changedAt));
}

export function mergeWorkspaces(primary: BackupPayload, secondary: BackupPayload): BackupPayload {
  return {
    activities: mergeById(primary.activities, secondary.activities),
    categories: mergeById(primary.categories, secondary.categories),
    countdowns: mergeById(primary.countdowns, secondary.countdowns),
    exportedAt: new Date().toISOString(),
    filters: mergeById(primary.filters, secondary.filters),
    focusSessions: mergeById(primary.focusSessions, secondary.focusSessions),
    folders: mergeById(primary.folders, secondary.folders),
    habits: mergeById(primary.habits, secondary.habits, (current, incoming) => ({
      ...(timestampOf(incoming) > timestampOf(current) ? incoming : current),
      goalHistory: mergeGoalHistory(current.goalHistory ?? [], incoming.goalHistory ?? []),
      logs: [...new Set([...current.logs, ...incoming.logs])].sort(),
      skippedDates: [
        ...new Set([...(current.skippedDates ?? []), ...(incoming.skippedDates ?? [])]),
      ].sort(),
    })),
    sections: mergeById(primary.sections, secondary.sections),
    settings: { ...defaultAppSettings, ...secondary.settings, ...primary.settings },
    tags: mergeById(primary.tags, secondary.tags),
    tasks: mergeById(primary.tasks, secondary.tasks, (current, incoming) =>
      incoming.updatedAt > current.updatedAt ? incoming : current,
    ),
    templates: mergeById(primary.templates, secondary.templates),
    version: 5,
  };
}

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function createInitialWorkspace(now = new Date()): BackupPayload {
  const createdAt = now.toISOString();
  const today = localDateKey(now);
  const tomorrow = localDateKey(new Date(now.getTime() + 86_400_000));
  const task = (
    title: string,
    categoryId: string,
    order: number,
    dueDate: string,
    dueTime: string | null,
    partial: Partial<Task>,
  ): Task => ({
    allDay: dueTime === null,
    attachments: [],
    categoryId,
    completedAt: null,
    createdAt,
    deletedAt: null,
    dependencyIds: [],
    dueDate,
    dueTime,
    duration: 30,
    endDate: null,
    endTime: null,
    estimateMinutes: 30,
    id: createId('task'),
    important: false,
    kind: 'task',
    milestone: false,
    notes: '',
    order,
    parentId: null,
    priority: 'none',
    recurrence: null,
    reminderMinutes: null,
    reminders: [],
    sectionId: null,
    seriesId: null,
    subtasks: [],
    tagIds: [],
    timeZone: getLocalTimeZone(),
    title,
    updatedAt: createdAt,
    ...partial,
  });
  return {
    activities: [],
    categories: [
      { color: '#655fd7', createdAt, folderId: null, id: 'category-work', name: '工作', order: 0 },
      {
        color: '#3fa27c',
        createdAt,
        folderId: null,
        id: 'category-personal',
        name: '个人',
        order: 1,
      },
      { color: '#df8b4d', createdAt, folderId: null, id: 'category-study', name: '学习', order: 2 },
    ],
    countdowns: [],
    exportedAt: createdAt,
    filters: [],
    focusSessions: [],
    folders: [],
    habits: [],
    sections: [],
    settings: { ...defaultAppSettings },
    tags: [
      { color: '#655fd7', createdAt, id: 'tag-focus', name: '专注' },
      { color: '#3fa27c', createdAt, id: 'tag-routine', name: '例行' },
    ],
    tasks: [
      task('规划今天最重要的三件事', 'category-work', 0, today, '09:30', {
        duration: 45,
        endTime: '10:15',
        important: true,
        notes: '双击日历空白处可以快速创建任务.',
        priority: 'high',
        reminderMinutes: 10,
        reminders: [createReminder(10)],
        subtasks: [createSubtask('确认今天的截止事项'), createSubtask('选出最重要的三项任务')],
        tagIds: ['tag-focus'],
      }),
      task('傍晚散步 30 分钟', 'category-personal', 1, today, '18:30', {
        endTime: '19:00',
        notes: '完成任务后点击左侧圆框.',
        priority: 'medium',
        recurrence: createRecurrenceRule('weekdays'),
        seriesId: createId('series'),
        tagIds: ['tag-routine'],
      }),
      task('整理本周学习计划', 'category-study', 2, tomorrow, null, {
        duration: 60,
        estimateMinutes: 60,
        notes: '你可以把日历中的任务拖到其他日期.',
        priority: 'low',
      }),
    ],
    templates: [],
    version: 5,
  };
}
