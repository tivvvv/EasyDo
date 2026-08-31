import type {
  AppSettings,
  Category,
  Countdown,
  FocusSession,
  Habit,
  Priority,
  Section,
  Task,
} from '@easydo/domain';
import { priorityLabels } from '@easydo/domain';
import { differenceInCalendarDays, format, parseISO, startOfDay, subDays } from 'date-fns';
import {
  BarChart3,
  Columns3,
  Flame,
  Focus,
  Hourglass,
  LayoutGrid,
  ListTree,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type HubMode = 'kanban' | 'timeline' | 'matrix' | 'focus' | 'habits' | 'countdowns' | 'statistics';

type ProductivityHubProps = {
  categories: Category[];
  countdowns: Countdown[];
  focusSessions: FocusSession[];
  habits: Habit[];
  onAddCountdown: (title: string, date: string) => Promise<void>;
  onAddFocusSession: (session: {
    durationMinutes: number;
    endedAt: string;
    mode: FocusSession['mode'];
    startedAt: string;
    taskId: string | null;
  }) => Promise<void>;
  onAddHabit: (name: string) => Promise<void>;
  onAddSection: (categoryId: string, name: string) => Promise<void>;
  onDeleteCountdown: (id: string) => Promise<void>;
  onDeleteHabit: (id: string) => Promise<void>;
  onDeleteSection: (id: string) => Promise<void>;
  onEdit: (task: Task) => void;
  onToggleHabit: (id: string, dateKey: string) => Promise<void>;
  onUpdateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  sections: Section[];
  settings: AppSettings;
  tasks: Task[];
};

const modes: Array<{ icon: typeof Columns3; label: string; value: HubMode }> = [
  { icon: Columns3, label: '看板', value: 'kanban' },
  { icon: ListTree, label: '时间线', value: 'timeline' },
  { icon: LayoutGrid, label: '四象限', value: 'matrix' },
  { icon: Focus, label: '专注', value: 'focus' },
  { icon: Flame, label: '习惯', value: 'habits' },
  { icon: Hourglass, label: '倒数日', value: 'countdowns' },
  { icon: BarChart3, label: '统计', value: 'statistics' },
];

export function ProductivityHub(props: ProductivityHubProps) {
  const [mode, setMode] = useState<HubMode>('kanban');

  return (
    <section className="productivity-hub">
      <nav className="hub-tabs" aria-label="效率工具">
        {modes.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={mode === item.value ? 'active' : ''}
              key={item.value}
              onClick={() => setMode(item.value)}
              type="button"
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>
      {mode === 'kanban' && <KanbanBoard {...props} />}
      {mode === 'timeline' && <Timeline tasks={props.tasks} onEdit={props.onEdit} />}
      {mode === 'matrix' && <EisenhowerMatrix {...props} />}
      {mode === 'focus' && <FocusTimer {...props} />}
      {mode === 'habits' && <HabitTracker {...props} />}
      {mode === 'countdowns' && <CountdownPanel {...props} />}
      {mode === 'statistics' && <Statistics {...props} />}
    </section>
  );
}

function KanbanBoard(props: ProductivityHubProps) {
  const [categoryId, setCategoryId] = useState(props.categories[0]?.id ?? '');
  const categoryTasks = props.tasks.filter((task) => task.categoryId === categoryId);
  const columns = [
    { id: null, name: '未分区', order: -1 },
    ...props.sections.filter((section) => section.categoryId === categoryId),
  ];

  const createSection = async () => {
    const name = window.prompt('请输入分区名称.');
    if (name?.trim()) await props.onAddSection(categoryId, name.trim());
  };

  return (
    <div className="hub-panel">
      <div className="hub-heading">
        <div>
          <p>按分区推进工作</p>
          <h2>任务看板</h2>
        </div>
        <div className="hub-actions">
          <select
            aria-label="看板分类"
            onChange={(event) => setCategoryId(event.target.value)}
            value={categoryId}
          >
            {props.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button className="secondary-button" onClick={() => void createSection()} type="button">
            <Plus size={15} />
            新建分区
          </button>
        </div>
      </div>
      <div className="kanban-board">
        {columns.map((column) => {
          const tasks = categoryTasks.filter((task) => task.sectionId === column.id);
          return (
            <article
              className="kanban-column"
              key={column.id ?? 'none'}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = event.dataTransfer.getData('text/task-id');
                if (id) void props.onUpdateTask(id, { sectionId: column.id });
              }}
            >
              <header>
                <strong>{column.name}</strong>
                <span>{tasks.length}</span>
                {column.id && (
                  <button
                    aria-label={`删除分区 ${column.name}`}
                    onClick={() => void props.onDeleteSection(column.id!)}
                    type="button"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </header>
              <div>
                {tasks.map((task) => (
                  <button
                    className="kanban-card"
                    draggable
                    key={task.id}
                    onClick={() => props.onEdit(task)}
                    onDragStart={(event) => event.dataTransfer.setData('text/task-id', task.id)}
                    type="button"
                  >
                    <span className={`priority-dot ${task.priority}`} />
                    <strong>{task.title}</strong>
                    <small>
                      {task.dueDate ?? '未安排日期'}
                      {task.dueTime ? ` ${task.dueTime}` : ''}
                    </small>
                  </button>
                ))}
                {tasks.length === 0 && <p className="column-empty">拖动任务到这里</p>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ onEdit, tasks }: { onEdit: (task: Task) => void; tasks: Task[] }) {
  const datedTasks = tasks
    .filter((task) => task.dueDate)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const firstDate = datedTasks[0]?.dueDate
    ? parseISO(datedTasks[0].dueDate)
    : startOfDay(new Date());
  const lastDate = datedTasks.at(-1)?.endDate ?? datedTasks.at(-1)?.dueDate;
  const totalDays = Math.max(
    7,
    lastDate ? differenceInCalendarDays(parseISO(lastDate), firstDate) + 1 : 7,
  );
  return (
    <div className="hub-panel">
      <div className="hub-heading">
        <div>
          <p>直观看清跨度和重叠</p>
          <h2>任务时间线</h2>
        </div>
      </div>
      <div className="timeline-list">
        {datedTasks.map((task) => {
          const start = differenceInCalendarDays(parseISO(task.dueDate!), firstDate);
          const span = Math.max(
            1,
            task.endDate
              ? differenceInCalendarDays(parseISO(task.endDate), parseISO(task.dueDate!)) + 1
              : 1,
          );
          return (
            <button key={task.id} onClick={() => onEdit(task)} type="button">
              <span>
                {task.title}
                <small>
                  {task.dueDate}
                  {task.endDate ? ` - ${task.endDate}` : ''}
                </small>
              </span>
              <i
                className={`timeline-bar ${task.priority}`}
                style={{
                  marginLeft: `${(start / totalDays) * 100}%`,
                  width: `${Math.max(3, (span / totalDays) * 100)}%`,
                }}
              />
            </button>
          );
        })}
        {datedTasks.length === 0 && <EmptyText text="安排任务日期后, 时间线会显示任务跨度." />}
      </div>
    </div>
  );
}

function EisenhowerMatrix(props: ProductivityHubProps) {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const quadrants = [
    { important: true, label: '重要且紧急', urgent: true },
    { important: true, label: '重要不紧急', urgent: false },
    { important: false, label: '紧急不重要', urgent: true },
    { important: false, label: '不重要不紧急', urgent: false },
  ];
  const isUrgent = (task: Task) => Boolean(task.dueDate && task.dueDate <= todayKey);
  return (
    <div className="hub-panel">
      <div className="hub-heading">
        <div>
          <p>用重要和紧急做取舍</p>
          <h2>四象限</h2>
        </div>
      </div>
      <div className="matrix-grid">
        {quadrants.map((quadrant) => (
          <article
            key={quadrant.label}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = event.dataTransfer.getData('text/task-id');
              if (!id) return;
              const task = props.tasks.find((item) => item.id === id);
              const patch: Partial<Task> = { important: quadrant.important };
              if (task && quadrant.urgent !== isUrgent(task))
                patch.dueDate = quadrant.urgent ? todayKey : null;
              void props.onUpdateTask(id, patch);
            }}
          >
            <header>
              <strong>{quadrant.label}</strong>
            </header>
            {props.tasks
              .filter(
                (task) =>
                  task.important === quadrant.important && isUrgent(task) === quadrant.urgent,
              )
              .map((task) => (
                <button
                  draggable
                  key={task.id}
                  onClick={() => props.onEdit(task)}
                  onDragStart={(event) => event.dataTransfer.setData('text/task-id', task.id)}
                  type="button"
                >
                  <span className={`priority-dot ${task.priority}`} />
                  {task.title}
                </button>
              ))}
          </article>
        ))}
      </div>
    </div>
  );
}

function FocusTimer(props: ProductivityHubProps) {
  const [taskId, setTaskId] = useState<string>('');
  const [remaining, setRemaining] = useState(props.settings.pomodoroMinutes * 60);
  const [running, setRunning] = useState(false);
  const startedAt = useRef<string | null>(null);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (remaining !== 0 || !running || !startedAt.current) return;
    setRunning(false);
    void props.onAddFocusSession({
      durationMinutes: props.settings.pomodoroMinutes,
      endedAt: new Date().toISOString(),
      mode: 'pomodoro',
      startedAt: startedAt.current,
      taskId: taskId || null,
    });
  }, [props, remaining, running, taskId]);

  const reset = () => {
    setRunning(false);
    setRemaining(props.settings.pomodoroMinutes * 60);
    startedAt.current = null;
  };

  return (
    <div className="hub-panel focus-panel">
      <div className="hub-heading">
        <div>
          <p>一次只做好一件事</p>
          <h2>番茄专注</h2>
        </div>
      </div>
      <div className="focus-clock">
        <span>
          {String(Math.floor(remaining / 60)).padStart(2, '0')}:
          {String(remaining % 60).padStart(2, '0')}
        </span>
        <select
          aria-label="关联任务"
          disabled={running}
          onChange={(event) => setTaskId(event.target.value)}
          value={taskId}
        >
          <option value="">不关联任务</option>
          {props.tasks
            .filter((task) => !task.completedAt)
            .map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
        </select>
        <div>
          <button
            className="primary-button"
            onClick={() => {
              if (!startedAt.current) startedAt.current = new Date().toISOString();
              setRunning((value) => !value);
            }}
            type="button"
          >
            {running ? <Pause size={17} /> : <Play size={17} />}
            {running ? '暂停' : '开始'}
          </button>
          <button className="secondary-button" onClick={reset} type="button">
            <RotateCcw size={16} />
            重置
          </button>
        </div>
      </div>
      <p className="focus-summary">
        累计完成 {props.focusSessions.length} 次专注, 共{' '}
        {props.focusSessions.reduce((sum, item) => sum + item.durationMinutes, 0)} 分钟.
      </p>
    </div>
  );
}

function HabitTracker(props: ProductivityHubProps) {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const days = Array.from({ length: 7 }, (_, index) => subDays(new Date(), 6 - index));
  const createHabit = async () => {
    const name = window.prompt('请输入习惯名称.');
    if (name?.trim()) await props.onAddHabit(name.trim());
  };
  return (
    <div className="hub-panel">
      <div className="hub-heading">
        <div>
          <p>小步积累可见进步</p>
          <h2>习惯打卡</h2>
        </div>
        <button className="secondary-button" onClick={() => void createHabit()} type="button">
          <Plus size={15} />
          新建习惯
        </button>
      </div>
      <div className="habit-list">
        {props.habits.map((habit) => (
          <article key={habit.id}>
            <header>
              <i style={{ background: habit.color }} />
              <strong>{habit.name}</strong>
              <span>累计 {habit.logs.length} 天</span>
              <button
                aria-label={`删除习惯 ${habit.name}`}
                onClick={() => void props.onDeleteHabit(habit.id)}
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </header>
            <div>
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const done = habit.logs.includes(key);
                return (
                  <button
                    aria-label={`${key}${done ? '已' : '未'}打卡`}
                    className={done ? 'done' : ''}
                    key={key}
                    onClick={() => void props.onToggleHabit(habit.id, key)}
                    type="button"
                  >
                    <small>{format(day, 'EEE')}</small>
                    <span>{format(day, 'd')}</span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
        {props.habits.length === 0 && <EmptyText text="创建第一个习惯, 从今天开始打卡." />}
      </div>
      {props.habits.some((habit) => habit.logs.includes(todayKey)) && (
        <p className="habit-cheer">今天已经开始积累了.</p>
      )}
    </div>
  );
}

function CountdownPanel(props: ProductivityHubProps) {
  const createCountdown = async () => {
    const title = window.prompt('请输入倒数日名称.');
    if (!title?.trim()) return;
    const date = window.prompt('请输入日期, 格式为 YYYY-MM-DD.');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) await props.onAddCountdown(title.trim(), date);
  };
  return (
    <div className="hub-panel">
      <div className="hub-heading">
        <div>
          <p>记住重要的日子</p>
          <h2>倒数日</h2>
        </div>
        <button className="secondary-button" onClick={() => void createCountdown()} type="button">
          <Plus size={15} />
          添加倒数日
        </button>
      </div>
      <div className="countdown-grid">
        {props.countdowns.map((item) => {
          const days = differenceInCalendarDays(parseISO(item.date), startOfDay(new Date()));
          return (
            <article key={item.id} style={{ borderColor: item.color }}>
              <button
                aria-label={`删除倒数日 ${item.title}`}
                onClick={() => void props.onDeleteCountdown(item.id)}
                type="button"
              >
                <Trash2 size={14} />
              </button>
              <span>{days >= 0 ? '还有' : '已经过去'}</span>
              <strong>{Math.abs(days)}</strong>
              <small>天</small>
              <h3>{item.title}</h3>
              <time>{item.date}</time>
            </article>
          );
        })}
        {props.countdowns.length === 0 && (
          <EmptyText text="添加纪念日或截止日, 随时掌握剩余天数." />
        )}
      </div>
    </div>
  );
}

function Statistics(props: ProductivityHubProps) {
  const completed = props.tasks.filter((task) => task.completedAt);
  const total = props.tasks.length;
  const completionRate = total ? Math.round((completed.length / total) * 100) : 0;
  const priorities: Priority[] = ['high', 'medium', 'low', 'none'];
  const lastSeven = Array.from({ length: 7 }, (_, index) => subDays(new Date(), 6 - index));
  return (
    <div className="hub-panel">
      <div className="hub-heading">
        <div>
          <p>用趋势改进安排</p>
          <h2>效率统计</h2>
        </div>
      </div>
      <div className="stat-cards">
        <article>
          <strong>{completed.length}</strong>
          <span>完成任务</span>
        </article>
        <article>
          <strong>{completionRate}%</strong>
          <span>完成率</span>
        </article>
        <article>
          <strong>
            {props.focusSessions.reduce((sum, item) => sum + item.durationMinutes, 0)}
          </strong>
          <span>专注分钟</span>
        </article>
        <article>
          <strong>{props.habits.reduce((sum, item) => sum + item.logs.length, 0)}</strong>
          <span>习惯打卡</span>
        </article>
      </div>
      <div className="statistics-grid">
        <article>
          <h3>最近 7 天完成趋势</h3>
          <div className="bar-chart">
            {lastSeven.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const count = completed.filter((task) => task.completedAt?.startsWith(key)).length;
              return (
                <span key={key}>
                  <i style={{ height: `${Math.max(8, count * 24)}px` }} />
                  <small>{format(day, 'EEE')}</small>
                  <b>{count}</b>
                </span>
              );
            })}
          </div>
        </article>
        <article>
          <h3>未完成任务优先级</h3>
          {priorities.map((priority) => {
            const count = props.tasks.filter(
              (task) => !task.completedAt && task.priority === priority,
            ).length;
            return (
              <div className="stat-row" key={priority}>
                <span>{priorityLabels[priority]}</span>
                <i>
                  <b
                    className={priority}
                    style={{ width: `${total ? (count / total) * 100 : 0}%` }}
                  />
                </i>
                <strong>{count}</strong>
              </div>
            );
          })}
        </article>
      </div>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="hub-empty">{text}</p>;
}
