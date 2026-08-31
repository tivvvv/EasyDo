import type { Category, Task } from '@easydo/domain';
import { addDays, format, isSameDay, isSameMonth, isToday, startOfDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarDays, Check, CirclePlus, Clock3, GripVertical, Inbox } from 'lucide-react';

import { getMonthDays, getWeekDays, minutesFromTime, toDateKey } from '../lib/calendar';

export type CalendarMode = 'month' | 'week' | 'day' | 'agenda';

type CalendarViewProps = {
  categories: Category[];
  currentDate: Date;
  mode: CalendarMode;
  onAdd: (date: string, time?: string | null) => void;
  onEdit: (task: Task) => void;
  onMove: (taskId: string, date: string, time?: string | null) => Promise<void>;
  onResize: (taskId: string, duration: number) => Promise<void>;
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

  if (props.mode === 'agenda') {
    return <AgendaCalendar {...props} />;
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
        onSelectDate={onSelectDate}
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
  onResize,
  tasks,
}: CalendarViewProps) {
  const days = mode === 'week' ? getWeekDays(currentDate) : [currentDate];
  const categoryColors = new Map(categories.map((category) => [category.id, category.color]));
  const hours = Array.from({ length: 15 }, (_, index) => index + 7);
  const calendarHeight = hours.length * 56;

  const unscheduled = tasks.filter((task) => !task.dueDate && !task.completedAt);

  return (
    <section className={`time-calendar ${mode}`}>
      {unscheduled.length > 0 && (
        <div className="unscheduled-tray">
          <span>
            <Inbox size={15} />
            待安排
          </span>
          <div>
            {unscheduled.map((task) => (
              <button
                draggable
                key={task.id}
                onClick={() => onEdit(task)}
                onDragStart={(event) => event.dataTransfer.setData('text/task-id', task.id)}
                type="button"
              >
                <GripVertical size={13} />
                {task.title}
              </button>
            ))}
          </div>
        </div>
      )}
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
                onDoubleClick={(event) => onAdd(dateKey, timeFromPointer(event))}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const taskId = event.dataTransfer.getData('text/task-id');
                  if (taskId) void onMove(taskId, dateKey, timeFromPointer(event));
                }}
                style={{ height: calendarHeight }}
              >
                {hours.map((hour) => (
                  <i className="hour-line" key={hour} style={{ top: (hour - 7) * 56 }} />
                ))}
                {layoutTimedTasks(timedTasks).map(({ column, columns, task }) => {
                  const top = Math.max(0, ((minutesFromTime(task.dueTime) - 7 * 60) / 60) * 56);
                  const height = Math.max(30, Math.min(112, (task.duration / 60) * 56));
                  return (
                    <button
                      className={`timed-task ${task.priority}${task.completedAt ? ' completed' : ''}`}
                      draggable
                      key={task.id}
                      onClick={() => onEdit(task)}
                      onDragStart={(event) => event.dataTransfer.setData('text/task-id', task.id)}
                      style={{
                        borderColor: categoryColors.get(task.categoryId),
                        height,
                        left: `calc(${(column / columns) * 100}% + 3px)`,
                        top,
                        width: `calc(${100 / columns}% - 6px)`,
                      }}
                      type="button"
                    >
                      <strong>{task.title}</strong>
                      <small>
                        {task.dueTime} - {task.duration} 分钟
                      </small>
                      <span
                        aria-label="调整时长"
                        aria-valuemax={720}
                        aria-valuemin={15}
                        aria-valuenow={task.duration}
                        className="resize-handle"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                            event.preventDefault();
                            event.stopPropagation();
                            const amount = event.key === 'ArrowDown' ? 15 : -15;
                            void onResize(task.id, Math.max(15, task.duration + amount));
                          }
                        }}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const startY = event.clientY;
                          const startDuration = task.duration;
                          const handleMove = (moveEvent: PointerEvent) => {
                            const next = Math.max(
                              15,
                              Math.round(
                                (startDuration + ((moveEvent.clientY - startY) / 56) * 60) / 15,
                              ) * 15,
                            );
                            event.currentTarget.parentElement?.style.setProperty(
                              'height',
                              `${Math.max(30, (next / 60) * 56)}px`,
                            );
                          };
                          const handleUp = (upEvent: PointerEvent) => {
                            window.removeEventListener('pointermove', handleMove);
                            window.removeEventListener('pointerup', handleUp);
                            const next = Math.max(
                              15,
                              Math.round(
                                (startDuration + ((upEvent.clientY - startY) / 56) * 60) / 15,
                              ) * 15,
                            );
                            void onResize(task.id, next);
                          };
                          window.addEventListener('pointermove', handleMove);
                          window.addEventListener('pointerup', handleUp, { once: true });
                        }}
                        role="slider"
                        tabIndex={0}
                      />
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
  onAdd: (date: string, time?: string | null) => void;
  onEdit: (task: Task) => void;
  onSelectDate: (date: Date) => void;
  onToggle: (taskId: string) => Promise<void>;
  tasks: Task[];
};

