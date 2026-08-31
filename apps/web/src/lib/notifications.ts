export type ReminderPermission = NotificationPermission | 'unsupported';

export function isTauriRuntime(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

export async function hasReminderPermission(): Promise<boolean> {
  if (isTauriRuntime()) {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
    return isPermissionGranted();
  }
  return 'Notification' in window && Notification.permission === 'granted';
}

export async function requestLocalReminderPermission(): Promise<ReminderPermission> {
  if (isTauriRuntime()) {
    const { isPermissionGranted, requestPermission } =
      await import('@tauri-apps/plugin-notification');
    if (await isPermissionGranted()) return 'granted';
    const permission = await requestPermission();
    if (permission === 'granted' || permission === 'denied') return permission;
    return 'default';
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

export async function sendLocalReminder(options: {
  body: string;
  tag: string;
  title: string;
}): Promise<void> {
  if (isTauriRuntime()) {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    sendNotification({ body: options.body, title: options.title });
    return;
  }
  new Notification(options.title, {
    body: options.body,
    icon: '/og.png',
    tag: options.tag,
  });
}
