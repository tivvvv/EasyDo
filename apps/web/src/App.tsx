import type { Priority, Task, TaskDraft } from '@easydo/domain';
import { matchesTaskSearch, priorityLabels, sortTasks } from '@easydo/domain';
import { addDays, addMonths, addWeeks, format, isSameDay, startOfDay, startOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Inbox,
  ListTodo,
  Menu,
  Search,
  Settings,
  Tag as TagIcon,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  addCategory,
  addTag,
  addTask,
  db,
  deleteTask,
  toggleTask,
  updateTask,
} from '@easydo/storage';

import { CalendarView, type CalendarMode } from './components/CalendarView';
import { CollectionDialog } from './components/CollectionDialog';
import { TaskDialog } from './components/TaskDialog';
import { TaskList } from './components/TaskList';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import { toDateKey } from './lib/calendar';
import './styles.css';

type View =
  | { kind: 'all' | 'calendar' | 'inbox' | 'settings' | 'today' }
  | { id: string; kind: 'category' | 'tag' };

const today = startOfDay(new Date());

export function App() {
  const data = useWorkspaceData();
  const [view, setView] = useState<View>({ kind: 'calendar' });
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [collectionDialog, setCollectionDialog] = useState<'category' | 'tag' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const openNewTask = (date: string | null) => {
    setEditingTask(null);
    setDialogDate(date);
    setTaskDialogOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input, textarea, select');

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (!typing && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openNewTask(
          view.kind === 'calendar' || view.kind === 'today' ? toDateKey(selectedDate) : null,
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  if (!data) {
    return (
      <div className="loading-screen">
        <span className="brand-mark">
          <Check size={20} strokeWidth={3} />
        </span>
        <p>正在整理你的日程...</p>
      </div>
    );
  }

  const { categories, tags, tasks } = data;
  const filteredTasks = sortTasks(
    tasks.filter(
      (task) =>
        matchesTaskSearch(task, search) && (priority === 'all' || task.priority === priority),
    ),
  );
  const viewTasks = getViewTasks(filteredTasks, view);
  const title = getViewTitle(view, categories, tags);

  const saveTask = async (draft: TaskDraft, id?: string) => {
    if (id) {
      await updateTask(id, draft);
      showToast('任务已更新.');
    } else {
      await addTask(draft);
      showToast('任务已创建.');
    }
  };

  const chooseView = (nextView: View) => {
    setView(nextView);
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <button
        aria-label="打开导航"
        className="mobile-menu-button"
        onClick={() => setMobileMenuOpen(true)}
        type="button"
      >
        <Menu size={21} />
      </button>
      {mobileMenuOpen && (
        <button
          aria-label="关闭导航"
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
      )}
      <aside className={`sidebar${mobileMenuOpen ? ' mobile-open' : ''}`}>
        <div className="brand-row">
          <span className="brand-mark">
            <Check size={18} strokeWidth={3} />
          </span>
          <span>EasyDo</span>
          <button
            aria-label="关闭导航"
            className="mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <button
          className="quick-add"
          onClick={() => openNewTask(view.kind === 'calendar' ? toDateKey(selectedDate) : null)}
          type="button"
        >
          <CirclePlus size={18} />
          添加任务<kbd>N</kbd>
        </button>
        <nav className="nav-group" aria-label="主要视图">
          <NavButton
            active={view.kind === 'inbox'}
            count={tasks.filter((task) => !task.dueDate && !task.completedAt).length}
            icon={<Inbox size={18} />}
            label="收集箱"
            onClick={() => chooseView({ kind: 'inbox' })}
          />
          <NavButton
            active={view.kind === 'today'}
            count={
              tasks.filter((task) => task.dueDate === toDateKey(today) && !task.completedAt).length
            }
            icon={<Check size={18} />}
            label="今天"
            onClick={() => chooseView({ kind: 'today' })}
          />
          <NavButton
            active={view.kind === 'calendar'}
            icon={<CalendarDays size={18} />}
            label="日历"
            onClick={() => chooseView({ kind: 'calendar' })}
          />
          <NavButton
            active={view.kind === 'all'}
            count={tasks.filter((task) => !task.completedAt).length}
            icon={<ListTodo size={18} />}
            label="全部任务"
            onClick={() => chooseView({ kind: 'all' })}
          />
        </nav>

        <SidebarSection label="分类" onAdd={() => setCollectionDialog('category')}>
          {categories.map((category) => (
            <NavButton
              active={view.kind === 'category' && view.id === category.id}
              count={
                tasks.filter((task) => task.categoryId === category.id && !task.completedAt).length
              }
              icon={<span className="list-dot" style={{ background: category.color }} />}
              key={category.id}
              label={category.name}
              onClick={() => chooseView({ id: category.id, kind: 'category' })}
            />
          ))}
        </SidebarSection>

        <SidebarSection label="标签" onAdd={() => setCollectionDialog('tag')}>
          {tags.map((tag) => (
            <NavButton
              active={view.kind === 'tag' && view.id === tag.id}
              count={
                tasks.filter((task) => task.tagIds.includes(tag.id) && !task.completedAt).length
              }
              icon={<TagIcon size={15} style={{ color: tag.color }} />}
              key={tag.id}
              label={tag.name}
              onClick={() => chooseView({ id: tag.id, kind: 'tag' })}
            />
          ))}
        </SidebarSection>

        <div className="sidebar-footer">
          <NavButton
            active={view.kind === 'settings'}
            icon={<Settings size={18} />}
            label="设置与数据"
            onClick={() => chooseView({ kind: 'settings' })}
          />
          <p>所有数据仅保存在此设备</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{view.kind === 'calendar' ? '日历' : '任务'}</p>
            <h1>{view.kind === 'calendar' ? calendarTitle(currentDate, calendarMode) : title}</h1>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={17} />
              <input
                aria-label="搜索任务"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索任务"
                ref={searchRef}
                value={search}
              />
              {search ? (
                <button aria-label="清除搜索" onClick={() => setSearch('')} type="button">
                  <X size={14} />
                </button>
              ) : (
                <kbd>⌘ K</kbd>
              )}
            </label>
            <label className="filter-select">
              <span className="sr-only">按优先级筛选</span>
              <select
                onChange={(event) => setPriority(event.target.value as Priority | 'all')}
                value={priority}
              >
                <option value="all">全部优先级</option>
                {(['high', 'medium', 'low', 'none'] as Priority[]).map((item) => (
                  <option key={item} value={item}>
                    {priorityLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            {view.kind === 'calendar' && (
              <>
                <div className="view-switcher" aria-label="日历视图">
                  {(['month', 'week', 'day'] as CalendarMode[]).map((mode) => (
                    <button
                      className={calendarMode === mode ? 'active' : ''}
                      key={mode}
                      onClick={() => setCalendarMode(mode)}
                      type="button"
                    >
                      {{ month: '月', week: '周', day: '日' }[mode]}
                    </button>
                  ))}
                </div>
                <button
                  className="today-button"
                  onClick={() => {
                    setCurrentDate(today);
                    setSelectedDate(today);
                  }}
                  type="button"
                >
                  今天
                </button>
                <button
                  className="icon-button"
                  aria-label="上一段时间"
                  onClick={() => setCurrentDate(navigateDate(currentDate, calendarMode, -1))}
                  type="button"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="下一段时间"
                  onClick={() => setCurrentDate(navigateDate(currentDate, calendarMode, 1))}
                  type="button"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
        </header>

        {view.kind === 'calendar' ? (
          <CalendarView
            categories={categories}
            currentDate={currentDate}
            mode={calendarMode}
            onAdd={openNewTask}
            onEdit={(task) => {
              setEditingTask(task);
              setTaskDialogOpen(true);
            }}
            onMove={async (taskId, dueDate) => {
              await updateTask(taskId, { dueDate });
              showToast('任务日期已调整.');
            }}
            onSelectDate={(date) => {
              setSelectedDate(date);
              if (!isSameDay(date, currentDate)) setCurrentDate(date);
            }}
            onToggle={async (taskId) => {
              await toggleTask(taskId);
            }}
            selectedDate={selectedDate}
            tasks={filteredTasks}
          />
        ) : view.kind === 'settings' ? (
          <SettingsView
            categories={categories.length}
            onClearCompleted={async () => {
              await db.tasks.filter((task) => Boolean(task.completedAt)).delete();
              showToast('已清理完成任务.');
            }}
            tags={tags.length}
            tasks={tasks.length}
          />
        ) : (
          <TaskList
            categories={categories}
            emptyTitle={search ? '没有匹配的任务' : `${title}是空的`}
            onAdd={() => openNewTask(view.kind === 'today' ? toDateKey(today) : null)}
            onEdit={(task) => {
              setEditingTask(task);
              setTaskDialogOpen(true);
            }}
            onToggle={async (taskId) => {
              await toggleTask(taskId);
            }}
            tags={tags}
            tasks={viewTasks}
            title={title}
          />
        )}
      </main>

      {taskDialogOpen && (
        <TaskDialog
          categories={categories}
          defaultDate={dialogDate}
          onClose={() => setTaskDialogOpen(false)}
          onDelete={async (id) => {
            await deleteTask(id);
            showToast('任务已删除.');
          }}
          onSave={saveTask}
          open
          tags={tags}
          task={editingTask}
        />
      )}
      {collectionDialog && (
        <CollectionDialog
          kind={collectionDialog}
          onClose={() => setCollectionDialog(null)}
          onSave={async (name, color) => {
            if (collectionDialog === 'tag') await addTag(name, color);
            else await addCategory(name, color);
            showToast(collectionDialog === 'tag' ? '标签已创建.' : '分类已创建.');
          }}
          open
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}

type NavButtonProps = {
  active: boolean;
  count?: number;
  icon: ReactNode;
  label: string;
  onClick: () => void;
};
function NavButton({ active, count, icon, label, onClick }: NavButtonProps) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick} type="button">
      {icon}
      <span>{label}</span>
      {count !== undefined && count > 0 && <span className="nav-count">{count}</span>}
    </button>
  );
}

function SidebarSection({
  children,
  label,
  onAdd,
}: {
  children: ReactNode;
  label: string;
  onAdd: () => void;
}) {
  return (
    <div className="sidebar-section">
      <div className="section-label">
        <span>{label}</span>
        <button aria-label={`新建${label}`} onClick={onAdd} type="button">
          <CirclePlus size={15} />
        </button>
      </div>
      {children}
    </div>
  );
}

function getViewTasks(tasks: Task[], view: View): Task[] {
  if (view.kind === 'today') return tasks.filter((task) => task.dueDate === toDateKey(today));
  if (view.kind === 'inbox') return tasks.filter((task) => !task.dueDate);
  if (view.kind === 'category') return tasks.filter((task) => task.categoryId === view.id);
  if (view.kind === 'tag') return tasks.filter((task) => task.tagIds.includes(view.id));
  return tasks;
}

function getViewTitle(
  view: View,
  categories: { id: string; name: string }[],
  tags: { id: string; name: string }[],
): string {
  if (view.kind === 'today') return '今天';
  if (view.kind === 'inbox') return '收集箱';
  if (view.kind === 'all') return '全部任务';
  if (view.kind === 'category')
    return categories.find((item) => item.id === view.id)?.name ?? '分类';
  if (view.kind === 'tag') return `#${tags.find((item) => item.id === view.id)?.name ?? '标签'}`;
  return '设置与数据';
}

function navigateDate(date: Date, mode: CalendarMode, amount: number): Date {
  if (mode === 'month') return addMonths(date, amount);
  if (mode === 'week') return addWeeks(date, amount);
  return addDays(date, amount);
}

function calendarTitle(date: Date, mode: CalendarMode): string {
  if (mode === 'month') return format(date, 'yyyy 年 M 月', { locale: zhCN });
  if (mode === 'day') return format(date, 'M 月 d 日 EEEE', { locale: zhCN });
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = addDays(start, 6);
  return `${format(start, 'M 月 d 日')} - ${format(end, 'M 月 d 日')}`;
}

function SettingsView({
  categories,
  onClearCompleted,
  tags,
  tasks,
}: {
  categories: number;
  onClearCompleted: () => Promise<void>;
  tags: number;
  tasks: number;
}) {
  return (
    <section className="settings-view">
      <div className="settings-card">
        <div className="settings-icon">
          <Settings size={23} />
        </div>
        <div>
          <p>本地数据</p>
          <h2>你的数据只属于你</h2>
          <span>EasyDo 使用浏览器本地数据库保存内容, 不会上传任务或日程.</span>
        </div>
      </div>
      <div className="data-stats">
        <article>
          <strong>{tasks}</strong>
          <span>任务</span>
        </article>
        <article>
          <strong>{categories}</strong>
          <span>分类</span>
        </article>
        <article>
          <strong>{tags}</strong>
          <span>标签</span>
        </article>
      </div>
      <div className="settings-row">
        <div>
          <strong>清理已完成任务</strong>
          <p>永久删除所有已完成任务, 未完成任务不受影响.</p>
        </div>
        <button
          className="danger-button"
          onClick={() => window.confirm('确定永久删除所有已完成任务吗?') && void onClearCompleted()}
          type="button"
        >
          立即清理
        </button>
      </div>
    </section>
  );
}
