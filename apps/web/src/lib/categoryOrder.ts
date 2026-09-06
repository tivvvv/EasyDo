import type { Category } from '@easydo/domain';

export function moveCategoryInList(
  categories: Category[],
  id: string,
  folderId: string | null,
  beforeId?: string,
): Category[] {
  const category = categories.find((item) => item.id === id);
  if (!category) throw new Error('分类不存在.');
  if (beforeId === id) return categories;
  const remaining = categories.filter((item) => item.id !== id).sort((a, b) => a.order - b.order);
  const siblings = remaining.filter((item) => item.folderId === folderId);
  const before = beforeId ? siblings.find((item) => item.id === beforeId) : undefined;
  if (beforeId && !before) throw new Error('目标分类不在该文件夹中.');
  const last = siblings.at(-1);
  const index = before
    ? remaining.indexOf(before)
    : last
      ? remaining.indexOf(last) + 1
      : remaining.length;
  remaining.splice(index, 0, { ...category, folderId });
  return remaining.map((item, order) => ({ ...item, order }));
}
