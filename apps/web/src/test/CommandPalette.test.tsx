import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { CommandPalette } from '../components/CommandPalette';
import { scoreCommand } from '../lib/commandSearch';

describe('全局命令面板', () => {
  it('搜索并执行命令', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        actions={[
          { id: 'today', label: '打开今天', run, section: '导航' },
          { id: 'calendar', label: '打开日历', run: vi.fn(), section: '导航' },
        ]}
        onClose={onClose}
      />,
    );
    await user.type(screen.getByLabelText('搜索命令'), '今天');
    await user.keyboard('{Enter}');
    expect(run).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('支持方向键选择命令', async () => {
    const user = userEvent.setup();
    const second = vi.fn();
    render(
      <CommandPalette
        actions={[
          { id: 'one', label: '第一项', run: vi.fn(), section: '操作' },
          { id: 'two', label: '第二项', run: second, section: '操作' },
        ]}
        onClose={() => undefined}
      />,
    );
    await user.keyboard('{ArrowDown}{Enter}');
    expect(second).toHaveBeenCalledOnce();
  });

  it('支持不连续字符的模糊匹配', async () => {
    const user = userEvent.setup();
    const calendar = vi.fn();
    render(
      <CommandPalette
        actions={[
          { id: 'today', label: '打开今天', run: vi.fn(), section: '导航' },
          { id: 'calendar', label: '打开日历', run: calendar, section: '导航' },
        ]}
        onClose={() => undefined}
      />,
    );
    await user.type(screen.getByLabelText('搜索命令'), '打日历');
    await user.keyboard('{Enter}');
    expect(calendar).toHaveBeenCalledOnce();
    expect(scoreCommand('打开日历 导航', '打日历')).toBeGreaterThanOrEqual(0);
  });
});
