import type { Task, TaskDraft } from '@easydo/domain';
import {
  createRecurrenceRule,
  createReminder,
  createSubtask,
  defaultAppSettings,
  defaultFilterCriteria,
  getLocalTimeZone,
} from '@easydo/domain';
import {
  getPendingReminders,
  getPendingReminderEvents,
  exportTasksToIcs,
  formatTaskTimeInZone,
  matchesFilter,
  nextRecurrenceDate,
  parseBackup,
  parseIcs,
  parseQuickTask,
  taskHasConflict,
  TaskApplicationService,
  zonedDateTimeToDate,
  type ActivityRepository,
  type TaskRepository,
} from '@easydo/application';
import type { ActivityRecord } from '@easydo/domain';

const draft: TaskDraft = {
  attachments: [],
  allDay: false,
  categoryId: 'category-work',
  dueDate: '2026-08-31',
  dueTime: '09:00',
  duration: 30,
  endDate: null,
  endTime: '09:30',
  important: false,
  kind: 'task',
  notes: '',
  parentId: null,
  priority: 'medium',
  recurrence: null,
  reminderMinutes: 10,
  reminders: [createReminder(10)],
  sectionId: null,
  subtasks: [],
  tagIds: [],
  timeZone: getLocalTimeZone(),
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

  async getBySeries(seriesId: string): Promise<Task[]> {
    return [...this.tasks.values()].filter((task) => task.seriesId === seriesId);
  }

  async update(id: string, patch: Partial<Task>): Promise<void> {
    const task = this.tasks.get(id);
    if (task) this.tasks.set(id, { ...task, ...patch });
  }
}

class MemoryActivities implements ActivityRepository {
  readonly records: ActivityRecord[] = [];
  async add(activity: ActivityRecord): Promise<void> {
    this.records.push(activity);
  }
  async delete(id: string): Promise<void> {
    const index = this.records.findIndex((item) => item.id === id);
    if (index >= 0) this.records.splice(index, 1);
  }
  async getByGroup(groupId: string): Promise<ActivityRecord[]> {
    return this.records.filter((item) => item.groupId === groupId);
  }
  async getLatest(): Promise<ActivityRecord | undefined> {
    return this.records.at(-1);
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

  it('记录并撤销最近一次任务修改', async () => {
    const repository = new MemoryRepository();
    const activities = new MemoryActivities();
    const service = new TaskApplicationService(repository, activities);
    const created = await service.create(draft);
    await service.update(created.id, { title: '修改后' });
    expect(activities.records.at(-1)?.action).toBe('update');
    expect(await service.undoLatest()).toBe(true);
    expect(repository.tasks.get(created.id)?.title).toBe('测试任务');
  });

  it('将同一批次修改作为一个整体撤销', async () => {
    const repository = new MemoryRepository();
    const activities = new MemoryActivities();
    const service = new TaskApplicationService(repository, activities);
    const first = await service.create({ ...draft, title: '第一项' });
    const second = await service.create({ ...draft, title: '第二项' });

    await service.batchUpdate([first.id, second.id], { priority: 'high' });
    await service.undoLatest();

    expect(repository.tasks.get(first.id)?.priority).toBe('medium');
    expect(repository.tasks.get(second.id)?.priority).toBe('medium');
    expect(activities.records.filter((item) => item.action === 'update')).toHaveLength(0);
  });

  it('仅修改重复任务本次并保留后续系列', async () => {
    const repository = new MemoryRepository();
    const activities = new MemoryActivities();
    const service = new TaskApplicationService(repository, activities);
    const created = await service.create({
      ...draft,
      recurrence: createRecurrenceRule('daily'),
    });
    await service.updateRecurring(created.id, { ...draft, title: '仅本次修改' }, 'current');
    expect(repository.tasks.size).toBe(2);
    expect(repository.tasks.get(created.id)).toMatchObject({
      recurrence: null,
      title: '仅本次修改',
    });
    expect([...repository.tasks.values()].find((task) => task.id !== created.id)).toMatchObject({
      dueDate: '2026-09-01',
      recurrence: expect.objectContaining({ frequency: 'daily' }),
    });
    await service.undoLatest();
    expect(repository.tasks.size).toBe(1);
    expect(repository.tasks.get(created.id)).toMatchObject({
      recurrence: expect.objectContaining({ frequency: 'daily' }),
      title: '测试任务',
    });
  });

  it('移动跨天任务时保留持续天数', async () => {
    const repository = new MemoryRepository();
    const service = new TaskApplicationService(repository);
    const created = await service.create({ ...draft, endDate: '2026-09-02' });
    await service.reschedule(created.id, '2026-09-10');
    expect(repository.tasks.get(created.id)).toMatchObject({
      dueDate: '2026-09-10',
      endDate: '2026-09-12',
    });
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
    const activities = new MemoryActivities();
    const service = new TaskApplicationService(repository, activities);
    const created = await service.create({
      ...draft,
      recurrence: { ...createRecurrenceRule('daily'), interval: 2 },
      subtasks: [
        { ...createSubtask('步骤'), completedAt: '2026-08-31T00:00:00.000Z', id: 'subtask-1' },
      ],
    });

    expect(await service.complete(created.id)).toMatchObject({ advanced: true });
    expect(repository.tasks.size).toBe(2);
    expect(repository.tasks.get(created.id)?.dueDate).toBe('2026-09-02');
    expect(repository.tasks.get(created.id)?.subtasks[0]?.completedAt).toBeNull();
    expect(
      [...repository.tasks.values()].find((task) => task.id !== created.id)?.completedAt,
    ).not.toBeNull();
    await service.undoLatest();
    expect(repository.tasks.size).toBe(1);
    expect(repository.tasks.get(created.id)).toMatchObject({
      completedAt: null,
      dueDate: '2026-08-31',
    });
  });

  it('支持按实际完成日期安排下一次重复任务', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00+08:00'));
    const repository = new MemoryRepository();
    const service = new TaskApplicationService(repository);
    const created = await service.create({
      ...draft,
      dueDate: '2026-08-31',
      recurrence: { ...createRecurrenceRule('daily'), basis: 'completion', interval: 2 },
    });
    await service.complete(created.id);
    expect(repository.tasks.get(created.id)?.dueDate).toBe('2026-09-12');
    vi.useRealTimers();
  });

