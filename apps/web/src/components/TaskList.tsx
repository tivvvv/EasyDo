import type { AppSettings, Category, Priority, Tag, Task, TaskDraft } from '@easydo/domain';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  CalendarDays,
  Check,
  CirclePlus,
  Clock3,
  Copy,
  Inbox,
  Repeat2,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { taskProgress } from '@easydo/domain';

import { fromDateKey } from '../lib/calendar';

type TaskListProps = {
  categories: Category[];
  emptyTitle: string;
  onAdd: () => void;
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
  const activeGroups = groupForView(active, settings.taskGrouping, categoryMap);
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
        <div>
          <p>任务</p>
          <h2>{title}</h2>
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
      <div className="list-summary">
        <span>
          <strong>{active.length}</strong> 待完成
        </span>
        <span>
          <strong>{completed.length}</strong> 已完成
        </span>
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
              {settings.taskGrouping !== 'none' && <h3 className="task-group-heading">{group}</h3>}
              {groupTasks.map((task) => (
                <TaskRow
                  category={categoryMap.get(task.categoryId)}
                  key={task.id}
                  onEdit={onEdit}
                  onReorder={onReorder}
                  onSelect={toggleSelected}
                  onToggle={onToggle}
                  selected={selectedIds.includes(task.id)}
                  tagMap={tagMap}
                  task={task}
                />
              ))}
            </div>
          ))}
          {completed.length > 0 && (
            <details className="completed-group">
              <summary>已完成 - {completed.length}</summary>
              {completed.map((task) => (
                <TaskRow
                  category={categoryMap.get(task.categoryId)}
                  key={task.id}
                  onEdit={onEdit}
                  onReorder={onReorder}
                  onSelect={toggleSelected}
                  onToggle={onToggle}
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
  onEdit: (task: Task) => void;
  onReorder: (sourceId: string, targetId: string) => Promise<void>;
  onSelect: (taskId: string) => void;
  onToggle: (taskId: string) => Promise<void>;
  selected: boolean;
  tagMap: Map<string, Tag>;
  task: Task;
};

function TaskRow({
  category,
  onEdit,
  onReorder,
  onSelect,
  onToggle,
  selected,
  tagMap,
  task,
}: TaskRowProps) {
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
        <strong>{task.title}</strong>
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
      </button>
      <span className={`row-priority ${task.priority}`} />
    </article>
  );
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
