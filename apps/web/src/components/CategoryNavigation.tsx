import type { Category, Folder, Task } from '@easydo/domain';
import { Edit3, Folder as FolderIcon } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';

type Props = {
  activeCategoryId: string | null;
  activeFolderId: string | null;
  categories: Category[];
  folders: Folder[];
  onChooseCategory: (id: string) => void;
  onChooseFolder: (id: string) => void;
  onManageCategory: (category: Category) => void;
  onManageFolder: (folder: Folder) => void;
  onMove: (id: string, folderId: string | null, beforeId?: string) => Promise<void>;
  onError: (error: unknown) => void;
  tasks: Task[];
};

export function CategoryNavigation(props: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const gesture = useRef<{ id: string; x: number; y: number; started: boolean } | null>(null);
  const suppressClick = useRef(false);

  const destination = (event: PointerEvent) => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const row = element?.closest<HTMLElement>('[data-category-id]');
    if (row) {
      const category = props.categories.find((item) => item.id === row.dataset.categoryId);
      if (!category) return null;
      const bounds = row.getBoundingClientRect();
      const before = event.clientY < bounds.top + bounds.height / 2;
      const siblings = props.categories.filter((item) => item.folderId === category.folderId);
      return {
        folderId: category.folderId,
        beforeId: before ? category.id : siblings[siblings.indexOf(category) + 1]?.id,
        highlight: `${before ? 'before' : 'after'}:${category.id}`,
      };
    }
    const folder = element?.closest<HTMLElement>('[data-folder-id]');
    if (folder?.dataset.folderId)
      return {
        folderId: folder.dataset.folderId,
        beforeId: undefined,
        highlight: folder.dataset.folderId,
      };
    if (element?.closest('.ungrouped-categories'))
      return { folderId: null, beforeId: undefined, highlight: 'ungrouped' };
    return null;
  };
  const finish = (event: PointerEvent, cancelled = false) => {
    const current = gesture.current;
    gesture.current = null;
    setDragging(null);
    setTarget(null);
    if (!current?.started) return;
    suppressClick.current = true;
    const next = cancelled ? null : destination(event);
    if (next) void props.onMove(current.id, next.folderId, next.beforeId).catch(props.onError);
  };

  const renderCategory = (category: Category) => {
    const active = props.activeCategoryId === category.id;
    const count = props.tasks.filter(
      (task) => task.categoryId === category.id && !task.completedAt,
    ).length;
    return (
      <div
        className={`collection-nav-row category-nav-row${active ? ' active' : ''}${dragging === category.id ? ' dragging' : ''}${target === `before:${category.id}` ? ' drop-before' : ''}${target === `after:${category.id}` ? ' drop-after' : ''}`}
        data-category-id={category.id}
        key={category.id}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          suppressClick.current = false;
          if (event.button !== 0 || event.pointerType !== 'mouse') return;
          const source = event.target as HTMLElement;
          if (source.closest('.nav-manage')) return;
          gesture.current = { id: category.id, x: event.clientX, y: event.clientY, started: false };
          // 使用指针捕获避免 macOS WebView 的原生拖放循环吞掉落点事件.
          source.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current) return;
          if (
            !current.started &&
            Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6
          )
            return;
          current.started = true;
          setDragging(current.id);
          setTarget(destination(event)?.highlight ?? null);
        }}
        onPointerUp={(event) => finish(event)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={(event) => finish(event, true)}
      >
        <button
          className={active ? 'active' : ''}
          onClick={() => props.onChooseCategory(category.id)}
          title="拖动以排序或移入文件夹"
          type="button"
        >
          <span className="list-dot" style={{ background: category.color }} />
          <span>{category.name}</span>
          {count > 0 && <span className="nav-count">{count}</span>}
        </button>
        <button
          aria-label={`编辑${category.name}`}
          className="nav-manage"
          onClick={() => props.onManageCategory(category)}
          type="button"
        >
          <Edit3 size={13} />
        </button>
      </div>
    );
  };

  const ungrouped = props.categories.filter((category) => !category.folderId);
  return (
    <>
      {props.folders.map((folder) => {
        const siblings = props.categories.filter((category) => category.folderId === folder.id);
        const categoryIds = new Set(siblings.map((category) => category.id));
        const count = props.tasks.filter(
          (task) => categoryIds.has(task.categoryId) && !task.completedAt,
        ).length;
        const active = props.activeFolderId === folder.id;
        return (
          <div
            className={`folder-nav-group${target === folder.id ? ' drop-folder' : ''}`}
            data-folder-id={folder.id}
            key={folder.id}
          >
            <div className={`collection-nav-row${active ? ' active' : ''}`}>
              <button
                className={active ? 'active' : ''}
                onClick={() => props.onChooseFolder(folder.id)}
                type="button"
              >
                <FolderIcon size={15} />
                <span>{folder.name}</span>
                {count > 0 && <span className="nav-count">{count}</span>}
              </button>
              <button
                aria-label={`编辑${folder.name}`}
                className="nav-manage"
                onClick={() => props.onManageFolder(folder)}
                type="button"
              >
                <Edit3 size={13} />
              </button>
            </div>
            <div className="folder-category-list">{siblings.map(renderCategory)}</div>
          </div>
        );
      })}
      <div
        aria-label="未分组分类"
        className={`ungrouped-categories${target === 'ungrouped' ? ' drop-folder' : ''}`}
      >
        {props.folders.length > 0 && <p className="category-group-label">未分组</p>}
        {ungrouped.map(renderCategory)}
      </div>
    </>
  );
}
