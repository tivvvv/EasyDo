import { format } from 'date-fns';

import {
  fromDateKey,
  getMonthDays,
  getWeekDays,
  minutesFromTime,
  toDateKey,
} from '../lib/calendar';

describe('日历工具', () => {
  it('生成从周一开始的完整月视图', () => {
    const days = getMonthDays(new Date(2026, 7, 15));

    expect(format(days[0]!, 'yyyy-MM-dd')).toBe('2026-07-27');
    expect(format(days.at(-1)!, 'yyyy-MM-dd')).toBe('2026-09-06');
    expect(days).toHaveLength(42);
  });

  it('生成七天周视图', () => {
    const days = getWeekDays(new Date(2026, 7, 30));

    expect(days.map(toDateKey)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ]);
  });

  it('安全转换日期键和时间分钟数', () => {
    expect(toDateKey(fromDateKey('2026-08-30'))).toBe('2026-08-30');
    expect(fromDateKey('invalid')).toBeInstanceOf(Date);
    expect(minutesFromTime('09:45')).toBe(585);
    expect(minutesFromTime(null)).toBe(0);
  });
});
