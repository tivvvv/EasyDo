import type {
  ActivityRecord,
  AppSettings,
  BackupPayload,
  Category,
  Countdown,
  FocusSession,
  Folder,
  Habit,
  HabitPatch,
  ReminderDelivery,
  SavedFilter,
  Section,
  Tag,
  Task,
  TaskDraft,
  TaskTemplate,
} from '@easydo/domain';
import { createId } from '@easydo/domain';

import { sharedWorkspace } from './lib/sharedWorkspace';

function requireItem<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`${label}不存在.`);
  return item;
}

export class SharedTaskRepository {
  async add(task: Task): Promise<void> {
    await sharedWorkspace.mutate((workspace) => workspace.tasks.push(structuredClone(task)));
  }

  async delete(id: string): Promise<void> {
    await sharedWorkspace.mutate((workspace) => {
      workspace.tasks = workspace.tasks.filter((task) => task.id !== id);
    });
  }

  async get(id: string): Promise<Task | undefined> {
    await sharedWorkspace.initialize();
    const task = sharedWorkspace.getSnapshot()?.tasks.find((candidate) => candidate.id === id);
    return task ? structuredClone(task) : undefined;
  }

  async getBySeries(seriesId: string): Promise<Task[]> {
    await sharedWorkspace.initialize();
    return structuredClone(
      sharedWorkspace.getSnapshot()?.tasks.filter((task) => task.seriesId === seriesId) ?? [],
    );
  }

  async update(id: string, patch: Partial<Task>): Promise<void> {
    await sharedWorkspace.mutate((workspace) => {
      Object.assign(requireItem(workspace.tasks, id, '任务'), structuredClone(patch));
    });
  }
}

export class SharedActivityRepository {
  async add(activity: ActivityRecord): Promise<void> {
    await sharedWorkspace.mutate((workspace) =>
      workspace.activities.push(structuredClone(activity)),
    );
  }

  async delete(id: string): Promise<void> {
    await sharedWorkspace.mutate((workspace) => {
      workspace.activities = workspace.activities.filter((activity) => activity.id !== id);
    });
  }

  async getByGroup(groupId: string): Promise<ActivityRecord[]> {
    await sharedWorkspace.initialize();
    return structuredClone(
      sharedWorkspace.getSnapshot()?.activities.filter((item) => item.groupId === groupId) ?? [],
    );
  }

  async getLatest(): Promise<ActivityRecord | undefined> {
    await sharedWorkspace.initialize();
    const activities = sharedWorkspace.getSnapshot()?.activities ?? [];
    const latest = [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return latest ? structuredClone(latest) : undefined;
  }
}

export async function addCategory(name: string, color: string): Promise<Category> {
  const category: Category = {
    color,
    createdAt: new Date().toISOString(),
    folderId: null,
    id: createId('category'),
    name: name.trim(),
    order: 0,
  };
  await sharedWorkspace.mutate((workspace) => {
    category.order = workspace.categories.length;
    workspace.categories.push(category);
  });
  return category;
}

export async function addTag(name: string, color: string): Promise<Tag> {
  const tag: Tag = {
    color,
    createdAt: new Date().toISOString(),
    id: createId('tag'),
    name: name.trim(),
  };
  await sharedWorkspace.mutate((workspace) => workspace.tags.push(tag));
  return tag;
}

export async function updateCategory(
  id: string,
  patch: Pick<Category, 'color' | 'name'> & Partial<Pick<Category, 'folderId'>>,
): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    Object.assign(requireItem(workspace.categories, id, '分类'), {
      color: patch.color,
      ...(patch.folderId === undefined ? {} : { folderId: patch.folderId }),
      name: patch.name.trim(),
    });
  });
}

export async function addFolder(name: string): Promise<Folder> {
  const folder: Folder = {
    createdAt: new Date().toISOString(),
    id: createId('folder'),
    name: name.trim(),
    order: 0,
  };
  await sharedWorkspace.mutate((workspace) => {
    folder.order = workspace.folders.length;
    workspace.folders.push(folder);
  });
  return folder;
}

export async function updateFolder(id: string, name: string): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    requireItem(workspace.folders, id, '文件夹').name = name.trim();
  });
}

