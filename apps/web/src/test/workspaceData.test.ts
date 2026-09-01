import { parseBackup } from '@easydo/application';

import { createInitialWorkspace, mergeWorkspaces } from '../lib/workspaceData';

describe('共享工作区数据', () => {
  const now = new Date('2026-09-01T08:00:00.000Z');

  it('创建符合备份规范的初始数据', () => {
    const workspace = createInitialWorkspace(now);

    expect(parseBackup(JSON.stringify(workspace))).toEqual(workspace);
    expect(workspace.categories.map((category) => category.name)).toEqual(['工作', '个人', '学习']);
    expect(workspace.tasks).toHaveLength(3);
    expect(workspace.tasks[0]?.updatedAt).toBe(now.toISOString());
    expect(workspace.tasks[1]?.recurrence?.frequency).toBe('weekdays');
  });

  it('为1.10旧任务安全补充评论数据', () => {
    const workspace = createInitialWorkspace(now);
    const legacyTask = workspace.tasks[0] as TaskWithoutComments;
    delete legacyTask.comments;

    const migrated = parseBackup(JSON.stringify(workspace));

    expect(migrated.tasks[0]?.comments).toEqual([]);
  });

  it('保留两个旧数据源中的独立任务并选择更新版本', () => {
    const desktop = createInitialWorkspace(now);
    const browser = structuredClone(desktop);
    const sharedId = desktop.tasks[0]!.id;
    browser.tasks[0] = {
      ...browser.tasks[0]!,
      title: '浏览器中的更新标题',
      updatedAt: '2026-09-01T09:00:00.000Z',
    };
    browser.tasks.push({
      ...browser.tasks[1]!,
      id: 'browser-only-task',
      title: '仅存在于网页端的任务',
    });

    const merged = mergeWorkspaces(desktop, browser);

    expect(merged.tasks.find((task) => task.id === sharedId)?.title).toBe('浏览器中的更新标题');
    expect(merged.tasks.find((task) => task.id === 'browser-only-task')?.title).toBe(
      '仅存在于网页端的任务',
    );
    expect(desktop.tasks[0]?.title).not.toBe('浏览器中的更新标题');
  });

  it('合并习惯记录, 跳过日期和目标历史', () => {
    const desktop = createInitialWorkspace(now);
    const browser = createInitialWorkspace(now);
    const baseHabit = {
      archivedAt: null,
      color: '#3fa27c',
      createdAt: '2026-08-01T00:00:00.000Z',
      frequency: 'daily' as const,
      id: 'habit-shared',
      name: '喝水',
      pausedAt: null,
      reminderTime: null,
      target: 1,
      weekDays: [],
    };
    desktop.habits = [
      {
        ...baseHabit,
        goalHistory: [{ changedAt: '2026-08-02T00:00:00.000Z', target: 2 }],
        logs: ['2026-08-30'],
        skippedDates: ['2026-08-31'],
      },
    ];
    browser.habits = [
      {
        ...baseHabit,
        goalHistory: [{ changedAt: '2026-08-03T00:00:00.000Z', target: 3 }],
        logs: ['2026-08-30', '2026-09-01'],
        skippedDates: ['2026-08-29'],
      },
    ];

    const habit = mergeWorkspaces(desktop, browser).habits[0]!;

    expect(habit.logs).toEqual(['2026-08-30', '2026-09-01']);
    expect(habit.skippedDates).toEqual(['2026-08-29', '2026-08-31']);
    expect(habit.goalHistory?.map((item) => item.target)).toEqual([2, 3]);
  });

  it('保留权威数据源设置并接纳另一个来源的独立分类', () => {
    const desktop = createInitialWorkspace(now);
    const browser = createInitialWorkspace(now);
    desktop.settings.theme = 'dark';
    browser.settings.theme = 'light';
    browser.categories.push({
      color: '#000000',
      createdAt: '2026-09-01T10:00:00.000Z',
      folderId: null,
      id: 'browser-category',
      name: '网页分类',
      order: 4,
    });

    const merged = mergeWorkspaces(desktop, browser);

    expect(merged.settings.theme).toBe('dark');
    expect(merged.categories.some((category) => category.id === 'browser-category')).toBe(true);
    expect(merged.version).toBe(5);
  });
});

type TaskWithoutComments = Omit<
  ReturnType<typeof createInitialWorkspace>['tasks'][number],
  'comments'
> & {
  comments?: never;
};