  it('复制任务时重置子任务状态和标识', async () => {
    const repository = new MemoryRepository();
    const activities = new MemoryActivities();
    const service = new TaskApplicationService(repository, activities);
    const created = await service.create({
      ...draft,
      subtasks: [
        { ...createSubtask('步骤'), completedAt: '2026-08-31T00:00:00.000Z', id: 'subtask-old' },
      ],
    });
    const duplicate = await service.duplicate(created.id);

    expect(duplicate.title).toBe('测试任务 副本');
    expect(duplicate.subtasks[0]?.completedAt).toBeNull();
    expect(duplicate.subtasks[0]?.id).not.toBe('subtask-old');
    expect(activities.records.map((activity) => activity.action)).toEqual(['create', 'duplicate']);
  });

  it('跳过重复任务并批量推迟排期', async () => {
    const repository = new MemoryRepository();
    const service = new TaskApplicationService(repository);
    const recurring = await service.create({
      ...draft,
      recurrence: createRecurrenceRule('daily'),
    });
    const ordinary = await service.create({ ...draft, dueTime: '23:30', title: '跨日任务' });

    expect(await service.skipRecurrence(recurring.id)).toBe(true);
    expect(repository.tasks.get(recurring.id)).toMatchObject({ dueDate: '2026-09-01' });
    expect(repository.tasks.get(recurring.id)?.recurrence?.excludedDates).toContain('2026-08-31');

    await service.postpone([ordinary.id], 120);
    expect(repository.tasks.get(ordinary.id)).toMatchObject({
      dueDate: '2026-09-01',
      dueTime: '01:30',
    });
  });

