import type { BackupPayload, Category, Tag, Task, TaskDraft, TaskPatch } from '@easydo/domain';
import { createId } from '@easydo/domain';
import Dexie, { type EntityTable } from 'dexie';

export class EasyDoDatabase extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  tasks!: EntityTable<Task, 'id'>;

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
  }
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
    return;
  }

  const createdAt = new Date().toISOString();
  const today = toLocalDateKey(new Date());
  const tomorrow = toLocalDateKey(new Date(Date.now() + 86_400_000));

  await database.transaction('rw', database.categories, database.tags, database.tasks, async () => {
    await database.categories.bulkAdd([
      { color: '#655fd7', createdAt, id: 'category-work', name: '工作', order: 0 },
      { color: '#3fa27c', createdAt, id: 'category-personal', name: '个人', order: 1 },
      { color: '#df8b4d', createdAt, id: 'category-study', name: '学习', order: 2 },
    ]);
    await database.tags.bulkAdd([
      { color: '#655fd7', createdAt, id: 'tag-focus', name: '专注' },
      { color: '#3fa27c', createdAt, id: 'tag-routine', name: '例行' },
    ]);
    await database.tasks.bulkAdd([
      {
        categoryId: 'category-work',
        completedAt: null,
        createdAt,
        deletedAt: null,
        dueDate: today,
        dueTime: '09:30',
        duration: 45,
        id: createId('task'),
        notes: '双击日历空白处可以快速创建任务.',
        priority: 'high',
        recurrence: null,
        reminderMinutes: 10,
        subtasks: [
          { completedAt: null, id: createId('subtask'), title: '确认今天的截止事项' },
          { completedAt: null, id: createId('subtask'), title: '选出最重要的三项任务' },
        ],
        tagIds: ['tag-focus'],
        title: '规划今天最重要的三件事',
        updatedAt: createdAt,
      },
      {
        categoryId: 'category-personal',
        completedAt: null,
        createdAt,
        deletedAt: null,
        dueDate: today,
        dueTime: '18:30',
        duration: 30,
        id: createId('task'),
        notes: '完成任务后点击左侧圆框.',
        priority: 'medium',
        recurrence: {
          endsOn: null,
          frequency: 'weekdays',
          interval: 1,
          weekDays: [],
        },
        reminderMinutes: null,
        subtasks: [],
        tagIds: ['tag-routine'],
        title: '傍晚散步 30 分钟',
        updatedAt: createdAt,
      },
      {
        categoryId: 'category-study',
        completedAt: null,
        createdAt,
        deletedAt: null,
        dueDate: tomorrow,
        dueTime: null,
        duration: 60,
        id: createId('task'),
        notes: '你可以把日历中的任务拖到其他日期.',
        priority: 'low',
        recurrence: null,
        reminderMinutes: null,
        subtasks: [],
        tagIds: [],
        title: '整理本周学习计划',
        updatedAt: createdAt,
      },
    ]);
  });
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function addTask(draft: TaskDraft, database: EasyDoDatabase = db): Promise<Task> {
  const now = new Date().toISOString();
  const task: Task = {
    ...draft,
    completedAt: null,
    createdAt: now,
    deletedAt: null,
    id: createId('task'),
    title: draft.title.trim(),
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

  async update(id: string, patch: Partial<Task>): Promise<void> {
    await this.database.tasks.update(id, patch);
  }
}

export async function updateCategory(
  id: string,
  patch: Pick<Category, 'color' | 'name'>,
  database: EasyDoDatabase = db,
): Promise<void> {
  await database.categories.update(id, { color: patch.color, name: patch.name.trim() });
}

export async function deleteCategory(
  id: string,
  replacementId: string,
  database: EasyDoDatabase = db,
): Promise<void> {
  if (id === replacementId) {
    throw new Error('替代分类不能与被删除分类相同.');
  }

  await database.transaction('rw', database.categories, database.tasks, async () => {
    await database.tasks.where('categoryId').equals(id).modify({ categoryId: replacementId });
    await database.categories.delete(id);
  });
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
  const [categories, tags, tasks] = await Promise.all([
    database.categories.toArray(),
    database.tags.toArray(),
    database.tasks.toArray(),
  ]);
  return { categories, exportedAt: new Date().toISOString(), tags, tasks, version: 1 };
}

export async function replaceFromBackup(
  payload: BackupPayload,
  database: EasyDoDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.categories, database.tags, database.tasks, async () => {
    await Promise.all([database.categories.clear(), database.tags.clear(), database.tasks.clear()]);
    await database.categories.bulkAdd(payload.categories);
    await database.tags.bulkAdd(payload.tags);
    await database.tasks.bulkAdd(payload.tasks);
  });
}

export async function emptyTrash(database: EasyDoDatabase = db): Promise<number> {
  return database.tasks.where('deletedAt').above('').delete();
}
