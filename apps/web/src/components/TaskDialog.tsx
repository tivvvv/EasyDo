import type {
  Category,
  Priority,
  RecurrenceEditScope,
  Tag,
  Task,
  TaskDraft,
  TaskTemplate,
} from '@easydo/domain';
import { createId, priorityLabels } from '@easydo/domain';
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  CalendarDays,
  Check,
  Clock3,
  Flag,
  Plus,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';

type TaskDialogProps = {
  categories: Category[];
  defaultDate: string | null;
  defaultTime?: string | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onSave: (draft: TaskDraft, id?: string, scope?: RecurrenceEditScope) => Promise<void>;
  onSaveTemplate: (name: string, draft: TaskDraft) => Promise<void>;
  open: boolean;
  tags: Tag[];
  task: Task | null;
  templates: TaskTemplate[];
};

const emptyDraft: TaskDraft = {
  categoryId: 'category-work',
  dueDate: null,
  dueTime: null,
  duration: 30,
  endDate: null,
  notes: '',
  priority: 'none',
  recurrence: null,
  reminderMinutes: null,
  subtasks: [],
  tagIds: [],
  title: '',
};

export function TaskDialog({
  categories,
  defaultDate,
  defaultTime = null,
  onClose,
  onDelete,
  onSave,
  onSaveTemplate,
  open,
  tags,
  task,
  templates,
}: TaskDialogProps) {
  const titleId = useId();
  const [draft, setDraft] = useState<TaskDraft>(() =>
    task
      ? {
          categoryId: task.categoryId,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          duration: task.duration,
          endDate: task.endDate,
          notes: task.notes,
          priority: task.priority,
          recurrence: task.recurrence,
          reminderMinutes: task.reminderMinutes,
          subtasks: task.subtasks,
          tagIds: task.tagIds,
          title: task.title,
        }
      : {
          ...emptyDraft,
          categoryId: categories[0]?.id ?? '',
          dueDate: defaultDate,
          dueTime: defaultDate ? defaultTime : null,
        },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [recurrenceScope, setRecurrenceScope] = useState<RecurrenceEditScope>('future');

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
    if (draft.dueDate && draft.endDate && draft.endDate < draft.dueDate) {
      setError('结束日期不能早于开始日期.');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          ...draft,
          subtasks: draft.subtasks.filter((subtask) => subtask.title.trim()),
          title: draft.title.trim(),
        },
        task?.id,
        task?.recurrence ? recurrenceScope : undefined,
      );
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
          {templates.length > 0 && !task && (
            <label className="field full-field template-picker">
              <span>从模板创建</span>
              <select
                defaultValue=""
                onChange={(event) => {
                  const template = templates.find((item) => item.id === event.target.value);
                  if (template) {
                    setDraft({
                      ...template.draft,
                      dueDate: defaultDate ?? template.draft.dueDate,
                      dueTime: defaultTime ?? template.draft.dueTime,
                      subtasks: template.draft.subtasks.map((subtask) => ({
                        ...subtask,
                        completedAt: null,
                        id: createId('subtask'),
                      })),
                    });
                  }
                }}
              >
                <option value="">选择任务模板</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          )}
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
                onChange={(event) => {
                  const dueDate = event.target.value || null;
                  setDraft({
                    ...draft,
                    dueDate,
                    dueTime: dueDate ? draft.dueTime : null,
                    endDate: dueDate ? draft.endDate : null,
                    recurrence: dueDate ? draft.recurrence : null,
                  });
                }}
                type="date"
                value={draft.dueDate ?? ''}
              />
            </label>
            <label className="field">
              <span>结束日期</span>
              <input
                disabled={!draft.dueDate}
                min={draft.dueDate ?? undefined}
                onChange={(event) => setDraft({ ...draft, endDate: event.target.value || null })}
                type="date"
                value={draft.endDate ?? ''}
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
            <label className="field">
              <span>
                <Repeat2 size={14} />
                重复
              </span>
              <select
                disabled={!draft.dueDate}
                onChange={(event) => {
                  const frequency = event.target.value;
                  setDraft({
                    ...draft,
                    recurrence: frequency
                      ? {
                          endsOn: null,
                          frequency: frequency as NonNullable<TaskDraft['recurrence']>['frequency'],
                          interval: 1,
                          weekDays:
                            frequency === 'weekly' && draft.dueDate
                              ? [new Date(`${draft.dueDate}T12:00:00`).getDay()]
                              : [],
                        }
                      : null,
                  });
                }}
                value={draft.recurrence?.frequency ?? ''}
              >
                <option value="">不重复</option>
                <option value="daily">每天</option>
                <option value="weekdays">每个工作日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
                <option value="yearly">每年</option>
              </select>
            </label>
            <label className="field">
              <span>提醒</span>
              <select
                disabled={!draft.dueDate || !draft.dueTime}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    reminderMinutes: event.target.value ? Number(event.target.value) : null,
                  })
                }
                value={draft.reminderMinutes ?? ''}
              >
                <option value="">不提醒</option>
                <option value="0">任务开始时</option>
                <option value="5">提前 5 分钟</option>
                <option value="10">提前 10 分钟</option>
                <option value="30">提前 30 分钟</option>
                <option value="60">提前 1 小时</option>
                <option value="1440">提前 1 天</option>
              </select>
            </label>
          </div>

          {draft.recurrence && (
            <div className="recurrence-options">
              <label className="field">
                <span>重复间隔</span>
                <input
                  max={99}
                  min={1}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      recurrence: draft.recurrence
                        ? {
                            ...draft.recurrence,
                            interval: Math.max(1, Number(event.target.value)),
                          }
                        : null,
                    })
                  }
                  type="number"
                  value={draft.recurrence.interval}
                />
              </label>
              <label className="field">
                <span>结束日期</span>
                <input
                  min={draft.dueDate ?? undefined}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      recurrence: draft.recurrence
                        ? { ...draft.recurrence, endsOn: event.target.value || null }
                        : null,
                    })
                  }
                  type="date"
                  value={draft.recurrence.endsOn ?? ''}
                />
              </label>
            </div>
          )}

          {draft.recurrence?.frequency === 'weekly' && (
            <fieldset className="choice-field">
              <legend>每周重复日期</legend>
              <div className="weekday-choices">
                {['日', '一', '二', '三', '四', '五', '六'].map((label, day) => {
                  const selected = draft.recurrence?.weekDays.includes(day) ?? false;
                  return (
                    <button
                      aria-pressed={selected}
                      className={selected ? 'selected' : ''}
                      key={label}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          recurrence: draft.recurrence
                            ? {
                                ...draft.recurrence,
                                weekDays: selected
                                  ? draft.recurrence.weekDays.filter((weekDay) => weekDay !== day)
                                  : [...draft.recurrence.weekDays, day],
                              }
                            : null,
                        })
                      }
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {task?.recurrence && (
            <fieldset className="choice-field">
              <legend>重复任务修改范围</legend>
              <div className="scope-choices">
                {(
                  [
                    ['current', '仅本次'],
                    ['future', '本次及以后'],
                    ['all', '全部重复任务'],
                  ] as const
                ).map(([scope, label]) => (
                  <button
                    className={recurrenceScope === scope ? 'selected' : ''}
                    key={scope}
                    onClick={() => setRecurrenceScope(scope)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="choice-field subtask-field">
            <legend>子任务</legend>
            <div className="subtask-editor">
              {draft.subtasks.map((subtask, index) => (
                <div className="subtask-edit-row" key={subtask.id}>
                  <button
                    aria-label={`${subtask.completedAt ? '恢复' : '完成'}子任务 ${index + 1}`}
                    className={`subtask-check${subtask.completedAt ? ' checked' : ''}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        subtasks: draft.subtasks.map((item) =>
                          item.id === subtask.id
                            ? {
                                ...item,
                                completedAt: item.completedAt ? null : new Date().toISOString(),
                              }
                            : item,
                        ),
                      })
                    }
                    type="button"
                  >
                    {subtask.completedAt && <Check size={12} />}
                  </button>
                  <input
                    aria-label={`子任务 ${index + 1}`}
                    maxLength={100}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        subtasks: draft.subtasks.map((item) =>
                          item.id === subtask.id ? { ...item, title: event.target.value } : item,
                        ),
                      })
                    }
                    placeholder="输入子任务"
                    value={subtask.title}
                  />
                  <button
                    aria-label={`上移子任务 ${index + 1}`}
                    disabled={index === 0}
                    onClick={() =>
                      setDraft({ ...draft, subtasks: moveItem(draft.subtasks, index, index - 1) })
                    }
                    type="button"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    aria-label={`下移子任务 ${index + 1}`}
                    disabled={index === draft.subtasks.length - 1}
                    onClick={() =>
                      setDraft({ ...draft, subtasks: moveItem(draft.subtasks, index, index + 1) })
                    }
                    type="button"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    aria-label={`删除子任务 ${index + 1}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        subtasks: draft.subtasks.filter((item) => item.id !== subtask.id),
                      })
                    }
                    type="button"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              <button
                className="add-subtask"
                onClick={() =>
                  setDraft({
                    ...draft,
                    subtasks: [
                      ...draft.subtasks,
                      { completedAt: null, id: createId('subtask'), title: '' },
                    ],
                  })
                }
                type="button"
              >
                <Plus size={15} />
                添加子任务
              </button>
            </div>
          </fieldset>

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
          <button
            className="secondary-button"
            disabled={!draft.title.trim()}
            onClick={() => {
              const name = window.prompt('请输入模板名称.', draft.title.trim());
              if (name?.trim()) void onSaveTemplate(name.trim(), draft);
            }}
            type="button"
          >
            <BookmarkPlus size={16} />
            保存模板
          </button>
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

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}
