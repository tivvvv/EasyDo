import { parseQuickTask } from '@easydo/application';
import type { Category, Tag, TaskDraft } from '@easydo/domain';
import { getLocalTimeZone } from '@easydo/domain';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

type QuickCaptureProps = {
  categories: Category[];
  onCreate: (draft: TaskDraft, newTagNames: string[]) => Promise<void>;
  tags: Tag[];
};

export function QuickCapture({ categories, onCreate, tags }: QuickCaptureProps) {
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const parsed = parseQuickTask(input);
    if (!parsed.draft.title) return;
    const knownTagIds = parsed.tagNames.flatMap((name) => {
      const tag = tags.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      return tag ? [tag.id] : [];
    });
    const draft: TaskDraft = {
      allDay: parsed.draft.allDay ?? !parsed.draft.dueTime,
      attachments: [],
      categoryId: categories[0]?.id ?? '',
      comments: [],
      dueDate: parsed.draft.dueDate ?? null,
      dueTime: parsed.draft.dueTime ?? null,
      duration: parsed.draft.duration ?? 30,
      endDate: null,
      endTime: null,
      kind: 'task',
      important: parsed.draft.priority === 'high',
      notes: '',
      parentId: null,
      priority: parsed.draft.priority ?? 'none',
      recurrence: null,
      reminderMinutes: parsed.draft.reminderMinutes ?? null,
      reminders: parsed.draft.reminders ?? [],
      sectionId: null,
      subtasks: [],
      tagIds: knownTagIds,
      timeZone: getLocalTimeZone(),
      title: parsed.draft.title,
    };
    setSaving(true);
    try {
      await onCreate(
        draft,
        parsed.tagNames.filter(
          (name) => !tags.some((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase()),
        ),
      );
      setInput('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="quick-capture"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      <Sparkles size={17} />
      <input
        aria-label="快速添加任务"
        onChange={(event) => setInput(event.target.value)}
        placeholder="快速添加: 明天下午3点 写周报 #工作 !高 提前30分钟"
        value={input}
      />
      <button disabled={saving || !input.trim()} type="submit">
        {saving ? '添加中...' : '添加'}
      </button>
    </form>
  );
}
