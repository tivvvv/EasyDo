import type {
  ActivityRecord,
  AppSettings,
  Category,
  FilterCriteria,
  Folder,
  Priority,
  RecurrenceEditScope,
  Tag,
  Task,
  TaskDraft,
  TaskTemplate,
} from '@easydo/domain';
import {
  defaultFilterCriteria,
  matchesTaskSearch,
  priorityLabels,
  sortTasks,
} from '@easydo/domain';
import { format, isSameDay, startOfDay } from 'date-fns';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Download,
  Edit3,
  Folder as FolderIcon,
  FolderPlus,
  Gauge,
  History,
  Inbox,
  ListTodo,
  Menu,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Tag as TagIcon,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  addCategory,
  addCountdown,
  addFocusSession,
  addFolder,
  addHabit,
  addSavedFilter,
  addSection,
  addTag,
  addTemplate,
  db,
  deleteCategory,
  deleteCountdown,
  deleteFolder,
  deleteHabit,
  deleteSavedFilter,
  deleteSection,
  deleteTag,
  deleteTemplate,
  emptyTrash,
  exportBackup,
  replaceFromBackup,
  reorderCategories,
  reorderTasks,
  updateCategory,
  updateFolder,
  updateHabit,
  updateSettings,
  updateTag,
  toggleHabitLog,
} from '@easydo/storage';
import { exportTasksToIcs, matchesFilter, parseBackup, parseIcs } from '@easydo/application';

import { taskService } from './application';
import { CalendarView, type CalendarMode } from './components/CalendarView';
import { CollectionDialog } from './components/CollectionDialog';
import { FilterPanel } from './components/FilterPanel';
import { QuickEditPanel } from './components/QuickEditPanel';
import { QuickCapture } from './components/QuickCapture';
import { ProductivityHub } from './components/ProductivityHub';
import { TaskDialog } from './components/TaskDialog';
import { TaskList } from './components/TaskList';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import { requestReminderPermission, useTaskReminders } from './hooks/useTaskReminders';
import { toDateKey } from './lib/calendar';
import {
  getCalendarTitle,
  getViewTasks,
  getViewTitle,
  navigateCalendarDate,
  type WorkspaceView,
} from './lib/workspaceView';
import './styles.css';

type View = WorkspaceView;

const today = startOfDay(new Date());

