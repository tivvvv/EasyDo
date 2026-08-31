export const priorities = ['none', 'low', 'medium', 'high'] as const;

export type Priority = (typeof priorities)[number];

export type TaskKind = 'event' | 'note' | 'task';

export type Reminder = {
  id: string;
  offsetMinutes: number;
  reference: 'end' | 'start';
};

export type RecurrenceFrequency = 'daily' | 'monthly' | 'weekdays' | 'weekly' | 'yearly';

export type RecurrenceRule = {
  completedCount: number;
  endAfterOccurrences: number | null;
  endsOn: string | null;
  excludedDates: string[];
  frequency: RecurrenceFrequency;
  interval: number;
  monthMode: 'date' | 'lastDay';
  weekDays: number[];
};

export type Subtask = {
  completedAt: string | null;
  dueDate: string | null;
  dueTime: string | null;
  id: string;
  notes: string;
  priority: Priority;
  reminderMinutes: number | null;
  tagIds: string[];
  title: string;
};

export type RecurrenceEditScope = 'all' | 'current' | 'future';

export type CalendarDensity = 'comfortable' | 'compact';

export type AppSettings = {
  agendaDays: 7 | 14 | 30;
  calendarDensity: CalendarDensity;
  defaultCalendarMode: 'agenda' | 'day' | 'fiveDay' | 'month' | 'threeDay' | 'week';
  id: 'default';
  showWeekends: boolean;
  taskGrouping: 'category' | 'date' | 'none' | 'priority';
  taskSort: 'created' | 'date' | 'manual' | 'priority' | 'updated';
  weekStartsOn: 0 | 1;
  workdayEnd: number;
  workdayStart: number;
};

export type FilterCriteria = {
  categoryId: string | null;
  dateRange: 'all' | 'next7' | 'next30' | 'overdue' | 'today' | 'unscheduled';
  kind: TaskKind | 'all';
  priority: Priority | 'all';
  status: 'active' | 'all' | 'completed';
  tagIds: string[];
};

export type SavedFilter = {
  createdAt: string;
  criteria: FilterCriteria;
  id: string;
  name: string;
};

export type Task = {
  allDay: boolean;
  categoryId: string;
  completedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  dueDate: string | null;
  dueTime: string | null;
  duration: number;
  endDate: string | null;
  endTime: string | null;
  id: string;
  kind: TaskKind;
  notes: string;
  parentId: string | null;
  priority: Priority;
  recurrence: RecurrenceRule | null;
  reminderMinutes: number | null;
  reminders: Reminder[];
  order: number;
  seriesId: string | null;
  subtasks: Subtask[];
  tagIds: string[];
  timeZone: string;
  title: string;
  updatedAt: string;
};

export type TaskTemplate = {
  createdAt: string;
  draft: TaskDraft;
  id: string;
  name: string;
};

export type ActivityAction = 'complete' | 'create' | 'duplicate' | 'restore' | 'trash' | 'update';

export type ActivityRecord = {
  action: ActivityAction;
  after: Task | null;
  before: Task | null;
  createdAt: string;
  groupId: string;
  id: string;
  taskId: string;
};

export type Category = {
  color: string;
  createdAt: string;
  folderId: string | null;
  id: string;
  name: string;
  order: number;
};

export type Folder = {
  createdAt: string;
  id: string;
  name: string;
  order: number;
};

export type Tag = {
  color: string;
  createdAt: string;
  id: string;
  name: string;
};

export type TaskDraft = Pick<
  Task,
  | 'categoryId'
  | 'allDay'
  | 'dueDate'
  | 'dueTime'
  | 'duration'
  | 'endDate'
  | 'endTime'
  | 'kind'
  | 'notes'
  | 'parentId'
  | 'priority'
  | 'recurrence'
  | 'reminderMinutes'
  | 'reminders'
  | 'subtasks'
  | 'tagIds'
  | 'timeZone'
  | 'title'
>;

export type TaskPatch = Partial<TaskDraft>;

