import type { AppSettings, Task } from '@easydo/domain';

export type PlannedTaskSlot = {
  date: string;
  duration: number;
  taskId: string;
  time: string;
};

type BusyRange = { end: number; start: number };

const priorityWeight = { high: 3, low: 1, medium: 2, none: 0 } as const;

export function getPlanningCandidates(tasks: readonly Task[], date: string): Task[] {
  return tasks
    .filter(
      (task) =>
        !task.completedAt &&
        !task.deletedAt &&
        task.dueDate !== date &&
        (!task.dueDate || task.dueDate < date),
    )
    .sort(
      (left, right) =>
        Number(right.important) - Number(left.important) ||
        priorityWeight[right.priority] - priorityWeight[left.priority] ||
        (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31') ||
        left.order - right.order,
    );
}

export function getScheduledMinutes(tasks: readonly Task[], date: string): number {
  return tasks
    .filter((task) => !task.completedAt && !task.deletedAt && task.dueDate === date)
    .reduce((total, task) => total + Math.max(5, task.estimateMinutes ?? task.duration), 0);
}

export function buildDailyPlan(
  tasks: readonly Task[],
  date: string,
  settings: Pick<AppSettings, 'dailyCapacityMinutes' | 'workdayEnd' | 'workdayStart'>,
): PlannedTaskSlot[] {
  const ranges = getBusyRanges(tasks, date);
  const result: PlannedTaskSlot[] = [];
  let plannedMinutes = getScheduledMinutes(tasks, date);

  for (const task of getPlanningCandidates(tasks, date)) {
    const duration = Math.max(5, Math.ceil((task.estimateMinutes ?? task.duration) / 5) * 5);
    if (plannedMinutes + duration > settings.dailyCapacityMinutes) continue;
    const start = findAvailableStart(ranges, duration, settings.workdayStart, settings.workdayEnd);
    if (start === null) continue;
    ranges.push({ end: start + duration, start });
    ranges.sort((left, right) => left.start - right.start);
    result.push({ date, duration, taskId: task.id, time: minutesToTime(start) });
    plannedMinutes += duration;
  }
  return result;
}

export function findTaskSlot(
  tasks: readonly Task[],
  date: string,
  duration: number,
  settings: Pick<AppSettings, 'workdayEnd' | 'workdayStart'>,
): string | null {
  const start = findAvailableStart(
    getBusyRanges(tasks, date),
    Math.max(5, duration),
    settings.workdayStart,
    settings.workdayEnd,
  );
  return start === null ? null : minutesToTime(start);
}

function getBusyRanges(tasks: readonly Task[], date: string): BusyRange[] {
  return tasks
    .filter(
      (task) =>
        !task.completedAt && !task.deletedAt && task.dueDate === date && Boolean(task.dueTime),
    )
    .flatMap((task) => {
      const start = timeToMinutes(task.dueTime!);
      const end = task.endTime ? timeToMinutes(task.endTime) : start + task.duration;
      return [{ end: Math.max(start + 5, end), start }];
    })
    .sort((left, right) => left.start - right.start);
}

function findAvailableStart(
  ranges: readonly BusyRange[],
  duration: number,
  workdayStart: number,
  workdayEnd: number,
): number | null {
  let cursor = workdayStart * 60;
  const limit = workdayEnd * 60;
  for (const range of ranges) {
    if (range.end <= cursor) continue;
    if (range.start - cursor >= duration) return cursor;
    cursor = Math.max(cursor, range.end);
  }
  return limit - cursor >= duration ? cursor : null;
}

function timeToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
