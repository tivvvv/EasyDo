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
  SavedFilter,
  Section,
  Tag,
  Task,
  TaskDraft,
  TaskPatch,
  TaskTemplate,
} from '@easydo/domain';
import {
  createId,
  createRecurrenceRule,
  createReminder,
  createSubtask,
  defaultAppSettings,
  getLocalTimeZone,
} from '@easydo/domain';
import Dexie, { type EntityTable } from 'dexie';

export { default as Dexie } from 'dexie';

export class EasyDoDatabase extends Dexie {
  activities!: EntityTable<ActivityRecord, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  countdowns!: EntityTable<Countdown, 'id'>;
  filters!: EntityTable<SavedFilter, 'id'>;
  focusSessions!: EntityTable<FocusSession, 'id'>;
  folders!: EntityTable<Folder, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  sections!: EntityTable<Section, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  templates!: EntityTable<TaskTemplate, 'id'>;

  constructor(name = 'easydo') {
    super(name);
    this.version(1).stores({
      categories: 'id, order, name',
      tags: 'id, name',
      tasks: 'id, dueDate, categoryId, completedAt, priority, createdAt, *tagIds',
    });
    this.version(2)
      .stores({
        categories: 'id, order, name',
        tags: 'id, name',
        tasks:
          'id, dueDate, dueTime, categoryId, completedAt, deletedAt, priority, createdAt, *tagIds',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<Task>('tasks')
          .toCollection()
          .modify((task) => {
            task.deletedAt ??= null;
            task.recurrence ??= null;
            task.reminderMinutes ??= null;
            task.subtasks ??= [];
          });
      });
    this.version(5)
      .stores({
        activities: 'id, action, createdAt, groupId, taskId',
        categories: 'id, folderId, order, name',
        countdowns: 'id, date, title',
        filters: 'id, createdAt, name',
        focusSessions: 'id, createdAt, startedAt, taskId',
        folders: 'id, order, name',
        habits: 'id, archivedAt, createdAt, name, *logs',
        sections: 'id, categoryId, order, name',
        settings: 'id',
        tags: 'id, name',
        tasks:
          'id, dueDate, dueTime, endDate, categoryId, completedAt, deletedAt, important, kind, order, parentId, priority, sectionId, seriesId, createdAt, *tagIds',
        templates: 'id, createdAt, name',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<Task>('tasks')
          .toCollection()
          .modify((task) => {
            upgradeTask(task);
          });
        await transaction
          .table<TaskTemplate>('templates')
          .toCollection()
          .modify((template) => {
            template.draft = upgradeDraft(template.draft);
          });
        await transaction
          .table<ActivityRecord>('activities')
          .toCollection()
          .modify((activity) => {
            if (activity.before) upgradeTask(activity.before);
            if (activity.after) upgradeTask(activity.after);
          });
        await transaction
          .table<AppSettings>('settings')
          .toCollection()
          .modify((settings) => {
            Object.assign(settings, normalizeSettings(settings));
          });
      });
    this.version(3)
      .stores({
        activities: 'id, action, createdAt, groupId, taskId',
        categories: 'id, order, name',
        filters: 'id, createdAt, name',
        settings: 'id',
        tags: 'id, name',
        tasks:
          'id, dueDate, dueTime, endDate, categoryId, completedAt, deletedAt, priority, order, createdAt, *tagIds',
        templates: 'id, createdAt, name',
      })
      .upgrade(async (transaction) => {
        let order = 0;
        await transaction
          .table<Task>('tasks')
          .toCollection()
          .modify((task) => {
            task.endDate ??= null;
            task.order ??= order;
            order += 1;
          });
      });
    this.version(4)
      .stores({
        activities: 'id, action, createdAt, groupId, taskId',
        categories: 'id, folderId, order, name',
        filters: 'id, createdAt, name',
        folders: 'id, order, name',
        settings: 'id',
        tags: 'id, name',
        tasks:
          'id, dueDate, dueTime, endDate, categoryId, completedAt, deletedAt, kind, order, parentId, priority, seriesId, createdAt, *tagIds',
        templates: 'id, createdAt, name',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<Task>('tasks')
          .toCollection()
          .modify((task) => {
            upgradeTask(task);
          });
        await transaction
          .table<Category>('categories')
          .toCollection()
          .modify((category) => {
            category.folderId ??= null;
          });
        await transaction
          .table<SavedFilter>('filters')
          .toCollection()
          .modify((filter) => {
            filter.criteria.kind ??= 'all';
          });
        await transaction
          .table<AppSettings>('settings')
          .toCollection()
          .modify((settings) => {
            Object.assign(settings, normalizeSettings(settings));
          });
        await transaction
          .table<TaskTemplate>('templates')
          .toCollection()
          .modify((template) => {
            template.draft = upgradeDraft(template.draft);
          });
        await transaction
          .table<ActivityRecord>('activities')
          .toCollection()
          .modify((activity) => {
            if (activity.before) upgradeTask(activity.before);
            if (activity.after) upgradeTask(activity.after);
          });
      });
  }
}