export type BackupPayload = {
  activities: ActivityRecord[];
  categories: Category[];
  exportedAt: string;
  filters: SavedFilter[];
  folders: Folder[];
  settings: AppSettings;
  tags: Tag[];
  templates: TaskTemplate[];
  tasks: Task[];
  version: 3;
};

export const defaultFilterCriteria: FilterCriteria = {
  categoryId: null,
  dateRange: 'all',
  kind: 'all',
  priority: 'all',
  status: 'active',
  tagIds: [],
};

export const defaultAppSettings: AppSettings = {
  agendaDays: 14,
  calendarDensity: 'comfortable',
  defaultCalendarMode: 'month',
  id: 'default',
  showWeekends: true,
  taskGrouping: 'none',
  taskSort: 'manual',
  weekStartsOn: 1,
  workdayEnd: 22,
  workdayStart: 7,
};

export const priorityLabels: Record<Priority, string> = {
  high: '高优先级',
  low: '低优先级',
  medium: '中优先级',
  none: '无优先级',
};

export const taskKindLabels: Record<TaskKind, string> = {
  event: '事件',
  note: '笔记',
  task: '任务',
};

export function createReminder(
  offsetMinutes: number,
  reference: Reminder['reference'] = 'start',
): Reminder {
  return { id: createId('reminder'), offsetMinutes, reference };
}

export function createSubtask(title = ''): Subtask {
  return {
    completedAt: null,
    dueDate: null,
    dueTime: null,
    id: createId('subtask'),
    notes: '',
    priority: 'none',
    reminderMinutes: null,
    tagIds: [],
    title,
  };
}

export function createRecurrenceRule(frequency: RecurrenceFrequency): RecurrenceRule {
  return {
    completedCount: 0,
    endAfterOccurrences: null,
    endsOn: null,
    excludedDates: [],
    frequency,
    interval: 1,
    monthMode: 'date',
    weekDays: [],
  };
}

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
}

const priorityWeight: Record<Priority, number> = {
  high: 3,
  low: 1,
  medium: 2,
  none: 0,
};

export function createId(
  prefix:
    | 'activity'
    | 'category'
    | 'filter'
    | 'folder'
    | 'group'
    | 'reminder'
    | 'series'
    | 'subtask'
    | 'tag'
    | 'task'
    | 'template',
): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    if (left.completedAt !== right.completedAt) {
      return left.completedAt ? 1 : -1;
    }

    const leftDate = `${left.dueDate ?? '9999-12-31'}T${left.dueTime ?? '23:59'}`;
    const rightDate = `${right.dueDate ?? '9999-12-31'}T${right.dueTime ?? '23:59'}`;

    return (
      left.order - right.order ||
      leftDate.localeCompare(rightDate) ||
      priorityWeight[right.priority] - priorityWeight[left.priority] ||
      left.createdAt.localeCompare(right.createdAt)
    );
  });
}

export function matchesTaskSearch(task: Task, search: string): boolean {
  const normalized = search.trim().toLocaleLowerCase();

  if (!normalized) {
    return true;
  }

  const subtaskText = task.subtasks.map((subtask) => `${subtask.title} ${subtask.notes}`).join(' ');
  return `${task.title} ${task.notes} ${subtaskText}`.toLocaleLowerCase().includes(normalized);
}

export function taskProgress(task: Task): { completed: number; total: number } {
  return {
    completed: task.subtasks.filter((subtask) => subtask.completedAt).length,
    total: task.subtasks.length,
  };
}

export function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<BackupPayload>;
  return (
    candidate.version === 3 &&
    Array.isArray(candidate.tasks) &&
    candidate.tasks.every(isTaskRecord) &&
    Array.isArray(candidate.categories) &&
    candidate.categories.every(isCategoryRecord) &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every(isTagRecord) &&
    Array.isArray(candidate.templates) &&
    candidate.templates.every(isTemplateRecord) &&
    Array.isArray(candidate.filters) &&
    candidate.filters.every(isSavedFilterRecord) &&
    Array.isArray(candidate.folders) &&
    candidate.folders.every(isFolderRecord) &&
    Array.isArray(candidate.activities) &&
    candidate.activities.every(isActivityRecord) &&
    isSettingsRecord(candidate.settings) &&
    typeof candidate.exportedAt === 'string'
  );
}

