import type { AppSettings, Category, Priority, Tag, Task, TaskDraft } from '@easydo/domain';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  CalendarDays,
  Check,
  CirclePlus,
  Clock3,
  Copy,
  Edit3,
  GripVertical,
  Inbox,
  MoreHorizontal,
  Repeat2,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { taskProgress } from '@easydo/domain';

import { fromDateKey } from '../lib/calendar';
import { useAppDialog } from './AppDialog';

type TaskListProps = {
  categories: Category[];
  emptyTitle: string;
  onAdd: () => void;
  onAddWithPrefill: (prefill: Partial<TaskDraft>) => void;
  onBatchUpdate: (taskIds: string[], patch: Partial<TaskDraft>) => Promise<void>;
  onDuplicate: (taskId: string) => Promise<void>;
  onEdit: (task: Task) => void;
  onTrash: (taskId: string) => Promise<void>;
  onReorder: (sourceId: string, targetId: string) => Promise<void>;
  onToggle: (taskId: string) => Promise<void>;
  onUpdateSettings: (patch: Partial<Omit<AppSettings, 'id'>>) => Promise<void>;
  settings: AppSettings;
  tags: Tag[];
  tasks: Task[];
  title: string;
};

export function TaskList({
  categories,
  emptyTitle,
  onAdd,
  onAddWithPrefill,
  onBatchUpdate,
  onDuplicate,
  onEdit,
  onTrash,
  onReorder,
  onToggle,
  onUpdateSettings,
  settings,
  tags,
  tasks,
  title,
}: TaskListProps) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const orderedTasks = sortForView(tasks, settings.taskSort);
  const active = orderedTasks.filter((task) => !task.completedAt);
  const completed = orderedTasks.filter((task) => task.completedAt);
  const [displayLimit, setDisplayLimit] = useState(300);
  const activeGroups = groupForView(
    active.slice(0, displayLimit),
    settings.taskGrouping,
    categoryMap,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchCategory, setBatchCategory] = useState('');
  const [batchDate, setBatchDate] = useState('');
  const [batchPriority, setBatchPriority] = useState<Priority | ''>('');
  const visibleSelectedIds = selectedIds.filter((id) => tasks.some((task) => task.id === id));

  const toggleSelected = (taskId: string) => {
    setSelectedIds((ids) =>
      ids.includes(taskId) ? ids.filter((id) => id !== taskId) : [...ids, taskId],
    );
  };

  const runBatch = async (action: (taskId: string) => Promise<void>) => {
    await Promise.all(visibleSelectedIds.map(action));
    setSelectedIds([]);
  };

  return (
    <section className="list-view">
      <div className="list-view-heading">
        <div className="list-summary" aria-label="任务概览">
          <span>
            <strong>{active.length}</strong>
            <small>待完成</small>
          </span>
          <span>
            <strong>{completed.length}</strong>
            <small>已完成</small>
          </span>
        </div>
        <div className="list-heading-actions">
          <select
            aria-label="任务分组"
            onChange={(event) =>
              void onUpdateSettings({
                taskGrouping: event.target.value as AppSettings['taskGrouping'],
              })
            }
            value={settings.taskGrouping}
          >
            <option value="none">不分组</option>
            <option value="date">按日期分组</option>
            <option value="priority">按优先级分组</option>
            <option value="category">按分类分组</option>
          </select>
          <select
            aria-label="任务排序"
            onChange={(event) =>
              void onUpdateSettings({ taskSort: event.target.value as AppSettings['taskSort'] })
            }
            value={settings.taskSort}
          >
            <option value="manual">手动排序</option>
            <option value="date">按日期</option>
            <option value="priority">按优先级</option>
            <option value="created">按创建时间</option>
            <option value="updated">按更新时间</option>
          </select>
          <button className="primary-button" onClick={onAdd} type="button">
            <CirclePlus size={17} />
            添加任务
          </button>
        </div>
      </div>
      {visibleSelectedIds.length > 0 && (
        <div className="batch-toolbar" role="toolbar" aria-label="批量操作">
          <strong>已选择 {visibleSelectedIds.length} 项</strong>
          <button onClick={() => void runBatch(onToggle)} type="button">
            <Check size={15} />
            切换完成
          </button>
          <button onClick={() => void runBatch(onDuplicate)} type="button">
            <Copy size={15} />
            创建副本
          </button>
          <select
            aria-label="批量修改分类"
            onChange={(event) => setBatchCategory(event.target.value)}
            value={batchCategory}
          >
            <option value="">分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            aria-label="批量修改优先级"
            onChange={(event) => setBatchPriority(event.target.value as Priority | '')}
            value={batchPriority}
          >
            <option value="">优先级</option>
            <option value="none">无</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
          <input
            aria-label="批量修改日期"
            onChange={(event) => setBatchDate(event.target.value)}
            type="date"
            value={batchDate}
          />
          <button
            disabled={!batchCategory && !batchDate && !batchPriority}
            onClick={async () => {
              await onBatchUpdate(visibleSelectedIds, {
                ...(batchCategory ? { categoryId: batchCategory } : {}),
                ...(batchDate ? { dueDate: batchDate } : {}),
                ...(batchPriority ? { priority: batchPriority } : {}),
              });
              setBatchCategory('');
              setBatchDate('');
              setBatchPriority('');
              setSelectedIds([]);
            }}
            type="button"
          >
            应用修改
          </button>
          <button className="danger" onClick={() => void runBatch(onTrash)} type="button">
            <Trash2 size={15} />
            移到回收站
          </button>
          <button onClick={() => setSelectedIds([])} type="button">
            取消
          </button>
        </div>
      )}
      {tasks.length ? (
        <div className="task-list">
          {activeGroups.map(([group, groupTasks]) => (
            <div className="task-group" key={group}>
              {settings.taskGrouping !== 'none' && (
                <div className="task-group-heading">
                  <h3>{group}</h3>
                  <span>{groupTasks.length}</span>
                  <button
                    aria-label={`在 ${group} 中添加任务`}
                    onClick={() =>
                      onAddWithPrefill(prefillForGroup(group, settings.taskGrouping, categories))
                    }
                    type="button"
                  >
                    <CirclePlus size={15} />
                    添加
                  </button>
                </div>
              )}
              {groupTasks.map((task) => (
                <TaskRow
                  category={categoryMap.get(task.categoryId)}
                  key={task.id}
                  onDuplicate={onDuplicate}
                  onEdit={onEdit}
                  onReorder={onReorder}
                  onSelect={toggleSelected}
                  onToggle={onToggle}
                  onTrash={onTrash}
                  selected={selectedIds.includes(task.id)}
                  tagMap={tagMap}
                  task={task}
                />
              ))}
            </div>
          ))}
          {active.length > displayLimit && (
            <button
              className="task-list-load-more"
              onClick={() => setDisplayLimit((value) => value + 300)}
              type="button"
            >
              继续显示 {Math.min(300, active.length - displayLimit)} 项
            </button>
          )}
          {completed.length > 0 && (
            <details className="completed-group">
              <summary>已完成 - {completed.length}</summary>
              {completed.map((task) => (
                <TaskRow
                  category={categoryMap.get(task.categoryId)}
                  key={task.id}
                  onDuplicate={onDuplicate}
                  onEdit={onEdit}
                  onReorder={onReorder}
                  onSelect={toggleSelected}
                  onToggle={onToggle}
                  onTrash={onTrash}
                  selected={selectedIds.includes(task.id)}
                  tagMap={tagMap}
                  task={task}
                />
              ))}
            </details>
          )}
        </div>
      ) : (
        <div className="empty-list">
          {title === '收集箱' ? <Inbox size={38} /> : <CalendarDays size={38} />}
          <h3>{emptyTitle}</h3>
          <p>把接下来要做的事记下来, EasyDo 会帮你放在合适的位置.</p>
          <button className="primary-button" onClick={onAdd} type="button">
            <CirclePlus size={17} />
            创建第一项任务
          </button>
        </div>
      )}
    </section>
  );
}

