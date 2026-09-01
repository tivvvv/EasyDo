import { parseBackup } from '@easydo/application';
import type { BackupPayload } from '@easydo/domain';
import { db as legacyDatabase, Dexie, exportBackup as exportLegacyBackup } from '@easydo/storage';

import { isTauriRuntime } from './notifications';
import { createInitialWorkspace, mergeWorkspaces } from './workspaceData';

const DATA_SERVICE_ORIGIN = 'http://127.0.0.1:24873';
const API_BASE = `${DATA_SERVICE_ORIGIN}/api/v1`;
const CLIENT_HEADER = { 'X-EasyDo-Client': '1' } as const;
const MIGRATION_KEY = 'easydo:shared-data-migrated:v1';
const SOURCE_ID_KEY = 'easydo:shared-data-source-id:v1';

export type SharedPersistenceStatus =
  | { kind: 'connecting'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'migrated'; message: string }
  | { kind: 'ready'; message: string };

type WorkspaceEnvelope = {
  payload: BackupPayload;
  revision: number;
  updatedAt: string;
};

type SaveResponse = { revision: number; updatedAt: string };

class RevisionConflictError extends Error {}

let persistenceStatus: SharedPersistenceStatus = {
  kind: 'connecting',
  message: '正在连接 EasyDo 本机数据服务.',
};

function publishStatus(next: SharedPersistenceStatus): void {
  persistenceStatus = next;
  window.dispatchEvent(new CustomEvent('easydo:persistence-status', { detail: next }));
}

export function getSharedPersistenceStatus(): SharedPersistenceStatus {
  return persistenceStatus;
}

function requestUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function fetchWorkspace(): Promise<WorkspaceEnvelope | null> {
  const response = await fetch(requestUrl('/workspace'), { headers: CLIENT_HEADER });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`读取共享数据失败, 状态码 ${response.status}.`);
  const body = (await response.json()) as Omit<WorkspaceEnvelope, 'payload'> & { payload: unknown };
  return { ...body, payload: parseBackup(JSON.stringify(body.payload)) };
}

async function saveWorkspace(payload: BackupPayload, baseRevision: number): Promise<SaveResponse> {
  const response = await fetch(requestUrl('/workspace'), {
    body: JSON.stringify({ baseRevision, payload }),
    headers: { ...CLIENT_HEADER, 'Content-Type': 'application/json' },
    method: 'PUT',
  });
  if (response.status === 409) throw new RevisionConflictError('共享数据版本已更新.');
  if (!response.ok) throw new Error(`保存共享数据失败, 状态码 ${response.status}.`);
  return (await response.json()) as SaveResponse;
}