function isTaskRecord(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<Task>;
  return (
    typeof task.id === 'string' &&
    isTaskDraftRecord(value) &&
    isNullableString(task.completedAt) &&
    isNullableString(task.deletedAt) &&
    Number.isFinite(task.order) &&
    isNullableString(task.seriesId) &&
    typeof task.createdAt === 'string' &&
    typeof task.updatedAt === 'string'
  );
}

function isTaskDraftRecord(value: unknown): value is TaskDraft {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<TaskDraft>;
  return (
    typeof task.title === 'string' &&
    typeof task.allDay === 'boolean' &&
    typeof task.categoryId === 'string' &&
    Number.isFinite(task.duration) &&
    Number(task.duration) > 0 &&
    isNullableString(task.dueDate) &&
    isNullableString(task.dueTime) &&
    isNullableString(task.endDate) &&
    isNullableString(task.endTime) &&
    ['event', 'note', 'task'].includes(task.kind ?? '') &&
    typeof task.notes === 'string' &&
    isNullableString(task.parentId) &&
    priorities.some((priority) => priority === task.priority) &&
    isRecurrenceRecord(task.recurrence) &&
    (task.reminderMinutes === null || Number.isFinite(task.reminderMinutes)) &&
    Array.isArray(task.reminders) &&
    task.reminders.every(isReminderRecord) &&
    Array.isArray(task.tagIds) &&
    task.tagIds.every((tagId) => typeof tagId === 'string') &&
    Array.isArray(task.subtasks) &&
    task.subtasks.every(
      (subtask) =>
        typeof subtask.id === 'string' &&
        typeof subtask.title === 'string' &&
        isNullableString(subtask.completedAt) &&
        isNullableString(subtask.dueDate) &&
        isNullableString(subtask.dueTime) &&
        typeof subtask.notes === 'string' &&
        priorities.some((priority) => priority === subtask.priority) &&
        (subtask.reminderMinutes === null || Number.isFinite(subtask.reminderMinutes)) &&
        Array.isArray(subtask.tagIds) &&
        subtask.tagIds.every((tagId) => typeof tagId === 'string'),
    ) &&
    typeof task.timeZone === 'string'
  );
}

function isReminderRecord(value: unknown): value is Reminder {
  if (!value || typeof value !== 'object') return false;
  const reminder = value as Partial<Reminder>;
  return (
    typeof reminder.id === 'string' &&
    Number.isFinite(reminder.offsetMinutes) &&
    ['end', 'start'].includes(reminder.reference ?? '')
  );
}

function isRecurrenceRecord(value: unknown): value is RecurrenceRule | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const rule = value as Partial<RecurrenceRule>;
  return (
    Number.isInteger(rule.completedCount) &&
    Number(rule.completedCount) >= 0 &&
    (rule.endAfterOccurrences === null ||
      (Number.isInteger(rule.endAfterOccurrences) && Number(rule.endAfterOccurrences) > 0)) &&
    ['daily', 'monthly', 'weekdays', 'weekly', 'yearly'].includes(rule.frequency ?? '') &&
    Number.isInteger(rule.interval) &&
    Number(rule.interval) > 0 &&
    isNullableString(rule.endsOn) &&
    Array.isArray(rule.excludedDates) &&
    rule.excludedDates.every((date) => typeof date === 'string') &&
    ['date', 'lastDay'].includes(rule.monthMode ?? '') &&
    Array.isArray(rule.weekDays) &&
    rule.weekDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  );
}

function isCategoryRecord(value: unknown): value is Category {
  if (!value || typeof value !== 'object') return false;
  const category = value as Partial<Category>;
  return (
    typeof category.id === 'string' &&
    typeof category.name === 'string' &&
    typeof category.color === 'string' &&
    isNullableString(category.folderId) &&
    Number.isFinite(category.order) &&
    typeof category.createdAt === 'string'
  );
}