export async function deleteFolder(id: string): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    for (const category of workspace.categories) {
      if (category.folderId === id) category.folderId = null;
    }
    workspace.folders = workspace.folders.filter((folder) => folder.id !== id);
  });
}

export async function deleteCategory(id: string, replacementId: string): Promise<void> {
  if (id === replacementId) throw new Error('替代分类不能与被删除分类相同.');
  await sharedWorkspace.mutate((workspace) => {
    requireItem(workspace.categories, replacementId, '替代分类');
    for (const task of workspace.tasks) {
      if (task.categoryId === id) {
        task.categoryId = replacementId;
        task.sectionId = null;
      }
    }
    workspace.sections = workspace.sections.filter((section) => section.categoryId !== id);
    workspace.categories = workspace.categories.filter((category) => category.id !== id);
  });
}

export async function updateTag(id: string, patch: Pick<Tag, 'color' | 'name'>): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    Object.assign(requireItem(workspace.tags, id, '标签'), {
      color: patch.color,
      name: patch.name.trim(),
    });
  });
}

export async function deleteTag(id: string): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    for (const task of workspace.tasks) task.tagIds = task.tagIds.filter((tagId) => tagId !== id);
    workspace.tags = workspace.tags.filter((tag) => tag.id !== id);
  });
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    for (const [order, id] of orderedIds.entries()) {
      const category = workspace.categories.find((item) => item.id === id);
      if (category) category.order = order;
    }
  });
}

export async function exportBackup(): Promise<BackupPayload> {
  await sharedWorkspace.initialize();
  const workspace = sharedWorkspace.getSnapshot();
  if (!workspace) throw new Error('共享数据尚未加载.');
  return { ...structuredClone(workspace), exportedAt: new Date().toISOString() };
}

export async function replaceFromBackup(payload: BackupPayload): Promise<void> {
  await sharedWorkspace.replace(payload);
}

export async function recordReminderDeliveries(
  deliveries: readonly ReminderDelivery[],
): Promise<void> {
  if (!deliveries.length) return;
  await sharedWorkspace.mutate((workspace) => {
    const byKey = new Map((workspace.reminderDeliveries ?? []).map((item) => [item.key, item]));
    for (const delivery of deliveries) byKey.set(delivery.key, structuredClone(delivery));
    workspace.reminderDeliveries = [...byKey.values()]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(-1_000);
  });
}

export async function emptyTrash(): Promise<number> {
  return sharedWorkspace.mutate((workspace) => {
    const before = workspace.tasks.length;
    workspace.tasks = workspace.tasks.filter((task) => !task.deletedAt);
    return before - workspace.tasks.length;
  });
}

export async function purgeCompletedTasks(): Promise<number> {
  return sharedWorkspace.mutate((workspace) => {
    const before = workspace.tasks.length;
    workspace.tasks = workspace.tasks.filter((task) => !task.completedAt);
    return before - workspace.tasks.length;
  });
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
  await sharedWorkspace.mutate((workspace) => Object.assign(workspace.settings, patch));
}

export async function addTemplate(name: string, draft: TaskDraft): Promise<TaskTemplate> {
  const template: TaskTemplate = {
    createdAt: new Date().toISOString(),
    draft: structuredClone(draft),
    id: createId('template'),
    name: name.trim(),
  };
  await sharedWorkspace.mutate((workspace) => workspace.templates.push(template));
  return template;
}

export async function deleteTemplate(id: string): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    workspace.templates = workspace.templates.filter((template) => template.id !== id);
  });
}

export async function addSavedFilter(
  name: string,
  criteria: SavedFilter['criteria'],
): Promise<SavedFilter> {
  const filter: SavedFilter = {
    createdAt: new Date().toISOString(),
    criteria: structuredClone(criteria),
    id: createId('filter'),
    name: name.trim(),
  };
  await sharedWorkspace.mutate((workspace) => workspace.filters.push(filter));
  return filter;
}

export async function deleteSavedFilter(id: string): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    workspace.filters = workspace.filters.filter((filter) => filter.id !== id);
  });
}

export async function reorderTasks(orderedIds: string[]): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    for (const [order, id] of orderedIds.entries()) {
      const task = workspace.tasks.find((item) => item.id === id);
      if (task) task.order = order;
    }
  });
}

