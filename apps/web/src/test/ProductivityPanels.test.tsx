import type { Category, FilterCriteria, Tag, Task } from '@easydo/domain';
import { defaultAppSettings, defaultFilterCriteria, getLocalTimeZone } from '@easydo/domain';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { FilterPanel } from '../components/FilterPanel';
import { QuickEditPanel } from '../components/QuickEditPanel';
import { ProductivityHub } from '../components/ProductivityHub';

const category: Category = {
  color: '#655fd7',
  createdAt: '2026-08-30T00:00:00.000Z',
  folderId: null,
  id: 'category-work',
  name: '工作',
  order: 0,
};

const tag: Tag = {
  color: '#3fa27c',
  createdAt: '2026-08-30T00:00:00.000Z',
  id: 'tag-focus',
  name: '专注',
};

const task: Task = {
  attachments: [],
  allDay: false,
  categoryId: category.id,
  completedAt: null,
  createdAt: '2026-08-30T00:00:00.000Z',
  deletedAt: null,
  dueDate: '2026-08-31',
  dueTime: '09:30',
  duration: 30,
  endDate: null,
  endTime: '10:00',
  id: 'task-1',
  important: false,
  kind: 'task',
  notes: '',
  order: 0,
  parentId: null,
  priority: 'medium',
  recurrence: null,
  reminderMinutes: null,
  reminders: [],
  seriesId: null,
  sectionId: null,
  subtasks: [],
  tagIds: [tag.id],
  timeZone: getLocalTimeZone(),
  title: '日历任务',
  updatedAt: '2026-08-30T00:00:00.000Z',
};

describe('效率面板', () => {
  it('在效率工作台切换视图并创建习惯', async () => {
    const user = userEvent.setup();
    const onAddHabit = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'prompt').mockReturnValue('晨间阅读');
    render(
      <ProductivityHub
        categories={[category]}
        countdowns={[]}
        focusSessions={[]}
        habits={[]}
        onAddCountdown={vi.fn()}
        onAddFocusSession={vi.fn()}
        onAddHabit={onAddHabit}
        onAddSection={vi.fn()}
        onDeleteCountdown={vi.fn()}
        onDeleteHabit={vi.fn()}
        onDeleteSection={vi.fn()}
        onEdit={vi.fn()}
        onToggleHabit={vi.fn()}
        onUpdateTask={vi.fn()}
        sections={[]}
        settings={{ ...defaultAppSettings }}
        tasks={[task]}
      />,
    );

    expect(screen.getByRole('heading', { name: '任务看板' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '习惯' }));
    await user.click(screen.getByRole('button', { name: '新建习惯' }));
    expect(onAddHabit).toHaveBeenCalledWith('晨间阅读');
    await user.click(screen.getByRole('button', { name: '统计' }));
    expect(screen.getByRole('heading', { name: '效率统计' })).toBeInTheDocument();
  });

  it('组合筛选条件并保存智能清单', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const criteria: FilterCriteria = { ...defaultFilterCriteria, tagIds: [] };
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('近期重点');

    render(
      <FilterPanel
        categories={[category]}
        criteria={criteria}
        filters={[]}
        onApply={onApply}
        onClose={() => undefined}
        onDelete={async () => undefined}
        onSave={onSave}
        tags={[tag]}
      />,
    );

    await user.selectOptions(screen.getByLabelText('日期范围'), 'next7');
    expect(onApply).toHaveBeenCalledWith({ ...criteria, dateRange: 'next7' });
    await user.click(screen.getByRole('button', { name: '#专注' }));
    expect(onApply).toHaveBeenCalledWith({ ...criteria, tagIds: [tag.id] });
    await user.click(screen.getByRole('button', { name: /保存为智能清单/ }));
    expect(onSave).toHaveBeenCalledWith('近期重点', criteria);
    prompt.mockRestore();
  });

  it('快速修改任务并清除无日期任务的时间', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <QuickEditPanel
        categories={[category]}
        onClose={onClose}
        onFullEdit={() => undefined}
        onSave={onSave}
        task={task}
      />,
    );

    await user.clear(screen.getByLabelText('快速编辑标题'));
    await user.type(screen.getByLabelText('快速编辑标题'), '调整后的任务');
    await user.clear(screen.getByLabelText('快速编辑日期'));
    await user.selectOptions(screen.getByLabelText('快速编辑优先级'), 'high');
    await user.click(screen.getByRole('button', { name: /^保存$/ }));

    expect(onSave).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({
        dueDate: null,
        dueTime: null,
        priority: 'high',
        title: '调整后的任务',
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
