import type { Category, Task } from '@easydo/domain';
import { addDays, addMonths, addWeeks, format, startOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import type { CalendarMode } from '../components/CalendarView';

export type WorkspaceView =
  | {
      kind:
        'all' | 'calendar' | 'history' | 'inbox' | 'productivity' | 'settings' | 'today' | 'trash';
    }
  | { id: string; kind: 'category' | 'folder' | 'tag' };

export function getViewTasks(
  tasks: Task[],
  view: WorkspaceView,
  categories: Category[],
  todayKey: string,
): Task[] {
  if (view.kind === 'today') return tasks.filter((task) => task.dueDate === todayKey);
  if (view.kind === 'inbox') return tasks.filter((task) => !task.dueDate);
  if (view.kind === 'category') return tasks.filter((task) => task.categoryId === view.id);
  if (view.kind === 'folder') {
    const folderCategoryIds = new Set(
      categories.filter((category) => category.folderId === view.id).map((category) => category.id),
    );
    return tasks.filter((task) => folderCategoryIds.has(task.categoryId));
  }
  if (view.kind === 'tag') return tasks.filter((task) => task.tagIds.includes(view.id));
  return tasks;
}

export function getViewTitle(
  view: WorkspaceView,
  categories: { id: string; name: string }[],
  tags: { id: string; name: string }[],
  folders: { id: string; name: string }[] = [],
): string {
  if (view.kind === 'today') return '今天';
  if (view.kind === 'inbox') return '收集箱';
  if (view.kind === 'all') return '全部任务';
  if (view.kind === 'productivity') return '效率工作台';
  if (view.kind === 'history') return '操作记录';
  if (view.kind === 'trash') return '回收站';
  if (view.kind === 'category')
    return categories.find((item) => item.id === view.id)?.name ?? '分类';
  if (view.kind === 'folder') return folders.find((item) => item.id === view.id)?.name ?? '文件夹';
  if (view.kind === 'tag') return `#${tags.find((item) => item.id === view.id)?.name ?? '标签'}`;
  return '设置与数据';
}

export function navigateCalendarDate(
  date: Date,
  mode: CalendarMode,
  amount: number,
  agendaDays: number,
): Date {
  if (mode === 'year') return new Date(date.getFullYear() + amount, date.getMonth(), 1, 12);
  if (mode === 'month') return addMonths(date, amount);
  if (mode === 'multiWeek') return addWeeks(date, amount * 4);
  if (mode === 'week') return addWeeks(date, amount);
  if (mode === 'fiveDay') return addDays(date, amount * 5);
  if (mode === 'threeDay') return addDays(date, amount * 3);
  if (mode === 'agenda') return addDays(date, amount * agendaDays);
  return addDays(date, amount);
}

export function getCalendarTitle(
  date: Date,
  mode: CalendarMode,
  agendaDays: number,
  weekStartsOn: 0 | 1,
): string {
  if (mode === 'year') return format(date, 'yyyy 年', { locale: zhCN });
  if (mode === 'month') return format(date, 'yyyy 年 M 月', { locale: zhCN });
  if (mode === 'day') return format(date, 'M 月 d 日 EEEE', { locale: zhCN });
  if (mode === 'fiveDay' || mode === 'threeDay') {
    const span = mode === 'fiveDay' ? 4 : 2;
    return `${format(date, 'M 月 d 日')} - ${format(addDays(date, span), 'M 月 d 日')}`;
  }
  if (mode === 'agenda') {
    return `${format(date, 'M 月 d 日')} - ${format(addDays(date, agendaDays - 1), 'M 月 d 日')}`;
  }
  const start = startOfWeek(date, { weekStartsOn });
  const end = addDays(start, mode === 'multiWeek' ? 27 : 6);
  return `${format(start, 'M 月 d 日')} - ${format(end, 'M 月 d 日')}`;
}
