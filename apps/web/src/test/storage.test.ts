import {
  EasyDoDatabase,
  addCategory,
  addTag,
  addTask,
  deleteTask,
  initializeDatabase,
  toggleTask,
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
  });

  it('完整执行任务的创建, 更新, 完成和删除', async () => {
    await initializeDatabase(database);
    const created = await addTask(
      {
        categoryId: 'category-work',
        dueDate: '2026-09-01',
        dueTime: '10:30',
        duration: 45,
        notes: '测试备注',
        priority: 'high',
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
});
