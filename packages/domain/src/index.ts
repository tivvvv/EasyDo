export const priorities = ['none', 'low', 'medium', 'high'] as const;

export type Priority = (typeof priorities)[number];

export type Task = {
  categoryId: string;
  completedAt: string | null;
  createdAt: string;
  dueDate: string | null;
  dueTime: string | null;
  duration: number;
  id: string;
  notes: string;
  priority: Priority;
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
  'categoryId' | 'dueDate' | 'dueTime' | 'duration' | 'notes' | 'priority' | 'tagIds' | 'title'
>;

export type TaskPatch = Partial<TaskDraft>;

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

export function createId(prefix: 'category' | 'tag' | 'task'): string {
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

  return `${task.title} ${task.notes}`.toLocaleLowerCase().includes(normalized);
}
