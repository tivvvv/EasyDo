import { parseBackup } from '@easydo/application';
import { db, exportBackup, replaceFromBackup, type EasyDoDatabase } from '@easydo/storage';

import { isTauriRuntime } from './notifications';

type SnapshotRow = {
  payload: string;
  updated_at: string;
};

export type DesktopPersistenceStatus =
  | { kind: 'error'; message: string }
  | { kind: 'ready'; message: string }
  | { kind: 'recovered'; message: string }
  | { kind: 'web'; message: string };

let status: DesktopPersistenceStatus = {
  kind: isTauriRuntime() ? 'ready' : 'web',
  message: isTauriRuntime() ? '正在连接桌面数据库.' : '正在使用浏览器本地数据库.',
};
let nativeDatabasePromise: Promise<import('@tauri-apps/plugin-sql').default> | null = null;
let snapshotTimer: number | null = null;

function publishStatus(next: DesktopPersistenceStatus): void {
  status = next;
  window.dispatchEvent(new CustomEvent('easydo:persistence-status', { detail: next }));
}

export function getDesktopPersistenceStatus(): DesktopPersistenceStatus {
  return status;
}

async function getNativeDatabase() {
  nativeDatabasePromise ??= import('@tauri-apps/plugin-sql').then(({ default: Database }) =>
    Database.load('sqlite:easydo.db'),
  );
  return nativeDatabasePromise;
}

export async function restoreDesktopSnapshot(
  database: EasyDoDatabase = db,
): Promise<DesktopPersistenceStatus> {
  if (!isTauriRuntime()) return status;

  try {
    const nativeDatabase = await getNativeDatabase();
    const current = await nativeDatabase.select<SnapshotRow[]>(
      "SELECT payload, updated_at FROM snapshots WHERE id = 'current' LIMIT 1",
    );
    const history = await nativeDatabase.select<SnapshotRow[]>(
      'SELECT payload, created_at AS updated_at FROM snapshot_history ORDER BY id DESC LIMIT 10',
    );
    const candidates = [...current, ...history];

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (!candidate) continue;
      try {
        const payload = parseBackup(candidate.payload);
        await replaceFromBackup(payload, database);
        const next: DesktopPersistenceStatus =
          index === 0
            ? { kind: 'ready', message: '桌面 SQLite 数据已加载.' }
            : { kind: 'recovered', message: '主数据异常, 已从最近的安全快照恢复.' };
        publishStatus(next);
        return next;
      } catch {
        continue;
      }
    }

    const next = { kind: 'ready', message: '桌面 SQLite 数据库已就绪.' } as const;
    publishStatus(next);
    return next;
  } catch (error) {
    const next = {
      kind: 'error',
      message: `桌面数据库初始化失败: ${error instanceof Error ? error.message : String(error)}`,
    } as const;
    publishStatus(next);
    return next;
  }
}

export function scheduleDesktopSnapshot(database: EasyDoDatabase = db): void {
  if (!isTauriRuntime()) return;
  if (snapshotTimer !== null) window.clearTimeout(snapshotTimer);
  snapshotTimer = window.setTimeout(() => {
    snapshotTimer = null;
    void saveDesktopSnapshot(database);
  }, 900);
}

export async function saveDesktopSnapshot(database: EasyDoDatabase = db): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const [nativeDatabase, payload] = await Promise.all([
      getNativeDatabase(),
      exportBackup(database),
    ]);
    const serialized = JSON.stringify(payload);
    const createdAt = new Date().toISOString();
    await nativeDatabase.execute(
      'INSERT INTO snapshot_history(payload, created_at) VALUES ($1, $2)',
      [serialized, createdAt],
    );
    await nativeDatabase.execute(
      "INSERT INTO snapshots(id, payload, updated_at) VALUES ('current', $1, $2) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
      [serialized, createdAt],
    );
    await nativeDatabase.execute(
      'DELETE FROM snapshot_history WHERE id NOT IN (SELECT id FROM snapshot_history ORDER BY id DESC LIMIT 10)',
    );
    publishStatus({ kind: 'ready', message: '所有更改已安全保存到 SQLite.' });
  } catch (error) {
    publishStatus({
      kind: 'error',
      message: `桌面数据保存失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
