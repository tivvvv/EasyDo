import {
  EasyDoDatabase,
  addCategory,
  addSavedFilter,
  addTag,
  addTask,
  addTemplate,
  deleteCategory,
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
  updateCategory,
  updateTag,
  updateSettings,
  updateTask,
} from '@easydo/storage';

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
        categoryId: 'category-work',
        dueDate: '2026-09-01',
        dueTime: '10:30',
        duration: 45,
        endDate: null,
        notes: '测试备注',
        priority: 'high',
        recurrence: null,
        reminderMinutes: null,
        subtasks: [],
        tagIds: ['tag-focus'],
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

  it('更新和删除分类时重新分配关联任务', async () => {
    await initializeDatabase(database);
    await updateCategory('category-work', { color: '#abcdef', name: '新工作' }, database);
    expect(await database.categories.get('category-work')).toMatchObject({
      color: '#abcdef',
      name: '新工作',
    });

    await deleteCategory('category-work', 'category-personal', database);
    expect(await database.categories.get('category-work')).toBeUndefined();
    expect(await database.tasks.where('categoryId').equals('category-work').count()).toBe(0);
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
    const task = (await database.tasks.toArray())[0]!;
    await repository.update(task.id, { title: '仓库更新任务' });
    expect((await repository.get(task.id))?.title).toBe('仓库更新任务');
    const copy = { ...task, id: `task-${crypto.randomUUID()}`, title: '仓库新增任务' };
    await repository.add(copy);
    expect(await repository.get(copy.id)).toBeDefined();
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
        priority: 'all',
        status: 'active',
        tagIds: [],
      },
      database,
    );
    const template = await addTemplate(
      '快速任务',
      {
        categoryId: 'category-work',
        dueDate: null,
        dueTime: null,
        duration: 30,
        endDate: null,
        notes: '',
        priority: 'none',
        recurrence: null,
        reminderMinutes: null,
        subtasks: [],
        tagIds: [],
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
});