type TaskRowProps = {
  category?: Category;
  onDuplicate: (taskId: string) => Promise<void>;
  onEdit: (task: Task) => void;
  onReorder: (sourceId: string, targetId: string) => Promise<void>;
  onSelect: (taskId: string) => void;
  onToggle: (taskId: string) => Promise<void>;
  onTrash: (taskId: string) => Promise<void>;
  selected: boolean;
  tagMap: Map<string, Tag>;
  task: Task;
};

function TaskRow({
  category,
  onDuplicate,
  onEdit,
  onReorder,
  onSelect,
  onToggle,
  onTrash,
  selected,
  tagMap,
  task,
}: TaskRowProps) {
  const dialog = useAppDialog();
  const progress = taskProgress(task);
  return (
    <article
      className={`task-row ${task.priority}${task.completedAt ? ' completed' : ''}${selected ? ' selected' : ''}`}
      draggable={!task.completedAt}
      onDragOver={(event) => event.preventDefault()}
      onDragStart={(event) => event.dataTransfer.setData('text/task-order-id', task.id)}
      onDrop={(event) => {
        const sourceId = event.dataTransfer.getData('text/task-order-id');
        if (sourceId && sourceId !== task.id) void onReorder(sourceId, task.id);
      }}
    >
      <span aria-hidden="true" className="task-drag-handle">
        <GripVertical size={15} />
      </span>
      <input
        aria-label={`选择 ${task.title}`}
        checked={selected}
        className="task-select"
        onChange={() => onSelect(task.id)}
        type="checkbox"
      />
      <button
        aria-label={`${task.completedAt ? '恢复' : '完成'} ${task.title}`}
        className="task-check"
        onClick={() => void onToggle(task.id)}
        type="button"
      >
        {task.completedAt && <Check size={13} />}
      </button>
      <button className="task-row-content" onClick={() => onEdit(task)} type="button">
        <strong>
          {task.important && <Star aria-label="重要任务" className="task-important" size={14} />}
          <span>{task.title}</span>
        </strong>
        <span className="task-meta">
          {task.dueDate && (
            <span>
              <CalendarDays size={12} />
              {format(fromDateKey(task.dueDate), 'M 月 d 日', { locale: zhCN })}
            </span>
          )}
          {task.dueTime && (
            <span>
              <Clock3 size={12} />
              {task.dueTime}
            </span>
          )}
          {task.recurrence && (
            <span>
              <Repeat2 size={12} />
              重复
            </span>
          )}
          {progress.total > 0 && (
            <span>
              <Check size={12} />
              {progress.completed}/{progress.total}
            </span>
          )}
          {category && (
            <span>
              <i style={{ background: category.color }} />
              {category.name}
            </span>
          )}
          {task.tagIds
            .map((tagId) => tagMap.get(tagId))
            .filter(Boolean)
            .map((tag) => (
              <span className="inline-tag" key={tag?.id}>
                #{tag?.name}
              </span>
            ))}
        </span>
        {progress.total > 0 && (
          <span className="task-progress-bar" aria-label={`子任务完成 ${progress.completed} 项`}>
            <i style={{ width: `${(progress.completed / progress.total) * 100}%` }} />
          </span>
        )}
      </button>
      <span className={`row-priority ${task.priority}`} />
      <details className="task-row-menu">
        <summary aria-label={`打开 ${task.title} 的操作菜单`} title="更多操作">
          <MoreHorizontal size={18} />
        </summary>
        <div className="task-row-menu-popover" role="menu">
          <button
            onClick={(event) => {
              closeRowMenu(event.currentTarget);
              onEdit(task);
            }}
            role="menuitem"
            type="button"
          >
            <Edit3 size={15} />
            编辑任务
          </button>
          <button
            onClick={(event) => {
              closeRowMenu(event.currentTarget);
              void onDuplicate(task.id);
            }}
            role="menuitem"
            type="button"
          >
            <Copy size={15} />
            创建副本
          </button>
          <button
            className="danger"
            onClick={async (event) => {
              closeRowMenu(event.currentTarget);
              if (
                await dialog.confirm({
                  confirmText: '移到回收站',
                  danger: true,
                  title: `确定将 "${task.title}" 移到回收站吗?`,
                })
              )
                await onTrash(task.id);
            }}
            role="menuitem"
            type="button"
          >
            <Trash2 size={15} />
            移到回收站
          </button>
        </div>
      </details>
    </article>
  );
}

