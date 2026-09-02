import type { Task } from '@easydo/domain';
import {
  calculateHabitStreak,
  createSubtask,
  defaultAppSettings,
  getLocalTimeZone,
  isBackupPayload,
  matchesTaskSearch,
  sortTasks,
  taskActualMinutes,
  taskBlockingDependencies,
  taskProgress,
} from '@easydo/domain';

function task(patch: Partial<Task>): Task {
  return {
    attachments: [],
    allDay: true,
    categoryId: 'category-work',
    completedAt: null,
    createdAt: '2026-08-30T08:00:00.000Z',
    deletedAt: null,
    dueDate: null,
    dueTime: null,
    duration: 30,
    endDate: null,
    endTime: null,
    id: crypto.randomUUID(),
    important: false,
    kind: 'task',
    notes: '',
    order: 0,
    priority: 'none',
    parentId: null,
    recurrence: null,
    reminderMinutes: null,
    reminders: [],
    seriesId: null,
    sectionId: null,
    subtasks: [],
    tagIds: [],
    timeZone: getLocalTimeZone(),
    title: '默认任务',
    updatedAt: '2026-08-30T08:00:00.000Z',
    ...patch,
  };
}

describe('任务领域规则', () => {
  it('按照完成状态, 日期, 时间和优先级排序', () => {
    const completed = task({ completedAt: '2026-08-30T10:00:00.000Z', dueDate: '2026-08-30' });
    const later = task({ dueDate: '2026-09-01', priority: 'high' });
    const low = task({ dueDate: '2026-08-30', dueTime: '09:00', priority: 'low' });
    const high = task({ dueDate: '2026-08-30', dueTime: '09:00', priority: 'high' });

    expect(sortTasks([completed, later, low, high])).toEqual([high, low, later, completed]);
  });

  it('优先保留用户手动调整的任务顺序', () => {
    const first = task({ id: 'first', order: 1, title: '第一项' });
    const second = task({ id: 'second', dueDate: '2026-08-01', order: 2, title: '第二项' });

    expect(sortTasks([second, first])).toEqual([first, second]);
  });

  it('同时搜索标题和备注并忽略大小写', () => {
    const candidate = task({
      comments: [
        {
          content: '等待法务确认',
          createdAt: '2026-08-30T09:00:00.000Z',
          id: 'comment-1',
          updatedAt: '2026-08-30T09:00:00.000Z',
        },
      ],
      notes: 'Prepare Launch notes',
      subtasks: [{ ...createSubtask('联系设计师'), id: 'subtask-1' }],
      title: '季度计划',
    });

    expect(matchesTaskSearch(candidate, 'launch')).toBe(true);
    expect(matchesTaskSearch(candidate, '季度')).toBe(true);
    expect(matchesTaskSearch(candidate, '设计师')).toBe(true);
    expect(matchesTaskSearch(candidate, '法务')).toBe(true);
    expect(matchesTaskSearch(candidate, '不存在')).toBe(false);
    expect(matchesTaskSearch(candidate, '  ')).toBe(true);
  });

  it('统计子任务完成进度', () => {
    expect(
      taskProgress(
        task({
          subtasks: [
            { ...createSubtask('完成'), completedAt: '2026-08-31T00:00:00.000Z', id: 'subtask-1' },
            { ...createSubtask('未完成'), id: 'subtask-2' },
          ],
        }),
      ),
    ).toEqual({ completed: 1, total: 2 });
  });

  it('计算任务实际专注时间和未完成前置任务', () => {
    const dependency = task({ id: 'dependency', title: '前置任务' });
    const current = task({ dependencyIds: [dependency.id], id: 'current' });
    expect(taskBlockingDependencies(current, [current, dependency])).toEqual([dependency]);
    expect(
      taskActualMinutes(current.id, [
        {
          createdAt: '2026-09-01T01:25:00.000Z',
          durationMinutes: 25,
          endedAt: '2026-09-01T01:25:00.000Z',
          id: 'focus-current',
          mode: 'pomodoro',
          startedAt: '2026-09-01T01:00:00.000Z',
          taskId: current.id,
        },
        {
          createdAt: '2026-09-01T02:25:00.000Z',
          durationMinutes: 25,
          endedAt: '2026-09-01T02:25:00.000Z',
          id: 'focus-other',
          mode: 'pomodoro',
          startedAt: '2026-09-01T02:00:00.000Z',
          taskId: dependency.id,
        },
      ]),
    ).toBe(25);
  });

  it('在一万条任务下保持筛选和排序结果稳定', () => {
    const tasks = Array.from({ length: 10_000 }, (_, index) =>
      task({
        dueDate: `2026-09-${String((index % 28) + 1).padStart(2, '0')}`,
        id: `task-${index}`,
        priority: index % 4 === 0 ? 'high' : 'none',
        title: index % 10 === 0 ? `重点任务 ${index}` : `普通任务 ${index}`,
      }),
    );
    const startedAt = performance.now();
    const result = sortTasks(tasks.filter((item) => matchesTaskSearch(item, '重点')));
    expect(result).toHaveLength(1_000);
    expect(result[0]?.priority).toBe('high');
    expect(performance.now() - startedAt).toBeLessThan(1_500);
  });

  it('计算习惯的当前连续天数和历史最长连续天数', () => {
    expect(
      calculateHabitStreak(
        ['2026-08-20', '2026-08-21', '2026-08-28', '2026-08-29', '2026-08-30'],
        '2026-08-31',
      ),
    ).toEqual({ current: 3, longest: 3 });
    expect(calculateHabitStreak(['2026-08-30', '2026-08-31'], '2026-08-31')).toEqual({
      current: 2,
      longest: 2,
    });
    expect(calculateHabitStreak([], '2026-08-31')).toEqual({ current: 0, longest: 0 });
  });

  it('严格验证备份中的任务, 分类和标签', () => {
    const backupTask = task({
      attachments: [
        {
          createdAt: '2026-08-31T00:00:00.000Z',
          dataUrl: 'data:text/plain;base64,QQ==',
          id: 'attachment-1',
          mimeType: 'text/plain',
          name: '说明.txt',
          size: 1,
        },
      ],
      id: 'task-1',
      recurrence: {
        basis: 'completion',
        completedCount: 1,
        endAfterOccurrences: 5,
        endsOn: '2026-12-31',
        excludedDates: ['2026-09-01'],
        frequency: 'monthly',
        interval: 1,
        monthMode: 'weekDay',
        monthWeek: { week: -1, weekDay: 5 },
        weekDays: [5],
      },
    });
    const value = {
      activities: [
        {
          action: 'update',
          after: backupTask,
          before: backupTask,
          createdAt: '2026-08-31T00:00:00.000Z',
          groupId: 'group-1',
          id: 'activity-1',
          taskId: backupTask.id,
        },
      ],
      categories: [
        {
          color: '#ffffff',
          createdAt: '2026-08-31T00:00:00.000Z',
          folderId: null,
          id: 'category-1',
          name: '分类',
          order: 0,
        },
      ],
      countdowns: [
        {
          color: '#d65f78',
          createdAt: '2026-08-31T00:00:00.000Z',
          date: '2026-09-30',
          id: 'countdown-1',
          repeatYearly: false,
          title: '发布',
        },
      ],
      exportedAt: '2026-08-31T00:00:00.000Z',
      filters: [
        {
          createdAt: '2026-08-31T00:00:00.000Z',
          criteria: {
            categoryId: null,
            dateRange: 'next7',
            kind: 'all',
            priority: 'all',
            status: 'active',
            tagIds: ['tag-1'],
          },
          id: 'filter-1',
          name: '近期',
        },
      ],
      focusSessions: [
        {
          createdAt: '2026-08-31T00:00:00.000Z',
          durationMinutes: 25,
          endedAt: '2026-08-31T00:25:00.000Z',
          id: 'focus-1',
          mode: 'pomodoro',
          startedAt: '2026-08-31T00:00:00.000Z',
          taskId: 'task-1',
        },
      ],
      folders: [{ createdAt: '2026-08-31T00:00:00.000Z', id: 'folder-1', name: '项目', order: 0 }],
      habits: [
        {
          archivedAt: null,
          color: '#3fa27c',
          createdAt: '2026-08-31T00:00:00.000Z',
          frequency: 'daily',
          id: 'habit-1',
          logs: ['2026-08-31'],
          name: '阅读',
          target: 1,
          weekDays: [],
        },
      ],
      sections: [
        {
          categoryId: 'category-1',
          createdAt: '2026-08-31T00:00:00.000Z',
          id: 'section-1',
          name: '进行中',
          order: 0,
        },
      ],
      settings: { ...defaultAppSettings },
      tags: [
        {
          color: '#ffffff',
          createdAt: '2026-08-31T00:00:00.000Z',
          id: 'tag-1',
          name: '标签',
        },
      ],
      tasks: [backupTask],
      templates: [
        {
          createdAt: '2026-08-31T00:00:00.000Z',
          draft: backupTask,
          id: 'template-1',
          name: '模板',
        },
      ],
      version: 4,
    };

    expect(isBackupPayload(value)).toBe(true);
    expect(isBackupPayload(null)).toBe(false);
    expect(isBackupPayload({ ...value, tasks: [{ ...value.tasks[0], priority: 'urgent' }] })).toBe(
      false,
    );
    expect(isBackupPayload({ ...value, categories: [{ id: 'broken' }] })).toBe(false);
    expect(isBackupPayload({ ...value, tags: [{ id: 'broken' }] })).toBe(false);
    expect(isBackupPayload({ ...value, templates: [{ id: 'broken' }] })).toBe(false);
    expect(isBackupPayload({ ...value, filters: [{ id: 'broken' }] })).toBe(false);
    expect(isBackupPayload({ ...value, activities: [{ id: 'broken' }] })).toBe(false);
    expect(isBackupPayload({ ...value, countdowns: [{ id: 'broken' }] })).toBe(false);
    expect(isBackupPayload({ ...value, focusSessions: [{ id: 'broken' }] })).toBe(false);
    expect(isBackupPayload({ ...value, folders: [{ id: 'broken' }] })).toBe(false);
    expect(isBackupPayload({ ...value, habits: [{ id: 'broken' }] })).toBe(false);
    expect(isBackupPayload({ ...value, sections: [{ id: 'broken' }] })).toBe(false);
    const legacySettings: Partial<typeof value.settings> = { ...value.settings };
    delete legacySettings.accentColor;
    delete legacySettings.interfaceDensity;
    expect(isBackupPayload({ ...value, settings: legacySettings })).toBe(true);
    expect(
      isBackupPayload({ ...value, settings: { ...value.settings, accentColor: 'neon' } }),
    ).toBe(false);
    expect(
      isBackupPayload({ ...value, settings: { ...value.settings, interfaceDensity: 'tiny' } }),
    ).toBe(false);
    expect(isBackupPayload({ ...value, settings: { ...value.settings, workdayEnd: 5 } })).toBe(
      false,
    );
    expect(
      isBackupPayload({
        ...value,
        tasks: [{ ...value.tasks[0], subtasks: [{ completedAt: 1, id: 'x', title: 'x' }] }],
      }),
    ).toBe(false);
  });
});
