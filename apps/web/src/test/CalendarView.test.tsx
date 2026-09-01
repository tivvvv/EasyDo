import type { Category, Task } from '@easydo/domain';
import { defaultAppSettings, getLocalTimeZone } from '@easydo/domain';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { CalendarView } from '../components/CalendarView';

const category: Category = {
  color: '#655fd7',
  createdAt: '2026-01-01T00:00:00.000Z',
  folderId: null,
  id: 'category-work',
  name: '工作',
  order: 0,
};

const task: Task = {
  allDay: true,
  attachments: [],
  categoryId: category.id,
  completedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  dueDate: '2026-08-31',
  dueTime: null,
  duration: 30,
  endDate: null,
  endTime: null,
  id: 'task-calendar',
  important: false,
  kind: 'task',
  notes: '',
  order: 0,
  parentId: null,
  priority: 'medium',
  recurrence: null,
  reminderMinutes: null,
  reminders: [],
  sectionId: null,
  seriesId: null,
  subtasks: [],
  tagIds: [],
  timeZone: getLocalTimeZone(),
  title: '版本发布',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const callbacks = {
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onMove: vi.fn().mockResolvedValue(undefined),
  onPlan: vi.fn(),
  onQuickEdit: vi.fn(),
  onResize: vi.fn().mockResolvedValue(undefined),
  onSelectDate: vi.fn(),
  onToggle: vi.fn().mockResolvedValue(undefined),
};

describe('进阶日历视图', () => {
  it('显示全年任务密度和连续四周规划', () => {
    const props = {
      ...callbacks,
      categories: [category],
      currentDate: new Date(2026, 7, 31, 12),
      selectedDate: new Date(2026, 7, 31, 12),
      settings: { ...defaultAppSettings },
      tasks: [task],
    };
    const { container, rerender } = render(<CalendarView {...props} mode="year" />);
    expect(screen.getByLabelText('2026 年视图')).toBeInTheDocument();
    expect(container.querySelectorAll('.year-month')).toHaveLength(12);

    rerender(<CalendarView {...props} mode="multiWeek" />);
    expect(container.querySelectorAll('.multi-week-grid .day-cell')).toHaveLength(28);
    expect(screen.getByRole('button', { name: '版本发布' })).toBeInTheDocument();
  });
});
