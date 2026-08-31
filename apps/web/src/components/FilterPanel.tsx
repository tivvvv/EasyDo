import type { Category, FilterCriteria, Priority, SavedFilter, Tag } from '@easydo/domain';
import { Save, SlidersHorizontal, Trash2, X } from 'lucide-react';

type FilterPanelProps = {
  categories: Category[];
  criteria: FilterCriteria;
  filters: SavedFilter[];
  onApply: (criteria: FilterCriteria) => void;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onSave: (name: string, criteria: FilterCriteria) => Promise<void>;
  tags: Tag[];
};

export function FilterPanel({
  categories,
  criteria,
  filters,
  onApply,
  onClose,
  onDelete,
  onSave,
  tags,
}: FilterPanelProps) {
  const update = (patch: Partial<FilterCriteria>) => onApply({ ...criteria, ...patch });

  return (
    <section className="filter-panel" aria-label="组合筛选">
      <header>
        <span>
          <SlidersHorizontal size={16} />
          组合筛选
        </span>
        <button aria-label="关闭筛选" onClick={onClose} type="button">
          <X size={16} />
        </button>
      </header>
      <div className="filter-grid">
        <label>
          <span>日期范围</span>
          <select
            onChange={(event) =>
              update({ dateRange: event.target.value as FilterCriteria['dateRange'] })
            }
            value={criteria.dateRange}
          >
            <option value="all">全部日期</option>
            <option value="today">今天</option>
            <option value="next7">未来 7 天</option>
            <option value="next30">未来 30 天</option>
            <option value="overdue">已过期</option>
            <option value="unscheduled">未安排</option>
          </select>
        </label>
        <label>
          <span>状态</span>
          <select
            onChange={(event) => update({ status: event.target.value as FilterCriteria['status'] })}
            value={criteria.status}
          >
            <option value="active">待完成</option>
            <option value="completed">已完成</option>
            <option value="all">全部状态</option>
          </select>
        </label>
        <label>
          <span>分类</span>
          <select
            onChange={(event) => update({ categoryId: event.target.value || null })}
            value={criteria.categoryId ?? ''}
          >
            <option value="">全部分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>优先级</span>
          <select
            onChange={(event) => update({ priority: event.target.value as Priority | 'all' })}
            value={criteria.priority}
          >
            <option value="all">全部优先级</option>
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
            <option value="none">无优先级</option>
          </select>
        </label>
      </div>
      <fieldset>
        <legend>标签, 可多选</legend>
        <div className="filter-tags">
          {tags.map((tag) => {
            const selected = criteria.tagIds.includes(tag.id);
            return (
              <button
                aria-pressed={selected}
                className={selected ? 'selected' : ''}
                key={tag.id}
                onClick={() =>
                  update({
                    tagIds: selected
                      ? criteria.tagIds.filter((id) => id !== tag.id)
                      : [...criteria.tagIds, tag.id],
                  })
                }
                type="button"
              >
                <i style={{ background: tag.color }} />#{tag.name}
              </button>
            );
          })}
        </div>
      </fieldset>
      <footer>
        <button
          onClick={() =>
            onApply({
              categoryId: null,
              dateRange: 'all',
              priority: 'all',
              status: 'active',
              tagIds: [],
            })
          }
          type="button"
        >
          重置
        </button>
        <button
          onClick={() => {
            const name = window.prompt('请输入智能清单名称.');
            if (name?.trim()) void onSave(name.trim(), criteria);
          }}
          type="button"
        >
          <Save size={15} />
          保存为智能清单
        </button>
      </footer>
      {filters.length > 0 && (
        <div className="saved-filter-list">
          {filters.map((filter) => (
            <div key={filter.id}>
              <button onClick={() => onApply(filter.criteria)} type="button">
                {filter.name}
              </button>
              <button
                aria-label={`删除智能清单 ${filter.name}`}
                onClick={() => void onDelete(filter.id)}
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
