import type { BackupPayload } from '@easydo/domain';
import {
  clearActivityHistory,
  emptyTrash,
  moveCategory,
  SharedTaskRepository,
} from '../sharedStorage';
import { createInitialWorkspace } from '../lib/workspaceData';

const store = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('../lib/sharedWorkspace', () => ({ sharedWorkspace: store }));

describe('共享工作区管理操作', () => {
  let workspace: BackupPayload;
  beforeEach(() => {
    workspace = createInitialWorkspace();
    store.mutate.mockImplementation(async (mutation) => mutation(workspace));
    workspace.activities = Array.from({ length: 60 }, (_, index) => ({
      action: 'create',
      after: workspace.tasks[index % 3]!,
      before: null,
      createdAt: workspace.exportedAt,
      groupId: `group-${index}`,
      id: `activity-${index}`,
      taskId: workspace.tasks[index % 3]!.id,
    }));
  });
  it('清空全部历史, 不改变任何任务或分类', async () => {
    const original = structuredClone(workspace);
    await clearActivityHistory();
    expect(workspace).toEqual({ ...original, activities: [] });
  });
  it('永久删除同时清理对应撤销记录, 不能从历史复活已清空的任务', async () => {
    const id = workspace.tasks[0]!.id;
    workspace.tasks[0]!.deletedAt = workspace.exportedAt;
    await emptyTrash();
    expect(workspace.tasks).toHaveLength(2);
    expect(workspace.activities.some((item) => item.taskId === id)).toBe(false);
    const second = workspace.tasks[0]!.id;
    await new SharedTaskRepository().delete(second);
    expect(workspace.activities.some((item) => item.taskId === second)).toBe(false);
  });
  it('分类移动在同一写入中更新位置和排序, 并校验目标文件夹', async () => {
    const id = workspace.categories[0]!.id;
    await expect(moveCategory(id, 'missing')).rejects.toThrow('目标文件夹不存在');
    workspace.folders.push({
      id: 'folder',
      name: '项目',
      createdAt: workspace.exportedAt,
      order: 0,
    });
    await moveCategory(id, 'folder');
    expect(workspace.categories.find((category) => category.id === id)?.folderId).toBe('folder');
  });
});
