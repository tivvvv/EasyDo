import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

export function getMonthDays(date: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
  });
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function minutesFromTime(time: string | null): number {
  if (!time) {
    return 0;
  }

  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