export function App() {
  const data = useWorkspaceData();
  const [view, setView] = useState<View>({ kind: 'calendar' });
  const [calendarMode, setCalendarMode] = useState<CalendarMode | null>(null);
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [search, setSearch] = useState('');
  const [criteria, setCriteria] = useState<FilterCriteria>({ ...defaultFilterCriteria });
  const [filterOpen, setFilterOpen] = useState(false);
  const [quickEditingTask, setQuickEditingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const [dialogTime, setDialogTime] = useState<string | null>(null);
  const [dialogDuration, setDialogDuration] = useState(30);
  const [dialogCategoryId, setDialogCategoryId] = useState<string | null>(null);
  const [dialogImportant, setDialogImportant] = useState(false);
  const [dialogPriority, setDialogPriority] = useState<Priority>('none');
  const [dialogSectionId, setDialogSectionId] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [collectionDialog, setCollectionDialog] = useState<{
    initial: Category | Tag | null;
    kind: 'category' | 'tag';
  } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo: boolean } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  const openNewTask = (
    date: string | null,
    time: string | null = null,
    duration = 30,
    prefill: {
      categoryId?: string;
      important?: boolean;
      priority?: Priority;
      sectionId?: string | null;
    } = {},
  ) => {
    setEditingTask(null);
    setDialogDate(date);
    setDialogTime(time);
    setDialogDuration(duration);
    setDialogCategoryId(prefill.categoryId ?? null);
    setDialogImportant(prefill.important ?? false);
    setDialogPriority(prefill.priority ?? 'none');
    setDialogSectionId(prefill.sectionId ?? null);
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

  const showToast = (message: string, undo = false) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ message, undo });
    toastTimerRef.current = window.setTimeout(
      () => {
        setToast(null);
        toastTimerRef.current = null;
      },
      undo ? 6_000 : 2_400,
    );
  };

  useTaskReminders(data?.tasks ?? []);

  useEffect(() => {
    const theme = data?.settings.theme ?? 'system';
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [data?.settings.theme]);

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

  const {
    activities,
    categories,
    countdowns,
    filters,
    focusSessions,
    folders = [],
    habits,
    sections,
    settings,
    tags,
    tasks,
    templates,
  } = data;
  const activeCalendarMode = calendarMode ?? settings.defaultCalendarMode;
  const activeTasks = tasks.filter((task) => !task.deletedAt);
  const trashedTasks = tasks.filter((task) => task.deletedAt);
  const filteredTasks = sortTasks(
    activeTasks.filter(
      (task) => matchesTaskSearch(task, search) && matchesFilter(task, criteria, toDateKey(today)),
    ),
  );
  const viewTasks = getViewTasks(filteredTasks, view, categories, toDateKey(today));
  const title = getViewTitle(view, categories, tags, folders);

  const saveTask = async (draft: TaskDraft, id?: string, scope?: RecurrenceEditScope) => {
    if (id) {
      if (scope) await taskService.updateRecurring(id, draft, scope);
      else await taskService.update(id, draft);
      showToast('任务已更新.', true);
    } else {
      await taskService.create(draft);
      showToast('任务已创建.');
    }
  };

  const chooseView = (nextView: View) => {
    setView(nextView);
    setFilterOpen(false);
    setQuickEditingTask(null);
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
        <div className="sidebar-sticky-head">
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
        </div>
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
          <NavButton
            active={view.kind === 'productivity'}
            icon={<Gauge size={18} />}
            label="效率工作台"
            onClick={() => chooseView({ kind: 'productivity' })}
          />
        </nav>

        <SidebarSection
          label="分类"
          onAdd={() => setCollectionDialog({ initial: null, kind: 'category' })}
        >
          <button
            className="folder-add-button"
            onClick={async () => {
              const name = window.prompt('请输入文件夹名称.');
              if (name?.trim()) {
                await addFolder(name.trim());
                showToast('文件夹已创建.');
              }
            }}
            type="button"
          >
            <FolderPlus size={14} /> 新建文件夹
          </button>
          {folders.map((folder) => (
            <FolderNavGroup
              active={view.kind === 'folder' && view.id === folder.id}
              categories={categories.filter((category) => category.folderId === folder.id)}
              folder={folder}
              key={folder.id}
              onChooseCategory={(id) => chooseView({ id, kind: 'category' })}
              onChooseFolder={() => chooseView({ id: folder.id, kind: 'folder' })}
              onManageCategory={(category) =>
                setCollectionDialog({ initial: category, kind: 'category' })
              }
              onManage={async () => {
                const name = window.prompt('修改文件夹名称, 留空将删除文件夹.', folder.name);
                if (name === null) return;
                if (name.trim()) await updateFolder(folder.id, name.trim());
                else if (window.confirm(`确定删除文件夹 "${folder.name}" 吗? 分类会保留.`))
                  await deleteFolder(folder.id);
              }}
              tasks={activeTasks}
              view={view}
            />
          ))}
          {categories
            .filter((category) => !category.folderId)
            .map((category) => (
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

        <SidebarSection label="智能清单" onAdd={() => setFilterOpen(true)}>
          <NavButton
            active={false}
            icon={<CalendarDays size={16} />}
            label="未来 7 天"
            onClick={() => {
              setCriteria({ ...defaultFilterCriteria, dateRange: 'next7' });
              chooseView({ kind: 'all' });
            }}
          />
          <NavButton
            active={false}
            icon={<History size={16} />}
            label="已过期"
            onClick={() => {
              setCriteria({ ...defaultFilterCriteria, dateRange: 'overdue' });
              chooseView({ kind: 'all' });
            }}
          />
          {filters.map((filter) => (
            <NavButton
              active={false}
              icon={<SlidersHorizontal size={15} />}
              key={filter.id}
              label={filter.name}
              onClick={() => {
                setCriteria(filter.criteria);
                chooseView({ kind: 'all' });
              }}
            />
          ))}
        </SidebarSection>

        <div className="sidebar-footer">
          <NavButton
            active={view.kind === 'history'}
            icon={<History size={18} />}
            label="操作记录"
            onClick={() => chooseView({ kind: 'history' })}
          />
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
          <div className="topbar-copy">
            <p className="eyebrow">
              {view.kind === 'calendar' ? '日历' : view.kind === 'productivity' ? '效率' : '任务'}
            </p>
            <h1>
              {view.kind === 'calendar'
                ? getCalendarTitle(
                    currentDate,
                    activeCalendarMode,
                    settings.agendaDays,
                    settings.weekStartsOn,
                  )
                : title}
            </h1>
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
                onChange={(event) =>
                  setCriteria((current) => ({
                    ...current,
                    priority: event.target.value as Priority | 'all',
                  }))
                }
                value={criteria.priority}
              >
                <option value="all">全部优先级</option>
                {(['high', 'medium', 'low', 'none'] as Priority[]).map((item) => (
                  <option key={item} value={item}>
                    {priorityLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-pressed={filterOpen}
              className={`filter-toggle${filterOpen ? ' active' : ''}`}
              onClick={() => setFilterOpen((open) => !open)}
              type="button"
            >
              <SlidersHorizontal size={16} />
              筛选
            </button>
            {view.kind === 'calendar' && (
              <>
                <input
                  aria-label="跳转日期"
                  className="date-jump"
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const date = new Date(`${event.target.value}T12:00:00`);
                    setCurrentDate(date);
                    setSelectedDate(date);
                  }}
                  type="date"
                  value={toDateKey(selectedDate)}
                />
                <div className="view-switcher" aria-label="日历视图">
                  {(
                    [
                      'year',
                      'month',
                      'multiWeek',
                      'week',
                      'fiveDay',
                      'threeDay',
                      'day',
                      'agenda',
                    ] as CalendarMode[]
                  ).map((mode) => (
                    <button
                      className={activeCalendarMode === mode ? 'active' : ''}
                      key={mode}
                      onClick={() => {
                        setCalendarMode(mode);
                        void updateSettings({ defaultCalendarMode: mode });
                      }}
                      type="button"
                    >
                      {
                        {
                          agenda: '日程',
                          day: '日',
                          fiveDay: '5 日',
                          month: '月',
                          multiWeek: '4 周',
                          threeDay: '3 日',
                          week: '周',
                          year: '年',
                        }[mode]
                      }
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
                  onClick={() =>
                    setCurrentDate(
                      navigateCalendarDate(
                        currentDate,
                        activeCalendarMode,
                        -1,
                        settings.agendaDays,
                      ),
                    )
                  }
                  type="button"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="下一段时间"
                  onClick={() =>
                    setCurrentDate(
                      navigateCalendarDate(currentDate, activeCalendarMode, 1, settings.agendaDays),
                    )
                  }
                  type="button"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
        </header>

        <QuickCapture
          categories={categories}
          onCreate={async (draft, newTagNames) => {
            const createdTags = await Promise.all(
              newTagNames.map((name) => addTag(name, '#7c6cf2')),
            );
            await taskService.create({
              ...draft,
              tagIds: [...draft.tagIds, ...createdTags.map((tag) => tag.id)],
            });
            showToast('任务已快速添加.');
          }}
          tags={tags}
        />

        {filterOpen && (
          <FilterPanel
            categories={categories}
            criteria={criteria}
            filters={filters}
            onApply={setCriteria}
            onClose={() => setFilterOpen(false)}
            onDelete={async (id) => {
              await deleteSavedFilter(id);
              showToast('智能清单已删除.');
            }}
            onSave={async (name, nextCriteria) => {
              await addSavedFilter(name, nextCriteria);
              showToast('智能清单已保存.');
            }}
            tags={tags}
          />
        )}

        {view.kind === 'calendar' ? (
          <CalendarView
            categories={categories}
            currentDate={currentDate}
            mode={activeCalendarMode}
            onAdd={openNewTask}
            onEdit={(task) => {
              setEditingTask(task);
              setTaskDialogOpen(true);
            }}
            onMove={async (taskId, dueDate, dueTime) => {
              await taskService.reschedule(taskId, dueDate, dueTime);
              showToast('任务时间已调整.', true);
            }}
            onQuickEdit={setQuickEditingTask}
            onResize={async (taskId, duration) => {
              await taskService.update(taskId, { duration });
              showToast('任务时长已调整.', true);
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
            settings={settings}
            tasks={filteredTasks}
          />
        ) : view.kind === 'productivity' ? (
          <ProductivityHub
            categories={categories}
            countdowns={countdowns}
            focusSessions={focusSessions}
            habits={habits}
            onAddCountdown={async (name, date) => {
              await addCountdown(name, date);
              showToast('倒数日已添加.');
            }}
            onAddFocusSession={async (session) => {
              await addFocusSession(session);
              showToast('专注记录已保存.');
            }}
            onAddHabit={async (name) => {
              await addHabit(name);
              showToast('习惯已创建.');
            }}
            onAddSection={async (categoryId, name) => {
              await addSection(categoryId, name);
              showToast('分区已创建.');
            }}
            onDeleteCountdown={deleteCountdown}
            onDeleteHabit={deleteHabit}
            onDeleteSection={deleteSection}
            onCreateTask={(prefill) =>
              openNewTask(prefill.dueDate ?? null, null, 30, {
                categoryId: prefill.categoryId,
                important: prefill.important,
                sectionId: prefill.sectionId,
              })
            }
            onEdit={(task) => {
              setEditingTask(task);
              setTaskDialogOpen(true);
            }}
            onToggleHabit={toggleHabitLog}
            onUpdateHabit={updateHabit}
            onUpdateTask={async (id, patch) => {
              await taskService.update(id, patch);
              showToast('任务已调整.', true);
            }}
            sections={sections}
            settings={settings}
            tasks={activeTasks}
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
            onExportIcs={() => {
              downloadText(
                exportTasksToIcs(activeTasks),
                `easydo-calendar-${format(new Date(), 'yyyy-MM-dd')}.ics`,
                'text/calendar',
              );
              showToast('日历文件已导出.');
            }}
            onImportIcs={async (file) => {
              const drafts = parseIcs(await file.text(), categories[0]?.id ?? '');
              for (const draft of drafts) {
                await taskService.create({
                  ...draft,
                  categoryId: categories.some((category) => category.id === draft.categoryId)
                    ? draft.categoryId
                    : (categories[0]?.id ?? ''),
                });
              }
              showToast(`已导入 ${drafts.length} 个日历条目.`);
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
            onUpdateSettings={async (patch) => {
              await updateSettings(patch);
              showToast('日历偏好已保存.');
            }}
            onDeleteTemplate={async (id) => {
              await deleteTemplate(id);
              showToast('任务模板已删除.');
            }}
            settings={settings}
            templates={templates}
          />
        ) : view.kind === 'history' ? (
          <HistoryView
            activities={activities}
            onUndo={async () => {
              if (await taskService.undoLatest()) showToast('最近一次操作已撤销.');
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
            onAddWithPrefill={(prefill) =>
              openNewTask(prefill.dueDate ?? null, null, 30, {
                categoryId: prefill.categoryId,
                important: prefill.important,
                priority: prefill.priority,
                sectionId: prefill.sectionId,
              })
            }
            onBatchUpdate={async (ids, patch) => {
              await taskService.batchUpdate(ids, patch);
              showToast('批量修改已完成.', true);
            }}
            onDuplicate={async (taskId) => {
              await taskService.duplicate(taskId);
              showToast('任务副本已创建.', true);
            }}
            onEdit={(task) => {
              setEditingTask(task);
              setTaskDialogOpen(true);
            }}
            onTrash={async (taskId) => {
              await taskService.trash(taskId);
              showToast('任务已移到回收站.', true);
            }}
            onReorder={async (sourceId, targetId) => {
              const ordered = [...activeTasks]
                .sort((left, right) => left.order - right.order)
                .map((task) => task.id);
              const source = ordered.indexOf(sourceId);
              const target = ordered.indexOf(targetId);
              if (source < 0 || target < 0) return;
              const [moved] = ordered.splice(source, 1);
              if (moved) ordered.splice(target, 0, moved);
              await reorderTasks(ordered);
              showToast('任务顺序已调整.');
            }}
            onToggle={async (taskId) => {
              const result = await taskService.complete(taskId);
              if (result.advanced) showToast('本次任务已完成, 下一次已安排.');
            }}
            tags={tags}
            tasks={viewTasks}
            title={title}
            settings={settings}
            onUpdateSettings={async (patch) => updateSettings(patch)}
          />
        )}
      </main>

      {taskDialogOpen && (
        <TaskDialog
          categories={categories}
          defaultCategoryId={dialogCategoryId}
          defaultDate={dialogDate}
          defaultDuration={dialogDuration}
          defaultImportant={dialogImportant}
          defaultPriority={dialogPriority}
          defaultSectionId={dialogSectionId}
          defaultTime={dialogTime}
          onClose={() => setTaskDialogOpen(false)}
          onDelete={async (id) => {
            await taskService.trash(id);
            showToast('任务已移到回收站.', true);
          }}
          onSave={saveTask}
          onSaveTemplate={async (name, draft) => {
            await addTemplate(name, draft);
            showToast('任务模板已保存.');
          }}
          open
          sections={sections}
          tags={tags}
          task={editingTask}
          templates={templates}
        />
      )}
      {quickEditingTask && (
        <QuickEditPanel
          categories={categories}
          onClose={() => setQuickEditingTask(null)}
          onFullEdit={(task) => {
            setQuickEditingTask(null);
            setEditingTask(task);
            setTaskDialogOpen(true);
          }}
          onSave={async (id, patch) => {
            await taskService.update(id, patch);
            showToast('任务已快速更新.', true);
          }}
          onSkip={async (id) => {
            await taskService.skipRecurrence(id);
            showToast('已跳过本次重复任务.', true);
          }}
          onPostpone={async (id, minutes) => {
            await taskService.postpone([id], minutes);
            showToast('任务已推迟.', true);
          }}
          task={quickEditingTask}
        />
      )}
      {collectionDialog && (
        <CollectionDialog
          folders={folders}
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
          onSave={async (name, color, folderId) => {
            if (collectionDialog.initial) {
              if (collectionDialog.kind === 'tag') {
                await updateTag(collectionDialog.initial.id, { color, name });
              } else {
                await updateCategory(collectionDialog.initial.id, { color, folderId, name });
              }
            } else if (collectionDialog.kind === 'tag') await addTag(name, color);
            else {
              const category = await addCategory(name, color);
              if (folderId) await updateCategory(category.id, { color, folderId, name });
            }
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
          {toast.message}
          {toast.undo && (
            <button
              onClick={async () => {
                if (await taskService.undoLatest()) showToast('操作已撤销.');
              }}
              type="button"
            >
              撤销
            </button>
          )}
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

function FolderNavGroup({
  active,
  categories,
  folder,
  onChooseCategory,
  onChooseFolder,
  onManageCategory,
  onManage,
  tasks,
  view,
}: {
  active: boolean;
  categories: Category[];
  folder: Folder;
  onChooseCategory: (id: string) => void;
  onChooseFolder: () => void;
  onManageCategory: (category: Category) => void;
  onManage: () => Promise<void>;
  tasks: Task[];
  view: View;
}) {
  const categoryIds = new Set(categories.map((category) => category.id));
  return (
    <div className="folder-nav-group">
      <CollectionNavRow
        active={active}
        count={tasks.filter((task) => categoryIds.has(task.categoryId) && !task.completedAt).length}
        icon={<FolderIcon size={15} />}
        label={folder.name}
        onClick={onChooseFolder}
        onManage={() => void onManage()}
      />
      <div className="folder-category-list">
        {categories.map((category) => (
          <CollectionNavRow
            active={view.kind === 'category' && view.id === category.id}
            count={
              tasks.filter((task) => task.categoryId === category.id && !task.completedAt).length
            }
            icon={<span className="list-dot" style={{ background: category.color }} />}
            key={category.id}
            label={category.name}
            onClick={() => onChooseCategory(category.id)}
            onManage={() => onManageCategory(category)}
          />
        ))}
      </div>
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

function SettingsView({
  categories,
  onClearCompleted,
  onExport,
  onImport,
  onExportIcs,
  onImportIcs,
  onRequestReminder,
  onDeleteTemplate,
  onUpdateSettings,
  settings,
  tags,
  tasks,
  templates,
}: {
  categories: number;
  onClearCompleted: () => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onExportIcs: () => void;
  onImportIcs: (file: File) => Promise<void>;
  onRequestReminder: () => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onUpdateSettings: (patch: Partial<Omit<AppSettings, 'id'>>) => Promise<void>;
  settings: AppSettings;
  tags: number;
  tasks: number;
  templates: TaskTemplate[];
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
          <strong>外观和专注</strong>
          <p>选择主题并设置番茄钟时长.</p>
        </div>
        <div className="settings-inline-fields">
          <select
            aria-label="主题"
            onChange={(event) =>
              void onUpdateSettings({ theme: event.target.value as AppSettings['theme'] })
            }
            value={settings.theme}
          >
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
          <label>
            专注分钟
            <input
              min={1}
              max={120}
              onChange={(event) =>
                void onUpdateSettings({ pomodoroMinutes: Number(event.target.value) })
              }
              type="number"
              value={settings.pomodoroMinutes}
            />
          </label>
          <label>
            休息分钟
            <input
              min={1}
              max={60}
              onChange={(event) =>
                void onUpdateSettings({ shortBreakMinutes: Number(event.target.value) })
              }
              type="number"
              value={settings.shortBreakMinutes}
            />
          </label>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <strong>日历显示</strong>
          <p>设置密度, 周末和日程范围.</p>
        </div>
        <div className="settings-inline-fields">
          <select
            aria-label="日历密度"
            onChange={(event) =>
              void onUpdateSettings({
                calendarDensity: event.target.value as AppSettings['calendarDensity'],
              })
            }
            value={settings.calendarDensity}
          >
            <option value="comfortable">舒适</option>
            <option value="compact">紧凑</option>
          </select>
          <select
            aria-label="日程范围"
            onChange={(event) =>
              void onUpdateSettings({ agendaDays: Number(event.target.value) as 7 | 14 | 30 })
            }
            value={settings.agendaDays}
          >
            <option value="7">7 天</option>
            <option value="14">14 天</option>
            <option value="30">30 天</option>
          </select>
          <select
            aria-label="默认日历视图"
            onChange={(event) =>
              void onUpdateSettings({
                defaultCalendarMode: event.target.value as AppSettings['defaultCalendarMode'],
              })
            }
            value={settings.defaultCalendarMode}
          >
            <option value="month">月视图</option>
            <option value="year">年视图</option>
            <option value="multiWeek">4 周视图</option>
            <option value="week">周视图</option>
            <option value="fiveDay">5 日视图</option>
            <option value="threeDay">3 日视图</option>
            <option value="day">日视图</option>
            <option value="agenda">日程视图</option>
          </select>
          <select
            aria-label="每周开始日"
            onChange={(event) =>
              void onUpdateSettings({ weekStartsOn: Number(event.target.value) as 0 | 1 })
            }
            value={settings.weekStartsOn}
          >
            <option value="1">周一开始</option>
            <option value="0">周日开始</option>
          </select>
          <label>
            <input
              checked={settings.showWeekends}
              onChange={(event) => void onUpdateSettings({ showWeekends: event.target.checked })}
              type="checkbox"
            />
            显示周末
          </label>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <strong>日历导入和导出</strong>
          <p>使用标准 ICS 文件与其他日历应用交换任务和事件.</p>
        </div>
        <div className="settings-actions">
          <button className="secondary-button" onClick={onExportIcs} type="button">
            <Download size={16} />
            导出 ICS
          </button>
          <label className="secondary-button file-button">
            <Upload size={16} />
            导入 ICS
            <input
              accept="text/calendar,.ics"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onImportIcs(file);
                event.target.value = '';
              }}
              type="file"
            />
          </label>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <strong>每日工作时间</strong>
          <p>周视图和日视图仅展示这个时间范围.</p>
        </div>
        <div className="settings-inline-fields">
          <label>
            开始
            <input
              max={settings.workdayEnd - 1}
              min={0}
              onChange={(event) =>
                void onUpdateSettings({ workdayStart: Number(event.target.value) })
              }
              type="number"
              value={settings.workdayStart}
            />
          </label>
          <label>
            结束
            <input
              max={24}
              min={settings.workdayStart + 1}
              onChange={(event) =>
                void onUpdateSettings({ workdayEnd: Number(event.target.value) })
              }
              type="number"
              value={settings.workdayEnd}
            />
          </label>
        </div>
      </div>
      <div className="settings-row template-settings-row">
        <div>
          <strong>任务模板</strong>
          <p>在新建任务时快速复用常用内容.</p>
        </div>
        <div className="template-list">
          {templates.length ? (
            templates.map((template) => (
              <span key={template.id}>
                {template.name}
                <button
                  aria-label={`删除模板 ${template.name}`}
                  onClick={() => void onDeleteTemplate(template.id)}
                  type="button"
                >
                  <X size={13} />
                </button>
              </span>
            ))
          ) : (
            <small>还没有模板.</small>
          )}
        </div>
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

function HistoryView({
  activities,
  onUndo,
}: {
  activities: ActivityRecord[];
  onUndo: () => Promise<void>;
}) {
  const labels: Record<ActivityRecord['action'], string> = {
    complete: '切换完成状态',
    create: '创建任务',
    duplicate: '复制任务',
    restore: '恢复任务',
    trash: '移到回收站',
    update: '更新任务',
  };
  return (
    <section className="list-view history-view">
      <div className="list-view-heading">
        <div>
          <p>本地记录</p>
          <h2>操作记录</h2>
        </div>
        {activities.length > 0 && (
          <button className="secondary-button" onClick={() => void onUndo()} type="button">
            <RotateCcw size={16} />
            撤销最近操作
          </button>
        )}
      </div>
      {activities.length ? (
        <div className="activity-list">
          {activities.map((activity) => (
            <article key={activity.id}>
              <span>
                <History size={16} />
              </span>
              <div>
                <strong>{labels[activity.action]}</strong>
                <p>{activity.after?.title ?? activity.before?.title ?? '任务'}</p>
              </div>
              <time>{format(new Date(activity.createdAt), 'M 月 d 日 HH:mm')}</time>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-list">
          <History size={38} />
          <h3>还没有操作记录</h3>
          <p>任务的创建和修改会显示在这里.</p>
        </div>
      )}
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

function downloadText(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
