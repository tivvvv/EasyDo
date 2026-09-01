import { useEffect } from 'react';

import { isTauriRuntime } from '../lib/notifications';

export function useDesktopBridge(incompleteCount: number): void {
  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let active = true;
    let stopListening: (() => void) | null = null;

    const registerShortcut = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      stopListening = await listen('easydo:quick-add', () => {
        window.dispatchEvent(new CustomEvent('easydo:quick-add'));
      });
      const { isRegistered, register } = await import('@tauri-apps/plugin-global-shortcut');
      const shortcut = 'CommandOrControl+Shift+N';
      if (!active || (await isRegistered(shortcut))) return;
      await register(shortcut, () => {
        window.dispatchEvent(new CustomEvent('easydo:quick-add'));
      });
    };
    void registerShortcut();

    return () => {
      active = false;
      stopListening?.();
      void import('@tauri-apps/plugin-global-shortcut').then(({ unregister }) =>
        unregister('CommandOrControl+Shift+N'),
      );
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke('set_dock_badge', { count: incompleteCount }),
    );
  }, [incompleteCount]);
}

export async function getLaunchAtStartup(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const { isEnabled } = await import('@tauri-apps/plugin-autostart');
  return isEnabled();
}

export async function setLaunchAtStartup(enabled: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  const { disable, enable } = await import('@tauri-apps/plugin-autostart');
  if (enabled) await enable();
  else await disable();
}
