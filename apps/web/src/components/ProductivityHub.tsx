import type { Priority, Task } from '@easydo/domain';
import { priorityLabels, taskProgress } from '@easydo/domain';
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay, subDays } from 'date-fns';
import {
  BarChart3,
  Columns3,
  Flame,
  Focus,
  Hourglass,
  LayoutGrid,
  ListTree,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import { FocusTimer, HabitTracker } from './productivity/FocusHabits';
import type { ProductivityHubProps } from './productivity/types';

type HubMode = 'kanban' | 'timeline' | 'matrix' | 'focus' | 'habits' | 'countdowns' | 'statistics';

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
                <span title={`${tasks.length} 项任务`}>{tasks.length}</span>
                <button
                  aria-label={`在 ${column.name} 新建任务`}
                  onClick={() => props.onCreateTask({ categoryId, sectionId: column.id })}
                  title="在此分区新建任务"
                  type="button"
                >
                  <Plus size={13} />
                </button>
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
                    {task.subtasks.length > 0 && (
                      <span className="kanban-progress">
                        <i
                          style={{
                            width: `${(taskProgress(task).completed / taskProgress(task).total) * 100}%`,
                          }}
                        />
                        {taskProgress(task).completed}/{taskProgress(task).total}
                      </span>
                    )}
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
  const [rangeDays, setRangeDays] = useState(30);
  const [rangeStart, setRangeStart] = useState(startOfDay(new Date()));
  const rangeEnd = addDays(rangeStart, rangeDays - 1);
  const datedTasks = tasks
    .filter(
      (task) =>
        task.dueDate &&
        parseISO(task.dueDate) <= rangeEnd &&
        parseISO(task.endDate ?? task.dueDate) >= rangeStart,
    )
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const ticks = Array.from({ length: rangeDays }, (_, index) => addDays(rangeStart, index));
  const todayOffset = differenceInCalendarDays(startOfDay(new Date()), rangeStart);
  return (
    <div className="hub-panel">
      <div className="hub-heading">
        <div>
          <p>直观看清跨度和重叠</p>
          <h2>任务时间线</h2>
        </div>
        <div className="timeline-controls">
          <button onClick={() => setRangeStart(addDays(rangeStart, -rangeDays))} type="button">
            上一段
          </button>
          <button onClick={() => setRangeStart(startOfDay(new Date()))} type="button">
            今天
          </button>
          <button onClick={() => setRangeStart(addDays(rangeStart, rangeDays))} type="button">
            下一段
          </button>
          <select
            aria-label="时间线范围"
            onChange={(event) => setRangeDays(Number(event.target.value))}
            value={rangeDays}
          >
            <option value={14}>14 天</option>
            <option value={30}>30 天</option>
            <option value={90}>90 天</option>
          </select>
        </div>
      </div>
      <div className="timeline-window">
        <div
          className="timeline-scale"
          style={{ gridTemplateColumns: `repeat(${rangeDays}, 1fr)` }}
        >
          {ticks.map((day, index) => (
            <span
              className={
                format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'today' : ''
              }
              key={day.toISOString()}
            >
              {(rangeDays <= 14 || index % (rangeDays === 30 ? 3 : 7) === 0) && (
                <>
                  <strong>{format(day, 'd')}</strong>
                  <small>{format(day, index === 0 || day.getDate() === 1 ? 'M 月' : 'EEE')}</small>
                </>
              )}
            </span>
          ))}
        </div>
        <div className="timeline-list">
          {todayOffset >= 0 && todayOffset < rangeDays && (
            <i
              aria-hidden="true"
              className="timeline-today-line"
              style={{ left: `${((todayOffset + 0.5) / rangeDays) * 100}%` }}
            />
          )}
          {datedTasks.map((task) => {
            const start = Math.max(
              0,
              differenceInCalendarDays(parseISO(task.dueDate!), rangeStart),
            );
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
                    marginLeft: `${(start / rangeDays) * 100}%`,
                    width: `${Math.max(2, (Math.min(span, rangeDays - start) / rangeDays) * 100)}%`,
                  }}
                />
              </button>
            );
          })}
          {datedTasks.length === 0 && <EmptyText text="当前时间范围内还没有已安排任务." />}
        </div>
      </div>
    </div>
  );
}

function EisenhowerMatrix(props: ProductivityHubProps) {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [urgentDays, setUrgentDays] = useState(1);
  const urgentKey = format(addDays(new Date(), urgentDays - 1), 'yyyy-MM-dd');
  const quadrants = [
    { hint: '立即做', important: true, label: '重要且紧急', urgent: true },
    { hint: '计划做', important: true, label: '重要不紧急', urgent: false },
    { hint: '择机做', important: false, label: '紧急不重要', urgent: true },
    { hint: '减少做', important: false, label: '不重要不紧急', urgent: false },
  ];
  const isUrgent = (task: Task) => Boolean(task.dueDate && task.dueDate <= urgentKey);
  return (
    <div className="hub-panel">
      <div className="hub-heading">
        <div>
          <p>用重要和紧急做取舍</p>
          <h2>四象限</h2>
        </div>
        <label className="matrix-urgency">
          紧急范围
          <select
            onChange={(event) => setUrgentDays(Number(event.target.value))}
            value={urgentDays}
          >
            <option value={1}>今天到期</option>
            <option value={3}>3 天内</option>
            <option value={7}>7 天内</option>
          </select>
        </label>
      </div>
      <div className="matrix-grid">
        {quadrants.map((quadrant) => {
          const quadrantTasks = props.tasks.filter(
            (task) => task.important === quadrant.important && isUrgent(task) === quadrant.urgent,
          );
          return (
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
                <span>
                  <strong>{quadrant.label}</strong>
                  <small>{quadrant.hint}</small>
                </span>
                <b>{quadrantTasks.length}</b>
                <button
                  aria-label={`在 ${quadrant.label} 新建任务`}
                  onClick={() =>
                    props.onCreateTask({
                      dueDate: quadrant.urgent ? todayKey : null,
                      important: quadrant.important,
                    })
                  }
                  type="button"
                >
                  <Plus size={14} />
                </button>
              </header>
              {quadrantTasks.map((task) => (
                <button
                  draggable
                  key={task.id}
                  onClick={() => props.onEdit(task)}
                  onDragStart={(event) => event.dataTransfer.setData('text/task-id', task.id)}
                  type="button"
                >
                  <span className={`priority-dot ${task.priority}`} />
                  {task.title}
                  <small>{task.dueDate ?? '未安排'}</small>
                </button>
              ))}
              {quadrantTasks.length === 0 && <p>拖入任务或点击添加</p>}
            </article>
          );
        })}
      </div>
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