export async function addSection(categoryId: string, name: string): Promise<Section> {
  const section: Section = {
    categoryId,
    createdAt: new Date().toISOString(),
    id: createId('section'),
    name: name.trim(),
    order: 0,
    wipLimit: null,
  };
  await sharedWorkspace.mutate((workspace) => {
    section.order = workspace.sections.filter((item) => item.categoryId === categoryId).length;
    workspace.sections.push(section);
  });
  return section;
}

export async function updateSection(
  id: string,
  patch: Partial<Pick<Section, 'name' | 'order' | 'wipLimit'>>,
): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    Object.assign(requireItem(workspace.sections, id, '分区'), {
      ...patch,
      ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
      ...(patch.wipLimit === undefined
        ? {}
        : { wipLimit: patch.wipLimit === null ? null : Math.max(1, Math.round(patch.wipLimit)) }),
    });
  });
}

export async function deleteSection(id: string): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    for (const task of workspace.tasks) if (task.sectionId === id) task.sectionId = null;
    workspace.sections = workspace.sections.filter((section) => section.id !== id);
  });
}

export async function addHabit(name: string, color = '#3fa27c'): Promise<Habit> {
  const habit: Habit = {
    archivedAt: null,
    color,
    createdAt: new Date().toISOString(),
    frequency: 'daily',
    goalHistory: [],
    id: createId('habit'),
    logs: [],
    name: name.trim(),
    pausedAt: null,
    reminderTime: null,
    skippedDates: [],
    target: 1,
    weekDays: [],
  };
  await sharedWorkspace.mutate((workspace) => workspace.habits.push(habit));
  return habit;
}

export async function toggleHabitLog(id: string, dateKey: string): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    const habit = requireItem(workspace.habits, id, '习惯');
    habit.logs = habit.logs.includes(dateKey)
      ? habit.logs.filter((item) => item !== dateKey)
      : [...habit.logs, dateKey].sort();
  });
}

export async function updateHabit(id: string, patch: HabitPatch): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    const habit = requireItem(workspace.habits, id, '习惯');
    const previousTarget = habit.target;
    const target = patch.target === undefined ? undefined : Math.max(1, Math.round(patch.target));
    Object.assign(habit, {
      ...patch,
      ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
      ...(target === undefined ? {} : { target }),
      ...(target === undefined || previousTarget === target
        ? {}
        : {
            goalHistory: [
              ...(habit.goalHistory ?? []),
              { changedAt: new Date().toISOString(), target },
            ],
          }),
      ...(patch.skippedDates === undefined
        ? {}
        : { skippedDates: [...new Set(patch.skippedDates)].sort() }),
      ...(patch.weekDays === undefined
        ? {}
        : { weekDays: [...new Set(patch.weekDays)].filter((day) => day >= 0 && day <= 6) }),
    });
  });
}

export async function toggleHabitSkip(id: string, dateKey: string): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    const habit = requireItem(workspace.habits, id, '习惯');
    const skipped = habit.skippedDates ?? [];
    habit.skippedDates = skipped.includes(dateKey)
      ? skipped.filter((item) => item !== dateKey)
      : [...skipped, dateKey].sort();
  });
}

export async function deleteHabit(id: string): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    workspace.habits = workspace.habits.filter((habit) => habit.id !== id);
  });
}

export async function addFocusSession(
  session: Omit<FocusSession, 'createdAt' | 'id'>,
): Promise<FocusSession> {
  const record: FocusSession = {
    ...session,
    createdAt: new Date().toISOString(),
    id: createId('focus'),
    interruptions: session.interruptions ?? 0,
    stage: session.stage ?? 1,
  };
  await sharedWorkspace.mutate((workspace) => workspace.focusSessions.push(record));
  return record;
}

export async function addCountdown(title: string, date: string): Promise<Countdown> {
  const countdown: Countdown = {
    color: '#d65f78',
    createdAt: new Date().toISOString(),
    date,
    id: createId('countdown'),
    repeatYearly: false,
    title: title.trim(),
  };
  await sharedWorkspace.mutate((workspace) => workspace.countdowns.push(countdown));
  return countdown;
}

export async function deleteCountdown(id: string): Promise<void> {
  await sharedWorkspace.mutate((workspace) => {
    workspace.countdowns = workspace.countdowns.filter((countdown) => countdown.id !== id);
  });
}
