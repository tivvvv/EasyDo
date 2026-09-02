import type { RecurrenceRule, TaskDraft } from '@easydo/domain';
import { createRecurrenceRule, createReminder } from '@easydo/domain';
import { addDays, format, parseISO } from 'date-fns';

export type QuickTaskParseResult = {
  categoryName: string | null;
  draft: Partial<TaskDraft> & Pick<TaskDraft, 'title'>;
  tagNames: string[];
};

export function parseQuickTask(input: string, now = new Date()): QuickTaskParseResult {
  let title = input.trim();
  const draft: QuickTaskParseResult['draft'] = { title };
  const tags = [...title.matchAll(/#([^\s#!]+)/g)].flatMap((match) => (match[1] ? [match[1]] : []));
  title = title.replace(/#([^\s#!]+)/g, '').trim();
  const categoryMatch = title.match(/@([^\s#!@]+)/);
  const categoryName = categoryMatch?.[1] ?? null;
  if (categoryMatch) title = title.replace(categoryMatch[0], '').trim();

  const priorityMatch = title.match(/(?:!|！)(高|中|低|\bhigh\b|\bmedium\b|\blow\b)/i);
  if (priorityMatch) {
    const priorityMap = {
      high: 'high',
      low: 'low',
      medium: 'medium',
      中: 'medium',
      低: 'low',
      高: 'high',
    } as const;
    const priorityKey = priorityMatch[1]?.toLowerCase() as keyof typeof priorityMap;
    draft.priority = priorityMap[priorityKey];
    title = title.replace(priorityMatch[0], '').trim();
  }

  const dayTokens: Array<[RegExp, number]> = [
    [/(?:今天|\btoday\b)/i, 0],
    [/(?:明天|\btomorrow\b)/i, 1],
    [/(?:后天)/i, 2],
  ];
  for (const [pattern, offset] of dayTokens) {
    if (!pattern.test(title)) continue;
    draft.dueDate = format(addDays(now, offset), 'yyyy-MM-dd');
    title = title.replace(pattern, '').trim();
    break;
  }

  const weekDayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDayMatch = title.match(/(下周|本周|周)([一二三四五六日天])/);
  if (!draft.dueDate && weekDayMatch) {
    const target = weekDayNames.indexOf(weekDayMatch[2] === '天' ? '日' : weekDayMatch[2]!);
    const current = now.getDay();
    const currentFromMonday = current === 0 ? 6 : current - 1;
    const targetFromMonday = target === 0 ? 6 : target - 1;
    let offset = (target - current + 7) % 7;
    if (weekDayMatch[1] === '下周') offset = 7 - currentFromMonday + targetFromMonday;
    else if (offset === 0) offset = 7;
    draft.dueDate = format(addDays(now, offset), 'yyyy-MM-dd');
    title = title.replace(weekDayMatch[0], '').trim();
  }

  const dateMatch = title.match(/\b(\d{4}-\d{1,2}-\d{1,2})\b/);
  if (dateMatch) {
    const parsed = parseISO(dateMatch[1]!);
    if (!Number.isNaN(parsed.getTime())) draft.dueDate = format(parsed, 'yyyy-MM-dd');
    title = title.replace(dateMatch[0], '').trim();
  }

  const timeMatch = title.match(/(?:上午|下午|晚上)?\s*(\d{1,2})(?::|点)(\d{1,2})?/);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    if (/下午|晚上/.test(timeMatch[0]) && hour < 12) hour += 12;
    if (/上午/.test(timeMatch[0]) && hour === 12) hour = 0;
    if (hour <= 23) {
      draft.dueTime = `${String(hour).padStart(2, '0')}:${String(Number(timeMatch[2] ?? 0)).padStart(2, '0')}`;
      draft.allDay = false;
      title = title.replace(timeMatch[0], '').trim();
    }
  }

  if (!draft.dueTime) {
    const periodMatch = title.match(/(?:今晚|今早|早上|上午|中午|下午|晚上)/);
    if (periodMatch) {
      const hour = /今早|早上|上午/.test(periodMatch[0])
        ? 9
        : /中午/.test(periodMatch[0])
          ? 12
          : /下午/.test(periodMatch[0])
            ? 15
            : 20;
      draft.dueTime = `${String(hour).padStart(2, '0')}:00`;
      draft.allDay = false;
      if (periodMatch[0] === '今晚' || periodMatch[0] === '今早') {
        draft.dueDate ??= format(now, 'yyyy-MM-dd');
      }
      title = title.replace(periodMatch[0], '').trim();
    }
  }

  const durationMatch = title.match(/(?:持续|时长)\s*(\d+(?:\.\d+)?)\s*(分钟|小时)/);
  if (durationMatch) {
    draft.duration = Math.max(
      5,
      Math.round(Number(durationMatch[1]) * (durationMatch[2] === '小时' ? 60 : 1)),
    );
    title = title.replace(durationMatch[0], '').trim();
  }

  const reminderMatch = title.match(/(?:提前|提醒)\s*(\d+)\s*(分钟|小时)/);
  if (reminderMatch) {
    const offset = Number(reminderMatch[1]) * (reminderMatch[2] === '小时' ? 60 : 1);
    draft.reminderMinutes = offset;
    draft.reminders = [createReminder(offset)];
    title = title.replace(reminderMatch[0], '').trim();
  }

  const recurrenceTokens: Array<[RegExp, RecurrenceRule['frequency']]> = [
    [/(?:每个)?工作日/, 'weekdays'],
    [/每天/, 'daily'],
    [/每周/, 'weekly'],
    [/每月/, 'monthly'],
    [/每年/, 'yearly'],
  ];
  for (const [pattern, frequency] of recurrenceTokens) {
    if (!pattern.test(title)) continue;
    draft.recurrence = createRecurrenceRule(frequency);
    title = title.replace(pattern, '').trim();
    break;
  }

  return {
    categoryName,
    draft: { ...draft, title: title.replace(/\s{2,}/g, ' ').trim() },
    tagNames: tags,
  };
}
