import type { Category, Priority, Task, TaskDraft } from '@easydo/domain';
import { ExternalLink, FastForward, Save, X } from 'lucide-react';
import { useState } from 'react';

type QuickEditPanelProps = {
  categories: Category[];
  onClose: () => void;
  onFullEdit: (task: Task) => void;
  onSave: (id: string, patch: Partial<TaskDraft>) => Promise<void>;
  onSkip?: (id: string) => Promise<void>;
  onPostpone?: (id: string, minutes: number) => Promise<void>;
  task: Task;
};

export function QuickEditPanel({
  categories,
  onClose,
  onFullEdit,
  onSave,
  onSkip,
  onPostpone,
  task,
}: QuickEditPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [dueTime, setDueTime] = useState(task.dueTime ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [categoryId, setCategoryId] = useState(task.categoryId);

  return (
    <div
      className="quick-edit-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="quick-edit-panel" aria-label={`快速编辑 ${task.title}`}>
        <header>
          <strong>快速编辑</strong>
          <button aria-label="关闭快速编辑" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>
        <input
          aria-label="快速编辑标题"
          autoFocus
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />
        <div>
          <input
            aria-label="快速编辑日期"
            onChange={(event) => setDueDate(event.target.value)}
            type="date"
            value={dueDate}
          />
          <input
            aria-label="快速编辑时间"
            disabled={!dueDate}
            onChange={(event) => setDueTime(event.target.value)}
            type="time"
            value={dueTime}
          />
        </div>
        <div>
          <select
            aria-label="快速编辑分类"
            onChange={(event) => setCategoryId(event.target.value)}
            value={categoryId}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            aria-label="快速编辑优先级"
            onChange={(event) => setPriority(event.target.value as Priority)}
            value={priority}
          >
            <option value="none">无优先级</option>
            <option value="low">低优先级</option>
            <option value="medium">中优先级</option>
            <option value="high">高优先级</option>
          </select>
        </div>
        <footer>
          {task.recurrence && onSkip && (
            <button
              onClick={async () => {
                await onSkip(task.id);
                onClose();
              }}
              type="button"
            >
              <FastForward size={15} />
              跳过本次
            </button>
          )}
          {task.dueDate && onPostpone && (
            <button onClick={() => void onPostpone(task.id, 1_440)} type="button">
              推迟一天
            </button>
          )}
          <button onClick={() => onFullEdit(task)} type="button">
            <ExternalLink size={15} />
            完整编辑
          </button>
          <button
            className="primary-button"
            disabled={!title.trim()}
            onClick={async () => {
              await onSave(task.id, {
                categoryId,
                dueDate: dueDate || null,
                dueTime: dueDate ? dueTime || null : null,
                priority,
                title: title.trim(),
              });
              onClose();
            }}
            type="button"
          >
            <Save size={15} />
            保存
          </button>
        </footer>
      </section>
    </div>
  );
}