function DayPanel({
  categories,
  date,
  onAdd,
  onEdit,
  onSelectDate,
  onToggle,
  tasks,
}: DayPanelProps) {
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
      <div className="mini-calendar" aria-label="本周日期">
        {getWeekDays(date).map((day) => (
          <button
            className={`${isSameDay(day, date) ? 'selected' : ''}${isToday(day) ? ' today' : ''}`}
            key={toDateKey(day)}
            onClick={() => onSelectDate(day)}
            type="button"
          >
            <small>{format(day, 'EEEEE', { locale: zhCN })}</small>
            <strong>{format(day, 'd')}</strong>
          </button>
        ))}
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

function AgendaCalendar({
  categories,
  currentDate,
  onAdd,
  onEdit,
  onToggle,
  tasks,
}: CalendarViewProps) {
  const start = startOfDay(currentDate);
  const days = Array.from({ length: 14 }, (_, index) => addDays(start, index));
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  return (
    <section className="agenda-calendar">
      {days.map((day) => {
        const dateKey = toDateKey(day);
        const dayTasks = tasks.filter((task) => task.dueDate === dateKey);
        if (!dayTasks.length && !isToday(day)) return null;
        return (
          <article className="agenda-day" key={dateKey}>
            <header>
              <div>
                <strong>{format(day, 'd')}</strong>
                <span>{format(day, 'M 月 EEE', { locale: zhCN })}</span>
              </div>
              <button onClick={() => onAdd(dateKey)} type="button">
                <CirclePlus size={16} />
                添加
              </button>
            </header>
            <div>
              {dayTasks.length ? (
                dayTasks.map((task) => (
                  <button
                    className={task.completedAt ? 'completed' : ''}
                    key={task.id}
                    onClick={() => onEdit(task)}
                    type="button"
                  >
                    <span className="agenda-time">{task.dueTime ?? '全天'}</span>
                    <i style={{ background: categoryMap.get(task.categoryId)?.color }} />
                    <strong>{task.title}</strong>
                    <small>{categoryMap.get(task.categoryId)?.name}</small>
                    <span
                      aria-label={`${task.completedAt ? '恢复' : '完成'} ${task.title}`}
                      className="agenda-complete"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onToggle(task.id);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {task.completedAt && <Check size={12} />}
                    </span>
                  </button>
                ))
              ) : (
                <p>今天还没有安排.</p>
              )}
            </div>
          </article>
        );
      })}
      {!tasks.some((task) => task.dueDate && task.dueDate >= toDateKey(start)) && (
        <div className="empty-agenda">
          <CalendarDays size={34} />
          <p>未来 14 天还没有任务</p>
        </div>
      )}
    </section>
  );
}

function timeFromPointer(event: {
  clientY: number;
  currentTarget: EventTarget & HTMLElement;
}): string {
  const rect = event.currentTarget.getBoundingClientRect();
  const minutes = Math.max(
    7 * 60,
    Math.min(21 * 60 + 45, 7 * 60 + ((event.clientY - rect.top) / 56) * 60),
  );
  const snapped = Math.round(minutes / 15) * 15;
  return `${String(Math.floor(snapped / 60)).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`;
}

function layoutTimedTasks(tasks: Task[]): { column: number; columns: number; task: Task }[] {
  const sorted = [...tasks].sort(
    (left, right) => minutesFromTime(left.dueTime) - minutesFromTime(right.dueTime),
  );
  const groups: Task[][] = [];
  for (const task of sorted) {
    const start = minutesFromTime(task.dueTime);
    const group = groups.find((items) =>
      items.some((item) => {
        const itemStart = minutesFromTime(item.dueTime);
        return start < itemStart + item.duration && itemStart < start + task.duration;
      }),
    );
    if (group) group.push(task);
    else groups.push([task]);
  }
  return groups.flatMap((group) =>
    group.map((task, column) => ({ column, columns: group.length, task })),
  );
}
