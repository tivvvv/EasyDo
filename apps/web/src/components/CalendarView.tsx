import type { Category, Task } from '@easydo/domain';
import { format, isSameDay, isSameMonth, isToday } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarDays, Check, CirclePlus, Clock3 } from 'lucide-react';

import { getMonthDays, getWeekDays, minutesFromTime, toDateKey } from '../lib/calendar';

export type CalendarMode = 'month' | 'week' | 'day';

type CalendarViewProps = {
  categories: Category[];
  currentDate: Date;
  mode: CalendarMode;
  onAdd: (date: string) => void;
  onEdit: (task: Task) => void;
  onMove: (taskId: string, date: string) => Promise<void>;
  onSelectDate: (date: Date) => void;
  onToggle: (taskId: string) => Promise<void>;
  selectedDate: Date;
  tasks: Task[];
};

const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function CalendarView(props: CalendarViewProps) {
  if (props.mode === 'month') {
    return <MonthCalendar {...props} />;
  }

  return <TimeCalendar {...props} />;
}

function MonthCalendar({
  categories,
  currentDate,
  onAdd,
  onEdit,
  onMove,
  onSelectDate,
  onToggle,
  selectedDate,
  tasks,
}: CalendarViewProps) {
  const categoryColors = new Map(categories.map((category) => [category.id, category.color]));
  const days = getMonthDays(currentDate);

  return (
    <section className="calendar-layout">
      <div className="calendar-card">
        <div className="weekday-row">
          {weekNames.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="month-grid">
          {days.map((day) => {
            const dateKey = toDateKey(day);
            const dayTasks = tasks.filter((task) => task.dueDate === dateKey);
            const selected = isSameDay(day, selectedDate);

            return (
              <div
                aria-label={format(day, 'M 月 d 日', { locale: zhCN })}
                className={`day-cell${selected ? ' selected' : ''}${isToday(day) ? ' today' : ''}`}
                key={dateKey}
                onClick={() => onSelectDate(day)}
                onDoubleClick={() => onAdd(dateKey)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = event.dataTransfer.getData('text/task-id');
                  if (taskId) void onMove(taskId, dateKey);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSelectDate(day);
                }}
                role="button"
                tabIndex={0}
              >
                <span className={isSameMonth(day, currentDate) ? 'day-number' : 'day-number muted'}>
                  {format(day, 'd')}
                </span>
                <span className="cell-tasks">
                  {dayTasks.slice(0, 4).map((task) => (
                    <button
                      className={`calendar-task ${task.priority}${task.completedAt ? ' completed' : ''}`}
                      draggable
                      key={task.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(task);
                      }}
                      onDragStart={(event) => event.dataTransfer.setData('text/task-id', task.id)}
                      type="button"
                    >
                      <i style={{ background: categoryColors.get(task.categoryId) ?? '#8b8e99' }} />
                      {task.dueTime && <small>{task.dueTime}</small>}
                      <span>{task.title}</span>
                    </button>
                  ))}
                  {dayTasks.length > 4 && (
                    <span className="more-tasks">还有 {dayTasks.length - 4} 项</span>
                  )}
                </span>
                <button
                  aria-label={`在 ${format(day, 'M 月 d 日')} 添加任务`}
                  className="cell-add"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAdd(dateKey);
                  }}
                  type="button"
                >
                  <CirclePlus size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <DayPanel
        categories={categories}
        date={selectedDate}
        onAdd={onAdd}
        onEdit={onEdit}
        onToggle={onToggle}
        tasks={tasks.filter((task) => task.dueDate === toDateKey(selectedDate))}
      />
    </section>
  );
}

function TimeCalendar({
  categories,
  currentDate,
  mode,
  onAdd,
  onEdit,
  onMove,
  tasks,
}: CalendarViewProps) {
  const days = mode === 'week' ? getWeekDays(currentDate) : [currentDate];
  const categoryColors = new Map(categories.map((category) => [category.id, category.color]));
  const hours = Array.from({ length: 15 }, (_, index) => index + 7);
  const calendarHeight = hours.length * 56;

  return (
    <section className={`time-calendar ${mode}`}>
      <div className="time-calendar-header">
        <span />
        {days.map((day) => (
          <button
            className={isToday(day) ? 'current' : ''}
            key={toDateKey(day)}
            onClick={() => onAdd(toDateKey(day))}
            type="button"
          >
            <small>{format(day, 'EEE', { locale: zhCN })}</small>
            <strong>{format(day, 'd')}</strong>
          </button>
        ))}
      </div>
      <div className="all-day-row">
        <span>全天</span>
        {days.map((day) => {
          const dateKey = toDateKey(day);
          return (
            <div key={dateKey}>
              {tasks
                .filter((task) => task.dueDate === dateKey && !task.dueTime)
                .map((task) => (
                  <button
                    className={`all-day-task ${task.priority}`}
                    key={task.id}
                    onClick={() => onEdit(task)}
                    type="button"
                  >
                    <i style={{ background: categoryColors.get(task.categoryId) }} />
                    {task.title}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      <div className="time-calendar-scroll">
        <div className="time-axis" style={{ height: calendarHeight }}>
          {hours.map((hour) => (
            <span
              key={hour}
              style={{ top: (hour - 7) * 56 }}
            >{`${String(hour).padStart(2, '0')}:00`}</span>
          ))}
        </div>
        <div className="schedule-columns">
          {days.map((day) => {
            const dateKey = toDateKey(day);
            const timedTasks = tasks.filter((task) => task.dueDate === dateKey && task.dueTime);
            return (
              <div
                className="schedule-column"
                key={dateKey}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const taskId = event.dataTransfer.getData('text/task-id');
                  if (taskId) void onMove(taskId, dateKey);
                }}
                style={{ height: calendarHeight }}
              >
                {hours.map((hour) => (
                  <i className="hour-line" key={hour} style={{ top: (hour - 7) * 56 }} />
                ))}
                {timedTasks.map((task) => {
                  const top = Math.max(0, ((minutesFromTime(task.dueTime) - 7 * 60) / 60) * 56);
                  const height = Math.max(30, Math.min(112, (task.duration / 60) * 56));
                  return (
                    <button
                      className={`timed-task ${task.priority}${task.completedAt ? ' completed' : ''}`}
                      draggable
                      key={task.id}
                      onClick={() => onEdit(task)}
                      onDragStart={(event) => event.dataTransfer.setData('text/task-id', task.id)}
                      style={{ borderColor: categoryColors.get(task.categoryId), height, top }}
                      type="button"
                    >
                      <strong>{task.title}</strong>
                      <small>
                        {task.dueTime} - {task.duration} 分钟
                      </small>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type DayPanelProps = {
  categories: Category[];
  date: Date;
  onAdd: (date: string) => void;
  onEdit: (task: Task) => void;
  onToggle: (taskId: string) => Promise<void>;
  tasks: Task[];
};

function DayPanel({ categories, date, onAdd, onEdit, onToggle, tasks }: DayPanelProps) {
  const categoryColors = new Map(categories.map((category) => [category.id, category.color]));
  const completed = tasks.filter((task) => task.completedAt).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  return (
    <aside className="day-panel">
      <div className="day-panel-heading">
        <div>
          <p>{format(date, 'EEEE', { locale: zhCN })}</p>
          <h2>{format(date, 'M 月 d 日', { locale: zhCN })}</h2>
        </div>
        <span>{tasks.length} 项</span>
      </div>
      <div className="day-progress" title={`完成 ${progress}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="agenda-list">
        {tasks.length ? (
          tasks.map((task) => (
            <article className={`agenda-item${task.completedAt ? ' completed' : ''}`} key={task.id}>
              <button
                aria-label={`${task.completedAt ? '恢复' : '完成'} ${task.title}`}
                className="task-check"
                onClick={() => void onToggle(task.id)}
                type="button"
              >
                {task.completedAt && <Check size={12} />}
              </button>
              <button className="agenda-content" onClick={() => onEdit(task)} type="button">
                <h3>{task.title}</h3>
                <p>
                  {task.dueTime ? (
                    <>
                      <Clock3 size={11} />
                      {task.dueTime} - {task.duration} 分钟
                    </>
                  ) : (
                    '全天'
                  )}
                </p>
              </button>
              <span
                className={`priority-mark ${task.priority}`}
                style={{
                  boxShadow: `0 0 0 2px ${categoryColors.get(task.categoryId) ?? 'transparent'}33`,
                }}
              />
            </article>
          ))
        ) : (
          <div className="empty-agenda">
            <CalendarDays size={30} />
            <p>这一天还没有安排</p>
            <button onClick={() => onAdd(toDateKey(date))} type="button">
              添加任务
            </button>
          </div>
        )}
      </div>
      <button className="panel-add" onClick={() => onAdd(toDateKey(date))} type="button">
        <CirclePlus size={17} />
        添加当天任务
      </button>
    </aside>
  );
}
