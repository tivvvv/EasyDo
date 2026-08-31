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

export type Task = {
  categoryId: string;
  completedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  dueDate: string | null;
  dueTime: string | null;
  duration: number;
  id: string;
  notes: string;
  priority: Priority;
  recurrence: RecurrenceRule | null;
  reminderMinutes: number | null;
  subtasks: Subtask[];
  tagIds: string[];
  title: string;
  updatedAt: string;
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
  categories: Category[];
  exportedAt: string;
  tags: Tag[];
  tasks: Task[];
  version: 1;
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

export function createId(prefix: 'category' | 'subtask' | 'tag' | 'task'): string {
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
    candidate.version === 1 &&
    Array.isArray(candidate.tasks) &&
    candidate.tasks.every(isTaskRecord) &&
    Array.isArray(candidate.categories) &&
    candidate.categories.every(isCategoryRecord) &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every(isTagRecord) &&
    typeof candidate.exportedAt === 'string'
  );
}

function isTaskRecord(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<Task>;
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.categoryId === 'string' &&
    typeof task.duration === 'number' &&
    priorities.some((priority) => priority === task.priority) &&
    Array.isArray(task.tagIds) &&
    task.tagIds.every((tagId) => typeof tagId === 'string') &&
    Array.isArray(task.subtasks) &&
    task.subtasks.every(
      (subtask) =>
        typeof subtask.id === 'string' &&
        typeof subtask.title === 'string' &&
        (subtask.completedAt === null || typeof subtask.completedAt === 'string'),
    )
  );
}

function isCategoryRecord(value: unknown): value is Category {
  if (!value || typeof value !== 'object') return false;
  const category = value as Partial<Category>;
  return (
    typeof category.id === 'string' &&
    typeof category.name === 'string' &&
    typeof category.color === 'string' &&
    typeof category.order === 'number'
  );
}

function isTagRecord(value: unknown): value is Tag {
  if (!value || typeof value !== 'object') return false;
  const tag = value as Partial<Tag>;
  return (
    typeof tag.id === 'string' && typeof tag.name === 'string' && typeof tag.color === 'string'
  );
}
