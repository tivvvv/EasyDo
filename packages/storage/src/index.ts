import type { Category, Tag, Task, TaskDraft, TaskPatch } from '@easydo/domain';
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
        dueDate: today,
        dueTime: '09:30',
        duration: 45,
        id: createId('task'),
        notes: '双击日历空白处可以快速创建任务.',
        priority: 'high',
        tagIds: ['tag-focus'],
        title: '规划今天最重要的三件事',
        updatedAt: createdAt,
      },
      {
        categoryId: 'category-personal',
        completedAt: null,
        createdAt,
        dueDate: today,
        dueTime: '18:30',
        duration: 30,
        id: createId('task'),
        notes: '完成任务后点击左侧圆框.',
        priority: 'medium',
        tagIds: ['tag-routine'],
        title: '傍晚散步 30 分钟',
        updatedAt: createdAt,
      },
      {
        categoryId: 'category-study',
        completedAt: null,
        createdAt,
        dueDate: tomorrow,
        dueTime: null,
        duration: 60,
        id: createId('task'),
        notes: '你可以把日历中的任务拖到其他日期.',
        priority: 'low',
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
