import type { Category, Tag } from '@easydo/domain';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { TaskDialog } from '../components/TaskDialog';

const categories: Category[] = [
  {
    color: '#655fd7',
    createdAt: '2026-08-30T00:00:00.000Z',
    id: 'category-work',
    name: '工作',
    order: 0,
  },
];
const tags: Tag[] = [
  { color: '#655fd7', createdAt: '2026-08-30T00:00:00.000Z', id: 'tag-focus', name: '专注' },
];

describe('任务编辑对话框', () => {
  it('校验标题并提交完整任务', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskDialog
        categories={categories}
        defaultDate="2026-08-30"
        onClose={() => undefined}
        onDelete={async () => undefined}
        onSave={onSave}
        onSaveTemplate={async () => undefined}
        open
        tags={tags}
        task={null}
        templates={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: '创建任务' }));
    expect(screen.getByRole('alert')).toHaveTextContent('请输入任务标题.');

    await user.type(screen.getByLabelText('任务标题'), '完成版本验收');
    await user.click(screen.getByRole('button', { name: '#专注' }));
    await user.click(screen.getByRole('button', { name: '高优先级' }));
    await user.click(screen.getByRole('button', { name: '创建任务' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        dueDate: '2026-08-30',
        priority: 'high',
        tagIds: ['tag-focus'],
        title: '完成版本验收',
      }),
      undefined,
      undefined,
    );
  });

  it('创建重复任务, 提醒和子任务', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskDialog
        categories={categories}
        defaultDate="2026-08-31"
        defaultTime="09:30"
        onClose={() => undefined}
        onDelete={async () => undefined}
        onSave={onSave}
        onSaveTemplate={async () => undefined}
        open
        tags={tags}
        task={null}
        templates={[]}
      />,
    );

    await user.type(screen.getByLabelText('任务标题'), '每日复盘');
    await user.selectOptions(screen.getByLabelText(/重复/), 'daily');
    await user.selectOptions(screen.getByLabelText('提醒'), '10');
    await user.click(screen.getByRole('button', { name: '添加子任务' }));
    await user.type(screen.getByLabelText('子任务 1'), '记录成果');
    await user.click(screen.getByRole('button', { name: '创建任务' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        dueTime: '09:30',
        recurrence: expect.objectContaining({ frequency: 'daily' }),
        reminderMinutes: 10,
        subtasks: [expect.objectContaining({ title: '记录成果' })],
      }),
      undefined,
      undefined,
    );
  });
});
