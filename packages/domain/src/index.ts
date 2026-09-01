export const priorities = ['none', 'low', 'medium', 'high'] as const;

export type Priority = (typeof priorities)[number];

export type TaskKind = 'event' | 'note' | 'task';

export type Reminder = {
  id: string;
  offsetMinutes: number;
  reference: 'end' | 'start';
};

export type TaskComment = {
  content: string;
  createdAt: string;
  id: string;
  updatedAt: string;
};

export type RecurrenceFrequency = 'daily' | 'monthly' | 'weekdays' | 'weekly' | 'yearly';

export type RecurrenceRule = {
  basis: 'completion' | 'scheduled';
  completedCount: number;
  endAfterOccurrences: number | null;
  endsOn: string | null;
  excludedDates: string[];
  frequency: RecurrenceFrequency;
  interval: number;
  monthMode: 'date' | 'lastDay' | 'weekDay';
  monthWeek: { week: number; weekDay: number } | null;
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
  autoStartBreak: boolean;
  calendarDensity: CalendarDensity;
  dailyCapacityMinutes: number;
  defaultCalendarMode:
    'agenda' | 'day' | 'fiveDay' | 'month' | 'multiWeek' | 'threeDay' | 'week' | 'year';
  id: 'default';
  showWeekends: boolean;
  shortBreakMinutes: number;
  taskGrouping: 'category' | 'date' | 'none' | 'priority';
  taskSort: 'created' | 'date' | 'manual' | 'priority' | 'updated';
  theme: 'dark' | 'light' | 'system';
  pomodoroMinutes: number;
  focusRounds: number;
  matrixUrgentDays: 1 | 3 | 7;
  whiteNoise: 'brown' | 'none' | 'rain';
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
  attachments: Attachment[];
  allDay: boolean;
  categoryId: string;
  comments?: TaskComment[];
  completedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  dependencyIds?: string[];
  dueDate: string | null;
  dueTime: string | null;
  duration: number;
  endDate: string | null;
  endTime: string | null;
  id: string;
  important: boolean;
  estimateMinutes?: number;
  kind: TaskKind;
  milestone?: boolean;
  notes: string;
  parentId: string | null;
  priority: Priority;
  recurrence: RecurrenceRule | null;
  reminderMinutes: number | null;
  reminders: Reminder[];
  order: number;
  seriesId: string | null;
  sectionId: string | null;
  subtasks: Subtask[];
  tagIds: string[];
  timeZone: string;
  title: string;
  updatedAt: string;
};

export type Attachment = {
  createdAt: string;
  dataUrl: string;
  id: string;
  mimeType: string;
  name: string;
  size: number;
};

export type Section = {
  categoryId: string;
  createdAt: string;
  id: string;
  name: string;
  order: number;
  wipLimit?: number | null;
};

export type HabitGoalChange = {
  changedAt: string;
  target: number;
};

export type Habit = {
  archivedAt: string | null;
  color: string;
  createdAt: string;
  frequency: 'daily' | 'weekly';
  id: string;
  logs: string[];
  name: string;
  goalHistory?: HabitGoalChange[];
  pausedAt?: string | null;
  reminderTime?: string | null;
  skippedDates?: string[];
  target: number;
  weekDays: number[];
};

export type HabitPatch = Partial<
  Pick<
    Habit,
    | 'archivedAt'
    | 'color'
    | 'frequency'
    | 'goalHistory'
    | 'name'
    | 'pausedAt'
    | 'reminderTime'
    | 'skippedDates'
    | 'target'
    | 'weekDays'
  >
>;

export type FocusSession = {
  createdAt: string;
  durationMinutes: number;
  endedAt: string;
  id: string;
  interruptions?: number;
  mode: 'pomodoro' | 'stopwatch';
  startedAt: string;
  stage?: number;
  taskId: string | null;
};

