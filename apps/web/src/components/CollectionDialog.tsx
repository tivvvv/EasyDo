import { X } from 'lucide-react';
import { useId, useState } from 'react';

type CollectionDialogProps = {
  kind: 'category' | 'tag';
  onClose: () => void;
  onSave: (name: string, color: string) => Promise<void>;
  open: boolean;
};

const colors = ['#655fd7', '#3fa27c', '#df8b4d', '#d65f78', '#388fc7', '#8e64bf'];

export function CollectionDialog({ kind, onClose, onSave, open }: CollectionDialogProps) {
  const titleId = useId();
  const [name, setName] = useState('');
  const [color, setColor] = useState(colors[0] ?? '#655fd7');
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
            <h2 id={titleId}>新建{label}</h2>
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
        </div>
        <footer className="dialog-footer">
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
            创建{label}
          </button>
        </footer>
      </section>
    </div>
  );
}