function closeRowMenu(button: HTMLButtonElement): void {
  button.closest('details')?.removeAttribute('open');
}

const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

function sortForView(tasks: Task[], sort: AppSettings['taskSort']): Task[] {
  return [...tasks].sort((left, right) => {
    if (sort === 'date') {
      return `${left.dueDate ?? '9999-12-31'}${left.dueTime ?? '23:59'}`.localeCompare(
        `${right.dueDate ?? '9999-12-31'}${right.dueTime ?? '23:59'}`,
      );
    }
    if (sort === 'priority') return priorityOrder[left.priority] - priorityOrder[right.priority];
    if (sort === 'created') return right.createdAt.localeCompare(left.createdAt);
    if (sort === 'updated') return right.updatedAt.localeCompare(left.updatedAt);
    return left.order - right.order;
  });
}

function groupForView(
  tasks: Task[],
  grouping: AppSettings['taskGrouping'],
  categoryMap: Map<string, Category>,
): Array<[string, Task[]]> {
  if (grouping === 'none') return [['全部', tasks]];
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const key =
      grouping === 'category'
        ? (categoryMap.get(task.categoryId)?.name ?? '未分类')
        : grouping === 'priority'
          ? priorityLabel(task.priority)
          : (task.dueDate ?? '未安排日期');
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  return [...groups.entries()];
}

function priorityLabel(priority: Priority): string {
  return { high: '高优先级', low: '低优先级', medium: '中优先级', none: '无优先级' }[priority];
}

function prefillForGroup(
  group: string,
  grouping: AppSettings['taskGrouping'],
  categories: Category[],
): Partial<TaskDraft> {
  if (grouping === 'category') {
    return { categoryId: categories.find((category) => category.name === group)?.id };
  }
  if (grouping === 'date') return { dueDate: group === '未安排日期' ? null : group };
  if (grouping === 'priority') {
    const priority = (
      Object.entries({
        high: '高优先级',
        low: '低优先级',
        medium: '中优先级',
        none: '无优先级',
      }) as Array<[Priority, string]>
    ).find(([, label]) => label === group)?.[0];
    return priority ? { priority } : {};
  }
  return {};
}