function isFolderRecord(value: unknown): value is Folder {
  if (!value || typeof value !== 'object') return false;
  const folder = value as Partial<Folder>;
  return (
    typeof folder.id === 'string' &&
    typeof folder.name === 'string' &&
    Number.isFinite(folder.order) &&
    typeof folder.createdAt === 'string'
  );
}

function isTagRecord(value: unknown): value is Tag {
  if (!value || typeof value !== 'object') return false;
  const tag = value as Partial<Tag>;
  return (
    typeof tag.id === 'string' &&
    typeof tag.name === 'string' &&
    typeof tag.color === 'string' &&
    typeof tag.createdAt === 'string'
  );
}

function isTemplateRecord(value: unknown): value is TaskTemplate {
  if (!value || typeof value !== 'object') return false;
  const template = value as Partial<TaskTemplate>;
  return (
    typeof template.id === 'string' &&
    typeof template.name === 'string' &&
    typeof template.createdAt === 'string' &&
    isTaskDraftRecord(template.draft)
  );
}

function isSavedFilterRecord(value: unknown): value is SavedFilter {
  if (!value || typeof value !== 'object') return false;
  const filter = value as Partial<SavedFilter>;
  return (
    typeof filter.id === 'string' &&
    typeof filter.name === 'string' &&
    typeof filter.createdAt === 'string' &&
    isFilterCriteriaRecord(filter.criteria)
  );
}

function isFilterCriteriaRecord(value: unknown): value is FilterCriteria {
  if (!value || typeof value !== 'object') return false;
  const criteria = value as Partial<FilterCriteria>;
  return (
    isNullableString(criteria.categoryId) &&
    ['all', 'next7', 'next30', 'overdue', 'today', 'unscheduled'].includes(
      criteria.dateRange ?? '',
    ) &&
    (criteria.kind === 'all' || ['event', 'note', 'task'].includes(criteria.kind ?? '')) &&
    (criteria.priority === 'all' || priorities.some((item) => item === criteria.priority)) &&
    ['active', 'all', 'completed'].includes(criteria.status ?? '') &&
    Array.isArray(criteria.tagIds) &&
    criteria.tagIds.every((tagId) => typeof tagId === 'string')
  );
}

function isActivityRecord(value: unknown): value is ActivityRecord {
  if (!value || typeof value !== 'object') return false;
  const activity = value as Partial<ActivityRecord>;
  return (
    ['complete', 'create', 'duplicate', 'restore', 'trash', 'update'].includes(
      activity.action ?? '',
    ) &&
    (activity.before === null || isTaskRecord(activity.before)) &&
    (activity.after === null || isTaskRecord(activity.after)) &&
    typeof activity.createdAt === 'string' &&
    typeof activity.groupId === 'string' &&
    typeof activity.id === 'string' &&
    typeof activity.taskId === 'string'
  );
}

function isSettingsRecord(value: unknown): value is AppSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<AppSettings>;
  return (
    settings.id === 'default' &&
    [7, 14, 30].includes(settings.agendaDays ?? 0) &&
    ['comfortable', 'compact'].includes(settings.calendarDensity ?? '') &&
    ['agenda', 'day', 'fiveDay', 'month', 'threeDay', 'week'].includes(
      settings.defaultCalendarMode ?? '',
    ) &&
    typeof settings.showWeekends === 'boolean' &&
    ['category', 'date', 'none', 'priority'].includes(settings.taskGrouping ?? '') &&
    ['created', 'date', 'manual', 'priority', 'updated'].includes(settings.taskSort ?? '') &&
    [0, 1].includes(settings.weekStartsOn ?? -1) &&
    Number.isInteger(settings.workdayStart) &&
    Number.isInteger(settings.workdayEnd) &&
    Number(settings.workdayStart) >= 0 &&
    Number(settings.workdayEnd) <= 24 &&
    Number(settings.workdayStart) < Number(settings.workdayEnd)
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