function upgradeTask(task: Task): Task {
  task.attachments ??= [];
  task.allDay ??= !task.dueTime;
  task.endTime ??= task.dueTime ? addMinutesToTime(task.dueTime, task.duration) : null;
  task.kind ??= 'task';
  task.important ??= task.priority === 'high';
  task.parentId ??= null;
  task.reminders ??=
    task.reminderMinutes === null || task.reminderMinutes === undefined
      ? []
      : [createReminder(task.reminderMinutes)];
  task.seriesId ??= task.recurrence ? createId('series') : null;
  task.sectionId ??= null;
  task.timeZone ??= getLocalTimeZone();
  task.subtasks = task.subtasks.map((subtask) => ({
    ...createSubtask(subtask.title),
    ...subtask,
    tagIds: subtask.tagIds ?? [],
  }));
  if (task.recurrence) {
    task.recurrence = {
      ...createRecurrenceRule(task.recurrence.frequency),
      ...task.recurrence,
      excludedDates: task.recurrence.excludedDates ?? [],
    };
  }
  return task;
}

function upgradeDraft(draft: TaskDraft): TaskDraft {
  const reminderMinutes = draft.reminderMinutes ?? null;
  return {
    ...draft,
    attachments: draft.attachments ?? [],
    allDay: draft.allDay ?? !draft.dueTime,
    endTime:
      draft.endTime ?? (draft.dueTime ? addMinutesToTime(draft.dueTime, draft.duration) : null),
    kind: draft.kind ?? 'task',
    important: draft.important ?? draft.priority === 'high',
    parentId: draft.parentId ?? null,
    recurrence: draft.recurrence
      ? {
          ...createRecurrenceRule(draft.recurrence.frequency),
          ...draft.recurrence,
          excludedDates: draft.recurrence.excludedDates ?? [],
        }
      : null,
    reminderMinutes,
    reminders:
      draft.reminders ?? (reminderMinutes === null ? [] : [createReminder(reminderMinutes)]),
    subtasks: draft.subtasks.map((subtask) => ({
      ...createSubtask(subtask.title),
      ...subtask,
      tagIds: subtask.tagIds ?? [],
    })),
    sectionId: draft.sectionId ?? null,
    timeZone: draft.timeZone ?? getLocalTimeZone(),
  };
}

function normalizeSettings(settings: AppSettings): AppSettings {
  return { ...defaultAppSettings, ...settings };
}

function addMinutesToTime(time: string, duration: number): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const total = (hours * 60 + minutes + duration) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export const db = new EasyDoDatabase();
const initializationPromises = new WeakMap<EasyDoDatabase, Promise<void>>();

export function initializeDatabase(database: EasyDoDatabase = db): Promise<void> {
  const pending = initializationPromises.get(database);

  if (pending) {
    return pending;
  }

  const initialization = seedDatabase(database).catch((error: unknown) => {
    initializationPromises.delete(database);
    throw error;
  });
  initializationPromises.set(database, initialization);
  return initialization;
}

