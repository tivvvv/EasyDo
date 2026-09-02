import type {
  ActivityRecord,
  Category,
  FocusSession,
  Priority,
  RecurrenceEditScope,
  Section,
  Tag,
  Task,
  TaskDraft,
  TaskTemplate,
} from '@easydo/domain';
import {
  createId,
  createRecurrenceRule,
  createReminder,
  createSubtask,
  getLocalTimeZone,
  priorityLabels,
  taskKindLabels,
  taskActualMinutes,
  taskBlockingDependencies,
} from '@easydo/domain';
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  CalendarDays,
  Check,
  Clock3,
  Flag,
  MessageSquare,
  Paperclip,
  Plus,
  Repeat2,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { useAppDialog } from './AppDialog';
import { LocalizedDateInput } from './LocalizedDateInput';

type TaskDialogProps = {
  categories: Category[];
  defaultCategoryId?: string | null;
  defaultDate: string | null;
  defaultDuration?: number;
  defaultImportant?: boolean;
  defaultPriority?: Priority;
  defaultSectionId?: string | null;
  defaultTime?: string | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onSaveComments?: (id: string, comments: NonNullable<Task['comments']>) => Promise<void>;
  onSave: (draft: TaskDraft, id?: string, scope?: RecurrenceEditScope) => Promise<void>;
  onSaveTemplate: (name: string, draft: TaskDraft) => Promise<void>;
  open: boolean;
  sections: Section[];
  tags: Tag[];
  task: Task | null;
  templates: TaskTemplate[];
  tasks?: Task[];
  activities?: ActivityRecord[];
  focusSessions?: FocusSession[];
};

const emptyDraft: TaskDraft = {
  allDay: true,
  attachments: [],
  categoryId: 'category-work',
  comments: [],
  dueDate: null,
  dueTime: null,
  duration: 30,
  endDate: null,
  endTime: null,
  kind: 'task',
  important: false,
  notes: '',
  parentId: null,
  priority: 'none',
  recurrence: null,
  reminderMinutes: null,
  reminders: [],
  sectionId: null,
  subtasks: [],
  tagIds: [],
  timeZone: getLocalTimeZone(),
  title: '',
};