export type Countdown = {
  color: string;
  createdAt: string;
  date: string;
  id: string;
  repeatYearly: boolean;
  title: string;
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
  | 'attachments'
  | 'allDay'
  | 'dueDate'
  | 'dueTime'
  | 'duration'
  | 'endDate'
  | 'endTime'
  | 'important'
  | 'kind'
  | 'notes'
  | 'parentId'
  | 'priority'
  | 'recurrence'
  | 'reminderMinutes'
  | 'reminders'
  | 'sectionId'
  | 'subtasks'
  | 'tagIds'
  | 'timeZone'
  | 'title'
> &
  Partial<Pick<Task, 'comments' | 'dependencyIds' | 'estimateMinutes' | 'milestone'>>;

export type TaskPatch = Partial<TaskDraft>;

export type BackupPayload = {
  activities: ActivityRecord[];
  categories: Category[];
  countdowns: Countdown[];
  exportedAt: string;
  filters: SavedFilter[];
  focusSessions: FocusSession[];
  folders: Folder[];
  habits: Habit[];
  settings: AppSettings;
  sections: Section[];
  tags: Tag[];
  templates: TaskTemplate[];
  tasks: Task[];
  version: 4 | 5;
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
  autoStartBreak: false,
  calendarDensity: 'comfortable',
  dailyCapacityMinutes: 480,
  defaultCalendarMode: 'month',
  id: 'default',
  showWeekends: true,
  shortBreakMinutes: 5,
  taskGrouping: 'none',
  taskSort: 'manual',
  theme: 'system',
  pomodoroMinutes: 25,
  focusRounds: 4,
  matrixUrgentDays: 3,
  whiteNoise: 'none',
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
    basis: 'scheduled',
    completedCount: 0,
    endAfterOccurrences: null,
    endsOn: null,
    excludedDates: [],
    frequency,
    interval: 1,
    monthMode: 'date',
    monthWeek: null,
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
    | 'attachment'
    | 'comment'
    | 'category'
    | 'filter'
    | 'countdown'
    | 'focus'
    | 'folder'
    | 'habit'
    | 'group'
    | 'reminder'
    | 'series'
    | 'section'
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
  const commentText = (task.comments ?? []).map((comment) => comment.content).join(' ');
  return `${task.title} ${task.notes} ${subtaskText} ${commentText}`
    .toLocaleLowerCase()
    .includes(normalized);
}

export function taskProgress(task: Task): { completed: number; total: number } {
  return {
    completed: task.subtasks.filter((subtask) => subtask.completedAt).length,
    total: task.subtasks.length,
  };
}

export function taskActualMinutes(taskId: string, sessions: readonly FocusSession[]): number {
  return sessions
    .filter((session) => session.taskId === taskId)
    .reduce((total, session) => total + session.durationMinutes, 0);
}

export function taskBlockingDependencies(task: Task, tasks: readonly Task[]): Task[] {
  const dependencies = new Set(task.dependencyIds ?? []);
  return tasks.filter((candidate) => dependencies.has(candidate.id) && !candidate.completedAt);
}

export function calculateHabitStreak(
  logs: readonly string[],
  todayKey: string,
): { current: number; longest: number } {
  const uniqueDays = [...new Set(logs)].sort();
  if (uniqueDays.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let running = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previous = dateKeyToUtc(uniqueDays[index - 1]!);
    const current = dateKeyToUtc(uniqueDays[index]!);
    if ((current - previous) / 86_400_000 === 1) running += 1;
    else running = 1;
    longest = Math.max(longest, running);
  }

  const logSet = new Set(uniqueDays);
  const today = dateKeyToUtc(todayKey);
  const currentBase = logSet.has(todayKey) ? today : today - 86_400_000;
  let current = 0;
  for (let cursor = currentBase; logSet.has(utcToDateKey(cursor)); cursor -= 86_400_000) {
    current += 1;
  }
  return { current, longest };
}

function dateKeyToUtc(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00Z`);
}

function utcToDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<BackupPayload>;
  return (
    (candidate.version === 4 || candidate.version === 5) &&
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
    Array.isArray(candidate.sections) &&
    candidate.sections.every(isSectionRecord) &&
    Array.isArray(candidate.habits) &&
    candidate.habits.every(isHabitRecord) &&
    Array.isArray(candidate.focusSessions) &&
    candidate.focusSessions.every(isFocusSessionRecord) &&
    Array.isArray(candidate.countdowns) &&
    candidate.countdowns.every(isCountdownRecord) &&
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
    typeof task.important === 'boolean' &&
    (task.comments === undefined ||
      (Array.isArray(task.comments) && task.comments.every(isTaskCommentRecord))) &&
    (task.dependencyIds === undefined ||
      (Array.isArray(task.dependencyIds) &&
        task.dependencyIds.every((taskId) => typeof taskId === 'string'))) &&
    Array.isArray(task.attachments) &&
    task.attachments.every(isAttachmentRecord) &&
    typeof task.allDay === 'boolean' &&
    typeof task.categoryId === 'string' &&
    Number.isFinite(task.duration) &&
    Number(task.duration) > 0 &&
    (task.estimateMinutes === undefined ||
      (Number.isFinite(task.estimateMinutes) && Number(task.estimateMinutes) >= 0)) &&
    isNullableString(task.dueDate) &&
    isNullableString(task.dueTime) &&
    isNullableString(task.endDate) &&
    isNullableString(task.endTime) &&
    ['event', 'note', 'task'].includes(task.kind ?? '') &&
    (task.milestone === undefined || typeof task.milestone === 'boolean') &&
    typeof task.notes === 'string' &&
    isNullableString(task.parentId) &&
    isNullableString(task.sectionId) &&
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

function isTaskCommentRecord(value: unknown): value is TaskComment {
  if (!value || typeof value !== 'object') return false;
  const comment = value as Partial<TaskComment>;
  return (
    typeof comment.content === 'string' &&
    typeof comment.createdAt === 'string' &&
    typeof comment.id === 'string' &&
    typeof comment.updatedAt === 'string'
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
    ['completion', 'scheduled'].includes(rule.basis ?? '') &&
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
    ['date', 'lastDay', 'weekDay'].includes(rule.monthMode ?? '') &&
    (rule.monthWeek === null ||
      (typeof rule.monthWeek === 'object' &&
        Number.isInteger(rule.monthWeek?.week) &&
        (Number(rule.monthWeek?.week) === -1 || Number(rule.monthWeek?.week) >= 1) &&
        Number(rule.monthWeek?.week) <= 5 &&
        Number.isInteger(rule.monthWeek?.weekDay) &&
        Number(rule.monthWeek?.weekDay) >= 0 &&
        Number(rule.monthWeek?.weekDay) <= 6)) &&
    Array.isArray(rule.weekDays) &&
    rule.weekDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  );
}

function isAttachmentRecord(value: unknown): value is Attachment {
  if (!value || typeof value !== 'object') return false;
  const attachment = value as Partial<Attachment>;
  return (
    typeof attachment.id === 'string' &&
    typeof attachment.name === 'string' &&
    typeof attachment.mimeType === 'string' &&
    typeof attachment.dataUrl === 'string' &&
    Number.isFinite(attachment.size) &&
    typeof attachment.createdAt === 'string'
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

function isSectionRecord(value: unknown): value is Section {
  if (!value || typeof value !== 'object') return false;
  const section = value as Partial<Section>;
  return (
    typeof section.id === 'string' &&
    typeof section.categoryId === 'string' &&
    typeof section.name === 'string' &&
    Number.isFinite(section.order) &&
    (section.wipLimit === undefined ||
      section.wipLimit === null ||
      (Number.isInteger(section.wipLimit) && Number(section.wipLimit) > 0)) &&
    typeof section.createdAt === 'string'
  );
}

function isHabitRecord(value: unknown): value is Habit {
  if (!value || typeof value !== 'object') return false;
  const habit = value as Partial<Habit>;
  return (
    typeof habit.id === 'string' &&
    typeof habit.name === 'string' &&
    typeof habit.color === 'string' &&
    ['daily', 'weekly'].includes(habit.frequency ?? '') &&
    Number.isInteger(habit.target) &&
    Array.isArray(habit.weekDays) &&
    Array.isArray(habit.logs) &&
    (habit.goalHistory === undefined || Array.isArray(habit.goalHistory)) &&
    (habit.pausedAt === undefined || isNullableString(habit.pausedAt)) &&
    (habit.reminderTime === undefined || isNullableString(habit.reminderTime)) &&
    (habit.skippedDates === undefined || Array.isArray(habit.skippedDates)) &&
    isNullableString(habit.archivedAt) &&
    typeof habit.createdAt === 'string'
  );
}

function isFocusSessionRecord(value: unknown): value is FocusSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<FocusSession>;
  return (
    typeof session.id === 'string' &&
    isNullableString(session.taskId) &&
    ['pomodoro', 'stopwatch'].includes(session.mode ?? '') &&
    Number.isFinite(session.durationMinutes) &&
    (session.interruptions === undefined || Number.isInteger(session.interruptions)) &&
    (session.stage === undefined || Number.isInteger(session.stage)) &&
    typeof session.startedAt === 'string' &&
    typeof session.endedAt === 'string' &&
    typeof session.createdAt === 'string'
  );
}

function isCountdownRecord(value: unknown): value is Countdown {
  if (!value || typeof value !== 'object') return false;
  const countdown = value as Partial<Countdown>;
  return (
    typeof countdown.id === 'string' &&
    typeof countdown.title === 'string' &&
    typeof countdown.date === 'string' &&
    typeof countdown.color === 'string' &&
    typeof countdown.repeatYearly === 'boolean' &&
    typeof countdown.createdAt === 'string'
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
    (settings.autoStartBreak === undefined || typeof settings.autoStartBreak === 'boolean') &&
    (settings.dailyCapacityMinutes === undefined ||
      (Number.isInteger(settings.dailyCapacityMinutes) &&
        Number(settings.dailyCapacityMinutes) > 0)) &&
    ['agenda', 'day', 'fiveDay', 'month', 'multiWeek', 'threeDay', 'week', 'year'].includes(
      settings.defaultCalendarMode ?? '',
    ) &&
    typeof settings.showWeekends === 'boolean' &&
    Number.isInteger(settings.shortBreakMinutes) &&
    Number(settings.shortBreakMinutes) > 0 &&
    ['category', 'date', 'none', 'priority'].includes(settings.taskGrouping ?? '') &&
    ['created', 'date', 'manual', 'priority', 'updated'].includes(settings.taskSort ?? '') &&
    ['dark', 'light', 'system'].includes(settings.theme ?? '') &&
    Number.isInteger(settings.pomodoroMinutes) &&
    Number(settings.pomodoroMinutes) > 0 &&
    (settings.focusRounds === undefined ||
      (Number.isInteger(settings.focusRounds) && Number(settings.focusRounds) > 0)) &&
    (settings.matrixUrgentDays === undefined || [1, 3, 7].includes(settings.matrixUrgentDays)) &&
    (settings.whiteNoise === undefined ||
      ['brown', 'none', 'rain'].includes(settings.whiteNoise)) &&
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
