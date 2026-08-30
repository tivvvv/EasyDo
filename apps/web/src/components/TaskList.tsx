import type { Category, Tag, Task } from '@easydo/domain';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarDays, Check, CirclePlus, Clock3, Inbox } from 'lucide-react';

import { fromDateKey } from '../lib/calendar';

type TaskListProps = {
  categories: Category[];
  emptyTitle: string;
  onAdd: () => void;
  onEdit: (task: Task) => void;
  onToggle: (taskId: string) => Promise<void>;
  tags: Tag[];
  tasks: Task[];
  title: string;
};

export function TaskList({
  categories,
  emptyTitle,
  onAdd,
  onEdit,
  onToggle,
  tags,
  tasks,
  title,
}: TaskListProps) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const active = tasks.filter((task) => !task.completedAt);
  const completed = tasks.filter((task) => task.completedAt);

  return (
    <section className="list-view">
      <div className="list-view-heading">
        <div>
          <p>任务</p>
          <h2>{title}</h2>
        </div>
        <button className="primary-button" onClick={onAdd} type="button">
          <CirclePlus size={17} />
          添加任务
        </button>
      </div>
      <div className="list-summary">
        <span>
          <strong>{active.length}</strong> 待完成
        </span>
        <span>
          <strong>{completed.length}</strong> 已完成
        </span>
      </div>
      {tasks.length ? (
        <div className="task-list">
          {active.map((task) => (
            <TaskRow
              category={categoryMap.get(task.categoryId)}
              key={task.id}
              onEdit={onEdit}
              onToggle={onToggle}
              tagMap={tagMap}
              task={task}
            />
          ))}
          {completed.length > 0 && (
            <details className="completed-group">
              <summary>已完成 - {completed.length}</summary>
              {completed.map((task) => (
                <TaskRow
                  category={categoryMap.get(task.categoryId)}
                  key={task.id}
                  onEdit={onEdit}
                  onToggle={onToggle}
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
  onToggle: (taskId: string) => Promise<void>;
  tagMap: Map<string, Tag>;
  task: Task;
};

function TaskRow({ category, onEdit, onToggle, tagMap, task }: TaskRowProps) {
  return (
    <article className={`task-row ${task.priority}${task.completedAt ? ' completed' : ''}`}>
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
