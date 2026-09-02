import type { Task } from '@easydo/domain';
import { defaultAppSettings, getLocalTimeZone } from '@easydo/domain';

import {
  buildDailyPlan,
  findTaskSlot,
  getPlanningCandidates,
  getScheduledMinutes,
} from '../lib/dailyPlanner';

const baseTask: Task = {
  allDay: true,
  attachments: [],
  categoryId: 'category-work',
  comments: [],
  completedAt: null,
  createdAt: '2026-08-30T00:00:00.000Z',
  deletedAt: null,
  dueDate: null,
  dueTime: null,
  duration: 30,
  endDate: null,
  endTime: null,
  id: 'task-base',
  important: false,
  kind: 'task',
  notes: '',
  order: 0,
  parentId: null,
  priority: 'none',
  recurrence: null,
  reminderMinutes: null,
  reminders: [],
  sectionId: null,
  seriesId: null,
  subtasks: [],
  tagIds: [],
  timeZone: getLocalTimeZone(),
  title: '任务',
  updatedAt: '2026-08-30T00:00:00.000Z',
};

describe('每日规划算法', () => {
  it('优先安排重要和高优先级任务', () => {
    const tasks = [
      { ...baseTask, id: 'normal', order: 1, title: '普通任务' },
      { ...baseTask, id: 'high', order: 2, priority: 'high' as const, title: '高优先级任务' },
      { ...baseTask, id: 'important', important: true, order: 3, title: '重要任务' },
    ];
    expect(getPlanningCandidates(tasks, '2026-09-02').map((task) => task.id)).toEqual([
      'important',
      'high',
      'normal',
    ]);
  });

  it('不把锁定的时间块纳入自动规划候选', () => {
    const tasks = [
      { ...baseTask, id: 'locked', scheduleLocked: true, title: '固定会议' },
      { ...baseTask, id: 'normal', title: '普通任务' },
    ];
    expect(getPlanningCandidates(tasks, '2026-09-02').map((task) => task.id)).toEqual(['normal']);
  });

  it('避开已有时间块并遵守每日容量', () => {
    const tasks: Task[] = [
      {
        ...baseTask,
        allDay: false,
        dueDate: '2026-09-02',
        dueTime: '09:00',
        duration: 60,
        endTime: '10:00',
        id: 'scheduled',
      },
      { ...baseTask, duration: 45, estimateMinutes: 45, id: 'candidate-a' },
      { ...baseTask, duration: 60, estimateMinutes: 60, id: 'candidate-b', order: 2 },
    ];
    const settings = {
      ...defaultAppSettings,
      dailyCapacityMinutes: 150,
      workdayEnd: 12,
      workdayStart: 9,
    };
    expect(buildDailyPlan(tasks, '2026-09-02', settings)).toEqual([
      { date: '2026-09-02', duration: 45, taskId: 'candidate-a', time: '10:00' },
    ]);
    expect(getScheduledMinutes(tasks, '2026-09-02')).toBe(60);
  });

  it('返回工作时段内的第一个空档', () => {
    const tasks: Task[] = [
      {
        ...baseTask,
        allDay: false,
        dueDate: '2026-09-02',
        dueTime: '07:00',
        endTime: '08:30',
        id: 'early',
      },
    ];
    expect(findTaskSlot(tasks, '2026-09-02', 30, defaultAppSettings)).toBe('08:30');
  });
});
