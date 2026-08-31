import type { Task } from '@easydo/domain';
import { isBackupPayload, matchesTaskSearch, sortTasks, taskProgress } from '@easydo/domain';

function task(patch: Partial<Task>): Task {
  return {
    categoryId: 'category-work',
    completedAt: null,
    createdAt: '2026-08-30T08:00:00.000Z',
    deletedAt: null,
    dueDate: null,
    dueTime: null,
    duration: 30,
    id: crypto.randomUUID(),
    notes: '',
    priority: 'none',
    recurrence: null,
    reminderMinutes: null,
    subtasks: [],
    tagIds: [],
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

  it('同时搜索标题和备注并忽略大小写', () => {
    const candidate = task({
      notes: 'Prepare Launch notes',
      subtasks: [{ completedAt: null, id: 'subtask-1', title: '联系设计师' }],
      title: '季度计划',
    });

    expect(matchesTaskSearch(candidate, 'launch')).toBe(true);
    expect(matchesTaskSearch(candidate, '季度')).toBe(true);
    expect(matchesTaskSearch(candidate, '设计师')).toBe(true);
    expect(matchesTaskSearch(candidate, '不存在')).toBe(false);
    expect(matchesTaskSearch(candidate, '  ')).toBe(true);
  });

  it('统计子任务完成进度', () => {
    expect(
      taskProgress(
        task({
          subtasks: [
            { completedAt: '2026-08-31T00:00:00.000Z', id: 'subtask-1', title: '完成' },
            { completedAt: null, id: 'subtask-2', title: '未完成' },
          ],
        }),
      ),
    ).toEqual({ completed: 1, total: 2 });
  });

  it('严格验证备份中的任务, 分类和标签', () => {
    const value = {
      categories: [
        {
          color: '#ffffff',
          createdAt: '2026-08-31T00:00:00.000Z',
          id: 'category-1',
          name: '分类',
          order: 0,
        },
      ],
      exportedAt: '2026-08-31T00:00:00.000Z',
      tags: [
        {
          color: '#ffffff',
          createdAt: '2026-08-31T00:00:00.000Z',
          id: 'tag-1',
          name: '标签',
        },
      ],
      tasks: [task({ id: 'task-1' })],
      version: 1,
    };

    expect(isBackupPayload(value)).toBe(true);
    expect(isBackupPayload(null)).toBe(false);
    expect(isBackupPayload({ ...value, tasks: [{ ...value.tasks[0], priority: 'urgent' }] })).toBe(
      false,
    );
    expect(isBackupPayload({ ...value, categories: [{ id: 'broken' }] })).toBe(false);
    expect(isBackupPayload({ ...value, tags: [{ id: 'broken' }] })).toBe(false);
    expect(
      isBackupPayload({
        ...value,
        tasks: [{ ...value.tasks[0], subtasks: [{ completedAt: 1, id: 'x', title: 'x' }] }],
      }),
    ).toBe(false);
  });
});
