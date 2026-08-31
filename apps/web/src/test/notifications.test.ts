import {
  hasReminderPermission,
  isTauriRuntime,
  requestLocalReminderPermission,
  sendLocalReminder,
} from '../lib/notifications';

const nativeNotification = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-notification', () => nativeNotification);

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
    expect(nativeNotification.sendNotification).toHaveBeenCalledWith({
      body: '计划时间 09:30.',
      title: '开始任务',
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
