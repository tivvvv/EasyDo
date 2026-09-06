import {
  getPendingHabitReminders,
  syncScheduledTaskReminders,
  syncScheduledHabitReminders,
  hasReminderPermission,
  isTauriRuntime,
  requestLocalReminderPermission,
  sendLocalReminder,
} from '../lib/notifications';

const nativeNotification = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
  pending: vi.fn(),
  cancel: vi.fn(),
  Schedule: { at: vi.fn() },
}));

vi.mock('@tauri-apps/plugin-notification', () => nativeNotification);
const nativeCore = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => nativeCore);
import { createInitialWorkspace } from '../lib/workspaceData';

describe('本地提醒适配器', () => {
  const originalNotification = Object.getOwnPropertyDescriptor(window, 'Notification');
  const originalTauriInternals = Object.getOwnPropertyDescriptor(window, '__TAURI_INTERNALS__');

  afterEach(() => {
    vi.clearAllMocks();
    if (originalNotification) Object.defineProperty(window, 'Notification', originalNotification);
    else Reflect.deleteProperty(window, 'Notification');
    if (originalTauriInternals)
      Object.defineProperty(window, '__TAURI_INTERNALS__', originalTauriInternals);
    else Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('在浏览器不支持通知时返回不支持', async () => {
    Reflect.deleteProperty(window, 'Notification');
    expect(isTauriRuntime()).toBe(false);
    expect(await hasReminderPermission()).toBe(false);
    expect(await requestLocalReminderPermission()).toBe('unsupported');
  });

  it('使用浏览器通知权限并发送提醒', async () => {
    const constructor = vi.fn();
    Object.assign(constructor, {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    Object.defineProperty(window, 'Notification', { configurable: true, value: constructor });

    expect(await hasReminderPermission()).toBe(true);
    expect(await requestLocalReminderPermission()).toBe('granted');
    await sendLocalReminder({ body: '计划时间 09:30.', tag: 'task-1', title: '开始任务' });
    expect(constructor).toHaveBeenCalledWith(
      '开始任务',
      expect.objectContaining({ body: '计划时间 09:30.', tag: 'task-1' }),
    );
  });

  it('在桌面端使用原生通知权限和发送接口', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    nativeNotification.isPermissionGranted.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    nativeNotification.requestPermission.mockResolvedValue('granted');

    expect(isTauriRuntime()).toBe(true);
    expect(await hasReminderPermission()).toBe(true);
    expect(await requestLocalReminderPermission()).toBe('granted');
    await sendLocalReminder({ body: '计划时间 09:30.', tag: 'task-1', title: '开始任务' });

    expect(nativeNotification.requestPermission).toHaveBeenCalledOnce();
    expect(nativeCore.invoke).toHaveBeenCalledWith('plugin:notification|notify', {
      options: { body: '计划时间 09:30.', title: '开始任务' },
    });
  });

  it('规范化桌面端未确定的通知权限', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    nativeNotification.isPermissionGranted.mockResolvedValue(false);
    nativeNotification.requestPermission.mockResolvedValue('prompt');

    expect(await requestLocalReminderPermission()).toBe('default');
  });
});

describe('提醒降级与错误反馈', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    vi.clearAllMocks();
  });
  it('桌面插件缺少调度命令时安全降级, 不产生错误或虚假的调度记录', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    nativeNotification.isPermissionGranted.mockResolvedValue(true);
    nativeNotification.pending.mockRejectedValue(
      'Command plugin:notification|get_pending not found',
    );
    const onScheduled = vi.fn();
    const workspace = createInitialWorkspace();
    expect(await syncScheduledTaskReminders(workspace.tasks, onScheduled)).toBe(0);
    expect(await syncScheduledHabitReminders(workspace.habits)).toBe(0);
    expect(nativeNotification.pending).toHaveBeenCalledOnce();
    expect(nativeNotification.sendNotification).not.toHaveBeenCalled();
    expect(onScheduled).not.toHaveBeenCalled();
  });
  it('原生通知失败可以被调用方捕获', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    nativeCore.invoke.mockRejectedValueOnce('通知权限不可用');
    await expect(sendLocalReminder({ body: '提醒', tag: 'test', title: '任务' })).rejects.toBe(
      '通知权限不可用',
    );
  });
  it('运行期习惯提醒遵守打卡, 暂停, 跳过和去重规则', () => {
    const now = new Date(2026, 8, 6, 9, 5);
    const habit = {
      id: 'habit-1',
      name: '读书',
      color: '#665ee3',
      createdAt: now.toISOString(),
      archivedAt: null,
      pausedAt: null,
      frequency: 'daily' as const,
      weekDays: [],
      logs: [],
      skippedDates: [],
      target: 1,
      goalHistory: [],
      reminderTime: '09:00',
    };
    const reminders = getPendingHabitReminders([habit], now, new Set());
    expect(reminders).toHaveLength(1);
    expect(getPendingHabitReminders([habit], now, new Set([reminders[0]!.key]))).toEqual([]);
    expect(
      getPendingHabitReminders([{ ...habit, pausedAt: now.toISOString() }], now, new Set()),
    ).toEqual([]);
    expect(getPendingHabitReminders([{ ...habit, logs: ['2026-09-06'] }], now, new Set())).toEqual(
      [],
    );
    expect(
      getPendingHabitReminders([{ ...habit, skippedDates: ['2026-09-06'] }], now, new Set()),
    ).toEqual([]);
  });
});
