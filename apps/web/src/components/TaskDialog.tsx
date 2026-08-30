import type { Category, Priority, Tag, Task, TaskDraft } from '@easydo/domain';
import { priorityLabels } from '@easydo/domain';
import { CalendarDays, Clock3, Flag, Trash2, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

type TaskDialogProps = {
  categories: Category[];
  defaultDate: string | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onSave: (draft: TaskDraft, id?: string) => Promise<void>;
  open: boolean;
  tags: Tag[];
  task: Task | null;
};

const emptyDraft: TaskDraft = {
  categoryId: 'category-work',
  dueDate: null,
  dueTime: null,
  duration: 30,
  notes: '',
  priority: 'none',
  tagIds: [],
  title: '',
};

export function TaskDialog({
  categories,
  defaultDate,
  onClose,
  onDelete,
  onSave,
  open,
  tags,
  task,
}: TaskDialogProps) {
  const titleId = useId();
  const [draft, setDraft] = useState<TaskDraft>(() =>
    task
      ? {
          categoryId: task.categoryId,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          duration: task.duration,
          notes: task.notes,
          priority: task.priority,
          tagIds: task.tagIds,
          title: task.title,
        }
      : { ...emptyDraft, categoryId: categories[0]?.id ?? '', dueDate: defaultDate },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const save = async () => {
    if (!draft.title.trim()) {
      setError('请输入任务标题.');
      return;
    }

    setSaving(true);
    try {
      await onSave({ ...draft, title: draft.title.trim() }, task?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section aria-labelledby={titleId} aria-modal="true" className="task-dialog" role="dialog">
        <header className="dialog-header">
          <div>
            <p>{task ? '编辑任务' : '新建任务'}</p>
            <h2 id={titleId}>{task ? task.title : '安排一件事'}</h2>
          </div>
          <button aria-label="关闭" className="icon-button ghost" onClick={onClose} type="button">
            <X size={19} />
          </button>
        </header>

        <div className="dialog-body">
          <label className="field full-field">
            <span>任务标题</span>
            <input
              autoFocus
              maxLength={120}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  void save();
                }
              }}
              placeholder="例如: 完成季度复盘"
              value={draft.title}
            />
          </label>

          <label className="field full-field">
            <span>备注</span>
            <textarea
              maxLength={1000}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              placeholder="添加细节, 链接或执行步骤"
              rows={3}
              value={draft.notes}
            />
          </label>

          <div className="field-grid">
            <label className="field">
              <span>
                <CalendarDays size={14} />
                日期
              </span>
              <input
                onChange={(event) => setDraft({ ...draft, dueDate: event.target.value || null })}
                type="date"
                value={draft.dueDate ?? ''}
              />
            </label>
            <label className="field">
              <span>
                <Clock3 size={14} />
                时间
              </span>
              <input
                disabled={!draft.dueDate}
                onChange={(event) => setDraft({ ...draft, dueTime: event.target.value || null })}
                type="time"
                value={draft.dueTime ?? ''}
              />
            </label>
            <label className="field">
              <span>预计时长</span>
              <select
                onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })}
                value={draft.duration}
              >
                {[15, 30, 45, 60, 90, 120].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} 分钟
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>分类</span>
              <select
                onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
                value={draft.categoryId}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="choice-field">
            <legend>
              <Flag size={14} />
              优先级
            </legend>
            <div className="priority-choices">
              {(['none', 'low', 'medium', 'high'] as Priority[]).map((priority) => (
                <button
                  className={`priority-choice ${priority}${draft.priority === priority ? ' active' : ''}`}
                  key={priority}
                  onClick={() => setDraft({ ...draft, priority })}
                  type="button"
                >
                  <span />
                  {priorityLabels[priority]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-field">
            <legend>标签</legend>
            <div className="tag-choices">
              {tags.length ? (
                tags.map((tag) => {
                  const selected = draft.tagIds.includes(tag.id);
                  return (
                    <button
                      aria-pressed={selected}
                      className={selected ? 'tag-choice selected' : 'tag-choice'}
                      key={tag.id}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          tagIds: selected
                            ? draft.tagIds.filter((tagId) => tagId !== tag.id)
                            : [...draft.tagIds, tag.id],
                        })
                      }
                      type="button"
                    >
                      <i style={{ background: tag.color }} />#{tag.name}
                    </button>
                  );
                })
              ) : (
                <p className="field-hint">还没有标签, 可以在侧栏中创建.</p>
              )}
            </div>
          </fieldset>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="dialog-footer">
          {task && (
            <button
              className="danger-button"
              onClick={async () => {
                if (window.confirm(`确定删除任务 "${task.title}" 吗?`)) {
                  await onDelete(task.id);
                  onClose();
                }
              }}
              type="button"
            >
              <Trash2 size={16} />
              删除
            </button>
          )}
          <span />
          <button className="secondary-button" onClick={onClose} type="button">
            取消
          </button>
          <button
            className="primary-button"
            disabled={saving}
            onClick={() => void save()}
            type="button"
          >
            {saving ? '保存中...' : task ? '保存更改' : '创建任务'}
          </button>
        </footer>
      </section>
    </div>
  );
}
