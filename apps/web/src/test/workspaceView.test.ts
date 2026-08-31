import type { Category, Task } from '@easydo/domain';
import { getLocalTimeZone } from '@easydo/domain';
import { format } from 'date-fns';

import {
  getCalendarTitle,
  getViewTasks,
  getViewTitle,
  navigateCalendarDate,
} from '../lib/workspaceView';

const categories: Category[] = [
  {
    color: '#655fd7',
    createdAt: '2026-09-01T00:00:00.000Z',
    folderId: 'folder-work',
    id: 'category-work',
    name: '工作',
    order: 0,
  },
];

function task(patch: Partial<Task>): Task {
  return {
    allDay: true,
    attachments: [],
    categoryId: 'category-work',
    completedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
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
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...patch,
  };
}

describe('工作区视图规则', () => {
  it('按智能视图, 文件夹和标签筛选任务', () => {
    const today = task({ dueDate: '2026-09-01', tagIds: ['tag-focus'] });
    const inbox = task({ categoryId: 'category-other' });
    expect(getViewTasks([today, inbox], { kind: 'today' }, categories, '2026-09-01')).toEqual([
      today,
    ]);
    expect(
      getViewTasks([today, inbox], { id: 'folder-work', kind: 'folder' }, categories, '2026-09-01'),
    ).toEqual([today]);
    expect(
      getViewTasks([today, inbox], { id: 'tag-focus', kind: 'tag' }, categories, '2026-09-01'),
    ).toEqual([today]);
    expect(getViewTasks([today, inbox], { kind: 'inbox' }, categories, '2026-09-01')).toEqual([
      inbox,
    ]);
    expect(
      getViewTasks(
        [today, inbox],
        { id: 'category-work', kind: 'category' },
        categories,
        '2026-09-01',
      ),
    ).toEqual([today]);
    expect(getViewTasks([today, inbox], { kind: 'all' }, categories, '2026-09-01')).toEqual([
      today,
      inbox,
    ]);
  });

  it('生成稳定的视图标题和日历导航范围', () => {
    expect(getViewTitle({ id: 'category-work', kind: 'category' }, categories, [])).toBe('工作');
    const date = new Date(2026, 8, 1, 12);
    expect(format(navigateCalendarDate(date, 'multiWeek', 1, 14), 'yyyy-MM-dd')).toBe('2026-09-29');
    expect(getCalendarTitle(date, 'month', 14, 1)).toBe('2026 年 9 月');
  });

  it('覆盖全部工作区标题和缺失名称的回退文案', () => {
    const folders = [{ id: 'folder-work', name: '项目' }];
    const tags = [{ id: 'tag-focus', name: '专注' }];
    expect(getViewTitle({ kind: 'today' }, categories, tags, folders)).toBe('今天');
    expect(getViewTitle({ kind: 'inbox' }, categories, tags, folders)).toBe('收集箱');
    expect(getViewTitle({ kind: 'all' }, categories, tags, folders)).toBe('全部任务');
    expect(getViewTitle({ kind: 'productivity' }, categories, tags, folders)).toBe('效率工作台');
    expect(getViewTitle({ kind: 'history' }, categories, tags, folders)).toBe('操作记录');
    expect(getViewTitle({ kind: 'trash' }, categories, tags, folders)).toBe('回收站');
    expect(getViewTitle({ id: 'folder-work', kind: 'folder' }, categories, tags, folders)).toBe(
      '项目',
    );
    expect(getViewTitle({ id: 'tag-focus', kind: 'tag' }, categories, tags, folders)).toBe('#专注');
    expect(getViewTitle({ id: 'missing', kind: 'category' }, categories, tags)).toBe('分类');
    expect(getViewTitle({ id: 'missing', kind: 'folder' }, categories, tags)).toBe('文件夹');
    expect(getViewTitle({ id: 'missing', kind: 'tag' }, categories, tags)).toBe('#标签');
    expect(getViewTitle({ kind: 'settings' }, categories, tags)).toBe('设置与数据');
  });

  it('覆盖全部日历视图的导航步长和标题范围', () => {
    const date = new Date(2026, 8, 1, 12);
    expect(format(navigateCalendarDate(date, 'year', 1, 14), 'yyyy-MM-dd')).toBe('2027-09-01');
    expect(format(navigateCalendarDate(date, 'month', -1, 14), 'yyyy-MM-dd')).toBe('2026-08-01');
    expect(format(navigateCalendarDate(date, 'week', 1, 14), 'yyyy-MM-dd')).toBe('2026-09-08');
    expect(format(navigateCalendarDate(date, 'fiveDay', 1, 14), 'yyyy-MM-dd')).toBe('2026-09-06');
    expect(format(navigateCalendarDate(date, 'threeDay', 1, 14), 'yyyy-MM-dd')).toBe('2026-09-04');
    expect(format(navigateCalendarDate(date, 'agenda', 1, 14), 'yyyy-MM-dd')).toBe('2026-09-15');
    expect(format(navigateCalendarDate(date, 'day', 1, 14), 'yyyy-MM-dd')).toBe('2026-09-02');

    expect(getCalendarTitle(date, 'year', 14, 1)).toBe('2026 年');
    expect(getCalendarTitle(date, 'day', 14, 1)).toContain('9 月 1 日');
    expect(getCalendarTitle(date, 'fiveDay', 14, 1)).toBe('9 月 1 日 - 9 月 5 日');
    expect(getCalendarTitle(date, 'threeDay', 14, 1)).toBe('9 月 1 日 - 9 月 3 日');
    expect(getCalendarTitle(date, 'agenda', 14, 1)).toBe('9 月 1 日 - 9 月 14 日');
    expect(getCalendarTitle(date, 'multiWeek', 14, 1)).toBe('8 月 31 日 - 9 月 27 日');
    expect(getCalendarTitle(date, 'week', 14, 0)).toBe('8 月 30 日 - 9 月 5 日');
  });
});
