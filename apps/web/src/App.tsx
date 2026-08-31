import type { Category, Priority, Tag, Task, TaskDraft } from '@easydo/domain';
import { matchesTaskSearch, priorityLabels, sortTasks } from '@easydo/domain';
import { addDays, addMonths, addWeeks, format, isSameDay, startOfDay, startOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Download,
  Edit3,
  Inbox,
  ListTodo,
  Menu,
  RotateCcw,
  Search,
  Settings,
  Tag as TagIcon,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  addCategory,
  addTag,
  db,
  deleteCategory,
  deleteTag,
  emptyTrash,
  exportBackup,
  replaceFromBackup,
  reorderCategories,
  updateCategory,
  updateTag,
} from '@easydo/storage';
import { parseBackup } from '@easydo/application';

import { taskService } from './application';
import { CalendarView, type CalendarMode } from './components/CalendarView';
import { CollectionDialog } from './components/CollectionDialog';
import { TaskDialog } from './components/TaskDialog';
import { TaskList } from './components/TaskList';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import { requestReminderPermission, useTaskReminders } from './hooks/useTaskReminders';
import { toDateKey } from './lib/calendar';
import './styles.css';

type View =
  | { kind: 'all' | 'calendar' | 'inbox' | 'settings' | 'today' | 'trash' }
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
  const [dialogTime, setDialogTime] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [collectionDialog, setCollectionDialog] = useState<{
    initial: Category | Tag | null;
    kind: 'category' | 'tag';
  } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const openNewTask = (date: string | null, time: string | null = null) => {
    setEditingTask(null);
    setDialogDate(date);
    setDialogTime(time);
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

  useTaskReminders(data?.tasks ?? []);

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
  const activeTasks = tasks.filter((task) => !task.deletedAt);
  const trashedTasks = tasks.filter((task) => task.deletedAt);
  const filteredTasks = sortTasks(
    activeTasks.filter(
      (task) =>
        matchesTaskSearch(task, search) && (priority === 'all' || task.priority === priority),
    ),
  );
  const viewTasks = getViewTasks(filteredTasks, view);
  const title = getViewTitle(view, categories, tags);

  const saveTask = async (draft: TaskDraft, id?: string) => {
    if (id) {
      await taskService.update(id, draft);
      showToast('任务已更新.');
    } else {
      await taskService.create(draft);
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
            count={activeTasks.filter((task) => !task.dueDate && !task.completedAt).length}
            icon={<Inbox size={18} />}
            label="收集箱"
            onClick={() => chooseView({ kind: 'inbox' })}
          />
          <NavButton
            active={view.kind === 'today'}
            count={
              activeTasks.filter((task) => task.dueDate === toDateKey(today) && !task.completedAt)
                .length
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
            count={activeTasks.filter((task) => !task.completedAt).length}
            icon={<ListTodo size={18} />}
            label="全部任务"
            onClick={() => chooseView({ kind: 'all' })}
          />
        </nav>

        <SidebarSection
          label="分类"
          onAdd={() => setCollectionDialog({ initial: null, kind: 'category' })}
        >
          {categories.map((category) => (
            <CollectionNavRow
              active={view.kind === 'category' && view.id === category.id}
              count={
                activeTasks.filter((task) => task.categoryId === category.id && !task.completedAt)
                  .length
              }
              icon={<span className="list-dot" style={{ background: category.color }} />}
              key={category.id}
              label={category.name}
              onClick={() => chooseView({ id: category.id, kind: 'category' })}
              onManage={() => setCollectionDialog({ initial: category, kind: 'category' })}
            />
          ))}
        </SidebarSection>

        <SidebarSection
          label="标签"
          onAdd={() => setCollectionDialog({ initial: null, kind: 'tag' })}
        >
          {tags.map((tag) => (
            <CollectionNavRow
              active={view.kind === 'tag' && view.id === tag.id}
              count={
                activeTasks.filter((task) => task.tagIds.includes(tag.id) && !task.completedAt)
                  .length
              }
              icon={<TagIcon size={15} style={{ color: tag.color }} />}
              key={tag.id}
              label={tag.name}
              onClick={() => chooseView({ id: tag.id, kind: 'tag' })}
              onManage={() => setCollectionDialog({ initial: tag, kind: 'tag' })}
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
          <NavButton
            active={view.kind === 'trash'}
            count={trashedTasks.length}
            icon={<Trash2 size={18} />}
            label="回收站"
            onClick={() => chooseView({ kind: 'trash' })}
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
                  {(['month', 'week', 'day', 'agenda'] as CalendarMode[]).map((mode) => (
                    <button
                      className={calendarMode === mode ? 'active' : ''}
                      key={mode}
                      onClick={() => setCalendarMode(mode)}
                      type="button"
                    >
                      {{ agenda: '日程', day: '日', month: '月', week: '周' }[mode]}
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
            onMove={async (taskId, dueDate, dueTime) => {
              await taskService.reschedule(taskId, dueDate, dueTime);
              showToast('任务时间已调整.');
            }}
            onResize={async (taskId, duration) => {
              await taskService.update(taskId, { duration });
              showToast('任务时长已调整.');
            }}
            onSelectDate={(date) => {
              setSelectedDate(date);
              if (!isSameDay(date, currentDate)) setCurrentDate(date);
            }}
            onToggle={async (taskId) => {
              const result = await taskService.complete(taskId);
              if (result.advanced) showToast('本次任务已完成, 下一次已安排.');
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
            tasks={activeTasks.length}
            onExport={async () => {
              const payload = await exportBackup();
              downloadBackup(payload);
              showToast('备份文件已导出.');
            }}
            onImport={async (file) => {
              const payload = parseBackup(await file.text());
              await replaceFromBackup(payload);
              showToast('备份已恢复.');
            }}
            onRequestReminder={async () => {
              const result = await requestReminderPermission();
              showToast(
                result === 'granted'
                  ? '任务提醒已开启.'
                  : result === 'unsupported'
                    ? '当前浏览器不支持通知.'
                    : '未获得通知权限.',
              );
            }}
          />
        ) : view.kind === 'trash' ? (
          <TrashView
            onEmpty={async () => {
              await emptyTrash();
              showToast('回收站已清空.');
            }}
            onPurge={async (taskId) => {
              await taskService.purge(taskId);
              showToast('任务已永久删除.');
            }}
            onRestore={async (taskId) => {
              await taskService.restore(taskId);
              showToast('任务已恢复.');
            }}
            tasks={sortTasks(trashedTasks)}
          />
        ) : (
          <TaskList
            categories={categories}
            emptyTitle={search ? '没有匹配的任务' : `${title}是空的`}
            onAdd={() => openNewTask(view.kind === 'today' ? toDateKey(today) : null)}
            onDuplicate={async (taskId) => {
              await taskService.duplicate(taskId);
              showToast('任务副本已创建.');
            }}
            onEdit={(task) => {
              setEditingTask(task);
              setTaskDialogOpen(true);
            }}
            onTrash={async (taskId) => {
              await taskService.trash(taskId);
              showToast('任务已移到回收站.');
            }}
            onToggle={async (taskId) => {
              const result = await taskService.complete(taskId);
              if (result.advanced) showToast('本次任务已完成, 下一次已安排.');
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
          defaultTime={dialogTime}
          onClose={() => setTaskDialogOpen(false)}
          onDelete={async (id) => {
            await taskService.trash(id);
            showToast('任务已移到回收站.');
          }}
          onSave={saveTask}
          open
          tags={tags}
          task={editingTask}
        />
      )}
      {collectionDialog && (
        <CollectionDialog
          initial={collectionDialog.initial}
          kind={collectionDialog.kind}
          onClose={() => setCollectionDialog(null)}
          onDelete={async (id) => {
            if (collectionDialog.kind === 'tag') {
              await deleteTag(id);
            } else {
              const replacement = categories.find((category) => category.id !== id);
              if (!replacement) {
                showToast('至少需要保留一个分类.');
                return;
              }
              await deleteCategory(id, replacement.id);
            }
            if ((view.kind === 'category' || view.kind === 'tag') && view.id === id) {
              setView({ kind: 'all' });
            }
            showToast(collectionDialog.kind === 'tag' ? '标签已删除.' : '分类已删除.');
          }}
          onSave={async (name, color) => {
            if (collectionDialog.initial) {
              if (collectionDialog.kind === 'tag') {
                await updateTag(collectionDialog.initial.id, { color, name });
              } else {
                await updateCategory(collectionDialog.initial.id, { color, name });
              }
            } else if (collectionDialog.kind === 'tag') await addTag(name, color);
            else await addCategory(name, color);
            showToast(
              collectionDialog.initial
                ? collectionDialog.kind === 'tag'
                  ? '标签已更新.'
                  : '分类已更新.'
                : collectionDialog.kind === 'tag'
                  ? '标签已创建.'
                  : '分类已创建.',
            );
          }}
          onMove={
            collectionDialog.kind === 'category' && collectionDialog.initial
              ? async (direction) => {
                  const index = categories.findIndex(
                    (category) => category.id === collectionDialog.initial?.id,
                  );
                  const target = index + direction;
                  if (index < 0 || target < 0 || target >= categories.length) return;
                  const ordered = categories.map((category) => category.id);
                  [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
                  await reorderCategories(ordered);
                  showToast('分类顺序已调整.');
                }
              : undefined
          }
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

function CollectionNavRow({
  active,
  count,
  icon,
  label,
  onClick,
  onManage,
}: NavButtonProps & { onManage: () => void }) {
  return (
    <div className={`collection-nav-row${active ? ' active' : ''}`}>
      <NavButton active={active} count={count} icon={icon} label={label} onClick={onClick} />
      <button aria-label={`编辑${label}`} className="nav-manage" onClick={onManage} type="button">
        <Edit3 size={13} />
      </button>
    </div>
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
  if (view.kind === 'trash') return '回收站';
  if (view.kind === 'category')
    return categories.find((item) => item.id === view.id)?.name ?? '分类';
  if (view.kind === 'tag') return `#${tags.find((item) => item.id === view.id)?.name ?? '标签'}`;
  return '设置与数据';
}

function navigateDate(date: Date, mode: CalendarMode, amount: number): Date {
  if (mode === 'month') return addMonths(date, amount);
  if (mode === 'week') return addWeeks(date, amount);
  if (mode === 'agenda') return addDays(date, amount * 14);
  return addDays(date, amount);
}

function calendarTitle(date: Date, mode: CalendarMode): string {
  if (mode === 'month') return format(date, 'yyyy 年 M 月', { locale: zhCN });
  if (mode === 'day') return format(date, 'M 月 d 日 EEEE', { locale: zhCN });
  if (mode === 'agenda') {
    return `${format(date, 'M 月 d 日')} - ${format(addDays(date, 13), 'M 月 d 日')}`;
  }
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = addDays(start, 6);
  return `${format(start, 'M 月 d 日')} - ${format(end, 'M 月 d 日')}`;
}

function SettingsView({
  categories,
  onClearCompleted,
  onExport,
  onImport,
  onRequestReminder,
  tags,
  tasks,
}: {
  categories: number;
  onClearCompleted: () => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onRequestReminder: () => Promise<void>;
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
          <strong>任务提醒</strong>
          <p>允许 EasyDo 在任务开始前发送本地通知.</p>
        </div>
        <button className="secondary-button" onClick={() => void onRequestReminder()} type="button">
          开启提醒
        </button>
      </div>
      <div className="settings-row">
        <div>
          <strong>备份与恢复</strong>
          <p>导出完整本地数据, 或从 EasyDo 备份文件恢复.</p>
        </div>
        <div className="settings-actions">
          <button className="secondary-button" onClick={() => void onExport()} type="button">
            <Download size={16} />
            导出
          </button>
          <label className="secondary-button file-button">
            <Upload size={16} />
            导入
            <input
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && window.confirm('导入会替换当前全部数据, 是否继续?'))
                  void onImport(file);
                event.target.value = '';
              }}
              type="file"
            />
          </label>
        </div>
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

function TrashView({
  onEmpty,
  onPurge,
  onRestore,
  tasks,
}: {
  onEmpty: () => Promise<void>;
  onPurge: (taskId: string) => Promise<void>;
  onRestore: (taskId: string) => Promise<void>;
  tasks: Task[];
}) {
  return (
    <section className="list-view trash-view">
      <div className="list-view-heading">
        <div>
          <p>数据管理</p>
          <h2>回收站</h2>
        </div>
        {tasks.length > 0 && (
          <button
            className="danger-button"
            onClick={() => window.confirm('确定永久删除回收站中的全部任务吗?') && void onEmpty()}
            type="button"
          >
            <Trash2 size={16} />
            清空回收站
          </button>
        )}
      </div>
      {tasks.length ? (
        <div className="trash-list">
          {tasks.map((task) => (
            <article key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <span>
                  {task.deletedAt
                    ? `删除于 ${format(new Date(task.deletedAt), 'M 月 d 日 HH:mm')}`
                    : ''}
                </span>
              </div>
              <button onClick={() => void onRestore(task.id)} type="button">
                <RotateCcw size={15} />
                恢复
              </button>
              <button
                className="danger"
                onClick={() =>
                  window.confirm(`确定永久删除 "${task.title}" 吗?`) && void onPurge(task.id)
                }
                type="button"
              >
                <Trash2 size={15} />
                永久删除
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-list">
          <Trash2 size={38} />
          <h3>回收站是空的</h3>
          <p>删除的任务会先保留在这里.</p>
        </div>
      )}
    </section>
  );
}

function downloadBackup(payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `easydo-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