async function archiveLegacyWorkspace(payload: BackupPayload, sourceId: string): Promise<void> {
  const response = await fetch(requestUrl('/migrations'), {
    body: JSON.stringify({
      payload,
      sourceId,
      sourceLabel: isTauriRuntime() ? 'macOS 客户端 IndexedDB' : `网页端 ${window.location.origin}`,
    }),
    headers: { ...CLIENT_HEADER, 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error('无法创建旧数据迁移备份.');
}

type WorkspaceListener = () => void;

class SharedWorkspaceStore {
  private envelope: WorkspaceEnvelope | null = null;
  private eventSource: EventSource | null = null;
  private initialization: Promise<void> | null = null;
  private listeners = new Set<WorkspaceListener>();
  private refreshTimer: number | null = null;
  private writeQueue: Promise<unknown> = Promise.resolve();

  getSnapshot = (): BackupPayload | undefined => this.envelope?.payload;

  subscribe = (listener: WorkspaceListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  initialize(): Promise<void> {
    this.initialization ??= this.initializeOnce().catch((error: unknown) => {
      this.initialization = null;
      const message = error instanceof Error ? error.message : String(error);
      publishStatus({ kind: 'error', message: `无法连接共享数据: ${message}` });
      throw error;
    });
    return this.initialization;
  }

  async refresh(): Promise<void> {
    const remote = await fetchWorkspace();
    if (remote && (!this.envelope || remote.revision > this.envelope.revision)) {
      this.setEnvelope(remote);
      publishStatus({ kind: 'ready', message: '网页端和客户端已同步到同一份本机数据.' });
    }
  }

  mutate<T>(mutation: (workspace: BackupPayload) => T): Promise<T> {
    const operation = this.writeQueue.then(async () => {
      await this.initialize();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const current = this.envelope ?? (await fetchWorkspace());
        if (!current) throw new Error('共享数据尚未初始化.');
        const draft = structuredClone(current.payload);
        const result = mutation(draft);
        draft.exportedAt = new Date().toISOString();
        try {
          const saved = await saveWorkspace(draft, current.revision);
          this.setEnvelope({ payload: draft, ...saved });
          publishStatus({ kind: 'ready', message: '所有更改已保存到共享 SQLite 数据库.' });
          return result;
        } catch (error) {
          if (!(error instanceof RevisionConflictError)) throw error;
          const remote = await fetchWorkspace();
          if (!remote) throw new Error('共享数据在写入期间消失.', { cause: error });
          this.setEnvelope(remote);
        }
      }
      throw new Error('多个窗口持续同时修改数据, 请稍后重试.');
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async replace(payload: BackupPayload): Promise<void> {
    await this.mutate((workspace) => {
      Object.assign(workspace, structuredClone(payload), {
        exportedAt: new Date().toISOString(),
        version: 5,
      });
    });
  }

  private async initializeOnce(): Promise<void> {
    publishStatus({ kind: 'connecting', message: '正在连接 EasyDo 本机数据服务.' });
    const health = await fetch(requestUrl('/health'), { headers: CLIENT_HEADER });
    if (!health.ok) throw new Error('本机数据服务没有响应, 请启动 EasyDo 客户端.');

    let remote = await fetchWorkspace();
    const migrated = localStorage.getItem(MIGRATION_KEY) === 'done';
    const legacyExists = !migrated && (await Dexie.exists('easydo'));
    if (legacyExists) {
      const legacy = await exportLegacyBackup(legacyDatabase);
      const sourceId = this.getSourceId();
      await archiveLegacyWorkspace(legacy, sourceId);
      const merged = remote ? mergeWorkspaces(remote.payload, legacy) : legacy;
      const saved = await saveWorkspace(merged, remote?.revision ?? 0);
      remote = { payload: merged, ...saved };
      localStorage.setItem(MIGRATION_KEY, 'done');
      legacyDatabase.close();
      await Dexie.delete('easydo');
      publishStatus({ kind: 'migrated', message: '旧数据已备份并迁移到共享 SQLite 数据库.' });
    } else if (!remote) {
      const payload = createInitialWorkspace();
      const saved = await saveWorkspace(payload, 0);
      remote = { payload, ...saved };
    }

    if (!remote) throw new Error('无法初始化共享数据.');
    this.setEnvelope(remote);
    if (!legacyExists) {
      publishStatus({ kind: 'ready', message: '网页端和客户端已连接同一份本机数据.' });
    }
    this.startUpdates();
  }

  private getSourceId(): string {
    const existing = localStorage.getItem(SOURCE_ID_KEY);
    if (existing) return existing;
    const id = `${isTauriRuntime() ? 'desktop' : 'web'}-migration-${crypto.randomUUID()}`;
    localStorage.setItem(SOURCE_ID_KEY, id);
    return id;
  }

  private setEnvelope(envelope: WorkspaceEnvelope): void {
    this.envelope = { ...envelope, payload: parseBackup(JSON.stringify(envelope.payload)) };
    for (const listener of this.listeners) listener();
  }

  private startUpdates(): void {
    if (this.eventSource) return;
    this.eventSource = new EventSource(requestUrl('/events'));
    this.eventSource.addEventListener('workspace', (event) => {
      const revision = Number((event as MessageEvent<string>).data);
      if (Number.isFinite(revision) && revision > (this.envelope?.revision ?? 0)) {
        void this.refresh();
      }
    });
    this.eventSource.addEventListener('error', () => {
      publishStatus({ kind: 'connecting', message: '实时连接正在恢复, 已启用自动校对.' });
    });
    this.refreshTimer ??= window.setInterval(() => void this.refresh(), 3_000);
  }
}

export const sharedWorkspace = new SharedWorkspaceStore();