async function seedDatabase(database: EasyDoDatabase): Promise<void> {
  const hasCategories = (await database.categories.count()) > 0;

  if (hasCategories) {
    if (!(await database.settings.get('default'))) {
      await database.settings.put({ ...defaultAppSettings });
    }
    return;
  }

  const createdAt = new Date().toISOString();
  const today = toLocalDateKey(new Date());
  const tomorrow = toLocalDateKey(new Date(Date.now() + 86_400_000));

  await database.transaction(
    'rw',
    database.categories,
    database.settings,
    database.tags,
    database.tasks,
    async () => {
      await database.settings.put({ ...defaultAppSettings });
      await database.categories.bulkAdd([
        {
          color: '#655fd7',
          createdAt,
          folderId: null,
          id: 'category-work',
          name: '工作',
          order: 0,
        },
        {
          color: '#3fa27c',
          createdAt,
          folderId: null,
          id: 'category-personal',
          name: '个人',
          order: 1,
        },
        {
          color: '#df8b4d',
          createdAt,
          folderId: null,
          id: 'category-study',
          name: '学习',
          order: 2,
        },
      ]);
      await database.tags.bulkAdd([
        { color: '#655fd7', createdAt, id: 'tag-focus', name: '专注' },
        { color: '#3fa27c', createdAt, id: 'tag-routine', name: '例行' },
      ]);
      await database.tasks.bulkAdd([
        {
          attachments: [],
          allDay: false,
          categoryId: 'category-work',
          completedAt: null,
          createdAt,
          deletedAt: null,
          dueDate: today,
          dueTime: '09:30',
          duration: 45,
          endDate: null,
          endTime: '10:15',
          id: createId('task'),
          important: true,
          kind: 'task',
          notes: '双击日历空白处可以快速创建任务.',
          order: 0,
          parentId: null,
          priority: 'high',
          recurrence: null,
          reminderMinutes: 10,
          reminders: [createReminder(10)],
          seriesId: null,
          sectionId: null,
          subtasks: [createSubtask('确认今天的截止事项'), createSubtask('选出最重要的三项任务')],
          tagIds: ['tag-focus'],
          timeZone: getLocalTimeZone(),
          title: '规划今天最重要的三件事',
          updatedAt: createdAt,
        },
        {
          attachments: [],
          allDay: false,
          categoryId: 'category-personal',
          completedAt: null,
          createdAt,
          deletedAt: null,
          dueDate: today,
          dueTime: '18:30',
          duration: 30,
          endDate: null,
          endTime: '19:00',
          id: createId('task'),
          important: false,
          kind: 'task',
          notes: '完成任务后点击左侧圆框.',
          order: 1,
          parentId: null,
          priority: 'medium',
          recurrence: createRecurrenceRule('weekdays'),
          reminderMinutes: null,
          reminders: [],
          seriesId: createId('series'),
          sectionId: null,
          subtasks: [],
          tagIds: ['tag-routine'],
          timeZone: getLocalTimeZone(),
          title: '傍晚散步 30 分钟',
          updatedAt: createdAt,
        },
        {
          attachments: [],
          allDay: true,
          categoryId: 'category-study',
          completedAt: null,
          createdAt,
          deletedAt: null,
          dueDate: tomorrow,
          dueTime: null,
          duration: 60,
          endDate: null,
          endTime: null,
          id: createId('task'),
          important: false,
          kind: 'task',
          notes: '你可以把日历中的任务拖到其他日期.',
          order: 2,
          parentId: null,
          priority: 'low',
          recurrence: null,
          reminderMinutes: null,
          reminders: [],
          seriesId: null,
          sectionId: null,
          subtasks: [],
          tagIds: [],
          timeZone: getLocalTimeZone(),
          title: '整理本周学习计划',
          updatedAt: createdAt,
        },
      ]);
    },
  );
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function addTask(draft: TaskDraft, database: EasyDoDatabase = db): Promise<Task> {
  const now = new Date().toISOString();
  const normalized = upgradeDraft(draft);
  const task: Task = {
    ...normalized,
    completedAt: null,
    createdAt: now,
    deletedAt: null,
    id: createId('task'),
    order: await database.tasks.count(),
    seriesId: normalized.recurrence ? createId('series') : null,
    title: normalized.title.trim(),
    updatedAt: now,
  };

  await database.tasks.add(task);
  return task;
}

export async function updateTask(
  id: string,
  patch: TaskPatch,
  database: EasyDoDatabase = db,
): Promise<void> {
  await database.tasks.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

export async function toggleTask(id: string, database: EasyDoDatabase = db): Promise<void> {
  const task = await database.tasks.get(id);

  if (!task) {
    return;
  }

  await database.tasks.update(id, {
    completedAt: task.completedAt ? null : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteTask(id: string, database: EasyDoDatabase = db): Promise<void> {
  await database.tasks.delete(id);
}

export async function addCategory(
  name: string,
  color: string,
  database: EasyDoDatabase = db,
): Promise<Category> {
  const category: Category = {
    color,
    createdAt: new Date().toISOString(),
    folderId: null,
    id: createId('category'),
    name: name.trim(),
    order: await database.categories.count(),
  };

  await database.categories.add(category);
  return category;
}

export async function addTag(
  name: string,
  color: string,
  database: EasyDoDatabase = db,
): Promise<Tag> {
  const tag: Tag = {
    color,
    createdAt: new Date().toISOString(),
    id: createId('tag'),
    name: name.trim(),
  };

  await database.tags.add(tag);
  return tag;
}

export class DexieTaskRepository {
  constructor(private readonly database: EasyDoDatabase = db) {}

  async add(task: Task): Promise<void> {
    await this.database.tasks.add(task);
  }

  async delete(id: string): Promise<void> {
    await this.database.tasks.delete(id);
  }

  async get(id: string): Promise<Task | undefined> {
    return this.database.tasks.get(id);
  }

  async getBySeries(seriesId: string): Promise<Task[]> {
    return this.database.tasks.where('seriesId').equals(seriesId).toArray();
  }

  async update(id: string, patch: Partial<Task>): Promise<void> {
    await this.database.tasks.update(id, patch);
  }
}

export class DexieActivityRepository {
  constructor(private readonly database: EasyDoDatabase = db) {}

  async add(activity: ActivityRecord): Promise<void> {
    await this.database.activities.add(activity);
  }

  async delete(id: string): Promise<void> {
    await this.database.activities.delete(id);
  }

  async getByGroup(groupId: string): Promise<ActivityRecord[]> {
    return this.database.activities.where('groupId').equals(groupId).toArray();
  }

  async getLatest(): Promise<ActivityRecord | undefined> {
    return this.database.activities.orderBy('createdAt').last();
  }
}

export async function updateCategory(
  id: string,
  patch: Pick<Category, 'color' | 'name'> & Partial<Pick<Category, 'folderId'>>,
  database: EasyDoDatabase = db,
): Promise<void> {
  await database.categories.update(id, {
    color: patch.color,
    ...(patch.folderId === undefined ? {} : { folderId: patch.folderId }),
    name: patch.name.trim(),
  });
}

export async function addFolder(name: string, database: EasyDoDatabase = db): Promise<Folder> {
  const folder: Folder = {
    createdAt: new Date().toISOString(),
    id: createId('folder'),
    name: name.trim(),
    order: await database.folders.count(),
  };
  await database.folders.add(folder);
  return folder;
}

export async function updateFolder(
  id: string,
  name: string,
  database: EasyDoDatabase = db,
): Promise<void> {
  await database.folders.update(id, { name: name.trim() });
}

export async function deleteFolder(id: string, database: EasyDoDatabase = db): Promise<void> {
  await database.transaction('rw', database.categories, database.folders, async () => {
    await database.categories.where('folderId').equals(id).modify({ folderId: null });
    await database.folders.delete(id);
  });
}

export async function deleteCategory(
  id: string,
  replacementId: string,
  database: EasyDoDatabase = db,
): Promise<void> {
  if (id === replacementId) {
    throw new Error('替代分类不能与被删除分类相同.');
  }

  await database.transaction(
    'rw',
    database.categories,
    database.sections,
    database.tasks,
    async () => {
      await database.tasks
        .where('categoryId')
        .equals(id)
        .modify({ categoryId: replacementId, sectionId: null });
      await database.sections.where('categoryId').equals(id).delete();
      await database.categories.delete(id);
    },
  );
}

export async function updateTag(
  id: string,
  patch: Pick<Tag, 'color' | 'name'>,
  database: EasyDoDatabase = db,
): Promise<void> {
  await database.tags.update(id, { color: patch.color, name: patch.name.trim() });
}

export async function deleteTag(id: string, database: EasyDoDatabase = db): Promise<void> {
  await database.transaction('rw', database.tags, database.tasks, async () => {
    await database.tasks
      .where('tagIds')
      .equals(id)
      .modify((task) => {
        task.tagIds = task.tagIds.filter((tagId) => tagId !== id);
      });
    await database.tags.delete(id);
  });
}

export async function reorderCategories(
  orderedIds: string[],
  database: EasyDoDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.categories, async () => {
    await Promise.all(orderedIds.map((id, order) => database.categories.update(id, { order })));
  });
}

export async function exportBackup(database: EasyDoDatabase = db): Promise<BackupPayload> {
  const [
    activities,
    categories,
    countdowns,
    filters,
    focusSessions,
    folders,
    habits,
    sections,
    settings,
    tags,
    tasks,
    templates,
  ] = await Promise.all([
    database.activities.toArray(),
    database.categories.toArray(),
    database.countdowns.toArray(),
    database.filters.toArray(),
    database.focusSessions.toArray(),
    database.folders.toArray(),
    database.habits.toArray(),
    database.sections.toArray(),
    database.settings.get('default'),
    database.tags.toArray(),
    database.tasks.toArray(),
    database.templates.toArray(),
  ]);
  return {
    activities,
    categories,
    countdowns,
    exportedAt: new Date().toISOString(),
    filters,
    focusSessions,
    folders,
    habits,
    settings: settings ?? { ...defaultAppSettings },
    sections,
    tags,
    tasks,
    templates,
    version: 4,
  };
}

export async function replaceFromBackup(
  payload: BackupPayload,
  database: EasyDoDatabase = db,
): Promise<void> {
  await database.transaction(
    'rw',
    [
      database.activities,
      database.categories,
      database.countdowns,
      database.filters,
      database.focusSessions,
      database.folders,
      database.habits,
      database.sections,
      database.settings,
      database.tags,
      database.tasks,
      database.templates,
    ],
    async () => {
      await Promise.all([
        database.activities.clear(),
        database.categories.clear(),
        database.countdowns.clear(),
        database.filters.clear(),
        database.focusSessions.clear(),
        database.folders.clear(),
        database.habits.clear(),
        database.sections.clear(),
        database.settings.clear(),
        database.tags.clear(),
        database.tasks.clear(),
        database.templates.clear(),
      ]);
      await database.activities.bulkAdd(payload.activities);
      await database.categories.bulkAdd(payload.categories);
      await database.countdowns.bulkAdd(payload.countdowns);
      await database.filters.bulkAdd(payload.filters);
      await database.focusSessions.bulkAdd(payload.focusSessions);
      await database.folders.bulkAdd(payload.folders);
      await database.habits.bulkAdd(payload.habits);
      await database.sections.bulkAdd(payload.sections);
      await database.settings.put(payload.settings);
      await database.tags.bulkAdd(payload.tags);
      await database.tasks.bulkAdd(payload.tasks);
      await database.templates.bulkAdd(payload.templates);
    },
  );
}

export async function emptyTrash(database: EasyDoDatabase = db): Promise<number> {
  return database.tasks.where('deletedAt').above('').delete();
}

export async function updateSettings(
  patch: Partial<Omit<AppSettings, 'id'>>,
  database: EasyDoDatabase = db,
): Promise<void> {
  await database.settings.update('default', patch);
}

export async function addTemplate(
  name: string,
  draft: TaskDraft,
  database: EasyDoDatabase = db,
): Promise<TaskTemplate> {
  const template: TaskTemplate = {
    createdAt: new Date().toISOString(),
    draft: upgradeDraft(draft),
    id: createId('template'),
    name: name.trim(),
  };
  await database.templates.add(template);
  return template;
}

export async function deleteTemplate(id: string, database: EasyDoDatabase = db): Promise<void> {
  await database.templates.delete(id);
}

export async function addSavedFilter(
  name: string,
  criteria: SavedFilter['criteria'],
  database: EasyDoDatabase = db,
): Promise<SavedFilter> {
  const filter: SavedFilter = {
    createdAt: new Date().toISOString(),
    criteria,
    id: createId('filter'),
    name: name.trim(),
  };
  await database.filters.add(filter);
  return filter;
}

export async function deleteSavedFilter(id: string, database: EasyDoDatabase = db): Promise<void> {
  await database.filters.delete(id);
}

export async function reorderTasks(
  orderedIds: string[],
  database: EasyDoDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.tasks, async () => {
    await Promise.all(orderedIds.map((id, order) => database.tasks.update(id, { order })));
  });
}

export async function addSection(
  categoryId: string,
  name: string,
  database: EasyDoDatabase = db,
): Promise<Section> {
  const section: Section = {
    categoryId,
    createdAt: new Date().toISOString(),
    id: createId('section'),
    name: name.trim(),
    order: await database.sections.where('categoryId').equals(categoryId).count(),
  };
  await database.sections.add(section);
  return section;
}

export async function deleteSection(id: string, database: EasyDoDatabase = db): Promise<void> {
  await database.transaction('rw', database.sections, database.tasks, async () => {
    await database.tasks.where('sectionId').equals(id).modify({ sectionId: null });
    await database.sections.delete(id);
  });
}

export async function addHabit(
  name: string,
  color = '#3fa27c',
  database: EasyDoDatabase = db,
): Promise<Habit> {
  const habit: Habit = {
    archivedAt: null,
    color,
    createdAt: new Date().toISOString(),
    frequency: 'daily',
    id: createId('habit'),
    logs: [],
    name: name.trim(),
    target: 1,
    weekDays: [],
  };
  await database.habits.add(habit);
  return habit;
}

export async function toggleHabitLog(
  id: string,
  dateKey: string,
  database: EasyDoDatabase = db,
): Promise<void> {
  const habit = await database.habits.get(id);
  if (!habit) return;
  await database.habits.update(id, {
    logs: habit.logs.includes(dateKey)
      ? habit.logs.filter((item) => item !== dateKey)
      : [...habit.logs, dateKey],
  });
}

export async function updateHabit(
  id: string,
  patch: HabitPatch,
  database: EasyDoDatabase = db,
): Promise<void> {
  const normalized: HabitPatch = {
    ...patch,
    ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
    ...(patch.target === undefined ? {} : { target: Math.max(1, Math.round(patch.target)) }),
    ...(patch.weekDays === undefined
      ? {}
      : { weekDays: [...new Set(patch.weekDays)].filter((day) => day >= 0 && day <= 6) }),
  };
  await database.habits.update(id, normalized);
}

export async function deleteHabit(id: string, database: EasyDoDatabase = db): Promise<void> {
  await database.habits.delete(id);
}

export async function addFocusSession(
  session: Omit<FocusSession, 'createdAt' | 'id'>,
  database: EasyDoDatabase = db,
): Promise<FocusSession> {
  const record: FocusSession = {
    ...session,
    createdAt: new Date().toISOString(),
    id: createId('focus'),
  };
  await database.focusSessions.add(record);
  return record;
}

export async function addCountdown(
  title: string,
  date: string,
  database: EasyDoDatabase = db,
): Promise<Countdown> {
  const countdown: Countdown = {
    color: '#d65f78',
    createdAt: new Date().toISOString(),
    date,
    id: createId('countdown'),
    repeatYearly: false,
    title: title.trim(),
  };
  await database.countdowns.add(countdown);
  return countdown;
}

export async function deleteCountdown(id: string, database: EasyDoDatabase = db): Promise<void> {
  await database.countdowns.delete(id);
}