  it('按全部范围同步重复系列的公共字段', async () => {
    const repository = new MemoryRepository();
    const service = new TaskApplicationService(repository);
    const recurring = await service.create({
      ...draft,
      recurrence: createRecurrenceRule('daily'),
    });
    await service.complete(recurring.id);
    await service.updateRecurring(
      recurring.id,
      { ...draft, recurrence: createRecurrenceRule('daily'), title: '系列新标题' },
      'all',
    );
    const instances = await repository.getBySeries(recurring.seriesId!);
    expect(instances).toHaveLength(2);
    expect(instances.every((task) => task.title === '系列新标题')).toBe(true);
  });
});

describe('重复日期和提醒规则', () => {
  it('计算工作日, 每周, 每月和结束日期', () => {
    expect(
      nextRecurrenceDate('2026-09-04', {
        ...createRecurrenceRule('weekdays'),
      }),
    ).toBe('2026-09-07');
    expect(
      nextRecurrenceDate('2026-08-31', {
        ...createRecurrenceRule('weekly'),
        weekDays: [1, 3],
      }),
    ).toBe('2026-09-02');
    expect(
      nextRecurrenceDate('2026-01-31', {
        ...createRecurrenceRule('monthly'),
      }),
    ).toBe('2026-02-28');
    expect(
      nextRecurrenceDate('2026-08-31', {
        ...createRecurrenceRule('daily'),
        endsOn: '2026-08-31',
      }),
    ).toBeNull();
    expect(
      nextRecurrenceDate('2026-08-31', {
        ...createRecurrenceRule('yearly'),
        interval: 2,
      }),
    ).toBe('2028-08-31');
    expect(
      nextRecurrenceDate('2026-08-31', {
        ...createRecurrenceRule('weekly'),
        interval: 2,
      }),
    ).toBe('2026-09-14');
  });

  it('支持按次数结束, 月末重复和排除日期', () => {
    expect(
      nextRecurrenceDate('2026-01-31', {
        ...createRecurrenceRule('monthly'),
        monthMode: 'lastDay',
      }),
    ).toBe('2026-02-28');
    expect(
      nextRecurrenceDate('2026-08-31', {
        ...createRecurrenceRule('daily'),
        excludedDates: ['2026-09-01'],
      }),
    ).toBe('2026-09-02');
    expect(
      nextRecurrenceDate('2026-08-31', {
        ...createRecurrenceRule('daily'),
        completedCount: 2,
        endAfterOccurrences: 3,
      }),
    ).toBeNull();
  });

  it('支持每月指定周次和星期重复', () => {
    expect(
      nextRecurrenceDate('2026-08-10', {
        ...createRecurrenceRule('monthly'),
        monthMode: 'weekDay',
        monthWeek: { week: 2, weekDay: 1 },
      }),
    ).toBe('2026-09-14');
    expect(
      nextRecurrenceDate('2026-08-31', {
        ...createRecurrenceRule('monthly'),
        monthMode: 'weekDay',
        monthWeek: { week: -1, weekDay: 5 },
      }),
    ).toBe('2026-09-25');
  });

  it('按任务时区计算提醒并正确跨越夏令时', () => {
    expect(zonedDateTimeToDate('2026-03-08', '01:30', 'America/New_York').toISOString()).toBe(
      '2026-03-08T06:30:00.000Z',
    );
    expect(zonedDateTimeToDate('2026-03-08', '03:30', 'America/New_York').toISOString()).toBe(
      '2026-03-08T07:30:00.000Z',
    );
    const task: Task = {
      ...draft,
      completedAt: null,
      createdAt: '2026-08-31T00:00:00.000Z',
      deletedAt: null,
      id: 'task-zone',
      order: 0,
      seriesId: null,
      timeZone: 'Asia/Shanghai',
      updatedAt: '2026-08-31T00:00:00.000Z',
    };
    expect(formatTaskTimeInZone(task, 'Europe/London')).toMatch(/02:00|01:00/);
  });

  it('完整导出并导入标准 ICS 日历条目', () => {
    const task: Task = {
      ...draft,
      completedAt: null,
      createdAt: '2026-08-31T00:00:00.000Z',
      deletedAt: null,
      id: 'task-ics',
      important: true,
      notes: '第一行\n第二行',
      order: 0,
      recurrence: { ...createRecurrenceRule('weekly'), weekDays: [1, 3] },
      seriesId: 'series-ics',
      title: '跨应用日程, 评审',
      updatedAt: '2026-08-31T00:00:00.000Z',
    };
    const calendar = exportTasksToIcs([task]);
    expect(calendar).toContain('BEGIN:VCALENDAR');
    expect(calendar).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE');
    expect(parseIcs(calendar, 'fallback')).toEqual([
      expect.objectContaining({
        categoryId: 'category-work',
        dueDate: '2026-08-31',
        dueTime: '09:00',
        important: true,
        notes: '第一行\n第二行',
        title: '跨应用日程, 评审',
      }),
    ]);
  });

  it('使用 ICS 规范的独占结束日期并兼容无效时区', () => {
    const allDayTask: Task = {
      ...draft,
      allDay: true,
      completedAt: null,
      createdAt: '2026-08-31T00:00:00.000Z',
      deletedAt: null,
      dueTime: null,
      endDate: '2026-09-02',
      endTime: null,
      id: 'task-all-day',
      order: 0,
      seriesId: null,
      updatedAt: '2026-08-31T00:00:00.000Z',
    };
    const calendar = exportTasksToIcs([allDayTask]);
    expect(calendar).toContain('DTEND;VALUE=DATE:20260903');
    expect(parseIcs(calendar, 'fallback')[0]?.endDate).toBe('2026-09-02');
    expect(zonedDateTimeToDate('2026-08-31', '09:00', 'Invalid/Zone')).toBeInstanceOf(Date);
  });

  it('只返回提醒窗口内且尚未通知的任务', () => {
    const task: Task = {
      ...draft,
      completedAt: null,
      createdAt: '2026-08-31T00:00:00.000Z',
      deletedAt: null,
      id: 'task-reminder',
      order: 0,
      seriesId: null,
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
          { ...task, reminderMinutes: null, reminders: [] },
        ],
        new Date('2026-08-31T08:55:00'),
        new Set(),
      ),
    ).toEqual([]);
    expect(getPendingReminders([task], new Date('2026-08-31T07:00:00'), new Set())).toEqual([]);
  });

  it('分别触发多个提醒并支持结束时间基准', () => {
    const task: Task = {
      ...draft,
      completedAt: null,
      createdAt: '2026-08-31T00:00:00.000Z',
      deletedAt: null,
      endTime: '10:00',
      id: 'task-multi-reminder',
      order: 0,
      reminders: [createReminder(10), createReminder(5, 'end')],
      seriesId: null,
      updatedAt: '2026-08-31T00:00:00.000Z',
    };
    expect(
      getPendingReminderEvents([task], new Date('2026-08-31T08:50:00'), new Set()),
    ).toHaveLength(1);
    expect(
      getPendingReminderEvents([task], new Date('2026-08-31T09:55:00'), new Set()),
    ).toHaveLength(1);
  });

  it('解析中文快速输入中的日期, 时间, 标签, 优先级和提醒', () => {
    const result = parseQuickTask(
      '明天下午3点 写周报 #工作 !高 持续2小时 提前30分钟',
      new Date('2026-08-31T09:00:00'),
    );
    expect(result.tagNames).toEqual(['工作']);
    expect(result.draft).toMatchObject({
      dueDate: '2026-09-01',
      dueTime: '15:00',
      duration: 120,
      priority: 'high',
      reminderMinutes: 30,
      title: '写周报',
    });
    expect(
      parseQuickTask('today 12:30 午餐 !low', new Date('2026-08-31T09:00:00')).draft,
    ).toMatchObject({ dueDate: '2026-08-31', dueTime: '12:30', priority: 'low', title: '午餐' });
    expect(parseQuickTask('2026-09-03 上午9点 会议 提醒1小时').draft).toMatchObject({
      dueDate: '2026-09-03',
      dueTime: '09:00',
      reminderMinutes: 60,
      title: '会议',
    });
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
    ).toMatchObject({ version: 4 });
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
    const migrated = parseBackup(
      JSON.stringify({
        categories: [
          {
            color: '#fff',
            createdAt: '2026-08-31T00:00:00.000Z',
            id: 'category-old',
            name: '旧分类',
            order: 0,
          },
        ],
        exportedAt: '2026-08-31',
        settings: { calendarDensity: 'compact' },
        tags: [],
        tasks: [
          {
            categoryId: 'category-old',
            completedAt: null,
            createdAt: '2026-08-31T00:00:00.000Z',
            deletedAt: null,
            dueDate: '2026-08-31',
            dueTime: '09:00',
            duration: 30,
            id: 'task-old',
            notes: '',
            order: 0,
            priority: 'none',
            recurrence: { endsOn: null, frequency: 'daily', interval: 1, weekDays: [] },
            reminderMinutes: 10,
            subtasks: [{ completedAt: null, id: 'subtask-old', title: '旧步骤' }],
            tagIds: [],
            title: '旧任务',
            updatedAt: '2026-08-31T00:00:00.000Z',
          },
        ],
        version: 2,
      }),
    );
    expect(migrated.tasks[0]).toMatchObject({
      allDay: false,
      endTime: '09:30',
      kind: 'task',
      reminders: [expect.objectContaining({ offsetMinutes: 10 })],
    });
    const legacyTask = migrated.tasks[0]!;
    const migratedV3 = parseBackup(
      JSON.stringify({
        activities: [
          {
            action: 'update',
            after: legacyTask,
            before: legacyTask,
            createdAt: legacyTask.createdAt,
            groupId: 'group-old',
            id: 'activity-old',
            taskId: legacyTask.id,
          },
        ],
        categories: migrated.categories,
        exportedAt: '2026-08-31',
        filters: [
          {
            createdAt: legacyTask.createdAt,
            criteria: { ...defaultFilterCriteria },
            id: 'filter-old',
            name: '旧筛选',
          },
        ],
        folders: [],
        settings: { ...defaultAppSettings },
        tags: [],
        tasks: [legacyTask],
        templates: [{ createdAt: legacyTask.createdAt, draft, id: 'template-old', name: '旧模板' }],
        version: 3,
      }),
    );
    expect(migratedV3).toMatchObject({
      activities: [{ id: 'activity-old' }],
      filters: [{ id: 'filter-old' }],
      templates: [{ id: 'template-old' }],
      version: 4,
    });
  });
});

