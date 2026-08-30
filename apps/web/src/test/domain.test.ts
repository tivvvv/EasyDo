import type { Task } from '@easydo/domain';
import { matchesTaskSearch, sortTasks } from '@easydo/domain';

function task(patch: Partial<Task>): Task {
  return {
    categoryId: 'category-work',
    completedAt: null,
    createdAt: '2026-08-30T08:00:00.000Z',
    dueDate: null,
    dueTime: null,
    duration: 30,
    id: crypto.randomUUID(),
    notes: '',
    priority: 'none',
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
    const candidate = task({ notes: 'Prepare Launch notes', title: '季度计划' });

    expect(matchesTaskSearch(candidate, 'launch')).toBe(true);
    expect(matchesTaskSearch(candidate, '季度')).toBe(true);
    expect(matchesTaskSearch(candidate, '不存在')).toBe(false);
    expect(matchesTaskSearch(candidate, '  ')).toBe(true);
  });
});
