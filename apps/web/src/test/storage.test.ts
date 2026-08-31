import {
  EasyDoDatabase,
  Dexie,
  addCategory,
  addCountdown,
  addFocusSession,
  addFolder,
  addHabit,
  addSavedFilter,
  addSection,
  addTag,
  addTask,
  addTemplate,
  deleteCategory,
  deleteCountdown,
  deleteFolder,
  deleteHabit,
  deleteSavedFilter,
  deleteSection,
  deleteTemplate,
  deleteTag,
  deleteTask,
  DexieTaskRepository,
  DexieActivityRepository,
  emptyTrash,
  exportBackup,
  initializeDatabase,
  replaceFromBackup,
  reorderTasks,
  reorderCategories,
  toggleTask,
  toggleHabitLog,
  updateCategory,
  updateFolder,
  updateHabit,
  updateTag,
  updateSettings,
  updateTask,
} from '@easydo/storage';
import { getLocalTimeZone } from '@easydo/domain';

describe('本地数据仓库', () => {
  let database: EasyDoDatabase;

  beforeEach(() => {
    database = new EasyDoDatabase(`easydo-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('初始化默认分类, 标签和引导任务', async () => {
    await Promise.all([initializeDatabase(database), initializeDatabase(database)]);

    expect(await database.categories.count()).toBe(3);
    expect(await database.tags.count()).toBe(2);
    expect(await database.tasks.count()).toBe(3);
    expect(await database.settings.get('default')).toMatchObject({ agendaDays: 14 });
  });

  it('已有分类时不重复写入引导数据', async () => {
    await database.categories.add({
      color: '#ffffff',
      createdAt: '2026-08-31T00:00:00.000Z',
      folderId: null,
      id: 'category-only',
      name: '唯一分类',
      order: 0,
    });
    await initializeDatabase(database);
    expect(await database.categories.count()).toBe(1);
    expect(await database.tasks.count()).toBe(0);
  });

  it('完整执行任务的创建, 更新, 完成和删除', async () => {
    await initializeDatabase(database);
    const created = await addTask(
      {
        attachments: [],
        allDay: false,
        categoryId: 'category-work',
        dueDate: '2026-09-01',
        dueTime: '10:30',
        duration: 45,
        endDate: null,
        endTime: '11:15',
        important: true,
        kind: 'task',
        notes: '测试备注',
        parentId: null,
        priority: 'high',
        recurrence: null,
        reminderMinutes: null,
        reminders: [],
        sectionId: null,
        subtasks: [],
        tagIds: ['tag-focus'],
        timeZone: getLocalTimeZone(),
        title: '测试任务',
      },
      database,
    );

    await updateTask(created.id, { title: '更新后的任务' }, database);
    expect((await database.tasks.get(created.id))?.title).toBe('更新后的任务');

    await toggleTask(created.id, database);
    expect((await database.tasks.get(created.id))?.completedAt).not.toBeNull();
    await toggleTask(created.id, database);
    expect((await database.tasks.get(created.id))?.completedAt).toBeNull();

    await deleteTask(created.id, database);
    expect(await database.tasks.get(created.id)).toBeUndefined();
  });

  it('创建自定义分类和标签', async () => {
    await initializeDatabase(database);
    const category = await addCategory('副业', '#123456', database);
    const tag = await addTag('深度工作', '#654321', database);

    expect((await database.categories.get(category.id))?.name).toBe('副业');
    expect((await database.tags.get(tag.id))?.name).toBe('深度工作');
  });

  it('创建, 更新和删除分类文件夹时保留分类', async () => {
    await initializeDatabase(database);
    const folder = await addFolder('项目', database);
    await updateCategory(
      'category-work',
      { color: '#655fd7', folderId: folder.id, name: '工作' },
      database,
    );
    await updateFolder(folder.id, '长期项目', database);
    expect(await database.folders.get(folder.id)).toMatchObject({ name: '长期项目' });
    await deleteFolder(folder.id, database);
    expect(await database.folders.get(folder.id)).toBeUndefined();
    expect((await database.categories.get('category-work'))?.folderId).toBeNull();
  });

  it('更新和删除分类时重新分配关联任务', async () => {
    await initializeDatabase(database);
    const section = await addSection('category-work', '待处理', database);
    const task = await database.tasks.where('categoryId').equals('category-work').first();
    if (task) await updateTask(task.id, { sectionId: section.id }, database);
    await updateCategory('category-work', { color: '#abcdef', name: '新工作' }, database);
    expect(await database.categories.get('category-work')).toMatchObject({
      color: '#abcdef',
      name: '新工作',
    });

    await deleteCategory('category-work', 'category-personal', database);
    expect(await database.categories.get('category-work')).toBeUndefined();
    expect(await database.tasks.where('categoryId').equals('category-work').count()).toBe(0);
    expect(await database.sections.where('categoryId').equals('category-work').count()).toBe(0);
    if (task) expect((await database.tasks.get(task.id))?.sectionId).toBeNull();
  });

  it('按指定顺序排列分类', async () => {
    await initializeDatabase(database);
    await reorderCategories(['category-study', 'category-personal', 'category-work'], database);
    expect((await database.categories.orderBy('order').toArray()).map((item) => item.id)).toEqual([
      'category-study',
      'category-personal',
      'category-work',
    ]);
  });

  it('拒绝将分类迁移到自身', async () => {
    await initializeDatabase(database);
    await expect(deleteCategory('category-work', 'category-work', database)).rejects.toThrow(
      '替代分类不能与被删除分类相同.',
    );
  });

  it('通过仓库适配器执行任务读写', async () => {
    await initializeDatabase(database);
    const repository = new DexieTaskRepository(database);
    const task = (await database.tasks.toArray()).find((item) => !item.seriesId)!;
    await repository.update(task.id, { title: '仓库更新任务' });
    expect((await repository.get(task.id))?.title).toBe('仓库更新任务');
    const copy = { ...task, id: `task-${crypto.randomUUID()}`, title: '仓库新增任务' };
    await repository.add(copy);
    expect(await repository.get(copy.id)).toBeDefined();
    expect(await repository.getBySeries(copy.seriesId ?? 'missing')).toEqual([]);
    await repository.delete(copy.id);
    expect(await repository.get(copy.id)).toBeUndefined();
  });

  it('更新和删除标签时清理任务关联', async () => {
    await initializeDatabase(database);
    await updateTag('tag-focus', { color: '#abcdef', name: '新专注' }, database);
    expect(await database.tags.get('tag-focus')).toMatchObject({
      color: '#abcdef',
      name: '新专注',
    });

    await deleteTag('tag-focus', database);
    expect(await database.tags.get('tag-focus')).toBeUndefined();
    expect(
      (await database.tasks.toArray()).every((task) => !task.tagIds.includes('tag-focus')),
    ).toBe(true);
  });

  it('导出并恢复完整备份', async () => {
    await initializeDatabase(database);
    const backup = await exportBackup(database);
    await database.tasks.clear();
    await replaceFromBackup(backup, database);

    expect(await database.tasks.count()).toBe(backup.tasks.length);
    expect(await database.categories.count()).toBe(backup.categories.length);
    expect(await database.tags.count()).toBe(backup.tags.length);
    expect(await database.folders.count()).toBe(backup.folders.length);
    expect((await database.settings.get('default'))?.calendarDensity).toBe('comfortable');
  });

  it('保存日历偏好, 智能清单和任务模板', async () => {
    await initializeDatabase(database);
    await updateSettings({ calendarDensity: 'compact', showWeekends: false }, database);
    const filter = await addSavedFilter(
      '未来工作',
      {
        categoryId: 'category-work',
        dateRange: 'next7',
        kind: 'all',
        priority: 'all',
        status: 'active',
        tagIds: [],
      },
      database,
    );
    const template = await addTemplate(
      '快速任务',
      {
        attachments: [],
        allDay: true,
        categoryId: 'category-work',
        dueDate: null,
        dueTime: null,
        duration: 30,
        endDate: null,
        endTime: null,
        important: false,
        kind: 'task',
        notes: '',
        parentId: null,
        priority: 'none',
        recurrence: null,
        reminderMinutes: null,
        reminders: [],
        sectionId: null,
        subtasks: [],
        tagIds: [],
        timeZone: getLocalTimeZone(),
        title: '模板任务',
      },
      database,
    );
    expect(await database.settings.get('default')).toMatchObject({
      calendarDensity: 'compact',
      showWeekends: false,
    });
    expect(await database.filters.get(filter.id)).toBeDefined();
    expect(await database.templates.get(template.id)).toBeDefined();
    await deleteSavedFilter(filter.id, database);
    await deleteTemplate(template.id, database);
    expect(await database.filters.get(filter.id)).toBeUndefined();
    expect(await database.templates.get(template.id)).toBeUndefined();
  });

  it('管理分区, 习惯, 专注记录和倒数日并纳入备份', async () => {
    await initializeDatabase(database);
    const section = await addSection('category-work', '进行中', database);
    const task = (await database.tasks.where('categoryId').equals('category-work').first())!;
    await updateTask(task.id, { sectionId: section.id }, database);
    const habit = await addHabit('每日阅读', '#3fa27c', database);
    await toggleHabitLog(habit.id, '2026-08-31', database);
    const focus = await addFocusSession(
      {
        durationMinutes: 25,
        endedAt: '2026-08-31T01:25:00.000Z',
        mode: 'pomodoro',
        startedAt: '2026-08-31T01:00:00.000Z',
        taskId: task.id,
      },
      database,
    );
    const countdown = await addCountdown('项目发布', '2026-09-30', database);
    const backup = await exportBackup(database);
    expect(backup).toMatchObject({
      countdowns: [{ id: countdown.id, title: '项目发布' }],
      focusSessions: [{ id: focus.id, durationMinutes: 25 }],
      habits: [{ id: habit.id, logs: ['2026-08-31'] }],
      sections: [{ id: section.id, name: '进行中' }],
      version: 4,
    });

    await deleteSection(section.id, database);
    expect((await database.tasks.get(task.id))?.sectionId).toBeNull();
    await deleteHabit(habit.id, database);
    await deleteCountdown(countdown.id, database);
    expect(await database.habits.count()).toBe(0);
    expect(await database.countdowns.count()).toBe(0);
  });

  it('从 1.2 数据库迁移任务, 设置, 筛选和模板', async () => {
    const name = `easydo-migration-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(3).stores({
      activities: 'id, action, createdAt, groupId, taskId',
      categories: 'id, order, name',
      filters: 'id, createdAt, name',
      settings: 'id',
      tags: 'id, name',
      tasks:
        'id, dueDate, dueTime, endDate, categoryId, completedAt, deletedAt, priority, order, createdAt, *tagIds',
      templates: 'id, createdAt, name',
    });
    await legacy.open();
    const legacyDraft = {
      categoryId: 'category-old',
      dueDate: '2026-08-31',
      dueTime: '09:00',
      duration: 30,
      endDate: null,
      notes: '',
      priority: 'none',
      recurrence: { endsOn: null, frequency: 'daily', interval: 1, weekDays: [] },
      reminderMinutes: 10,
      subtasks: [{ completedAt: null, id: 'subtask-old', title: '旧步骤' }],
      tagIds: [],
      title: '旧任务',
    };
    const legacyTask = {
      ...legacyDraft,
      completedAt: null,
      createdAt: '2026-08-31T00:00:00.000Z',
      deletedAt: null,
      id: 'task-old',
      order: 0,
      updatedAt: '2026-08-31T00:00:00.000Z',
    };
    await legacy.table('categories').put({
      color: '#fff',
      createdAt: legacyTask.createdAt,
      id: 'category-old',
      name: '旧分类',
      order: 0,
    });
    await legacy.table('tasks').put(legacyTask);
    await legacy.table('filters').put({
      createdAt: legacyTask.createdAt,
      criteria: {
        categoryId: null,
        dateRange: 'all',
        priority: 'all',
        status: 'active',
        tagIds: [],
      },
      id: 'filter-old',
      name: '旧筛选',
    });
    await legacy.table('settings').put({
      agendaDays: 14,
      calendarDensity: 'comfortable',
      id: 'default',
      showWeekends: true,
      workdayEnd: 22,
      workdayStart: 7,
    });
    await legacy.table('templates').put({
      createdAt: legacyTask.createdAt,
      draft: legacyDraft,
      id: 'template-old',
      name: '旧模板',
    });
    await legacy.table('activities').put({
      action: 'update',
      after: legacyTask,
      before: legacyTask,
      createdAt: legacyTask.createdAt,
      groupId: 'group-old',
      id: 'activity-old',
      taskId: legacyTask.id,
    });
    legacy.close();

    const upgraded = new EasyDoDatabase(name);
    await upgraded.open();
    expect(await upgraded.tasks.get('task-old')).toMatchObject({
      allDay: false,
      attachments: [],
      endTime: '09:30',
      important: false,
      kind: 'task',
      reminders: [expect.objectContaining({ offsetMinutes: 10 })],
      sectionId: null,
    });
    expect((await upgraded.tasks.get('task-old'))?.subtasks[0]).toMatchObject({
      notes: '',
      priority: 'none',
    });
    expect((await upgraded.filters.get('filter-old'))?.criteria.kind).toBe('all');
    expect(await upgraded.settings.get('default')).toMatchObject({
      taskSort: 'manual',
      theme: 'system',
    });
    expect((await upgraded.templates.get('template-old'))?.draft.kind).toBe('task');
    expect((await upgraded.activities.get('activity-old'))?.after?.kind).toBe('task');
    expect(await upgraded.sections.count()).toBe(0);
    expect(await upgraded.habits.count()).toBe(0);
    await upgraded.delete();
  });

  it('重排任务并读写操作记录', async () => {
    await initializeDatabase(database);
    const tasks = await database.tasks.orderBy('order').toArray();
    await reorderTasks(tasks.map((task) => task.id).reverse(), database);
    expect((await database.tasks.orderBy('order').first())?.id).toBe(tasks.at(-1)?.id);
    const activities = new DexieActivityRepository(database);
    const activity = {
      action: 'update' as const,
      after: tasks[0]!,
      before: tasks[0]!,
      createdAt: new Date().toISOString(),
      groupId: 'group-1',
      id: 'activity-1',
      taskId: tasks[0]!.id,
    };
    await activities.add(activity);
    expect((await activities.getLatest())?.id).toBe(activity.id);
    expect(await activities.getByGroup('group-1')).toHaveLength(1);
    await activities.delete(activity.id);
    expect(await activities.getLatest()).toBeUndefined();
  });

  it('仅永久清理回收站任务', async () => {
    await initializeDatabase(database);
    const [first, second] = await database.tasks.toArray();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    await database.tasks.update(first!.id, { deletedAt: new Date().toISOString() });

    expect(await emptyTrash(database)).toBe(1);
    expect(await database.tasks.get(first!.id)).toBeUndefined();
    expect(await database.tasks.get(second!.id)).toBeDefined();
  });

  it('更新习惯目标并规范化周期配置', async () => {
    const habit = await addHabit('阅读', '#3fa27c', database);
    await updateHabit(
      habit.id,
      { frequency: 'weekly', name: ' 每周阅读 ', target: 2.6, weekDays: [1, 3, 3, 8] },
      database,
    );

    expect(await database.habits.get(habit.id)).toMatchObject({
      frequency: 'weekly',
      name: '每周阅读',
      target: 3,
      weekDays: [1, 3],
    });
  });
});