describe('智能筛选和日程冲突', () => {
  const candidate = (): Task => ({
    ...draft,
    completedAt: null,
    createdAt: '2026-08-31T00:00:00.000Z',
    deletedAt: null,
    id: crypto.randomUUID(),
    order: 0,
    seriesId: null,
    updatedAt: '2026-08-31T00:00:00.000Z',
  });

  it('组合匹配日期, 分类, 标签和优先级', () => {
    const task = candidate();
    expect(
      matchesFilter(
        task,
        {
          categoryId: 'category-work',
          dateRange: 'next7',
          kind: 'all',
          priority: 'medium',
          status: 'active',
          tagIds: [],
        },
        '2026-08-31',
      ),
    ).toBe(true);
    expect(
      matchesFilter(
        task,
        {
          categoryId: null,
          dateRange: 'overdue',
          kind: 'all',
          priority: 'all',
          status: 'active',
          tagIds: [],
        },
        '2026-09-01',
      ),
    ).toBe(true);
  });

  it('识别同一天时间重叠的任务', () => {
    const first = candidate();
    const second = { ...candidate(), dueTime: '09:15' };
    expect(taskHasConflict(first, [first, second])).toBe(true);
    expect(taskHasConflict({ ...first, dueTime: null }, [second])).toBe(false);
  });
});