export function TaskDialog({
  categories,
  defaultCategoryId = null,
  defaultDate,
  defaultDuration = 30,
  defaultImportant = false,
  defaultPriority = 'none',
  defaultSectionId = null,
  defaultTime = null,
  onClose,
  onDelete,
  onSave,
  onSaveComments,
  onSaveTemplate,
  open,
  sections,
  tags,
  task,
  templates,
  tasks = [],
  activities = [],
  focusSessions = [],
}: TaskDialogProps) {
  const dialog = useAppDialog();
  const titleId = useId();
  const [draft, setDraft] = useState<TaskDraft>(() =>
    task
      ? {
          allDay: task.allDay,
          attachments: task.attachments,
          categoryId: task.categoryId,
          comments: task.comments ?? [],
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          dependencyIds: task.dependencyIds ?? [],
          duration: task.duration,
          endDate: task.endDate,
          endTime: task.endTime,
          kind: task.kind,
          important: task.important,
          estimateMinutes: task.estimateMinutes ?? task.duration,
          milestone: task.milestone ?? false,
          notes: task.notes,
          parentId: task.parentId,
          priority: task.priority,
          recurrence: task.recurrence,
          reminderMinutes: task.reminderMinutes,
          reminders: task.reminders,
          scheduleLocked: task.scheduleLocked ?? false,
          sectionId: task.sectionId,
          subtasks: task.subtasks,
          tagIds: task.tagIds,
          timeZone: task.timeZone,
          title: task.title,
        }
      : {
          ...emptyDraft,
          categoryId: defaultCategoryId ?? categories[0]?.id ?? '',
          dueDate: defaultDate,
          dueTime: defaultDate ? defaultTime : null,
          duration: defaultDuration,
          allDay: !defaultTime,
          important: defaultImportant,
          priority: defaultPriority,
          sectionId: defaultSectionId,
        },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [recurrenceScope, setRecurrenceScope] = useState<RecurrenceEditScope>('future');
  const [subtasksCollapsed, setSubtasksCollapsed] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);

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
    try {
      new Intl.DateTimeFormat('zh-CN', { timeZone: draft.timeZone });
    } catch {
      setError('请输入有效的 IANA 时区, 例如 Asia/Shanghai.');
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

  const saveComments = async (comments: NonNullable<Task['comments']>) => {
    setDraft((current) => ({ ...current, comments }));
    if (!task || !onSaveComments) return;
    setSavingComment(true);
    try {
      await onSaveComments(task.id, comments);
    } catch {
      setError('评论保存失败, 请重试.');
    } finally {
      setSavingComment(false);
    }
  };

  const appendComment = () => {
    const content = commentText.trim();
    if (!content || savingComment) return;
    const createdAt = new Date().toISOString();
    const comments = [
      ...(draft.comments ?? []),
      { content, createdAt, id: createId('comment'), updatedAt: createdAt },
    ];
    setCommentText('');
    void saveComments(comments);
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-label={task ? `编辑任务: ${task.title}` : undefined}
        aria-labelledby={task ? undefined : titleId}
        aria-modal="true"
        className={`task-dialog${task ? ' task-detail-drawer' : ''}`}
        role="dialog"
      >
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
          {task && (
            <div className="task-insight-strip">
              <span>
                <strong>{draft.estimateMinutes ?? draft.duration}</strong>
                分钟预计
              </span>
              <span>
                <strong>{taskActualMinutes(task.id, focusSessions)}</strong>
                分钟专注
              </span>
              <span className={taskBlockingDependencies(task, tasks).length ? 'warning' : ''}>
                <strong>{taskBlockingDependencies(task, tasks).length}</strong>
                项前置未完成
              </span>
            </div>
          )}
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

          <fieldset className="choice-field compact-choice-field">
            <legend>条目类型</legend>
            <div className="scope-choices">
              {(['task', 'event', 'note'] as const).map((kind) => (
                <button
                  className={draft.kind === kind ? 'selected' : ''}
                  key={kind}
                  onClick={() => setDraft({ ...draft, kind })}
                  type="button"
                >
                  {taskKindLabels[kind]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="field full-field">
            <span>备注</span>
            <textarea
              maxLength={1000}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              placeholder="添加细节, 链接或执行步骤"
              rows={3}
              value={draft.notes}
            />
            {draft.notes && (
              <details className="notes-preview">
                <summary>预览备注</summary>
                <div>{renderNotePreview(draft.notes)}</div>
              </details>
            )}
          </label>

          <section className="task-comments" aria-label="任务评论">
            <div className="task-comments-heading">
              <span>
                <MessageSquare size={15} />
                评论
              </span>
              <small>{(draft.comments ?? []).length} 条记录</small>
            </div>
            {(draft.comments ?? []).length > 0 && (
              <div className="task-comment-list">
                {(draft.comments ?? []).map((comment) => (
                  <article key={comment.id}>
                    <div>
                      <p>{comment.content}</p>
                      <time>{new Date(comment.createdAt).toLocaleString('zh-CN')}</time>
                    </div>
                    <button
                      aria-label="删除评论"
                      onClick={() =>
                        void saveComments(
                          (draft.comments ?? []).filter((item) => item.id !== comment.id),
                        )
                      }
                      type="button"
                    >
                      <X size={14} />
                    </button>
                  </article>
                ))}
              </div>
            )}
            <div className="task-comment-composer">
              <textarea
                aria-label="添加评论"
                maxLength={500}
                onChange={(event) => setCommentText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.shiftKey) return;
                  event.preventDefault();
                  appendComment();
                }}
                placeholder="记录进展或补充上下文. Enter 添加, Shift + Enter 换行."
                rows={2}
                value={commentText}
              />
              <button
                aria-label="提交评论"
                disabled={!commentText.trim() || savingComment}
                onClick={appendComment}
                type="button"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="field-hint">
              {task ? '评论提交后立即保存, 也可以通过搜索找到.' : '评论会随新任务一起保存.'}
            </p>
          </section>

          <div className="field-grid">
            <label className="field">
              <span>
                <CalendarDays size={14} />
                日期
              </span>
              <LocalizedDateInput
                ariaLabel="日期"
                onChange={(value) => {
                  const dueDate = value || null;
                  setDraft({
                    ...draft,
                    dueDate,
                    dueTime: dueDate ? draft.dueTime : null,
                    allDay: dueDate ? draft.allDay : true,
                    endDate: dueDate ? draft.endDate : null,
                    endTime: dueDate ? draft.endTime : null,
                    recurrence: dueDate ? draft.recurrence : null,
                  });
                }}
                value={draft.dueDate ?? ''}
              />
            </label>
            <label className="field">
              <span>结束日期</span>
              <LocalizedDateInput
                ariaLabel="结束日期"
                disabled={!draft.dueDate}
                min={draft.dueDate ?? undefined}
                onChange={(value) => setDraft({ ...draft, endDate: value || null })}
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
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    allDay: !event.target.value,
                    dueTime: event.target.value || null,
                  })
                }
                type="time"
                value={draft.dueTime ?? ''}
              />
            </label>
            <label className="field">
              <span>结束时间</span>
              <input
                disabled={!draft.dueDate || draft.allDay}
                onChange={(event) => setDraft({ ...draft, endTime: event.target.value || null })}
                type="time"
                value={draft.endTime ?? ''}
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
              <span>工作量估算</span>
              <input
                min="1"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    estimateMinutes: Math.max(1, Number(event.target.value) || 1),
                  })
                }
                step="5"
                type="number"
                value={draft.estimateMinutes ?? draft.duration}
              />
            </label>
            <label className="field">
              <span>分类</span>
              <select
                onChange={(event) =>
                  setDraft({ ...draft, categoryId: event.target.value, sectionId: null })
                }
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
              <span>分区</span>
              <select
                onChange={(event) => setDraft({ ...draft, sectionId: event.target.value || null })}
                value={draft.sectionId ?? ''}
              >
                <option value="">未分区</option>
                {sections
                  .filter((section) => section.categoryId === draft.categoryId)
                  .map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
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
                          ...createRecurrenceRule(
                            frequency as NonNullable<TaskDraft['recurrence']>['frequency'],
                          ),
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
                onChange={(event) => {
                  if (!event.target.value) return;
                  const offsetMinutes = Number(event.target.value);
                  if (draft.reminders.some((item) => item.offsetMinutes === offsetMinutes)) return;
                  setDraft({
                    ...draft,
                    reminderMinutes: draft.reminderMinutes ?? offsetMinutes,
                    reminders: [...draft.reminders, createReminder(offsetMinutes)],
                  });
                }}
                value=""
              >
                <option value="">添加提醒</option>
                <option value="0">任务开始时</option>
                <option value="5">提前 5 分钟</option>
                <option value="10">提前 10 分钟</option>
                <option value="30">提前 30 分钟</option>
                <option value="60">提前 1 小时</option>
                <option value="1440">提前 1 天</option>
              </select>
            </label>
          </div>

          {draft.reminders.length > 0 && (
            <div className="reminder-chips" aria-label="已设置提醒">
              {draft.reminders.map((reminder) => (
                <span key={reminder.id}>
                  {formatReminder(reminder.offsetMinutes)}
                  <select
                    aria-label={`${formatReminder(reminder.offsetMinutes)}基准`}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        reminders: draft.reminders.map((item) =>
                          item.id === reminder.id
                            ? { ...item, reference: event.target.value as 'end' | 'start' }
                            : item,
                        ),
                      })
                    }
                    value={reminder.reference}
                  >
                    <option value="start">开始时间</option>
                    <option value="end">结束时间</option>
                  </select>
                  <select
                    aria-label={`${formatReminder(reminder.offsetMinutes)}重复提醒`}
                    onChange={(event) => {
                      const repeatIntervalMinutes = Number(event.target.value) || null;
                      setDraft({
                        ...draft,
                        reminders: draft.reminders.map((item) =>
                          item.id === reminder.id
                            ? {
                                ...item,
                                repeatCount: repeatIntervalMinutes ? 3 : 1,
                                repeatIntervalMinutes,
                              }
                            : item,
                        ),
                      });
                    }}
                    value={reminder.repeatIntervalMinutes ?? ''}
                  >
                    <option value="">提醒一次</option>
                    <option value="5">每 5 分钟, 共 3 次</option>
                    <option value="10">每 10 分钟, 共 3 次</option>
                    <option value="30">每 30 分钟, 共 3 次</option>
                  </select>
                  <button
                    aria-label={`删除${formatReminder(reminder.offsetMinutes)}提醒`}
                    onClick={() => {
                      const reminders = draft.reminders.filter((item) => item.id !== reminder.id);
                      setDraft({
                        ...draft,
                        reminderMinutes: reminders[0]?.offsetMinutes ?? null,
                        reminders,
                      });
                    }}
                    type="button"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <label className="toggle-row task-schedule-lock">
            <input
              checked={draft.scheduleLocked ?? false}
              disabled={!draft.dueDate}
              onChange={(event) => setDraft({ ...draft, scheduleLocked: event.target.checked })}
              type="checkbox"
            />
            <span>
              <strong>锁定时间块</strong>
              <small>自动规划不会移动或移除这个任务.</small>
            </span>
          </label>

          {draft.recurrence && (
            <div className="recurrence-options">
              <label className="field">
                <span>重复基准</span>
                <select
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      recurrence: draft.recurrence
                        ? {
                            ...draft.recurrence,
                            basis: event.target.value as 'completion' | 'scheduled',
                          }
                        : null,
                    })
                  }
                  value={draft.recurrence.basis}
                >
                  <option value="scheduled">按计划日期</option>
                  <option value="completion">按完成日期</option>
                </select>
              </label>
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
                <span>完成次数后结束</span>
                <input
                  min={1}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      recurrence: draft.recurrence
                        ? {
                            ...draft.recurrence,
                            endAfterOccurrences: event.target.value
                              ? Number(event.target.value)
                              : null,
                          }
                        : null,
                    })
                  }
                  placeholder="不限"
                  type="number"
                  value={draft.recurrence.endAfterOccurrences ?? ''}
                />
              </label>
              {draft.recurrence.frequency === 'monthly' && (
                <label className="field">
                  <span>每月规则</span>
                  <select
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        recurrence: draft.recurrence
                          ? {
                              ...draft.recurrence,
                              monthMode: event.target.value as 'date' | 'lastDay' | 'weekDay',
                              monthWeek:
                                event.target.value === 'weekDay'
                                  ? (draft.recurrence.monthWeek ?? { week: 1, weekDay: 1 })
                                  : null,
                            }
                          : null,
                      })
                    }
                    value={draft.recurrence.monthMode}
                  >
                    <option value="date">同一日期</option>
                    <option value="lastDay">每月最后一天</option>
                    <option value="weekDay">同一周次和星期</option>
                  </select>
                </label>
              )}
              {draft.recurrence.frequency === 'monthly' &&
                draft.recurrence.monthMode === 'weekDay' && (
                  <div className="field month-week-field">
                    <span>月内周次</span>
                    <div>
                      <select
                        aria-label="月内周次"
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            recurrence: draft.recurrence
                              ? {
                                  ...draft.recurrence,
                                  monthWeek: {
                                    week: Number(event.target.value),
                                    weekDay: draft.recurrence.monthWeek?.weekDay ?? 1,
                                  },
                                }
                              : null,
                          })
                        }
                        value={draft.recurrence.monthWeek?.week ?? 1}
                      >
                        <option value="1">第 1 个</option>
                        <option value="2">第 2 个</option>
                        <option value="3">第 3 个</option>
                        <option value="4">第 4 个</option>
                        <option value="-1">最后 1 个</option>
                      </select>
                      <select
                        aria-label="月内星期"
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            recurrence: draft.recurrence
                              ? {
                                  ...draft.recurrence,
                                  monthWeek: {
                                    week: draft.recurrence.monthWeek?.week ?? 1,
                                    weekDay: Number(event.target.value),
                                  },
                                }
                              : null,
                          })
                        }
                        value={draft.recurrence.monthWeek?.weekDay ?? 1}
                      >
                        {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map(
                          (label, index) => (
                            <option key={label} value={index}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>
                )}
              <label className="field">
                <span>结束日期</span>
                <LocalizedDateInput
                  ariaLabel="重复结束日期"
                  min={draft.dueDate ?? undefined}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      recurrence: draft.recurrence
                        ? { ...draft.recurrence, endsOn: value || null }
                        : null,
                    })
                  }
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
            <legend>
              子任务
              <span className="subtask-toolbar">
                {draft.subtasks.length > 0 && (
                  <>
                    <button
                      onClick={() =>
                        setDraft({
                          ...draft,
                          subtasks: draft.subtasks.map((item) => ({
                            ...item,
                            completedAt: new Date().toISOString(),
                          })),
                        })
                      }
                      type="button"
                    >
                      全部完成
                    </button>
                    <button onClick={() => setSubtasksCollapsed((value) => !value)} type="button">
                      {subtasksCollapsed ? '展开' : '收起'}
                    </button>
                  </>
                )}
              </span>
            </legend>
            <div className={`subtask-editor${subtasksCollapsed ? ' collapsed' : ''}`}>
              {draft.subtasks.map((subtask, index) => (
                <div
                  className="subtask-edit-row"
                  draggable
                  key={subtask.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={(event) =>
                    event.dataTransfer.setData('text/subtask-index', String(index))
                  }
                  onDrop={(event) => {
                    const sourceIndex = Number(event.dataTransfer.getData('text/subtask-index'));
                    if (Number.isInteger(sourceIndex) && sourceIndex !== index)
                      setDraft({
                        ...draft,
                        subtasks: moveItem(draft.subtasks, sourceIndex, index),
                      });
                  }}
                >
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
                  <details className="subtask-more">
                    <summary>详细设置</summary>
                    <div>
                      <label>
                        日期
                        <LocalizedDateInput
                          ariaLabel={`子任务 ${index + 1} 日期`}
                          onChange={(value) =>
                            setDraft({
                              ...draft,
                              subtasks: draft.subtasks.map((item) =>
                                item.id === subtask.id ? { ...item, dueDate: value || null } : item,
                              ),
                            })
                          }
                          value={subtask.dueDate ?? ''}
                        />
                      </label>
                      <label>
                        时间
                        <input
                          aria-label={`子任务 ${index + 1} 时间`}
                          disabled={!subtask.dueDate}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              subtasks: draft.subtasks.map((item) =>
                                item.id === subtask.id
                                  ? { ...item, dueTime: event.target.value || null }
                                  : item,
                              ),
                            })
                          }
                          type="time"
                          value={subtask.dueTime ?? ''}
                        />
                      </label>
                      <label>
                        优先级
                        <select
                          aria-label={`子任务 ${index + 1} 优先级`}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              subtasks: draft.subtasks.map((item) =>
                                item.id === subtask.id
                                  ? { ...item, priority: event.target.value as Priority }
                                  : item,
                              ),
                            })
                          }
                          value={subtask.priority}
                        >
                          <option value="none">无</option>
                          <option value="low">低</option>
                          <option value="medium">中</option>
                          <option value="high">高</option>
                        </select>
                      </label>
                      <label className="subtask-notes">
                        备注
                        <input
                          aria-label={`子任务 ${index + 1} 备注`}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              subtasks: draft.subtasks.map((item) =>
                                item.id === subtask.id
                                  ? { ...item, notes: event.target.value }
                                  : item,
                              ),
                            })
                          }
                          placeholder="补充执行细节"
                          value={subtask.notes}
                        />
                      </label>
                    </div>
                  </details>
                </div>
              ))}
              <button
                className="add-subtask"
                onClick={() =>
                  setDraft({
                    ...draft,
                    subtasks: [...draft.subtasks, createSubtask()],
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
            <label className="important-toggle">
              <input
                checked={draft.important}
                onChange={(event) => setDraft({ ...draft, important: event.target.checked })}
                type="checkbox"
              />
              标记为重要任务
            </label>
            <label className="important-toggle">
              <input
                checked={draft.milestone ?? false}
                onChange={(event) => setDraft({ ...draft, milestone: event.target.checked })}
                type="checkbox"
              />
              标记为里程碑
            </label>
          </fieldset>

          {tasks.some((item) => item.id !== task?.id && !item.deletedAt) && (
            <fieldset className="choice-field dependency-field">
              <legend>前置任务</legend>
              <p className="field-hint">前置任务完成后, 当前任务才适合开始.</p>
              <div>
                {tasks
                  .filter((item) => item.id !== task?.id && !item.deletedAt)
                  .slice(0, 30)
                  .map((item) => (
                    <label key={item.id}>
                      <input
                        checked={(draft.dependencyIds ?? []).includes(item.id)}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            dependencyIds: event.target.checked
                              ? [...(draft.dependencyIds ?? []), item.id]
                              : (draft.dependencyIds ?? []).filter((id) => id !== item.id),
                          })
                        }
                        type="checkbox"
                      />
                      <span>{item.title}</span>
                      {item.completedAt && <small>已完成</small>}
                    </label>
                  ))}
              </div>
            </fieldset>
          )}

          <fieldset className="choice-field attachment-field">
            <legend>
              <Paperclip size={14} />
              附件
            </legend>
            <div className="attachment-list">
              {draft.attachments.map((attachment) => (
                <span key={attachment.id}>
                  <a download={attachment.name} href={attachment.dataUrl}>
                    {attachment.name}
                  </a>
                  <small>{formatFileSize(attachment.size)}</small>
                  <button
                    aria-label={`删除附件 ${attachment.name}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        attachments: draft.attachments.filter((item) => item.id !== attachment.id),
                      })
                    }
                    type="button"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
              <label className="secondary-button file-button">
                <Plus size={14} />
                添加附件
                <input
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      setError('单个附件不能超过 5 MB.');
                      return;
                    }
                    if (
                      draft.attachments.length >= 10 ||
                      draft.attachments.reduce((sum, item) => sum + item.size, 0) + file.size >
                        20 * 1024 * 1024
                    ) {
                      setError('每个任务最多 10 个附件, 总大小不能超过 20 MB.');
                      return;
                    }
                    const dataUrl = await readFile(file);
                    setDraft((current) => ({
                      ...current,
                      attachments: [
                        ...current.attachments,
                        {
                          createdAt: new Date().toISOString(),
                          dataUrl,
                          id: createId('attachment'),
                          mimeType: file.type || 'application/octet-stream',
                          name: file.name,
                          size: file.size,
                        },
                      ],
                    }));
                  }}
                  type="file"
                />
              </label>
            </div>
          </fieldset>

          <label className="field full-field">
            <span>时区</span>
            <input
              list="time-zone-list"
              onChange={(event) => setDraft({ ...draft, timeZone: event.target.value })}
              value={draft.timeZone}
            />
            <datalist id="time-zone-list">
              {[
                'Asia/Shanghai',
                'Asia/Tokyo',
                'Europe/London',
                'America/New_York',
                'America/Los_Angeles',
                'UTC',
              ].map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </label>

          {task && (
            <section className="task-activity-timeline">
              <h3>任务动态</h3>
              {activities.filter((item) => item.taskId === task.id).length ? (
                activities
                  .filter((item) => item.taskId === task.id)
                  .slice(0, 12)
                  .map((item) => (
                    <article key={item.id}>
                      <span />
                      <div>
                        <strong>{activityLabel(item.action)}</strong>
                        <time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time>
                      </div>
                    </article>
                  ))
              ) : (
                <p className="field-hint">修改和完成记录会显示在这里.</p>
              )}
            </section>
          )}

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
          <div className="dialog-footer-start">
            {task && (
              <button
                className="danger-button"
                onClick={async () => {
                  if (
                    await dialog.confirm({
                      confirmText: '移到回收站',
                      danger: true,
                      description: '任务可以稍后从回收站恢复.',
                      title: `确定删除任务 "${task.title}" 吗?`,
                    })
                  ) {
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
          </div>
          <div className="dialog-footer-actions">
            <button
              className="secondary-button"
              disabled={!draft.title.trim()}
              onClick={async () => {
                const name = await dialog.prompt({
                  initialValue: draft.title.trim(),
                  label: '模板名称',
                  title: '保存任务模板',
                });
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
          </div>
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

function activityLabel(action: ActivityRecord['action']): string {
  return {
    complete: '完成了任务',
    create: '创建了任务',
    duplicate: '创建了副本',
    restore: '恢复了任务',
    trash: '移到了回收站',
    update: '更新了任务',
  }[action];
}

function formatReminder(minutes: number): string {
  if (minutes === 0) return '开始时';
  if (minutes % 1_440 === 0) return `提前 ${minutes / 1_440} 天`;
  if (minutes % 60 === 0) return `提前 ${minutes / 60} 小时`;
  return `提前 ${minutes} 分钟`;
}

function renderNotePreview(notes: string) {
  return notes.split('\n').map((line, index) => {
    const content = line
      .replace(/^#{1,3}\s+/, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^- \[([ x])\]\s*/i, (_, checked: string) => (checked === 'x' ? '☑ ' : '☐ '));
    return <p key={`${index}-${line}`}>{content || '\u00a0'}</p>;
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('读取附件失败.')));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
