export const priorities = ['none', 'low', 'medium', 'high'] as const;

export type Priority = (typeof priorities)[number];

export type RecurrenceFrequency = 'daily' | 'monthly' | 'weekdays' | 'weekly' | 'yearly';

export type RecurrenceRule = {
  endsOn: string | null;
  frequency: RecurrenceFrequency;
  interval: number;
  weekDays: number[];
};

export type Subtask = {
  completedAt: string | null;
  id: string;
  title: string;
};

export type RecurrenceEditScope = 'all' | 'current' | 'future';

export type CalendarDensity = 'comfortable' | 'compact';

export type AppSettings = {
  agendaDays: 7 | 14 | 30;
  calendarDensity: CalendarDensity;
  id: 'default';
  showWeekends: boolean;
  workdayEnd: number;
  workdayStart: number;
};

export type FilterCriteria = {
  categoryId: string | null;
  dateRange: 'all' | 'next7' | 'next30' | 'overdue' | 'today' | 'unscheduled';
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
  categoryId: string;
  completedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  dueDate: string | null;
  dueTime: string | null;
  duration: number;
  endDate: string | null;
  id: string;
  notes: string;
  priority: Priority;
  recurrence: RecurrenceRule | null;
  reminderMinutes: number | null;
  order: number;
  subtasks: Subtask[];
  tagIds: string[];
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
  | 'dueDate'
  | 'dueTime'
  | 'duration'
  | 'endDate'
  | 'notes'
  | 'priority'
  | 'recurrence'
  | 'reminderMinutes'
  | 'subtasks'
  | 'tagIds'
  | 'title'
>;

export type TaskPatch = Partial<TaskDraft>;

export type BackupPayload = {
  activities: ActivityRecord[];
  categories: Category[];
  exportedAt: string;
  filters: SavedFilter[];
  settings: AppSettings;
  tags: Tag[];
  templates: TaskTemplate[];
  tasks: Task[];
  version: 2;
};

export const defaultFilterCriteria: FilterCriteria = {
  categoryId: null,
  dateRange: 'all',
  priority: 'all',
  status: 'active',
  tagIds: [],
};

export const defaultAppSettings: AppSettings = {
  agendaDays: 14,
  calendarDensity: 'comfortable',
  id: 'default',
  showWeekends: true,
  workdayEnd: 22,
  workdayStart: 7,
};

export const priorityLabels: Record<Priority, string> = {
  high: '高优先级',
  low: '低优先级',
  medium: '中优先级',
  none: '无优先级',
};

const priorityWeight: Record<Priority, number> = {
  high: 3,
  low: 1,
  medium: 2,
  none: 0,
};

export function createId(
  prefix: 'activity' | 'category' | 'filter' | 'group' | 'subtask' | 'tag' | 'task' | 'template',
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

  const subtaskText = task.subtasks.map((subtask) => subtask.title).join(' ');
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
    candidate.version === 2 &&
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
    typeof task.createdAt === 'string' &&
    typeof task.updatedAt === 'string'
  );
}

function isTaskDraftRecord(value: unknown): value is TaskDraft {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<TaskDraft>;
  return (
    typeof task.title === 'string' &&
    typeof task.categoryId === 'string' &&
    Number.isFinite(task.duration) &&
    Number(task.duration) > 0 &&
    isNullableString(task.dueDate) &&
    isNullableString(task.dueTime) &&
    isNullableString(task.endDate) &&
    typeof task.notes === 'string' &&
    priorities.some((priority) => priority === task.priority) &&
    isRecurrenceRecord(task.recurrence) &&
    (task.reminderMinutes === null || Number.isFinite(task.reminderMinutes)) &&
    Array.isArray(task.tagIds) &&
    task.tagIds.every((tagId) => typeof tagId === 'string') &&
    Array.isArray(task.subtasks) &&
    task.subtasks.every(
      (subtask) =>
        typeof subtask.id === 'string' &&
        typeof subtask.title === 'string' &&
        isNullableString(subtask.completedAt),
    )
  );
}

function isRecurrenceRecord(value: unknown): value is RecurrenceRule | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const rule = value as Partial<RecurrenceRule>;
  return (
    ['daily', 'monthly', 'weekdays', 'weekly', 'yearly'].includes(rule.frequency ?? '') &&
    Number.isInteger(rule.interval) &&
    Number(rule.interval) > 0 &&
    isNullableString(rule.endsOn) &&
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
    Number.isFinite(category.order) &&
    typeof category.createdAt === 'string'
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
    typeof settings.showWeekends === 'boolean' &&
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
