import { ArrowDown, ArrowUp, Trash2, X } from 'lucide-react';
import { useId, useState } from 'react';

type CollectionDialogProps = {
  initial?: { color: string; id: string; name: string } | null;
  kind: 'category' | 'tag';
  onClose: () => void;
  onDelete?: (id: string) => Promise<void>;
  onMove?: (direction: -1 | 1) => Promise<void>;
  onSave: (name: string, color: string) => Promise<void>;
  open: boolean;
};

const colors = ['#655fd7', '#3fa27c', '#df8b4d', '#d65f78', '#388fc7', '#8e64bf'];

export function CollectionDialog({
  initial = null,
  kind,
  onClose,
  onDelete,
  onMove,
  onSave,
  open,
}: CollectionDialogProps) {
  const titleId = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? colors[0] ?? '#655fd7');
  const label = kind === 'category' ? '分类' : '标签';

  if (!open) {
    return null;
  }

  const save = async () => {
    if (!name.trim()) {
      return;
    }
    await onSave(name.trim(), color);
    onClose();
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="collection-dialog"
        role="dialog"
      >
        <header className="dialog-header">
          <div>
            <p>管理空间</p>
            <h2 id={titleId}>{initial ? `编辑${label}` : `新建${label}`}</h2>
          </div>
          <button aria-label="关闭" className="icon-button ghost" onClick={onClose} type="button">
            <X size={19} />
          </button>
        </header>
        <div className="dialog-body">
          <label className="field full-field">
            <span>{label}名称</span>
            <input
              autoFocus
              maxLength={30}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void save()}
              placeholder={`输入${label}名称`}
              value={name}
            />
          </label>
          <div className="color-picker" aria-label="选择颜色">
            {colors.map((candidate) => (
              <button
                aria-label={candidate}
                aria-pressed={color === candidate}
                key={candidate}
                onClick={() => setColor(candidate)}
                style={{ background: candidate }}
                type="button"
              />
            ))}
          </div>
          {initial && kind === 'category' && onMove && (
            <div className="collection-order">
              <span>调整侧栏顺序</span>
              <button onClick={() => void onMove(-1)} type="button">
                <ArrowUp size={15} />
                上移
              </button>
              <button onClick={() => void onMove(1)} type="button">
                <ArrowDown size={15} />
                下移
              </button>
            </div>
          )}
        </div>
        <footer className="dialog-footer">
          {initial && onDelete && (
            <button
              className="danger-button"
              onClick={async () => {
                if (window.confirm(`确定删除${label} "${initial.name}" 吗?`)) {
                  await onDelete(initial.id);
                  onClose();
                }
              }}
              type="button"
            >
              <Trash2 size={16} />
              删除
            </button>
          )}
          <span />
          <button className="secondary-button" onClick={onClose} type="button">
            取消
          </button>
          <button
            className="primary-button"
            disabled={!name.trim()}
            onClick={() => void save()}
            type="button"
          >
            {initial ? '保存更改' : `创建${label}`}
          </button>
        </footer>
      </section>
    </div>
  );
}
