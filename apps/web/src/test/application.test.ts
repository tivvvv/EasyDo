import type { Task, TaskDraft } from '@easydo/domain';
import {
  getPendingReminders,
  nextRecurrenceDate,
  parseBackup,
  TaskApplicationService,
  type TaskRepository,
} from '@easydo/application';

const draft: TaskDraft = {
  categoryId: 'category-work',
  dueDate: '2026-08-31',
  dueTime: '09:00',
  duration: 30,
  notes: '',
  priority: 'medium',
  recurrence: null,
  reminderMinutes: 10,
  subtasks: [],
  tagIds: [],
  title: '测试任务',
};

class MemoryRepository implements TaskRepository {
  readonly tasks = new Map<string, Task>();

  async add(task: Task): Promise<void> {
    this.tasks.set(task.id, structuredClone(task));
  }

  async delete(id: string): Promise<void> {
    this.tasks.delete(id);
  }

  async get(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async update(id: string, patch: Partial<Task>): Promise<void> {
    const task = this.tasks.get(id);
    if (task) this.tasks.set(id, { ...task, ...patch });
  }
}

describe('任务应用服务', () => {
  it('创建, 更新, 回收, 恢复和永久删除任务', async () => {
    const repository = new MemoryRepository();
    const service = new TaskApplicationService(repository);
    const created = await service.create({ ...draft, title: '  新任务  ' });

    expect(created.title).toBe('新任务');
    await service.update(created.id, { priority: 'high' });
    expect(repository.tasks.get(created.id)?.priority).toBe('high');
    await service.trash(created.id);
    expect(repository.tasks.get(created.id)?.deletedAt).not.toBeNull();
    await service.restore(created.id);
    expect(repository.tasks.get(created.id)?.deletedAt).toBeNull();
    await service.reschedule(created.id, '2026-09-02');
    expect(repository.tasks.get(created.id)).toMatchObject({
      dueDate: '2026-09-02',
      dueTime: '09:00',
    });
    await service.purge(created.id);
    expect(repository.tasks.has(created.id)).toBe(false);
  });

  it('拒绝空标题和不存在的任务操作', async () => {
    const service = new TaskApplicationService(new MemoryRepository());
    await expect(service.create({ ...draft, title: '  ' })).rejects.toThrow('任务标题不能为空.');
    await expect(service.complete('missing')).rejects.toThrow('任务不存在.');
    await expect(service.duplicate('missing')).rejects.toThrow('任务不存在.');
    await expect(service.reschedule('missing', '2026-09-01')).rejects.toThrow('任务不存在.');
  });

  it('切换普通任务完成状态并取消排期', async () => {
    const repository = new MemoryRepository();
    const service = new TaskApplicationService(repository);
    const created = await service.create(draft);

    expect((await service.complete(created.id)).advanced).toBe(false);
    expect(repository.tasks.get(created.id)?.completedAt).not.toBeNull();
    await service.complete(created.id);
    expect(repository.tasks.get(created.id)?.completedAt).toBeNull();
    await service.reschedule(created.id, null);
    expect(repository.tasks.get(created.id)).toMatchObject({ dueDate: null, dueTime: null });
  });

  it('完成重复任务后保留历史并安排下一次', async () => {
    const repository = new MemoryRepository();
    const service = new TaskApplicationService(repository);
    const created = await service.create({
      ...draft,
      recurrence: { endsOn: null, frequency: 'daily', interval: 2, weekDays: [] },
      subtasks: [{ completedAt: '2026-08-31T00:00:00.000Z', id: 'subtask-1', title: '步骤' }],
    });

    expect(await service.complete(created.id)).toMatchObject({ advanced: true });
    expect(repository.tasks.size).toBe(2);
    expect(repository.tasks.get(created.id)?.dueDate).toBe('2026-09-02');
    expect(repository.tasks.get(created.id)?.subtasks[0]?.completedAt).toBeNull();
    expect(
      [...repository.tasks.values()].find((task) => task.id !== created.id)?.completedAt,
    ).not.toBeNull();
  });

  it('复制任务时重置子任务状态和标识', async () => {
    const repository = new MemoryRepository();
    const service = new TaskApplicationService(repository);
    const created = await service.create({
      ...draft,
      subtasks: [{ completedAt: '2026-08-31T00:00:00.000Z', id: 'subtask-old', title: '步骤' }],
    });
    const duplicate = await service.duplicate(created.id);

    expect(duplicate.title).toBe('测试任务 副本');
    expect(duplicate.subtasks[0]?.completedAt).toBeNull();
    expect(duplicate.subtasks[0]?.id).not.toBe('subtask-old');
  });
});

describe('重复日期和提醒规则', () => {
  it('计算工作日, 每周, 每月和结束日期', () => {
    expect(
      nextRecurrenceDate('2026-09-04', {
        endsOn: null,
        frequency: 'weekdays',
        interval: 1,
        weekDays: [],
      }),
    ).toBe('2026-09-07');
    expect(
      nextRecurrenceDate('2026-08-31', {
        endsOn: null,
        frequency: 'weekly',
        interval: 1,
        weekDays: [1, 3],
      }),
    ).toBe('2026-09-02');
    expect(
      nextRecurrenceDate('2026-01-31', {
        endsOn: null,
        frequency: 'monthly',
        interval: 1,
        weekDays: [],
      }),
    ).toBe('2026-02-28');
    expect(
      nextRecurrenceDate('2026-08-31', {
        endsOn: '2026-08-31',
        frequency: 'daily',
        interval: 1,
        weekDays: [],
      }),
    ).toBeNull();
    expect(
      nextRecurrenceDate('2026-08-31', {
        endsOn: null,
        frequency: 'yearly',
        interval: 2,
        weekDays: [],
      }),
    ).toBe('2028-08-31');
    expect(
      nextRecurrenceDate('2026-08-31', {
        endsOn: null,
        frequency: 'weekly',
        interval: 2,
        weekDays: [],
      }),
    ).toBe('2026-09-14');
  });

  it('只返回提醒窗口内且尚未通知的任务', () => {
    const task: Task = {
      ...draft,
      completedAt: null,
      createdAt: '2026-08-31T00:00:00.000Z',
      deletedAt: null,
      id: 'task-reminder',
      updatedAt: '2026-08-31T00:00:00.000Z',
    };
    expect(getPendingReminders([task], new Date('2026-08-31T08:55:00'), new Set())).toEqual([task]);
    expect(
      getPendingReminders([task], new Date('2026-08-31T08:55:00'), new Set([task.id])),
    ).toEqual([]);
    expect(
      getPendingReminders(
        [
          { ...task, completedAt: '2026-08-31T00:00:00.000Z' },
          { ...task, deletedAt: '2026-08-31T00:00:00.000Z' },
          { ...task, dueDate: null },
          { ...task, dueTime: null },
          { ...task, reminderMinutes: null },
        ],
        new Date('2026-08-31T08:55:00'),
        new Set(),
      ),
    ).toEqual([]);
    expect(getPendingReminders([task], new Date('2026-08-31T07:00:00'), new Set())).toEqual([]);
  });

  it('验证备份文件格式', () => {
    expect(
      parseBackup(
        JSON.stringify({
          categories: [],
          exportedAt: '2026-08-31',
          tags: [],
          tasks: [],
          version: 1,
        }),
      ),
    ).toMatchObject({ version: 1 });
    expect(() => parseBackup('{"version":2}')).toThrow('备份文件格式不正确.');
    expect(() =>
      parseBackup(
        JSON.stringify({
          categories: [],
          exportedAt: '2026-08-31',
          tags: [],
          tasks: [{ id: 'incomplete' }],
          version: 1,
        }),
      ),
    ).toThrow('备份文件格式不正确.');
  });
});
