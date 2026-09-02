import type { AppSettings } from '@easydo/domain';
import { format, startOfDay } from 'date-fns';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

import { toDateKey } from '../lib/calendar';
import { navigateCalendarDate } from '../lib/workspaceView';
import type { CalendarMode } from './CalendarView';

const modeLabels: Record<CalendarMode, string> = {
  agenda: '日程',
  day: '日',
  fiveDay: '5 日',
  month: '月',
  multiWeek: '4 周',
  threeDay: '3 日',
  week: '周',
  year: '年',
};

const primaryModes: CalendarMode[] = ['month', 'week', 'day', 'agenda'];
const secondaryModes: CalendarMode[] = ['year', 'multiWeek', 'fiveDay', 'threeDay'];

type CalendarToolbarProps = {
  agendaDays: AppSettings['agendaDays'];
  currentDate: Date;
  mode: CalendarMode;
  onChangeMode: (mode: CalendarMode) => void;
  onJump: (date: Date) => void;
  onNavigate: (date: Date) => void;
  onPlan: () => void;
  selectedDate: Date;
};

export function CalendarToolbar({
  agendaDays,
  currentDate,
  mode,
  onChangeMode,
  onJump,
  onNavigate,
  onPlan,
  selectedDate,
}: CalendarToolbarProps) {
  const navigate = (direction: -1 | 1) =>
    onNavigate(navigateCalendarDate(currentDate, mode, direction, agendaDays));

  return (
    <div className="calendar-toolbar" aria-label="日历工具栏">
      <div className="calendar-view-controls">
        <div className="view-switcher" aria-label="常用日历视图">
          {primaryModes.map((item) => (
            <button
              className={mode === item ? 'active' : ''}
              key={item}
              onClick={() => onChangeMode(item)}
              type="button"
            >
              {modeLabels[item]}
            </button>
          ))}
        </div>
        <details className="calendar-view-menu">
          <summary className={secondaryModes.includes(mode) ? 'active' : ''}>
            {secondaryModes.includes(mode) ? modeLabels[mode] : '更多'}
            <ChevronDown size={14} />
          </summary>
          <div role="menu">
            {secondaryModes.map((item) => (
              <button
                aria-current={mode === item ? 'page' : undefined}
                key={item}
                onClick={(event) => {
                  onChangeMode(item);
                  const menu = event.currentTarget.closest('details');
                  if (menu) menu.open = false;
                }}
                role="menuitem"
                type="button"
              >
                {modeLabels[item]}
                {mode === item && <Check size={14} />}
              </button>
            ))}
          </div>
        </details>
      </div>
      <div className="calendar-navigation">
        <button
          className="icon-button"
          aria-label="上一段时间"
          onClick={() => navigate(-1)}
          type="button"
        >
          <ChevronLeft size={18} />
        </button>
        <label className="date-jump">
          <CalendarDays size={15} />
          <span>{format(selectedDate, 'yyyy年M月d日')}</span>
          <input
            aria-label="跳转日期"
            onChange={(event) => {
              if (event.target.value) onJump(new Date(`${event.target.value}T12:00:00`));
            }}
            type="date"
            value={toDateKey(selectedDate)}
          />
        </label>
        <button
          className="today-button"
          onClick={() => onJump(startOfDay(new Date()))}
          type="button"
        >
          今天
        </button>
        <button
          className="icon-button"
          aria-label="下一段时间"
          onClick={() => navigate(1)}
          type="button"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <button className="plan-day-button" onClick={onPlan} type="button">
        <Sparkles size={16} />
        <span>规划今天</span>
      </button>
    </div>
  );
}
