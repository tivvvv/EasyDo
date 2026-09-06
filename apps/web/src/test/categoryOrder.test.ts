import { moveCategoryInList } from '../lib/categoryOrder';
import { createInitialWorkspace } from '../lib/workspaceData';
import { isTaskView } from '../lib/workspaceView';

describe('分类移动与页面操作范围', () => {
  it('分类可以跨文件夹移动, 组内排序并移回未分组', () => {
    const categories = createInitialWorkspace().categories;
    const [first, second, third] = categories;
    let moved = moveCategoryInList(categories, first!.id, 'folder-1');
    moved = moveCategoryInList(moved, second!.id, 'folder-1', first!.id);
    expect(moved.filter((item) => item.folderId === 'folder-1').map((item) => item.id)).toEqual([
      second!.id,
      first!.id,
    ]);
    moved = moveCategoryInList(moved, first!.id, null, third!.id);
    expect(moved.filter((item) => item.folderId === null).map((item) => item.id)).toEqual([
      first!.id,
      third!.id,
    ]);
    expect(moved.map((item) => item.order)).toEqual([0, 1, 2]);
    expect(categories.every((item) => item.folderId === null)).toBe(true);
  });
  it('支持空组和末尾移动, 拒绝不存在的分类与错误目标', () => {
    const categories = createInitialWorkspace().categories;
    const first = categories[0]!;
    expect(moveCategoryInList(categories, first.id, null).at(-1)?.id).toBe(first.id);
    expect(moveCategoryInList(categories, first.id, null, first.id)).toBe(categories);
    expect(() => moveCategoryInList(categories, 'missing', null)).toThrow('分类不存在');
    expect(() => moveCategoryInList(categories, first.id, 'folder', categories[1]!.id)).toThrow(
      '目标分类',
    );
  });
  it('仅任务列表和日历提供任务添加, 搜索与筛选入口', () => {
    for (const kind of ['history', 'trash', 'settings', 'productivity'] as const) {
      expect(isTaskView({ kind })).toBe(false);
    }
    for (const kind of ['calendar', 'today', 'all', 'inbox'] as const) {
      expect(isTaskView({ kind })).toBe(true);
    }
    expect(isTaskView({ kind: 'category', id: 'work' })).toBe(true);
  });
});
